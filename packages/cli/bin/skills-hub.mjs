#!/usr/bin/env node
import { loadRegistry, resolveBundle, filterForAgent } from "@ai-skills-hub/core";

const [, , command, ...args] = process.argv;
const registry = loadRegistry();

function flag(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

if (!command || command === "help") {
  console.log(`AI Skills Hub CLI

Usage:
  skills-hub search <term>
  skills-hub info <skill-id>
  skills-hub plan <bundle> [--agent <agent>]
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
    console.log(`${s.id}\t${s.license.spdx}\t${s.distribution}`);
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
  const name = args[0];
  const agent = flag("--agent");
  const skills = resolveBundle(registry, name);
  const compatible = agent ? filterForAgent(skills, agent) : skills;
  console.log(JSON.stringify({
    bundle: name,
    target_agent: agent ?? "generic",
    total: compatible.length,
    installable: compatible.filter((s) => s.distribution === "bundled").map((s) => s.id),
    source_direct: compatible.filter((s) => s.distribution === "source-direct").map((s) => s.id),
    review_required: compatible.filter((s) => s.distribution === "review-required").map((s) => s.id),
    blocked: compatible.filter((s) => s.distribution === "blocked").map((s) => s.id)
  }, null, 2));
  process.exit(0);
}

if (command === "audit") {
  const counts = registry.skills.reduce((acc, s) => {
    acc.total += 1;
    acc[s.distribution] = (acc[s.distribution] ?? 0) + 1;
    if (s.security.shell || s.security.network || s.security.credentials) acc.capability_sensitive += 1;
    if (s.license.status !== "verified") acc.license_unverified += 1;
    return acc;
  }, { total: 0, capability_sensitive: 0, license_unverified: 0 });
  console.log(JSON.stringify(counts, null, 2));
  process.exit(0);
}

console.error("Unknown command:", command);
process.exit(1);
