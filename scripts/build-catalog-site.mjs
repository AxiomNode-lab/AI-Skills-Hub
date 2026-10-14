#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
function option(name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error(name + " needs a value");
  return args[index + 1];
}
function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function safeHttps(value) {
  try {
    const url = new URL(String(value ?? ""));
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
function slugFor(id) {
  const readable = String(id).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "skill";
  const hash = crypto.createHash("sha256").update(String(id)).digest("hex").slice(0, 10);
  return readable + "-" + hash;
}
function eligible(skill) {
  return skill?.distribution === "bundled" && skill?.materialized === true && skill?.release?.status === "eligible";
}
function textFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
const outDir = path.resolve(option("--out", path.join(ROOT, "site-dist")));
const sourceDir = path.join(ROOT, "site");
if (outDir === ROOT || outDir === sourceDir || outDir.startsWith(sourceDir + path.sep)) {
  throw new Error("Output directory must not overwrite the repository root or site source files.");
}
const raw = JSON.parse(fs.readFileSync(path.join(ROOT, "catalog/skills.json"), "utf8"));
const agentRegistry = JSON.parse(fs.readFileSync(path.join(ROOT, "catalog/agents.json"), "utf8"));
const baseUrl = option("--base-url", "https://axiomnode-lab.github.io/AI-Skills-Hub/").replace(/\/?$/, "/");
const date = new Date().toISOString().slice(0, 10);
const publishedAgents = (agentRegistry.agents ?? []).map(agent => ({ id: agent.id, name: agent.displayName || agent.id }));
const allIds = new Set();
const skills = raw.skills.map(skill => {
  if (!skill?.id || allIds.has(skill.id)) throw new Error("Missing or duplicate catalog skill ID: " + (skill?.id ?? "<empty>"));
  allIds.add(skill.id);
  const pageSlug = eligible(skill) ? slugFor(skill.id) : null;
  const sourceUrl = safeHttps(skill.source?.url);
  return {
    id: skill.id,
    name: skill.name || skill.id,
    publisher: skill.publisher || (skill.source?.repo || "").split("/")[0] || "Unknown",
    description: typeof skill.description === "string" ? skill.description : "",
    category: Array.isArray(skill.category) ? skill.category.filter(x => typeof x === "string") : [],
    tags: Array.isArray(skill.tags) ? skill.tags.filter(x => typeof x === "string") : [],
    compatibility: Array.isArray(skill.compatibility) ? skill.compatibility.filter(x => typeof x === "string") : [],
    distribution: skill.distribution || "catalog-only",
    materialized: skill.materialized === true,
    releaseStatus: skill.release?.status || "unknown",
    releaseReasons: Array.isArray(skill.release?.reasons) ? skill.release.reasons.filter(x => typeof x === "string") : [],
    license: {
      spdx: skill.license?.spdx || "NOASSERTION",
      status: skill.license?.status || "unknown",
      redistributable: skill.license?.redistributable === true
    },
    security: {
      scanStatus: skill.security?.scan_status || "unknown",
      risk: skill.security?.risk || "unknown"
    },
    source: {
      repo: skill.source?.repo || "",
      path: skill.source?.path || "",
      revision: skill.source?.revision || "",
      url: sourceUrl
    },
    pageUrl: pageSlug ? "./skills/" + pageSlug + ".html" : null
  };
});
const releases = skills.filter(item => item.releaseStatus === "eligible" && item.materialized && item.distribution === "bundled");
const catalogPayload = {
  schemaVersion: 1,
  generatedAt: date,
  total: skills.length,
  eligibleCount: releases.length,
  agents: publishedAgents,
  skills
};
textFile(path.join(outDir, "index.html"), fs.readFileSync(path.join(sourceDir, "index.html"), "utf8"));
fs.mkdirSync(path.join(outDir, "assets"), { recursive: true });
for (const asset of ["app.js", "detail.js", "styles.css"]) {
  const source = path.join(sourceDir, "assets", asset);
  if (fs.existsSync(source)) fs.copyFileSync(source, path.join(outDir, "assets", asset));
}
textFile(path.join(outDir, "catalog.json"), JSON.stringify(catalogPayload));
const sitemapEntries = [baseUrl, ...releases.map(item => baseUrl + "skills/" + item.pageUrl.slice("./skills/".length))];
for (const item of releases) {
  const detail = [
    "<!doctype html>",
    '<html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="color-scheme" content="light">',
    "<title>" + escapeHtml(item.name) + " — AI Skills Hub</title>",
    '<meta name="description" content="' + escapeHtml(item.description.slice(0, 155)) + '">',
    '<meta property="og:type" content="article">',
    '<meta property="og:title" content="' + escapeHtml(item.name) + ' — AI Skills Hub">',
    '<meta property="og:description" content="' + escapeHtml(item.description.slice(0, 200)) + '">',
    '<meta property="og:url" content="' + escapeHtml(baseUrl + "skills/" + item.pageUrl.slice("./skills/".length)) + '">',
    '<link rel="canonical" href="' + escapeHtml(baseUrl + "skills/" + item.pageUrl.slice("./skills/".length)) + '">',
    '<link rel="stylesheet" href="../assets/styles.css">',
    '<script src="../assets/detail.js" defer></script>',
    '<script type="application/ld+json">' + JSON.stringify({
      "@context": "https://schema.org",
      "@type": "SoftwareSourceCode",
      "name": item.name,
      "description": item.description.slice(0, 500),
      "codeRepository": item.source.url || (item.source.repo ? "https://github.com/" + item.source.repo : "https://github.com/AxiomNode-lab/AI-Skills-Hub"),
      "license": item.license.spdx
    }).replaceAll("<", "\\u003c") + "</script>",
    "</head><body>",
    '<a class="skip-link" href="#skill-details">Skip to details</a>',
    '<header class="topbar"><a class="brand" href="../"><span class="brand-mark" aria-hidden="true">H</span><span>AI Skills <strong>Hub</strong></span></a><nav aria-label="Main navigation"><a href="../">Search catalog</a><a href="https://github.com/AxiomNode-lab/AI-Skills-Hub">GitHub ↗</a></nav></header>',
    '<main class="detail-main" id="skill-details">',
    '<p class="eyebrow">RELEASE-ELIGIBLE CATALOG ENTRY</p>',
    '<p class="breadcrumbs"><a href="../">Catalog</a> / ' + escapeHtml(item.publisher) + ' / ' + escapeHtml(item.name) + '</p>',
    "<h1>" + escapeHtml(item.name) + "</h1>",
    '<p class="detail-id">' + escapeHtml(item.id) + '</p>',
    '<p class="detail-description">' + escapeHtml(item.description || "No description has been published for this skill.") + '</p>',
    '<div class="detail-metadata">',
    '<div><span>Publisher</span><strong>' + escapeHtml(item.publisher) + '</strong></div>',
    '<div><span>License record</span><strong>' + escapeHtml(item.license.spdx) + ' · ' + escapeHtml(item.license.status) + '</strong></div>',
    '<div><span>Release state</span><strong>Eligible for installation</strong></div>',
    '<div><span>Recorded scan status</span><strong>' + escapeHtml(item.security.scanStatus) + ' · risk label: ' + escapeHtml(item.security.risk) + '</strong></div>',
    "</div>",
    '<section class="detail-panel"><h2>Install from a source checkout</h2>',
    '<p>The npm package is not assumed to be available here. Until it is published, run this from the root of an AI Skills Hub checkout after installing the workspace dependencies.</p>',
    '<pre><code>pnpm cli install ' + escapeHtml(item.id) + ' --agent codex</code></pre>',
    '<button class="button button-primary copy-command" type="button" data-copy="pnpm cli install ' + escapeHtml(item.id) + ' --agent codex">Copy install command</button>',
    '<p class="small-note">Requires Node.js 22+ and a local checkout. Change <code>codex</code> to your supported agent ID.</p>',
    "</section>",
    '<section class="detail-panel"><h2>Provenance</h2>',
    '<p>Review the upstream source and the exact revision recorded by the catalog. A public source repository does not by itself grant redistribution permission.</p>',
    (item.source.url ? '<p><a class="text-link" href="' + escapeHtml(item.source.url) + '">Open upstream source ↗</a></p>' : ""),
    '<dl class="provenance-list"><dt>Repository</dt><dd>' + escapeHtml(item.source.repo || "Not recorded") + '</dd><dt>Path</dt><dd>' + escapeHtml(item.source.path || "Not recorded") + '</dd><dt>Revision</dt><dd><code>' + escapeHtml(item.source.revision || "Not recorded") + '</code></dd></dl>',
    '<p class="small-note">“Eligible” reflects the catalog release checks; it is not a security certification or a task-performance benchmark.</p>',
    "</section>",
    '<div class="detail-actions"><a class="button button-secondary" href="../">Back to catalog</a><a class="button button-primary" href="https://github.com/AxiomNode-lab/AI-Skills-Hub">Star or fork the project ↗</a></div>',
    "</main>",
    '<footer class="footer"><a class="brand" href="../"><span class="brand-mark" aria-hidden="true">H</span><span>AI Skills <strong>Hub</strong></span></a><p><a href="https://github.com/AxiomNode-lab/AI-Skills-Hub/blob/main/docs/LICENSE-POLICY.md">License policy</a> · <a href="https://github.com/AxiomNode-lab/AI-Skills-Hub/blob/main/SECURITY.md">Security policy</a></p></footer>',
    "</body></html>"
  ].join("\n");
  textFile(path.join(outDir, "skills", item.pageUrl.slice("./skills/".length)), detail);
}
const urlsXml = sitemapEntries.map(url => "<url><loc>" + escapeHtml(url) + "</loc><lastmod>" + date + "</lastmod></url>").join("");
textFile(path.join(outDir, "sitemap.xml"), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urlsXml + "</urlset>\n");
textFile(path.join(outDir, "robots.txt"), "User-agent: *\nAllow: /\nSitemap: " + baseUrl + "sitemap.xml\n");
textFile(path.join(outDir, "404.html"), '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not found — AI Skills Hub</title><link rel="stylesheet" href="./assets/styles.css"><main class="detail-main"><p class="eyebrow">404 · NOT FOUND</p><h1>This catalog page moved or does not exist.</h1><p class="detail-description">Search the current catalog or open the source repository.</p><div class="detail-actions"><a class="button button-primary" href="./">Search catalog</a><a class="button button-secondary" href="https://github.com/AxiomNode-lab/AI-Skills-Hub">GitHub repository</a></div></main></html>');
textFile(path.join(outDir, "build-info.json"), JSON.stringify({ generatedAt: date, indexedSkills: skills.length, eligibleSkills: releases.length, detailPages: releases.length, baseUrl }, null, 2) + "\n");
console.log("Built AI Skills Hub site:", skills.length, "catalog records;", releases.length, "eligible detail pages;", outDir);
