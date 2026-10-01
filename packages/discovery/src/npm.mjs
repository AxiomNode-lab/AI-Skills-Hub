import os from "node:os";
import path from "node:path";
import { cacheKey, readCache, writeCache } from "./cache.mjs";

function relevant(pkg) {
  const hay=[pkg.name,pkg.description,...(pkg.keywords??[])].join(" ").toLowerCase();
  return /\b(ai|agent|mcp|cli|llm|copilot|codex|claude|cursor|automation)\b/.test(hay);
}

export async function searchNpmTools(query,{limit=20,fetchImpl=fetch,cacheDir=path.join(os.homedir(),".cache","ai-skills-hub","discovery"),cacheTtlMs=300000}={}) {
  const key=cacheKey({provider:"npm",query,limit});
  const cached=readCache(cacheDir,key,cacheTtlMs);
  if(cached) return cached;

  const url="https://registry.npmjs.org/-/v1/search?text="+encodeURIComponent(query+" cli ai agent")+"&size="+Math.min(50,Math.max(1,limit));
  const response=await fetchImpl(url,{headers:{"accept":"application/json","user-agent":"AI-Skills-Hub-discovery/0.2"}});
  if(!response.ok) throw new Error("npm registry "+response.status);
  const body=await response.json();

  const output=(body.objects??[])
    .map(row=>row.package??{})
    .filter(relevant)
    .map(pkg=>({
      item:{
        id:"npm/"+pkg.name,
        name:pkg.name,
        publisher:pkg.publisher?.username ?? "npm",
        description:pkg.description ?? "",
        category:["cli-tools","npm"],
        tags:pkg.keywords ?? [],
        artifact_type:"cli-tool",
        compatibility:["agent-skills","codex","claude-code","cursor","opencode","github-copilot"],
        compatibility_verified:false,
        distribution:"source-direct",
        release:{status:"hold",reasons:["remote-package-not-reviewed"]},
        license:{spdx:"NOASSERTION",redistributable:false,status:"unknown"},
        security:{scan_status:"pending",risk:"unknown"},
        origin:"npm",
        source:{
          repo:pkg.links?.repository ?? null,
          url:pkg.links?.npm ?? null,
          install_url:"npm:"+pkg.name,
          package:pkg.name,
          version:pkg.version ?? null
        },
        installation:{method:"npm",package:pkg.name,version:pkg.version ?? null}
      },
      score:(pkg.description?15:0)+(pkg.keywords?.length??0),
      origin:"npm"
    }))
    .slice(0,limit);
  writeCache(cacheDir,key,output);
  return output;
}
