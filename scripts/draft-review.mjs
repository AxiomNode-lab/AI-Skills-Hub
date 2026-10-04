#!/usr/bin/env node
// Drafts catalog/reviews/<id>.json for a pinned upstream skill directory: the
// file inventory, SHA-256 and Git blob hashes, modes, and raw scanner findings.
// The draft is deliberately not releasable. A reviewer must read every file,
// set each finding's disposition and reason, write content notes and the
// license scope reason, and change both statuses to "approved".
// Usage: node scripts/draft-review.mjs <id> <checkout-at-revision> [--force]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { scanText } from "../packages/security/src/index.mjs";
import { parseFrontmatter } from "../packages/core/src/index.mjs";
import { detectLicense, sha256 } from "../packages/materializer/src/reviewed.mjs";

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
const blob = (hash) => Buffer.from(execFileSync("git", ["-C", checkout, "cat-file", "blob", hash]));
const LICENSE_FILE = /(^|\/)(LICEN[CS]E|COPYING|NOTICE)[^/]*$/i;
const local = entries.find((entry) => /^LICENSE(\.txt|\.md)?$/i.test(path.posix.relative(sourcePath, entry.file)));

// A skill-local license (Apache-2.0 or MIT) governs the skill. Otherwise an MIT
// or Apache-2.0 license at the repository root is accepted, only when no nested
// license, copying, or notice file sits at the root or on the path to the skill.
let license;
let attached = null;
if (local) {
  const spdx = detectLicense(blob(local.blob).toString("utf8"));
  if (!spdx) throw new Error("Skill-local license is neither Apache-2.0 nor MIT: " + local.file);
  license = { spdx, scope: "skill-local", path: path.posix.relative(sourcePath, local.file), url: `https://github.com/${skill.source.repo}/blob/${revision}/${local.file}` };
} else {
  const tree = git("ls-tree", "-r", "--full-tree", "--name-only", "HEAD").split("\n").filter(Boolean);
  const rootLicense = tree.find((file) => /^LICEN[CS]E(\.txt|\.md)?$/i.test(file));
  if (!rootLicense) throw new Error("No skill-local or repository-root license file");
  const rootEntry = git("ls-tree", "--full-tree", "HEAD", "--", rootLicense).split(/\s+/);
  const rootSpdx = detectLicense(blob(rootEntry[2]).toString("utf8"));
  if (!["MIT", "Apache-2.0"].includes(rootSpdx)) {
    throw new Error("Repository-root license is neither MIT nor Apache-2.0; only skill-local licenses are accepted for this repository");
  }
  const ancestors = new Set(sourcePath.split("/").map((_, i, parts) => parts.slice(0, i + 1).join("/")));
  const overrides = tree.filter((file) => LICENSE_FILE.test(file) && file !== rootLicense
    && (!file.includes("/") || ancestors.has(path.posix.dirname(file)) || file.startsWith(sourcePath + "/")));
  if (overrides.length) throw new Error("Nested license, copying, or notice files apply to this skill: " + overrides.join(", "));
  const declared = parseFrontmatter(blob(entries.find((entry) => entry.file === sourcePath + "/SKILL.md").blob).toString("utf8")).license?.trim();
  const declaredOk = rootSpdx === "MIT" ? /^MIT(?: License)?$/i : /^Apache(?:[- ]License)?[- ]2\.0$/i;
  if (declared && !declaredOk.test(declared)) throw new Error(`SKILL.md declares a different license: ${declared}`);
  const target = "LICENSE.txt";
  if (entries.some((entry) => path.posix.relative(sourcePath, entry.file).toLowerCase() === target.toLowerCase())) throw new Error("Attached license path collides with an upstream file");
  license = {
    spdx: rootSpdx, scope: "repository", path: target, source_path: rootLicense,
    url: `https://github.com/${skill.source.repo}/blob/${revision}/${rootLicense}`,
    ancestor_check: { complete: true, overrides: [], checked: [...ancestors] }
  };
  attached = { mode: rootEntry[0], blob: rootEntry[2], file: rootLicense };
}

const describe = (entry, relative, extra = {}) => {
  const bytes = blob(entry.blob);
  return {
    path: relative,
    ...extra,
    sha256: sha256(bytes),
    bytes: bytes.length,
    mode: "100644",
    git_blob: entry.blob,
    license: license.spdx,
    covered_by: license.path,
    license_reason: "",
    findings: scanText(bytes.toString("utf8")).findings.map((finding) => ({ ...finding, disposition: "pending", reason: "" }))
  };
};
const files = entries.map((entry) => describe(entry, path.posix.relative(sourcePath, entry.file)));
if (attached) files.push(describe(attached, license.path, { attached: true, source_path: attached.file }));
files.sort((a, b) => a.path.localeCompare(b.path));

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
    ...license,
    redistributable: true,
    scope_reason: "",
    obligations: [
      license.scope === "repository"
        ? "Ship a byte-exact copy of the repository-root license, including its copyright notice, with the skill."
        : "Redistribute the original license file with the skill.",
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
