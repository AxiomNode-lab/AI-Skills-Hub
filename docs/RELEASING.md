# Releasing

The npm package `@axiomnode-lab/skills-hub` is built from this workspace by `scripts/build-package.mjs` and published by `.github/workflows/release.yml`. Nothing is published from ordinary pushes or pull requests.

## One-time setup (maintainers)

npm attaches a trusted publisher to an existing package, from that package's settings page ([npm docs](https://docs.npmjs.com/trusted-publishers)). The package does not exist until it is published once, so the first version is published by hand and every later version by the workflow.

1. **First publish, from a maintainer machine.** Use an npm account in the `@axiomnode-lab` organization with two-factor authentication:

   ```bash
   pnpm install --frozen-lockfile
   pnpm validate-all && pnpm verify-upstream && pnpm e2e:package
   pnpm build:package
   cd dist/npm
   npm publish --access public --tag latest
   ```

   This first version has no provenance statement; later versions published by the workflow do.
2. **Add the trusted publisher** on npmjs.com → the package → Settings → Trusted Publisher → GitHub Actions:
   - organization `AxiomNode-lab`, repository `AI-Skills-Hub`, workflow filename `release.yml`, environment `npm`;
   - under **Allowed actions**, tick **`npm publish`**. Configurations created after 3 September 2026 allow only `npm stage publish` by default, and the workflow runs `npm publish`;
   - the configuration must complete a successful publish within **2 days** or it expires and has to be deleted and recreated. Add it when the next version is ready, then follow [Cutting a release](#cutting-a-release) the same day.
3. In the repository settings, create the `npm` environment and restrict it to maintainers (required reviewers) if desired.
4. Optional, after a workflow release has succeeded: in the package settings select "Require two-factor authentication and disallow tokens". Trusted publishing keeps working, because it does not use tokens.

No `NPM_TOKEN` secret is used at any point.

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
   - publishes through trusted publishing, which adds provenance (dist-tag `latest`; a prerelease goes to `next` only when `latest` is a stable version);
   - installs the published version with `npx` in a clean directory and installs a skill with it.

## What the package contains

`package.json`, `README.md`, `LICENSE`, `NOTICE.md`, the runtime modules under `packages/` (CLI, core, discovery, installer, materializer, security, server; internal imports rewritten to relative paths), `catalog/skills.json`, `bundles.json`, `skills.lock.json`, `agents.json`, and for each released skill its manifest, review and files under `skills/`. Tests, scripts, docs, ingestion snapshots, unreleased reviews and workspace configuration are not included; `tests/package-build.test.mjs` and `scripts/e2e-package.mjs` enforce this.

## Versioning

0.x releases may change behaviour between minor versions. Prereleases (`-beta.N`) are used until the first stable release. A `1.0.0` release requires the acceptance criteria in the MVP report to hold, including published-package E2E on Linux and Windows.
