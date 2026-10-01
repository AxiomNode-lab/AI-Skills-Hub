# AI Skills Hub

A license-aware, provenance-first registry and distribution layer for AI Agent Skills.

## Why it exists

AI Skills are portable instruction packages, but a public repository is not automatically safe or redistributable. AI Skills Hub separates discovery from redistribution and records what the system knows about each artifact.

Core principles:

- Artifact-level licensing, not repository-level assumptions.
- Immutable upstream revisions and content hashes.
- Explicit distribution states: bundled, source-direct, review-required, blocked.
- Security capability metadata and explainable heuristic findings.
- Agent-aware installation targets.
- MCP Skills interoperability.
- Generated lockfiles for reproducible registry state.

## Current architecture

```
Upstream Sources
      |
      v
  GitHub Ingestion
      |
      +--> License Resolution
      +--> Security Scan
      +--> Provenance / Hash
      +--> Curation Policy
      |
      v
    Registry
      |
  +---+---+----------------+
  |       |                |
  v       v                v
Web      CLI               MCP
 |        |                 |
Browse   Plan/Install     skills/list
API      Audit/Doctor     skills/get
 |        |               resources/read
 +--------+----------------+
```

## Repository layout

- `catalog/` normalized registry data, bundles, locks, source manifests
- `packages/` reusable core, installer, security, license, materializer, CLI, plugin export
- `apps/api/` read-only registry HTTP API
- `apps/web/` browser catalog
- `apps/mcp-server/` MCP Skills server
- `scripts/` ingestion, synchronization, lock generation, validation
- `docs/` architecture, policy, install, API, schema, roadmap

## Local usage

```bash
pnpm install
pnpm validate
pnpm test
pnpm audit
pnpm cli search frontend
pnpm cli plan @core --agent codex
pnpm api
pnpm web
pnpm mcp
```

The default catalog is metadata-first. Third-party content is only materialized when its distribution state, licensing, provenance, integrity, and security release gates permit it.

## Distribution states

| State | Meaning |
| --- | --- |
| `bundled` | Registry may contain a vendored copy after verification and release gates |
| `source-direct` | Install bridge points to upstream; content is not vendored |
| `review-required` | Discoverable, but automated redistribution is held |
| `blocked` | Explicitly excluded by policy |

## Standards

The project targets the open Agent Skills format, Agent Plugins packaging, and the MCP Skills extension.
