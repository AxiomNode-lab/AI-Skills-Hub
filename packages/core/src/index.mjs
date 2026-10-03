import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isAlias, isMap, isScalar, parseDocument, visit } from "yaml";

// The Hub's catalog and materialized skills ship with the Hub, not with the
// project being installed into. SKILLS_HUB_HOME points at another Hub checkout.
export function hubHome(env = process.env) {
  return path.resolve(env.SKILLS_HUB_HOME || fileURLToPath(new URL("../../../", import.meta.url)));
}

export function catalogPath(name, env = process.env) {
  return path.join(hubHome(env), "catalog", name);
}

export function resolveHubPath(value, env = process.env) {
  return path.isAbsolute(value) ? value : path.resolve(hubHome(env), value);
}

export function loadRegistry(file = catalogPath("skills.json"), bundlesFile = catalogPath("bundles.json")) {
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

// Whether the catalog offers a local install. This never reflects installation state.
export function catalogAvailability(cap) {
  if (cap.distribution === "blocked") return { status: "blocked", reason: "registry_blocked" };
  if (cap.distribution === "review-required") return { status: "review-required", reason: "manual_review_required" };
  if (cap.distribution === "source-direct") return { status: "source-direct", reason: "external_confirmation_required" };
  if (cap.distribution === "bundled" && cap.materialized && cap.release?.status === "eligible") {
    return { status: "eligible", reason: "release_eligible_materialized_bundle" };
  }
  return { status: "catalog-only", reason: cap.distribution === "bundled" ? "bundle_not_released" : "no_local_installation_plan" };
}

export function summarize(skills) {
  return skills.reduce((acc, skill) => {
    acc.total += 1;
    acc[skill.distribution] = (acc[skill.distribution] ?? 0) + 1;
    return acc;
  }, { total: 0 });
}

// Parse YAML without executing custom types or resolving aliases. A malformed
// declaration must never disappear and be mistaken for an absent license.
export function parseFrontmatter(text) {
  const lines = String(text ?? "").replace(/^\uFEFF/, "").split(/\r?\n/);
  const fields = {};
  if (lines[0]?.trim() !== "---") return fields;
  const end = lines.findIndex((line, i) => i > 0 && /^(---|\.\.\.)\s*$/.test(line));
  if (end === -1) throw new Error("Unclosed YAML frontmatter");
  const document = parseDocument(lines.slice(1, end).join("\n") + "\n", { version: "1.2", uniqueKeys: true });
  if (document.errors.length || document.warnings.length) throw new Error("Invalid YAML frontmatter: " + (document.errors[0] ?? document.warnings[0]).message);
  if (!isMap(document.contents)) throw new Error("Frontmatter must be a mapping");
  visit(document, (_key, node) => {
    if (isAlias(node) || node?.anchor || (node?.tag && node.tag !== "tag:yaml.org,2002:str")) throw new Error("Frontmatter aliases, anchors and custom tags are forbidden");
    if (isMap(node) && node.items.some(pair => pair.key?.value === "<<")) throw new Error("Frontmatter merge keys are forbidden");
  });
  for (const { key, value } of document.contents.items) {
    if (!isScalar(key) || typeof key.value !== "string" || ["__proto__", "constructor", "prototype"].includes(key.value)) throw new Error("Invalid frontmatter key");
    if (["name", "description", "license"].includes(key.value) && (!isScalar(value) || typeof value.value !== "string" || !value.value.trim())) throw new Error(`Frontmatter ${key.value} must be a non-empty string`);
    // Other nested metadata stays outside the scalar metadata contract.
    if (isScalar(value)) fields[key.value] = value.value;
  }
  return fields;
}
