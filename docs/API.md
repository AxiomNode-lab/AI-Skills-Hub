# Registry API

`skills-hub serve` starts a read-only HTTP server over the local catalog. It binds to `127.0.0.1:8787` by default; use `--host` and `--port` to change that. The API never executes installation actions, and responses contain normalized catalog metadata. Upstream file content is returned only for materialized, release-eligible skills.

```bash
node packages/cli/bin/skills-hub.mjs serve --port 8787
curl "http://127.0.0.1:8787/api/skills?q=frontend%20design&agent=codex"
```

## Endpoints

| Route | Response |
| --- | --- |
| `GET /api/health` | `{ status, skills, eligible }` |
| `GET /api/catalog` | Catalog snapshot time, distribution counts, eligible IDs, and bundle names |
| `GET /api/skills` | `{ total, offset, limit, items }` |
| `GET /api/skills/:id` | One skill, including `files` and `skill_md` when it is released; 404 if unknown |
| `GET /api/bundles` | Bundle definitions |
| `GET /api/bundles/:bundle?agent=codex` | Bundle members, optionally filtered by agent compatibility; 404 if unknown |
| `POST /mcp` | MCP JSON-RPC endpoint; see [MCP](MCP.md) |

`/api/skills` accepts `q`, `category`, `distribution`, `license`, `publisher`, `release`, `agent`, `limit` (1–100, default 50), and `offset`. With `q`, items use the same text-match rule and ranking as `skills-hub search`, and `total` counts every match.

Each item has `availability` (`eligible`, `source-direct`, `review-required`, `blocked`, or `catalog-only`) and `install`, which is a CLI command only for eligible skills. Catalog inclusion is not approval.

Requests must use the listening IP (or a loopback alias when listening locally) and port in `Host`. Browser requests must have the matching HTTP origin; other origins, including `null`, receive 403. Cross-origin CORS access is not enabled. Non-browser clients may omit `Origin`. This local server has no authentication and should not be exposed as a public service.

Other methods return 405. MCP posts require `Content-Type: application/json`; unsupported protocol versions, malformed parameters, invalid pagination and malformed URL escapes are rejected. Request bodies on `/mcp` are limited to 1 MiB (413 when exceeded).

Before serving content, the server verifies the bound release review, complete inventory and file hashes. Extra, missing or modified files, unresolved review evidence, paths outside the Hub, and symlinks/junctions anywhere below the Hub root suppress all content for that artifact. Its normalized catalog metadata remains available. The bytes returned are the bytes whose hashes were checked for the request.
