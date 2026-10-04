#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT=process.cwd();
const sources=JSON.parse(fs.readFileSync(path.join(ROOT,"catalog/sources.json"),"utf8"));
const registryFile=path.join(ROOT,"catalog/skills.json");
const registry=JSON.parse(fs.readFileSync(registryFile,"utf8"));
const previousGeneratedAt = registry.generated_at;
const previousSnapshot = JSON.stringify({
  schema_version: registry.schema_version,
  policy_version: registry.policy_version,
  skills: registry.skills
});
// --source <owner/repo> (repeatable) limits the sync to those sources, so other
// sources' records are not touched. --no-fetch uses catalog/ingestion as is.
const args=process.argv.slice(2);
const onlySources=args.flatMap((arg,i)=>arg==="--source"&&args[i+1]?[args[i+1]]:[]);
const noFetch=args.includes("--no-fetch");
const sourceEntries=sources.sources.filter((s)=>s.kind==="github" && s.repo && s.ingest_enabled === true && (!onlySources.length || onlySources.includes(s.repo)));
// include_paths narrows a source to the listed subtrees (for example, only the
// programming skills of a mixed repository).
const inScope=(source,itemPath)=>!source.include_paths || source.include_paths.some((p)=>itemPath===p || itemPath.startsWith(p+"/"));
if(onlySources.length && sourceEntries.length!==onlySources.length) throw new Error("Unknown or disabled --source: "+onlySources.filter((r)=>!sourceEntries.some((s)=>s.repo===r)).join(", "));

const namespaceByRepo={
  "anthropics/skills":"anthropics",
  "obra/superpowers":"obra",
  "vercel-labs/agent-skills":"vercel",
  "trailofbits/skills":"trailofbits",
  "K-Dense-AI/scientific-agent-skills":"kdense",
  "microsoft/skills":"microsoft",
  "github/awesome-copilot":"github",
  "openai/plugins":"openai",
  "addyosmani/agent-skills":"addyosmani",
  "UnitOneAI/SecuritySkills":"unitone",
  "getsentry/skills":"sentry",
  "aaron-he-zhu/seo-geo-claude-skills":"seo-geo",
  "aaron-he-zhu/aaron-marketing-skills":"aaron-seo",
  "wshobson/agents":"wshobson",
  "BagelHole/DevOps-Security-Agent-Skills":"bagelhole",
  "supabase/agent-skills":"supabase"
};

function deriveCategory(sourceId,sourcePath){
  const value=(sourceId+" "+sourcePath).toLowerCase();
  if(value.includes("security")||value.includes("trailofbits")) return ["security"];
  if(value.includes("scient")||value.includes("research")||value.includes("citation")||value.includes("database-lookup")) return ["research"];
  if(value.includes("frontend")||value.includes("react")||value.includes("vercel")) return ["frontend"];
  if(value.includes("github")||value.includes("copilot")) return ["github","agents"];
  if(value.includes("microsoft")||value.includes("azure")||value.includes("dotnet")) return ["cloud","developer-tools"];
  if(value.includes("anthropics")||value.includes("mcp")||value.includes("agent")) return ["agents","engineering"];
  if(value.includes("superpowers")||value.includes("workflow")||value.includes("debug")) return ["workflow","engineering"];
  return ["general"];
}

function deriveCompatibility(sourceId){
  const value=sourceId.toLowerCase();
  if(value.includes("anthropics")) return ["agent-skills","claude-code","codex","cursor"];
  if(value.includes("superpowers")) return ["agent-skills","claude-code","codex","cursor","opencode"];
  if(value.includes("vercel")) return ["agent-skills","claude-code","codex","cursor"];
  if(value.includes("trailofbits")) return ["agent-skills","claude-code","codex"];
  if(value.includes("microsoft")||value.includes("github")) return ["agent-skills","github-copilot","codex","cursor"];
  if(value.includes("openai")) return ["agent-skills","codex","claude-code","cursor"];
  return ["agent-skills"];
}

