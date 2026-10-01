#!/usr/bin/env node
import { loadRegistry, resolveBundle, filterForAgent } from "@ai-skills-hub/core";
import { buildInstallPlan } from "@ai-skills-hub/installer";

const [, , command, ...args] = process.argv;
const registry = loadRegistry();

function flag(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
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
  skills-hub info <skill-id>
  skills-hub plan <bundle-or-skill> [--agent <agent>]
  skills-hub install <bundle-or-skill> --agent <agent> [--allow-review]
  skills-hub audit
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

if (command === "info") {
  const skill = registry.skills.find((s) => s.id === args[0]);
  if (!skill) {
    console.error("Skill not found:", args[0]);
    process.exit(1);
  }
  console.log(JSON.stringify(skill, null, 2));
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
  const plan = buildInstallPlan(skills, agent ?? "generic");
  console.log(JSON.stringify({
    target,
    agent: agent ?? "generic",
    total: plan.length,
    plan
  }, null, 2));
  process.exit(0);
}

if (command === "install") {
  const target = args[0];
  const agent = flag("--agent");
  const allowReview = args.includes("--allow-review");
  if (!target || !agent) {
    console.error("Usage: skills-hub install <bundle-or-skill> --agent <agent> [--allow-review]");
    process.exit(1);
  }
  const skills = selectedSkills(target, agent);
  const plan = buildInstallPlan(skills, agent, {allowReview});
  console.log(JSON.stringify({
    target,
    agent,
    allow_review: allowReview,
    executable: plan.filter((p) => p.command).length,
    held: plan.filter((p) => p.action === "hold").length,
    blocked: plan.filter((p) => p.action === "blocked").length,
    plan
  }, null, 2));
  process.exit(plan.some((p) => p.action === "blocked") ? 2 : 0);
}

if (command === "audit") {
  const counts = registry.skills.reduce((acc, s) => {
    acc.total += 1;
    acc[s.distribution] = (acc[s.distribution] ?? 0) + 1;
    if (s.security.shell || s.security.network || s.security.credentials) acc.capability_sensitive += 1;
    if (s.license.status !== "verified") acc.license_unverified += 1;
    if (s.security.scan_status !== "verified") acc.security_unverified += 1;
    return acc;
  }, { total: 0, capability_sensitive: 0, license_unverified: 0, security_unverified: 0 });
  console.log(JSON.stringify(counts, null, 2));
  process.exit(0);
}

console.error("Unknown command:", command);
process.exit(1);
