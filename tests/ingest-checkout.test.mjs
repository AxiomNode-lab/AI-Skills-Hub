import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";

const script = path.resolve("scripts/ingest-github.mjs");

// Builds a one-commit repository whose origin claims to be github.com/<repo>.
function repository(t, repo) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hub-ingest-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const clone = path.join(dir, "clone");
  fs.mkdirSync(path.join(clone, "skills", "demo"), { recursive: true });
  fs.writeFileSync(path.join(clone, "LICENSE"), "MIT License\n\nCopyright (c) 2026 Example\n\nPermission is hereby granted, free of charge\n");
  fs.writeFileSync(path.join(clone, "skills", "demo", "SKILL.md"), "---\nname: demo\ndescription: Demo skill for ingestion.\n---\n\n# Demo\n");
  const git = (...args) => execFileSync("git", ["-C", clone, ...args], { encoding: "utf8" });
  git("init", "-q", "-b", "main");
  git("-c", "user.name=t", "-c", "user.email=t@example.com", "add", ".");
  git("-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-qm", "init");
  git("remote", "add", "origin", `https://github.com/${repo}.git`);
  return { dir, clone, head: git("rev-parse", "HEAD").trim() };
}

test("ingest-github --checkout reads a pinned local clone instead of the GitHub API", t => {
  const { dir, clone, head } = repository(t, "example/skills");
  const result = spawnSync(process.execPath, [script, "example/skills", "main", "--checkout", clone], { cwd: dir, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const out = JSON.parse(fs.readFileSync(path.join(dir, "catalog", "ingestion", "example__skills.json"), "utf8"));
  assert.equal(out.source.revision, head);
  assert.equal(out.discovered_skills.length, 1);
  const [skill] = out.discovered_skills;
  assert.deepEqual([skill.path, skill.name, skill.license.spdx], ["skills/demo/SKILL.md", "demo", "MIT"]);
  const bytes = fs.readFileSync(path.join(clone, "skills", "demo", "SKILL.md"));
  assert.equal(skill.skill_sha256, crypto.createHash("sha256").update(bytes).digest("hex"));
});

test("ingest-github --checkout refuses a clone of a different repository", t => {
  const { dir, clone } = repository(t, "someone/else");
  const result = spawnSync(process.execPath, [script, "example/skills", "main", "--checkout", clone], { cwd: dir, encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /is not example\/skills/);
});

test("ingest-github --checkout refuses a ref that does not name the checked-out commit", t => {
  const { dir, clone } = repository(t, "example/skills");
  const git = (...args) => execFileSync("git", ["-C", clone, ...args], { encoding: "utf8" });
  git("checkout", "-q", "-b", "feature");
  git("-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "--allow-empty", "-m", "feature");
  const result = spawnSync(process.execPath, [script, "example/skills", "main", "--checkout", clone], { cwd: dir, encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /is not main/);
});

test("ingest-github --checkout finds skills whose paths git would quote", t => {
  const { dir, clone } = repository(t, "example/skills");
  const git = (...args) => execFileSync("git", ["-C", clone, ...args], { encoding: "utf8" });
  fs.mkdirSync(path.join(clone, "skills", "café"), { recursive: true });
  fs.writeFileSync(path.join(clone, "skills", "café", "SKILL.md"), "---\nname: cafe\ndescription: Non-ASCII path.\n---\n");
  git("add", ".");
  git("-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-qm", "cafe");
  const result = spawnSync(process.execPath, [script, "example/skills", "main", "--checkout", clone], { cwd: dir, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const out = JSON.parse(fs.readFileSync(path.join(dir, "catalog", "ingestion", "example__skills.json"), "utf8"));
  assert.ok(out.discovered_skills.some(skill => skill.path === "skills/café/SKILL.md"), JSON.stringify(out.discovered_skills.map(s => s.path)));
});

test("ingest-github --checkout accepts a commit SHA or a remote branch that names HEAD", t => {
  const { dir, clone, head } = repository(t, "example/skills");
  const git = (...args) => execFileSync("git", ["-C", clone, ...args], { encoding: "utf8" });
  // A stale local main, with HEAD detached at the newer origin/main.
  git("-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "--allow-empty", "-m", "newer");
  const newer = git("rev-parse", "HEAD").trim();
  git("update-ref", "refs/remotes/origin/main", newer);
  git("checkout", "-q", "--detach", newer);
  git("branch", "-f", "main", head);
  for (const ref of ["main", newer]) {
    const result = spawnSync(process.execPath, [script, "example/skills", ref, "--checkout", clone], { cwd: dir, encoding: "utf8" });
    assert.equal(result.status, 0, ref + ": " + result.stderr);
  }
});
