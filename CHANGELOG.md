# Changelog

All notable changes to AI Skills Hub are documented here.

## 0.2.0 — 2026-10-01

### Added
- License-aware Agent Skills registry model.
- Artifact-level distribution states: bundled, source-direct, review-required, blocked.
- Immutable upstream revisions and lockfile.
- GitHub ingestion with retry/backoff and optional token authentication.
- License normalization and evidence capture.
- Explainable heuristic security scanning with line-level findings.
- Safe materialization with size, path traversal, symlink, submodule, and permission guards.
- Tamper-aware native installation state with atomic writes and force-gated overwrite.
- Multi-agent compatibility matrix.
- Portable Agent Plugins export.
- MCP Skills server foundation with list/get/read, pagination, caching metadata, and safe Skill URIs.
- Read-only Registry API.
- Browser catalog with search, filters, provenance, licensing, release, and capability visibility.
- Source and agent manifest validation.
- Workspace and JavaScript static validation.
- Scheduled upstream registry synchronization.
- CodeQL, dependency-review, and secret-scan workflow coverage.

### Catalog
- 61 curated Skill records.
- 19 redistribution-eligible candidates currently classified as bundled.
- 9 source-direct records for non-redistributable content.
- 33 review-required records pending security/materialization or other review.
- No Skill is currently marked release-eligible or materialized.

### Policy
- Public GitHub visibility is never treated as redistribution permission.
- Third-party licenses remain authoritative for third-party artifacts.
- Bundling requires release eligibility, verified licensing, verified security scan, immutable provenance, and materialization integrity.
