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

### 4. Install a Capability

Install a capability only when its registry record is marked `release: eligible`. For example:

```bash
pnpm cli install <release-eligible-id> --agent codex
```

Capabilities distributed via `source-direct` use an allowlisted external installer plan and require explicit confirmation.

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
