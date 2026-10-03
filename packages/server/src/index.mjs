import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import readline from "node:readline";
import {
  catalogAvailability,
  filterForAgent,
  hubHome,
  loadRegistry,
  resolveBundle,
  resolveHubPath,
  summarize
} from "@ai-skills-hub/core";
import { searchRegistry } from "@ai-skills-hub/discovery";
import { sha256, verifyReviewedDirectory } from "../../materializer/src/reviewed.mjs";

export const SERVER_INFO = { name: "ai-skills-hub", version: "0.2.0" };
const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const RESOURCE_PREFIX = "skillshub://skills/";
const MAX_BODY_BYTES = 1024 * 1024;
const MAX_LIMIT = 100;

const isEligible = (skill) => catalogAvailability(skill).status === "eligible";

function installCommand(skill, agent = "<agent>") {
  return isEligible(skill) ? `skills-hub install ${skill.id} --agent ${agent}` : null;
}

// Normalized catalog metadata only: upstream content is served solely for released skills.
export function skillSummary(skill) {
  return {
    id: skill.id,
    name: skill.name,
    publisher: skill.publisher ?? null,
    description: skill.description ?? null,
    category: skill.category ?? [],
    tags: skill.tags ?? [],
    compatibility: skill.compatibility ?? [],
    distribution: skill.distribution,
    availability: catalogAvailability(skill),
    license: {
      spdx: skill.license?.spdx ?? null,
      status: skill.license?.status ?? null,
      redistributable: skill.license?.redistributable === true
    },
    security: { risk: skill.security?.risk ?? "unknown", scan_status: skill.security?.scan_status ?? "unknown" },
    release: { status: skill.release?.status ?? "unknown", reasons: skill.release?.reasons ?? [] },
    source: {
      repo: skill.source?.repo ?? null,
      revision: skill.source?.revision ?? null,
      url: skill.source?.url ?? null
    },
    install: installCommand(skill)
  };
}

function checkedHubPath(value) {
  const home = hubHome();
  const full = resolveHubPath(value);
  const relative = path.relative(home, full);
  if (!relative || relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) throw new Error("Path outside Hub");
  let current = home;
  for (const part of relative.split(path.sep)) {
    current = path.join(current, part);
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error("Symlinks are forbidden");
  }
  return full;
}

