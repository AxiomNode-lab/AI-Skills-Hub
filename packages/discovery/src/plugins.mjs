import os from "node:os";
import path from "node:path";
import { cacheKey, readCache, writeCache } from "./cache.mjs";

function headers(token){
  const h={accept:"application/vnd.github+json","user-agent":"AI-Skills-Hub-discovery/0.2"};
  if(token) h.authorization="Bearer "+token;
  return h;
}

export async function searchAgentPlugins(query,{limit=20,token,fetchImpl=fetch,cacheDir=path.join(os.homedir(),".cache","ai-skills-hub","discovery"),cacheTtlMs=300000}={}) {
  const key=cacheKey({provider:"agent-plugins-github",query,limit});
  const cached=readCache(cacheDir,key,cacheTtlMs);
  if(cached) return cached;

  const q=encodeURIComponent('filename:plugin.json "agent-plugins.org/schemas/1.0.0/plugin.schema.json" '+query);
  const response=await fetchImpl("https://api.github.com/search/code?q="+q+"&per_page=50",{headers:headers(token)});
  if(!response.ok) throw new Error("GitHub plugin search "+response.status);
  const body=await response.json();

  const output=[];
  for(const hit of body.items??[]){
    const repo=hit.repository?.full_name;
    if(!repo) continue;
    const dir=hit.path.endsWith("/plugin.json") ? hit.path.slice(0,-"/plugin.json".length) : "";
    const name=dir.split("/").pop() || repo.split("/").pop();
    const item={
      id:"plugin/"+repo.replace("/","/")+"/"+name,
      name,
      publisher:repo.split("/")[0],
      description:"Agent Plugins package discovered from GitHub metadata.",
      category:["agent-plugins"],
      tags:["plugin","skills","mcp"],
      artifact_type:"agent-plugin",
      compatibility:["codex","claude-code","cursor","github-copilot"],
      compatibility_verified:false,
      distribution:"source-direct",
      release:{status:"hold",reasons:["remote-plugin-not-reviewed"]},
      license:{spdx:"NOASSERTION",redistributable:false,status:"unknown"},
      security:{scan_status:"pending",risk:"unknown"},
      origin:"github-plugin-search",
      source:{
        repo,
        path:dir,
        install_url:"https://github.com/"+repo,
        url:"https://github.com/"+repo+"/tree/"+(hit.repository?.default_branch ?? "main")+"/"+dir,
        revision:null
      },
      installation:{method:"plugin-marketplace",repo}
    };
    output.push({item,score:35+(repo.toLowerCase().includes(query.toLowerCase())?15:0),origin:"github-plugin-search"});
  }
  output.sort((a,b)=>b.score-a.score || a.item.name.localeCompare(b.item.name));
  const result=output.slice(0,limit);
  writeCache(cacheDir,key,result);
  return result;
}
