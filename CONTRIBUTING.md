# Contributing

## Adding a skill source

1. Add the upstream repository to `catalog/sources.json` (use `include_paths` to limit a mixed repository to the relevant subtrees).
2. Ingest it at a pinned commit: `node scripts/ingest-github.mjs <owner/repo> <ref>` (or `--checkout <clone>` from a local clone), then `node scripts/sync-registry.mjs --source <owner/repo> --no-fetch`. New records start as `review-required`.
3. Draft a review from a pinned clone: `node scripts/draft-review.mjs <id> <clone>`. It records every file, its hashes and scanner findings, and checks the license basis.
4. Read every file. Record a disposition for every finding, the license scope reason, and content notes; set the review to `approved` only when the skill meets [AGENTS.md](AGENTS.md) and [docs/LICENSE-POLICY.md](docs/LICENSE-POLICY.md).
5. Release it: `node scripts/release-reviewed.mjs <id> <clone>/<path>`. The release gate refuses unapproved reviews, high-risk findings, mismatched hashes and unsupported licenses.
6. Run `pnpm validate-all` and `pnpm verify-upstream`, document the release in `docs/VERIFIED-LOCAL-SKILLS.md`, and open a pull request with the evidence.

## Changing code

Run `pnpm validate-all` before opening a pull request, and `pnpm e2e:package` when the CLI, runtime packages or packaging change. Behaviour changes need tests. See [docs/RELEASING.md](docs/RELEASING.md) for releases.

## Principles

- Prefer upstream attribution over forks.
- Never assume a repository-wide license applies to every nested artifact.
- Do not vendor proprietary or ambiguous content.
- Avoid duplicate skills when an upstream canonical source exists.
- A state change (release, hold, block) needs evidence in a review or source manifest.