function releaseFor(skill){
  if(skill.distribution==="source-direct") return {status:"hold",reasons:["non-redistributable"]};
  if(skill.distribution==="blocked") return {status:"hold",reasons:["blocked-by-policy"]};
  if(skill.distribution==="review-required") return {status:"hold",reasons:["manual-review-required"]};
  const reasons=[];
  if(!skill.materialized) reasons.push("not-materialized");
  if(skill.security.scan_status!=="verified") reasons.push("security-scan-pending");
  if(skill.security.risk==="high") reasons.push("high-risk");
  return reasons.length?{status:"pending",reasons}:{status:"eligible",reasons:[]};
}

const existingBySource=new Map(registry.skills.map((s)=>[s.source.repo+":"+s.source.path,s]));
const existingById=new Map(registry.skills.map((s)=>[s.id,s]));
const seenSourceKeys=new Set();
const discovered=[];
for(const source of sourceEntries){
  const ref=source.default_branch??"main";
  if(!noFetch) execFileSync(process.execPath,[path.join(ROOT,"scripts/ingest-github.mjs"),source.repo,ref],{
    stdio:"inherit",
    env:process.env
  });
  const file=path.join(ROOT,"catalog/ingestion",source.repo.replaceAll("/","__")+".json");
  if(!fs.existsSync(file)) throw new Error("Missing ingestion output for "+source.repo);
  const payload=JSON.parse(fs.readFileSync(file,"utf8"));
  for(const item of payload.discovered_skills.filter((item)=>inScope(source,item.path))) discovered.push({source,item,revision:payload.source.revision});
}

// Ids already held by a record at the same upstream path are claimed first, so
// a new path with the same skill name cannot take them over, whatever the order.
const claimedIds=new Set();
for(const {source,item} of discovered){
  const existing=existingBySource.get(source.repo+":"+item.path);
  if(existing) claimedIds.add(existing.id);
}
for(const {source,item,revision} of discovered){
  const sourceKey=source.repo+":"+item.path;
  seenSourceKeys.add(sourceKey);
  let skill=existingBySource.get(sourceKey);
  const namespace=namespaceByRepo[source.repo]??source.repo.split("/")[0].toLowerCase().replace(/[^a-z0-9-]/g,"-");
  const stableId=skill?.id ?? namespace+"/"+item.name;
  if(!skill) {
    // A record whose upstream path moved keeps its id, unless another path in
    // this sync already claimed it: then two upstream skills share a name.
    const byId = existingById.get(stableId);
    if (byId && claimedIds.has(stableId)) {
      console.warn("Skipping duplicate skill id "+stableId+" at "+sourceKey);
      continue;
    }
    skill = byId;
  }
  claimedIds.add(stableId);
  if(!skill){
    skill={
      id:stableId,
      name:item.name,
      publisher:source.repo.split("/")[0],
      source:{repo:source.repo,path:item.path,revision:revision,revision_type:"git-commit"},
      category:deriveCategory(source.id,item.path),
      license:{spdx:item.license?.spdx??"NOASSERTION",redistributable:item.license?.redistributable===true,status:item.license?.status??"review-required",evidence:item.license?.evidence_path??"ingestion"},
      distribution:"review-required",
      compatibility:deriveCompatibility(source.id),
      security:{
        scan_status:item.security?.scan_status??"pending",
        risk:item.security?.risk??"unknown",
        network:item.security?.capabilities?.network??null,
        shell:item.security?.capabilities?.shell??null,
        credentials:item.security?.capabilities?.credentials??null
      },
      materialized:false,
      release:{status:"hold",reasons:["new-skill-review-required"]},
      integrity:{upstream_skill_sha256:item.skill_sha256,last_ingested_revision:revision}
    };
    registry.skills.push(skill);
    existingBySource.set(sourceKey,skill);
    existingById.set(skill.id,skill);
  }

  const previousRevision=skill.source.revision;
  skill.name=skill.name??item.name;
  skill.source={
    ...skill.source,
    repo:source.repo,
    path:item.path,
    revision:revision,
    revision_type:"git-commit",
    url:"https://github.com/"+source.repo+"/tree/"+revision+"/"+item.path,
    state:"present"
  };
  if(item.description) skill.description=item.description;

  if(item.license?.spdx && item.license.spdx!=="NOASSERTION"){
    skill.license={
      ...skill.license,
      spdx:item.license.spdx,
      redistributable:item.license.redistributable===true,
      status:item.license.status??"review-required",
      evidence:item.license.evidence_path??"ingestion"
    };
  }else{
    skill.license={...skill.license,status:"review-required",redistributable:false,spdx:skill.license.spdx??"NOASSERTION"};
  }

  skill.security={
    ...skill.security,
    scan_status:item.security?.scan_status??"pending",
    risk:item.security?.risk??"unknown",
    network:item.security?.capabilities?.network??skill.security.network,
    shell:item.security?.capabilities?.shell??skill.security.shell,
    credentials:item.security?.capabilities?.credentials??skill.security.credentials
  };

  skill.integrity={
    ...(skill.integrity??{}),
    upstream_skill_sha256:item.skill_sha256,
    last_ingested_revision:revision
  };

  const revisionChanged=previousRevision && previousRevision!==revision;
  if(revisionChanged){
    skill.materialized=false;
    if(skill.distribution==="bundled") skill.release={status:"pending",reasons:["upstream-revision-changed","security-scan-pending","rematerialization-required"]};
  }

  if(!skill.license.redistributable && skill.distribution==="bundled"){
    skill.distribution="source-direct";
    skill.materialized=false;
  }else if(skill.license.status!=="verified" && skill.distribution==="bundled"){
    skill.distribution="review-required";
    skill.materialized=false;
  }

  skill.release=releaseFor(skill);
}

