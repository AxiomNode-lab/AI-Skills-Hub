import fs from "node:fs";
import path from "node:path";

export function loadRegistry(file = "catalog/skills.json", bundlesFile = "catalog/bundles.json") {
  const registry = JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
  if (fs.existsSync(path.resolve(bundlesFile))) {
    const bundles = JSON.parse(fs.readFileSync(path.resolve(bundlesFile), "utf8"));
    registry.bundles = bundles.bundles ?? {};
  }
  return registry;
}

export function indexSkills(registry) {
  return new Map(registry.skills.map((skill) => [skill.id, skill]));
}

export function findSkill(registry, idOrName) {
  return registry.skills.find((skill) => skill.id === idOrName)
    ?? registry.skills.find((skill) => skill.name === idOrName);
}

export function resolveBundle(registry, bundleName) {
  const items = registry.bundles?.[bundleName];
  if (!items) throw new Error("Unknown bundle: " + bundleName);
  const index = indexSkills(registry);
  return items.map((id) => {
    const skill = index.get(id);
    if (!skill) throw new Error("Bundle references unknown skill: " + id);
    return skill;
  });
}

export function filterForAgent(skills, agent) {
  return skills.filter((skill) => {
    const compatibility = new Set(skill.compatibility ?? []);
    return compatibility.has(agent)
      || (agent === "generic-agent" && compatibility.has("agent-skills"));
  });
}

export function summarize(skills) {
  return skills.reduce((acc, skill) => {
    acc.total += 1;
    acc[skill.distribution] = (acc[skill.distribution] ?? 0) + 1;
    return acc;
  }, { total: 0 });
}
