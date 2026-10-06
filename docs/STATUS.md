# Current Status

Snapshot: 2026-10-06, version `0.3.0-beta.1`. Counts come from `catalog/skills.json`, `catalog/bundles.json` and `catalog/sources.json`, and from running the commands below, not from earlier reports.

## Catalog

| Distribution | Records |
| --- | ---: |
| bundled (released) | 414 |
| source-direct | 12 |
| review-required | 617 |
| blocked | 40 |
| **Total** | **1083** |

414 records are materialized and release-eligible: 31 under Apache-2.0 (five Anthropic skills with skill-local licenses, and getsentry/skills and the aaron-he-zhu SEO/GEO skills under repository-root licenses) and 383 under a repository-root MIT license (microsoft/skills, obra/superpowers, K-Dense, supabase/agent-skills, addyosmani/agent-skills, UnitOneAI/SecuritySkills, wshobson/agents, BagelHole/DevOps-Security-Agent-Skills, j4flmao/agent-skills, harperaa/secure-claude-skills). Each has a review in `catalog/reviews/`, a manifest with per-file SHA-256 in `catalog/materialized-manifests/`, and its files under `skills/` ([evidence](VERIFIED-LOCAL-SKILLS.md), [policy](LICENSE-POLICY.md)). 1488 files are released. The held `microsoft/azure-keyvault-keys-rust` record has a blocking four-byte DEK example documented in [Batch 06](reviews/independent-batch-06.ar.md); its upstream files are retained in provenance records but are not shipped.

Released means provenance verified, license reviewed, scanner findings reviewed and release approved. It does not mean task performance was evaluated: no skill has a task-performance evaluation.

`catalog/sources.json` has 25 source, provider and standard records. The 40 blocked records are 20 seo-geo-claude-skills signposts (`upstream-moved`) and 20 records recorded as `upstream-skill-missing` (15 obra/superpowers, 4 vercel-labs, 1 microsoft). Eight of the obra ones are legacy `obra/superpowers/*` duplicates of live `obra/<name>` records whose files do exist upstream; the reason was recorded when sync compared directory paths with `SKILL.md` paths.

Reproduce the counts:

```bash
node -e "const c=require('./catalog/skills.json'); console.log('total',c.skills.length); for(const s of ['bundled','source-direct','review-required','blocked']) console.log(s,c.skills.filter(x=>x.distribution===s).length)"
```

## Distribution

Users install one npm package, `@axiomnode-lab/skills-hub` (binary `skills-hub`). `scripts/build-package.mjs` builds it from the workspace: the runtime modules reachable from the CLI with internal imports rewritten to relative paths, the registry, and the files, manifest and review of every released skill. Runtime dependencies are `@inquirer/prompts` and `yaml`. `scripts/e2e-package.mjs` packs it, installs the tarball into a temporary project, and runs the workflow there through the installed binary, `npx`, and a global install. The workspace packages `@ai-skills-hub/*` are private and are not published.

The package is not yet published to npm. Releases are tag-driven ([RELEASING](RELEASING.md)).

## CLI behavior

- `available`, `search` and `info` read the packaged catalog. Search is keyword matching with ranking (exact ID/name, publisher/category/tag, compatibility, release state); release state and installability only rank results that already match the text.
- `install` installs released skills for one agent, dependencies first. It verifies the artifact against its manifest before writing, writes exactly the verified bytes, records per-file hashes in `.ai-skills-hub/installed.json`, refuses to replace an unmanaged or edited folder without `--force`, and treats reinstalling the same revision as a no-op. Install paths through symlinks are refused. Multi-skill installs are not atomic; nothing is rolled back.
- `update` moves installed skills to the released revision; it refuses releases that are not eligible and keeps edited files unless `--force`; `--dry-run` reports only.
- `uninstall <id>` removes only a Hub-managed folder directly inside the agent's skills root, checks the recorded agent, scope and file hashes, and never follows symlinks.
- External installers (source-direct skills, MCP configuration, plugin marketplaces) run only after `--yes`, through an allowlisted binary and a validated argument vector, which `install` shows before consent. Adding a plugin marketplace is reported as not installed.
- `add <phrase>` combines the catalog with public directories (skills.sh, MCP Registry, npm, plugin directories); popularity can rank a result higher but never releases it. `add <git-url>` clones an https or SSH repository into `capabilities-library/` for review; it installs and releases nothing.
- `mcp` and `serve` are read-only. `serve` binds to 127.0.0.1 by default, has no authentication, and warns on other addresses. The server verifies the release manifest, review hash and file hashes on every request, refuses symlinks and paths outside the package, and checks `Host` and `Origin`.
- Exit codes: 0 success, 1 failed operation, 2 usage error. `--json` is always machine-readable, including usage errors.

## Verification

```bash
pnpm validate-all      # workspace, syntax, schemas, lockfile, registry, materialized integrity, dedupe, tests
pnpm verify-upstream   # re-download every released file at its pinned commit and compare SHA-256
pnpm e2e:package       # build, pack, install the tarball in a temp dir, run the user workflow
```

CI runs `validate-all` on Linux and Windows (Node 22), `verify-upstream` on Linux, and the package E2E on both.

The three synthetic Codex skill probes are documented in the [evaluation report](../evaluations/skills/results/2026-10-02.md) and [replay guide](../evaluations/skills/README.md). Their project installs and file checks passed, but managed execution policy blocked instruction reads, so all three tasks remain `not-run`; instruction use and output quality are unproven. The [2026-10-06 preflight](../evaluations/skills/results/2026-10-06-preflight.md) reproduced the block after this branch was reconciled with `main`. The runner requires a successful project-local read/write/read preflight before any paid case, and independent human review remains pending.

## Known limitations

- The model-based reranker in `@ai-skills-hub/discovery` is not reachable from the CLI; search is keyword-based.
- Bundle aliases (`@frontend`) are catalog groupings only; `install @name` is refused with `bundle_aliases_not_supported`.
- 49 catalog records have no description; none is released. Descriptions are repaired only from the same upstream file (hash match), which is not available for them.
- PR #11 asked for an additional independent instruction review of the 139-skill expansion. The [reconciliation matrix](reviews/2026-10-05-pr10-expansion-reconciliation.json) now records 50 with additional batch evidence, 5 held and 89 eligible without that additional review.
- No skill has a task-performance evaluation. Reviews are AI-assisted and are not legal advice or a security certification.
