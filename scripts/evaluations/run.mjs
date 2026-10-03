import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { verifyReviewedDirectory } from '../../packages/materializer/src/reviewed.mjs';
import { verifyInstallRecord } from '../../packages/installer/src/state.mjs';
import { hash, readEvidence, executionStatus, checkOutput } from './checks.mjs';
import { runPreflight } from './preflight.mjs';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
const option = key => args.includes(key) ? args[args.indexOf(key) + 1] : undefined;
const selected = option('--case');
const codexJs = option('--codex-js');
if (!selected || !codexJs || !fs.existsSync(codexJs)) throw new Error('Usage: node scripts/evaluations/run.mjs --case <name|all> --codex-js <installed @openai/codex/bin/codex.js>');
const cases = JSON.parse(fs.readFileSync(path.join(repo, 'evaluations/skills/cases.json'), 'utf8')).filter(c => selected === 'all' || c.name === selected);
if (!cases.length) throw new Error('Unknown evaluation case');
const registry = JSON.parse(fs.readFileSync(path.join(repo, 'catalog/skills.json'), 'utf8'));
const parent = path.join(repo, '.ai-skills-hub', 'evaluations');
fs.mkdirSync(parent, { recursive: true });
const run = fs.mkdtempSync(path.join(parent, 'run-'));
const json = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
const cli = path.join(repo, 'packages/cli/bin/skills-hub.mjs');
const version = spawnSync(process.execPath, [codexJs, '--version'], { encoding: 'utf8' });
console.log(`Evaluation artifacts: ${run}`);
const preflight = runPreflight(codexJs, run);
console.log(`Preflight: ${preflight.summary.status}`);
if (preflight.summary.status !== 'passed') {
  console.error(`Evaluation cases were not started. Inspect ${path.join(preflight.project, 'preflight-result.json')}`);
  process.exitCode = 2;
}
for (const fixture of preflight.summary.status === 'passed' ? cases : []) {
  const project = path.join(run, fixture.name);
  fs.mkdirSync(project);
  const skill = registry.skills.find(s => s.id === fixture.skill);
  if (skill?.release?.status !== 'eligible' || skill.distribution !== 'bundled' || !skill.materialized) throw new Error(`Not eligible: ${fixture.skill}`);
  const review = JSON.parse(fs.readFileSync(path.join(repo, skill.license.evidence), 'utf8'));
  verifyReviewedDirectory(skill, review, path.resolve(repo, skill.materialized_root));
  fs.mkdirSync(path.join(project, 'catalog'));
  json(path.join(project, 'catalog/skills.json'), { skills: [{ ...skill, materialized_root: path.resolve(repo, skill.materialized_root) }] });
  const install = spawnSync(process.execPath, [cli, 'install', skill.id, '--agent', 'codex', '--scope', 'project', '--json'], { cwd: project, encoding: 'utf8' });
  if (install.status !== 0 || !JSON.parse(install.stdout).success) throw new Error(`Install failed: ${install.stdout} ${install.stderr}`);
  const record = JSON.parse(fs.readFileSync(path.join(project, '.ai-skills-hub/installed.json'), 'utf8')).installed[skill.id];
  if (!verifyInstallRecord(record).ok) throw new Error('Installation verification failed');
  verifyReviewedDirectory(skill, review, record.destination);
  for (const command of ['info', 'list']) {
    const result = spawnSync(process.execPath, [cli, command, ...(command === 'info' ? [skill.id] : []), '--agent', 'codex', '--json'], { cwd: project, encoding: 'utf8' });
    const data = JSON.parse(result.stdout);
    if (result.status !== 0 || (command === 'info' ? data : data[0]).hub_status.installation.status !== 'installed') throw new Error(`${command} did not report installed`);
  }
  // A nested repository bounds skill discovery and prevents the agent treating the hub as its project.
  const git = spawnSync('git', ['init', '--quiet', project], { encoding: 'utf8' });
  if (git.status !== 0) throw new Error(git.stderr);
  fs.writeFileSync(path.join(project, 'AGENTS.md'), 'Evaluation project: synthetic data only. Work only inside this project. No network, connectors, messages, personal files, package/font installs or subprocess agents. Do not modify .agents, catalog or installation records. Use only the named local skill. Write the requested artifacts; do not grade your own success.\n');
  const reads = fixture.required_reads.map(f => `.agents/skills/${fixture.name}/${f}`);
  const prompt = `Use the installed $${fixture.name} skill for this task. First read these complete files with a shell read command, so the execution trace records which instructions you used: ${reads.join(', ')}. Do not merely mention their names.\n\n${fixture.brief}\n\nWork only within this project; no network, connectors or external sends, no personal files, package installation or subagents. Do not modify installed skill files. Complete the actual artifact, not just a plan.\n`;
  fs.writeFileSync(path.join(project, 'task.txt'), prompt);
  const command = ['exec', '--ignore-user-config', '--ephemeral', '--sandbox', 'workspace-write', '-c', 'web_search="disabled"', '-c', 'features.apps=false', '-c', 'features.multi_agent=false', '--json', '--color', 'never', '-C', project, '-'];
  const started = new Date().toISOString();
  const result = spawnSync(process.execPath, [codexJs, ...command], { input: prompt, encoding: 'utf8', timeout: 300000, maxBuffer: 16 * 1024 * 1024 });
  fs.writeFileSync(path.join(project, 'events.jsonl'), result.stdout ?? '');
  fs.writeFileSync(path.join(project, 'stderr.log'), result.stderr ?? '');
  const events = (result.stdout ?? '').split(/\r?\n/).filter(Boolean).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
  const status = executionStatus(events, result.status);
  const evidence = reads.map((target, i) => ({ path: target, reads: readEvidence(events, project, fixture.name, fixture.required_reads[i], fs.readFileSync(path.join(project, target), 'utf8')) }));
  const summary = {
    skill: skill.id, source_revision: skill.source.revision, started, finished: new Date().toISOString(), platform: process.platform, codex_version: version.stdout?.trim(),
    input_sha256: hash(Buffer.from(prompt)), files: 'verified', installation: 'verified-project', installed_files: record.files.length,
    agent: { status, session_completed: events.some(e => e.type === 'turn.completed'), exit_code: result.status, signal: result.signal, error: result.error?.code ?? null, blocked_by_policy: /rejected: blocked by policy/.test(result.stderr ?? ''), command: command.map(s => s === project ? '<project>' : s), trace_sha256: hash(Buffer.from(result.stdout ?? '')), stderr_sha256: hash(Buffer.from(result.stderr ?? '')) },
    usage: { status: evidence.every(e => e.reads.length) ? 'read-observed' : 'unproven', evidence },
    integrity_after: verifyInstallRecord(record), output: status === 'not-run' ? { status: 'not-run', reason: 'Agent did not execute the task' } : checkOutput(fixture.name, project),
    human_review: { status: 'pending', criteria: fixture.human_criteria },
    conclusion: 'No effectiveness claim: requires completed execution, artifact checks and independent human review; no baseline comparison.'
  };
  json(path.join(project, 'result.json'), summary);
  console.log(`${fixture.name}: agent=${status}, usage=${summary.usage.status}, output=${summary.output.status}`);
}
