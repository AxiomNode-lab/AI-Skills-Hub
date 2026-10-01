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

function clampInteger(value, fallback, min, max) {
  const parsed=Number(value);
  if(!Number.isInteger(parsed)) return fallback;
  return Math.min(max,Math.max(min,parsed));
}

export function createServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");

    if (req.method !== "GET") return json(res, 405, {error:"method_not_allowed"});

    if (url.pathname === "/api/health") {
      return json(res, 200, {
        status:"ok",
        schema_version:registry.schema_version,
        skills:registry.skills.length
      });
    }

    if (url.pathname === "/api/skills") {
      const q=(url.searchParams.get("q") ?? "").trim().toLowerCase();
      const category=url.searchParams.get("category");
      const distribution=url.searchParams.get("distribution");
      const license=url.searchParams.get("license");
      const publisher=(url.searchParams.get("publisher") ?? "").trim().toLowerCase();
      const release=url.searchParams.get("release");
      const offset=clampInteger(url.searchParams.get("offset"),0,0,Number.MAX_SAFE_INTEGER);
      const limit=clampInteger(url.searchParams.get("limit"),50,1,100);

      let skills=registry.skills.filter((s) => {
        if(q && ![s.id,s.name,s.publisher,...s.category].join(" ").toLowerCase().includes(q)) return false;
        if(category && !s.category.includes(category)) return false;
        if(distribution && s.distribution !== distribution) return false;
        if(license && s.license.spdx !== license) return false;
        if(publisher && !s.publisher.toLowerCase().includes(publisher)) return false;
        if(release && s.release?.status !== release) return false;
        return true;
      }).sort((a,b)=>a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

      const total=skills.length;
      const page=skills.slice(offset,offset+limit);
      const nextOffset=offset+limit<total ? offset+limit : null;

      return json(res,200,{
        total,
        offset,
        limit,
        next_offset:nextOffset,
        skills:page
      });
    }

    if (url.pathname.startsWith("/api/skills/")) {
      const id = decodeURIComponent(url.pathname.slice("/api/skills/".length));
      const found = getSkill(id);
      return found ? json(res,200,found) : json(res,404,{error:"skill_not_found"});
    }

    if (url.pathname === "/api/bundles") return json(res,200,{bundles:Object.fromEntries(
      Object.entries(bundles).map(([name,ids])=>[name,{count:ids.length}])
    )});

    if (url.pathname.startsWith("/api/bundles/")) {
      const name = decodeURIComponent(url.pathname.slice("/api/bundles/".length));
      if (!bundles[name]) return json(res,404,{error:"bundle_not_found"});
      const items = resolveBundle(registry,name);
      const agent = url.searchParams.get("agent");
      const filtered = agent ? filterForAgent(items,agent) : items;
      return json(res,200,{bundle:name,agent:agent??"generic",total:filtered.length,skills:filtered});
    }

    return json(res,404,{error:"not_found"});
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  createServer().listen(PORT, () => {
    console.log("AI Skills Hub API listening on http://localhost:" + PORT);
  });
}
