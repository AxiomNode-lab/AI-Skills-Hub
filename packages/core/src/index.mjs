import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

function unquote(value) {
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1).replaceAll("''", "'");
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\(["\\nt])/g, (_, c) => ({ n: "\n", t: "\t" })[c] ?? c);
  }
  return value;
}

const indentOf = (line) => line.match(/^ */)[0].length;

// Reads top-level scalar fields from SKILL.md YAML frontmatter, including
// folded (>) and literal (|) block scalars and indented plain continuations.
// Nested mappings and sequences are skipped; this is metadata, not a full YAML parser.
export function parseFrontmatter(text) {
  const lines = String(text ?? "").replace(/^\uFEFF/, "").split(/\r?\n/);
  const fields = {};
  if (lines[0]?.trim() !== "---") return fields;
  const end = lines.findIndex((line, i) => i > 0 && /^(---|\.\.\.)\s*$/.test(line));
  const body = lines.slice(1, end === -1 ? lines.length : end);

  for (let i = 0; i < body.length; i += 1) {
    const match = body[i].match(/^([A-Za-z0-9_-]+):(?:\s+(.*))?$/);
    if (!match) continue;
    const [, key, rawValue = ""] = match;
    const trimmed = rawValue.trim();
    // A comment may follow a closed quoted scalar: "text" # note
    const closedQuote = trimmed.match(/^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*')\s*(?:#.*)?$/);
    const value = closedQuote ? closedQuote[1] : /^["']/.test(trimmed) ? trimmed : rawValue.replace(/\s+#.*$/, "").trim();
    const continuation = [];
    while (i + 1 < body.length && (body[i + 1].trim() === "" || indentOf(body[i + 1]) > 0)) {
      continuation.push(body[i + 1]);
      i += 1;
    }
    while (continuation.length && continuation.at(-1).trim() === "") continuation.pop();

    // Block indicator with optional indentation digit and chomping, in either order.
    const block = value.match(/^([>|])(?:([+-])[1-9]?|[1-9]([+-])?)?$/);
    if (block) {
      const nonBlank = continuation.filter((line) => line.trim());
      const indent = nonBlank.length ? Math.min(...nonBlank.map(indentOf)) : 0;
      const content = continuation.map((line) => line.slice(indent));
      let result;
      if (block[1] === "|") result = content.join("\n");
      else {
        result = "";
        for (const line of content) {
          if (line === "") result += "\n";
          else if (/^\s/.test(line)) result += (result && !result.endsWith("\n") ? "\n" : "") + line + "\n";
          else result += (result && !result.endsWith("\n") ? " " : "") + line;
        }
        result = result.replace(/\n$/, "");
      }
      fields[key] = (block[2] ?? block[3]) === "-" ? result.replace(/\n+$/, "") : result + "\n";
      continue;
    }

    const firstNested = continuation.find((line) => line.trim())?.trim();
    if (value === "" && (!firstNested || /^-(\s|$)/.test(firstNested) || /^[^\s"'#][^#]*?:(\s|$)/.test(firstNested))) {
      // Empty, or a nested mapping or sequence; only scalar fields are extracted.
      if (!firstNested) fields[key] = "";
      continue;
    }

    if (/^["']/.test(value) && !(value.length > 1 && value.endsWith(value[0]))) {
      // A quoted scalar spanning several lines.
      fields[key] = unquote([value, ...continuation.map((line) => line.trim())].join(" ").replace(/\s+/g, " "));
      continue;
    }

    if (!continuation.length || closedQuote) {
      fields[key] = unquote(value);
      continue;
    }
    // A plain multi-line scalar folds lines with spaces; a blank line is a newline.
    let plain = value;
    for (const line of continuation.map((item) => item.trim())) {
      if (line.startsWith("#")) continue;
      if (!line) plain += plain ? "\n" : "";
      else plain += plain && !plain.endsWith("\n") ? " " + line : line;
    }
    fields[key] = plain;
  }
  return fields;
}
