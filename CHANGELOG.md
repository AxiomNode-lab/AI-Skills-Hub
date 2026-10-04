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

- `skills-hub available [query] --agent <id>` lists installable skills; `search --installable` filters search results.
- Terminal colors (respecting `NO_COLOR`/`FORCE_COLOR`), a publisher-grouped interactive list that defaults to installable skills, and an OpenCode install target.
- `pnpm verify-upstream` (also in CI) re-downloads every released file from GitHub at its pinned commit and checks SHA-256.

- 50 programming skills released after full review: 2 from supabase/agent-skills, 20 from addyosmani/agent-skills, and 28 from UnitOneAI/SecuritySkills (212 installable in total). 21 were excluded with reasons in docs/VERIFIED-LOCAL-SKILLS.md, including three that cite a look-alike domain for KrebsOnSecurity and one that reproduces Google's CC BY engineering-practices text without attribution.
- 12 Sentry engineering skills (getsentry/skills) and 14 SEO/GEO skills (aaron-he-zhu/aaron-marketing-skills) released under their repository-root Apache-2.0 licenses after full review (238 installable in total); 4 were excluded with reasons in docs/VERIFIED-LOCAL-SKILLS.md.
- 147 backend, DevOps and infrastructure skills released from wshobson/agents and BagelHole/DevOps-Security-Agent-Skills (385 installable in total); 20 were excluded (unpinned remote installers, security controls disabled by default, offensive exploitation content) and 23 approved ones are held by the release gate's high-risk scanner rule. Details in docs/VERIFIED-LOCAL-SKILLS.md.
- `include_paths` on a source limits ingestion to listed subtrees; aaron-he-zhu/aaron-marketing-skills is ingested for `seo-geo/` only. The 20 seo-geo-claude-skills signpost records are blocked with `upstream-moved`.
- Seven programming-focused sources: supabase/agent-skills and getsentry/skills (official), addyosmani/agent-skills, wshobson/agents, UnitOneAI/SecuritySkills, BagelHole/DevOps-Security-Agent-Skills, and aaron-he-zhu/seo-geo-claude-skills (472 records, all review-required until reviewed).
- `scripts/ingest-github.mjs --checkout <clone>` ingests from a pinned local clone when the GitHub API is unavailable; `scripts/sync-registry.mjs --source <repo> --no-fetch` syncs only the named sources from existing ingestion files.
- A repository-root Apache-2.0 license can cover a skill under the same conditions as MIT, with no NOTICE file applying (docs/LICENSE-POLICY.md).

- `release.notices` (kind, text, evidence) are shown by `info`, printed after `install`, and returned in `install --json` and the server's skill summaries. 13 released skills carry one: 11 K-Dense skills that add a citation of K-Dense's paper to deliverables, and the Azure Vision Image Analysis (retires 2028-09-25) and Call Automation (breaking changes after 2028-09-30) skills.
- `sync-registry` writes `catalog/reports/release-drift.json`: released skills whose upstream moved past the reviewed revision, and whether SKILL.md changed.

