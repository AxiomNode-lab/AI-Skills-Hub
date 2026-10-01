import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import { loadRegistry } from "@ai-skills-hub/core";

export function checkPrerequisites(prerequisites) {
  if (!prerequisites || !Array.isArray(prerequisites)) return { missing: [] };
  
  const missing = [];
  for (const prereq of prerequisites) {
    try {
      execSync(`command -v ${prereq}`, { stdio: 'ignore' });
    } catch {
      console.log(`\n⚠️  Prerequisite '${prereq}' is missing. Attempting auto-install...`);
      try {
        if (prereq === 'uv') {
          execSync(`curl -LsSf https://astral.sh/uv/install.sh | sh`, { stdio: 'inherit' });
          const home = os.homedir();
          process.env.PATH = `${process.env.PATH}:${home}/.cargo/bin:${home}/.local/bin`;
          console.log(`✅ Successfully auto-installed '${prereq}'`);
        } else {
          throw new Error("No auto-installer defined for this tool.");
        }
      } catch (autoErr) {
        missing.push(prereq);
      }
    }
  }
  return { missing };
}

export async function autoSyncCapability(capPath) {
  if (!capPath) return;
  const gitDir = path.join(capPath, ".git");
  try {
    await fs.access(gitDir);
    // It's a git repo, fetch latest
    console.log(`🔄 Auto-syncing capability (git pull)...`);
    execSync(`git pull`, { cwd: capPath, stdio: 'ignore' });
  } catch {
    // Not a git repo or no access, skip gracefully
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

export async function readCapabilityManifest(capPath, id) {
  const manifestPath = path.join(capPath, 'manifest.json');
  if (await fileExists(manifestPath)) {
    try {
      const data = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
      return {
        ...data,
        id: data.id || id,
        materialized_root: capPath,
        materialized: true,
        distribution: "bundled",
        release: { status: "eligible" }
      };
    } catch (e) {
      console.error(`Error reading manifest for ${id}:`, e.message);
    }
  }
  
  const skillMdPath = path.join(capPath, 'SKILL.md');
  if (await fileExists(skillMdPath)) {
    return {
      id,
      name: id,
      type: "skill",
      description: "Legacy skill without manifest.",
      materialized_root: capPath,
      materialized: true,
      distribution: "bundled",
      release: { status: "eligible" },
      dependencies: []
    };
  }
  
  return null;
}

export async function readLocalCapabilities() {
  try {
    const registry = loadRegistry(
      path.resolve(process.cwd(), "catalog", "skills.json"),
      path.resolve(process.cwd(), "catalog", "bundles.json")
    );
    return registry.skills || [];
  } catch (error) {
    // Only fail gracefully if it's explicitly allowed, but core will throw if not found
    return [];
  }
}

export function resolveDependencies(selectedIds, allCapabilities) {
  const resolved = new Set();
  const queue = [...selectedIds];
  
  while (queue.length > 0) {
    const currentId = queue.shift();
    if (resolved.has(currentId)) continue;
    
    resolved.add(currentId);
    
    const cap = allCapabilities.find(c => c.id === currentId);
    if (cap && cap.dependencies && Array.isArray(cap.dependencies)) {
      for (const depId of cap.dependencies) {
        if (!resolved.has(depId)) {
          queue.push(depId);
        }
      }
    }
  }
  
  return Array.from(resolved).map(id => allCapabilities.find(c => c.id === id)).filter(Boolean);
}

export async function checkForUpdates() {
  try {
    const localPkgPath = path.resolve(process.cwd(), "package.json");
    if (!(await fileExists(localPkgPath))) return;
    
    const localPkg = JSON.parse(await fs.readFile(localPkgPath, 'utf8'));
    const localVersion = localPkg.version;
    
    const response = await fetch("https://raw.githubusercontent.com/AxiomNode-lab/AI-Skills-Hub/main/package.json", {
      signal: AbortSignal.timeout(1500)
    });
    
    if (response.ok) {
      const remotePkg = await response.json();
      if (remotePkg.version && remotePkg.version !== localVersion) {
        console.log(`\n📦 Update available: ${localVersion} → ${remotePkg.version}`);
        console.log(`Run 'git pull' to update.\n`);
      }
    }
  } catch (e) {
    // Silently fail on network issues
  }
}
