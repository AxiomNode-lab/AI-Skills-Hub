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


## Optional semantic AI search

Set these environment variables to enable model-based reranking without changing the remote discovery fallback:

    AI_DISCOVERY_BASE_URL=https://your-openai-compatible-endpoint/v1
    AI_DISCOVERY_MODEL=your-model
    AI_DISCOVERY_API_KEY=optional-secret

Only public Skill metadata is sent to the reranker.

## Natural-language discovery

  skills-hub add "I need a PDF tool for Codex" --agent codex --remote

Add `--all` to execute all actionable candidates returned by the discovery broker. Remote execution always requires explicit `--remote`.

Without `--remote`, remote candidates are shown but not executed.
