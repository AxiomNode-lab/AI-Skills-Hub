# Changelog

All notable changes to AI Skills Hub are documented here.

## Unreleased

### Added
- `skills-hub mcp` (stdio) and `skills-hub serve` (HTTP) run a read-only catalog server with `search_skills` and `get_skill` MCP tools, released-skill file resources, and the `/api` routes in docs/API.md.
- `parseFrontmatter` in `@ai-skills-hub/core` reads folded and literal YAML block scalars.
- `scripts/repair-descriptions.mjs` re-reads broken descriptions from pinned, hash-verified upstream files.
- `scripts/draft-review.mjs` drafts a release review from a pinned Git tree; drafts cannot pass the release gate until a reviewer approves every finding.
- Repository-root MIT licenses can cover a skill under the conditions in docs/LICENSE-POLICY.md; the root license ships with the skill as an attached `LICENSE.txt`.
- 163 more reviewed skills are released: `anthropics/academy-guide`, `anthropics/discernment-nudge`, and 161 MIT skills from microsoft/skills, obra/superpowers, and K-Dense (166 installable in total). Eight reviewed candidates were not released; reasons are in docs/VERIFIED-LOCAL-SKILLS.md.

### Fixed
- The CLI resolves the catalog and materialized skills from the Hub root (or `SKILLS_HUB_HOME`), so it works inside any project instead of only the Hub checkout.
- 107 catalog descriptions stored as bare `>`/`|` indicators were repaired from their pinned upstream SKILL.md files.
- The update check reads the Hub's own version, and is skipped in CI, non-TTY output, and with `SKILLS_HUB_NO_UPDATE_CHECK`.
- `info` exits 1 for a missing or unknown ID.

### Corrected
- The 0.2.0 notes below listed a registry API, MCP server, and browser catalog that were not present in the repository. The API and MCP server now exist; the browser catalog does not.

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
