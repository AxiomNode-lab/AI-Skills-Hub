import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const baseline = process.argv[2] ?? "8d2b4537";
const candidateRef = process.argv[3] ?? "refs/remotes/origin/pr10-latest";
const output = process.argv[4] ?? "docs/reviews/pr10-expansion-source-evidence.json";
const gitRead = (ref, file) => execFileSync("git", ["show", `${ref}:${file}`], { maxBuffer: 32 * 1024 * 1024 });
const gitJson = (ref, file) => JSON.parse(gitRead(ref, file).toString("utf8"));
const sha256 = data => crypto.createHash("sha256").update(data).digest("hex");
const gitBlob = data => crypto.createHash("sha1").update(`blob ${data.length}\0`).update(data).digest("hex");
const slash = value => value.split(path.sep).join("/");

function materializedTree(ref, directory) {
  const lines = execFileSync("git", ["ls-tree", "-r", ref, "--", directory], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }).trim().split(/\r?\n/).filter(Boolean);
  return lines.map(line => {
    const match = line.match(/^(\d+)\s+(\w+)\s+([0-9a-f]+)\t(.+)$/);
    if (!match) throw new Error(`Unexpected ls-tree output: ${line}`);
    return { mode: match[1], type: match[2], git_blob: match[3], path: slash(match[4].slice(directory.length + 1)) };
  });
}

