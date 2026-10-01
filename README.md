<div align="center">
  <img src="docs/images/logo.jpg" alt="AI Skills Hub Logo" width="300" />
  <h1>AI Skills Hub</h1>
  <p><strong>Enterprise-Grade AI Capability & Package Manager</strong></p>
  
  <p>
    <a href="https://github.com/AxiomNode-lab/AI-Skills-Hub/actions"><img src="https://img.shields.io/github/actions/workflow/status/AxiomNode-lab/AI-Skills-Hub/ci.yml?branch=main&label=Build&style=flat-square" alt="Build Status"></a>
    <a href="https://github.com/AxiomNode-lab/AI-Skills-Hub/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="License: MIT"></a>
    <a href="https://github.com/AxiomNode-lab/AI-Skills-Hub/releases"><img src="https://img.shields.io/github/v/release/AxiomNode-lab/AI-Skills-Hub?style=flat-square&color=success" alt="Release"></a>
    <a href="https://github.com/AxiomNode-lab/AI-Skills-Hub/pulls"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" alt="PRs Welcome"></a>
  </p>
</div>

---

A unified discovery, installation, and security hub for AI Agent Skills, Tools, Plugins, and MCP (Model Context Protocol) integrations.

## 🚀 Overview

AI Skills Hub is a professional, autonomous, and highly secure platform designed to manage and distribute capabilities for AI agents. Built for modern AI workflows, it separates discovery from redistribution, ensuring that every tool or skill your AI uses is verified, licensed, and safe.

**Key Enterprise Features:**
- **Auto-Healing Dependencies:** Automatically detects and installs missing system prerequisites (like `uv`, Node.js packages, etc.).
- **Auto-Sync Mechanics:** Always fetches the latest upstream version via `git pull` before installing capabilities.
- **Headless AI Mode:** A robust CLI API designed specifically for AI Agents to self-manage, discover, and install their own tools programmatically.
- **Secure MCP Injection:** Safely edits Agent configurations (e.g., Claude Desktop) to inject MCP servers with required environment variables.
- **Strict Release Gates:** Artifact-level licensing, immutable upstream revisions, and rigorous security capability metadata.

## 🏗️ Architecture

```
User / AI Agent
      ↓
 Natural Language Request / Headless CLI
      ↓
 AI Skills Hub Discovery Engine
      ├── Local Registry
      ├── MCP Registry
      └── Upstream GitHub Sources
      ↓
 Rank & Resolve Dependencies
      ↓
 Secure Installation & Execution
```

## 🛠️ Usage

AI Skills Hub provides a powerful CLI for both humans and AI agents.

### For Humans (Interactive Mode)
Launch the interactive wizard to scan your system for AI agents, browse the capability library, and install tools with guided setup:
```bash
node packages/cli/bin/skills-hub.mjs
```

### For AI Agents (Headless Mode)
Agents can use the CLI programmatically to upgrade their own capabilities:

**Search for capabilities:**
```bash
node packages/cli/bin/skills-hub.mjs search "frontend" --json
```

**Get capability details:**
```bash
node packages/cli/bin/skills-hub.mjs info frontend-design-skill --json
```

**Install capability (Auto-approves security prompts):**
```bash
node packages/cli/bin/skills-hub.mjs install frontend-design-skill --agent claude-code --yes
```

## 🔐 Distribution & Security States

| State | Meaning |
| --- | --- |
| `bundled` | Verified and vendored safely in the registry. |
| `source-direct` | Points directly to upstream verified sources. |
| `review-required` | High-risk capabilities (like CLI tools or MCP servers) that require explicit consent. |
| `blocked` | Excluded by security policy. |

## 🤝 Contributing
The project targets the open Agent Skills format and the MCP Skills extension. See `CONTRIBUTING.md` for guidelines on submitting new capabilities.

---
*Built for the future of autonomous systems.*
