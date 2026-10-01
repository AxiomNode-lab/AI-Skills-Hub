import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { loadRegistry, resolveBundle, filterForAgent } from "../../../packages/core/src/index.mjs";

const PORT = Number(process.env.PORT ?? 8787);
const registry = loadRegistry();
const bundles = registry.bundles ?? {};

function json(res, status, value) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*"
  });
  res.end(JSON.stringify(value));
}

function getSkill(id) {
  return registry.skills.find((s) => s.id === id);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (req.method !== "GET") return json(res, 405, {error:"method_not_allowed"});
  if (url.pathname === "/api/health") {
    return json(res, 200, {status:"ok", schema_version:registry.schema_version, skills:registry.skills.length});
  }

  if (url.pathname === "/api/skills") {
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    const category = url.searchParams.get("category");
    let skills = registry.skills.filter((s) =>
      !q || [s.id,s.name,s.publisher,...s.category].join(" ").toLowerCase().includes(q)
    );
    if (category) skills = skills.filter((s) => s.category.includes(category));
    return json(res, 200, {total:skills.length,skills});
  }

  if (url.pathname.startsWith("/api/skills/")) {
    const id = decodeURIComponent(url.pathname.slice("/api/skills/".length));
    const found = getSkill(id);
    return found ? json(res,200,found) : json(res,404,{error:"skill_not_found"});
  }

  if (url.pathname === "/api/bundles") return json(res,200,{bundles});

  if (url.pathname.startsWith("/api/bundles/")) {
    const name = decodeURIComponent(url.pathname.slice("/api/bundles/".length));
    if (!bundles[name]) return json(res,404,{error:"bundle_not_found"});
    const items = resolveBundle(registry,name);
    const agent = url.searchParams.get("agent");
    const filtered = agent ? filterForAgent(items,agent) : items;
    return json(res,200,{bundle:name,agent:agent??"generic",skills:filtered});
  }

  return json(res,404,{error:"not_found"});
});

server.listen(PORT, () => console.log("AI Skills Hub API listening on http://localhost:" + PORT));
