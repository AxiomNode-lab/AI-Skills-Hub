#!/usr/bin/env node
import fs from "node:fs";
import { loadRegistry } from "../packages/core/src/index.mjs";
import { materializeSkill, writeMaterializationManifest } from "../packages/materializer/src/index.mjs";

const args=process.argv.slice(2);
const ids=args.length?args:JSON.parse(fs.readFileSync("catalog/bundles.json","utf8")).bundles["@core"] ?? [];
const registry=loadRegistry();
const byId=new Map(registry.skills.map(s=>[s.id,s]));
const selected=ids.map(id=>{
  const s=byId.get(id);
  if(!s) throw new Error("Unknown skill: "+id);
  return s;
});
const outputRoot="vendor/skills";
if(selected.some((skill)=>skill.release?.status!=="eligible")){
  const ids=selected.filter((skill)=>skill.release?.status!=="eligible").map((skill)=>skill.id);
  throw new Error("Materialization blocked; skills have not passed release gates: "+ids.join(", "));
}
for(const skill of selected){
  const result=await materializeSkill(skill,{root:outputRoot,token:process.env.GITHUB_TOKEN});
  writeMaterializationManifest(result);
  console.log("Materialized",skill.id,"=>",result.materialized_files.length,"files");
}
