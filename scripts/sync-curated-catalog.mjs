#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const catalogPath=path.join(root,"catalog/skills.json");
const ingestionDir=path.join(root,"catalog/ingestion");
const catalog=JSON.parse(fs.readFileSync(catalogPath,"utf8"));

function snapshotName(repo){return repo.replaceAll("/","__")+".json";}

function loadSnapshot(repo){
  const file=path.join(ingestionDir,snapshotName(repo));
  if(!fs.existsSync(file)) return null;
  try{return JSON.parse(fs.readFileSync(file,"utf8"));}catch{return null;}
}

function matches(snapshot,sourcePath){
  return snapshot?.discovered_skills?.find((item)=>
    item.path===sourcePath+"/SKILL.md" ||
    item.path.startsWith(sourcePath.replace(/\/$/,"")+"/") && item.path.endsWith("/SKILL.md")
  ) ?? null;
}

let changed=0;
let missing=0;
let revisionChanges=0;

for(const skill of catalog.skills){
  const snapshot=loadSnapshot(skill.source.repo);
  if(!snapshot) continue;

  const discovered=matches(snapshot,skill.source.path);
  const previousRevision=skill.source.revision;
  skill.source.revision=snapshot.source.revision;
  skill.source.revision_type="git-commit";
  skill.source.tree_sha=snapshot.source.tree_sha;
  skill.source.url="https://github.com/"+skill.source.repo+"/tree/"+snapshot.source.revision+"/"+skill.source.path;
  skill.source.state=discovered?"present":"missing";

  if(discovered){
    skill.integrity=skill.integrity ?? {};
    skill.integrity.upstream_skill_sha256=discovered.skill_sha256 ?? null;
    skill.integrity.last_ingested_revision=snapshot.source.revision;

    if(discovered.description && discovered.description!==skill.description){
      skill.description=discovered.description;
    }

    if(previousRevision && previousRevision!==snapshot.source.revision){
      revisionChanges++;
      if(skill.distribution==="bundled"){
        skill.materialized=false;
        delete skill.materialized_root;
        delete skill.materialized_files;
        skill.security={
          ...(skill.security??{}),
          scan_status:"pending",
          risk:"pending",
          network:null,
          shell:null,
          credentials:null
        };
        skill.release={
          status:"pending",
          reasons:["upstream-revision-changed","rematerialization-required","security-rescan-required"]
        };
      }
    }
    if(skill.release?.status==="hold" && skill.distribution==="bundled"){
      skill.release={status:"pending",reasons:["source-present"]};
    }
    changed++;
  }else{
    missing++;
    skill.release={status:"hold",reasons:["upstream-skill-missing"]};
  }
}

console.log(JSON.stringify({
  changed,
  missing,
  revision_changes:revisionChanges,
  total:catalog.skills.length
},null,2));

fs.writeFileSync(catalogPath,JSON.stringify(catalog,null,2)+"\n");
