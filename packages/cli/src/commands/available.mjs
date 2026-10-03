import { catalogAvailability, compatibilityBasis, loadRegistry } from "@ai-skills-hub/core";
import { searchRegistry } from "@ai-skills-hub/discovery";
import { paint, riskLabel, truncate } from "../ui.mjs";

// Released skills that `install` accepts, optionally for one agent and matching a query.
export function installableSkills(registry, { agent, query } = {}) {
  let skills = registry.skills.filter((skill) => catalogAvailability(skill).status === "eligible");
  if (agent) skills = skills.filter((skill) => compatibilityBasis(skill, agent) !== null);
  if (query) {
    const matched = new Set(searchRegistry({ skills }, query, { agent, limit: Infinity }).map(({ item }) => item.id));
    skills = skills.filter((skill) => matched.has(skill.id));
  }
  return skills.sort((a, b) => a.id.localeCompare(b.id));
}

export function availableCommand(query, options = {}) {
  const registry = loadRegistry();
  const skills = installableSkills(registry, { agent: options.agent, query });

  if (options.json) {
    console.log(JSON.stringify(skills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      publisher: skill.publisher ?? null,
      description: skill.description ?? null,
      license: skill.license?.spdx ?? null,
      risk: skill.security?.risk ?? "unknown",
      compatibility: skill.compatibility ?? [],
      compatibility_basis: options.agent ? compatibilityBasis(skill, options.agent) : null
    })), null, 2));
    return;
  }

  const scope = [options.agent ? `for ${options.agent}` : null, query ? `matching "${query}"` : null].filter(Boolean).join(" ");
  if (skills.length === 0) {
    console.log(`No installable skills${scope ? " " + scope : ""}.`);
    return;
  }

  const width = Math.max(40, (process.stdout.columns || 100) - 6);
  console.log(paint("bold", `${skills.length} installable skills${scope ? " " + scope : ""}`));
  let publisher = null;
  for (const skill of skills) {
    const owner = skill.id.split("/")[0];
    if (owner !== publisher) {
      publisher = owner;
      console.log("\n" + paint("cyan", owner));
    }
    const basis = options.agent && compatibilityBasis(skill, options.agent) === "standard" ? paint("dim", " (Agent Skills format)") : "";
    console.log(`  ${paint("bold", skill.id)}  ${riskLabel(skill.security?.risk)}${basis}`);
    console.log(`    ${paint("dim", truncate(skill.description, width))}`);
  }
  const agent = options.agent || "<agent>";
  console.log(`\nInstall: ${paint("green", `skills-hub install <id>[,<id>...] --agent ${agent}`)}`);
  console.log(`Details: skills-hub info <id>`);
}
