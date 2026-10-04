# Security Model

A Skill is treated as executable guidance, not inert documentation: an agent follows its instructions. The Hub's job is to make sure that what it installs is exactly what was reviewed, that it is allowed to redistribute it, and that its own code cannot be used to run or overwrite things the user did not ask for.

## What a release guarantees

- **Provenance.** Each released skill is pinned to an upstream repository, commit and path, with a review in `catalog/reviews/` and a manifest of every file's size and SHA-256 in `catalog/materialized-manifests/`. `pnpm verify-upstream` re-downloads every released file at its commit and compares hashes (CI runs it).
- **License basis.** See [LICENSE-POLICY](LICENSE-POLICY.md). Visibility on GitHub is never treated as permission.
- **Reviewed content.** Every file was read by an AI-assisted reviewer; every scanner finding has a recorded disposition. The scanner flags shell execution, network access, credential access, dynamic execution (`eval(`, `exec(`, the `Function` constructor), encoded content, destructive commands (`rm -rf`), package installs and file writes. A high-risk finding blocks release regardless of approval.
- **Not guaranteed.** Reviews are not legal advice or a security certification, and no skill is evaluated for task performance.

## Runtime controls

- **No shell.** Every external process (git, external installers) runs as an argument vector without a shell. External installers are limited to an allowlist (`npx`, `pnpm`, `codex`, `claude`, `copilot`), each plan's arguments are validated (HTTPS URLs, package names, repository names), the exact command is shown, and it runs only with `--yes`. Prerequisites are never installed silently.
- **Git.** `add <git-url>` accepts only `https://` and SSH URLs and runs `git clone --no-recurse-submodules --` with `GIT_ALLOW_PROTOCOL=https:ssh`; `sync` only fast-forwards. Cloned repositories go to `capabilities-library/` for review and are never released or installed by that step.
- **Installs.** Released files are verified against their manifest (exact file set, no symlinks, size and hash) before anything is written, and the verified bytes are what is written. Skill directory names must be lowercase slugs; install and uninstall refuse paths through symlinks or junctions and only touch a folder directly inside the agent's skills root. Existing folders the Hub did not create, or edited installations, are replaced only with `--force`.
- **State.** `.ai-skills-hub/installed.json` is written through a temporary file and rename, with per-file hashes. A record pointing outside the install root is refused.
- **Frontmatter.** YAML 1.2 is parsed without aliases, anchors, merge keys or custom tags; duplicate keys and non-string `name`/`description`/`license` fail closed.
- **Servers.** `mcp` and `serve` are read-only and unauthenticated. `serve` binds to loopback by default and warns otherwise; it checks `Host` and `Origin`, sends no CORS headers, limits request bodies to 1 MiB, validates parameters, and returns error codes rather than internal messages. Files are served only after the release manifest, review hash and file hashes are verified on that request.
- **Update check.** At most once a day, only on a terminal and outside CI, the CLI asks the npm registry for the package's latest version. No other data is sent.

Report vulnerabilities as described in [SECURITY.md](../SECURITY.md).
