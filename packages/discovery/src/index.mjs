import { filterForAgent } from "@ai-skills-hub/core";
import os from "node:os";
import path from "node:path";
import { cacheKey, readCache, writeCache } from "./cache.mjs";
import { rerankWithModel } from "./rerank.mjs";
import { searchMcpRegistry } from "./mcp-registry.mjs";
import { searchNpmTools } from "./npm.mjs";
import { searchAgentPlugins } from "./plugins.mjs";
import { buildAdapterPlan } from "./adapters.mjs";

const norm = (v) => String(v ?? "").toLowerCase().trim();
const ARABIC_HINTS = new Map([
  ["اداة","tool"],["أداة","tool"],["ادوات","tools"],["أدوات","tools"],
  ["بدي","need"],["اريد","need"],["أريد","need"],["محتاج","need"],
  ["اعمل","create"],["اعمللي","create"],["تعمل","create"],["إنشاء","create"],
  ["بحث","search"],["يبحث","search"],["برمجة","programming"],["مطور","developer"],
  ["كود","code"],["موقع","website"],["صور","images"],["فيديو","video"],
  ["ملف","file"],["ملفات","files"],["ديسكورد","discord"],["تلغرام","telegram"],
  ["واتساب","whatsapp"],["على","for"],["ل","for"]
]);

function expandQuery(value) {
  const original = String(value ?? "");
  const parts = original.split(/\s+/).map(x => x.replace(/[،؛,.!?؟]/g,""));
  return [original, ...parts.map(x => ARABIC_HINTS.get(x)).filter(Boolean)].join(" ").trim();
}

const words = (v) => norm(v).split(/[^a-z0-9@._/-]+/).filter(Boolean);

function score(query, item, agent, { requireTextMatch = false } = {}) {
  const q = norm(expandQuery(query));
  const hay = norm([item.id,item.name,item.publisher,item.description,...(item.category ?? []),...(item.tags ?? [])].join(" "));
  let n = 0;
  if (!q) n = 1;
  if (norm(item.id) === q) n += 120;
  if (norm(item.name) === q) n += 100;
  if (norm(item.name).startsWith(q)) n += 50;
  if (hay.includes(q)) n += 30;
  for (const w of words(q)) n += norm(item.name).includes(w) ? 18 : hay.includes(w) ? 6 : 0;
  // Local relevance must come from text, before compatibility and status bonuses.
  if (requireTextMatch && (!q || n === 0)) return 0;
  if (agent && (item.compatibility ?? []).includes(agent)) n += 20;
  if (item.release?.status === "eligible") n += 12;
  if (item.distribution === "bundled") n += 8;
  if (item.security?.risk === "high") n -= 80;
  return n;
}

export function searchRegistry(registry, query, { agent, limit=20 }={}) {
  const source = agent ? filterForAgent(registry.skills, agent) : registry.skills;
  return source.map(item => ({ item, score: score(query,item,agent,{ requireTextMatch: true }), origin:"registry" }))
    .filter(x => x.score > 0).sort((a,b)=>b.score-a.score || a.item.name.localeCompare(b.item.name)).slice(0,limit);
}

function headers(token) {
  const h = { accept:"application/vnd.github+json", "user-agent":"AI-Skills-Hub-discovery/0.2" };
  if (token) h.authorization = "Bearer " + token;
  return h;
}

async function github(url,{token,fetchImpl=fetch}={}) {
  const r = await fetchImpl(url,{headers:headers(token)});
  if (!r.ok) throw new Error("GitHub API " + r.status);
  return r.json();
}

export async function searchRemote(query,{sources=[],agent,limit=20,token,fetchImpl=fetch,cacheDir=path.join(os.homedir(),".cache","ai-skills-hub","discovery"),cacheTtlMs=300000}={}) {
  const key=cacheKey({query,agent,limit,sources:sources.map(s=>[s.id,s.repo,s.default_branch])});
  const cached=readCache(cacheDir,key,cacheTtlMs);
  if(cached) return cached;
  const enabled = sources.filter(s => s.kind === "github" && s.discovery_enabled !== false);
  const jobs = enabled.map(async source => {
    const q = encodeURIComponent("SKILL.md " + expandQuery(query) + " repo:" + source.repo);
    const data = await github("https://api.github.com/search/code?q="+q+"&per_page=20",{token,fetchImpl});
    return {source,data};
  });
  const settled = await Promise.allSettled(jobs);
  const results = [];
  for (const job of settled) {
    if (job.status !== "fulfilled") continue;
    const {source,data}=job.value;
    for (const hit of data.items ?? []) {
      if (!hit.path.endsWith("/SKILL.md")) continue;
      const path = hit.path.slice(0,-"/SKILL.md".length);
      const name = path.split("/").pop();
      const item = {
        id: source.id + "/" + name, name, publisher: source.repo.split("/")[0],
        description: null, category:[], tags:[], compatibility:["agent-skills"], compatibility_verified:false,
        distribution:"source-direct", origin:"remote-github",
        source:{repo:source.repo,path,revision:null,revision_type:"git-commit",
          url:"https://github.com/"+source.repo+"/tree/"+(source.default_branch ?? "main")+"/"+path}
      };
      results.push({item,score:score(query,item,agent),origin:"remote-github"});
    }
  }
  const output=results.filter(x=>x.score>0).sort((a,b)=>b.score-a.score || a.item.name.localeCompare(b.item.name)).slice(0,limit);
  writeCache(cacheDir,key,output);
  return output;
}

