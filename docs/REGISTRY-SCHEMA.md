# Registry Schema

Every Skill record tracks:
- Stable namespaced ID.
- Human-readable name and publisher.
- Upstream repository and Skill path.
- Immutable source revision.
- Artifact-level license and redistribution state.
- Agent compatibility.
- Security capabilities and scan state.
- Materialization and release state.
- Integrity metadata.

Distribution states:
- bundled: content may be present after release gates.
- source-direct: metadata only; install bridge points to upstream.
- review-required: visible in the catalog but held from automated distribution.
- blocked: explicitly unavailable.

A bundle is only an index of Skill IDs. It never overrides an individual Skill's license or distribution state.
