#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import { scanText, riskLevel } from "../packages/security/src/index.mjs";
import path from "node:path";

const args = process.argv.slice(2);
const only = new Set(args.filter((x) => !x.startsWith("--")));
const all = args.includes("--all");
const root = process.cwd();
const registryPath = path.join(root, "catalog/skills.json");
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));

const request = async (url) => {
  const res = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "AI-Skills-Hub-materializer/0.2"
    }
  });
  if (!res.ok) throw new Error("GitHub API " + res.status + ": " + (await res.text()).slice(0, 500));
  return res;
};

const sourceBytes = async (repo, revision, sourcePath) => {
  const encoded = sourcePath.split("/").map(encodeURIComponent).join("/");
  const url = "https://raw.githubusercontent.com/" + repo + "/" + revision + "/" + encoded;
  const res = await fetch(url, {headers: {"user-agent": "AI-Skills-Hub-materializer/0.2"}});
  if (!res.ok) throw new Error("Source fetch " + res.status + " for " + repo + ":" + sourcePath);
  return Buffer.from(await res.arrayBuffer());
};

const targets = registry.skills.filter((skill) =>
  skill.distribution === "bundled" &&
  !skill.materialized &&
  (all || only.has(skill.id))
);

if (!targets.length) {
  console.log("No eligible unmaterialized skills selected.");
  process.exit(0);
}

function safeRelative(rootPath, candidate) {
  const resolved = path.resolve(rootPath, candidate);
  if (!resolved.startsWith(path.resolve(rootPath) + path.sep)) {
    throw new Error("Path traversal refused: " + candidate);
  }
  return resolved;
}

for (const skill of targets) {
  if (!skill.license.redistributable || skill.license.status !== "verified") {
    throw new Error("Redistribution rights are not verified for " + skill.id);
  }
  if (!/^[0-9a-f]{40}$/.test(skill.source.revision ?? "")) {
    throw new Error("Immutable source revision missing for " + skill.id);
  }

  const treeUrl = "https://api.github.com/repos/" + skill.source.repo + "/git/trees/" + skill.source.revision + "?recursive=1";
  const tree = await (await request(treeUrl)).json();
  if (tree.truncated) throw new Error("Truncated source tree refused for " + skill.id);

  const prefix = skill.source.path.replace(/\/$/, "") + "/";
  const files = tree.tree.filter((item) => item.type === "blob" && item.path.startsWith(prefix));
  const links = tree.tree.filter((item) => item.path.startsWith(prefix) && item.mode === "120000");
  if (links.length) throw new Error("Symlink source refused for " + skill.id + ": " + links[0].path);

  const destination = safeRelative(root, path.join("skills", skill.id));
  fs.rmSync(destination, {recursive:true,force:true});
  fs.mkdirSync(destination, {recursive:true});

  let totalBytes = 0;
  const fetchedFiles = [];
  const allFindings = [];
  const aggregate = {shell:false,network:false,credentials:false};

  const isTextPath = (value) => /\.(md|mdx|txt|json|ya?ml|xml|html?|css|js|mjs|cjs|ts|tsx|jsx|py|rb|go|rs|java|kt|sh|bash|zsh|ps1|toml|ini|cfg|conf)$/i.test(value);

  for (const file of files) {
    const relative = file.path.slice(prefix.length);
    const out = safeRelative(destination, relative);
    const bytes = await sourceBytes(skill.source.repo, skill.source.revision, file.path);
    totalBytes += bytes.length;
    if (bytes.length > 5 * 1024 * 1024) throw new Error("File too large: " + file.path);
    if (totalBytes > 25 * 1024 * 1024) throw new Error("Skill exceeds 25 MiB: " + skill.id);

    if (isTextPath(relative)) {
      const scan = scanText(bytes.toString("utf8"));
      allFindings.push(...scan.findings.map((finding) => ({...finding,file:relative})));
      aggregate.shell ||= scan.capabilities.shell;
      aggregate.network ||= scan.capabilities.network;
      aggregate.credentials ||= scan.capabilities.credentials;
    }

    fetchedFiles.push({file,relative,out,bytes});
  }

  if (!fetchedFiles.some((f) => /(^|\/)SKILL\.md$/i.test(f.relative))) {
    throw new Error("Materialized source has no SKILL.md: " + skill.id);
  }

  const scanResult = {
    status:"verified",
    risk: riskLevel({findings:allFindings}),
    capabilities:aggregate,
    findings:allFindings
  };

  if (scanResult.risk === "high") {
    throw new Error("High-risk security findings block materialization for " + skill.id);
  }

  const materializedFiles = [];
  for (const entry of fetchedFiles) {
    fs.mkdirSync(path.dirname(entry.out), {recursive:true});
    fs.writeFileSync(entry.out, entry.bytes);
    if (entry.file.mode === "100755") fs.chmodSync(entry.out, 0o755);
    materializedFiles.push({
      path:entry.relative,
      sha256:crypto.createHash("sha256").update(entry.bytes).digest("hex"),
      bytes:entry.bytes.length,
      mode:entry.file.mode ?? "100644"
    });
  }

  const metadata = {
    schema_version:"0.1",
    skill_id:skill.id,
    source:skill.source,
    registry_license:skill.license,
    security_scan:scanResult,
    materialized_files:materializedFiles,
    total_bytes:totalBytes
  };
  fs.writeFileSync(path.join(destination, ".ai-skills-hub.json"), JSON.stringify(metadata,null,2) + "\n");

  skill.materialized = true;
  skill.materialized_root = path.relative(root, destination).replaceAll(path.sep, "/");
  skill.materialized_files = materializedFiles.length;
  skill.security = {
    ...skill.security,
    scan_status:"verified",
    risk:scanResult.risk,
    network:scanResult.capabilities.network,
    shell:scanResult.capabilities.shell,
    credentials:scanResult.capabilities.credentials,
    findings:scanResult.findings
  };
  console.log("Materialized " + skill.id + " (" + materializedFiles.length + " files, " + totalBytes + " bytes)");
}

fs.writeFileSync(registryPath, JSON.stringify(registry,null,2) + "\n");
