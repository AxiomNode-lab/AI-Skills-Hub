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

  const manifestPath = path.join(destination, ".ai-skills-hub.json");
  const manifest = {
    installer_version: "0.1.0",
    installed_at: new Date().toISOString(),
    content_root: src,
    source_manifest: null,
    files: []
  };

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
      const full=path.join(dir,entry.name);
      if (entry.name === ".ai-skills-hub.json") continue;
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) {
        const bytes=fs.readFileSync(full);
        manifest.files.push({
          path:path.relative(destination,full).split(path.sep).join("/"),
          sha256:"sha256:"+crypto.createHash("sha256").update(bytes).digest("hex"),
          bytes:bytes.length
        });
      }
    }
  };
  walk(destination);
  fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+"\n");
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
