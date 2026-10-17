import { compatibilityBasis, isInstallable, loadRegistry } from "@ai-skills-hub/core";
import { searchRegistry } from "@ai-skills-hub/discovery";
import { groupByPublisher, paint, riskLabel, truncate } from "../ui.mjs";

// Released skills that `install` accepts, optionally for one agent and matching a query.
// `pool` is an installable list already computed for the agent, to search within.
export function installableSkills(registry, { agent, query, pool } = {}) {
  let skills = pool ? [...pool] : registry.skills.filter(isInstallable);
  if (agent && !pool) skills = skills.filter((skill) => compatibilityBasis(skill, agent) !== null);
  if (query) {
    // The pool is already agent-filtered; matches keep their relevance order.
    return searchRegistry({ skills }, query, { limit: Infinity }).map(({ item }) => item);
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
  const print = (skill) => {
    const basis = options.agent && compatibilityBasis(skill, options.agent) === "standard" ? paint("dim", " (Agent Skills format)") : "";
    console.log(`  ${paint("bold", skill.id)}  ${riskLabel(skill.security?.risk)}${basis}`);
    console.log(`    ${paint("dim", truncate(skill.description, width))}`);
  };
  // With a query the best matches come first; without one, group by publisher.
  if (query) {
    console.log("");
    skills.forEach(print);
  } else {
    for (const [owner, group] of groupByPublisher(skills)) {
      console.log("\n" + paint("cyan", owner));
      group.forEach(print);
    }
    console.log(paint("dim", "\nNarrow the list with a keyword: skills-hub available <keyword>"));
  }
  const agent = options.agent || "<agent>";
  console.log(`\nInstall: ${paint("green", `skills-hub install <id> [<id>...] --agent ${agent}`)}`);
  console.log(`Details: skills-hub info <id>`);
}
