#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import { scanText, riskLevel } from "../packages/security/src/index.mjs";
import { classifyLicense, normalizeLicense } from "../packages/licenses/src/index.mjs";
import { parseFrontmatter } from "../packages/core/src/index.mjs";

import { execFileSync } from "node:child_process";

const argv = process.argv.slice(2);
const checkoutIndex = argv.indexOf("--checkout");
// --checkout <dir>: read the tree and files from a local clone at its HEAD commit
// instead of the GitHub API (for environments where the API is unavailable).
const checkout = checkoutIndex === -1 ? null : argv.splice(checkoutIndex, 2)[1];
const [repo, ref = "main"] = argv;
if (!repo || (checkoutIndex !== -1 && !checkout)) {
  console.error("Usage: node scripts/ingest-github.mjs <owner/repo> [ref] [--checkout <clone-dir>]");
  process.exit(1);
}
const git = (...args) => execFileSync("git", ["-C", checkout, ...args], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

const token = process.env.GITHUB_TOKEN;
const baseHeaders = {
  accept: "application/vnd.github+json",
  "user-agent": "AI-Skills-Hub-ingestor/0.2"
};
if (token) baseHeaders.authorization = "Bearer " + token;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, init = {}, { attempts = 4 } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      if (![403, 429, 500, 502, 503, 504].includes(res.status) || attempt === attempts - 1) {
        return res;
      }
      const retryAfter = Number(res.headers.get("retry-after"));
      const reset = Number(res.headers.get("x-ratelimit-reset"));
      const resetDelay = Number.isFinite(reset) && reset > 0
        ? Math.max(0, reset * 1000 - Date.now())
        : 0;
      const backoff = Math.min(30_000, 1_000 * 2 ** attempt);
      await delay(Math.max(Number.isFinite(retryAfter) ? retryAfter * 1000 : 0, resetDelay, backoff));
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) throw error;
      await delay(Math.min(30_000, 1_000 * 2 ** attempt));
    }
  }
  throw lastError ?? new Error("request failed");
}

const api = async (url) => {
  const res = await fetchWithRetry(url, { headers: baseHeaders });
  if (!res.ok) {
    throw new Error("GitHub API " + res.status + ": " + (await res.text()).slice(0, 500));
  }
  return res.json();
};

const raw = async (filePath) => {
  if (checkout) {
    try {
      return git("show", `${revision}:${filePath}`);
    } catch {
      return null;
    }
  }
  const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
  const url = "https://raw.githubusercontent.com/" + repo + "/" + revision + "/" + encodedPath;
  const res = await fetchWithRetry(url, { headers: { "user-agent": baseHeaders["user-agent"], ...(token ? {authorization:"Bearer "+token} : {}) } });
  if (!res.ok) return null;
  return res.text();
};

let revision;
let tree;
if (checkout) {
  revision = git("rev-parse", "HEAD").trim();
  const origin = git("remote", "get-url", "origin").trim().replace(/\.git$/, "");
  if (!origin.toLowerCase().endsWith("/" + repo.toLowerCase())) throw new Error(`Checkout origin ${origin} is not ${repo}`);
  tree = {
    sha: git("rev-parse", "HEAD^{tree}").trim(),
    truncated: false,
    tree: git("ls-tree", "-r", "--full-tree", revision).split("\n").filter(Boolean).map((line) => {
      const [meta, file] = line.split("\t");
      const [mode, type] = meta.split(" ");
      return { path: file, mode, type };
    })
  };
} else {
  const commitList = await api("https://api.github.com/repos/" + repo + "/commits?sha=" + encodeURIComponent(ref) + "&per_page=1");
  revision = commitList[0]?.sha;
  if (!revision) throw new Error("Unable to resolve ref to an immutable commit.");
  tree = await api("https://api.github.com/repos/" + repo + "/git/trees/" + revision + "?recursive=1");
}
if (tree.truncated) {
  console.error("GitHub returned a truncated tree; refuse unsafe partial ingestion.");
  process.exit(2);
}

const skillPaths = tree.tree
  .filter((item) => item.type === "blob" && /(^|\/)SKILL\.md$/i.test(item.path))
  .map((item) => item.path);