// Fail closed and return the exact bytes verified during this request. Catalog
// eligibility alone is not authorization to expose arbitrary local files.
function verifiedContents(skill) {
  if (!isEligible(skill) || !skill.materialized_root || !/^[a-z0-9._-]+\/[a-z0-9-]+$/.test(skill.id)) return new Map();
  if (skill.license?.status !== "verified" || skill.license.redistributable !== true || skill.security?.scan_status !== "verified" || skill.security.risk === "high") return new Map();
  try {
    const root = checkedHubPath(skill.materialized_root);
    const manifest = JSON.parse(fs.readFileSync(checkedHubPath(`catalog/materialized-manifests/${skill.id.replaceAll("/", "__")}.json`)));
    if (manifest.skill_id !== skill.id || manifest.source.repo !== skill.source.repo || manifest.source.revision !== skill.source.revision || manifest.source.path !== skill.source.path || manifest.review?.path !== skill.license.evidence) throw new Error("Release manifest mismatch");
    const reviewBytes = fs.readFileSync(checkedHubPath(manifest.review.path));
    if (sha256(reviewBytes) !== manifest.review.sha256) throw new Error("Release review mismatch");
    const review = JSON.parse(reviewBytes);
    verifyReviewedDirectory(skill, review, root);
    const contents = new Map();
    for (const file of review.files) {
      const bytes = fs.readFileSync(checkedHubPath(path.join(root, file.path)));
      if (sha256(bytes) !== file.sha256 || bytes.length !== file.bytes) throw new Error("Released file changed");
      contents.set(file.path, new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    }
    return contents;
  } catch {
    return new Map();
  }
}

export const skillFiles = skill => [...verifiedContents(skill).keys()].sort();
const readSkillFile = (skill, relative) => verifiedContents(skill).get(relative) ?? null;
const mimeType = (file) => (file.endsWith(".md") ? "text/markdown" : "text/plain");

export function createCatalog(registry = loadRegistry()) {
  const byId = new Map(registry.skills.map((skill) => [skill.id, skill]));

  function search({ query = "", agent, limit = 20, installable_only = false } = {}) {
    const max = Math.min(MAX_LIMIT, Math.max(1, Number(limit) || 20));
    const pool = installable_only ? { ...registry, skills: registry.skills.filter(isEligible) } : registry;
    return searchRegistry(pool, query, { agent: agent || undefined, limit: max }).map(({ item }) => skillSummary(item));
  }

  function detail(id, { agent } = {}) {
    const skill = byId.get(id);
    if (!skill) return null;
    const contents = verifiedContents(skill);
    const files = [...contents.keys()].sort();
    return {
      ...skillSummary(skill),
      install: installCommand(skill, agent),
      dependencies: skill.dependencies ?? [],
      files: files.map((file) => ({ path: file, uri: RESOURCE_PREFIX + skill.id + "/" + file })),
      skill_md: contents.get("SKILL.md") ?? null
    };
  }

  function list(params = {}) {
    const has = (values, wanted) => !wanted || (values ?? []).map(String).includes(wanted);
    let items = params.agent ? filterForAgent(registry.skills, params.agent) : registry.skills;
    if (params.q) {
      // Relevance order from the shared search ranking.
      items = searchRegistry({ skills: items }, params.q, { agent: params.agent, limit: Infinity }).map(({ item }) => item);
    }
    items = items.filter((skill) =>
      has(skill.category, params.category)
      && (!params.distribution || skill.distribution === params.distribution)
      && (!params.license || skill.license?.spdx === params.license)
      && (!params.publisher || skill.publisher === params.publisher)
      && (!params.release || skill.release?.status === params.release));
    const offset = Math.max(0, Number(params.offset) || 0);
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(params.limit) || 50));
    return { total: items.length, offset, limit, items: items.slice(offset, offset + limit).map(skillSummary) };
  }

  function resources() {
    return registry.skills.filter(isEligible).flatMap((skill) => skillFiles(skill).map((file) => ({
      uri: RESOURCE_PREFIX + skill.id + "/" + file,
      name: `${skill.id}/${file}`,
      title: `${skill.name}: ${file}`,
      mimeType: mimeType(file)
    })));
  }

  function readResource(uri) {
    if (typeof uri !== "string" || !uri.startsWith(RESOURCE_PREFIX)) return null;
    const rest = uri.slice(RESOURCE_PREFIX.length);
    for (const skill of registry.skills.filter(isEligible)) {
      if (!rest.startsWith(skill.id + "/")) continue;
      const file = rest.slice(skill.id.length + 1);
      const text = readSkillFile(skill, file);
      if (text !== null) return { uri, mimeType: mimeType(file), text };
    }
    return null;
  }

  return { registry, byId, search, detail, list, resources, readResource };
}

const TOOLS = [
  {
    name: "search_skills",
    title: "Search AI Skills Hub",
    description: "Search the AI Skills Hub catalog of Agent Skills by keyword or intent. Results include license, security, and release state; only skills with availability 'eligible' can be installed locally.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Keywords or a phrase, e.g. 'frontend design' or 'pdf'." },
        agent: { type: "string", description: "Only return skills compatible with this agent, e.g. codex or claude-code." },
        installable_only: { type: "boolean", description: "Only return released skills that can be installed now." },
        limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT }
      },
      required: ["query"]
    }
  },
  {
    name: "get_skill",
    title: "Get skill details",
    description: "Get catalog metadata for one skill ID. For released skills this also returns SKILL.md and the file list, readable as MCP resources.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Skill ID such as anthropics/frontend-design." },
        agent: { type: "string", description: "Agent to use in the returned install command." }
      },
      required: ["id"]
    }
  }
];

const toolResult = (data, isError = false) => ({
  content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  structuredContent: Array.isArray(data) ? { items: data } : data,
  ...(isError ? { isError: true } : {})
});

function rpcError(id, code, message) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

