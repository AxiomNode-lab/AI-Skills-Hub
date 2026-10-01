# Registry API

Base path: /api

## Endpoints

- GET /api/health
- GET /api/catalog
- GET /api/skills
- GET /api/skills/:id
- GET /api/bundles
- GET /api/bundles/:bundle?agent=codex

Skill listing supports q, category, distribution, license, publisher, release, agent, limit, and offset.
The API is read-only and does not execute installation actions.
