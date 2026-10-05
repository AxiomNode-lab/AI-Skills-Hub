#!/usr/bin/env node
// Re-reads descriptions that an older line-based frontmatter parser stored as
// bare YAML block indicators (">", "|-", ...). Each upstream SKILL.md is fetched
// at the catalog's pinned commit and must match the recorded SHA-256 before its
// description is used. Usage: node scripts/repair-descriptions.mjs [--check]
import fs from "node:fs";
import { parseFrontmatter } from "../packages/core/src/index.mjs";
import { sha256 as hash } from "../packages/materializer/src/reviewed.mjs";

const check = process.argv.includes("--check");
const catalogFile = "catalog/skills.json";
const catalog = JSON.parse(fs.readFileSync(catalogFile, "utf8"));
const isBroken = (value) => /^[>|](?:[+-]?\d*|\d[+-])$/.test(String(value ?? "").trim());
const broken = catalog.skills.filter((skill) => isBroken(skill.description));

if (check) {
  if (broken.length) {
    console.error(`${broken.length} catalog descriptions are bare YAML block indicators. Run node scripts/repair-descriptions.mjs.`);
    process.exit(1);
  }
  console.log("Catalog descriptions OK.");
  process.exit(0);
}

const token = process.env.GITHUB_TOKEN;
const skillFile = (source) => source.path.endsWith("SKILL.md") ? source.path : `${source.path.replace(/\/$/, "")}/SKILL.md`;
const repaired = new Map();
const failures = [];

for (const skill of broken) {
  const { repo, revision } = skill.source ?? {};
  if (!repo || !/^[0-9a-f]{40}$/.test(revision ?? "")) {
    failures.push(`${skill.id}: no immutable source revision`);
    continue;
  }
  const file = skillFile(skill.source);
  const url = `https://raw.githubusercontent.com/${repo}/${revision}/${file.split("/").map(encodeURIComponent).join("/")}`;
  // Public sources are read anonymously; a token is only a fallback for private ones.
  let response = await fetch(url);
  if (!response.ok && token) response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) {
    failures.push(`${skill.id}: HTTP ${response.status}`);
    continue;
  }
  const body = await response.text();
  const sha256 = hash(body);
  if (skill.integrity?.upstream_skill_sha256 && sha256 !== skill.integrity.upstream_skill_sha256) {
    failures.push(`${skill.id}: upstream SHA-256 does not match the catalog record`);
    continue;
  }
  const description = parseFrontmatter(body).description?.replace(/\s+/g, " ").trim();
  if (!description || isBroken(description)) {
    failures.push(`${skill.id}: no description in upstream frontmatter`);
    continue;
  }
  skill.description = description;
  repaired.set(`${repo}:${file}`, { description, sha256 });
}

fs.writeFileSync(catalogFile, JSON.stringify(catalog, null, 2) + "\n");

// Keep ingestion snapshots consistent with the catalog they feed.
for (const name of fs.readdirSync("catalog/ingestion")) {
  const file = `catalog/ingestion/${name}`;
  const snapshot = JSON.parse(fs.readFileSync(file, "utf8"));
  let changed = false;
  for (const entry of snapshot.discovered_skills ?? []) {
    const fix = repaired.get(`${snapshot.source?.repo}:${entry.path}`);
    if (fix && entry.skill_sha256 === fix.sha256 && isBroken(entry.description)) {
      entry.description = fix.description;
      changed = true;
    }
  }
  if (changed) fs.writeFileSync(file, JSON.stringify(snapshot, null, 2) + "\n");
}

console.log(`Repaired ${repaired.size} of ${broken.length} descriptions.`);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
}
