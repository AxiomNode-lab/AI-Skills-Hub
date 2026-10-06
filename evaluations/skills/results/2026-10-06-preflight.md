# Behavior evaluation preflight — 2026-10-06

After reconciling PR #9 with `main` at `b55ddf4314e984398f28a2c97ef4a709c06da7a6`, I ran the synthetic preflight once with Codex CLI 0.153.0. Its nested process reached the model service and emitted `turn.completed` with exit code 0, but managed execution policy rejected all three project-local operations: writing `proof.txt`, reading it back, and reading the complete `.agents/skills/synthetic-preflight/SKILL.md`. No `proof.txt` was created and no successful command execution was recorded. The preflight correctly reported `blocked-by-policy`.

The [machine-readable record](2026-10-06-preflight.json) includes the checks and SHA-256 hashes. Raw prompt, JSONL trace, stderr, and synthetic project remain locally under ignored `.ai-skills-hub/evaluations/preflight-GVIa9O/`; no raw trace or private path is committed. This is the same environment limit recorded on 2026-10-03, not a finding about any of the three skills. No managed policy, user configuration, sandbox flag, or skill instruction was changed to force a pass.

The three fixed evaluation cases were **not started**. Their agent and output statuses remain `not-run`, instruction use remains `unproven`, and independent human review remains `pending`. A separate interactive scratch test on 2026-10-06 installed `anthropics/frontend-design` and produced an Arabic HTML page that opened locally. It was not one of the fixed fixtures, and no audited trace proving a complete skill-instruction read or rubric-based human review was captured. It is exploratory installation/output evidence only and does not change any case status or establish skill effectiveness.

To resume the formal evaluation, run `node scripts/evaluations/preflight.mjs --codex-js <path-to-codex.js>` in an environment where ordinary managed policy permits project-local reads and writes. Require `instruction_read`, `proof_written`, and `proof_read` to be true before running `node scripts/evaluations/run.mjs --case all --codex-js <path-to-codex.js>`. Inspect each actual artifact and trace, then record an independent human review using the [evaluation guide](../README.md). Process exit 0, a completed turn, an agent claim, or a browser-opened page alone does not prove skill use.

## Repository verification after reconciliation

- Focused evaluation tests: 9/9 passed.
- Materialized integrity: 414 skills passed.
- `pnpm.cmd validate-all` on Windows: 29 test files, 587 tests; 586 passed, 0 failed, 1 skipped because this local machine cannot create the symbolic-link fixture.
- `pnpm.cmd e2e:package`: passed using a temporary directory on the F: drive; the tarball contained 414 releases and 2362 files, and clean-project CLI/MCP, `npx`, and global-install checks passed.

An earlier E2E attempt reached `npx` and failed with `ENOSPC` on the nearly full C: temporary drive. A second attempt placed `TEMP` under the repository's path containing spaces and exposed the test runner's Windows `.cmd` argument-splitting limitation. The successful run used a separate short F: temporary path; no package code or main branch was changed to work around this local environment issue.