function githubTree(repo, revision) {
  const apiPath = `repos/${repo}/git/trees/${revision}?recursive=1`;
  const stdout = execFileSync(process.platform === "win32" ? "C:\\Program Files\\GitHub CLI\\gh.exe" : "gh", ["api", apiPath], { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
  const result = JSON.parse(stdout);
  if (result.truncated) throw new Error(`GitHub returned a truncated tree for ${repo}@${revision}`);
  return result.tree;
}

const current = gitJson(candidateRef, "catalog/skills.json").skills;
const before = gitJson(baseline, "catalog/skills.json").skills;
const beforeReleasedIds = new Set(before.filter(skill => skill.materialized && skill.release?.status === "eligible").map(skill => skill.id));
const added = current.filter(skill => !beforeReleasedIds.has(skill.id) && skill.materialized && skill.release?.status === "eligible");
const groups = new Map();
for (const skill of added) {
  const key = `${skill.source.repo}@${skill.source.revision}`;
  if (!groups.has(key)) groups.set(key, { repo: skill.source.repo, revision: skill.source.revision, skills: [] });
  groups.get(key).skills.push(skill);
}

const sourceTrees = new Map();
for (const [key, group] of groups) sourceTrees.set(key, githubTree(group.repo, group.revision));

const evidence = [];
for (const skill of added.sort((a, b) => a.id.localeCompare(b.id))) {
  const reviewPath = `catalog/reviews/${skill.id.replaceAll("/", "__")}.json`;
  const manifestPath = `catalog/materialized-manifests/${skill.id.replaceAll("/", "__")}.json`;
  const review = gitJson(candidateRef, reviewPath);
  const manifest = gitJson(candidateRef, manifestPath);
  const materialized = materializedTree(candidateRef, skill.materialized_root);
  const actualPaths = materialized.map(file => file.path).sort();
  const reviewedPaths = review.files.map(file => file.path).sort();
  const manifestedPaths = manifest.materialized_files.map(file => file.path).sort();
  const tree = sourceTrees.get(`${skill.source.repo}@${skill.source.revision}`);
  const treeByPath = new Map(tree.map(entry => [entry.path, entry]));
  const sourcePrefix = `${skill.source.path.replace(/\/$/, "")}/`;
  const upstreamPaths = tree
    .filter(entry => entry.type === "blob" && entry.path.startsWith(sourcePrefix))
    .map(entry => entry.path.slice(sourcePrefix.length))
    .sort();
  const nonAttachedPaths = review.files.filter(file => !file.attached).map(file => file.path).sort();
  const ancestors = [];
  const parts = skill.source.path.split("/");
  for (let i = 0; i <= parts.length; i++) ancestors.push(parts.slice(0, i).join("/"));
  const ancestorNotices = tree.filter(entry => {
    const dir = entry.path.includes("/") ? entry.path.slice(0, entry.path.lastIndexOf("/")) : "";
    const name = entry.path.split("/").at(-1);
    return entry.type === "blob" && ancestors.includes(dir) && /^(license|copying|notice|copyright)(\.|$)/i.test(name);
  }).map(entry => ({ path: entry.path, mode: entry.mode, git_blob: entry.sha }));
  const nestedNotices = tree.filter(entry => entry.type === "blob" && entry.path.startsWith(sourcePrefix) && /(^|\/)(license|copying|notice|copyright)(\.|$)/i.test(entry.path)).map(entry => entry.path);
  const fileChecks = [];
  const instructionSignals = { shell_fences: 0, package_install: 0, destructive_or_mutating: 0, network_or_credentials: 0, external_relative_links: [] };
  for (const record of review.files) {
    const data = gitRead(candidateRef, `${skill.materialized_root}/${record.path}`);
    const sourcePath = record.attached ? record.source_path : `${sourcePrefix}${record.path}`;
    const upstream = treeByPath.get(sourcePath);
    fileChecks.push({
      path: record.path,
      source_path: sourcePath,
      local_sha256_matches: sha256(data) === record.sha256,
      local_bytes_match: data.length === record.bytes,
      local_git_blob_matches: gitBlob(data) === record.git_blob,
      upstream_git_blob_matches: upstream?.sha === record.git_blob,
      upstream_mode_matches: upstream?.mode === record.mode,
      manifest_matches: Boolean(manifest.materialized_files.find(item => item.path === record.path && item.sha256 === record.sha256 && item.bytes === record.bytes && item.mode === record.mode)),
    });
    if (/\.md$/i.test(record.path)) {
      const text = data.toString("utf8");
      instructionSignals.shell_fences += (text.match(/```(?:bash|sh|shell|powershell|pwsh|cmd)\b/gi) ?? []).length;
      instructionSignals.package_install += (text.match(/\b(?:pip|pipx|uv|npm|pnpm|yarn|brew|apt(?:-get)?)\s+(?:install|add)\b/gi) ?? []).length;
      instructionSignals.destructive_or_mutating += (text.match(/\b(?:rm\s+-|Remove-Item|git\s+(?:push|reset|merge|rebase)|delete|drop|purge|create|update|write|upload)\b/gi) ?? []).length;
      instructionSignals.network_or_credentials += (text.match(/\b(?:curl|wget|https?:\/\/|API[_ -]?KEY|TOKEN|PASSWORD|credential|authenticate|login)\b/gi) ?? []).length;
      for (const match of text.matchAll(/\[[^\]]*\]\((\.\.\/[^)#\s]+)[^)]*\)/g)) instructionSignals.external_relative_links.push({ file: record.path, target: match[1] });
    }
  }
  const mismatchCount = fileChecks.reduce((sum, check) => sum + Object.entries(check).filter(([key, value]) => key !== "path" && key !== "source_path" && value !== true).length, 0);
  evidence.push({
    id: skill.id,
    source: skill.source,
    review: reviewPath,
    manifest: manifestPath,
    review_binding_matches: review.skill_id === skill.id && review.source.repo === skill.source.repo && review.source.path === skill.source.path && review.source.revision === skill.source.revision,
    inventory_complete_claimed: review.inventory?.complete === true,
    actual_file_count: actualPaths.length,
    materialized_files: actualPaths,
    reviewed_file_count: reviewedPaths.length,
    upstream_subtree_file_count: upstreamPaths.length,
    actual_review_inventory_equal: JSON.stringify(actualPaths) === JSON.stringify(reviewedPaths),
    source_review_inventory_equal: JSON.stringify(upstreamPaths) === JSON.stringify(nonAttachedPaths),
    manifest_review_inventory_equal: JSON.stringify(manifestedPaths) === JSON.stringify(reviewedPaths),
    symlinks_or_special_files: materialized.filter(file => file.symlink || file.special).map(file => file.path),
    ancestor_license_notice_files: ancestorNotices,
    nested_license_notice_files: nestedNotices,
    instruction_signals: instructionSignals,
    file_check_mismatches: mismatchCount,
    failed_file_checks: fileChecks.filter(check => Object.entries(check).some(([key, value]) => key !== "path" && key !== "source_path" && value !== true)),
    automated_content_review_only: true,
  });
}

const summary = {
  baseline,
  candidate_ref: candidateRef,
  current: execFileSync("git", ["rev-parse", candidateRef], { encoding: "utf8" }).trim(),
  generated_at: new Date().toISOString(),
  added_eligible_materialized_skills: evidence.length,
  by_source: Object.fromEntries([...groups.values()].map(group => [`${group.repo}@${group.revision}`, group.skills.length])),
  files: evidence.reduce((sum, item) => sum + item.actual_file_count, 0),
  skills_with_integrity_or_inventory_failures: evidence.filter(item => !item.review_binding_matches || !item.inventory_complete_claimed || !item.actual_review_inventory_equal || !item.source_review_inventory_equal || !item.manifest_review_inventory_equal || item.symlinks_or_special_files.length || item.file_check_mismatches).map(item => item.id),
  skills_with_nested_license_or_notice_files: evidence.filter(item => item.nested_license_notice_files.length).map(item => item.id),
  skills_with_external_relative_links: evidence.filter(item => item.instruction_signals.external_relative_links.length).map(item => item.id),
  limitation: "Integrity, inventory, pinned-tree, license/notice discovery, and text signals are automated. automated_content_review_only is intentionally true for every item; these results do not establish task performance or substitute for instruction review.",
};
fs.writeFileSync(output, `${JSON.stringify({ summary, skills: evidence }, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