for (const skill of registry.skills) {
  const sourceRepo = skill.source?.repo;
  const source = sourceEntries.find((entry) => entry.repo === sourceRepo);
  if (!source) continue;
  // Records outside include_paths were not looked for, so they are not missing.
  if (!inScope(source, skill.source.path)) continue;

  const sourceKey = sourceRepo + ":" + skill.source.path;
  if (seenSourceKeys.has(sourceKey)) continue;

  skill.source = {
    ...skill.source,
    state: "missing"
  };
  skill.materialized = false;
  skill.distribution = "blocked";
  skill.release = {
    status: "hold",
    reasons: ["upstream-skill-missing"]
  };
}

registry.skills.sort((a,b)=>a.id.localeCompare(b.id));
const nextSnapshot = JSON.stringify({
  schema_version: registry.schema_version,
  policy_version: registry.policy_version,
  skills: registry.skills
});
registry.generated_at = nextSnapshot === previousSnapshot
  ? previousGeneratedAt
  : new Date().toISOString();
fs.writeFileSync(registryFile,JSON.stringify(registry,null,2)+"\n");

const bundlesFile=path.join(ROOT,"catalog/bundles.json");
if(fs.existsSync(bundlesFile)){
  const bundles=JSON.parse(fs.readFileSync(bundlesFile,"utf8"));
  bundles.bundles= bundles.bundles ?? {};
  bundles.bundles["@all"]=registry.skills.map((s)=>s.id);
  fs.writeFileSync(bundlesFile,JSON.stringify(bundles,null,2)+"\n");
}

const bundled=registry.skills.filter((s)=>s.distribution==="bundled").sort((a,b)=>a.id.localeCompare(b.id));
const lock={
  lockfile_version:1,
  registry_schema:registry.schema_version,
  skills:bundled.map((s)=>({id:s.id,source:s.source.repo,path:s.source.path,revision:s.source.revision,revision_type:s.source.revision_type??"git-commit"}))
};
fs.writeFileSync(path.join(ROOT,"catalog/skills.lock.json"),JSON.stringify(lock,null,2)+"\n");

console.log("Registry sync complete:",registry.skills.length,"skills;");
console.log("Bundled:",bundled.length,"Review/source-direct:",registry.skills.length-bundled.length);
