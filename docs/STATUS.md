# Current Status

Generated from repository state on 2026-10-01.

## Catalog

- 54 normalized Skill records
- 21 distribution-bundled candidates
- 4 source-direct proprietary Anthropic document Skills
- 29 review-required records
- 0 materialized Skills at this point
- 7 source repositories / standards tracked

## Implemented

- Agent Skills registry schema
- Bundle resolution
- License-state model
- Security capability scanner
- GitHub immutable-revision ingestion
- Deterministic lockfile
- Native installer core
- Agent target adapters
- Static discovery Web UI
- Registry API with filtering/pagination
- Agent Plugins export
- MCP Skills server foundation
- CI validation and source-sync workflows

## Current limitation

Bundle eligibility is separate from materialization and release eligibility. The bundled candidate set is not yet copied into the repository, so native registry installation is intentionally blocked until the materialization workflow completes.

## Next release blockers

- Complete artifact-level license review for review-required sources.
- Materialize and integrity-verify approved bundled artifacts.
- Add deduplication/fork lineage.
- Add evaluation harnesses and quality signals.
- Add native updater/rollback and content-addressed cache.
