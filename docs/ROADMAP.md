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
- [ ] SPDX parser with exception handling
- [ ] deeper script/reference/assets static analysis
- [ ] dependency and package manifest inspection
- [ ] signature/attestation verification
- [ ] authenticated GitHub ingestion and rate-limit backoff
- [ ] deduplication and fork lineage

## 0.3 Distribution
- [x] lockfile
- [x] dry-run install plans
- [x] multi-agent compatibility filter
- [x] source-direct bridge
- [ ] native content-addressed installer
- [ ] update/rollback
- [ ] isolated extraction sandbox
- [ ] plugin.json package generation

## 0.4 Discovery
- [x] registry API
- [x] search/filter foundation
- [x] web catalog foundation
- [ ] ranking based on adoption + maintenance + security + evals
- [ ] publisher/source pages
- [ ] changelog and release history
- [ ] dependency graph

## 0.5 Interoperability
- [x] MCP Skills list/get/read foundation
- [ ] MCP pagination and caching conformance
- [ ] Agent Plugins 1.0 package export
- [ ] agent-specific adapters
- [ ] client support matrix generated from tested integrations

## Quality target

No Skill becomes publicly bundled solely because it is popular. Release eligibility requires reproducible provenance, artifact-level licensing, security review, and validation.
