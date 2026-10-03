<div align="center">
  <img src="docs/images/logo.jpg" alt="AI Skills Hub Logo" width="300" />
  <h1>AI Skills Hub</h1>
  <p><strong>A license-aware registry and distribution layer for AI Agent Skills.</strong></p>
  
  <p>
    <a href="https://github.com/AxiomNode-lab/AI-Skills-Hub/actions"><img src="https://img.shields.io/github/actions/workflow/status/AxiomNode-lab/AI-Skills-Hub/ci.yml?branch=main&label=Build&style=flat-square" alt="Build Status"></a>
    <a href="https://github.com/AxiomNode-lab/AI-Skills-Hub/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="License: MIT"></a>
  </p>
</div>

---

## Overview

AI Skills Hub is a license-aware registry and distribution layer for AI Agent capabilities (Agent Skills, MCP Servers, Agent Plugins, and CLI Tools). It provides a unified CLI for discovery, inspection, policy-aware installation, and agent integration.

## Prerequisites

- **Node.js** >= 22
- **pnpm** >= 10.4.1
- **Git**

The repository pins pnpm 10.4.1. In Windows PowerShell, use `pnpm.cmd` if execution policy blocks `pnpm.ps1`; no execution-policy change is needed.

## Quick Start

### 1. Download and Install

Clone the repository and install dependencies:

```bash
git clone https://github.com/AxiomNode-lab/AI-Skills-Hub.git
cd AI-Skills-Hub
pnpm install --frozen-lockfile
```

### 2. Validate the Installation

Ensure the registry schema is valid and your environment is correctly set up:

```bash
pnpm validate
pnpm test
```

### 3. Discover Capabilities

List what you can install right now, optionally for one agent and with a keyword:

```bash
pnpm cli available --agent claude-code
pnpm cli available design --agent codex
```

`available` shows only released skills that `install` accepts, grouped by publisher with their reviewed risk. To search the whole catalog, including skills that are still under review or blocked, use `search`:

```bash
pnpm cli search "pdf tools" --agent codex
pnpm cli search "pdf tools" --installable
```

Local search requires a case-insensitive phrase or keyword match in a capability's ID, name, publisher, description, categories, or tags. Multi-word queries can match individual keywords. `--agent` restricts results to compatible capabilities; compatibility and status scores rank textual matches only. Unmatched or empty queries return no results: a message in normal output, or `[]` with `--json`.

### 4. Install a Capability

Local installation requires a bundled, materialized skill with `release: eligible` and compatibility with the selected agent. The current catalog has **534 skills: 337 review-required, 12 source-direct, 20 blocked, and 165 bundled**. The 165 bundled skills are materialized and release-eligible (snapshot: 2026-10-03; see [current status](docs/STATUS.md)).

They are five Anthropic skills under skill-local Apache-2.0 licenses and 160 skills from microsoft/skills, obra/superpowers, and K-Dense under a repository-root MIT license that ships with each skill. See [release evidence and SHA-256 manifests](docs/VERIFIED-LOCAL-SKILLS.md). Find them with `search --json` (`hub_status.availability.status` is `eligible`). From the repository root, install three of them into the project with:

~~~bash
node packages/cli/bin/skills-hub.mjs install anthropics/frontend-design,anthropics/brand-guidelines,anthropics/internal-comms --agent codex --scope project --json
~~~

Expected: `success: true`, three successful items, files under `.agents/skills/`, and a project installation record. Installation and file integrity were tested; task performance was not.

Inspect a real catalog entry and your project's installation records:

```bash
node packages/cli/bin/skills-hub.mjs info obra/superpowers/brainstorming --agent codex --json
node packages/cli/bin/skills-hub.mjs list --agent codex --scope project --json
```

Capabilities distributed via `source-direct` use an allowlisted external installer plan and require explicit confirmation.

See [installation commands and expected outcomes](docs/INSTALLATION.md). The CLI installs explicit IDs (comma-separated for multiple IDs); it does not expand bundle aliases such as `@core` and has no `plan` command or `--remote` option.

`search` and `info` show catalog availability separately from installation. Their JSON output adds `hub_status` while preserving the original distribution, release, and security metadata:

| Availability | Meaning |
| --- | --- |
| `catalog-only` | Indexed, but no released local artifact is ready to install. |
| `review-required` | Manual review is required; `--yes` does not bypass it. |
| `eligible` | A bundled, materialized skill has passed the catalog release gate; this does not mean it is installed or compatible with every agent. |
| `source-direct` | An external installation route requires explicit consent with `--yes`. |
| `blocked` | Registry policy blocks installation. |

Installation status is based on `.ai-skills-hub/installed.json` in the selected scope, filtered by `--agent` when supplied. `installed` means the recorded skill files were verified against their hashes. `unverified` means a record exists but the files have changed, are missing, or cannot be verified. `not-recorded` means no matching Hub record exists; externally managed installations may still exist. `list` reads these records, not the catalog, and displays their verification status. The default scope is `project`; `--scope user` selects the user's Hub state. These read-only checks never promote a skill's approval or release state.

