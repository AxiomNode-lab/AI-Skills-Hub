# License Policy

## Distribution states

### bundled
The project may redistribute the artifact under the verified applicable terms.

### source-direct
The project publishes metadata and points users to the original source. The artifact itself is not vendored.

### review-required
License or ownership signals are insufficient for automated redistribution.

### blocked
The artifact is explicitly excluded from distribution.

## Rules
- Public visibility does not imply redistribution rights.
- Repository-level licensing is not automatically sufficient for nested skills. A skill-local license governs when one exists.
- A repository-root **MIT** license may cover a skill only when all of these hold, recorded in the skill's review:
  - the root file is the full MIT License text with its copyright notice;
  - no LICENSE, COPYING, or NOTICE file exists at the repository root besides it, in any directory on the path to the skill, or inside the skill;
  - the skill's frontmatter declares no license, or declares MIT;
  - every file was read and contains no third-party copyright notice, other license grant, or copied third-party text;
  - a byte-exact copy of the root license ships with the skill as `LICENSE.txt` (an attached file listed in the review and the materialization manifest).
- No other license is accepted from the repository root. Apache-2.0 is accepted only from a skill-local license file.
- Preserve upstream copyright and attribution notices when redistribution is allowed.
- Pin provenance before publishing a bundled artifact.
- The MIT release check requires the complete permission, notice and disclaimer text, allowing whitespace and a final-period variation. A truncated grant or additional restriction is not recognized as MIT by this workflow; unfamiliar variants require a separate review.
- Frontmatter uses strict YAML 1.2 parsing. Duplicate keys, aliases, anchors, merge keys, custom tags, malformed YAML and unclosed frontmatter are rejected. When present, `name`, `description` and `license` must be non-empty strings; a mapping or sequence license is never treated as an absent declaration. Scalar quoting, indentation and block chomping retain their YAML meaning. Other nested metadata is not extracted into scalar catalog fields.
