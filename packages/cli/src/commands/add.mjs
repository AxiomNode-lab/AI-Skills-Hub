import { hybridSearch, toInstallChoices } from "@ai-skills-hub/discovery";
import { loadRegistry } from "@ai-skills-hub/core";
import { getAdapter } from "../../../installer/src/adapters/index.mjs";
import path from "node:path";
import { confirm, select } from "@inquirer/prompts";
import { writeInstallRecord } from "../../../installer/src/state.mjs";

export async function addCommand(query, options = {}) {
  if (!query) {
    console.error("❌ Error: You must provide a search query or capability ID.");
    console.log("Usage: skills-hub add <query> [--agent <agent-id>]");
    return;
  }

  const agent = options.agent || "generic-agent";
  
  if (query.startsWith("http") || query.startsWith("git@") || query.endsWith(".git")) {
    console.log(`📥 Fetching capability from ${query}...`);
    try {
      const { execFileSync } = await import("node:child_process");
      const fs = (await import("node:fs/promises")).default;
      const repoName = query.split('/').pop().replace('.git', '');
      const libDir = path.resolve(process.cwd(), "capabilities-library");
      await fs.mkdir(libDir, { recursive: true });
      const targetDir = path.join(libDir, repoName);
      
      try {
        await fs.access(targetDir);
        console.error(`❌ Error: A capability named '${repoName}' already exists at ${targetDir}`);
        console.log("Use 'skills-hub sync' to update it instead.");
        return;
      } catch {}

      console.log(`Cloning into ${targetDir}...`);
      execFileSync("git", ["clone", query, targetDir], { stdio: 'inherit' });
      console.log(`\n✅ Successfully added ${repoName} to your capabilities library!`);
      console.log(`Run 'skills-hub' to install it to your agents.`);
      return;
    } catch (error) {
      console.error(`❌ Failed to add capability via Git:`, error.message);
      return;
    }
  }

  console.log(`🔍 Searching for "${query}" (Target agent: ${agent})...`);

  try {
    const registry = loadRegistry(
      path.resolve(process.cwd(), "catalog", "skills.json"),
      path.resolve(process.cwd(), "catalog", "bundles.json")
    );

    const searchResult = await hybridSearch(registry, query, { agent, limit: 10 });
    
    if (!searchResult || searchResult.results.length === 0) {
      console.log("No capabilities found matching your query.");
      return;
    }

    const choices = toInstallChoices(searchResult, agent, { scope: "project" });
    
    console.log(`\nFound ${choices.length} capabilities:\n`);
    
    const displayChoices = choices.map(c => ({
      name: `${c.name} (${c.publisher}) [${c.origin}] - ${c.action}`,
      value: c,
      description: `${c.description || 'No description.'}\nSecurity: ${c.security?.risk || 'unknown'}`
    }));

    displayChoices.push({ name: "Cancel", value: null });

    const selected = await select({
      message: "Select a capability to install:",
      choices: displayChoices
    });

    if (!selected) {
      console.log("Cancelled.");
      return;
    }

    console.log(`\nYou selected: ${selected.name}`);
    console.log(`Action: ${selected.action}`);
    
    if (selected.action === "source-direct" || selected.action === "marketplace" || selected.action === "configuration" || selected.action === "adapter-pending") {
      console.log(`⚠️ Warning: This capability is distributed via ${selected.origin} and requires remote execution or review.`);
      const proceed = await confirm({ message: "Do you want to proceed with installation?", default: false });
      if (!proceed) {
        console.log("Installation aborted.");
        return;
      }
    } else if (selected.action === "incompatible" || selected.action === "blocked" || selected.action === "unsupported") {
       console.log(`❌ Cannot install. Reason: ${selected.reason}`);
       return;
    }

    console.log(`\nInstalling ${selected.name}...`);
    
    // Convert choice back to capability item for the adapter
    const cap = searchResult.results.find(r => r.item.id === selected.id).item;
    const adapter = getAdapter(cap);
    
    const result = await adapter.install({
      agent,
      scope: "project",
      overwrite: true,
      force: true
    });
    
    writeInstallRecord({
      schema_version: "0.2",
      skill_id: cap.id,
      name: cap.name,
      type: cap.type || cap.artifact_type || "skill",
      agent,
      scope: "project",
      installed_at: new Date().toISOString(),
      destination: result.destination || "unknown",
      files: []
    });

    console.log(`\n✅ Successfully installed ${selected.name}!`);

  } catch (error) {
    console.error(`❌ Failed to search/install:`, error.message);
  }
}
