<div align="center">
  <img src="docs/images/logo.jpg" alt="AI Skills Hub Logo" width="300" />
  <h1>AI Skills Hub</h1>
  <p><strong>A license-aware package manager for reviewed Agent Skills across Claude Code, Codex, Cursor, GitHub Copilot and OpenCode.</strong></p>

  <p>
    <a href="https://github.com/AxiomNode-lab/AI-Skills-Hub/actions"><img src="https://img.shields.io/github/actions/workflow/status/AxiomNode-lab/AI-Skills-Hub/ci.yml?branch=main&label=Build&style=flat-square" alt="Build Status"></a>
    <a href="https://github.com/AxiomNode-lab/AI-Skills-Hub/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="License: MIT"></a>
  </p>
</div>

```bash
git clone https://github.com/AxiomNode-lab/AI-Skills-Hub.git
cd AI-Skills-Hub
corepack enable
pnpm install --frozen-lockfile
pnpm cli --help
pnpm cli available --agent codex
```

> **First-run note (checked 2026-10-14):** the repository's [release status](docs/STATUS.md#distribution) says the npm package has not yet been published. The `npx @axiomnode-lab/skills-hub` and global `npm install` commands below are for after the first npm release. Until then, run from this checkout with `pnpm cli <command>` as shown above.

