#!/usr/bin/env node
import { loadRegistry, resolveBundle, filterForAgent } from "@ai-skills-hub/core";
import { buildInstallPlan } from "@ai-skills-hub/installer";
import { installMaterializedSkill, verifyInstalledSkill, doctorInstalledSkills, uninstallSkillRecord } from "@ai-skills-hub/installer/native";
import { hybridSearch, toInstallChoices } from "@ai-skills-hub/discovery";
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
  const query = args[0];
  const agent = flag("--agent") ?? "agent-skills";
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
    remote: !args.includes("--no-remote")
  });
  console.log(JSON.stringify({ ...result, choices: toInstallChoices(result, agent) }, null, 2));
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