export async function searchSkillsSh(query,{agent,limit=20,source,token,fetchImpl=fetch,cacheDir=path.join(os.homedir(),".cache","ai-skills-hub","discovery"),cacheTtlMs=300000}={}) {
  const base=source?.api ?? "https://skills.sh/api/v1/skills/search";
  const key=cacheKey({provider:"skills.sh",query,agent,limit});
  const cached=readCache(cacheDir,key,cacheTtlMs);
  if(cached) return cached;
  const url=base+"?q="+encodeURIComponent(expandQuery(query))+"&limit="+Math.min(200,Math.max(1,limit));
  const r=await fetchImpl(url,{headers:headers(token)});
  if(!r.ok) throw new Error("skills.sh API "+r.status);
  const body=await r.json();
  const items=body.data ?? body.skills ?? [];
  const result=items.map(item=>({
    item:{
      id:item.id ?? ((item.source ?? "skills.sh")+"/"+item.name),
      name:item.name ?? item.slug,
      publisher:(item.source ?? "").split("/")[0] || "unknown",
      description:item.description ?? null,
      category:item.tags ?? [],
      tags:item.tags ?? [],
      compatibility:["agent-skills"],
      compatibility_verified:false,
      distribution:"source-direct",
      origin:"skills.sh",
      installs:item.installs ?? 0,
      source:{repo:item.source,install_url:item.installUrl ?? null,url:item.url ?? null,path:item.path ?? "",revision:null,revision_type:"git-commit"}
    },
    score:score(query,item,agent)+(item.installs ? Math.min(20,Math.log10(item.installs+1)*4) : 0),
    origin:"skills.sh"
  }));
  result.sort((a,b)=>b.score-a.score || (b.item.installs??0)-(a.item.installs??0));
  const output=result.slice(0,limit);
  writeCache(cacheDir,key,output);
  return output;
}

export async function hybridSearch(registry,query,opts={}) {
  const local=searchRegistry(registry,query,opts);
  if (opts.remote === false) return {query,agent:opts.agent ?? null,remote_searched:false,results:local};
  const remoteJobs=[
    searchSkillsSh(query,{...opts,source:(opts.sources ?? []).find(s=>s.id==="skills.sh")}),
    searchRemote(query,opts),
    searchMcpRegistry(expandQuery(query),opts),
    searchNpmTools(expandQuery(query),opts),
    searchAgentPlugins(expandQuery(query),opts)
  ];
  const settled=await Promise.allSettled(remoteJobs);
  const remote=settled.filter(x=>x.status==="fulfilled").flatMap(x=>x.value);
  const seen=new Set(); const merged=[];
  for (const entry of [...local,...remote]) {
    const key=entry.item.id ?? (entry.item.source.repo+":"+entry.item.source.path);
    if (seen.has(key)) continue; seen.add(key); merged.push(entry);
  }
  merged.sort((a,b)=>b.score-a.score || a.item.name.localeCompare(b.item.name));
  const baseResults=merged.slice(0,opts.limit ?? 20);
  let finalResults=baseResults;
  let aiReranked=false;
  if(opts.ai?.baseUrl && opts.ai?.model){
    try {
      finalResults=await rerankWithModel(baseResults,query,opts.ai);
      aiReranked=true;
    } catch {}
  }
  return {query,agent:opts.agent ?? null,remote_searched:true,ai_reranked:aiReranked,results:finalResults};
}

export function toInstallChoices(searchResult,agent,{scope="project"}={}) {
  return searchResult.results.map(({item,score,origin}) => {
    const local = item.distribution === "bundled" && item.materialized && item.release?.status === "eligible";
    const adapter = local
      ? {
          artifact_type:item.artifact_type ?? "skill",
          action:"install",
          status:"implemented",
          adapter:"registry",
          command:["skills-hub","install",item.id,"--agent",agent,"--scope",scope].join(" ")
        }
      : buildAdapterPlan(item,agent,{scope});

    return {
      id:item.id,
      name:item.name,
      artifact_type:item.artifact_type ?? "skill",
      description:item.description ?? "",
      publisher:item.publisher ?? "",
      category:item.category ?? [],
      tags:item.tags ?? [],
      license:item.license ?? {spdx:"NOASSERTION",status:"unknown",redistributable:false},
      security:item.security ?? {scan_status:"pending",risk:"unknown"},
      release:item.release ?? {status:"hold",reasons:[]},
      installation:item.installation ?? null,
      score,
      origin,
      agent,
      compatibility_verified:item.compatibility_verified !== false,
      action:adapter.action,
      status:adapter.status ?? "unknown",
      adapter:adapter.adapter ?? null,
      reason:adapter.reason ?? null,
      source:item.source,
      command:adapter.command ?? null,
      argv:adapter.argv ?? null,
      config:adapter.config ?? null,
      target:adapter.target ?? null,
      note:adapter.note ?? null
    };
  });
}

export function summarizeInstallPlan(searchResult,agent,{scope="project"}={}) {
  const choices=toInstallChoices(searchResult,agent,{scope});
  return {
    agent,
    scope,
    total:choices.length,
    ready:choices.filter(x=>x.action==="install"),
    remote:choices.filter(x=>x.action==="source-direct"||x.action==="marketplace"||x.action==="configuration"),
    review:choices.filter(x=>x.action==="adapter-pending"),
    unsupported:choices.filter(x=>x.action==="unsupported")
  };
}

export { buildAdapterPlan } from "./adapters.mjs";
