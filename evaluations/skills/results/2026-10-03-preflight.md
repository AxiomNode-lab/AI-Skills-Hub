# Behavior evaluation preflight — 2026-10-03

The synthetic preflight reached the model service under the same nested Codex
execution flags as the three fixed cases. The nested process could not complete
the first project-local read. Managed execution policy rejected:

```powershell
Get-Content -LiteralPath '.agents/skills/synthetic-preflight/SKILL.md' -Raw
```

The exact stderr result was `rejected: blocked by policy`. The process still
emitted `turn.completed` and exited 0, but it recorded no successful tool event
and did not create `proof.txt`. This confirms that process success and a completed
turn are not task execution evidence. Outer network access was permitted so the
process could reach the configured model service; no nested policy, user setting,
skill installation scope, or sandbox flag was changed.

The first diagnostic launch was excluded because the outer sandbox prevented all
model-service connections and it timed out before a model turn. After fixing the
synthetic fixture's missing frontmatter, the definitive launch above completed in
34.7 seconds. Its raw trace, stderr, prompt and temporary project remain locally
under ignored `.ai-skills-hub/evaluations/preflight-hmyyAG/`. Their hashes and the
redacted invocation are in [the machine-readable record](2026-10-03-preflight.json).

## Decision and case status

The three paid cases were **not rerun**. Repeating them cannot test skill behavior
while the prerequisite instruction read is denied.

| Case | Agent | Instruction use | Output | Human review |
| --- | --- | --- | --- | --- |
| frontend-design | not-run | unproven | not-run | pending |
| brand-guidelines | not-run | unproven | not-run | pending |
| internal-comms | not-run | unproven | not-run | pending |

These statuses carry forward from the recorded 2026-10-02 attempts. They describe
an environment limitation and make no claim that the skills are ineffective.

## Runner corrections

The runner now performs a synthetic project-local read/write/read preflight before
starting any fixed case, and stops with a nonzero exit when it cannot prove all
three operations. This prevents one blocked environment from consuming three live
case runs. The grader also no longer counts a successful read-only command as
actual task execution; a completed task requires a successful non-read action or
completed file change. Focused regression tests cover both fail-closed behaviors.

## Reproduction in a permitted environment

From the repository root, with an installed and authenticated Codex CLI:

```powershell
node scripts/evaluations/preflight.mjs --codex-js C:/absolute/path/to/@openai/codex/bin/codex.js
```

A usable environment must report `status: passed` with `instruction_read`,
`proof_written`, and `proof_read` all true. Then run:

```powershell
node scripts/evaluations/run.mjs --case all --codex-js C:/absolute/path/to/@openai/codex/bin/codex.js
```

The runner repeats the same gate and starts the cases only if it passes. Preserve
the generated raw directories, verify every recorded read and task action, inspect
actual HTML at both documented viewport sizes, and leave `human_review` pending
until an independent person reviews the artifacts.

## Repository verification

- `node --test tests/behavior-evaluations.test.mjs`: 9 tests, 9 passed, 0 failed,
  0 skipped.
- `node scripts/validate-materialized.mjs`: passed for 3 skills.
- `pnpm.cmd validate-all`: passed; 19 test files, 108 tests, 107 passed,
  0 failed, 1 skipped. The existing Windows MCP symbolic-link test skipped after
  link creation returned `EPERM`.
- Workspace validation covered 8 packages and 81 JavaScript modules; schemas: 5;
  registry: 534 skills, 7 bundles, 3 locked; materialized integrity: 3 skills.

The first sandboxed `validate-all` attempt could not fetch pnpm signature metadata.
The same command passed after network access was permitted, without disabling
signature verification.
