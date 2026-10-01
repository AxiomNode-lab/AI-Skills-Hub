import fs from "node:fs";
import path from "node:path";
import { normalizeSkillDirectory, resolveInstallRoot } from "./targets.mjs";
import {
  buildInstallRecord,
  removeInstallRecord,
  writeInstallRecord,
  readInstallRecords,
  verifyInstallRecord
} from "./state.mjs";

function safeInside(root, candidate) {
  const r = path.resolve(root);
  const c = path.resolve(candidate);
  return c === r || c.startsWith(r + path.sep);
}

function copyDirectory(src, destination, overwrite = false) {
  if (!fs.existsSync(path.join(src, "SKILL.md"))) {
    throw new Error("Materialized skill is missing SKILL.md: " + src);
  }
  if (fs.existsSync(destination) && !overwrite) {
    throw new Error("Destination exists; pass overwrite=true: " + destination);
  }

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(src, destination, {
    recursive: true,
    force: overwrite,
    errorOnExist: !overwrite,
    dereference: true
  });
}

export function installMaterializedSkill(skill, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const scope = options.scope ?? "project";
  const agent = options.agent ?? "agent-skills";
  const overwrite = options.overwrite === true;

  if (
    skill.distribution !== "bundled" ||
    !skill.materialized ||
    skill.release?.status !== "eligible"
  ) {
    throw new Error("Skill is not a release-eligible materialized bundled artifact: " + skill.id);
  }

  const sourceRoot = path.resolve(skill.materialized_root);
  if (!fs.existsSync(sourceRoot)) {
    throw new Error("Materialized root not found: " + sourceRoot);
  }

  const root = resolveInstallRoot(agent, scope, cwd);
  const destination = normalizeSkillDirectory(root, skill.name);
  if (!safeInside(root, destination)) throw new Error("Unsafe installation path");

  copyDirectory(sourceRoot, destination, overwrite);

  const record = buildInstallRecord(skill, destination, { agent, scope });
  writeInstallRecord(record, cwd);

  return {
    id: skill.id,
    agent,
    scope,
    root,
    destination,
    action: "installed",
    file_count: record.files.length
  };
}

export function verifyInstalledSkill(skillId, options = {}) {
  const scope = options.scope ?? "project";
  const cwd = options.cwd ?? process.cwd();
  const records = readInstallRecords(scope, cwd);
  const record = records[skillId];
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
  const record = records[skillId];

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

  if (!force) {
    const verification = verifyInstallRecord(record);
    if (!verification.ok) {
      throw new Error(
        "Installed files changed; use --force to remove: " + verification.reason
      );
    }
  }

  fs.rmSync(destination, { recursive: true, force: true });
  removeInstallRecord(skillId, scope, cwd);
  return {
    id: skillId,
    action: "removed",
    destination
  };
}
