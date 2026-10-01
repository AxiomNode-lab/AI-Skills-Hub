#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";

const [, , repo, ref = "main"] = process.argv;
if (!repo) {
  console.error("Usage: node scripts/ingest-github.mjs <owner/repo> [ref]");
  process.exit(1);
}

const api = async (url) => {
  const res = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "AI-Skills-Hub-ingestor/0.2"
    }
  });
  if (!res.ok) throw new Error("GitHub API " + res.status + ": " + (await res.text()).slice(0, 500));
  return res.json();
};

const raw = async (path) => {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const url = "https://raw.githubusercontent.com/" + repo + "/" + encodeURIComponent(ref) + "/" + encodedPath;
  const res = await fetch(url, { headers: { "user-agent": "AI-Skills-Hub-ingestor/0.2" } });
  if (!res.ok) return null;
  return res.text();
};

const tree = await api("https://api.github.com/repos/" + repo + "/git/trees/" + encodeURIComponent(ref) + "?recursive=1");
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
  source: { repo, ref, tree_sha: tree.sha },
  discovered_skills: [],
  license_files: licenses,
  warnings: []
};

for (const item of skillPaths) {
  const body = await raw(item);
  if (!body) continue;

  const skillSha = crypto.createHash("sha256").update(body).digest("hex");
  const lines = body.split(/\r?\n/);
  const frontmatter = {};

  if (lines[0]?.trim() === "---") {
    for (const line of lines.slice(1, 80)) {
      if (line.trim() === "---") break;
      const match = line.match(/^([A-Za-z0-9_-]+):\s*(.+)$/);
      if (match) frontmatter[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
    }
  }

  const capabilityScan = {
    shell: /(^|\s)(bash|sh|zsh|pwsh|powershell)\b|(?:^|\s)(sudo|chmod)\b|rm\s+-rf/i.test(body),
    network: /\b(curl|wget)\b|https?:\/\/|fetch\(/i.test(body),
    credentials: /api[_ -]?key|access[_ -]?token|secret|credential|process\.env/i.test(body),
    dynamic_execution: /\b(eval|exec|Function)\s*\(/i.test(body),
    package_install: /\b(npm|pnpm|yarn|pip|uv|cargo)\s+(install|add)\b/i.test(body)
  };

  result.discovered_skills.push({
    path: item.path,
    name: frontmatter.name ?? item.path.split("/").slice(-2, -1)[0],
    description: frontmatter.description ?? null,
    skill_sha256: skillSha,
    capabilities: capabilityScan
  });

  if (capabilityScan.dynamic_execution || capabilityScan.package_install) {
    result.warnings.push({ path: item.path, type: "review-signal", capabilities: capabilityScan });
  }
}

fs.mkdirSync("catalog/ingestion", { recursive: true });
const output = "catalog/ingestion/" + repo.replaceAll("/", "__") + ".json";
fs.writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
console.log("Ingested metadata for " + result.discovered_skills.length + " skills from " + repo + "@" + ref);
