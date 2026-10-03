import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { hash } from './checks.mjs';

const instruction = `---
name: synthetic-preflight
description: Tests project-local reads and writes before live evaluations.
---

# Synthetic preflight

Instruction token: MAPLE-7421.
Write exactly \`MAPLE-7421\` followed by a newline to \`proof.txt\`.
`;
const proof = 'MAPLE-7421\n';

function completedRead(events, target, expected) {
  const normalizedTarget = target.replaceAll('\\', '/').toLowerCase();
  const normalizedExpected = expected.replaceAll('\r\n', '\n').trim();
  return events.some(event => {
    const item = event.type === 'item.completed' ? event.item : null;
    if (item?.type !== 'command_execution' || item.status !== 'completed' || item.exit_code !== 0) return false;
    const command = (item.command ?? '').replaceAll('\\', '/').toLowerCase();
    const output = (item.aggregated_output ?? '').replaceAll('\r\n', '\n');
    return command.includes(normalizedTarget) && /get-content|\bcat\b|readfile|read_text/.test(command) && output.includes(normalizedExpected);
  });
}

export function runPreflight(codexJs, parent, timeout = 180000) {
  if (!codexJs || !fs.existsSync(codexJs)) throw new Error('Pass an existing Codex CLI JavaScript path with --codex-js');
  fs.mkdirSync(parent, { recursive: true });
  const project = fs.mkdtempSync(path.join(parent, 'preflight-'));
  const skillPath = '.agents/skills/synthetic-preflight/SKILL.md';
  const skillDir = path.join(project, path.dirname(skillPath));
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(project, skillPath), instruction);
  fs.writeFileSync(path.join(project, 'AGENTS.md'), 'Synthetic policy preflight. Work only inside this project. No network, external files, settings changes, policy changes, or subagents.\n');
  const git = spawnSync('git', ['init', '--quiet', project], { encoding: 'utf8' });
  if (git.status !== 0) throw new Error(git.stderr);
  const prompt = 'First read the complete `.agents/skills/synthetic-preflight/SKILL.md` with a shell read command. Then follow its instruction to create `proof.txt`, and read `proof.txt` back with a shell command. Do not infer or repeat the token unless the file read succeeds. Work only inside this project.';
  fs.writeFileSync(path.join(project, 'prompt.txt'), prompt + os.EOL);
  const command = ['exec', '--ignore-user-config', '--ephemeral', '--sandbox', 'workspace-write', '-c', 'web_search="disabled"', '-c', 'features.apps=false', '-c', 'features.multi_agent=false', '--json', '--color', 'never', '-C', project, '-'];
  const started = new Date().toISOString();
  const result = spawnSync(process.execPath, [codexJs, ...command], { input: prompt, encoding: 'utf8', timeout, maxBuffer: 8 * 1024 * 1024 });
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  fs.writeFileSync(path.join(project, 'events.jsonl'), stdout);
  fs.writeFileSync(path.join(project, 'stderr.log'), stderr);
  const events = stdout.split(/\r?\n/).filter(Boolean).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
  const proofPath = path.join(project, 'proof.txt');
  const proofText = fs.existsSync(proofPath) ? fs.readFileSync(proofPath, 'utf8') : null;
  const checks = {
    session_completed: events.some(event => event.type === 'turn.completed'),
    process_succeeded: result.status === 0,
    instruction_read: completedRead(events, skillPath, instruction),
    proof_written: proofText?.replaceAll('\r\n', '\n') === proof,
    proof_read: completedRead(events, 'proof.txt', proof)
  };
  const blocked = /rejected: blocked by policy/i.test(stderr);
  const passed = Object.values(checks).every(Boolean);
  const summary = {
    status: passed ? 'passed' : blocked ? 'blocked-by-policy' : result.error?.code === 'ETIMEDOUT' ? 'timed-out' : 'failed',
    started,
    finished: new Date().toISOString(),
    platform: process.platform,
    project: path.basename(project),
    command: command.map(value => value === project ? '<project>' : value),
    exit_code: result.status,
    signal: result.signal,
    error: result.error?.code ?? null,
    checks,
    prompt_sha256: hash(Buffer.from(prompt)),
    trace_sha256: hash(Buffer.from(stdout)),
    stderr_sha256: hash(Buffer.from(stderr))
  };
  fs.writeFileSync(path.join(project, 'preflight-result.json'), JSON.stringify(summary, null, 2) + os.EOL);
  return { summary, project };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const index = args.indexOf('--codex-js');
  const codexJs = index >= 0 ? args[index + 1] : undefined;
  const repo = fileURLToPath(new URL('../../', import.meta.url));
  const { summary, project } = runPreflight(codexJs, path.join(repo, '.ai-skills-hub', 'evaluations'));
  console.log(`Preflight artifacts: ${project}`);
  console.log(JSON.stringify(summary, null, 2));
  if (summary.status !== 'passed') process.exitCode = 2;
}