// Handles one JSON-RPC message; returns null for notifications.
export function handleMcpMessage(catalog, message) {
  if (!message || Array.isArray(message) || message.jsonrpc !== "2.0" || typeof message.method !== "string" || (message.id !== undefined && typeof message.id !== "string" && !(typeof message.id === "number" && Number.isFinite(message.id)))) {
    return rpcError(message?.id, -32600, "Invalid Request");
  }
  const { id, method, params = {} } = message;
  if (!params || typeof params !== "object" || Array.isArray(params)) return rpcError(id, -32602, "params must be an object");
  if (id === undefined || id === null) return null;
  const ok = (result) => ({ jsonrpc: "2.0", id, result });

  switch (method) {
    case "initialize": {
      const requested = params.protocolVersion;
      return ok({
        protocolVersion: PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false }, resources: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: "Search the AI Skills Hub catalog with search_skills, inspect one with get_skill, and read released skill files as resources. Catalog inclusion is not approval: only 'eligible' skills are released for local installation."
      });
    }
    case "ping":
      return ok({});
    case "tools/list":
      return ok({ tools: TOOLS });
    case "tools/call": {
      const args = params.arguments ?? {};
      if (!args || typeof args !== "object" || Array.isArray(args)) return rpcError(id, -32602, "arguments must be an object");
      if (args.agent !== undefined && (typeof args.agent !== "string" || !/^[a-z0-9-]+$/.test(args.agent))) return ok(toolResult({ error: "agent must be an identifier" }, true));
      if (params.name === "search_skills") {
        if (typeof args.query !== "string") return ok(toolResult({ error: "query must be a string" }, true));
        if (args.limit !== undefined && (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > MAX_LIMIT)) return ok(toolResult({ error: "limit must be an integer from 1 to 100" }, true));
        if (args.installable_only !== undefined && typeof args.installable_only !== "boolean") return ok(toolResult({ error: "installable_only must be a boolean" }, true));
        return ok(toolResult(catalog.search(args)));
      }
      if (params.name === "get_skill") {
        const skill = typeof args.id === "string" ? catalog.detail(args.id, args) : null;
        return ok(skill ? toolResult(skill) : toolResult({ error: `Unknown skill: ${args.id}` }, true));
      }
      return rpcError(id, -32602, `Unknown tool: ${params.name}`);
    }
    case "resources/list":
      return ok({ resources: catalog.resources() });
    case "resources/templates/list":
      return ok({ resourceTemplates: [] });
    case "resources/read": {
      const content = catalog.readResource(params.uri);
      return content ? ok({ contents: [content] }) : rpcError(id, -32002, "Resource not found");
    }
    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

function sendJson(res, status, body, extraHeaders = {}) {
  const payload = body === undefined ? "" : JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "x-content-type-options": "nosniff",
    ...extraHeaders
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let oversized = false;
    req.on("data", (chunk) => {
      if (oversized) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        oversized = true;
        chunks.length = 0;
        reject(Object.assign(new Error("Request body too large"), { status: 413 }));
      } else chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function handleApi(catalog, url, res) {
  const params = Object.fromEntries(url.searchParams);
  for (const [key, min, max] of [["limit", 1, MAX_LIMIT], ["offset", 0, Number.MAX_SAFE_INTEGER]]) {
    if (params[key] !== undefined && (!/^\d+$/.test(params[key]) || !Number.isSafeInteger(Number(params[key])) || Number(params[key]) < min || Number(params[key]) > max)) return sendJson(res, 400, { error: `invalid_${key}` });
  }
  if (params.agent !== undefined && !/^[a-z0-9-]+$/.test(params.agent)) return sendJson(res, 400, { error: "invalid_agent" });
  const route = url.pathname.replace(/\/+$/, "") || "/";
  if (route === "/api/health") {
    return sendJson(res, 200, { status: "ok", skills: catalog.registry.skills.length, eligible: catalog.registry.skills.filter(isEligible).length });
  }
  if (route === "/api/catalog") {
    return sendJson(res, 200, {
      generated_at: catalog.registry.generated_at ?? null,
      summary: summarize(catalog.registry.skills),
      eligible: catalog.registry.skills.filter(isEligible).map((skill) => skill.id),
      bundles: Object.keys(catalog.registry.bundles ?? {})
    });
  }
  if (route === "/api/skills") return sendJson(res, 200, catalog.list(params));
  if (route.startsWith("/api/skills/")) {
    const skill = catalog.detail(decodeURIComponent(route.slice("/api/skills/".length)), params);
    return skill ? sendJson(res, 200, skill) : sendJson(res, 404, { error: "skill_not_found" });
  }
  if (route === "/api/bundles") return sendJson(res, 200, { bundles: catalog.registry.bundles ?? {} });
  if (route.startsWith("/api/bundles/")) {
    const name = decodeURIComponent(route.slice("/api/bundles/".length));
    if (!Object.hasOwn(catalog.registry.bundles ?? {}, name)) return sendJson(res, 404, { error: "bundle_not_found" });
    const skills = resolveBundle(catalog.registry, name);
    const items = params.agent ? filterForAgent(skills, params.agent) : skills;
    return sendJson(res, 200, { bundle: name, agent: params.agent ?? null, items: items.map(skillSummary) });
  }
  return sendJson(res, 404, { error: "not_found" });
}

export function createHubServer({ registry } = {}) {
  const catalog = createCatalog(registry);
  return http.createServer(async (req, res) => {
    try {
      const address = req.socket.localAddress;
      const host = address?.includes(":") ? `[${address}]` : address;
      const authorities = new Set([`${host}:${req.socket.localPort}`]);
      if (["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address)) {
        for (const name of ["localhost", "127.0.0.1", "[::1]"]) authorities.add(`${name}:${req.socket.localPort}`);
      }
      if (!authorities.has(req.headers.host)) return sendJson(res, 403, { error: "untrusted_host" });
      if (req.headers.origin !== undefined && ![...authorities].some(authority => req.headers.origin === `http://${authority}`)) return sendJson(res, 403, { error: "untrusted_origin" });
      const url = new URL(req.url, "http://localhost");
      if (req.method === "OPTIONS") {
        return sendJson(res, 204, undefined, {
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "content-type, mcp-protocol-version, accept"
        });
      }
      if (url.pathname === "/mcp") {
        if (req.method !== "POST") return sendJson(res, 405, { error: "method_not_allowed" }, { allow: "POST" });
        if (req.headers["mcp-protocol-version"] && !PROTOCOL_VERSIONS.includes(req.headers["mcp-protocol-version"])) return sendJson(res, 400, { error: "unsupported_protocol_version" });
        if (req.headers["content-type"]?.split(";")[0].trim().toLowerCase() !== "application/json") return sendJson(res, 415, { error: "unsupported_media_type" });
        let message;
        try {
          message = JSON.parse(await readBody(req));
        } catch (error) {
          if (error.status) return sendJson(res, error.status, { error: error.message });
          return sendJson(res, 400, rpcError(null, -32700, "Parse error"));
        }
        if (Array.isArray(message)) return sendJson(res, 400, rpcError(null, -32600, "Batch requests are not supported"));
        const response = handleMcpMessage(catalog, message);
        return response ? sendJson(res, 200, response) : sendJson(res, 202, undefined);
      }
      if (req.method !== "GET" && req.method !== "HEAD") {
        return sendJson(res, 405, { error: "method_not_allowed" }, { allow: "GET, HEAD" });
      }
      return handleApi(catalog, url, res);
    } catch (error) {
      return sendJson(res, error instanceof URIError ? 400 : 500, { error: error instanceof URIError ? "invalid_path_encoding" : "internal_error" });
    }
  });
}

// MCP stdio transport: one JSON-RPC message per line on stdin and stdout.
export function runStdioServer({ registry, input = process.stdin, output = process.stdout } = {}) {
  const catalog = createCatalog(registry);
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  lines.on("line", (line) => {
    if (!line.trim()) return;
    let response;
    try {
      response = handleMcpMessage(catalog, JSON.parse(line));
    } catch {
      response = rpcError(null, -32700, "Parse error");
    }
    if (response) output.write(JSON.stringify(response) + "\n");
  });
  return new Promise((resolve) => lines.on("close", resolve));
}
