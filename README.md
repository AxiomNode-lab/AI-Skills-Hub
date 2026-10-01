<div align="center">
  <img src="docs/images/logo.jpg" alt="AI Skills Hub Logo" width="300" />


**A registry and installation layer for AI agent capabilities.**

AI Skills Hub provides a common workflow for discovering, evaluating, and installing capabilities used by AI coding agents.

The project currently focuses on Agent Skills and is designed to extend the same workflow to MCP servers, Agent Plugins, and CLI tools.

[![CI](https://img.shields.io/github/actions/workflow/status/AxiomNode-lab/AI-Skills-Hub/ci.yml?branch=main\&style=flat-square\&label=CI)](https://github.com/AxiomNode-lab/AI-Skills-Hub/actions/workflows/ci.yml)
[![Security](https://img.shields.io/github/actions/workflow/status/AxiomNode-lab/AI-Skills-Hub/security.yml?branch=main\&style=flat-square\&label=Security)](https://github.com/AxiomNode-lab/AI-Skills-Hub/actions/workflows/security.yml)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-339933?style=flat-square\&logo=node.js)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10.4.1-F69220?style=flat-square\&logo=pnpm)](https://pnpm.io/)

---

## Overview

AI agent capabilities are distributed across repositories, registries, package managers, and agent-specific configuration formats.

AI Skills Hub provides a single layer between those sources and the agent that will use the capability.

```text
User / Agent
     |
     v
    CLI
     |
     v
Discovery
     |
     +-------------------+
     |        |          |
     v        v          v
 Local     GitHub     External
 Registry  Sources     Registries
                       |
                       +-- skills.sh
                       +-- MCP Registry
                       +-- npm
     |
     v
Compatibility
     |
     v
Security / License / Provenance
     |
     v
Installation Adapter
     |
     v
Target Agent
```

The important distinction is that **discovery does not imply trust or redistribution**.

A capability can be discovered from an external source without being copied into the local registry or treated as a released artifact.

---

## Current Scope

The current repository is centered around Agent Skills.

The codebase also contains discovery and installation support for additional capability types:

| Capability   | Current role                                              |
| ------------ | --------------------------------------------------------- |
| Agent Skill  | Primary catalog and distribution model                    |
| MCP Server   | Remote discovery and agent-specific installation adapters |
| Agent Plugin | Discovery and portable plugin export support              |
| CLI Tool     | npm discovery and installation adapter support            |

The local catalog currently contains Skills; the other capability types are handled primarily through the discovery and adapter layers.

---

## Registry

The current catalog contains **61 normalized Skill records**.

| Distribution state | Records |
| ------------------ | ------: |
| `bundled`          |      19 |
| `source-direct`    |       9 |
| `review-required`  |      33 |

At the current `0.2.0` stage, bundled records are tracked in the registry but are not yet materialized as release-eligible artifacts.

Registry metadata includes:

* Source repository and path
* Immutable upstream revision where available
* Publisher
* Category and tags
* License state and evidence
* Agent compatibility
* Security findings
* Distribution state
* Release state
* Integrity metadata

Registry files live under [`catalog/`](catalog/).

---

## Discovery Sources

AI Skills Hub is not tied to a single repository.

Current discovery integrations include:

| Source         | Use                                                       |
| -------------- | --------------------------------------------------------- |
| Local registry | Search normalized local metadata                          |
| GitHub         | Discover approved Skill sources and Agent Plugin metadata |
| skills.sh      | Semantic Skill discovery                                  |
| MCP Registry   | MCP server discovery                                      |
| npm            | AI, agent, and CLI package discovery                      |

External discovery results remain remote until they pass the relevant local policy and installation path.

---

## Supported Agents

The project currently defines installation targets for:

* Claude Code
* Codex
* Cursor
* OpenCode
* GitHub Copilot
* Generic Agent Skills

Compatibility is represented explicitly in the catalog rather than assuming that every capability works with every agent.

---

## Installation

Installation is handled through capability-specific adapters.

For example, the project contains adapters for:

* Native Agent Skills
* MCP server configuration
* CLI tools
* Agent Plugins

The adapter layer keeps agent-specific configuration out of the discovery model.

The CLI entry point is:

```text
packages/cli/bin/skills-hub.mjs
```

The current command surface includes:

```text
skills-hub
skills-hub create
skills-hub add <git-url>
skills-hub sync
skills-hub uninstall
skills-hub search <query>
skills-hub info <id>
skills-hub list
skills-hub install <id>
```

Some command paths are still under active development as the CLI and registry layers converge.

---

## Security

Security is part of the registry and distribution pipeline.

The repository currently tracks:

* Artifact-level license information
* Source provenance
* Immutable source revisions
* SHA-256 integrity metadata
* Heuristic security findings
* Materialization checks
* Release gates
* Dependency review
* CodeQL analysis
* Secret scanning

The security scanner currently looks for indicators such as:

```text
shell execution
network access
credential access
dynamic execution
package installation
filesystem writes
encoded content
destructive operations
```

The scanner is intentionally described as **heuristic**. It is a screening layer, not a guarantee that an artifact is safe.

See [`SECURITY.md`](SECURITY.md) and [`docs/SECURITY-MODEL.md`](docs/SECURITY-MODEL.md).

---

## Distribution States

The registry separates discovery from distribution.

| State             | Meaning                                                              |
| ----------------- | -------------------------------------------------------------------- |
| `bundled`         | Eligible for local registry distribution after required checks       |
| `source-direct`   | Installed from the upstream source rather than redistributed locally |
| `review-required` | Requires additional review before distribution or execution          |
| `blocked`         | Rejected by project policy                                           |

Release eligibility is evaluated separately from the distribution label.

A bundled record is not automatically a release artifact.

---

## Development

Requirements:

* Node.js `>= 22`
* pnpm `10.4.1`

Install dependencies:

```bash
pnpm install
```

Run registry validation:

```bash
pnpm validate
```

Run tests:

```bash
pnpm test
```

Run the registry audit:

```bash
pnpm audit
```

Run the complete local verification:

```bash
pnpm verify
```

Additional validation and registry workflows are available through the repository scripts and GitHub Actions.

---

## Project Structure

```text
AI-Skills-Hub/
├── catalog/
│   ├── agents.json
│   ├── bundles.json
│   ├── registry.json
│   ├── skills.json
│   ├── skills.lock.json
│   └── sources.json
│
├── packages/
│   ├── cli/
│   ├── core/
│   ├── discovery/
│   ├── installer/
│   ├── licenses/
│   ├── materializer/
│   ├── plugin-export/
│   └── security/
│
├── scripts/
├── tests/
├── docs/
│
├── CONTRIBUTING.md
├── SECURITY.md
├── CHANGELOG.md
└── LICENSE
```

---

## Architecture

The main components are separated by responsibility:

| Package         | Responsibility                        |
| --------------- | ------------------------------------- |
| `core`          | Registry model and shared operations  |
| `discovery`     | Local and remote capability discovery |
| `installer`     | Agent-specific installation adapters  |
| `security`      | Heuristic capability scanning         |
| `materializer`  | Controlled artifact materialization   |
| `licenses`      | License normalization and policy data |
| `plugin-export` | Portable Agent Plugin packaging       |
| `cli`           | User-facing command-line interface    |

This separation allows discovery providers and installation targets to evolve independently.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the detailed design.

---

## Automation

The repository includes automated workflows for registry maintenance and verification.

Current workflows include:

* CI validation and tests
* Security checks
* Scheduled registry synchronization
* Source synchronization
* Approved artifact materialization
* Automated discovery-related jobs

Registry synchronization is designed to update metadata while preserving provenance and repository policy.

---

## Documentation

Project documentation is organized under [`docs/`](docs/).

Key documents:

* [`Architecture`](docs/ARCHITECTURE.md)
* [`Installation`](docs/INSTALL.md)
* [`Registry Format`](docs/REGISTRY-FORMAT.md)
* [`Registry Schema`](docs/REGISTRY-SCHEMA.md)
* [`Security Model`](docs/SECURITY-MODEL.md)
* [`License Policy`](docs/LICENSE-POLICY.md)
* [`Quality Gates`](docs/QUALITY-GATES.md)
* [`API`](docs/API.md)
* [`MCP`](docs/MCP.md)
* [`Roadmap`](docs/ROADMAP.md)
* [`Current Status`](docs/STATUS.md)

---

## Contributing

Contributions are welcome.

Before opening a pull request, please read:

* [`CONTRIBUTING.md`](CONTRIBUTING.md)
* [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)

When adding a capability source, preserve its upstream attribution and record the source, revision, licensing information, compatibility metadata, and provenance required by the registry.

Do not vendor third-party content when redistribution rights are unclear.

---

## License

AI Skills Hub is released under the MIT License.

Third-party capabilities referenced or distributed by the registry remain subject to their respective licenses.

See [`LICENSE`](LICENSE) and [`docs/LICENSE-POLICY.md`](docs/LICENSE-POLICY.md).

---

## Project Status

AI Skills Hub is currently under active development.

Version `0.2.0` focuses on the registry, discovery, provenance, licensing, security checks, installation adapters, and validation pipeline.

The next stages are focused on improving artifact materialization and release handling, capability dependency management, update and rollback workflows, stronger security and license analysis, and broader interoperability across agent ecosystems.

See [`CHANGELOG.md`](CHANGELOG.md) and [`docs/ROADMAP.md`](docs/ROADMAP.md) for the current implementation history and planned work.
