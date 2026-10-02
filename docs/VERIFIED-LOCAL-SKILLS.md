# Verified local skills

Reviewed on 2026-10-02. These are unmodified text-only packages from their upstream repositories, not newly authored skills or a claim of task effectiveness. The first five use skill-local Apache-2.0 licenses; the 22 in [MIT skills covered by a repository license](#mit-skills-covered-by-a-repository-license) use a repository-root MIT license.

## Source and license evidence

All five use repository `anthropics/skills`, full commit `8a1541c4a3ffa5a20a5a91de0dcf3f0bab1d1ef4`, and source directory `skills/<name>`. The previous catalog paths ending in SKILL.md were corrected to directories for these artifacts only.

Each SKILL.md explicitly points to its **own folder-local LICENSE.txt**, which grants Apache-2.0 redistribution. Every listed resource was inspected for conflicting rights notices, copied third-party material, and dependency references. No repository-wide licensing assumption was used. The entire selected subtree, including the original license and all examples, is retained byte-for-byte. No ancestor NOTICE or nested license exception was found in the pinned tree. Upstream attribution is preserved; trademark permission or endorsement is not claimed.

| Skill | Source / local license | Evidence | Files | Reviewed risk |
| --- | --- | --- | ---: | --- |
| anthropics/frontend-design | [upstream](https://github.com/anthropics/skills/tree/8a1541c4a3ffa5a20a5a91de0dcf3f0bab1d1ef4/skills/frontend-design) / [license](https://github.com/anthropics/skills/blob/8a1541c4a3ffa5a20a5a91de0dcf3f0bab1d1ef4/skills/frontend-design/LICENSE.txt) | [review](../catalog/reviews/anthropics__frontend-design.json), [manifest](../catalog/materialized-manifests/anthropics__frontend-design.json) | 2 | low |
| anthropics/brand-guidelines | [upstream](https://github.com/anthropics/skills/tree/8a1541c4a3ffa5a20a5a91de0dcf3f0bab1d1ef4/skills/brand-guidelines) / [license](https://github.com/anthropics/skills/blob/8a1541c4a3ffa5a20a5a91de0dcf3f0bab1d1ef4/skills/brand-guidelines/LICENSE.txt) | [review](../catalog/reviews/anthropics__brand-guidelines.json), [manifest](../catalog/materialized-manifests/anthropics__brand-guidelines.json) | 2 | low |
| anthropics/internal-comms | [upstream](https://github.com/anthropics/skills/tree/8a1541c4a3ffa5a20a5a91de0dcf3f0bab1d1ef4/skills/internal-comms) / [license](https://github.com/anthropics/skills/blob/8a1541c4a3ffa5a20a5a91de0dcf3f0bab1d1ef4/skills/internal-comms/LICENSE.txt) | [review](../catalog/reviews/anthropics__internal-comms.json), [manifest](../catalog/materialized-manifests/anthropics__internal-comms.json) | 6 | medium |
| anthropics/academy-guide | [upstream](https://github.com/anthropics/skills/tree/8a1541c4a3ffa5a20a5a91de0dcf3f0bab1d1ef4/skills/academy-guide) / [license](https://github.com/anthropics/skills/blob/8a1541c4a3ffa5a20a5a91de0dcf3f0bab1d1ef4/skills/academy-guide/LICENSE.txt) | [review](../catalog/reviews/anthropics__academy-guide.json), [manifest](../catalog/materialized-manifests/anthropics__academy-guide.json) | 2 | low |
| anthropics/discernment-nudge | [upstream](https://github.com/anthropics/skills/tree/8a1541c4a3ffa5a20a5a91de0dcf3f0bab1d1ef4/skills/discernment-nudge) / [license](https://github.com/anthropics/skills/blob/8a1541c4a3ffa5a20a5a91de0dcf3f0bab1d1ef4/skills/discernment-nudge/LICENSE.txt) | [review](../catalog/reviews/anthropics__discernment-nudge.json), [manifest](../catalog/materialized-manifests/anthropics__discernment-nudge.json) | 2 | low |

## Content and dependency review

- **frontend-design:** two documentation files, no scripts, packages, fonts, or assets. Guidance can lead to user-requested project UI edits and optional screenshots. The scanner's word “remove” refers to visual decoration, not a deletion command; it remains recorded.
- **brand-guidelines:** two documentation files, no font or logo redistribution. Poppins/Lora are optional system fonts with stated fallbacks. A python-pptx reference is guidance for a later PowerPoint task, not a bundled library or automatic installation. Runtime setup and trademark use require separate task-specific judgment.
- **internal-comms:** six documentation files, including every referenced example. Optional access to email, Slack, calendar, and Drive is privacy-sensitive; the review raises risk to medium and records network capability even though the keyword scan misses those instructions. User-provided context can be used instead. Installing does not authorize connector access, disclosure, or sending messages.

All raw scanner findings are retained with file, line, evidence, context, and disposition. License URLs keep conservative network flags; a URL in a license is not a mandatory runtime fetch. No shell command, destructive operation, dynamic execution, encoded payload, or credential-extraction instruction was found. This is an AI-assisted review with residual risks, not a security certification.

- **academy-guide** (added 2026-10-02): two documentation files. When the agent can fetch URLs, it may read the public Claude Academy catalog JSON once per conversation; the skill tells the agent to treat it as data, not instructions, and to share only `academy.claude.com` URLs. No credentials or user data are sent. Network capability is recorded; risk low.
- **discernment-nudge** (added 2026-10-02): two documentation files. It only shapes reply text, appending at most two or three follow-up questions once per conversation. The scanner finds nothing in SKILL.md; risk low.
- The repository-root `THIRD_PARTY_NOTICES.md` covers third-party software and fonts (BSD-2-Clause, GPL-3.0, HPND, OFL-1.1). None of the five released subtrees contains such material.

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
| academy-guide | LICENSE.txt | `bc6b3af2f331cbc7fb0da1344efb2cbe5877a31498b4d70dbc7000f3405a1362` |
| academy-guide | SKILL.md | `f27992510c051355dfe68c92394d509af730da5298094ec86834ee40bbd31376` |
| discernment-nudge | LICENSE.txt | `bc6b3af2f331cbc7fb0da1344efb2cbe5877a31498b4d70dbc7000f3405a1362` |
| discernment-nudge | SKILL.md | `9191177c4a8ef11a20dace786d708506b22d43e748c71287bb823de0dc812dad` |

## Release sequence and verification

The old materializer's requirement for an already eligible record is not relaxed. The new explicit reviewed-release path first validates an approved artifact review, exact source inventory, license coverage, immutable provenance, file hashes, Git blob identities, frontmatter, and unchanged scanner findings. It stages files while leaving the catalog on hold. Only after staging and verification does it publish the files and bound manifest, then mark the registry record bundled/materialized/eligible. Blocked records, missing evidence, executables, unknown files, symlinks, and high-risk findings are refused. Initial support is intentionally limited to non-executable Markdown/text packages.

For a new reviewed candidate, check out the upstream repository at the catalog's pinned commit and run `node scripts/draft-review.mjs <id> <checkout>`. It refuses packages with code, binaries, or no skill-local license, and writes a draft review with the Git-tree inventory, hashes, and raw scanner findings. The draft cannot pass the release gate until a reviewer reads every file, gives each finding a disposition and reason, writes the content notes and license scope reason, and approves both statuses. The maintainer then obtains the exact reviewed source directory from its pinned upstream revision **after verifying redistribution rights**. Then run `node scripts/release-reviewed.mjs <id> <reviewed-source-directory>`, regenerate the lock, and validate. The command refuses to replace an existing release directory. A review is a reviewable policy decision, not an automatic legal determination; changing upstream content requires a new review.

Published copies have Git text conversion disabled so Windows checkout preserves upstream SHA-256 bytes. `validate-materialized` rechecks the evidence hash, file inventory, scanner findings, and catalog capabilities.

~~~bash
node scripts/validate-materialized.mjs
node --test tests/reviewed-release.test.mjs
pnpm validate-all
~~~

The integration tests use temporary projects under the workspace's ignored `.ai-skills-hub/` directory, project scope only, without external installers or network access. They install each real package for Codex, check SKILL.md and all companion files against the manifest, verify the install record and source commit, inspect info/list JSON, and confirm that a later file edit is detected. The test projects are removed after testing; the user's home and personal agent configuration are untouched.

## MIT skills covered by a repository license

Reviewed on 2026-10-02 under the repository-root MIT rule in the [license policy](LICENSE-POLICY.md). Sources: `K-Dense-AI/scientific-agent-skills@1549884`, `microsoft/skills@84d8eaa`, and `obra/superpowers@8ca22db`; each root file is the MIT License with a copyright line. For every skill, the review records the ancestor check (no nested LICENSE, COPYING, or NOTICE file on the path), a frontmatter license that is absent or MIT, and a disposition for every scanner finding. The root license ships byte-for-byte as `LICENSE.txt`, marked `attached` with its `source_path` in the review and manifest. File hashes are in each manifest.

| Skill | Source | Evidence | Files (incl. LICENSE.txt) | Reviewed risk |
| --- | --- | --- | ---: | --- |
| kdense/consciousness-council | [K-Dense-AI/scientific-agent-skills](https://github.com/K-Dense-AI/scientific-agent-skills/tree/154988403bb5a18e9d3c0ce4e6d5e2e4b184a298/skills/consciousness-council) | [review](../catalog/reviews/kdense__consciousness-council.json), [manifest](../catalog/materialized-manifests/kdense__consciousness-council.json) | 3 | low |
| kdense/dhdna-profiler | [K-Dense-AI/scientific-agent-skills](https://github.com/K-Dense-AI/scientific-agent-skills/tree/154988403bb5a18e9d3c0ce4e6d5e2e4b184a298/skills/dhdna-profiler) | [review](../catalog/reviews/kdense__dhdna-profiler.json), [manifest](../catalog/materialized-manifests/kdense__dhdna-profiler.json) | 3 | low |
| microsoft/azure-communication-callingserver-java | [microsoft/skills](https://github.com/microsoft/skills/tree/84d8eaa8ae95930f55cdceb3e27196c795dab038/.github/plugins/azure-sdk-java/skills/azure-communication-callingserver-java) | [review](../catalog/reviews/microsoft__azure-communication-callingserver-java.json), [manifest](../catalog/materialized-manifests/microsoft__azure-communication-callingserver-java.json) | 3 | low |
| microsoft/azure-monitor-opentelemetry-exporter-java | [microsoft/skills](https://github.com/microsoft/skills/tree/84d8eaa8ae95930f55cdceb3e27196c795dab038/.github/plugins/azure-sdk-java/skills/azure-monitor-opentelemetry-exporter-java) | [review](../catalog/reviews/microsoft__azure-monitor-opentelemetry-exporter-java.json), [manifest](../catalog/materialized-manifests/microsoft__azure-monitor-opentelemetry-exporter-java.json) | 3 | low |
| microsoft/github-issue-creator | [microsoft/skills](https://github.com/microsoft/skills/tree/84d8eaa8ae95930f55cdceb3e27196c795dab038/.github/skills/github-issue-creator) | [review](../catalog/reviews/microsoft__github-issue-creator.json), [manifest](../catalog/materialized-manifests/microsoft__github-issue-creator.json) | 2 | low |
| microsoft/install-atk | [microsoft/skills](https://github.com/microsoft/skills/tree/84d8eaa8ae95930f55cdceb3e27196c795dab038/.github/plugins/microsoft-365-agents-toolkit/skills/install-atk) | [review](../catalog/reviews/microsoft__install-atk.json), [manifest](../catalog/materialized-manifests/microsoft__install-atk.json) | 2 | medium |
| microsoft/microsoft-azure-webjobs-extensions-authentication-events-dotnet | [microsoft/skills](https://github.com/microsoft/skills/tree/84d8eaa8ae95930f55cdceb3e27196c795dab038/.github/plugins/azure-sdk-dotnet/skills/microsoft-azure-webjobs-extensions-authentication-events-dotnet) | [review](../catalog/reviews/microsoft__microsoft-azure-webjobs-extensions-authentication-events-dotnet.json), [manifest](../catalog/materialized-manifests/microsoft__microsoft-azure-webjobs-extensions-authentication-events-dotnet.json) | 2 | low |
| microsoft/wiki-ado-convert | [microsoft/skills](https://github.com/microsoft/skills/tree/84d8eaa8ae95930f55cdceb3e27196c795dab038/.github/plugins/deep-wiki/skills/wiki-ado-convert) | [review](../catalog/reviews/microsoft__wiki-ado-convert.json), [manifest](../catalog/materialized-manifests/microsoft__wiki-ado-convert.json) | 2 | low |
| microsoft/wiki-architect | [microsoft/skills](https://github.com/microsoft/skills/tree/84d8eaa8ae95930f55cdceb3e27196c795dab038/.github/plugins/deep-wiki/skills/wiki-architect) | [review](../catalog/reviews/microsoft__wiki-architect.json), [manifest](../catalog/materialized-manifests/microsoft__wiki-architect.json) | 2 | low |
| microsoft/wiki-changelog | [microsoft/skills](https://github.com/microsoft/skills/tree/84d8eaa8ae95930f55cdceb3e27196c795dab038/.github/plugins/deep-wiki/skills/wiki-changelog) | [review](../catalog/reviews/microsoft__wiki-changelog.json), [manifest](../catalog/materialized-manifests/microsoft__wiki-changelog.json) | 2 | low |
| microsoft/wiki-llms-txt | [microsoft/skills](https://github.com/microsoft/skills/tree/84d8eaa8ae95930f55cdceb3e27196c795dab038/.github/plugins/deep-wiki/skills/wiki-llms-txt) | [review](../catalog/reviews/microsoft__wiki-llms-txt.json), [manifest](../catalog/materialized-manifests/microsoft__wiki-llms-txt.json) | 2 | low |
| microsoft/wiki-onboarding | [microsoft/skills](https://github.com/microsoft/skills/tree/84d8eaa8ae95930f55cdceb3e27196c795dab038/.github/plugins/deep-wiki/skills/wiki-onboarding) | [review](../catalog/reviews/microsoft__wiki-onboarding.json), [manifest](../catalog/materialized-manifests/microsoft__wiki-onboarding.json) | 2 | low |
| microsoft/wiki-page-writer | [microsoft/skills](https://github.com/microsoft/skills/tree/84d8eaa8ae95930f55cdceb3e27196c795dab038/.github/plugins/deep-wiki/skills/wiki-page-writer) | [review](../catalog/reviews/microsoft__wiki-page-writer.json), [manifest](../catalog/materialized-manifests/microsoft__wiki-page-writer.json) | 2 | low |
| microsoft/wiki-qa | [microsoft/skills](https://github.com/microsoft/skills/tree/84d8eaa8ae95930f55cdceb3e27196c795dab038/.github/plugins/deep-wiki/skills/wiki-qa) | [review](../catalog/reviews/microsoft__wiki-qa.json), [manifest](../catalog/materialized-manifests/microsoft__wiki-qa.json) | 2 | low |
| microsoft/wiki-researcher | [microsoft/skills](https://github.com/microsoft/skills/tree/84d8eaa8ae95930f55cdceb3e27196c795dab038/.github/plugins/deep-wiki/skills/wiki-researcher) | [review](../catalog/reviews/microsoft__wiki-researcher.json), [manifest](../catalog/materialized-manifests/microsoft__wiki-researcher.json) | 2 | low |
| obra/dispatching-parallel-agents | [obra/superpowers](https://github.com/obra/superpowers/tree/8ca22dba9a94f28898bbce59f2537ff4d87c747d/skills/dispatching-parallel-agents) | [review](../catalog/reviews/obra__dispatching-parallel-agents.json), [manifest](../catalog/materialized-manifests/obra__dispatching-parallel-agents.json) | 2 | low |
| obra/finishing-a-development-branch | [obra/superpowers](https://github.com/obra/superpowers/tree/8ca22dba9a94f28898bbce59f2537ff4d87c747d/skills/finishing-a-development-branch) | [review](../catalog/reviews/obra__finishing-a-development-branch.json), [manifest](../catalog/materialized-manifests/obra__finishing-a-development-branch.json) | 2 | medium |
| obra/receiving-code-review | [obra/superpowers](https://github.com/obra/superpowers/tree/8ca22dba9a94f28898bbce59f2537ff4d87c747d/skills/receiving-code-review) | [review](../catalog/reviews/obra__receiving-code-review.json), [manifest](../catalog/materialized-manifests/obra__receiving-code-review.json) | 2 | low |
| obra/requesting-code-review | [obra/superpowers](https://github.com/obra/superpowers/tree/8ca22dba9a94f28898bbce59f2537ff4d87c747d/skills/requesting-code-review) | [review](../catalog/reviews/obra__requesting-code-review.json), [manifest](../catalog/materialized-manifests/obra__requesting-code-review.json) | 3 | low |
| obra/test-driven-development | [obra/superpowers](https://github.com/obra/superpowers/tree/8ca22dba9a94f28898bbce59f2537ff4d87c747d/skills/test-driven-development) | [review](../catalog/reviews/obra__test-driven-development.json), [manifest](../catalog/materialized-manifests/obra__test-driven-development.json) | 3 | low |
| obra/using-superpowers | [obra/superpowers](https://github.com/obra/superpowers/tree/8ca22dba9a94f28898bbce59f2537ff4d87c747d/skills/using-superpowers) | [review](../catalog/reviews/obra__using-superpowers.json), [manifest](../catalog/materialized-manifests/obra__using-superpowers.json) | 9 | medium |
| obra/verification-before-completion | [obra/superpowers](https://github.com/obra/superpowers/tree/8ca22dba9a94f28898bbce59f2537ff4d87c747d/skills/verification-before-completion) | [review](../catalog/reviews/obra__verification-before-completion.json), [manifest](../catalog/materialized-manifests/obra__verification-before-completion.json) | 2 | low |

Three were raised above the scanner's rating:

- **microsoft/install-atk** (medium): runs `npx -y --package @microsoft/m365agentstoolkit-cli` without a pinned version and installs a VS Code extension, when the user asks to install or update ATK.
- **obra/finishing-a-development-branch** (medium): merges, pushes, and removes worktrees for the option the user picks; discarding work requires typing `discard`, and it never force-pushes on its own.
- **obra/using-superpowers** (medium): meant to load at the start of every conversation and tells the agent to invoke applicable skills first; it says user instructions take precedence. It refers to `brainstorming`, which is blocked in this catalog.

`microsoft/azure-communication-callingserver-java` keeps one relative link to a sibling skill that is not part of the artifact.

### Reviewed and not released

- **microsoft/continual-learning:** tells the user to copy a `hooks/continual-learning` directory that is outside the skill, so the released artifact would be incomplete and the hook code is unreviewed.
- **microsoft/slack-to-teams:** depends on more than 100 expert files in sibling directories (`../experts/...`) that are not part of the skill.
- **microsoft/frontend-design-review:** says parts are inspired by Anthropic's Apache-2.0 `frontend-design` skill and are "licensed under respective terms", an unresolved license mix.

### Eligible but not reviewed yet

A survey at the pinned commits found 169 MIT candidates that pass the automated conditions (text-only, no nested license file, no conflicting frontmatter, scanner risk below high): 137 in microsoft/skills, 23 in K-Dense, and 9 in obra/superpowers. This batch reviewed the 30 with scanner risk none or low, except five large K-Dense/Microsoft skills (`research-grants`, `scientific-critical-thinking`, `kql`, `genomic-intelligence`, `ginkgo-cloud-lab`, 468 KB together) left for the next batch. The remaining candidates, mostly Azure SDK skills rated medium by the scanner, need the same full reading before release. Candidates under a nested plugin-level license, with code or binaries, or rated high stay out of this path.

## Not released in this stage

The 20 blocked records, including obra/superpowers/brainstorming (upstream-skill-missing), remain blocked. OpenAI proprietary/source-direct records were not vendored. In `anthropics/skills`, only these five subtrees are text-only with a skill-local Apache license. `doc-coauthoring` and `template` have no local license file. `algorithmic-art`, `canvas-design`, `claude-api`, `slack-gif-creator`, `theme-factory`, and `web-artifacts-builder` contain scripts, fonts, a PDF, or an archive; they need a code/asset review path that does not exist yet. The 20 K-Dense skills whose frontmatter says Apache-2.0 name the license of the library they describe and have no skill-local license file. `vercel-labs/agent-skills` has no license file at its pinned commit, so none of its skills can be released. `microsoft/appinsights-instrumentation` has a skill-local MIT license but lives under a plugin-level license directory, so it was not part of this batch. Successful loading/installation and integrity checks do **not** demonstrate successful task performance; that remains for the next stage.
