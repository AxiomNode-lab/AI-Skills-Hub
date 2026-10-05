# MCP Server

AI Skills Hub runs a read-only MCP server so an agent can search the catalog and read released skills during a task.

| Transport | Command |
| --- | --- |
| stdio | `skills-hub mcp` |
| HTTP (JSON responses) | `skills-hub serve`, then `POST http://127.0.0.1:8787/mcp` |

The server is read-only and has no authentication. Over HTTP it accepts a request only when the `Host` header names the server itself (on loopback: `localhost`, `127.0.0.1` or `[::1]` with its port) and any `Origin` header is that same origin, so web pages and DNS rebinding cannot reach it. `/mcp` requires `Content-Type: application/json`, accepts only the supported `MCP-Protocol-Version` values, rejects batches, and answers 413 to bodies over 1 MiB.

## Tools

- `search_skills` — `query` (required), `agent`, `installable_only`, `limit` (≤ 100). Returns catalog metadata with `availability`, license, security, release, and source revision.
- `get_skill` — `id` (required), `agent`. Returns metadata, the install command for eligible skills, and for released skills the file list and `SKILL.md`.

## Resources

Every file of a materialized, release-eligible skill is listed as `skillshub://skills/<id>/<path>` and can be read with `resources/read`. A file is served only after its release manifest, the review it references (by hash) and every file hash are verified on that request; symlinks and paths outside the package are refused. Held, review-required, source-direct, and blocked skills are never exposed as content; their normalized metadata remains searchable.

## Client configuration

Claude Code:

```bash
claude mcp add skills-hub -- npx -y @axiomnode-lab/skills-hub mcp
```

Codex (`~/.codex/config.toml`):

```toml
[mcp_servers.skills-hub]
command = "npx"
args = ["-y", "@axiomnode-lab/skills-hub", "mcp"]
```

Other clients that accept a JSON `mcpServers` map:

```json
{ "mcpServers": { "skills-hub": { "command": "npx", "args": ["-y", "@axiomnode-lab/skills-hub", "mcp"] } } }
```

With a global install, use `skills-hub mcp` as the command. stdout carries only JSON-RPC messages; the update notice and logs never go there.

The server implements `initialize`, `ping`, `tools/list`, `tools/call`, `resources/list`, `resources/templates/list` and `resources/read` for protocol versions `2025-06-18`, `2025-03-26` and `2024-11-05` (a client asking for another version is answered with `2025-06-18`). The HTTP transport returns single JSON responses; it does not stream (no SSE) and has no sessions. These are the behaviours covered by tests; other MCP features are not implemented. It does not install anything; use `skills-hub install` for that.
