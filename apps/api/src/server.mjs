import http from "node:http";
import { fileURLToPath } from "node:url";
import { loadRegistry, resolveBundle, filterForAgent } from "../../../packages/core/src/index.mjs";
import { hybridSearch, toInstallChoices } from "../../../packages/discovery/src/index.mjs";
import fs from "node:fs";

const PORT = Number(process.env.PORT ?? 8787);
const registry = loadRegistry();
const bundles = registry.bundles ?? {};
const AGENTS = new Set(["generic","agent-skills","claude-code","codex","cursor","opencode","github-copilot","copilot"]);

function json(res, status, value, headers = {}) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "public, max-age=30",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    ...headers
  });
  res.end(body);
}

function getSkill(id) {
  return registry.skills.find((s) => s.id === id);
}

function clampInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function filterSkills(url) {
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const category = url.searchParams.get("category");
  const distribution = url.searchParams.get("distribution");
  const license = url.searchParams.get("license");
  const publisher = (url.searchParams.get("publisher") ?? "").trim().toLowerCase();
  const release = url.searchParams.get("release");
  const agent = url.searchParams.get("agent");

  let skills = registry.skills.filter((s) => {
    if (q && ![s.id, s.name, s.publisher, ...s.category].join(" ").toLowerCase().includes(q)) return false;
    if (category && !s.category.includes(category)) return false;
    if (distribution && s.distribution !== distribution) return false;
    if (license && s.license.spdx !== license) return false;
    if (publisher && !s.publisher.toLowerCase().includes(publisher)) return false;
    if (release && s.release?.status !== release) return false;
    return true;
  });

  if (agent && AGENTS.has(agent)) skills = filterForAgent(skills, agent);
  return skills.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

export function createServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");

    if (req.method !== "GET") return json(res, 405, { error: "method_not_allowed" }, { allow: "GET" });

    if (url.pathname === "/api/health") {
      return json(res, 200, {
        status: "ok",
        schema_version: registry.schema_version,
        policy_version: registry.policy_version,
        skills: registry.skills.length,
        generated_at: registry.generated_at
      });
    }

    if (url.pathname === "/api/catalog") {
      const distributions = registry.skills.reduce((acc, s) => {
        acc[s.distribution] = (acc[s.distribution] ?? 0) + 1;
        return acc;
      }, {});
      return json(res, 200, {
        schema_version: registry.schema_version,
        generated_at: registry.generated_at,
        total: registry.skills.length,
        distributions,
        bundles: Object.fromEntries(Object.entries(bundles).map(([name, ids]) => [name, ids.length]))
      });
    }

    if (url.pathname === "/api/discover") {
      const query = (url.searchParams.get("q") ?? "").trim();
      const agent = url.searchParams.get("agent") ?? "agent-skills";
      const limit = clampInteger(url.searchParams.get("limit"), 20, 1, 50);
      if (!query) return json(res, 400, { error: "missing_query" });
      const sources = JSON.parse(fs.readFileSync("catalog/sources.json","utf8")).sources;
      try {
        const result = await hybridSearch(registry, query, {
          sources,
          agent,
          limit,
          token: process.env.GITHUB_TOKEN,
          remote: url.searchParams.get("remote") !== "false",
          ai: process.env.AI_DISCOVERY_BASE_URL && process.env.AI_DISCOVERY_MODEL
            ? {
                baseUrl: process.env.AI_DISCOVERY_BASE_URL,
                model: process.env.AI_DISCOVERY_MODEL,
                apiKey: process.env.AI_DISCOVERY_API_KEY
              }
            : undefined
        });
        return json(res, 200, { ...result, choices: toInstallChoices(result, agent) });
      } catch (error) {
        return json(res, 502, { error: "remote_discovery_failed", message: error.message });
      }
    }

    if (url.pathname === "/api/skills") {
      const offset = clampInteger(url.searchParams.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER);
      const limit = clampInteger(url.searchParams.get("limit"), 50, 1, 100);
      const skills = filterSkills(url);
      const total = skills.length;
      const page = skills.slice(offset, offset + limit);
      const nextOffset = offset + limit < total ? offset + limit : null;

      return json(res, 200, { total, offset, limit, next_offset: nextOffset, skills: page });
    }

    if (url.pathname.startsWith("/api/skills/")) {
      const id = decodeURIComponent(url.pathname.slice("/api/skills/".length));
      const found = getSkill(id);
      return found ? json(res, 200, found) : json(res, 404, { error: "skill_not_found" });
    }

    if (url.pathname === "/api/bundles") {
      return json(res, 200, {
        bundles: Object.fromEntries(
          Object.entries(bundles).map(([name, ids]) => [name, { count: ids.length }])
        )
      });
    }

    if (url.pathname.startsWith("/api/bundles/")) {
      const name = decodeURIComponent(url.pathname.slice("/api/bundles/".length));
      if (!bundles[name]) return json(res, 404, { error: "bundle_not_found" });
      const items = resolveBundle(registry, name);
      const agent = url.searchParams.get("agent");
      const filtered = agent && AGENTS.has(agent) ? filterForAgent(items, agent) : items;
      return json(res, 200, {
        bundle: name,
        agent: agent ?? null,
        total: filtered.length,
        skills: filtered
      });
    }

    return json(res, 404, { error: "not_found" });
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  createServer().listen(PORT, () => {
    console.log("AI Skills Hub API listening on http://localhost:" + PORT);
  });
}
