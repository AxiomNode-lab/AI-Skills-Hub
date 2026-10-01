# MCP Server

AI Skills Hub exposes only **materialized, release-eligible Skills** over MCP.

Endpoint: `POST /mcp`

Implemented extension methods:
- `skills/list`
- `skills/get`
- `resources/read`
- `resources/directory/read`

The server advertises `io.modelcontextprotocol/skills` and verifies that the served set is materialized in the local registry. Non-redistributable/source-direct Skills are never exposed by this server.

See the MCP Skills Extension specification for the wire contract.
