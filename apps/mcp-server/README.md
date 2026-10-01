# MCP Skills Server

This server exposes materialized, release-eligible Skills using the MCP Skills extension.

Implemented methods:
- skills/list with cursor pagination and complete resource manifests
- skills/get with complete skill entries and cache hints
- resources/read for individual skill files

The server advertises io.modelcontextprotocol/skills with directoryRead=false.

Start from the repository root:

node apps/mcp-server/src/server.mjs

Only Skills that are materialized and marked release-eligible are served.