const licenseFiles = tree.tree
  .filter((item) => item.type === "blob")
  .map((item) => item.path)
  .filter((p) => /(^|\/)(LICENSE|COPYING|NOTICE)(\.|$)/i.test(p))
  .slice(0, 30);

const licenses = [];
for (const file of licenseFiles) {
  const body = await raw(file);
  if (!body) continue;
  licenses.push({
    path: file,
    sha256: crypto.createHash("sha256").update(body).digest("hex"),
    preview: body.slice(0, 200).replace(/\s+/g, " ").trim()
  });
}

const result = {
  schema_version: "0.2",
  source: { repo, ref, revision, revision_type: "git-commit", tree_sha: tree.sha },
  discovered_skills: [],
  license_files: licenses,
  warnings: []
};

const licenseBodyCache = new Map();
async function licenseEvidenceFor(skillPath, declaredLicense, skillTextPath) {
  if (declaredLicense) {
    const declared = classifyLicense(normalizeLicense(declaredLicense));
    if (declared.spdx !== "NOASSERTION") {
      return { ...declared, evidence_type: "skill-frontmatter", evidence_path: skillTextPath };
    }
  }

  const parts = skillPath.split("/");
  parts.pop();
  const candidates = [];
  for (let i = parts.length; i >= 0; i--) {
    const prefix = parts.slice(0, i).join("/");
    for (const file of licenseFiles) {
      const dir = file.includes("/") ? file.slice(0, file.lastIndexOf("/")) : "";
      if (dir === prefix) candidates.push(file);
    }
  }
  const selected = candidates[0] ?? licenseFiles.find((p) => !p.includes("/"));
  if (!selected) return { spdx: "NOASSERTION", redistributable: false, status: "review-required" };
  if (!licenseBodyCache.has(selected)) licenseBodyCache.set(selected, await raw(selected));
  const body = licenseBodyCache.get(selected);
  const first = body?.slice(0, 2000) ?? "";
  let detected = "NOASSERTION";
  if (/Apache License.*Version 2\.0/i.test(first)) detected = "Apache-2.0";
  else if (/MIT License/i.test(first)) detected = "MIT";
  else if (/Attribution-ShareAlike 4\.0/i.test(first)) detected = "CC-BY-SA-4.0";
  else if (/Mozilla Public License.*2\.0/i.test(first)) detected = "MPL-2.0";
  return { ...classifyLicense(normalizeLicense(detected)), evidence_path: selected };
}

for (const item of skillPaths) {
  const body = await raw(item);
  if (!body) continue;

  const skillSha = crypto.createHash("sha256").update(body).digest("hex");
  const scan = scanText(body);
  const frontmatter = parseFrontmatter(body);

  const license = await licenseEvidenceFor(item, frontmatter.license ?? null, item);
  const capabilityScan = {
    shell: /(^|\s)(bash|sh|zsh|pwsh|powershell)\b|(?:^|\s)(sudo|chmod)\b|rm\s+-rf/i.test(body),
    network: /\b(curl|wget)\b|https?:\/\/|fetch\(/i.test(body),
    credentials: /api[_ -]?key|access[_ -]?token|secret|credential|process\.env/i.test(body),
    dynamic_execution: /\b(eval|exec|Function)\s*\(/i.test(body),
    package_install: /\b(npm|pnpm|yarn|pip|uv|cargo)\s+(install|add)\b/i.test(body)
  };

  result.discovered_skills.push({
    path: item,
    name: frontmatter.name ?? item.split("/").slice(-2, -1)[0],
    description: frontmatter.description?.trim() || null,
    skill_sha256: skillSha,
    license,
    security: { scan_status: scan.findings.length ? "review-required" : "verified", risk: riskLevel(scan), capabilities: scan.capabilities, findings: scan.findings },
    capabilities: capabilityScan
  });

  if (capabilityScan.dynamic_execution || capabilityScan.package_install) {
    result.warnings.push({ path: item, type: "review-signal", capabilities: capabilityScan });
  }
}

fs.mkdirSync("catalog/ingestion", { recursive: true });
const output = "catalog/ingestion/" + repo.replaceAll("/", "__") + ".json";
fs.writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
console.log("Ingested metadata for " + result.discovered_skills.length + " skills from " + repo + "@" + ref);
