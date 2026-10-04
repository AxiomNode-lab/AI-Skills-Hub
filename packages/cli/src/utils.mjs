import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { findExecutable, loadRegistry, packageRoot } from "@ai-skills-hub/core";

export function isExecutableAvailable(command) {
  return findExecutable(command) !== null;
}

export function checkPrerequisites(prerequisites) {
  if (!Array.isArray(prerequisites)) return { missing: [] };

  const missing = [];
  for (const prereq of prerequisites) {
    const value = String(prereq ?? "").trim();
    if (!value || !isExecutableAvailable(value)) missing.push(value || "<empty>");
  }
  return { missing };
}

export async function autoSyncCapability(capPath) {
  if (!capPath) return;
  const gitDir = path.join(capPath, ".git");
  try {
    await fs.access(gitDir);
    execFileSync("git", ["pull", "--ff-only"], { cwd: capPath, stdio: "ignore" });
  } catch {
    // Not a Git repository or the update could not be applied cleanly.
  }
}

export async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export function readLocalCapabilities() {
  try {
    const registry = loadRegistry();
    if (!Array.isArray(registry.skills)) {
      throw new Error("catalog/skills.json does not contain a skills array");
    }
    return registry.skills;
  } catch (error) {
    throw new Error(`Unable to load the local registry: ${error.message}`, { cause: error });
  }
}

// Returns the requested capabilities and their dependencies in install order:
// every dependency before the capabilities that need it. A cycle is an error.
export function resolveDependencies(selectedIds, allCapabilities) {
  const byId = new Map(allCapabilities.map((capability) => [capability.id, capability]));
  const ordered = [];
  const state = new Map(); // id -> "visiting" | "done"
  const visit = (id, chain) => {
    if (state.get(id) === "done") return;
    if (state.get(id) === "visiting") throw new Error("Dependency cycle: " + [...chain, id].join(" -> "));
    state.set(id, "visiting");
    const capability = byId.get(id);
    for (const dependency of capability?.dependencies ?? []) visit(dependency, [...chain, id]);
    state.set(id, "done");
    if (capability) ordered.push(capability);
  };
  for (const id of selectedIds) visit(id, []);
  return ordered;
}

const UPDATE_CHECK_TTL_MS = 24 * 60 * 60 * 1000;

// Numeric comparison of x.y.z[-pre] versions; a release outranks its prereleases.
export function compareVersions(a, b) {
  const parse = (v) => {
    const [core, pre = null] = String(v).split("-", 2);
    return { nums: core.split(".").map((n) => Number.parseInt(n, 10) || 0), pre };
  };
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < 3; i += 1) if ((x.nums[i] ?? 0) !== (y.nums[i] ?? 0)) return (x.nums[i] ?? 0) - (y.nums[i] ?? 0);
  if (x.pre === y.pre) return 0;
  if (x.pre === null) return 1;
  if (y.pre === null) return -1;
  return x.pre.localeCompare(y.pre, "en", { numeric: true });
}

// Prints a notice when npm has a newer version of this package. The answer is
// cached for a day so commands do not wait on the network every time. Skipped
// in a development checkout (private package.json), in CI, and off a TTY.
export async function checkForUpdates({
  env = process.env,
  isTTY = process.stdout.isTTY,
  fetchImpl = fetch,
  now = Date.now(),
  cacheFile = path.join(os.homedir(), ".cache", "ai-skills-hub", "update-check.json"),
  localPkgPath = path.join(packageRoot(), "package.json")
} = {}) {
  if (env.SKILLS_HUB_NO_UPDATE_CHECK || env.CI || !isTTY) return;
  try {
    if (!(await fileExists(localPkgPath))) return;
    const local = JSON.parse(await fs.readFile(localPkgPath, "utf8"));
    if (local.private || !local.name) return;

    let latest = null;
    try {
      const cached = JSON.parse(await fs.readFile(cacheFile, "utf8"));
      if (cached.name === local.name && now - cached.checked_at < UPDATE_CHECK_TTL_MS) latest = cached.latest ?? null;
      else throw new Error("stale");
    } catch {
      const response = await fetchImpl(
        `https://registry.npmjs.org/${local.name.replace("/", "%2f")}/latest`,
        { signal: AbortSignal.timeout(1500) }
      );
      if (response.ok) latest = (await response.json()).version ?? null;
      await fs.mkdir(path.dirname(cacheFile), { recursive: true });
      await fs.writeFile(cacheFile, JSON.stringify({ name: local.name, checked_at: now, latest }));
    }

    if (typeof latest === "string" && compareVersions(latest, local.version) > 0) {
      console.error(`\nUpdate available: ${local.version} -> ${latest}. Run: npm install -g ${local.name}@latest (or use npx ${local.name}@latest)\n`);
    }
  } catch {
    // Version checks are best-effort and must never block the CLI.
  }
}
