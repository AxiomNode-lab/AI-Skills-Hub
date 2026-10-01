import os from "node:os";
import path from "node:path";
import { cacheKey, readCache, writeCache } from "./cache.mjs";

const BASE="https://registry.modelcontextprotocol.io/v0.1/servers";

function score(query,item) {
  const q=String(query??"").toLowerCase();
  const hay=[item.id,item.name,item.description,item.publisher,...(item.category??[]),item.server_name].join(" ").toLowerCase();
  let n=0;
  if(hay.includes(q)) n+=30;
  for(const word of q.split(/[^a-z0-9._/-]+/).filter(Boolean)) if(hay.includes(word)) n+=8;
  if(item.transport) n+=5;
  if(item.installation?.method) n+=4;
  return n;
}

function packageInstall(server) {
  const pkg=(server.packages??[]).find(p=>p?.registryType && p?.identifier && p?.version);
  if(!pkg) return null;
  const transport=pkg.transport ?? null;
  const runtime=pkg.runtimeHint ?? (pkg.registryType==="npm" ? "npx" : null);
  if(!runtime) return null;
  return {
    method:"package",
    registryType:pkg.registryType,
    identifier:pkg.identifier,
    version:pkg.version,
    runtime,
    runtimeArguments:pkg.runtimeArguments ?? [],
    transport
  };
}

function remoteInstall(server) {
  const remote=(server.remotes??[])[0];
  if(!remote?.url) return null;
  return {
    method:"remote",
    url:remote.url,
    type:remote.type ?? remote.transport ?? "http",
    headers:remote.headers ?? undefined
  };
}

export async function searchMcpRegistry(query,{limit=20,fetchImpl=fetch,cacheDir=path.join(os.homedir(),".cache","ai-skills-hub","discovery"),cacheTtlMs=300000}={}) {
  const key=cacheKey({provider:"mcp-registry",query,limit});
  const cached=readCache(cacheDir,key,cacheTtlMs);
  if(cached) return cached;

  const terms=[query,...String(query).toLowerCase().split(/[^a-z0-9._/-]+/).filter(x=>x.length>2).slice(0,4)];
  const uniqueTerms=[...new Set(terms)];
  const responses=await Promise.allSettled(uniqueTerms.map(async term=>{
    const url=BASE+"?search="+encodeURIComponent(term)+"&version=latest&limit="+Math.min(100,Math.max(1,limit));
    const response=await fetchImpl(url,{headers:{accept:"application/json","user-agent":"AI-Skills-Hub-discovery/0.2"}});
    if(!response.ok) throw new Error("MCP Registry "+response.status);
    return response.json();
  }));
  const rows=responses.filter(x=>x.status==="fulfilled").flatMap(x=>x.value.servers ?? []);

  const output=[];
  const seenServers=new Set();
  for(const row of rows){
    const server=row.server ?? row;
    const meta=row._meta?.["io.modelcontextprotocol/registry/official"] ?? {};
    if(meta.status==="deleted") continue;

    const packageInstallPlan=packageInstall(server);
    const remoteInstallPlan=packageInstallPlan ? null : remoteInstall(server);
    const repo=server.repository?.url ?? null;
    const name=server.name ?? server.title ?? "mcp-server";
    const item={
      id:"mcp/"+String(server.name ?? name).replace(/[^a-zA-Z0-9._/-]+/g,"-"),
      name,
      publisher:server.publisher?.name ?? server.name?.split("/")[0] ?? "MCP",
      description:server.description ?? "",
      category:server.category ?? [],
      tags:server.category ?? [],
      artifact_type:"mcp-server",
      compatibility:["agent-skills","codex","claude-code","cursor","github-copilot"],
      compatibility_verified:false,
      distribution:"source-direct",
      release:{status:"hold",reasons:["remote-discovery-not-locally-reviewed"]},
      license:{spdx:"NOASSERTION",redistributable:false,status:"unknown"},
      security:{scan_status:"pending",risk:"unknown"},
      origin:"mcp-registry",
      server_name:server.name,
      version:server.version ?? null,
      installation:packageInstallPlan ?? remoteInstallPlan,
      source:{
        repo,
        url:repo,
        install_url:repo,
        registry:"https://registry.modelcontextprotocol.io",
        version:server.version ?? null,
        revision:null
      }
    };
    output.push({item,score:score(query,item),origin:"mcp-registry"});
  }
  output.sort((a,b)=>b.score-a.score || a.item.name.localeCompare(b.item.name));
  const result=output.slice(0,limit);
  writeCache(cacheDir,key,result);
  return result;
}
