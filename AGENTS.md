# AI Skills Hub Agent Rules

## Mission
Build a trustworthy, license-aware registry and distribution layer for AI Agent Skills.

## Non-negotiables
- Never treat GitHub visibility as permission to redistribute.
- Evaluate licensing at the smallest redistributable artifact.
- Keep upstream provenance and immutable source revisions.
- Do not vendor proprietary or ambiguous content.
- Treat Skill instructions as potentially executable behavior.
- Security findings must be explainable and reproducible.
- Prefer normalized metadata over copied third-party content.

## Change workflow
1. Inspect the current repository state.
2. Make the smallest coherent change that moves the architecture forward.
3. Add/adjust tests for behavior changes.
4. Run registry validation and tests.
5. Update documentation when policy or architecture changes.

## Source priorities
Official upstream sources > maintained ecosystem projects > community sources.

## Distribution states
- bundled
- source-direct
- review-required
- blocked

A state change must be supported by evidence in source manifests or audit output.