### Changed
- 7 web-security skills from harperaa/secure-claude-skills released (416 installable): security headers, secure error handling, dependency and supply-chain checks, deployment and testing checklists, auth and threat-modeling prompts. 15 excluded: its rate-limiting skill (keys clients on a spoofable `X-Forwarded-For`), CSRF and payment skills with unsafe defaults, five skills built on starter-project code they do not ship, and seven awareness skills whose text comes from a separately licensed whitepaper.
- 15 skills from j4flmao/agent-skills released (409 installable): API versioning, OpenAPI, gRPC, idempotency, webhooks, resilience, structured logging, background jobs, frontend authentication, zero-trust identity, eBPF threat detection, core algorithms for system design, SOC and red-team methodology and reverse engineering (both with an authorized-use notice). 4 excluded (insecure defaults in auth, authorization and GraphQL samples; an incomplete rate-limiting skill) and 19 held by the release gate (12 non-conforming frontmatter names, 2 invalid frontmatter, 5 high-risk scanner matches).
- New record ids are lowercase slugs; the validator rejects any other id.
- The scanner's dynamic-execution check no longer matches the JavaScript `function (` keyword: `eval(` and `exec(` stay case-insensitive (so `EXEC(@sql)` and `Eval(x)` still count), and the `Function` constructor is matched case-sensitively. Nine reviewed DevOps and frontend skills held only by that match are released (394 installable).
- `microsoft/azure-ai-anomalydetector-java` is held with reason `upstream-service-retired` (Microsoft retired the service on 2026-10-01) and no longer ships; 165 skills are installable. `info` now prints release hold reasons.
- Independent instruction reviews of 40 microsoft/skills skills are recorded in docs/reviews/independent-batch-01 to -04.
- `microsoft/azure-monitor-query-py` is held with reason `upstream-api-removed`: its unpinned package dropped the metrics clients it documents; 162 skills are installable.
- `microsoft/azure-communication-sms-java` and `microsoft/azure-communication-chat-java` are held with reason `upstream-service-retiring` (Azure Communication Services SMS and Chat are closed to new customers and retire on 2028-09-30); 163 skills are installable.
- Agent Skills format skills now install for every agent that loads the format (Claude Code, Codex, Cursor, GitHub Copilot, OpenCode); previously most were limited by a per-source guess, so Claude Code saw 19 of 166 released skills.

### Fixed
- A reviewed release whose upstream path moved stays released and is listed in the drift report with its new path, instead of being blocked as missing; curated `release.notices` survive a recomputed release state.
- Release notices are shown before the user confirms: with the confirmation-required message and in the interactive flow.
- `ingest-github --checkout` accepts a full commit SHA, or any branch, remote branch, or tag of that name that points at HEAD.
- The server re-checks that a listed file is still a regular file before reading it, closes an oversized request after the 413, and reuses its installable list; `draft-review` allows large repository trees.
- `parseFrontmatter` skips leading blank lines and comment lines in plain scalars, and ignores lines after a closed quoted value.
- `sync-registry` no longer rewrites reviewed, released records: they stay pinned to the reviewed revision until a new review. Before this, the nightly Source Sync reset 330 of 385 released skills (directory vs `SKILL.md` path forms) and failed validation.
- `sync-registry`: records outside a source's `include_paths` are left unchanged instead of being blocked as missing; an existing record keeps its id when a new upstream path has the same skill name, regardless of order.
- `ingest-github --checkout` and `draft-review` read `git ls-tree -z`, so paths with non-ASCII or special characters are found; `--checkout` refuses a ref that does not name the checked-out commit.
- `draft-review` refuses a skill-local license when a NOTICE, COPYING, or second license file also applies.
- `parseFrontmatter` reads plain scalars starting on the next line, comments after quoted values, indentation indicators before chomping (`>2-`), and blank lines inside plain scalars.
- HTTP MCP endpoint rejects non-loopback `Origin` headers, returns 413 instead of resetting the connection, and no longer echoes internal error messages; file lists are read once per server.
- `search --installable` filters before ranking, so installable matches below the top results are no longer dropped; `search --limit <n>` works, and unknown or invalid options exit with a usage error instead of becoming search text.
- Agent Skills format compatibility applies only to bundled skills the Hub installs itself; external installers need an explicit agent listing, and `generic-agent` again accepts any artifact listed for `agent-skills`.
- Plugin and CLI tool adapters read materialized files from the Hub root, like skills.
- The update check is cached for a day instead of waiting on GitHub at the start of every interactive command; the server module loads only for `mcp` and `serve`.
- `plugin-export` reads materialized skills from the Hub root.
- The MCP server answers a request that fails during handling with an internal error for that request id instead of a parse error.
- Agent detection works on Windows (no `which`), detects Codex, Cursor, GitHub Copilot, and OpenCode locally, and no longer offers Docker container IDs that had no install target.
- The interactive installer computed its plan differently from the installer and warned about external installers for local installs.
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
