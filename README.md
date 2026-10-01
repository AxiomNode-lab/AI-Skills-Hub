<div align="center">
  <img src="docs/images/logo.jpg" alt="AI Skills Hub Logo" width="300" />
  <h1>AI Skills Hub</h1>
  <p><strong>Package Manager for AI Agents</strong></p>
  
  <p>
    <a href="https://github.com/AxiomNode-lab/AI-Skills-Hub/actions"><img src="https://img.shields.io/github/actions/workflow/status/AxiomNode-lab/AI-Skills-Hub/ci.yml?branch=main&label=Build&style=flat-square" alt="Build Status"></a>
    <a href="https://github.com/AxiomNode-lab/AI-Skills-Hub/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="License: MIT"></a>
    <a href="https://github.com/AxiomNode-lab/AI-Skills-Hub/releases"><img src="https://img.shields.io/github/v/release/AxiomNode-lab/AI-Skills-Hub?style=flat-square&color=success" alt="Release"></a>
    <a href="https://github.com/AxiomNode-lab/AI-Skills-Hub/pulls"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" alt="PRs Welcome"></a>
  </p>
</div>

---

A unified discovery, installation, and distribution layer for AI Agent Skills, Tools, Plugins, and MCP Servers.

## Overview

Public GitHub repositories are not automatically safe or redistributable for AI agents. AI Skills Hub solves this by separating discovery from execution. It acts as a local registry that fetches agent instructions and tools from upstream sources, checks them for dependencies and safety, and installs them to your local AI agents (like Claude Desktop or Cursor).

**Key Capabilities:**
- **Dependency Resolution & Auto-Healing:** Automatically resolves capability dependencies and installs missing system binaries (e.g., `uv`, Node.js tools) if required.
- **Git Syncing:** Fetches the latest source from upstream before executing an installation to ensure you always run the latest version.
- **Headless Mode:** A fully scriptable CLI API designed specifically for AI Agents to discover and self-install their own capabilities programmatically.
- **Secure Injection:** Automatically edits Agent configurations (e.g., Claude Desktop `mcp.json`) to safely inject MCP servers and environment variables.

## Architecture

```
User / AI Agent
      ↓
 CLI (Interactive or Headless)
      ↓
 Discovery Engine
      ├── Local Registry
      ├── MCP Registry
      └── Upstream Sources (GitHub)
      ↓
 Resolve Dependencies & Git Sync
      ↓
 Installation & Configuration Update
```

## Usage

### Interactive CLI (For Humans)
Launch the wizard to scan your system for supported AI agents and browse available capabilities:
```bash
node packages/cli/bin/skills-hub.mjs
```

### Headless API (For AI Agents)
Agents can invoke these commands programmatically to manage their own toolkit.

**Search for capabilities:**
```bash
node packages/cli/bin/skills-hub.mjs search "frontend" --json
```

**Get capability details:**
```bash
node packages/cli/bin/skills-hub.mjs info frontend-design-skill --json
```

**Install capability silently:**
```bash
# The --yes flag auto-approves security prompts for high-risk capabilities
node packages/cli/bin/skills-hub.mjs install frontend-design-skill --agent claude-code --yes
```

## Distribution States

To ensure safety, capabilities are tagged with specific distribution states:

| State | Description |
| --- | --- |
| `bundled` | Verified and vendored safely in the registry. |
| `source-direct` | Installation points directly to upstream verified sources. |
| `review-required` | High-risk (CLI tools, MCP servers) requiring explicit human consent before execution. |
| `blocked` | Excluded by local security policy. |

## Contributing
We welcome contributions. The project natively supports the open Agent Skills format and MCP extensions. Please review our `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md` before submitting a Pull Request.
