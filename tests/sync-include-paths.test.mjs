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

function syncFixture(t, { source, skills, discovered }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hub-sync-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, "catalog", "ingestion"), { recursive: true });
  fs.writeFileSync(path.join(dir, "catalog", "sources.json"), JSON.stringify({ sources: [{ id: source.repo, kind: "github", default_branch: "main", ingest_enabled: true, ...source }] }));
  fs.writeFileSync(path.join(dir, "catalog", "skills.json"), JSON.stringify({ skills }));
  fs.writeFileSync(path.join(dir, "catalog", "ingestion", source.repo.replace("/", "__") + ".json"), JSON.stringify({ source: { revision: "b".repeat(40) }, discovered_skills: discovered }));
  const result = spawnSync(process.execPath, [script, "--no-fetch"], { cwd: dir, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return { ...JSON.parse(fs.readFileSync(path.join(dir, "catalog", "skills.json"), "utf8")), stderr: result.stderr };
}
const entry = (name, p) => ({ name, path: p, description: name, skill_sha256: "0".repeat(64), license: { spdx: "NOASSERTION" } });
const record = (id, p) => ({ id, name: id.split("/")[1], publisher: "example", source: { repo: "example/mixed-skills", path: p, revision: "a".repeat(40) }, license: { spdx: "MIT", redistributable: false, status: "review-required" }, distribution: "review-required", compatibility: ["agent-skills"], security: {}, release: { status: "hold", reasons: ["manual_review_required"] } });

test("records outside include_paths are left unchanged, not marked missing", t => {
  const outside = record("example/ad-builder", "ad/ad-builder/SKILL.md");
  const { skills } = syncFixture(t, {
    source: { repo: "example/mixed-skills", include_paths: ["seo-geo"] },
    skills: [outside],
    discovered: [entry("ad-builder", "ad/ad-builder/SKILL.md"), entry("keyword-research", "seo-geo/keyword-research/SKILL.md")]
  });
  assert.deepEqual(skills.find(s => s.id === "example/ad-builder"), outside);
});

test("a new upstream path cannot take over the id of a record whose path still exists, in either order", t => {
  for (const order of [["a/foo/SKILL.md", "b/foo/SKILL.md"], ["b/foo/SKILL.md", "a/foo/SKILL.md"]]) {
    const { skills, stderr } = syncFixture(t, {
      source: { repo: "example/mixed-skills" },
      skills: [record("example/foo", "b/foo/SKILL.md")],
      discovered: order.map(p => entry("foo", p))
    });
    assert.equal(skills.length, 1);
    assert.equal(skills[0].source.path, "b/foo/SKILL.md", order.join(" then "));
    assert.match(stderr, /duplicate skill id example\/foo at example\/mixed-skills:a\/foo/);
  }
});

test("a reviewed, released record stays pinned when upstream moves to a new revision", t => {
  const released = {
    ...record("example/foo", "skills/foo"),
    license: { spdx: "MIT", redistributable: true, status: "verified", scope: "repository", evidence: "catalog/reviews/example__foo.json" },
    distribution: "bundled", materialized: true, materialized_root: "skills/example/foo",
    release: { status: "eligible", reasons: [] }
  };
  const { skills } = syncFixture(t, {
    source: { repo: "example/mixed-skills" },
    skills: [released],
    discovered: [entry("foo", "skills/foo/SKILL.md")]
  });
  assert.deepEqual(skills, [released]);
});
