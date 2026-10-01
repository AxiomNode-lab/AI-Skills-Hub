# Installation

## Preview

~~~bash
skills-hub plan @core --agent codex
~~~

The plan separates:

- **install**: verified redistribution state.
- **source-direct**: official upstream installation; content is not mirrored by AI Skills Hub.
- **hold**: review-required and intentionally not installed automatically.
- **blocked**: explicitly blocked by registry policy.

The current implementation emits npx skills commands as a compatibility bridge. The future native installer will use content-addressed bundles from AI Skills Hub for artifacts that are safely redistributable.

Review-required installs require explicit acknowledgement.
