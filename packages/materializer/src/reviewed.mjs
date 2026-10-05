import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { scanText, riskLevel } from "../../security/src/index.mjs";
import { parseFrontmatter } from "../../core/src/index.mjs";

export const sha256 = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const riskOrder = ["none", "low", "medium", "high"];
const fail = message => { throw new Error(message); };
// MIT must be the complete standard text after a copyright line: a partial or
// edited grant is not accepted as MIT.
const MIT_TERMS = `Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;
const normalizedTerms = (text) => text.replace(/\s+/g, " ").trim().replace(/\.$/, "");

function isCompleteMit(text) {
  const body = text.replace(/^\s*MIT License\s*/i, "");
  const copyright = body.match(/^\s*Copyright\s+(?:\(c\)|©)[^\r\n]+\r?\n/i);
  return !!copyright && normalizedTerms(body.slice(copyright[0].length)) === normalizedTerms(MIT_TERMS);
}

// Accepted licenses and how to recognize their full text. MIT or Apache-2.0 may
// also come from the repository root (scope "repository"): only when the review
// records that no nested license, copying, or notice file applies to the skill
// (for Apache-2.0 this also means no NOTICE file must be carried), and a
// byte-exact copy of the root license ships with the skill (an "attached" file).
const LICENSE_TEXT = {
  "Apache-2.0": text => /Apache License\s+Version 2\.0/.test(text) && text.includes("Grant of Copyright License") && text.includes("Redistribution."),
  MIT: isCompleteMit
};

export function detectLicense(text) {
  return Object.keys(LICENSE_TEXT).find(spdx => LICENSE_TEXT[spdx](text)) ?? null;
}

function validateLicenseReview(review) {
  const license = review.license;
  if (!LICENSE_TEXT[license?.spdx] || license.redistributable !== true || !license.scope_reason) fail("Artifact-level license review required");
  const scope = license.scope ?? "skill-local";
  if (scope === "skill-local") {
    if (review.files.some(file => file.attached)) fail("Skill-local licenses do not attach files");
    return;
  }
  if (scope !== "repository" || !["MIT", "Apache-2.0"].includes(license.spdx)) fail("Only MIT or Apache-2.0 may be accepted from the repository root");
  if (typeof license.source_path !== "string" || license.source_path.includes("/")) fail("Repository license must be a root file");
  relativeFile(license.source_path);
  if (license.ancestor_check?.complete !== true || !Array.isArray(license.ancestor_check.overrides) || license.ancestor_check.overrides.length) {
    fail("Repository license requires a complete check with no nested license, copying, or notice files");
  }
  const attached = review.files.filter(file => file.attached);
  if (attached.length !== 1 || attached[0].path !== license.path || attached[0].source_path !== license.source_path) fail("The root license must be attached exactly once");
}

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
  if (review.content_review?.status !== "approved" || review.content_review.blocking_findings?.length !== 0 || !review.content_review.notes?.length) fail("Unresolved content review");
  if (review.inventory?.complete !== true || review.inventory.scope !== source.path || !review.inventory.url?.includes(source.revision)) fail("Complete pinned upstream inventory required");
  if (!riskOrder.includes(review.content_review.risk) || review.content_review.risk === "high") fail("High or unknown review risk");
  if (!Array.isArray(review.files) || review.files.length === 0 || review.files.length > 256) fail("Invalid reviewed file inventory");
  validateLicenseReview(review);
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
    if (file.license !== review.license.spdx || file.covered_by !== review.license.path || !file.license_reason) fail("File lacks redistribution evidence: " + file.path);
    if (!Array.isArray(file.findings) || file.findings.some(finding => finding.disposition !== "accepted" || !finding.reason)) fail("Unresolved scanner finding");
  }
  if (!review.files.some(file => file.path === "SKILL.md" && !file.attached) || !review.files.some(file => file.path === review.license.path)) fail("Root SKILL.md and license must be included");
}

export function verifyReviewedDirectory(skill, review, directory) {
  validateReleaseReview(skill, review);
  const root = path.resolve(directory);
  const actual = listFiles(root);
  if (JSON.stringify(actual) !== JSON.stringify(review.files.map(file => file.path).sort())) fail("Reviewed inventory mismatch");
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
  if (fields.name !== skill.name || !description || description.length > 1024) fail("Invalid skill frontmatter");
  // A declared license must agree with the reviewed one.
  const declared = fields.license?.trim();
  const agrees = declared === `Complete terms in ${review.license.path}`
    || (review.license.spdx === "MIT" && (declared === undefined || /^MIT(?: License)?$/i.test(declared)))
    || (review.license.spdx === "Apache-2.0" && review.license.scope === "repository" && (declared === undefined || /^Apache(?:[- ]License)?[- ]2\.0$/i.test(declared)));
  if (!agrees) fail("Skill frontmatter license conflicts with the reviewed license");
  const license = fs.readFileSync(path.join(root, review.license.path), "utf8");
  if (!LICENSE_TEXT[review.license.spdx](license)) fail(`${review.license.spdx} license text missing`);
  const rawRisk = riskLevel({ findings });
  if (rawRisk === "high") fail("High-risk scanner finding blocks release");
  for (const key of Object.keys(capabilities)) capabilities[key] ||= review.content_review.capabilities?.[key] === true;
  const risk = riskOrder[Math.max(riskOrder.indexOf(rawRisk), riskOrder.indexOf(review.content_review.risk))];
  return { status: "verified", risk, capabilities, findings, total_bytes: totalBytes };
}

function listFiles(root) {
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
  return actual.sort();
}

// The upstream checkout root that contains the reviewed source directory.
function checkoutRoot(review, sourceDirectory) {
  const resolved = path.resolve(sourceDirectory);
  const suffix = path.join(...review.source.path.split("/"));
  if (!resolved.endsWith(path.sep + suffix)) fail("Source directory does not match the reviewed source path");
  return resolved.slice(0, -suffix.length - 1);
}

export function prepareReviewedSkill(skill, review, sourceDirectory, stagingRoot) {
  // Validate completely before writing; this function never changes catalog state.
  validateReleaseReview(skill, review);
  const upstream = review.files.filter(file => !file.attached).map(file => file.path).sort();
  if (JSON.stringify(listFiles(path.resolve(sourceDirectory))) !== JSON.stringify(upstream)) fail("Reviewed inventory mismatch");
  const attachedRoot = review.files.some(file => file.attached) ? checkoutRoot(review, sourceDirectory) : null;
  const sources = review.files.map(file => {
    const from = file.attached ? path.join(attachedRoot, file.source_path) : path.join(sourceDirectory, file.path);
    if (fs.lstatSync(from).isSymbolicLink()) fail("Symlinks are forbidden");
    const bytes = fs.readFileSync(from);
    if (bytes.length !== file.bytes || sha256(bytes) !== file.sha256) fail("Reviewed hash mismatch: " + file.path);
    return { file, from };
  });
  fs.mkdirSync(stagingRoot, { recursive: true });
  const target = fs.mkdtempSync(path.join(path.resolve(stagingRoot), "reviewed-"));
  for (const { file, from } of sources) {
    const out = path.join(target, file.path);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.copyFileSync(from, out);
    fs.chmodSync(out, 0o644);
  }
  const security = verifyReviewedDirectory(skill, review, target);
  return { target, security };
}
