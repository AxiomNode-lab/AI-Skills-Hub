#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { prepareReviewedSkill, verifyReviewedDirectory, sha256 } from "../packages/materializer/src/reviewed.mjs";

const [id, sourceDirectory] = process.argv.slice(2);
if (!id || !sourceDirectory) throw new Error("Usage: node scripts/release-reviewed.mjs <id> <reviewed-source-directory>");
const registryPath = "catalog/skills.json";
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const skill = registry.skills.find(item => item.id === id);
if (!skill) throw new Error("Unknown skill: " + id);
if (!/^[a-z0-9._-]+\/[a-z0-9-]+$/.test(id)) throw new Error("Unsupported reviewed skill ID");
const reviewPath = "catalog/reviews/" + id.replaceAll("/", "__") + ".json";
const reviewBytes = fs.readFileSync(reviewPath);
const review = JSON.parse(reviewBytes);
const destination = path.join("skills", id);
if (fs.existsSync(destination)) throw new Error("Refusing to replace an existing release directory: " + destination);
const staged = prepareReviewedSkill(skill, review, sourceDirectory, ".ai-skills-hub/release-staging");
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.renameSync(staged.target, destination);
verifyReviewedDirectory(skill, review, destination);
const manifest = {
  schema_version: "0.2", skill_id: id, source: review.source,
  review: { path: reviewPath, sha256: sha256(reviewBytes) },
  security_scan: staged.security,
  materialized_files: review.files.map(({ path, sha256, bytes, mode, attached, source_path }) => ({ path, sha256, bytes, mode, ...(attached ? { attached, source_path } : {}) })),
  total_bytes: staged.security.total_bytes
};
fs.mkdirSync("catalog/materialized-manifests", { recursive: true });
fs.writeFileSync("catalog/materialized-manifests/" + id.replaceAll("/", "__") + ".json", JSON.stringify(manifest, null, 2) + "\n");
// Publish eligibility only after the files and their evidence exist and verify.
Object.assign(skill, {
  artifact_type: "skill", source: { ...review.source, state: "present", revision_type: "git-commit", url: `https://github.com/${review.source.repo}/tree/${review.source.revision}/${review.source.path}` },
  license: { spdx: review.license.spdx, redistributable: true, status: "verified", scope: review.license.scope ?? "skill-local", evidence: reviewPath },
  distribution: "bundled", materialized: true, materialized_root: destination.split(path.sep).join("/"), materialized_files: review.files.length,
  security: { scan_status: "verified", risk: staged.security.risk, ...staged.security.capabilities, findings: staged.security.findings, review: reviewPath },
  integrity: { upstream_skill_sha256: review.files.find(file => file.path === "SKILL.md" && !file.attached).sha256, last_ingested_revision: review.source.revision },
  release: { status: "eligible", reasons: [] }
});
fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + "\n");
console.log(`Released ${id}: ${review.files.length} verified files. Run generate-lock and validate-all before publication.`);
