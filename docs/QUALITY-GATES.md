# Quality Gates

A Skill is eligible for public bundled distribution only when all gates pass:

1. Valid Agent Skills structure.
2. SKILL.md has valid YAML frontmatter, including name and description.
3. License is identified at artifact level.
4. Redistribution is permitted under the applicable terms.
5. Upstream source and immutable revision are recorded.
6. Content hashes are recorded.
7. Security capability scan completed.
8. No unresolved blocking finding.
9. Registry, bundle, and lockfile validation passes.
10. Registry/installer/MCP/plugin regression tests pass.
11. For executable Skills, declared runtime capabilities are reviewed against observed content.

Popularity is a discovery signal, not a trust or safety approval.

The materializer additionally refuses symlinks, path traversal, oversized files, and skills without a root SKILL.md.
