# MCP Server

AI Skills Hub runs a read-only MCP server so an agent can search the catalog and read released skills during a task.

| Transport | Command |
| --- | --- |
| stdio | `skills-hub mcp` |
| HTTP (JSON responses) | `skills-hub serve`, then `POST http://127.0.0.1:8787/mcp` |

The HTTP endpoint answers 403 to a request whose `Origin` header is not `localhost`, `127.0.0.1`, or `[::1]`, so a web page cannot reach it through DNS rebinding, and 413 to a body over 1 MiB.

## Tools

- `search_skills` — `query` (required), `agent`, `installable_only`, `limit` (≤ 100). Returns catalog metadata with `availability`, license, security, release, and source revision.
- `get_skill` — `id` (required), `agent`. Returns metadata, the install command for eligible skills, and for released skills the file list and `SKILL.md`.

## Resources

Every file of a materialized, release-eligible skill is listed as `skillshub://skills/<id>/<path>` and can be read with `resources/read`. Only regular files inside the skill's materialized root are served. Held, review-required, source-direct, and blocked skills are never exposed as content; their normalized metadata remains searchable.

## Client configuration

Use an absolute path to your checkout.

Claude Code:

```bash
claude mcp add skills-hub -- node /path/to/AI-Skills-Hub/packages/cli/bin/skills-hub.mjs mcp
```

Codex (`~/.codex/config.toml`):

```toml
[mcp_servers.skills-hub]
command = "node"
args = ["/path/to/AI-Skills-Hub/packages/cli/bin/skills-hub.mjs", "mcp"]
```

Other clients that accept a JSON `mcpServers` map:

```json
{ "mcpServers": { "skills-hub": { "command": "node", "args": ["/path/to/AI-Skills-Hub/packages/cli/bin/skills-hub.mjs", "mcp"] } } }
```

The server supports protocol versions `2025-06-18`, `2025-03-26`, and `2024-11-05`. It does not install anything; use `skills-hub install` for that.
