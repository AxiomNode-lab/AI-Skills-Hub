#!/usr/bin/env node
import { loadRegistry, resolveBundle, filterForAgent } from "@ai-skills-hub/core";
import { buildInstallPlan } from "@ai-skills-hub/installer";
import { installMaterializedSkill, verifyInstalledSkill, doctorInstalledSkills, uninstallSkillRecord } from "@ai-skills-hub/installer/native";
import { hybridSearch, toInstallChoices, summarizeInstallPlan } from "@ai-skills-hub/discovery";
import fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeInstallRecord } from "@ai-skills-hub/installer/state";
const execFileAsync = promisify(execFile);

const [, , command, ...args] = process.argv;
const registry = loadRegistry();

function flag(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}


const aiConfig = process.env.AI_DISCOVERY_BASE_URL && process.env.AI_DISCOVERY_MODEL
  ? {
      baseUrl: process.env.AI_DISCOVERY_BASE_URL,
      model: process.env.AI_DISCOVERY_MODEL,
      apiKey: process.env.AI_DISCOVERY_API_KEY
    }
  : undefined;

async function mapConcurrent(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      try { results[index] = await worker(items[index], index); }
      catch (error) { results[index] = { error }; }
    }
  }
  await Promise.all(Array.from({length:Math.min(limit,Math.max(1,items.length))}, run));
  return results;
}

async function executeChoice(choice, agent, scope) {
  if (choice.action === "install") {
    const skill = registry.skills.find((s) => s.id === choice.id);
    return installMaterializedSkill(skill, {agent,scope,overwrite:false,persistState:true});
  }

  if (choice.action === "configuration") {
    const target = choice.target;
    if (!target || !choice.config) throw new Error("Configuration adapter returned no target/config");
    const output = target.startsWith("~")
      ? target.replace("~", process.env.HOME ?? "")
      : target;
    fs.mkdirSync(requireDir(output), {recursive:true});
    const existing = fs.existsSync(output) ? JSON.parse(fs.readFileSync(output,"utf8")) : {mcpServers:{}};
    existing.mcpServers = {...(existing.mcpServers ?? {}), ...(choice.config.mcpServers ?? {})};
    const temporary = output + ".tmp-" + process.pid;
    fs.writeFileSync(temporary, JSON.stringify(existing,null,2)+"\n",{mode:0o600});
    fs.renameSync(temporary, output);
    return {id:choice.id,action:"configured",target:output};
  }

  if (!choice.argv) throw new Error("Adapter has no executable command");
  const result = await execFileAsync(choice.argv[0], choice.argv.slice(1), {
    env:process.env,cwd:process.cwd(),maxBuffer:4*1024*1024
  });
  return {id:choice.id,action:"executed",adapter:choice.adapter,stdout:result.stdout};
}

function requireDir(file) {
  return file.endsWith("/") ? file.slice(0,-1) : file.substring(0,file.lastIndexOf("/") > 0 ? file.lastIndexOf("/") : 1);
}

async function executeSourceBridge(skill, agent) {
  if (!skill.source?.repo || !skill.name) throw new Error("Remote install metadata incomplete");
  const url = "https://github.com/" + skill.source.repo;
  await execFileAsync("npx", ["--yes","skills","add",url,"--skill",skill.name,"--agent",agent,"-y"], {
    env: process.env,
    cwd: process.cwd(),
    maxBuffer: 4 * 1024 * 1024
  });
  return { id:skill.id, agent, action:"source-direct-installed", source:url };
}

function selectedSkills(target, agent) {
  const items = target.startsWith("@")
    ? resolveBundle(registry, target)
    : [registry.skills.find((s) => s.id === target)].filter(Boolean);
  return agent ? filterForAgent(items, agent) : items;
}

