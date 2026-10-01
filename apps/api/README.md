# Registry API

Run from the repository root:

~~~bash
node apps/api/src/server.mjs
~~~

Endpoints:

- GET /api/health
- GET /api/skills?q=frontend&limit=50&offset=0
- GET /api/skills/:id
- GET /api/bundles
- GET /api/bundles/:bundle?agent=codex

Skill listing filters:
- q
- category
- distribution
- license
- publisher
- release
- limit (1-100)
- offset

The API returns total, offset, limit, and next_offset for paginated skill listings.
