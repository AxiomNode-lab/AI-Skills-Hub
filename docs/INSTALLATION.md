# Installation

**Current availability (checked 2026-10-14):** the repository's [status page](STATUS.md#distribution) says the npm package has not yet been published. Until the first release is available, use the source checkout below. The `npx` and global-install commands become usable after the package is published.

Requires Node.js 22 or later.

```bash
git clone https://github.com/AxiomNode-lab/AI-Skills-Hub.git
cd AI-Skills-Hub
corepack enable
pnpm install --frozen-lockfile
pnpm cli --help
pnpm cli available --agent codex
```

From a source checkout, replace `skills-hub <command>` in the examples below with `pnpm cli <command>`. For example, run `pnpm cli search "frontend design" --agent codex`.

After the first npm release, install from any project directory:

```bash
npx @axiomnode-lab/skills-hub --help
# or
npm install -g @axiomnode-lab/skills-hub && skills-hub --help
```

The published package is built with the catalog and every released skill, so commands are designed to run without the source repository and without network access for bundled operations. External discovery, external installers and the daily npm update check need network access; the update check is skipped in CI and off a terminal and can be disabled with `SKILLS_HUB_NO_UPDATE_CHECK=1`.

## Inspect before installing

```bash
skills-hub available --agent codex
skills-hub search "frontend design" --agent codex
skills-hub info anthropics/frontend-design --agent codex --json
skills-hub list --agent codex --scope project --json
```

`search` and `info` report catalog availability (`hub_status.availability`: eligible, source-direct, review-required, blocked or catalog-only) separately from installation state (`hub_status.installation`: installed, unverified or not-recorded). Catalog metadata never establishes installation.

## Install

```bash
skills-hub install anthropics/frontend-design,anthropics/brand-guidelines,anthropics/internal-comms --agent codex --json
```

Expected: exit code 0, `success: true`, three items with `status: success`. Each skill has `SKILL.md` and `LICENSE.txt` under `.agents/skills/<name>/` (internal-comms also has four `examples/*.md`). `.ai-skills-hub/installed.json` records the source revision and the SHA-256 of every installed file.

Install rules:

- Only released skills install locally: `distribution: bundled`, `materialized: true`, `release.status: eligible`, and compatible with `--agent`. A held release returns `bundle_not_released`, a review-required skill `manual_review_required`, a blocked one `registry_blocked`; `--yes` overrides none of these.
- Before writing, the released files are checked against their release manifest (exact file set, size and SHA-256); a mismatch installs nothing.
- Dependencies install first. If one fails, the skills that need it are reported as `dependency-failed` and not installed. Other items in the same command keep their outcome; nothing is rolled back.
- Reinstalling the same revision reports `already-installed` and changes nothing. A folder the Hub did not create, or a Hub installation whose files you edited, is replaced only with `--force`.
- An install path that goes through a symlink or junction is refused.
- `install @name` is refused with `bundle_aliases_not_supported`: bundles are catalog groupings, not install targets.

## Examples of refused installs

```bash
skills-hub install obra/superpowers/brainstorming --agent codex --json
```

Expected: exit code 1, item `status: blocked`, `reason: registry_blocked` (this record is a legacy duplicate; see [status](STATUS.md)).

```bash
skills-hub install anthropics/mcp-builder --agent codex --json
```

Expected: exit code 1, item `status: confirmation-required`, `reason: explicit_confirmation_required`, and `command` showing what `--yes` would run: `npx --yes skills add https://github.com/anthropics/skills/tree/<commit>/skills/mcp-builder/SKILL.md --skill mcp-builder --agent codex -y`. Consenting runs that third-party installer (the `skills` package from npm). Its result is reported, but it does not create a verified Hub record, so `list` may not show it.

## Update and uninstall

```bash
skills-hub update --dry-run
skills-hub update anthropics/frontend-design
skills-hub uninstall anthropics/frontend-design --agent codex --scope project
```

`update` compares each installed revision with the catalog's current release. Statuses: `up-to-date`, `update-available` (dry run), `updated`, `modified` (installed files were edited; use `--force`), `not-releasable` (the newer revision is held or blocked; the installed version is kept), `not-in-catalog`.

`uninstall <id>` removes a Hub-managed skill folder that sits directly in the agent's skills root. It refuses a different agent (`installed_for_agent_<agent>`), the wrong scope (`not_installed_in_scope`), edited files (unless `--force`), and paths through symlinks, and leaves everything else in the folder untouched. Without an ID it runs interactively in a terminal.

## Destinations and state

| Agent | Project | User (`--scope user`) |
| --- | --- | --- |
| Codex, generic Agent Skills | `.agents/skills` | `~/.agents/skills` |
| Cursor | `.agents/skills` | `~/.cursor/skills` |
| Claude Code | `.claude/skills` | `~/.claude/skills` |
| GitHub Copilot | `.github/skills` | `~/.copilot/skills` |
| OpenCode | `.opencode/skills` | `~/.config/opencode/skills` |

State is in `.ai-skills-hub/installed.json` in the project, or in `~/.ai-skills-hub/` for user scope, written through a temporary file and rename. `installed` is shown only after the recorded hashes are verified; missing or changed files show `unverified`.

## Exit codes and JSON

`0` success, `1` the operation did not complete (any item not installed, an uninstall refused, an update blocked), `2` invalid usage (unknown command or option, invalid `--agent`/`--scope`/`--limit`, missing argument). With `--json`, output is a single JSON document on stdout, including usage errors (`usage_error: true`).