`install --json` returns `success: true` only if every requested capability and resolved dependency was installed. Skips, review/release holds, missing IDs, confirmation requests, and execution errors return `success: false` with per-item `status`, `installed`, and `reason`, and exit code 1. Mixed outcomes remain visible; successful installations are not rolled back. Adding a plugin marketplace alone is not a completed plugin installation. External installer success reports execution of its installation command; it does not create verified local skill records.

For example, an unreleased bundled skill returns:

```json
{
  "success": false,
  "results": [{
    "id": "example/unreleased-skill",
    "status": "hold",
    "installed": false,
    "requires_confirmation": false,
    "reason": "bundle_not_released",
    "destination": null
  }]
}
```

### 5. Interactive Mode

Alternatively, you can browse and install capabilities using the interactive UI:

```bash
pnpm cli
```

It lists the supported agents and marks the ones found on this machine (Claude Code, Codex, Cursor, GitHub Copilot, OpenCode, detected by their command on `PATH` or their configuration folder, on Linux, macOS, and Windows). Browsing shows installable skills by default; the whole catalog is a separate option. Use the arrow keys, `Space` to select, and `Enter` to confirm.

### Supported agents

| Agent | `--agent` | Project skills folder | User skills folder (`--scope user`) |
| --- | --- | --- | --- |
| Claude Code | `claude-code` | `.claude/skills` | `~/.claude/skills` |
| Codex | `codex` | `.agents/skills` | `~/.agents/skills` |
| Cursor | `cursor` | `.agents/skills` | `~/.cursor/skills` |
| GitHub Copilot | `github-copilot` | `.github/skills` | `~/.copilot/skills` |
| OpenCode | `opencode` | `.opencode/skills` | `~/.config/opencode/skills` |
| Any Agent Skills client | `agent-skills` | `.agents/skills` | `~/.agents/skills` |

A skill can be installed for an agent when the catalog lists that agent, or when it is an Agent Skills format skill (`SKILL.md` with name and description) and the agent loads that format; `available --agent` labels the second case "Agent Skills format". MCP servers, plugins, and other artifacts need an explicit listing.

Output uses color in a terminal; set `NO_COLOR=1` to turn it off or `FORCE_COLOR=1` to force it. JSON output never contains color codes.

### 6. Use It From Your Own Project

The CLI reads the catalog from the Hub checkout, wherever it is run, and installs into the current directory. Point it at your clone once:

```bash
alias skills-hub="node /path/to/AI-Skills-Hub/packages/cli/bin/skills-hub.mjs"
cd ~/my-project
skills-hub search "frontend design" --agent claude-code
skills-hub install anthropics/frontend-design --agent claude-code
```

`SKILLS_HUB_HOME` selects a different Hub checkout. `SKILLS_HUB_NO_UPDATE_CHECK=1` disables the version check, which is also skipped in CI and when output is not a terminal.

### 7. Give Your Agent the Catalog (MCP)

`skills-hub mcp` runs a read-only MCP server over stdio. Agents get `search_skills` and `get_skill` tools, and can read the files of released skills as resources. Nothing is installed through MCP.

```bash
claude mcp add skills-hub -- node /path/to/AI-Skills-Hub/packages/cli/bin/skills-hub.mjs mcp
```

`skills-hub serve` exposes the same catalog as a read-only HTTP API on `127.0.0.1:8787`, with an MCP endpoint at `POST /mcp`. See [MCP](docs/MCP.md) for Codex and other clients, and [API](docs/API.md) for routes.

---

## Architecture

The AI Skills Hub enforces a strict supply-chain policy:
- **Registry Source of Truth:** The central catalog (`catalog/skills.json` and `catalog/bundles.json`) records indexed capabilities and their policy states; inclusion is not approval.
- **Materialization:** Only release-eligible bundled skills are copied directly into an agent workspace.
- **Security Check:** Distribution and release gates prevent blocked, review-required, and unreleased bundled skills from being installed.

## Contributing

We welcome community skills! Please review `AGENTS.md` and `CONTRIBUTING.md` for our inclusion policies before submitting a new capability.


### Full Verification

Before committing or publishing changes, run:

```bash
pnpm validate-all
```

The command validates the registry, workspace, JavaScript syntax, schema references, lockfile, materialized artifacts, duplicate records, and repository tests. It runs the project duplicate-report script with `pnpm run dedupe` (plain `pnpm dedupe` is a package-manager command).

`pnpm test` uses a Node-based runner that discovers `.test.mjs` files under `tests/` and `packages/` without shell glob expansion, prints TAP totals, and fails if no test files or no passing tests execute. CI runs `pnpm validate-all` on Windows and Linux with Node 22. On Windows, only the symbolic-link protection test may skip when the OS denies creation of its test link; its skip message explains the permission requirement. Application failures are not converted into skips.
