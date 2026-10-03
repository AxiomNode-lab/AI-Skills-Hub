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
- A repository-root **Apache-2.0** license may cover a skill under the same conditions (adopted 2026-10-03 for official engineering sources such as getsentry/skills): the root file is the Apache License 2.0 text; no LICENSE, COPYING, or NOTICE file exists at the root besides it, on the path, or inside the skill, so there is no NOTICE content that section 4(d) would require the Hub to carry; the frontmatter declares no license or Apache-2.0; every file was read with no third-party notice or copied text; and a byte-exact copy of the root license ships as `LICENSE.txt`. The Hub never modifies upstream files, so section 4(b) does not apply.
- No other license is accepted from the repository root.
- Preserve upstream copyright and attribution notices when redistribution is allowed.
- Pin provenance before publishing a bundled artifact.
