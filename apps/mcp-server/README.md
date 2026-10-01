# MCP Skills Server

The server exposes only materialized Skills from the local registry.

It implements the MCP Skills extension surface:
- skills/list
- skills/get
- resources/read

Start from the repository root:

node apps/mcp-server/src/server.mjs

The implementation intentionally does not advertise or serve review-required/source-direct Skills as local MCP resources.
