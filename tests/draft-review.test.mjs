import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateReleaseReview } from "../packages/materializer/src/reviewed.mjs";

const script = fileURLToPath(new URL("../scripts/draft-review.mjs", import.meta.url));
const APACHE = "Apache License\nVersion 2.0, January 2004\nhttp://www.apache.org/licenses/\n";

function fixture(t, extraFiles = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hub-draft-review-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const upstream = path.join(root, "upstream");
  const skillDir = path.join(upstream, "skills", "demo");
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), "---\nname: demo\ndescription: Demo\nlicense: Complete terms in LICENSE.txt\n---\nSee https://example.com\n");
  fs.writeFileSync(path.join(skillDir, "LICENSE.txt"), APACHE);
  for (const [name, body] of Object.entries(extraFiles)) fs.writeFileSync(path.join(skillDir, name), body);
  const git = (...args) => execFileSync("git", ["-C", upstream, ...args], { encoding: "utf8" }).trim();
  git("init", "-q");
  git("add", ".");
  git("-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-qm", "init");
  const revision = git("rev-parse", "HEAD");
  const hub = path.join(root, "hub");
  fs.mkdirSync(path.join(hub, "catalog"), { recursive: true });
  const skill = { id: "demo/demo", name: "demo", distribution: "review-required", source: { repo: "demo/skills", path: "skills/demo/SKILL.md", revision } };
  fs.writeFileSync(path.join(hub, "catalog", "skills.json"), JSON.stringify({ skills: [skill] }));
  const run = () => spawnSync(process.execPath, [script, "demo/demo", upstream], { cwd: hub, encoding: "utf8" });
  return { hub, skill, run };
}

test("a drafted review records the pinned inventory but cannot pass the release gate", t => {
  const { hub, skill, run } = fixture(t);
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  const review = JSON.parse(fs.readFileSync(path.join(hub, "catalog", "reviews", "demo__demo.json"), "utf8"));
  assert.deepEqual(review.files.map(file => file.path), ["LICENSE.txt", "SKILL.md"]);
  assert.equal(review.source.revision, skill.source.revision);
  assert.ok(review.files.every(file => /^[0-9a-f]{64}$/.test(file.sha256) && /^[0-9a-f]{40}$/.test(file.git_blob)));
  assert.ok(review.files.flatMap(file => file.findings).every(finding => finding.disposition === "pending"));
  assert.throws(() => validateReleaseReview(skill, review), /approved artifact review/);
  assert.notEqual(run().status, 0, "an existing draft is not overwritten without --force");
});

test("draft-review refuses packages with code and skills without a local license", t => {
  const withCode = fixture(t, { "helper.py": "print('x')\n" });
  assert.match(withCode.run().stderr, /Only non-executable text packages/);
  const noLicense = fixture(t);
  fs.rmSync(path.join(path.dirname(noLicense.hub), "upstream", "skills", "demo", "LICENSE.txt"));
  execFileSync("git", ["-C", path.join(path.dirname(noLicense.hub), "upstream"), "-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-qam", "drop license"]);
  const revision = execFileSync("git", ["-C", path.join(path.dirname(noLicense.hub), "upstream"), "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  noLicense.skill.source.revision = revision;
  fs.writeFileSync(path.join(noLicense.hub, "catalog", "skills.json"), JSON.stringify({ skills: [noLicense.skill] }));
  assert.match(noLicense.run().stderr, /No skill-local LICENSE/);
});
