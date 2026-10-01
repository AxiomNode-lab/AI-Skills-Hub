#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const indexPath="catalog/source-index.json";
const index=JSON.parse(fs.readFileSync(indexPath,"utf8"));
const ingestionDir="catalog/ingestion";
const byId=new Map(index.sources.map((s)=>[s.id,s]));

if(fs.existsSync(ingestionDir)){
  for(const file of fs.readdirSync(ingestionDir).filter((name)=>name.endsWith(".json"))){
    const snapshot=JSON.parse(fs.readFileSync(path.join(ingestionDir,file),"utf8"));
    const id=snapshot.source.repo;
    const current=byId.get(id) ?? {id};
    byId.set(id,{
      ...current,
      revision:snapshot.source.revision,
      tree_sha:snapshot.source.tree_sha,
      last_ingested_ref:snapshot.source.ref
    });
  }
}

index.sources=[...byId.values()].sort((a,b)=>a.id.localeCompare(b.id));
fs.writeFileSync(indexPath,JSON.stringify(index,null,2)+"\n");
console.log("Updated source index:",index.sources.length,"sources");
