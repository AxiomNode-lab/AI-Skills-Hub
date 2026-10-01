# Registry Web

The static discovery UI expects the Registry API at `http://localhost:8787`.

Run:

```bash
node apps/api/src/server.mjs
python3 -m http.server 4173 -d apps/web/public
```

For another API origin, set `window.AI_SKILLS_API_URL` before loading `app.js`.