if (!command || command === "help") {
  console.log(`AI Skills Hub CLI

Usage:
  skills-hub search <term>
  skills-hub discover <natural-language-query> --agent <agent> [--no-remote]
  skills-hub add <natural-language-query> --agent <agent> [--scope project|user] [--remote] [--all] [--index <n>]
  skills-hub info <skill-id>
  skills-hub targets
  skills-hub plan <bundle-or-skill> [--agent <agent>]
  skills-hub install <bundle-or-skill> --agent <agent> [--scope project|user] [--overwrite] [--force] [--remote]
  skills-hub audit
  skills-hub doctor [--scope project|user]
  skills-hub remove <skill-id> [--scope project|user] [--force]
  skills-hub update <bundle-or-skill> --agent <agent> [--scope project|user] [--force]
`);
  process.exit(0);
}

if (command === "search") {
  const term = (args[0] ?? "").toLowerCase();
  const matches = registry.skills.filter((s) =>
    [s.id, s.name, s.publisher, ...s.category].join(" ").toLowerCase().includes(term)
  );
  for (const s of matches) {
    console.log(s.id + "\t" + s.license.spdx + "\t" + s.distribution);
  }
  process.exit(0);
}

if (command === "discover") {
  const agent = flag("--agent") ?? "agent-skills";
  const ignoredFlags = new Set(["--agent","--no-remote"]);
  const query = args.filter((value,index) => !ignoredFlags.has(value) && args[index - 1] !== "--agent").join(" ").trim();
  if (!query) {
    console.error("Missing discovery query.");
    process.exit(1);
  }
  const sources = JSON.parse(fs.readFileSync("catalog/sources.json","utf8")).sources;
  const result = await hybridSearch(registry, query, {
    sources,
    agent,
    limit: 20,
    token: process.env.GITHUB_TOKEN,
    remote: !args.includes("--no-remote"),
    ai: aiConfig
  });
  console.log(JSON.stringify({ ...result, choices: toInstallChoices(result, agent) }, null, 2));
  process.exit(0);
}

if (command === "add") {
  const agent = flag("--agent") ?? "agent-skills";
  const scope = flag("--scope") ?? "project";
  if (!["project","user"].includes(scope)) {
    console.error("Invalid scope:", scope);
    process.exit(1);
  }
  const selectedIndex = Math.max(1, Number(flag("--index") ?? "1"));
  const ignoredFlags = new Set(["--agent","--index","--remote","--no-remote"]);
  const query = args.filter((value,index) =>
    !ignoredFlags.has(value) && args[index - 1] !== "--agent" && args[index - 1] !== "--index"
  ).join(" ").trim();

  if (!query) {
    console.error("Missing natural-language discovery query.");
    process.exit(1);
  }

  const sources = JSON.parse(fs.readFileSync("catalog/sources.json","utf8")).sources;
  const discovery = await hybridSearch(registry, query, {
    sources,
    agent,
    limit: 10,
    token: process.env.GITHUB_TOKEN,
    remote: !args.includes("--no-remote")
  });
  const choices = toInstallChoices(discovery, agent, {scope});

  const all = args.includes("--all");
  const summary = summarizeInstallPlan(discovery,agent,{scope});
  if (all) {
    if (!args.includes("--remote") && summary.remote.length) {
      console.log(JSON.stringify({
        query, summary,
        next_step: "Re-run with --all --remote to execute remote adapters."
      },null,2));
      process.exit(3);
    }

    const results = [];
    const executable = choices.filter((choice) =>
      choice.action === "install" ||
      (args.includes("--remote") && ["source-direct","marketplace","configuration"].includes(choice.action))
    );

    const configChoices = executable.filter((choice)=>choice.action==="configuration");
    for (const choice of configChoices) {
      try { results.push(await executeChoice(choice,agent,scope)); }
      catch (error) { results.push({id:choice.id,action:"error",error:error.message}); }
    }

    const commandChoices = executable.filter((choice)=>choice.action!=="configuration");
    const executed = await mapConcurrent(commandChoices,3,async(choice)=>executeChoice(choice,agent,scope));
    results.push(...executed.map((result)=>result?.error
      ? {action:"error",error:result.error.message}
      : result
    ));

    console.log(JSON.stringify({
      query,agent,scope,all:true,summary,
      executed:results.filter((r)=>r.action==="executed"||r.action==="installed"||r.action==="configured").length,
      errors:results.filter((r)=>r.action==="error").length,
      results
    },null,2));
    process.exit(results.some((r)=>r.action==="error") ? 2 : 0);
  }

  const selected = choices[selectedIndex - 1];

  if (!selected) {
    console.error(JSON.stringify({query,agent,choices},null,2));
    process.exit(2);
  }

  if (selected.action === "install") {
    const result = await executeChoice(selected, agent, scope);
    console.log(JSON.stringify({query,selected,result},null,2));
    process.exit(0);
  }

  if (!args.includes("--remote")) {
    console.log(JSON.stringify({
      query,
      selected,
      next_step: "Re-run with --remote to execute this adapter.",
      scope
    },null,2));
    process.exit(3);
  }

  if (selected.action === "adapter-pending" || selected.action === "unsupported") {
    console.error(JSON.stringify({query,selected},null,2));
    process.exit(4);
  }

  const result = await executeChoice(selected, agent, scope);
  console.log(JSON.stringify({query,selected,result},null,2));
  process.exit(0);
}

