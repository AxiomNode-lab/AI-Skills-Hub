import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

// Successful tool reads are evidence of loading, not proof of comprehension or quality.
// This intentionally requires returned content: mentioning a path or self-reporting is insufficient.
export function readEvidence(events, project, name, relative, expectedText) {
  const target = `.agents/skills/${name}/${relative}`;
  const normalizedRoot = project.replaceAll('\\', '/').toLowerCase();
  return events.filter(e => e.type === 'item.completed').map(e => e.item).filter(item => {
    if (item?.type !== 'command_execution' || item.exit_code !== 0 || item.status !== 'completed') return false;
    const command = (item.command ?? '').replaceAll('\\', '/').toLowerCase();
    const output = (item.aggregated_output ?? '').replaceAll('\r\n', '\n');
    const expected = expectedText.replaceAll('\r\n', '\n').trim();
    const mentionsPath = command.includes(target.toLowerCase()) || command.includes(`${normalizedRoot}/${target}`.toLowerCase());
    return mentionsPath && /get-content|\bcat\b|readfile|read_text/.test(command) && output.includes(expected);
  }).map(item => ({ item_id: item.id, path: target, content_sha256: hash(Buffer.from(expectedText)) }));
}

export function executionStatus(events, processStatus) {
  const completed = events.some(e => e.type === 'turn.completed');
  const action = events.some(e => e.type === 'item.completed' && (
    (e.item?.type === 'command_execution' && e.item.exit_code === 0 && e.item.status === 'completed') ||
    (e.item?.type === 'file_change' && e.item.status === 'completed')
  ));
  return !action ? 'not-run' : completed && processStatus === 0 ? 'completed' : 'incomplete';
}

export function checkOutput(name, root) {
  const file = path.join(root, name === 'internal-comms' ? 'update.md' : 'index.html');
  if (!fs.existsSync(file)) return { status: 'not-run', reason: 'No agent output', checks: [] };
  const body = fs.readFileSync(file, 'utf8');
  const checks = [];
  const check = (id, pass) => checks.push({ id, pass: Boolean(pass) });
  if (name === 'internal-comms') {
    const lines = body.trim().split(/\r?\n/).filter(l => l.trim());
    check('four-line-3p-format', lines.length === 4 && /^Progress: /.test(lines[1] ?? '') && /^Plans: /.test(lines[2] ?? '') && /^Problems: /.test(lines[3] ?? ''));
    check('team-and-emoji', /Seedling/.test(lines[0] ?? '') && /\p{Extended_Pictographic}/u.test(lines[0] ?? ''));
    check('60-140-words', body.trim().split(/\s+/).length >= 60 && body.trim().split(/\s+/).length <= 140);
    check('required-facts', /12/.test(lines[1] ?? '') && /9/.test(lines[1] ?? '') && /6/.test(lines[2] ?? '') && /supplier/i.test(lines[3] ?? '') && /packaging/i.test(lines[3] ?? ''));
    check('no-unprovided-numbers', (body.match(/\d+/g) ?? []).every(n => ['5', '05', '9', '09', '2026', '12', '16', '6'].includes(n)));
    check('no-links', !/https?:\/\/|mailto:/i.test(body));
    // A human must still assess dates, semantic fabrication and sentence quality.
  } else {
    check('html-document', /<!doctype html>/i.test(body) && /<html[\s>]/i.test(body) && /<title>.+<\/title>/i.test(body));
    check('viewport', /name=["']viewport["']/i.test(body));
    check('no-external-resources', !/(?:src|href)\s*=\s*["'](?:https?:|\/\/)|@import|url\(\s*["']?https?:|\bfetch\s*\(|XMLHttpRequest|WebSocket/i.test(body));
    if (name === 'frontend-design') {
      check('brief-content', /Mosslight/.test(body) && /24/.test(body) && /seed/i.test(body) && /tray/i.test(body));
      check('design-plan', fs.existsSync(path.join(root, 'design-plan.md')));
      check('keyboard-focus', /:focus(?:-visible)?/.test(body));
      check('reduced-motion', !/@keyframes|animation\s*:|transition\s*:/.test(body) || /prefers-reduced-motion/.test(body));
    } else {
      check('palette', ['#141413', '#faf9f5', '#b0aea5', '#e8e6dc', '#d97757', '#6a9bcc', '#788c5d'].every(c => body.toLowerCase().includes(c)));
      check('font-fallbacks', /Poppins[^;}]*Arial/i.test(body) && /Lora[^;}]*Georgia/i.test(body));
      check('fictional-disclaimer', body.includes('Fictional workshop sample; not affiliated with or endorsed by Anthropic.'));
    }
  }
  return { status: checks.every(c => c.pass) ? 'passed-static-checks' : 'failed-static-checks', checks, file: path.basename(file), bytes: Buffer.byteLength(body), sha256: hash(Buffer.from(body)) };
}
