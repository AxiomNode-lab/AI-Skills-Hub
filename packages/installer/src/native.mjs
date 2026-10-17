import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveHubPath } from "@ai-skills-hub/core";
import { normalizeSkillDirectory, resolveInstallRoot } from "./targets.mjs";
import {
  buildInstallRecord,
  removeInstallRecord,
  writeInstallRecord,
  readInstallRecords,
  verifyInstallRecord,
  findInstallRecord,
  installRecordsFor
} from "./state.mjs";

// Refuses a target reached through a symlink or junction: every existing
// component from the scope base (project or home directory) down to the
// target must be a real directory, so an install or uninstall cannot be
// redirected outside the project by a planted link such as .agents -> /etc.
export function assertNoSymlinkPath(base, target) {
  const relative = path.relative(path.resolve(base), path.resolve(target));
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Install target is outside its scope: " + target);
  let current = path.resolve(base);
  for (const part of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error("Refusing to follow a symbolic link in the install path: " + current);
  }
}

function safeInside(root, candidate) {
  const r = path.resolve(root);
  const c = path.resolve(candidate);
  return c === r || c.startsWith(r + path.sep);
}

const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

// Reads a released artifact and checks it against its release manifest: the
// same skill and pinned source, exactly the listed regular files (no symlinks,
// no extras), and every file's size and SHA-256. Returns the verified bytes, so
// what is installed is exactly what was checked.
export function verifiedArtifact(skill) {
  const manifestPath = resolveHubPath(`catalog/materialized-manifests/${skill.id.replaceAll("/", "__")}.json`);
  if (!fs.existsSync(manifestPath)) throw new Error("Release manifest not found for " + skill.id);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.skill_id !== skill.id || manifest.source?.repo !== skill.source?.repo || manifest.source?.revision !== skill.source?.revision || manifest.source?.path !== skill.source?.path) {
    throw new Error("Release manifest does not match the catalog record for " + skill.id);
  }
  const root = resolveHubPath(skill.materialized_root);
  const found = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) throw new Error("Released artifact contains a symlink: " + full);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) found.push(path.relative(root, full).split(path.sep).join("/"));
      else throw new Error("Released artifact contains an unsupported entry: " + full);
    }
  };
  if (fs.lstatSync(root).isSymbolicLink()) throw new Error("Released artifact root is a symlink: " + root);
  walk(root);
  const expected = manifest.materialized_files.map((file) => file.path).sort();
  if (JSON.stringify(found.sort()) !== JSON.stringify(expected)) throw new Error("Released artifact files do not match the manifest for " + skill.id);
  const files = new Map();
  for (const file of manifest.materialized_files) {
    if (file.path.split("/").some((part) => part === ".." || part === "" || part === ".")) throw new Error("Unsafe manifest path: " + file.path);
    const bytes = fs.readFileSync(path.join(root, ...file.path.split("/")));
    if (bytes.length !== file.bytes || sha256(bytes) !== file.sha256) throw new Error("Released file does not match its manifest hash: " + file.path);
    files.set(file.path, bytes);
  }
  if (!files.has("SKILL.md")) throw new Error("Released artifact is missing SKILL.md: " + skill.id);
  return files;
}

// Writes verified files into a new directory. An existing destination is
// replaced as a whole (the caller has checked ownership), so no stale files
// from an earlier version remain.
function writeVerifiedFiles(files, destination, overwrite = false) {
  if (fs.existsSync(destination)) {
    if (!overwrite) throw new Error("Destination exists; pass overwrite=true: " + destination);
    fs.rmSync(destination, { recursive: true, force: true });
  }
  for (const [relative, bytes] of files) {
    const target = path.join(destination, ...relative.split("/"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes, { flag: "wx" });
  }
}

// Every check an install makes before it writes: release state, the artifact
// against its manifest, the destination path, and ownership of an existing
// folder. Writes nothing, so a multi-skill install can check all items first.
export function checkMaterializedInstall(skill, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const scope = options.scope ?? "project";
  const agent = options.agent ?? "agent-skills";
  const overwrite = options.overwrite === true;
  const force = options.force === true;

  if (
    skill.distribution !== "bundled" ||
    !skill.materialized ||
    skill.release?.status !== "eligible"
  ) {
    throw new Error("Skill is not a release-eligible materialized bundled artifact: " + skill.id);
  }

  const sourceRoot = resolveHubPath(skill.materialized_root);
  if (!fs.existsSync(sourceRoot)) {
    throw new Error("Materialized root not found: " + sourceRoot);
  }
  const files = verifiedArtifact(skill);

  const root = resolveInstallRoot(agent, scope, cwd);
  const destination = normalizeSkillDirectory(root, skill.name);
  if (!safeInside(root, destination)) throw new Error("Unsafe installation path");
  assertNoSymlinkPath(scope === "user" ? os.homedir() : cwd, destination);

  if (fs.existsSync(destination)) {
    if (!overwrite) {
      throw new Error("Destination exists; pass --overwrite to replace: " + destination);
    }
    // Agents that share a skills folder (Codex, Cursor) share its records: the
    // folder is managed when any record of this skill points at it.
    const existing = installRecordsFor(readInstallRecords(scope, cwd), skill.id)
      .find((record) => path.resolve(record.destination ?? "") === path.resolve(destination));
    if (!existing) {
      if (!force) {
        throw new Error("Destination is not managed by AI Skills Hub; pass --force to replace: " + destination);
      }
    } else {
      const verification = verifyInstallRecord(existing);
      if (!verification.ok && !force) {
        throw new Error("Existing installation changed; pass --force to replace: " + verification.reason);
      }
    }
  }

  return { files, root, destination, agent, scope, cwd };
}

export function installMaterializedSkill(skill, options = {}) {
  const persistState = options.persistState !== false;
  const { files, root, destination, agent, scope, cwd } = checkMaterializedInstall(skill, options);

  writeVerifiedFiles(files, destination, options.overwrite === true);

  const record = buildInstallRecord(skill, destination, { agent, scope });
  if (persistState) writeInstallRecord(record, cwd);

  return {
    id: skill.id,
    agent,
    scope,
    root,
    destination,
    action: "installed",
    file_count: record.files.length,
    record
  };
}

// Captures a destination folder (files, directories and symlinks, without
// following links) so a failed multi-skill install can put it back.
export function captureDirectory(destination) {
  let stat;
  try {
    stat = fs.lstatSync(destination);
  } catch (error) {
    if (error.code === "ENOENT") return { existed: false, entries: [] };
    throw error;
  }
  if (!stat.isDirectory()) throw new Error("Install destination is not a directory: " + destination);
  const entries = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const relative = path.relative(destination, full);
      if (entry.isSymbolicLink()) entries.push({ path: relative, type: "symlink", target: fs.readlinkSync(full) });
      else if (entry.isDirectory()) { entries.push({ path: relative, type: "dir" }); visit(full); }
      else if (entry.isFile()) entries.push({ path: relative, type: "file", bytes: fs.readFileSync(full), mode: fs.statSync(full).mode & 0o777 });
      else throw new Error("Install destination contains an unsupported entry: " + full);
    }
  };
  visit(destination);
  return { existed: true, entries };
}

