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
- [x] read-only registry API (`skills-hub serve`)
- [ ] discovery web UI
- [x] safe install planning
- [x] materialization workflow
- [x] MCP server foundation (`skills-hub mcp`)

## 0.2 Trust pipeline
- [x] effective-license evidence extraction in ingestion
- [x] heuristic security scanning
- [x] immutable source revisions
- [x] source SKILL.md hashing
- [x] per-file content digests in materialization manifests
- [x] explicit source ingestion allowlist
- [x] scheduled registry sync workflow
- [x] release gate for security-verified materialized Skills
- [x] strict YAML 1.2 frontmatter parsing (fails closed)
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
- [x] standalone npm package (`@axiomnode-lab/skills-hub`) with tarball E2E
- [x] `update` to the released revision (no rollback transactions)
- [x] non-interactive `uninstall <id>`
- [x] manifest-verified native installs
- [ ] first npm release via trusted publishing
- [ ] update/rollback transactions
- [ ] isolated extraction sandbox
- [ ] signed release artifacts

## 0.4 Discovery
- [x] registry API
- [x] search/filter foundation
- [ ] web catalog foundation
- [x] skill detail API
- [ ] ranking based on adoption + maintenance + security + evals
- [ ] publisher/source pages
- [ ] changelog and release history
- [ ] dependency graph
- [ ] semantic/vector search

## 0.5 Interoperability
- [x] MCP search/get tools and released-skill resources over stdio and HTTP
- [ ] MCP pagination and caching metadata
- [x] Agent Plugins package export
- [x] agent-specific install targets
- [ ] client support matrix generated from tested integrations
- [ ] hosted registry endpoint
- [ ] registry federation

## Quality target

No Skill becomes publicly bundled solely because it is popular. Release eligibility requires reproducible provenance, artifact-level licensing, security verification, materialization integrity, and validation.