AI Skills Hub is a package manager for [Agent Skills](https://agentskills.io) (`SKILL.md` folders) used by Claude Code, Codex, Cursor, GitHub Copilot and OpenCode. Each installable skill has been read in full, has a recorded license basis, is pinned to an exact upstream commit, and ships with SHA-256 hashes that are checked before anything is written to your project.

> **Release status:** `0.3.0-beta.1` is the source/workspace version, not proof of an npm publication. The current distribution status and release checklist are maintained in [docs/STATUS.md](docs/STATUS.md) and [docs/RELEASING.md](docs/RELEASING.md).

## What it is, and what it is not

- **A curated catalog.** 1083 skills are indexed from the upstream repositories listed in `catalog/sources.json`; **414 are released** for installation. The rest stay listed as `review-required`, `source-direct` or `blocked`, with the reason.
- **Provenance and licensing.** Every released skill records its source repository, commit, path, license evidence and per-file hashes ([evidence](docs/VERIFIED-LOCAL-SKILLS.md), [policy](docs/LICENSE-POLICY.md)). A public GitHub repository is not treated as permission to redistribute.
- **Not a security certification.** Reviews are AI-assisted and recorded with their reasoning; they are not legal advice or a guarantee. Skills are instructions your agent follows, so read what you install.
- **Not task-performance tested.** Released means reviewed, licensed and integrity-checked, not benchmarked.

## Install from npm (after the first release)

Once the package is published, use it without cloning the repository:

```bash
npx @axiomnode-lab/skills-hub --help
npx @axiomnode-lab/skills-hub available --agent codex
```

Or install globally:

```bash
npm install -g @axiomnode-lab/skills-hub
skills-hub --help
```

Requires Node.js 22 or later. The published package is designed to include the catalog and released skill artifacts, so installation and local skill installation can work offline; external discovery and optional installers need network access. Until the first npm release is live, follow the source-checkout quick start at the top of this README.

## Find skills

```bash
pnpm cli available --agent codex            # what you can install now
pnpm cli available security --agent codex   # filtered by keyword
pnpm cli search "frontend design" --agent codex
pnpm cli info anthropics/frontend-design --agent codex
```

`search` is keyword search over IDs, names, publishers, descriptions, categories and tags; a query must match the text before compatibility or release state affect the ranking. It is not semantic or vector search. `--installable` limits `search` to released skills; `--json` gives machine-readable output.

Each result shows its availability:

| Availability | Meaning |
| --- | --- |
| `eligible` | Released: reviewed, licensed, materialized and integrity-checked. `install` accepts it. |
| `review-required` | Indexed but not released. `--yes` does not bypass this. |
| `source-direct` | Only an external installer is available; it runs only after you confirm with `--yes`. |
| `blocked` | Registry policy blocks installation. |
| `catalog-only` | Indexed without a released artifact. |

## Install, update and remove skills

```bash
pnpm cli install anthropics/frontend-design --agent codex
pnpm cli list --agent codex
pnpm cli update --dry-run
pnpm cli update
pnpm cli uninstall anthropics/frontend-design --agent codex
```

- `install` takes one or more IDs (`id1,id2`), installs dependencies first, and writes files into the agent's skills folder in the current project (`--scope user` for your home directory). Before copying, the released files are checked against their manifest hashes. A record with per-file hashes is written to `.ai-skills-hub/installed.json`.
- Reinstalling the same revision does nothing. An existing folder the Hub did not create, or a Hub installation you edited, is not overwritten unless you pass `--force`.
- `list` shows installations as `installed` only when the files still match their recorded hashes; otherwise `unverified`.
- `update` moves installed skills to the revision the catalog now releases. It refuses held or blocked releases and keeps locally edited files unless you pass `--force`.
- `uninstall` removes only a Hub-managed folder in the agent's skills directory, never through a symlink, and refuses edited files without `--force`.
- Several installs in one command are not atomic: successes are kept and each failure is reported.
- Exit codes: `0` success, `1` the operation did not complete, `2` invalid usage.

Some skills carry a notice (for example a dated service retirement); `info` and `install` print it.

## Supported agents

| Agent | `--agent` | Project folder | User folder (`--scope user`) |
| --- | --- | --- | --- |
| Claude Code | `claude-code` | `.claude/skills` | `~/.claude/skills` |
| Codex | `codex` | `.agents/skills` | `~/.agents/skills` |
| Cursor | `cursor` | `.agents/skills` | `~/.cursor/skills` |
| GitHub Copilot | `github-copilot` | `.github/skills` | `~/.copilot/skills` |
| OpenCode | `opencode` | `.opencode/skills` | `~/.config/opencode/skills` |
| Any Agent Skills client | `agent-skills` | `.agents/skills` | `~/.agents/skills` |

These folders follow each agent's current documentation. A skill is offered for an agent when the catalog lists that agent explicitly, or when it is a standard Agent Skills folder and the agent loads that format; `available` labels the second case "Agent Skills format". Detection of installed agents (interactive mode) looks for their command on `PATH` or their configuration folder.

## Interactive mode and local review

```bash
pnpm cli          # browse and install (needs a terminal)
pnpm cli add "pdf tools"
pnpm cli add https://github.com/owner/repo.git
```

- `add <phrase>` searches the catalog and public directories (skills.sh, the MCP registry, npm, plugin directories) and lets you pick. Popularity can raise a result in the list; it never makes anything trusted or released. External results need confirmation, and success is reported only when something was actually installed.
- `add <git-url>` clones an `https://` or SSH repository into `./capabilities-library/` for your own review. It installs nothing and releases nothing. `sync` fast-forwards those clones; `create` scaffolds a new capability there.

## Give your agent the catalog (MCP)

`skills-hub mcp` runs a **read-only** MCP server over stdio with `search_skills` and `get_skill` tools, and serves the files of released skills as resources. It installs nothing.

```bash
claude mcp add skills-hub -- npx -y @axiomnode-lab/skills-hub mcp
```

`skills-hub serve` exposes the same catalog over HTTP at `127.0.0.1:8787` (`/api/*` and `POST /mcp`). It is **localhost-only by default, has no authentication, and is read-only**; binding to another address prints a warning. See [MCP](docs/MCP.md) and [API](docs/API.md).

## Security model

- Commands run without a shell, as argument vectors. External installers are allowlisted, validated, previewed and run only with `--yes`.
- Installs verify artifact hashes before writing, never follow symlinks in the install path, and never remove files the Hub did not install.
- The server verifies every file against its release manifest and review on each request, refuses symlinks and paths outside the package, and checks `Host` and `Origin`.
- Frontmatter is parsed as strict YAML; malformed metadata fails closed.

Details: [security model](docs/SECURITY-MODEL.md). Report vulnerabilities as described in [SECURITY.md](SECURITY.md).

## Licensing and provenance

Released skills are redistributed only under the conditions in the [license policy](docs/LICENSE-POLICY.md): a skill-local Apache-2.0 or MIT license, or a repository-root MIT/Apache-2.0 license with no conflicting notice on the path, an exact license text, and the license file shipped with the skill. Upstream licenses and notices stay with each skill. The Hub's own code is MIT ([LICENSE](LICENSE), [NOTICE](NOTICE.md)).

## Contributing

Read [AGENTS.md](AGENTS.md) and [CONTRIBUTING.md](CONTRIBUTING.md). Skill sources are proposed in `catalog/sources.json`; a skill is released only with review evidence, a license basis and verified hashes.

## Development

```bash
git clone https://github.com/AxiomNode-lab/AI-Skills-Hub.git
cd AI-Skills-Hub
pnpm install --frozen-lockfile
pnpm validate-all          # registry, schemas, materialized artifacts, tests
pnpm verify-upstream       # re-download every released file at its pinned commit
pnpm build:package         # build the npm package into dist/npm
pnpm e2e:package           # pack it, install the tarball in a temp dir, run it there
```

Run the CLI from a checkout with `node packages/cli/bin/skills-hub.mjs`. `SKILLS_HUB_HOME` points the CLI at another catalog checkout; `SKILLS_HUB_NO_UPDATE_CHECK=1` disables the npm update notice (also skipped in CI and off a terminal).

The repository is a pnpm workspace of internal packages (`@ai-skills-hub/*`, all private). Users get one package, `@axiomnode-lab/skills-hub`, built by `scripts/build-package.mjs`. Releases are described in [docs/RELEASING.md](docs/RELEASING.md); current numbers are in [docs/STATUS.md](docs/STATUS.md).
