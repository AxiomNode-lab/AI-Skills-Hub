#!/usr/bin/env node
// Drafts catalog/reviews/<id>.json for a pinned upstream skill directory: the
// file inventory, SHA-256 and Git blob hashes, modes, and raw scanner findings.
// The draft is deliberately not releasable. A reviewer must read every file,
// set each finding's disposition and reason, write content notes and the
// license scope reason, and change both statuses to "approved".
// Usage: node scripts/draft-review.mjs <id> <checkout-at-revision> [--force]
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { scanText } from "../packages/security/src/index.mjs";

const [id, checkout] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const force = process.argv.includes("--force");
if (!id || !checkout) throw new Error("Usage: node scripts/draft-review.mjs <id> <checkout-at-revision> [--force]");

const registry = JSON.parse(fs.readFileSync("catalog/skills.json", "utf8"));
const skill = registry.skills.find((item) => item.id === id);
if (!skill) throw new Error("Unknown skill: " + id);
if (skill.distribution === "blocked") throw new Error("Blocked skills are not reviewed for release");

const git = (...args) => execFileSync("git", ["-C", checkout, ...args], { encoding: "utf8" }).trim();
const revision = git("rev-parse", "HEAD");
if (revision !== skill.source?.revision) {
  throw new Error(`Checkout is at ${revision}; the catalog pins ${skill.source?.revision}`);
}
const sourcePath = skill.source.path.replace(/\/SKILL\.md$/, "");

// The Git tree, not the working directory, is the inventory of record.
const entries = git("ls-tree", "-r", "--full-tree", "HEAD", "--", sourcePath).split("\n").filter(Boolean).map((line) => {
  const [meta, file] = line.split("\t");
  const [mode, type, blob] = meta.split(" ");
  return { mode, type, blob, file };
});
const unsupported = entries.filter((entry) => entry.type !== "blob" || entry.mode !== "100644" || !/\.(md|txt)$/i.test(entry.file));
if (unsupported.length) {
  throw new Error("Only non-executable text packages can be released by this workflow:\n"
    + unsupported.map((entry) => `  ${entry.mode} ${entry.type} ${entry.file}`).join("\n"));
}
const license = entries.find((entry) => /^LICENSE(\.txt|\.md)?$/i.test(path.posix.relative(sourcePath, entry.file)));
if (!license) throw new Error("No skill-local LICENSE file; repository-level licenses are not used for release");

const files = entries.map((entry) => {
  const relative = path.posix.relative(sourcePath, entry.file);
  const bytes = Buffer.from(execFileSync("git", ["-C", checkout, "cat-file", "blob", entry.blob]));
  return {
    path: relative,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
    mode: entry.mode,
    git_blob: entry.blob,
    license: "Apache-2.0",
    covered_by: path.posix.relative(sourcePath, license.file),
    license_reason: "",
    findings: scanText(bytes.toString("utf8")).findings.map((finding) => ({ ...finding, disposition: "pending", reason: "" }))
  };
}).sort((a, b) => a.path.localeCompare(b.path));

const review = {
  schema_version: "0.1",
  skill_id: id,
  status: "draft",
  reviewed_on: null,
  reviewer: null,
  source: { repo: skill.source.repo, path: sourcePath, revision },
  inventory: {
    complete: true,
    scope: sourcePath,
    url: `https://api.github.com/repos/${skill.source.repo}/git/trees/${revision}?recursive=1`,
    notes: "Generated from git ls-tree at the pinned revision; confirm no ancestor NOTICE or nested licensing override."
  },
  license: {
    spdx: "Apache-2.0",
    redistributable: true,
    path: path.posix.relative(sourcePath, license.file),
    url: `https://github.com/${skill.source.repo}/blob/${revision}/${license.file}`,
    scope_reason: "",
    obligations: [
      "Redistribute the original license file with the skill.",
      "Preserve all upstream text and notices byte-for-byte."
    ]
  },
  content_review: { status: "pending", risk: "unknown", blocking_findings: [], capabilities: {}, notes: [] },
  files
};

const out = "catalog/reviews/" + id.replaceAll("/", "__") + ".json";
if (fs.existsSync(out) && !force) throw new Error("Review already exists; pass --force to overwrite the draft: " + out);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(review, null, 2) + "\n");
const pending = files.reduce((n, file) => n + file.findings.length, 0);
console.log(`Drafted ${out}: ${files.length} files, ${pending} findings awaiting disposition.`);
