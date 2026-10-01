#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const registry=JSON.parse(fs.readFileSync("catalog/skills.json","utf8"));
const failures=[];

function parseFrontmatter(body){
  const lines=body.split(/\r?\n/);
  if(lines[0]?.trim()!=="---") throw new Error("SKILL.md must start with YAML frontmatter");
  const result={};
  let closed=false;
  for(const line of lines.slice(1)){
    if(line.trim()==="---"){closed=true;break;}
    const match=line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if(match) result[match[1]]=match[2].trim().replace(/^['"]|['"]$/g,"");
  }
  if(!closed) throw new Error("Unclosed YAML frontmatter");
  return result;
}

for(const skill of registry.skills.filter((s)=>s.materialized)){
  if(!skill.materialized_root){
    failures.push(skill.id+": missing materialized_root");
    continue;
  }
  const root=path.resolve(skill.materialized_root);
  const file=path.join(root,"SKILL.md");
  if(!fs.existsSync(file)){
    failures.push(skill.id+": missing SKILL.md");
    continue;
  }
  try{
    const fm=parseFrontmatter(fs.readFileSync(file,"utf8"));
    if(!fm.name) throw new Error("missing name");
    if(!fm.description) throw new Error("missing description");
    if(fm.name.length>64) throw new Error("name exceeds 64 characters");
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(fm.name)) throw new Error("invalid skill name");
    if(fm.description.length>1024) throw new Error("description exceeds 1024 characters");
    if(path.basename(root)!==fm.name) throw new Error("directory name does not match frontmatter name");
  }catch(err){
    failures.push(skill.id+": "+err.message);
  }
}

if(failures.length){
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Materialized Skill validation passed:",registry.skills.filter((s)=>s.materialized).length,"skills");
