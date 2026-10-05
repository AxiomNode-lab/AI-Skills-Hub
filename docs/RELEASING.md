# Releasing

The npm package `@axiomnode-lab/skills-hub` is built from this workspace by `scripts/build-package.mjs` and published by `.github/workflows/release.yml`. Nothing is published from ordinary pushes or pull requests.

## One-time setup (maintainers)

1. On npmjs.com, the `@axiomnode-lab` organization owns the package name. Add a **trusted publisher** for `@axiomnode-lab/skills-hub`: GitHub Actions, repository `AxiomNode-lab/AI-Skills-Hub`, workflow `release.yml`, environment `npm`. No `NPM_TOKEN` secret is used.
2. In the repository settings, create the `npm` environment and restrict it to maintainers (required reviewers) if desired.

## Cutting a release

1. Set the version in the root `package.json` and every `packages/*/package.json` (they are kept identical), update `CHANGELOG.md`, and merge to `main`.
2. Locally or in CI, confirm:

   ```bash
   pnpm install --frozen-lockfile
   pnpm validate-all
   pnpm verify-upstream
   pnpm e2e:package
   ```

3. Create a GitHub release with tag `v<version>` (for example `v0.3.0-beta.1`). Publishing the release starts the workflow, which:
   - checks the tag matches `package.json`;
   - runs `validate-all`, `verify-upstream` and the package E2E;
   - builds the package and prints `npm pack --dry-run`;
   - publishes with `--provenance` (dist-tag `latest`, or `next` for a prerelease once a stable version exists);
   - installs the published version with `npx` in a clean directory and installs a skill with it.

## What the package contains

`package.json`, `README.md`, `LICENSE`, `NOTICE.md`, the runtime modules under `packages/` (CLI, core, discovery, installer, materializer, security, server; internal imports rewritten to relative paths), `catalog/skills.json`, `bundles.json`, `skills.lock.json`, `agents.json`, and for each released skill its manifest, review and files under `skills/`. Tests, scripts, docs, ingestion snapshots, unreleased reviews and workspace configuration are not included; `tests/package-build.test.mjs` and `scripts/e2e-package.mjs` enforce this.

## Versioning

0.x releases may change behaviour between minor versions. Prereleases (`-beta.N`) are used until the first stable release. A `1.0.0` release requires the acceptance criteria in the MVP report to hold, including published-package E2E on Linux and Windows.
