# Standards Alignment

## Agent Skills

AI Skills Hub follows the Agent Skills directory model: a Skill is a directory containing a required SKILL.md with YAML frontmatter, with optional scripts, references, assets, and other supporting files.

Canonical reference:
https://github.com/agentskills/agentskills

## Agent Plugins

Agent Plugins Specification 1.0.0 is the portable packaging layer for reusable Agent Skills and MCP servers. AI Skills Hub should generate or consume this package shape instead of inventing a private bundle format.

Canonical reference:
https://github.com/agentplugins/agent-plugins-spec

## OpenAI Plugins

OpenAI's current plugin model packages Skills, MCP configuration, and optional UI. The project therefore keeps Skills as portable filesystem artifacts and treats OpenAI-specific behavior as an adapter layer.

Canonical reference:
https://developers.openai.com/plugins/concepts/plugins

## MCP Skills Extension

The MCP Skills extension identifies itself as io.modelcontextprotocol/skills and requires servers that advertise it to implement skills/list and skills/get; Skill files are delivered through the Resources primitive.

Canonical reference:
https://github.com/modelcontextprotocol/ext-skills

## Design consequence

The registry identity is independent of any one client. Agent-specific installation behavior belongs in adapters, while the underlying Skill remains portable and provenance-bound.
