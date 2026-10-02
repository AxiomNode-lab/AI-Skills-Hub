# Verified local skills

Reviewed on 2026-10-02. These are unmodified text-only packages from the official upstream repository, not newly authored skills or a claim of task effectiveness.

## Source and license evidence

All three use repository `anthropics/skills`, full commit `8a1541c4a3ffa5a20a5a91de0dcf3f0bab1d1ef4`, and source directory `skills/<name>`. The previous catalog paths ending in SKILL.md were corrected to directories for these artifacts only.

Each SKILL.md explicitly points to its **own folder-local LICENSE.txt**, which grants Apache-2.0 redistribution. Every listed resource was inspected for conflicting rights notices, copied third-party material, and dependency references. No repository-wide licensing assumption was used. The entire selected subtree, including the original license and all examples, is retained byte-for-byte. No ancestor NOTICE or nested license exception was found in the pinned tree. Upstream attribution is preserved; trademark permission or endorsement is not claimed.

| Skill | Source / local license | Evidence | Files | Reviewed risk |
| --- | --- | --- | ---: | --- |
| anthropics/frontend-design | [upstream](https://github.com/anthropics/skills/tree/8a1541c4a3ffa5a20a5a91de0dcf3f0bab1d1ef4/skills/frontend-design) / [license](https://github.com/anthropics/skills/blob/8a1541c4a3ffa5a20a5a91de0dcf3f0bab1d1ef4/skills/frontend-design/LICENSE.txt) | [review](../catalog/reviews/anthropics__frontend-design.json), [manifest](../catalog/materialized-manifests/anthropics__frontend-design.json) | 2 | low |
| anthropics/brand-guidelines | [upstream](https://github.com/anthropics/skills/tree/8a1541c4a3ffa5a20a5a91de0dcf3f0bab1d1ef4/skills/brand-guidelines) / [license](https://github.com/anthropics/skills/blob/8a1541c4a3ffa5a20a5a91de0dcf3f0bab1d1ef4/skills/brand-guidelines/LICENSE.txt) | [review](../catalog/reviews/anthropics__brand-guidelines.json), [manifest](../catalog/materialized-manifests/anthropics__brand-guidelines.json) | 2 | low |
| anthropics/internal-comms | [upstream](https://github.com/anthropics/skills/tree/8a1541c4a3ffa5a20a5a91de0dcf3f0bab1d1ef4/skills/internal-comms) / [license](https://github.com/anthropics/skills/blob/8a1541c4a3ffa5a20a5a91de0dcf3f0bab1d1ef4/skills/internal-comms/LICENSE.txt) | [review](../catalog/reviews/anthropics__internal-comms.json), [manifest](../catalog/materialized-manifests/anthropics__internal-comms.json) | 6 | medium |

## Content and dependency review

- **frontend-design:** two documentation files, no scripts, packages, fonts, or assets. Guidance can lead to user-requested project UI edits and optional screenshots. The scanner's word “remove” refers to visual decoration, not a deletion command; it remains recorded.
- **brand-guidelines:** two documentation files, no font or logo redistribution. Poppins/Lora are optional system fonts with stated fallbacks. A python-pptx reference is guidance for a later PowerPoint task, not a bundled library or automatic installation. Runtime setup and trademark use require separate task-specific judgment.
- **internal-comms:** six documentation files, including every referenced example. Optional access to email, Slack, calendar, and Drive is privacy-sensitive; the review raises risk to medium and records network capability even though the keyword scan misses those instructions. User-provided context can be used instead. Installing does not authorize connector access, disclosure, or sending messages.

All raw scanner findings are retained with file, line, evidence, context, and disposition. License URLs keep conservative network flags; a URL in a license is not a mandatory runtime fetch. No shell command, destructive operation, dynamic execution, encoded payload, or credential-extraction instruction was found. This is an AI-assisted review with residual risks, not a security certification.

## Complete SHA-256 inventory

The review additionally records Git blob hashes, byte counts, file modes, and a licensing decision for each file. Materialization manifests bind the review itself by SHA-256.

| Skill | File | SHA-256 |
| --- | --- | --- |
| frontend-design | LICENSE.txt | `0d542e0c8804e39aa7f37eb00da5a762149dc682d7829451287e11b938e94594` |
| frontend-design | SKILL.md | `d91970639e9f5c37682ac7ab60094d35f1c7c1f38d731bd56396563aee10c1d3` |
| brand-guidelines | LICENSE.txt | `bc6b3af2f331cbc7fb0da1344efb2cbe5877a31498b4d70dbc7000f3405a1362` |
| brand-guidelines | SKILL.md | `1120b3769e2985cefb3d25be981b1f914abeba57ae079b83c20c666c164fa9fe` |
| internal-comms | LICENSE.txt | `bc6b3af2f331cbc7fb0da1344efb2cbe5877a31498b4d70dbc7000f3405a1362` |
| internal-comms | SKILL.md | `067b7587a344a928fc6534ef66b1bcd591fc7c26d207ea7ca3334aeb678d6475` |
| internal-comms | examples/3p-updates.md | `087e4363c0f3513728a7e695eeb9ead5c3ecd12a4681b59340691180e65b68fc` |
| internal-comms | examples/company-newsletter.md | `30f81cfbdb03858a006169c72169024089c7c5d3d32611d337782da4f38c86b5` |
| internal-comms | examples/faq-answers.md | `5ecd3356cd6666937f2ebefa753253edfdbdca15e368d07baf398bfcced72484` |
| internal-comms | examples/general-comms.md | `4d3a4bb198a77626bcf018e96b2b45a2dbabed172d4ade0fcd70d23ae8a47a47` |

## Release sequence and verification

The old materializer's requirement for an already eligible record is not relaxed. The new explicit reviewed-release path first validates an approved artifact review, exact source inventory, license coverage, immutable provenance, file hashes, Git blob identities, frontmatter, and unchanged scanner findings. It stages files while leaving the catalog on hold. Only after staging and verification does it publish the files and bound manifest, then mark the registry record bundled/materialized/eligible. Blocked records, missing evidence, executables, unknown files, symlinks, and high-risk findings are refused. Initial support is intentionally limited to non-executable Markdown/text packages.

For a new reviewed candidate, a maintainer prepares `catalog/reviews/<id-with-__>.json` and obtains the exact reviewed source directory from its pinned upstream revision **after verifying redistribution rights**. Then run `node scripts/release-reviewed.mjs <id> <reviewed-source-directory>`, regenerate the lock, and validate. The command refuses to replace an existing release directory. A review is a reviewable policy decision, not an automatic legal determination; changing upstream content requires a new review.

Published copies have Git text conversion disabled so Windows checkout preserves upstream SHA-256 bytes. `validate-materialized` rechecks the evidence hash, file inventory, scanner findings, and catalog capabilities.

~~~bash
node scripts/validate-materialized.mjs
node --test tests/reviewed-release.test.mjs
pnpm validate-all
~~~

The integration tests use temporary projects under the workspace's ignored `.ai-skills-hub/` directory, project scope only, without external installers or network access. They install each real package for Codex, check SKILL.md and all companion files against the manifest, verify the install record and source commit, inspect info/list JSON, and confirm that a later file edit is detected. The test projects are removed after testing; the user's home and personal agent configuration are untouched.

## Not released in this stage

The 20 blocked records, including obra/superpowers/brainstorming (upstream-skill-missing), remain blocked. OpenAI proprietary/source-direct records were not vendored. No fourth or fifth skill was claimed ready: the stage stops at three fully reviewed text-only artifacts. Other candidates require their own resource, licensing, and dependency reviews. Successful loading/installation and integrity checks do **not** demonstrate successful task performance; that remains for the next stage.
