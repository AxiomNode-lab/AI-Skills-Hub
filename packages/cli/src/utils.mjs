import fs from "node:fs/promises";
import path from "node:path";
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

export async function checkForUpdates() {
  if (process.env.SKILLS_HUB_NO_UPDATE_CHECK || process.env.CI || !process.stdout.isTTY) return;
  try {
    const localPkgPath = path.join(hubHome(), "package.json");
    if (!(await fileExists(localPkgPath))) return;

    const localPkg = JSON.parse(await fs.readFile(localPkgPath, "utf8"));
    const localVersion = localPkg.version;

    const response = await fetch(
      "https://raw.githubusercontent.com/AxiomNode-lab/AI-Skills-Hub/main/package.json",
      { signal: AbortSignal.timeout(1500) }
    );

    if (response.ok) {
      const remotePkg = await response.json();
      if (remotePkg.version && remotePkg.version !== localVersion) {
        console.log(`\nUpdate available: ${localVersion} -> ${remotePkg.version}`);
        console.log("Run 'git pull' to update.\n");
      }
    }
  } catch {
    // Version checks are best-effort and must never block the CLI.
  }
}
