# AI Skills Hub

A license-aware, provenance-first registry for AI Agent Skills.

AI Skills Hub is designed to answer a practical question: **what can I install, where did it come from, is redistribution allowed, what capabilities does it request, and which agents can use it?**

## Goals
- Discover and curate high-value Agent Skills.
- Preserve source provenance and immutable source revisions.
- Detect licensing constraints before redistribution.
- Scan Skills for potentially sensitive execution capabilities.
- Support bundles and multi-agent installation planning.
- Remain compatible with the open Agent Skills ecosystem.

## Current foundation
The repository currently contains a curated metadata catalog spanning official and ecosystem sources. The catalog is intentionally **not** a blind mirror: third-party artifacts are bundled only after redistribution rights and provenance are verified. Everything else is classified as source-direct or review-required.

## Repository layout
- `catalog/` normalized skill metadata, bundles, sources, and ingestion snapshots
- `schemas/` machine-readable registry schemas
- `packages/` reusable registry, security, license, and CLI modules
- `apps/` API and web discovery surfaces
- `scripts/` ingestion and audit tooling
- `docs/` architecture, policy, quality, and roadmap

## Development

```bash
pnpm install
pnpm validate
pnpm test
pnpm audit
```

## Policy
A public GitHub repository is not automatically redistributable. License decisions are made at the smallest relevant artifact and recorded with provenance.

See [LICENSE-POLICY](docs/LICENSE-POLICY.md), [QUALITY-GATES](docs/QUALITY-GATES.md), and [ARCHITECTURE](docs/ARCHITECTURE.md).
