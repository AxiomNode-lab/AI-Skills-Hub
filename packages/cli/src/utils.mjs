import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { findExecutable, hubHome, loadRegistry } from "@ai-skills-hub/core";

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

export function resolveDependencies(selectedIds, allCapabilities) {
  const resolved = new Set();
  const queue = [...selectedIds];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (resolved.has(currentId)) continue;

    resolved.add(currentId);

    const cap = allCapabilities.find((c) => c.id === currentId);
    if (cap && Array.isArray(cap.dependencies)) {
      for (const depId of cap.dependencies) {
        if (!resolved.has(depId)) queue.push(depId);
      }
    }
  }

  return Array.from(resolved)
    .map((id) => allCapabilities.find((c) => c.id === id))
    .filter(Boolean);
}

const UPDATE_CHECK_TTL_MS = 24 * 60 * 60 * 1000;

// Prints a notice when a newer Hub version exists. The remote version is cached
// for a day so commands do not wait on the network every time they start.
export async function checkForUpdates({
  env = process.env,
  isTTY = process.stdout.isTTY,
  fetchImpl = fetch,
  now = Date.now(),
  cacheFile = path.join(os.homedir(), ".cache", "ai-skills-hub", "update-check.json")
} = {}) {
  if (env.SKILLS_HUB_NO_UPDATE_CHECK || env.CI || !isTTY) return;
  try {
    const localPkgPath = path.join(hubHome(), "package.json");
    if (!(await fileExists(localPkgPath))) return;
    const localVersion = JSON.parse(await fs.readFile(localPkgPath, "utf8")).version;

    let latest = null;
    try {
      const cached = JSON.parse(await fs.readFile(cacheFile, "utf8"));
      if (now - cached.checked_at < UPDATE_CHECK_TTL_MS) latest = cached.latest ?? null;
      else throw new Error("stale");
    } catch {
      const response = await fetchImpl(
        "https://raw.githubusercontent.com/AxiomNode-lab/AI-Skills-Hub/main/package.json",
        { signal: AbortSignal.timeout(1500) }
      );
      if (response.ok) latest = (await response.json()).version ?? null;
      await fs.mkdir(path.dirname(cacheFile), { recursive: true });
      await fs.writeFile(cacheFile, JSON.stringify({ checked_at: now, latest }));
    }

    if (latest && latest !== localVersion) {
      console.log(`\nUpdate available: ${localVersion} -> ${latest}`);
      console.log("Run 'git pull' to update.\n");
    }
  } catch {
    // Version checks are best-effort and must never block the CLI.
  }
}
