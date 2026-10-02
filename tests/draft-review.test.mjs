import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { prepareReviewedSkill, validateReleaseReview } from "../packages/materializer/src/reviewed.mjs";

const script = fileURLToPath(new URL("../scripts/draft-review.mjs", import.meta.url));
const APACHE = "Apache License\nVersion 2.0, January 2004\nhttp://www.apache.org/licenses/\n2. Grant of Copyright License.\n4. Redistribution.\n";
const MIT = "MIT License\n\nCopyright (c) 2025 Example\n\nPermission is hereby granted, free of charge, to any person obtaining a copy.\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n";
const SKILL = (license) => `---\nname: demo\ndescription: Demo skill\n${license ? `license: ${license}\n` : ""}---\nSee https://example.com\n`;

// files: repository-relative path -> contents
function fixture(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hub-draft-review-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const upstream = path.join(root, "upstream");
  for (const [name, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(upstream, name)), { recursive: true });
    fs.writeFileSync(path.join(upstream, name), body);
  }
  const git = (...args) => execFileSync("git", ["-C", upstream, ...args], { encoding: "utf8" }).trim();
  git("init", "-q");
  git("add", ".");
  git("-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-qm", "init");
  const hub = path.join(root, "hub");
  fs.mkdirSync(path.join(hub, "catalog"), { recursive: true });
  const skill = { id: "demo/demo", name: "demo", distribution: "review-required", source: { repo: "demo/skills", path: "skills/demo/SKILL.md", revision: git("rev-parse", "HEAD") } };
  fs.writeFileSync(path.join(hub, "catalog", "skills.json"), JSON.stringify({ skills: [skill] }));
  const run = () => spawnSync(process.execPath, [script, "demo/demo", upstream], { cwd: hub, encoding: "utf8" });
  const review = () => JSON.parse(fs.readFileSync(path.join(hub, "catalog", "reviews", "demo__demo.json"), "utf8"));
  return { root, upstream, hub, skill, run, review };
}

function approve(review) {
  review.status = "approved";
  review.license.scope_reason = "test";
  review.content_review = { status: "approved", risk: "low", blocking_findings: [], capabilities: {}, notes: ["test"] };
  for (const file of review.files) {
    file.license_reason = "test";
    for (const finding of file.findings) Object.assign(finding, { disposition: "accepted", reason: "test" });
  }
  return review;
}

test("a drafted review records the pinned inventory but cannot pass the release gate", t => {
  const f = fixture(t, { "skills/demo/SKILL.md": SKILL("Complete terms in LICENSE.txt"), "skills/demo/LICENSE.txt": APACHE });
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const review = f.review();
  assert.equal(review.license.spdx, "Apache-2.0");
  assert.equal(review.license.scope, "skill-local");
  assert.deepEqual(review.files.map(file => file.path), ["LICENSE.txt", "SKILL.md"]);
  assert.equal(review.source.revision, f.skill.source.revision);
  assert.ok(review.files.every(file => /^[0-9a-f]{64}$/.test(file.sha256) && /^[0-9a-f]{40}$/.test(file.git_blob)));
  assert.ok(review.files.flatMap(file => file.findings).every(finding => finding.disposition === "pending"));
  assert.throws(() => validateReleaseReview(f.skill, review), /approved artifact review/);
  assert.notEqual(f.run().status, 0, "an existing draft is not overwritten without --force");
});

test("a repository-root MIT license is attached and released byte-for-byte", t => {
  const f = fixture(t, { "LICENSE": MIT, "skills/demo/SKILL.md": SKILL(null), "skills/demo/notes.md": "Notes\n" });
  assert.equal(f.run().status, 0);
  const review = approve(f.review());
  assert.equal(review.license.scope, "repository");
  assert.equal(review.license.source_path, "LICENSE");
  const attached = review.files.find(file => file.attached);
  assert.deepEqual([attached.path, attached.source_path], ["LICENSE.txt", "LICENSE"]);
  const staged = prepareReviewedSkill(f.skill, review, path.join(f.upstream, "skills", "demo"), path.join(f.root, "staging"));
  assert.equal(fs.readFileSync(path.join(staged.target, "LICENSE.txt"), "utf8"), MIT);
  assert.deepEqual(fs.readdirSync(staged.target).sort(), ["LICENSE.txt", "SKILL.md", "notes.md"]);

  const extra = structuredClone(review);
  extra.license.ancestor_check.overrides = ["skills/NOTICE"];
  assert.throws(() => validateReleaseReview(f.skill, extra), /nested license/);
  const apache = structuredClone(review);
  apache.license.spdx = "Apache-2.0";
  assert.throws(() => validateReleaseReview(f.skill, apache), /Only MIT/);
});

test("draft-review refuses code, missing licenses, nested notices, and conflicting declarations", t => {
  const cases = [
    [{ "skills/demo/SKILL.md": SKILL("Complete terms in LICENSE.txt"), "skills/demo/LICENSE.txt": APACHE, "skills/demo/helper.py": "print('x')\n" }, /Only non-executable text packages/],
    [{ "skills/demo/SKILL.md": SKILL(null) }, /No skill-local or repository-root license/],
    [{ "LICENSE": APACHE, "skills/demo/SKILL.md": SKILL(null) }, /not MIT/],
    [{ "LICENSE": MIT, "skills/NOTICE": "Other terms\n", "skills/demo/SKILL.md": SKILL(null) }, /Nested license/],
    [{ "LICENSE": MIT, "skills/demo/SKILL.md": SKILL("Apache-2.0") }, /declares a different license/]
  ];
  for (const [files, expected] of cases) assert.match(fixture(t, files).run().stderr, expected);
});
