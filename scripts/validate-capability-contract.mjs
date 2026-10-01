import fs from "node:fs";

const registry=JSON.parse(fs.readFileSync("catalog/skills.json","utf8"));
const errors=[];
for(const skill of registry.skills??[]){
  if((skill.artifact_type??"skill")!=="skill") errors.push(skill.id+": invalid local artifact_type");
  if(!skill.id || !skill.name) errors.push((skill.id??"<unknown>")+": missing identity");
  if(!Array.isArray(skill.compatibility)) errors.push(skill.id+": compatibility must be an array");
  if(!skill.distribution) errors.push(skill.id+": missing distribution state");
}
if(errors.length){console.error(errors.join("\n"));process.exit(1);}
console.log("Local capability contract valid:",registry.skills.length,"Skills");
