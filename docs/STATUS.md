# Current Status

Repository snapshot: 2026-10-04. Counts below come from `catalog/skills.json`, `catalog/bundles.json`, and `catalog/sources.json`, not from installed files or remote search results.

## Catalog

| Distribution | Records |
| --- | ---: |
| bundled | 416 |
| source-direct | 12 |
| review-required | 615 |
| blocked | 40 |
| **Total** | **1083** |

667 records are not release-eligible; 416 are materialized and release-eligible: five Anthropic skills under skill-local Apache-2.0 licenses, 385 under a repository-root MIT license from microsoft/skills, obra/superpowers, K-Dense, and the programming sources supabase/agent-skills, addyosmani/agent-skills, UnitOneAI/SecuritySkills, wshobson/agents, BagelHole/DevOps-Security-Agent-Skills, j4flmao/agent-skills, and harperaa/secure-claude-skills, and 26 under a repository-root Apache-2.0 license from getsentry/skills and the SEO/GEO skills of aaron-he-zhu/aaron-marketing-skills (see the [license policy](LICENSE-POLICY.md)). [Release evidence](VERIFIED-LOCAL-SKILLS.md) records their pinned provenance, file-level license decisions, scans, and hashes. Installation success is not task-performance evaluation. There are 7 bundle definitions and 25 source/provider/standard records. The local contract treats these as Skills: 475 explicitly declare `artifact_type: skill`, and 608 omit it and use the default. The catalog currently contains no explicit MCP server, Agent Plugin, or CLI tool records.

Released skills stay pinned to the commit their review covers. The nightly source sync lists any whose upstream has moved on in `catalog/reports/release-drift.json`; those need a new review before their files change. Thirteen released skills carry a `release.notices` entry that `info` and `install` print: a disclosed self-citation behavior (11 K-Dense skills) or a dated service retirement (two microsoft/skills skills).

Reproduce the distribution counts from the repository root:

```bash
node -e "const c=require('./catalog/skills.json'); console.log('total',c.skills.length); for(const s of ['bundled','source-direct','review-required','blocked']) console.log(s,c.skills.filter(x=>x.distribution===s).length)"
```

`obra/superpowers/brainstorming` and seven other `obra/superpowers/*` records are blocked with release reason `upstream-skill-missing`. Each is a legacy duplicate of an `obra/<name>` record for the same upstream path; the skill files exist at the pinned commit, and the reason was recorded when sync compared directory paths with `SKILL.md` paths. The blocks stay because the `obra/<name>` records are the live entries. Their presence in search results is not permission to install them. The 20 `seo-geo/*` records are blocked with `upstream-moved`: every SKILL.md in aaron-he-zhu/seo-geo-claude-skills only says the skill moved to aaron-he-zhu/aaron-marketing-skills, which is now ingested for its `seo-geo/` subtree only (`include_paths`).

## Implemented CLI behavior

- `search` searches the local catalog. A phrase or keyword must match before agent/status ranking bonuses apply. `--agent` filters compatibility.
- `info` and `search` separate catalog availability from verified Hub installation state. `list` reads installation records for the selected scope and agent, not the catalog.
- `install` accepts explicit IDs, checks skill compatibility and distribution/release gates, and reports every outcome. JSON success requires all requested installations and resolved dependencies to succeed; incomplete requests exit 1.
- Eligible materialized bundles use the native installer. 416 reviewed text-only skills are available in the current catalog. Source-direct skills require explicit external-install consent; review and blocked states are not overridden by `--yes`.
- `add` accepts a Git URL (cloned into `capabilities-library` for review) or starts interactive hybrid discovery. Remote queries do not require a `--remote` flag; the CLI has no such option. Selection and external execution are separate steps.
- The no-command flow browses/searches compatible catalog entries interactively. Installs are sequential, not parallel.
- The CLI resolves the catalog and materialized skills from the Hub root (or `SKILLS_HUB_HOME`) and installs relative to the current directory, so it can be run inside any project.
- `mcp` (stdio) and `serve` (HTTP, `127.0.0.1:8787` by default) run a read-only catalog server: `search_skills` and `get_skill` MCP tools, released-skill file resources, and the routes in [API](API.md). No browser catalog exists yet.
- `available [query] --agent <id>` lists exactly the skills `install` accepts. `search --installable` filters search results the same way.
- Agent detection looks for each agent's command on `PATH` (with `PATHEXT` on Windows) or its configuration folder, and the interactive flow lists every supported agent with detected ones marked. Agent Skills format skills install for every agent that loads the format; see the README's supported-agent table.
- `pnpm verify-upstream` re-downloads every file of every released skill from GitHub at its pinned commit and compares SHA-256; CI runs it on Linux. On 2026-10-04 all 1369 files of the 394 released skills matched. On 2026-10-03 and all 534 catalog records that existed then resolved to an existing SKILL.md at their pinned commits. The 472 records from the seven sources added on 2026-10-03 were ingested from pinned clones.
- `create`, `sync`, and interactive `uninstall` are also available. See `node packages/cli/bin/skills-hub.mjs help` and [installation](INSTALLATION.md).

## Library capabilities and limits

The discovery package includes skills.sh, MCP Registry, GitHub, npm, and plugin providers, a cache, query hints, and optional model reranking. These are implementation capabilities, not a guarantee that every upstream service is reachable. The CLI does not expose every library option; for example, it has no model-reranking flags, and `add` does not supply configured GitHub sources.

Adapter code supports MCP configuration/external commands, npm project dependencies, and adding a Codex plugin marketplace. Adding a marketplace does not install the plugin. These remote artifact types are not currently persisted as approved records in the local catalog.

Installation state is written atomically. Managed skill file hashes support verification; missing or changed files display `unverified`. External installers do not automatically produce verified Hub skill records, so `not-recorded` is not proof that no external installation exists. Existing state stores one record per skill ID within each scope.

## Verification

`pnpm validate-all` checks workspace exports, JavaScript syntax, schema references, the generated lockfile, registry policy, materialized integrity, the project duplicate report, and tests. `pnpm run dedupe` is the project report command; `pnpm dedupe` is the package-manager command.

`pnpm test` discovers test files explicitly and rejects runs with no files or no passing tests. CI runs the same validation on `ubuntu-latest` and `windows-latest` with Node 22. Path assertions use native path construction. The MCP symlink test skips only if Windows denies creating the fixture link with `EPERM` or `EACCES`; when creation succeeds, the protection assertion must pass.

Source/agent validation and the local capability contract can also be checked directly:

```bash
node scripts/validate-sources.mjs
node scripts/validate-capability-contract.mjs
```

## Remaining work

- Review and release eligible artifacts with artifact-level license evidence and immutable source revisions.
- Persist approved MCP, Plugin, and CLI records in the local catalog.
- Add stronger dependency planning, evaluation signals, artifact caching, and update/rollback transactions.
- Extend installation evidence for external adapters and multiple agents without treating catalog inclusion as trust.