// Puts a destination back to what captureDirectory saw (removes it if it did
// not exist). The caller has already checked the path is inside the skills root.
export function restoreDirectory(destination, snapshot) {
  fs.rmSync(destination, { recursive: true, force: true });
  if (!snapshot.existed) return;
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of snapshot.entries) {
    const target = path.join(destination, entry.path);
    if (entry.type === "dir") fs.mkdirSync(target, { recursive: true });
    else if (entry.type === "symlink") fs.symlinkSync(entry.target, target);
    else fs.writeFileSync(target, entry.bytes, { mode: entry.mode });
  }
}

// The record for a skill and agent; without an agent, the only record of that
// skill (null when there are none or several).
function recordFor(records, skillId, agent) {
  if (agent) return findInstallRecord(records, skillId, agent);
  const all = installRecordsFor(records, skillId);
  return all.length === 1 ? all[0] : null;
}

export function verifyInstalledSkill(skillId, options = {}) {
  const scope = options.scope ?? "project";
  const cwd = options.cwd ?? process.cwd();
  const records = readInstallRecords(scope, cwd);
  const record = recordFor(records, skillId, options.agent);
  if (!record) return { ok: false, reason: "installation_not_recorded", skill_id: skillId };
  return verifyInstallRecord(record);
}

export function doctorInstalledSkills(options = {}) {
  const scope = options.scope ?? "project";
  const cwd = options.cwd ?? process.cwd();
  const records = readInstallRecords(scope, cwd);
  return Object.values(records).map((record) => verifyInstallRecord(record));
}

export function uninstallSkillRecord(skillId, options = {}) {
  const scope = options.scope ?? "project";
  const cwd = options.cwd ?? process.cwd();
  const force = options.force === true;
  const records = readInstallRecords(scope, cwd);
  const record = recordFor(records, skillId, options.agent);

  if (!record) throw new Error("Installation record not found: " + skillId);

  const destination = path.resolve(record.destination);
  const root = resolveInstallRoot(record.agent ?? "agent-skills", scope, cwd);
  const base = path.basename(destination);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(base)) {
    throw new Error("Invalid recorded skill destination");
  }
  if (!safeInside(root, destination) || path.dirname(destination) !== path.resolve(root)) {
    throw new Error("Unsafe recorded destination");
  }
  assertNoSymlinkPath(scope === "user" ? os.homedir() : cwd, destination);

  if (!force) {
    const verification = verifyInstallRecord(record);
    if (!verification.ok) {
      throw new Error(
        "Installed files changed; use --force to remove: " + verification.reason
      );
    }
  }

  // A folder shared by agents (Codex and Cursor both use .agents/skills) stays
  // until the last agent's record is removed.
  const sharedWith = installRecordsFor(records, skillId)
    .filter((other) => other.agent !== record.agent && path.resolve(other.destination ?? "") === destination)
    .map((other) => other.agent);
  if (sharedWith.length === 0) fs.rmSync(destination, { recursive: true, force: true });
  removeInstallRecord(skillId, scope, cwd, record.agent);
  return {
    id: skillId,
    agent: record.agent,
    action: sharedWith.length ? "record-removed" : "removed",
    destination,
    ...(sharedWith.length ? { kept_for: sharedWith } : {})
  };
}
