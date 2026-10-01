# Current Status

Generated from repository state on 2026-10-01.

## Product direction

AI Skills Hub is a unified AI Agent capability hub: one project for discovery, compatibility, provenance, security review, and installation instead of asking users to visit separate skill/tool repositories one by one.

## Discovery

- Local registry search with agent-aware ranking.
- Semantic external discovery through skills.sh.
- Approved GitHub source discovery fallback.
- Remote results remain metadata-only until local policy review.
- Optional LLM semantic reranking through an OpenAI-compatible endpoint.
- Five-minute local discovery cache.
- Arabic/English technical intent hints for common queries.

## Installation

- One-command natural-language add flow.
- Verified bundled artifacts install from the local registry.
- Source-direct artifacts use the upstream skills installer as a bridge.
- Remote execution requires explicit --remote opt-in.
- Bundle installation can run concurrently with bounded workers.
- Atomic install state and tamper detection.

## Catalog

- 61 normalized Skill records.
- 19 bundled candidates.
- 9 source-direct records.
- 33 review-required records.
- 0 materialized Skills at this point.
- 0 release-eligible Skills at this point.
- 12 tracked sources/providers/standards.
- 7 bundles.

## Trust pipeline

- Artifact-level license evidence.
- Immutable source revisions.
- SHA-256 integrity records.
- Explainable heuristic security findings.
- Release gates shared by registry, materializer, installer, and plugin export.
- Source, agent, schema, workspace, and static validation in CI.

## Current limitation

The discovery layer can locate remote Skills that are not yet in the local catalog, but their local trust state is intentionally conservative. A remote discovery result is not promoted to bundled content automatically.

Materialization and release eligibility remain separate from catalog discovery.

## Next major implementation

- Expand the unified registry beyond Skills into MCP servers, Agent Plugins, and CLI tools using tested installation adapters.
- Add dependency graphs and eval-based quality signals.
- Add content-addressed snapshot downloads for released first-party bundles.
- Add update/rollback transactions and signed release attestations.
