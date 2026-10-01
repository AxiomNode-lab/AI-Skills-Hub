# Architecture

## Product model

AI Skills Hub is a unified discovery and installation layer for AI-agent capabilities.

The user should not need to know:
- which repository contains a Skill,
- whether a capability is already installed,
- which agent-specific directory it belongs to,
- which upstream installer or configuration format it needs.

The user describes the desired capability. The Hub resolves the rest.

## Capability types

1. Agent Skill — procedural instructions/resources.
2. MCP Server — protocol-connected tools/data.
3. Agent Plugin — portable package; Agent Plugins v1 defines Skills and MCP servers inside the package.
4. CLI Tool — executable/package-based developer capability.

Agent Plugins v1 requires root plugin.json and discovers Skills from skills/ and MCP servers from mcp.json. Client-specific behavior is namespaced under extensions. citeturn244495search0

## Data flow

User intent
  -> Discovery Broker
  -> Local Registry
  -> Semantic External Index
  -> Official MCP Registry
  -> Approved GitHub Sources
  -> npm Registry
  -> Ranked Candidates
  -> Agent Compatibility
  -> Installation Adapter
  -> Local install or explicit upstream bridge

## Discovery layers

### Local Registry

Normalized metadata, compatibility, trust state, provenance, install state, and quality signals.

### Semantic External Discovery

skills.sh provides semantic search for multi-word queries and stable IDs/install URLs. The Hub uses it as a discovery index; discovered content stays remote until trust gates pass. citeturn922916search0

### MCP Registry

The official MCP Registry exposes GET /v0.1/servers with search and cursor pagination. Aggregators are expected to persist a downstream copy rather than depend on the registry as durable storage. citeturn506255search0turn506255search3

### GitHub

Approved Skill sources are queried for SKILL.md. A separate plugin query discovers portable Agent Plugin manifests. Remote results are never considered trusted automatically.

### npm

The npm registry is used as a discovery surface for AI/agent/CLI packages. Package execution/install remains explicit and auditable.

### Optional AI reranking

An OpenAI-compatible endpoint may rerank public candidate metadata. The reranker receives candidate metadata only.

## Installation adapters

### Agent Skills

- Local released artifact: native installer.
- Remote source-direct: npx skills add.

### MCP

- Codex: codex mcp add.
- Claude Code: claude mcp add.
- Cursor: project/user mcp.json.
- GitHub Copilot: portable mcp-config.json.
- Other agents stay adapter-pending until their configuration contract is implemented.

### Agent Plugins

- Codex marketplace source setup is supported.
- Client-specific plugin installation is not generalized beyond that portable source setup.

### CLI Tools

- npm package projects use pnpm add -D with an explicit remote execution gate.

## Trust boundary

Discovery is not trust.

discover
  -> inspect
  -> classify
  -> approve
  -> materialize
  -> verify
  -> install

## Performance model

- Parallel provider queries.
- Bounded concurrency for batch installs.
- Five-minute local discovery cache.
- Future content-addressed artifact cache for released bundles.
