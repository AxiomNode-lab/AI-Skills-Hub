# Behavior evaluation preflight — 2026-10-06

After reconciling PR #9 with `main` at `b55ddf4314e984398f28a2c97ef4a709c06da7a6`, I ran the synthetic preflight once with Codex CLI 0.153.0. Its nested process reached the model service and emitted `turn.completed` with exit code 0, but managed execution policy rejected all three project-local operations: writing `proof.txt`, reading it back, and reading the complete `.agents/skills/synthetic-preflight/SKILL.md`. No `proof.txt` was created and no successful command execution was recorded. The preflight correctly reported `blocked-by-policy`.

The [machine-readable record](2026-10-06-preflight.json) includes the checks and SHA-256 hashes. Raw prompt, JSONL trace, stderr, and synthetic project remain locally under ignored `.ai-skills-hub/evaluations/preflight-GVIa9O/`; no raw trace or private path is committed. This is the same environment limit recorded on 2026-10-03, not a finding about any of the three skills. No managed policy, user configuration, sandbox flag, or skill instruction was changed to force a pass.

The user independently reran the same preflight from PowerShell later that day. It again exited 0 after `turn.completed`, while managed policy rejected the project-local write, readback, and skill read; `proof.txt` was absent. The second run's hashes and exact checks are recorded in the JSON report. Neither run started the three fixed evaluation cases. Their agent and output statuses remain `not-run`, instruction use remains `unproven`, and independent human review remains `pending`.

A separate interactive scratch test on 2026-10-06 installed `anthropics/frontend-design` and produced an Arabic HTML page that opened locally. An audit of that specific Codex session found a completed `Get-Content -Raw` call returning the entire installed `SKILL.md`, but its text matched Windows PowerShell's legacy ANSI decoding, not the file's actual UTF-8 text. The file contains non-ASCII characters, and the returned output visibly garbled them. The scratch run was not one of the fixed fixtures, and no rubric-based human review was recorded. Its trace, installed-file, and HTML hashes are in the JSON record; raw user-session data stays local. This is exploratory evidence of installation, a read attempt, and output creation, **not** exact instruction-use evidence or proof of skill effectiveness.

To resume the formal evaluation, run `node scripts/evaluations/preflight.mjs --codex-js <path-to-codex.js>` in an environment where ordinary managed policy permits project-local reads and writes. Require `instruction_read`, `proof_written`, and `proof_read` to be true before running `node scripts/evaluations/run.mjs --case all --codex-js <path-to-codex.js>`. Inspect each actual artifact and trace, then record an independent human review using the [evaluation guide](../README.md). Process exit 0, a completed turn, an agent claim, or a browser-opened page alone does not prove skill use.

## Repository verification after reconciliation

- Focused evaluation tests: 9/9 passed.
- Materialized integrity: 414 skills passed.
- `pnpm.cmd validate-all` on Windows: 29 test files, 587 tests; 586 passed, 0 failed, 1 skipped because this local machine cannot create the symbolic-link fixture.
- `pnpm.cmd e2e:package`: passed using a temporary directory on the F: drive; the tarball contained 414 releases and 2362 files, and clean-project CLI/MCP, `npx`, and global-install checks passed.

An earlier E2E attempt reached `npx` and failed with `ENOSPC` on the nearly full C: temporary drive. A second attempt placed `TEMP` under the repository's path containing spaces and exposed the test runner's Windows `.cmd` argument-splitting limitation. The successful run used a separate short F: temporary path; no package code or main branch was changed to work around this local environment issue.

The runner now tells Windows PowerShell to use `Get-Content -Raw -Encoding utf8` for each required skill file. Its exact-content check continues to reject garbled reads; a focused regression test covers both outcomes. This encoding correction does not bypass or resolve the managed-policy rejection seen in either preflight.

After this correction, the focused evaluation tests passed 10/10. Direct registry, schema, workspace, static, lockfile, materialized-integrity, and dedupe checks passed. The full test suite passed 587/588 with one symbolic-link permission skip when run with access to its existing Windows `/tmp` fixtures. Under the narrower workspace sandbox, six unrelated discovery tests failed with `EPERM` while trying to create `F:\tmp` fixtures; the same discovery file passed 20/20 with temporary-directory access. No discovery implementation or fixture was changed.
