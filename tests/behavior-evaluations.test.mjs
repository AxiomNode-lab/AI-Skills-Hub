import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readEvidence, executionStatus, checkOutput } from '../scripts/evaluations/checks.mjs';
import { runPreflight } from '../scripts/evaluations/preflight.mjs';

const event = (command, output, code = 0) => ({ type: 'item.completed', item: { id: 'read-1', type: 'command_execution', status: 'completed', command, aggregated_output: output, exit_code: code } });
test('usage evidence rejects self-reports, path mentions and failed or partial reads', () => {
  const target = '.agents/skills/internal-comms/examples/3p-updates.md';
  for (const e of [
    { type: 'item.completed', item: { type: 'agent_message', text: `I used ${target}` } },
    event(`echo ${target}`, 'full instructions'),
    event(`cat ${target}`, 'full instructions', 1),
    event(`cat ${target}`, 'full')
  ]) assert.deepEqual(readEvidence([e], '/project', 'internal-comms', 'examples/3p-updates.md', 'full instructions'), []);
});
test('usage evidence accepts complete successful reads on Windows and POSIX', () => {
  for (const command of ['cat .agents/skills/frontend-design/SKILL.md', 'Get-Content -Raw .agents\\skills\\frontend-design\\SKILL.md']) {
    assert.equal(readEvidence([event(command, 'first\r\nsecond')], 'F:\\project', 'frontend-design', 'SKILL.md', 'first\nsecond')[0].item_id, 'read-1');
  }
});
test('usage evidence requires correctly decoded UTF-8 instructions', () => {
  const command = "Get-Content -LiteralPath '.agents/skills/frontend-design/SKILL.md' -Raw -Encoding utf8";
  const expected = 'Make a distinctive design, never a cliché.';
  assert.equal(readEvidence([event(command, expected)], 'F:\\project', 'frontend-design', 'SKILL.md', expected).length, 1);
  assert.deepEqual(readEvidence([event(command, 'Make a distinctive design, never a clichأ©.')], 'F:\\project', 'frontend-design', 'SKILL.md', expected), []);
});
test('execution classification separates startup failure, incomplete execution and completion', () => {
  assert.equal(executionStatus([{ type: 'thread.started' }, { type: 'turn.failed' }], 1), 'not-run');
  assert.equal(executionStatus([event('node build.mjs', 'built')], 1), 'incomplete');
  assert.equal(executionStatus([{ type: 'turn.completed' }], 0), 'not-run');
  assert.equal(executionStatus([event('node build.mjs', 'built'), { type: 'turn.completed' }], 0), 'completed');
  assert.equal(executionStatus([event('cat task.txt', 'blocked', 1), { type: 'turn.completed' }], 0), 'not-run');
  assert.notEqual(executionStatus([{ type: 'turn.completed' }], 1), 'completed');
});
test('successful instruction reads alone are not task execution', () => {
  const completed = { type: 'turn.completed' };
  assert.equal(executionStatus([event('Get-Content -Raw .agents/skills/example/SKILL.md', 'instructions'), completed], 0), 'not-run');
  assert.equal(executionStatus([event('cat .agents/skills/example/SKILL.md', 'instructions'), completed], 0), 'not-run');
  assert.equal(executionStatus([{ type: 'item.completed', item: { type: 'file_change', status: 'completed' } }, completed], 0), 'completed');
});
test('policy-blocked preflight fails closed before evaluations', t => {
  const root = project(t);
  const fakeCodex = path.join(root, 'fake-codex.mjs');
  fs.writeFileSync(fakeCodex, `
process.stdout.write(JSON.stringify({ type: 'thread.started', thread_id: 'synthetic' }) + '\\n');
process.stdout.write(JSON.stringify({ type: 'turn.completed' }) + '\\n');
process.stderr.write('exec_command rejected: blocked by policy\\n');
`);
  const { summary } = runPreflight(fakeCodex, root, 10000);
  assert.equal(summary.status, 'blocked-by-policy');
  assert.equal(summary.checks.session_completed, true);
  assert.equal(summary.checks.instruction_read, false);
  assert.equal(summary.checks.proof_written, false);
  assert.equal(summary.checks.proof_read, false);
});
function project(t) {
  const parent = path.resolve('.ai-skills-hub');
  fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, 'evaluation-check-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
test('missing outputs never count as successful behavioral evaluations', t => {
  assert.equal(checkOutput('frontend-design', project(t)).status, 'not-run');
});
test('3P checks catch invented numeric claims and invalid structure', t => {
  const root = project(t);
  fs.writeFileSync(path.join(root, 'update.md'), 'Seedling\nProgress: Reached 1000 customers.\nPlans: Grow.');
  const result = checkOutput('internal-comms', root);
  for (const id of ['four-line-3p-format', 'team-and-emoji', 'no-unprovided-numbers', 'required-facts']) assert.equal(result.checks.find(c => c.id === id).pass, false);
});
test('static checks do not accept a remote font import or missing brand fallbacks', t => {
  const root = project(t);
  fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><html><title>Test</title><style>@import "https://example.invalid/font.css";body{font-family:Lora}</style></html>');
  const result = checkOutput('brand-guidelines', root);
  assert.equal(result.checks.find(c => c.id === 'no-external-resources').pass, false);
  assert.equal(result.checks.find(c => c.id === 'font-fallbacks').pass, false);
});
test('evaluation fixtures cover exactly the three released skills with human review criteria', () => {
  const cases = JSON.parse(fs.readFileSync('evaluations/skills/cases.json', 'utf8'));
  assert.deepEqual(cases.map(c => c.name).sort(), ['brand-guidelines', 'frontend-design', 'internal-comms']);
  assert.ok(cases.every(c => c.human_criteria.length >= 3));
  assert.ok(cases.find(c => c.name === 'internal-comms').required_reads.includes('examples/3p-updates.md'));
});
