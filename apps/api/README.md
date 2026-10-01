# Registry API

Run from the repository root:

```bash
node apps/api/src/server.mjs
```

Endpoints:
- `GET /api/health`
- `GET /api/skills?q=frontend`
- `GET /api/skills/:id`
- `GET /api/bundles`
- `GET /api/bundles/:bundle?agent=codex`

The API reads the normalized registry directly from `catalog/`.
