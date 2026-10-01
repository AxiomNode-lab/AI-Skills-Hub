# Roadmap

## 0.1 Foundation
- [x] registry model
- [x] normalized catalog
- [x] bundles
- [x] license states
- [x] security capability metadata
- [x] CLI foundation
- [x] GitHub metadata ingestion
- [x] CI validation
- [x] source manifests
- [x] provenance pinning
- [x] API
- [x] discovery web UI
- [x] safe install planning
- [x] materialization workflow
- [x] MCP Skills server foundation

## 0.2 Trust pipeline
- [x] effective-license evidence extraction in ingestion
- [x] heuristic security scanning
- [x] immutable source revisions
- [x] source SKILL.md hashing
- [x] per-file content digests in materialization manifests
- [x] explicit source ingestion allowlist
- [x] scheduled registry sync workflow
- [x] release gate for security-verified materialized Skills
- [ ] SPDX parser with exception handling
- [ ] deeper script/reference/assets static analysis
- [ ] dependency and package manifest inspection
- [ ] signature/attestation verification
- [ ] authenticated GitHub ingestion with rate-limit backoff
- [ ] deduplication and fork lineage

## 0.3 Distribution
- [x] lockfile
- [x] dry-run install plans
- [x] multi-agent compatibility filter
- [x] source-direct bridge
- [x] native materialized installer
- [x] plugin.json package generation
- [ ] update/rollback transactions
- [ ] isolated extraction sandbox
- [ ] signed release artifacts

## 0.4 Discovery
- [x] registry API
- [x] search/filter foundation
- [x] web catalog foundation
- [x] skill detail view
- [ ] ranking based on adoption + maintenance + security + evals
- [ ] publisher/source pages
- [ ] changelog and release history
- [ ] dependency graph
- [ ] semantic/vector search

## 0.5 Interoperability
- [x] MCP Skills list/get/read implementation
- [x] MCP pagination and caching metadata
- [x] Agent Plugins package export
- [x] agent-specific install targets
- [ ] client support matrix generated from tested integrations
- [ ] hosted registry endpoint
- [ ] registry federation

## Quality target

No Skill becomes publicly bundled solely because it is popular. Release eligibility requires reproducible provenance, artifact-level licensing, security verification, materialization integrity, and validation.