if (command === "info") {
  const skill = registry.skills.find((s) => s.id === args[0]);
  if (!skill) {
    console.error("Skill not found:", args[0]);
    process.exit(1);
  }
  console.log(JSON.stringify(skill, null, 2));
  process.exit(0);
}

if (command === "targets") {
  const { supportedAgents, candidateInstallRoots } = await import("@ai-skills-hub/installer/targets");
  const scope = flag("--scope") ?? "project";
  console.log(JSON.stringify(
    supportedAgents().map((agent) => ({
      agent,
      scope,
      roots: candidateInstallRoots(agent, scope)
    })),
    null,
    2
  ));
  process.exit(0);
}

if (command === "plan") {
  const target = args[0];
  const agent = flag("--agent");
  if (!target) {
    console.error("Missing bundle or skill id.");
    process.exit(1);
  }
  const skills = selectedSkills(target, agent);
  if (!skills.length) {
    console.error("No compatible skills resolved.");
    process.exit(1);
  }
  const plan = buildInstallPlan(skills, agent ?? "agent-skills");
  console.log(JSON.stringify({
    target,
    agent: agent ?? "agent-skills",
    total: plan.length,
    plan
  }, null, 2));
  process.exit(0);
}

if (command === "install") {
  const target = args[0];
  const agent = flag("--agent");
  const scope = flag("--scope") ?? "project";
  const overwrite = args.includes("--overwrite");
  const force = args.includes("--force");

  if (!target || !agent) {
    console.error("Usage: skills-hub install <bundle-or-skill> --agent <agent> [--scope project|user] [--overwrite] [--force]");
    process.exit(1);
  }
  if (!["project","user"].includes(scope)) {
    console.error("Invalid scope:", scope);
    process.exit(1);
  }

  const skills = selectedSkills(target, agent);
  const plan = buildInstallPlan(skills, agent);

  const results = [];
  let failed = false;

  const installResults = await mapConcurrent(
    plan.filter((item) => item.action === "install"),
    4,
    async (item) => {
      const skill = skills.find((s) => s.id === item.id);
      return installMaterializedSkill(skill, {agent,scope,overwrite,force,persistState:false});
    }
  );
  for (const result of installResults) {
    if (result?.error) { failed=true; results.push({action:"error",error:result.error.message}); continue; }
    if (result?.record) writeInstallRecord(result.record, process.cwd());
    results.push(result);
  }

  const remoteEnabled = args.includes("--remote");
  const remoteResults = remoteEnabled ? await mapConcurrent(
    plan.filter((item) => item.action === "source-direct"),
    3,
    async (item) => executeSourceBridge(skills.find((s) => s.id === item.id), agent)
  ) : [];
  for (const result of remoteResults) {
    if (result?.error) { failed=true; results.push({action:"error",error:result.error.message}); }
    else results.push(result);
  }

  for (const item of plan.filter((item) => !["install","source-direct"].includes(item.action))) {
    results.push({id:item.id,action:item.action,reason:item.reason ?? null,command:item.command ?? null});
    if (item.action === "blocked") failed = true;
  }

  console.log(JSON.stringify({
    target,
    agent,
    scope,
    overwrite,
    total:results.length,
    installed:results.filter((r)=>r.action==="installed").length,
    held:results.filter((r)=>r.action==="hold").length,
    source_bridge:results.filter((r)=>r.action==="source-bridge").length,
    source_direct:results.filter((r)=>r.action==="source-direct" || r.action==="source-direct-installed").length,
    blocked:results.filter((r)=>r.action==="blocked").length,
    errors:results.filter((r)=>r.action==="error").length,
    results
  }, null, 2));

  process.exit(failed ? 2 : 0);
}

