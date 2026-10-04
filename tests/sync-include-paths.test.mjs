import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const script = path.resolve("scripts/sync-registry.mjs");

// include_paths keeps only the listed subtrees of a mixed repository.
test("sync-registry ingests only skills under a source's include_paths", t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hub-sync-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, "catalog", "ingestion"), { recursive: true });
  const repo = "example/mixed-skills";
  fs.writeFileSync(path.join(dir, "catalog", "sources.json"), JSON.stringify({ sources: [
    { id: repo, kind: "github", repo, default_branch: "main", ingest_enabled: true, include_paths: ["seo-geo"] }
  ] }));
  fs.writeFileSync(path.join(dir, "catalog", "skills.json"), JSON.stringify({ skills: [] }));
  const item = (name, p) => ({ name, path: p, description: name, skill_sha256: "0".repeat(64), license: { spdx: "NOASSERTION" } });
  fs.writeFileSync(path.join(dir, "catalog", "ingestion", "example__mixed-skills.json"), JSON.stringify({
    source: { revision: "a".repeat(40) },
    discovered_skills: [item("keyword-research", "seo-geo/survey/keyword-research/SKILL.md"), item("ad-builder", "ad/ad-builder/SKILL.md"), item("seo-geo-lookalike", "seo-geo-extra/x/SKILL.md")]
  }));
  const result = spawnSync(process.execPath, [script, "--no-fetch"], { cwd: dir, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const ids = JSON.parse(fs.readFileSync(path.join(dir, "catalog", "skills.json"), "utf8")).skills.map(s => s.id);
  assert.deepEqual(ids, ["example/keyword-research"]);
});
