import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { loadRegistry } from "@ai-skills-hub/core";

function executableCandidates(command) {
  const value = String(command ?? "").trim();
  if (!value) return [];

  const separator = path.sep;
  const isPath = value.includes("/") || value.includes("\") || path.isAbsolute(value);
  if (isPath) return [value];

  const pathEntries = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  if (process.platform !== "win32") {
    return pathEntries.map((entry) => path.join(entry, value));
  }

  const extensions = (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM")
    .split(";")
    .filter(Boolean);
  const hasExtension = extensions.some((ext) => value.toLowerCase().endsWith(ext.toLowerCase()));
  const names = hasExtension ? [value] : [value, ...extensions.map((ext) => value + ext)];
  return pathEntries.flatMap((entry) => names.map((name) => path.join(entry, name)));
}

export function isExecutableAvailable(command) {
  try {
    return executableCandidates(command).some((candidate) => {
      try {
        const stat = fsSync.statSync(candidate);
        if (!stat.isFile()) return false;
        if (process.platform === "win32") return true;
        fsSync.accessSync(candidate, fsSync.constants.X_OK);
        return true;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
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
  const registryPath = path.resolve(process.cwd(), "catalog", "skills.json");
  const bundlesPath = path.resolve(process.cwd(), "catalog", "bundles.json");
  try {
    const registry = loadRegistry(registryPath, bundlesPath);
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
  try {
    const localPkgPath = path.resolve(process.cwd(), "package.json");
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

import fsSync from "node:fs";