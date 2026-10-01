# Current Status

Generated from repository state on 2026-10-01.

## Product direction

AI Skills Hub is a unified AI Agent capability hub. A user describes the capability they need; the Hub searches local and remote registries, understands the target agent, resolves the installation adapter, and returns the safest available path.

## Capability types

- Skill
- MCP server
- Agent Plugin
- CLI tool

Agent Plugins v1 standardizes Skills and MCP servers as portable plugin components; client-specific plugin behavior stays in client extensions. citeturn244495search0

## Discovery

- Local registry search with agent-aware ranking.
- Semantic external discovery through skills.sh.
- Official MCP Registry discovery.
- Approved GitHub Skill discovery.
- GitHub Agent Plugin discovery.
- npm AI/CLI package discovery.
- Optional LLM semantic reranking through an OpenAI-compatible endpoint.
- Five-minute local cache for repeated remote lookups.
- Arabic/English technical intent hints for common queries.

The skills.sh API provides semantic multi-word search, stable skill IDs, install URLs, and hashes/files on detail endpoints; its CLI can be invoked with npx. citeturn922916search0turn922916search1

The Official MCP Registry exposes a read-only listing API at registry.modelcontextprotocol.io and supports search plus cursor pagination for aggregators. citeturn506255search0turn506255search3

## Installation

- One-command natural-language add flow.
- Verified local Skill artifacts install from the registry.
- Source-direct Skills use the upstream skills CLI bridge.
- Codex MCP servers can be registered directly from remote URL or package metadata.
- Claude Code MCP servers can be registered directly from remote URL or package metadata.
- Cursor MCP servers are written to mcp.json.
- GitHub Copilot MCP servers can be written to its portable mcp-config.json format.
- Codex Agent Plugin sources can be added as plugin marketplaces.
- npm CLI tools can be added as project dependencies.
- Remote execution requires explicit --remote.
- Batched local installs use bounded parallelism.
- Installation state uses atomic writes and tamper detection.

Current agent-specific MCP configuration paths and commands are based on current vendor documentation for Codex, Claude Code, Cursor, and GitHub Copilot. citeturn719988search3turn416853search0turn719988search7turn719988search9

## Catalog

- 61 normalized Skill records with explicit artifact_type=skill.
- 19 bundled candidates.
- 9 source-direct records.
- 33 review-required records.
- 0 materialized Skills at this point.
- 0 release-eligible Skills at this point.
- 15 tracked sources/providers/standards.

## Trust pipeline

Discovery is not trust.

- Artifact-level license evidence.
- Immutable source revisions where available.
- SHA-256 integrity records for released artifacts.
- Explainable heuristic security findings.
- Release gates shared by registry, materializer, installer, and plugin export.
- Source, agent, schema, workspace, static, and capability validation in CI.

## Current limitation

Remote discovery is intentionally metadata-first. A capability found in an external registry is not silently copied into the repository and is not treated as locally trusted.

Plugin installation remains client-specific outside the portable Agent Plugins v1 contract. The Hub can discover plugin packages and prepare supported marketplace/configuration actions without pretending every client exposes the same installer.

## Next major implementation

- Persist capability records for approved MCP, Plugin, and CLI artifacts in the local catalog.
- Add capability dependency graphs and evaluation signals.
- Add content-addressed snapshot downloads and artifact caching.
- Add update/rollback transactions and signed release attestations.
