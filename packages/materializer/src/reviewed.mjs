import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { scanText, riskLevel } from "../../security/src/index.mjs";
import { parseFrontmatter } from "../../core/src/index.mjs";

export const sha256 = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const riskOrder = ["none", "low", "medium", "high"];
const fail = message => { throw new Error(message); };

function relativeFile(value) {
  if (typeof value !== "string" || !value || value.includes("\\") || value.includes(":")) fail("Unsafe reviewed path");
  if (value.split("/").some(part => !part || part === "." || part === ".." || /[\x00-\x1f<>|?*]/.test(part) || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) fail("Unsafe reviewed path: " + value);
  return value;
}

export function validateReleaseReview(skill, review) {
  if (skill.distribution === "blocked") fail("Blocked skills cannot be released through this workflow");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill.name)) fail("Invalid skill name");
  if (review.skill_id !== skill.id || review.status !== "approved") fail("Missing approved artifact review");
  const source = review.source;
  if (!/^[0-9a-f]{40}$/.test(source?.revision ?? "")) fail("Immutable review revision required");
  if (source.repo !== skill.source?.repo || source.revision !== skill.source?.revision || source.path !== skill.source.path.replace(/\/SKILL\.md$/, "")) fail("Review provenance mismatch");
  relativeFile(source.path);
  if (review.license?.spdx !== "Apache-2.0" || review.license.redistributable !== true || !review.license.scope_reason) fail("Artifact-level Apache license review required");
  if (review.content_review?.status !== "approved" || review.content_review.blocking_findings?.length !== 0 || !review.content_review.notes?.length) fail("Unresolved content review");
  if (review.inventory?.complete !== true || review.inventory.scope !== source.path || !review.inventory.url?.includes(source.revision)) fail("Complete pinned upstream inventory required");
  if (!riskOrder.includes(review.content_review.risk) || review.content_review.risk === "high") fail("High or unknown review risk");
  if (!Array.isArray(review.files) || review.files.length === 0 || review.files.length > 256) fail("Invalid reviewed file inventory");
  const names = new Set();
  for (const file of review.files) {
    relativeFile(file.path);
    if (names.has(file.path.toLowerCase())) fail("Duplicate reviewed path");
    names.add(file.path.toLowerCase());
    // Initial releases intentionally support text-only skill packages. Executable
    // artifacts need a separate runtime/dependency review, not this shortcut.
    if (!/\.(md|txt)$/i.test(file.path) || file.mode !== "100644") fail("Only reviewed non-executable text files are supported");
    if (!/^[0-9a-f]{64}$/.test(file.sha256) || !/^[0-9a-f]{40}$/.test(file.git_blob)) fail("Missing reviewed file hashes");
    if (!Number.isInteger(file.bytes) || file.bytes < 1 || file.bytes > 2 * 1024 * 1024) fail("Invalid reviewed file size");
    if (file.license !== "Apache-2.0" || file.covered_by !== review.license.path || !file.license_reason) fail("File lacks redistribution evidence: " + file.path);
    if (!Array.isArray(file.findings) || file.findings.some(finding => finding.disposition !== "accepted" || !finding.reason)) fail("Unresolved scanner finding");
  }
  if (!review.files.some(file => file.path === "SKILL.md") || !review.files.some(file => file.path === review.license.path)) fail("Root SKILL.md and local license must be included");
}

export function verifyReviewedDirectory(skill, review, directory) {
  validateReleaseReview(skill, review);
  const root = path.resolve(directory);
  const actual = [];
  const walk = dir => {
    if (fs.lstatSync(dir).isSymbolicLink()) fail("Symlinks are forbidden");
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) fail("Symlinks are forbidden");
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) actual.push(path.relative(root, full).split(path.sep).join("/"));
      else fail("Unsupported filesystem entry");
    }
  };
  walk(root);
  if (JSON.stringify(actual.sort()) !== JSON.stringify(review.files.map(file => file.path).sort())) fail("Reviewed inventory mismatch");
  const capabilities = { shell: false, network: false, credentials: false, dynamic_execution: false, package_install: false, filesystem_write: false, encoded_content: false };
  const findings = [];
  let totalBytes = 0;
  for (const file of review.files) {
    const bytes = fs.readFileSync(path.join(root, file.path));
    if (bytes.length !== file.bytes || sha256(bytes) !== file.sha256) fail("Reviewed hash mismatch: " + file.path);
    const gitBlob = crypto.createHash("sha1").update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest("hex");
    if (gitBlob !== file.git_blob) fail("Git blob mismatch: " + file.path);
    totalBytes += bytes.length;
    if (totalBytes > 20 * 1024 * 1024) fail("Reviewed artifact too large");
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const scan = scanText(text);
    const reviewedFindings = file.findings.map(({ disposition, reason, ...finding }) => finding);
    if (JSON.stringify(scan.findings) !== JSON.stringify(reviewedFindings)) fail("Security findings changed: " + file.path);
    findings.push(...scan.findings.map(finding => ({ ...finding, file: file.path })));
    for (const key of Object.keys(capabilities)) capabilities[key] ||= scan.capabilities[key];
  }
  const skillText = fs.readFileSync(path.join(root, "SKILL.md"), "utf8");
  const fields = parseFrontmatter(skillText);
  const description = fields.description?.trim() ?? "";
  if (/^[>|][+-]?\d*$/.test(description)) fail("Unparsed frontmatter description");
  if (fields.name !== skill.name || !description || description.length > 1024 || fields.license !== `Complete terms in ${review.license.path}`) fail("Invalid licensed skill frontmatter");
  const license = fs.readFileSync(path.join(root, review.license.path), "utf8");
  if (!/Apache License\s+Version 2\.0/.test(license) || !license.includes("Grant of Copyright License") || !license.includes("Redistribution.")) fail("Local Apache license text missing");
  const rawRisk = riskLevel({ findings });
  if (rawRisk === "high") fail("High-risk scanner finding blocks release");
  for (const key of Object.keys(capabilities)) capabilities[key] ||= review.content_review.capabilities?.[key] === true;
  const risk = riskOrder[Math.max(riskOrder.indexOf(rawRisk), riskOrder.indexOf(review.content_review.risk))];
  return { status: "verified", risk, capabilities, findings, total_bytes: totalBytes };
}

export function prepareReviewedSkill(skill, review, sourceDirectory, stagingRoot) {
  // Validate completely before writing; this function never changes catalog state.
  const security = verifyReviewedDirectory(skill, review, sourceDirectory);
  fs.mkdirSync(stagingRoot, { recursive: true });
  const target = fs.mkdtempSync(path.join(path.resolve(stagingRoot), "reviewed-"));
  for (const file of review.files) {
    const out = path.join(target, file.path);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.copyFileSync(path.join(sourceDirectory, file.path), out);
    fs.chmodSync(out, 0o644);
  }
  verifyReviewedDirectory(skill, review, target);
  return { target, security };
}
