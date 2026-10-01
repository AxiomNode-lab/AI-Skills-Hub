import { filterForAgent } from "@ai-skills-hub/core";

const norm = (v) => String(v ?? "").toLowerCase().trim();
const words = (v) => norm(v).split(/[^a-z0-9@._/-]+/).filter(Boolean);

function score(query, item, agent) {
  const q = norm(query);
  const hay = norm([item.id,item.name,item.publisher,item.description,...(item.category ?? []),...(item.tags ?? [])].join(" "));
  let n = 0;
  if (!q) n = 1;
  if (norm(item.id) === q) n += 120;
  if (norm(item.name) === q) n += 100;
  if (norm(item.name).startsWith(q)) n += 50;
  if (hay.includes(q)) n += 30;
  for (const w of words(q)) n += norm(item.name).includes(w) ? 18 : hay.includes(w) ? 6 : 0;
  if (agent && (item.compatibility ?? []).includes(agent)) n += 20;
  if (item.release?.status === "eligible") n += 12;
  if (item.distribution === "bundled") n += 8;
  if (item.security?.risk === "high") n -= 80;
  return n;
}

export function searchRegistry(registry, query, { agent, limit=20 }={}) {
  const source = agent ? filterForAgent(registry.skills, agent) : registry.skills;
  return source.map(item => ({ item, score: score(query,item,agent), origin:"registry" }))
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

export async function searchRemote(query,{sources=[],agent,limit=20,token,fetchImpl=fetch}={}) {
  const enabled = sources.filter(s => s.kind === "github" && s.discovery_enabled !== false);
  const jobs = enabled.map(async source => {
    const q = encodeURIComponent("SKILL.md " + query + " repo:" + source.repo);
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
      const path = hit.path.slice(0,-8);
      const name = path.split("/").pop();
      const item = {
        id: source.id + "/" + name, name, publisher: source.repo.split("/")[0],
        description: null, category:[], tags:[], compatibility:["agent-skills"],
        distribution:"source-direct", origin:"remote-github",
        source:{repo:source.repo,path,revision:null,revision_type:"git-commit",
          url:"https://github.com/"+source.repo+"/tree/"+(source.default_branch ?? "main")+"/"+path}
      };
      if (!agent || agent === "agent-skills") results.push({item,score:score(query,item,agent),origin:"remote-github"});
    }
  }
  return results.filter(x=>x.score>0).sort((a,b)=>b.score-a.score || a.item.name.localeCompare(b.item.name)).slice(0,limit);
}

export async function hybridSearch(registry,query,opts={}) {
  const local=searchRegistry(registry,query,opts);
  if (opts.remote === false) return {query,agent:opts.agent ?? null,remote_searched:false,results:local};
  const remote=await searchRemote(query,opts);
  const seen=new Set(); const merged=[];
  for (const entry of [...local,...remote]) {
    const key=entry.item.id ?? (entry.item.source.repo+":"+entry.item.source.path);
    if (seen.has(key)) continue; seen.add(key); merged.push(entry);
  }
  merged.sort((a,b)=>b.score-a.score || a.item.name.localeCompare(b.item.name));
  return {query,agent:opts.agent ?? null,remote_searched:true,results:merged.slice(0,opts.limit ?? 20)};
}

export function toInstallChoices(searchResult,agent) {
  return searchResult.results.map(({item,score,origin}) => {
    const local = item.distribution === "bundled" && item.materialized && item.release?.status === "eligible";
    return { id:item.id,name:item.name,score,origin,agent, action:local?"install":"source-direct", source:item.source,
      command: local ? ["skills-hub","install",item.id,"--agent",agent].join(" ")
        : ["npx","skills","add","https://github.com/"+item.source.repo,"--skill",JSON.stringify(item.name),"--agent",agent,"-y"].join(" ") };
  });
}
