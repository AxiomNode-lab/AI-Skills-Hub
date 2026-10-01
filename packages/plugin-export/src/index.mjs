import fs from "node:fs";
import path from "node:path";

export function validatePluginName(name) {
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(name)) {
    throw new Error("Invalid plugin name: " + name);
  }
  return name;
}

export function buildPortablePluginManifest({name,version="1.0.0",description,repository,license="MIT",author}) {
  validatePluginName(name);
  if (!description) throw new Error("Plugin description is required");
  return {
    $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
    name,
    version,
    description,
    ...(author ? {author} : {}),
    ...(repository ? {repository} : {}),
    license,
    skills: "./skills/",
  };
}

export function exportPortablePlugin({outputDir, manifest, skills=[]}) {
  const root=path.resolve(outputDir);
  fs.rmSync(root,{recursive:true,force:true});
  fs.mkdirSync(path.join(root,"skills"),{recursive:true});
  fs.writeFileSync(path.join(root,"plugin.json"),JSON.stringify(manifest,null,2)+"\n");

  for(const skill of skills){
    if(!skill.materialized || !skill.materialized_root){
      throw new Error("Cannot export non-materialized skill: " + skill.id);
    }
    const dest=path.join(root,"skills",skill.name);
    fs.cpSync(path.resolve(skill.materialized_root),dest,{recursive:true,dereference:true});
  }

  return {
    root,
    manifest:path.join(root,"plugin.json"),
    skillCount:skills.length
  };
}
