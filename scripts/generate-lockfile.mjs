#!/usr/bin/env node
import fs from "node:fs";

const catalog = JSON.parse(fs.readFileSync("catalog/skills.json", "utf8"));
const skills = catalog.skills
  .filter((s) => s.distribution === "bundled")
  .sort((a,b) => a.id.localeCompare(b.id))
  .map((s) => ({
    id: s.id,
    source: s.source.repo,
    path: s.source.path,
    revision: s.source.revision,
    revision_type: s.source.revision_type ?? "git-commit"
  }));

const lock = {
  lockfile_version: 1,
  registry_schema: catalog.schema_version,
  skills
};

fs.writeFileSync("catalog/skills.lock.json", JSON.stringify(lock, null, 2) + "\n");
console.log("Generated deterministic lockfile for", skills.length, "bundled skills");
