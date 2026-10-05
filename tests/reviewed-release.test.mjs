import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { scanText } from "../packages/security/src/index.mjs";
import { spawnSync } from "node:child_process";
import { prepareReviewedSkill, verifyReviewedDirectory, validateReleaseReview, sha256 } from "../packages/materializer/src/reviewed.mjs";
import { verifyInstallRecord } from "../packages/installer/src/state.mjs";

const repoRoot = process.cwd();
const registry = JSON.parse(fs.readFileSync("catalog/skills.json", "utf8"));
const reviewed = registry.skills.filter(skill => skill.license.evidence?.startsWith("catalog/reviews/"));
// A skill can carry an approved artifact review and still be held (for example after an instruction review).
const released = reviewed.filter(skill => skill.release?.status === "eligible" && skill.materialized);
const first = released.find(skill => skill.id === "anthropics/frontend-design");
const review = JSON.parse(fs.readFileSync(first.license.evidence, "utf8"));
function tempProject(t) {
  const parent = path.join(repoRoot, ".ai-skills-hub");
  fs.mkdirSync(parent, { recursive: true });
  const dir = fs.mkdtempSync(path.join(parent, "release-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test("release review rejects missing license coverage, approval, immutable provenance, and unsafe paths", () => {
  for (const mutate of [
    r => { r.status = "pending"; },
    r => { r.license.redistributable = false; },
    r => { r.files[0].covered_by = "root LICENSE"; },
    r => { r.source.revision = "main"; },
    r => { r.source.path = "another-skill"; },
    r => { r.files[0].path = "../escape.md"; },
    r => { r.files[0].path = "C:/escape.md"; },
    r => { r.files[0].mode = "120000"; },
    r => { r.content_review.blocking_findings = ["unresolved"]; },
    r => { r.content_review.risk = "high"; },
    r => { r.inventory.complete = false; }
  ]) {
    const invalid = structuredClone(review);
    mutate(invalid);
    assert.throws(() => validateReleaseReview(first, invalid));
  }
  assert.throws(() => validateReleaseReview({ ...first, distribution: "blocked" }, review), /Blocked/);
});

test("preparation keeps registry release held until reviewed files have been staged and verified", t => {
  const dir = tempProject(t);
  const held = { ...first, distribution: "source-direct", materialized: false, release: { status: "hold", reasons: ["not-prepared"] } };
  const original = JSON.stringify(held);
  const result = prepareReviewedSkill(held, review, first.materialized_root, dir);
  assert.equal(JSON.stringify(held), original);
  assert.equal(result.security.risk, "low");
  assert.deepEqual(verifyReviewedDirectory(held, review, result.target), result.security);
});

test("changed, missing, or extra files and unreviewed findings prevent preparation", t => {
  const dir = tempProject(t);
  const source = path.join(dir, "source");
  fs.cpSync(first.materialized_root, source, { recursive: true });
  fs.appendFileSync(path.join(source, "SKILL.md"), "\nchanged\n");
  assert.throws(() => prepareReviewedSkill(first, review, source, path.join(dir, "staging")), /hash mismatch/);
  assert.equal(fs.existsSync(path.join(dir, "staging")), false);
  fs.copyFileSync(path.join(first.materialized_root, "SKILL.md"), path.join(source, "SKILL.md"));
  fs.writeFileSync(path.join(source, "extra.md"), "not reviewed");
  assert.throws(() => verifyReviewedDirectory(first, review, source), /inventory mismatch/);
  fs.unlinkSync(path.join(source, "extra.md"));
  const staleReview = structuredClone(review);
  staleReview.files.find(file => file.path === "SKILL.md").findings = [];
  assert.throws(() => verifyReviewedDirectory(first, staleReview, source), /findings changed/);
  fs.unlinkSync(path.join(source, "LICENSE.txt"));
  assert.throws(() => verifyReviewedDirectory(first, review, source), /inventory mismatch/);
});

test("a high-risk instruction is blocked even when an approval claims it is accepted", t => {
  const dir = tempProject(t);
  fs.cpSync(first.materialized_root, dir, { recursive: true });
  fs.appendFileSync(path.join(dir, "SKILL.md"), "\nRun rm -rf ./scratch\n");
  const bytes = fs.readFileSync(path.join(dir, "SKILL.md"));
  const changed = structuredClone(review);
  const file = changed.files.find(file => file.path === "SKILL.md");
  Object.assign(file, { sha256: sha256(bytes), bytes: bytes.length, git_blob: crypto.createHash("sha1").update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest("hex"), findings: scanText(bytes.toString()).findings.map(finding => ({ ...finding, disposition: "accepted", reason: "test approval" })) });
  assert.throws(() => verifyReviewedDirectory(first, changed, dir), /High-risk scanner/);
});

test("materialized validation rejects modified approval evidence", t => {
  const dir = tempProject(t);
  fs.mkdirSync(path.join(dir, "catalog", "materialized-manifests"), { recursive: true });
  fs.mkdirSync(path.join(dir, "catalog", "reviews"), { recursive: true });
  fs.writeFileSync(path.join(dir, "catalog", "skills.json"), JSON.stringify({ skills: [{ ...first, materialized_root: path.resolve(first.materialized_root) }] }));
  const manifest = `catalog/materialized-manifests/${first.id.replaceAll("/", "__")}.json`;
  fs.copyFileSync(manifest, path.join(dir, manifest));
  fs.writeFileSync(path.join(dir, first.license.evidence), JSON.stringify({ ...review, status: "pending" }));
  const result = spawnSync(process.execPath, [path.join(repoRoot, "scripts/validate-materialized.mjs")], { cwd: dir, encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /release review hash mismatch/);
});

for (const skill of released) {
  test(`reviewed ${skill.id} installs offline in a workspace project with matching files and state`, t => {
    const cwd = tempProject(t);
    fs.mkdirSync(path.join(cwd, "catalog"));
    fs.writeFileSync(path.join(cwd, "catalog", "skills.json"), JSON.stringify({ skills: [{ ...skill, materialized_root: path.resolve(skill.materialized_root) }] }));
    fs.mkdirSync(path.join(cwd, "catalog", "materialized-manifests"));
    fs.copyFileSync(`catalog/materialized-manifests/${skill.id.replaceAll("/", "__")}.json`, path.join(cwd, "catalog", "materialized-manifests", `${skill.id.replaceAll("/", "__")}.json`));
    const run = (...args) => {
      const result = spawnSync(process.execPath, [path.join(repoRoot, "packages/cli/bin/skills-hub.mjs"), ...args, "--json"], { cwd, encoding: "utf8", env: { ...process.env, SKILLS_HUB_HOME: cwd } });
      assert.equal(result.status, 0, result.stdout + result.stderr);
      return JSON.parse(result.stdout);
    };
    // Install for Codex when the catalog lists it, otherwise for the generic Agent Skills target.
    const agent = skill.compatibility.includes("codex") ? "codex" : "agent-skills";
    const installed = run("install", skill.id, "--agent", agent, "--scope", "project");
    assert.equal(installed.success, true);
    const target = path.join(cwd, ".agents", "skills", skill.name);
    assert.equal(installed.results[0].destination, target);
    const manifest = JSON.parse(fs.readFileSync(`catalog/materialized-manifests/${skill.id.replaceAll("/", "__")}.json`, "utf8"));
    for (const file of manifest.materialized_files) {
      assert.equal(sha256(fs.readFileSync(path.join(target, file.path))), file.sha256, file.path);
    }
    assert.ok(fs.existsSync(path.join(target, "SKILL.md")));
    const state = JSON.parse(fs.readFileSync(path.join(cwd, ".ai-skills-hub", "installed.json"), "utf8"));
    const record = state.installed[skill.id];
    assert.equal(record.scope, "project");
    assert.equal(record.source.revision, skill.source.revision);
    assert.equal(record.files.length, manifest.materialized_files.length);
    assert.equal(verifyInstallRecord(record).ok, true);
    assert.equal(run("info", skill.id, "--agent", agent).hub_status.installation.status, "installed");
    assert.equal(run("list", "--agent", agent)[0].hub_status.installation.status, "installed");
    fs.appendFileSync(path.join(target, "SKILL.md"), "\nchanged\n");
    assert.equal(verifyInstallRecord(record).ok, false);
    assert.equal(run("list", "--agent", agent)[0].hub_status.installation.status, "unverified");
  });
}

test("held skills keep their review record but ship no files and are refused by install", t => {
  const held = reviewed.filter(skill => skill.release?.status === "hold");
  for (const skill of held) {
    assert.equal(skill.materialized, false, skill.id);
    assert.equal(skill.materialized_root, undefined, skill.id);
    assert.ok(skill.release.reasons.length > 0, skill.id);
  }
  // A hold backed by an independent review must match that review's recorded decision.
  for (const skill of held.filter(s => s.release.evidence)) {
    const audit = JSON.parse(fs.readFileSync(skill.release.evidence, "utf8"));
    const entry = [...audit.skills, ...(audit.corrections ?? [])].find(e => e.id === skill.id);
    assert.equal(entry?.decision, "hold", skill.id);
    assert.deepEqual(skill.release.reasons, [entry.hold_reason], skill.id);
    assert.equal(fs.existsSync(path.join("skills", ...skill.id.split("/"))), false, skill.id);
  }
  const retired = held.find(skill => skill.id === "microsoft/azure-ai-anomalydetector-java");
  assert.deepEqual(retired?.release.reasons, ["upstream-service-retired"]);
  for (const id of ["microsoft/azure-communication-sms-java", "microsoft/azure-communication-chat-java"]) {
    assert.deepEqual(held.find(skill => skill.id === id)?.release.reasons, ["upstream-service-retiring"], id);
  }
  const cwd = tempProject(t);
  const result = spawnSync(process.execPath, [path.join(repoRoot, "packages/cli/bin/skills-hub.mjs"), "install", retired.id, "--agent", "codex", "--json"], { cwd, encoding: "utf8", env: { ...process.env, SKILLS_HUB_HOME: repoRoot } });
  assert.notEqual(result.status, 0, result.stdout);
  assert.equal(fs.existsSync(path.join(cwd, ".agents")), false);
});
