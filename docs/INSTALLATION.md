# Installation

Run commands from the repository root after `pnpm install --frozen-lockfile`, using Node.js 22 or later. The repository pins pnpm 10.4.1; on Windows PowerShell, use `pnpm.cmd` if `pnpm.ps1` is blocked by execution policy. The direct Node commands below avoid package-manager banners when consuming JSON.

## Inspect before installing

```bash
node packages/cli/bin/skills-hub.mjs help
node packages/cli/bin/skills-hub.mjs search brainstorming --agent codex --json
node packages/cli/bin/skills-hub.mjs info obra/superpowers/brainstorming --agent codex --json
node packages/cli/bin/skills-hub.mjs list --agent codex --scope project --json
```

`search` and `info` describe indexed capabilities. Their `hub_status.availability` reports catalog-only, review-required, eligible, source-direct, or blocked. `hub_status.installation` separately reports verified `installed`, `unverified`, or `not-recorded`. `list` returns Hub installation records in the selected scope, filtered by agent when requested. Catalog metadata alone never establishes installation.

## Current catalog outcomes

As of 2026-10-03 the catalog contains 534 skills: 476 review-required, 12 source-direct, 20 blocked, and 26 bundled skills. The bundled skills are materialized and release-eligible; the other 508 releases remain on hold. See [current status](STATUS.md) for a reproducible count command.

This real blocked entry demonstrates a refused installation without changing files:

```bash
node packages/cli/bin/skills-hub.mjs install obra/superpowers/brainstorming --agent codex --scope project --json
```

Expected: exit code **1**, `success: false`, item `status: blocked`, `installed: false`, and `reason: registry_blocked`. The catalog release reason is `upstream-skill-missing`; adding `--yes` does not override the block.

This source-direct entry demonstrates the external confirmation gate without executing an installer:

```bash
node packages/cli/bin/skills-hub.mjs install anthropics/mcp-builder --agent codex --scope project --json
```

Expected: exit code **1**, `success: false`, item `status: confirmation-required`, `requires_confirmation: true`, and `reason: explicit_confirmation_required`. Explicitly adding `--yes` authorizes the external installer. Its destination and scope behavior depend on that adapter; do not assume every external tool honors the Hub's scope option.

## Supported install interface

Use `install` followed by one existing capability ID, or comma-separated IDs, and `--agent`. The CLI does not expand bundle aliases such as `@core`. There is no `plan` command and no `--remote`, `--overwrite`, or `--force` CLI option; preview policy using `info`.

Supported options are `--agent`, `--scope project|user`, `--yes` (or `-y`), and `--json` where supported. Noninteractive JSON is supported by `search`, `info`, `list`, and `install`. `add`, `create`, and `uninstall` include interactive flows rather than equivalent JSON automation interfaces.

Local installation requires a compatible, bundled, materialized skill with `release.status: eligible`. An unreleased bundle is held with `bundle_not_released`; review-required skills are held with `manual_review_required`. The 26 reviewed local releases now qualify; some list only the generic `agent-skills` target, so install them with `--agent agent-skills`. Their actual packaged files, resources, and installation records are tested in temporary projects inside the workspace.

~~~bash
node packages/cli/bin/skills-hub.mjs install anthropics/frontend-design,anthropics/brand-guidelines,anthropics/internal-comms --agent codex --scope project --json
node packages/cli/bin/skills-hub.mjs info anthropics/frontend-design --agent codex --json
node packages/cli/bin/skills-hub.mjs list --agent codex --scope project --json
~~~

Expected: install returns `success: true`; each skill has `SKILL.md` and `LICENSE.txt` under `.agents/skills/<name>/`, with four additional `examples/*.md` files for internal-comms. The project `.ai-skills-hub/installed.json` records each source revision and file hash. `info`/`list` show `installed` after verification. See [review evidence and limitations](VERIFIED-LOCAL-SKILLS.md); no actual task-quality claim is made.

`install --json` returns `success: true` only when every requested item and resolved dependency installs. Otherwise it returns false, individual outcomes and reasons, and exit code 1. Successful items in a mixed request are retained, not rolled back. Marketplace registration alone is not a completed plugin installation.

## Native destinations and state

| Agent | Default project skill directory |
| --- | --- |
| Codex, Cursor, generic Agent Skills | `.agents/skills` |
| Claude Code | `.claude/skills` |
| GitHub Copilot | `.github/skills` |

The native installer uses the configured primary directory; it does not dynamically try every fallback directory. `--scope user` uses adapter-defined home-directory paths. The default is project scope.

Hub-managed skill records live in `.ai-skills-hub/installed.json` under the project root, or under the home directory for user scope. File hashes are checked before displaying `installed`. Missing or modified files and records without verifiable file evidence display `unverified`. External installations may not have Hub records and therefore may not appear in `list`.

## Verification

```bash
pnpm test
pnpm validate-all
```

Tests install local fixtures only in temporary project directories. The cross-platform runner prints discovered file counts and TAP results, and fails if no test files or no passing tests execute. On Windows without symlink privileges, the single MCP symlink protection test records an explicit skip; other errors remain failures.
