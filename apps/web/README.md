# Registry Web

The web client uses the same-origin /api endpoint by default.

Local development:

~~~bash
node apps/api/src/server.mjs
node apps/web/dev-server.mjs
~~~

Docker development:

~~~bash
docker compose up --build
~~~

A custom API origin can be supplied through window.AI_SKILLS_API_URL before app.js executes.
