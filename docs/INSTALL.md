# Installation

## Registry-managed content

Only release-eligible bundled Skills are copied from the registry materialized store. The native installer records per-file hashes under .ai-skills-hub/installed.json so doctor can detect local tampering.

Example:

    pnpm materialize
    pnpm --filter @ai-skills-hub/cli exec skills-hub install @core --agent codex

## Source-direct content

Non-redistributable or not-yet-released Skills are never vendored into this repository. The CLI emits an upstream installation bridge instead.

## Dry run

    pnpm --filter @ai-skills-hub/cli exec skills-hub plan @core --agent codex

## Audit

    pnpm validate
    pnpm audit
    pnpm test
