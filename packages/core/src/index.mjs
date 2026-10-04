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

// Agents that load skills in the open Agent Skills format (a directory with
// SKILL.md and name/description frontmatter). See catalog/agents.json.
export const AGENT_SKILLS_STANDARD_AGENTS = ["claude-code", "codex", "cursor", "github-copilot", "copilot", "opencode", "generic-agent", "agent-skills"];

// Why a capability can be used with an agent: "listed" when the catalog names the
// agent (a generic agent accepts anything listed for "agent-skills"), "standard"
// when it is a bundled Agent Skills format skill, which the Hub copies itself, and
// the agent loads that format. Returns null when neither holds. Non-skill
// artifacts and external installers need an explicit listing.
export function compatibilityBasis(skill, agent) {
  const listed = new Set(skill.compatibility ?? []);
  if (listed.has(agent) || (agent === "generic-agent" && listed.has("agent-skills"))) return "listed";
  const isSkill = (skill.artifact_type ?? skill.type ?? "skill") === "skill";
  const bundled = (skill.distribution ?? "bundled") === "bundled";
  if (isSkill && bundled && listed.has("agent-skills") && AGENT_SKILLS_STANDARD_AGENTS.includes(agent)) return "standard";
  return null;
}

export function filterForAgent(skills, agent) {
  return skills.filter((skill) => compatibilityBasis(skill, agent) !== null);
}

// Searches PATH (honoring PATHEXT on Windows) for an executable.
export function findExecutable(command, env = process.env) {
  const value = String(command ?? "").trim();
  if (!value) return null;
  const isPath = value.includes("/") || value.includes("\\") || path.isAbsolute(value);
  const entries = isPath ? [""] : (env.PATH ?? env.Path ?? "").split(path.delimiter).filter(Boolean);
  const extensions = process.platform === "win32"
    ? (env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";").filter(Boolean)
    : [];
  const hasExtension = extensions.some((ext) => value.toLowerCase().endsWith(ext.toLowerCase()));
  const names = process.platform === "win32" && !hasExtension ? [value, ...extensions.map((ext) => value + ext)] : [value];
  for (const entry of entries) {
    for (const name of names) {
      const candidate = entry ? path.join(entry, name) : name;
      try {
        if (!fs.statSync(candidate).isFile()) continue;
        if (process.platform !== "win32") fs.accessSync(candidate, fs.constants.X_OK);
        return candidate;
      } catch {
        // Not present or not executable.
      }
    }
  }
  return null;
}

// Whether the catalog offers a local install. This never reflects installation state.
// True when `install` accepts the capability: the single definition the CLI,
// search filters and listings share.
export function isInstallable(cap) {
  return catalogAvailability(cap).status === "eligible";
}

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

// Parses SKILL.md frontmatter as YAML 1.2 without resolving aliases, anchors,
// merge keys or custom tags. It fails closed: malformed frontmatter throws, so a
// broken declaration is never mistaken for an absent license or description.
// Only top-level scalar fields are returned; nested metadata is skipped.
export function parseFrontmatter(text) {
  const lines = String(text ?? "").replace(/^\uFEFF/, "").split(/\r?\n/);
  const fields = {};
  if (lines[0]?.trim() !== "---") return fields;
  const end = lines.findIndex((line, i) => i > 0 && /^(---|\.\.\.)\s*$/.test(line));
  if (end === -1) throw new Error("Unclosed YAML frontmatter");
  const document = parseDocument(lines.slice(1, end).join("\n") + "\n", { version: "1.2", uniqueKeys: true });
  if (document.errors.length || document.warnings.length) throw new Error("Invalid YAML frontmatter: " + (document.errors[0] ?? document.warnings[0]).message);
  if (document.contents === null) return fields;
  if (!isMap(document.contents)) throw new Error("Frontmatter must be a mapping");
  visit(document, (_key, node) => {
    if (isAlias(node) || node?.anchor || (node?.tag && node.tag !== "tag:yaml.org,2002:str")) throw new Error("Frontmatter aliases, anchors and custom tags are forbidden");
    if (isMap(node) && node.items.some((pair) => pair.key?.value === "<<")) throw new Error("Frontmatter merge keys are forbidden");
  });
  for (const { key, value } of document.contents.items) {
    if (!isScalar(key) || typeof key.value !== "string" || ["__proto__", "constructor", "prototype"].includes(key.value)) throw new Error("Invalid frontmatter key");
    if (["name", "description", "license"].includes(key.value) && (!isScalar(value) || typeof value.value !== "string" || !value.value.trim())) throw new Error(`Frontmatter ${key.value} must be a non-empty string`);
    if (isScalar(value)) fields[key.value] = value.value;
  }
  return fields;
}
