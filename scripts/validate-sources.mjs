import fs from "node:fs";

const sources=JSON.parse(fs.readFileSync("catalog/sources.json","utf8"));
const agents=JSON.parse(fs.readFileSync("catalog/agents.json","utf8"));
const errors=[];
const sourceIds=new Set();
for(const source of sources.sources??[]){
  if(sourceIds.has(source.id)) errors.push("duplicate source: "+source.id);
  sourceIds.add(source.id);
  if(source.kind==="github"){
    if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(source.repo??"")) errors.push("invalid github repo: "+source.id);
    if(!source.default_branch) errors.push("github source missing default_branch: "+source.id);
    if(source.ingest_enabled===true && source.official===undefined && !source.priority) errors.push("enabled source lacks provenance class: "+source.id);
  }else if(!source.url){
    errors.push("non-github source missing url: "+source.id);
  }
}
const agentIds=new Set();
for(const agent of agents.agents??[]){
  if(agentIds.has(agent.id)) errors.push("duplicate agent: "+agent.id);
  agentIds.add(agent.id);
  if(!Array.isArray(agent.nativeSkillDirs)||agent.nativeSkillDirs.length===0) errors.push("agent missing skill dirs: "+agent.id);
}
if(errors.length){console.error(errors.join("\n"));process.exit(1);}
console.log("Source/agent manifests valid:",sourceIds.size,"sources;",agentIds.size,"agents");
