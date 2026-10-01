import fs from "node:fs";
import path from "node:path";

export function validatePluginName(name) {
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(name)) {
    throw new Error("Invalid plugin name: " + name);
  }
  return name;
}

export function buildPortablePluginManifest({name,version="1.0.0",description,repository,license,author}) {
  validatePluginName(name);
  if (!description) throw new Error("Plugin description is required");

  return {
    $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
    name,
    version,
    description,
    ...(author ? {author} : {}),
    ...(repository ? {repository} : {}),
    ...(license ? {license} : {}),
    skills: "./skills/"
  };
}

function thirdPartyNotices(skills) {
  const lines=[
    "# Third-Party Notices",
    "",
    "This package contains Skills authored by third parties. Each Skill keeps its upstream license and provenance.",
    ""
  ];

  for(const skill of skills){
    lines.push("## " + skill.name);
    lines.push("");
    lines.push("- Publisher: " + (skill.publisher ?? "Unknown"));
    lines.push("- License: " + (skill.license?.spdx ?? "NOASSERTION"));
    lines.push("- Source: https://github.com/" + skill.source.repo);
    lines.push("- Source path: " + skill.source.path);
    if(skill.source.revision) lines.push("- Source revision: " + skill.source.revision);
    lines.push("");
  }

  return lines.join("\n") + "\n";
}

export function exportPortablePlugin({outputDir,manifest,skills=[]}) {
  const root=path.resolve(outputDir);
  fs.rmSync(root,{recursive:true,force:true});
  fs.mkdirSync(path.join(root,"skills"),{recursive:true});

  fs.writeFileSync(path.join(root,"plugin.json"),JSON.stringify(manifest,null,2)+"\n");

  const codexRoot=path.join(root,".codex-plugin");
  fs.mkdirSync(codexRoot,{recursive:true});
  fs.writeFileSync(path.join(codexRoot,"plugin.json"),JSON.stringify(manifest,null,2)+"\n");

  for(const skill of skills){
    if(!skill.materialized || !skill.materialized_root){
      throw new Error("Cannot export non-materialized skill: " + skill.id);
    }
    const dest=path.join(root,"skills",skill.name);
    fs.cpSync(path.resolve(skill.materialized_root),dest,{recursive:true,dereference:true});
  }

  fs.writeFileSync(path.join(root,"THIRD-PARTY-NOTICES.md"),thirdPartyNotices(skills));

  return {
    root,
    manifest:path.join(root,"plugin.json"),
    codexManifest:path.join(codexRoot,"plugin.json"),
    notices:path.join(root,"THIRD-PARTY-NOTICES.md"),
    skillCount:skills.length
  };
}
