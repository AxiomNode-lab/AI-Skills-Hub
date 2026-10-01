import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { normalizeSkillDirectory, resolveInstallRoot } from "./targets.mjs";

function safeInside(root, candidate) {
  const r = path.resolve(root);
  const c = path.resolve(candidate);
  return c === r || c.startsWith(r + path.sep);
}

function copyDirectory(src, destination, overwrite = false) {
  if (!fs.existsSync(path.join(src, "SKILL.md"))) throw new Error("Materialized skill is missing SKILL.md: " + src);
  if (fs.existsSync(destination) && !overwrite) {
    throw new Error("Destination exists; pass overwrite=true: " + destination);
  }

  fs.mkdirSync(path.dirname(destination), {recursive:true});
  fs.cpSync(src, destination, {
    recursive:true,
    force:overwrite,
    errorOnExist:!overwrite,
    dereference:true
  });

}

export function installMaterializedSkill(skill, options = {}) {
  const cwd=options.cwd ?? process.cwd();
  const scope=options.scope ?? "project";
  const agent=options.agent ?? "agent-skills";
  const overwrite=options.overwrite === true;

  if (skill.distribution !== "bundled" || !skill.materialized) {
    throw new Error("Skill is not a materialized bundled artifact: " + skill.id);
  }
  const sourceRoot=path.resolve(skill.materialized_root);
  if (!fs.existsSync(sourceRoot)) throw new Error("Materialized root not found: " + sourceRoot);

  const root=resolveInstallRoot(agent,scope,cwd);
  const destination=normalizeSkillDirectory(root,skill.name);
  if (!safeInside(root,destination)) throw new Error("Unsafe installation path");

  copyDirectory(sourceRoot,destination,overwrite);

  return {
    id:skill.id,
    agent,
    scope,
    root,
    destination,
    action:"installed"
  };
}
