# Architecture

## Principles
1. The registry is the source of truth for normalized metadata, not a mirror of arbitrary repositories.
2. Every record has provenance: upstream repository + path, and future exact commit/hash fields.
3. Redistribution is an explicit state, never inferred solely from GitHub visibility.
4. Skills with ambiguous or restrictive licensing remain source-direct/review-required.
5. Security capabilities are metadata today and scanner findings tomorrow.
6. Installers resolve bundles to the user's target agent rather than assuming one filesystem layout.

## Planned services
- Ingestion worker: GitHub -> normalize -> license/provenance/security -> registry
- Registry API: search, metadata, versions, provenance
- CLI: install, update, audit, doctor
- MCP server: skills/list, skills/get, resources/read
- Web app: discovery, detail pages, bundles, install instructions

## Recommended data flow

source
  -> fetch at pinned revision
  -> parse SKILL.md
  -> resolve effective license
  -> static security scan
  -> deduplicate
  -> evaluate
  -> registry release
