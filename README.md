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

You can search for capabilities using natural language or keywords via the CLI:

```bash
pnpm cli search "pdf tools" --agent codex
```

Local search requires a case-insensitive phrase or keyword match in a capability's ID, name, publisher, description, categories, or tags. Multi-word queries can match individual keywords. `--agent` restricts results to compatible capabilities; compatibility and status scores rank textual matches only. Unmatched or empty queries return no results: a message in normal output, or `[]` with `--json`.

### 4. Install a Capability

Local installation requires a bundled, materialized skill with `release: eligible` and compatibility with the selected agent. For example:

```bash
pnpm cli install <release-eligible-id> --agent codex
```

Capabilities distributed via `source-direct` use an allowlisted external installer plan and require explicit confirmation.

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

Use the `Space` bar to select capabilities and `Enter` to confirm.

---

## Architecture

The AI Skills Hub enforces a strict supply-chain policy:
- **Registry Source of Truth:** The central catalog (`catalog/skills.json` and `catalog/bundles.json`) defines all approved capabilities.
- **Materialization:** Only release-eligible bundled skills are copied directly into an agent workspace.
- **Security Check:** High-risk or unverified skills are held in a `review-required` state and cannot bypass release gates.

## Contributing

We welcome community skills! Please review `AGENTS.md` and `CONTRIBUTING.md` for our inclusion policies before submitting a new capability.


### Full Verification

Before committing or publishing changes, run:

```bash
pnpm validate-all
```

The command validates the registry, workspace, JavaScript syntax, schema references, lockfile, materialized artifacts, duplicate records, and repository tests.