if (command === "doctor") {
  const scope = flag("--scope") ?? "project";
  if (!["project","user"].includes(scope)) {
    console.error("Invalid scope:", scope);
    process.exit(1);
  }
  const { doctorInstalledSkills } = await import("@ai-skills-hub/installer/native");
  const results = doctorInstalledSkills({scope});
  console.log(JSON.stringify({
    scope,
    total:results.length,
    healthy:results.filter((r)=>r.ok).length,
    unhealthy:results.filter((r)=>!r.ok).length,
    results
  }, null, 2));
  process.exit(results.some((r)=>!r.ok) ? 2 : 0);
}

if (command === "remove") {
  const skillId = args[0];
  const scope = flag("--scope") ?? "project";
  const force = args.includes("--force");
  if (!skillId) {
    console.error("Missing skill id.");
    process.exit(1);
  }
  try {
    const result = uninstallSkillRecord(skillId,{scope,force});
    console.log(JSON.stringify(result,null,2));
  } catch(error) {
    console.error(error.message);
    process.exit(2);
  }
  process.exit(0);
}

if (command === "update") {
  const target = args[0];
  const agent = flag("--agent");
  const scope = flag("--scope") ?? "project";
  const force = args.includes("--force");
  if (!target || !agent) {
    console.error("Usage: skills-hub update <bundle-or-skill> --agent <agent> [--scope project|user] [--force]");
    process.exit(1);
  }
  const skills = selectedSkills(target, agent);
  const plan = buildInstallPlan(skills, agent);
  const results = [];

  for (const item of plan) {
    if (item.action !== "install") {
      results.push({id:item.id,action:item.action,reason:item.reason ?? null});
      continue;
    }
    try {
      results.push(installMaterializedSkill(
        skills.find((s)=>s.id===item.id),
        {agent,scope,overwrite:true,force}
      ));
    } catch(error) {
      results.push({id:item.id,action:"error",error:error.message});
    }
  }

  console.log(JSON.stringify({
    target,agent,scope,
    updated:results.filter((r)=>r.action==="installed").length,
    skipped:results.filter((r)=>r.action!=="installed").length,
    results
  },null,2));
  process.exit(results.some((r)=>r.action==="error") ? 2 : 0);
}

if (command === "audit") {
  const counts = registry.skills.reduce((acc, s) => {
    acc.total += 1;
    acc[s.distribution] = (acc[s.distribution] ?? 0) + 1;
    if (s.security.shell || s.security.network || s.security.credentials) acc.capability_sensitive += 1;
    if (s.license.status !== "verified") acc.license_unverified += 1;
    if (s.security.scan_status !== "verified") acc.security_unverified += 1;
    if (s.materialized) acc.materialized += 1;
    return acc;
  }, { total: 0, capability_sensitive: 0, license_unverified: 0, security_unverified: 0, materialized: 0 });
  console.log(JSON.stringify(counts, null, 2));
  process.exit(0);
}

console.error("Unknown command:", command);
process.exit(1);
