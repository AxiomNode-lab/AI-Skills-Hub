import { select, checkbox, confirm, input, Separator } from "@inquirer/prompts";
import { detectAgents } from "../../../installer/src/detector.mjs";
import { catalogAvailability, filterForAgent, loadRegistry } from "@ai-skills-hub/core";
import { installableSkills } from "./available.mjs";
import { availabilityText, groupByPublisher, paint, truncate } from "../ui.mjs";
import { installCapability, planCapability } from "../install-executor.mjs";
import { resolveDependencies, checkPrerequisites } from "../utils.mjs";

function displayName(cap) {
  const status = catalogAvailability(cap).status;
  return status === "eligible" ? `${cap.name} ${paint("dim", `(${cap.id})`)}` : `${cap.name} ${paint("dim", `(${cap.id})`)} — ${availabilityText(status)}`;
}

export async function interactiveCommand() {
  console.log(paint("bold", "AI Skills Hub") + paint("dim", " v0.2.0") + "\n");

  const agents = await detectAgents();
  const selectedAgentId = await select({
    message: "Which AI agent should the skills be installed for?",
    choices: agents.map((agent) => ({
      name: agent.evidence ? `${agent.name} ${paint("green", "✔ detected")}` : agent.name,
      value: agent.id,
      description: agent.evidence ? `Found: ${agent.evidence}` : agent.id === "agent-skills" ? "Installs to .agents/skills, read by Codex, Cursor, Copilot and other Agent Skills clients" : "Not detected on this machine; you can still install for it"
    }))
  });

  const registry = loadRegistry();
  const installable = installableSkills(registry, { agent: selectedAgentId });
  const searchMode = await select({
    message: "How would you like to find skills?",
    choices: [
      { name: `Browse installable skills (${installable.length})`, value: "browse" },
      { name: "Search installable skills", value: "search" },
      { name: "Browse the whole catalog (includes skills that cannot be installed yet)", value: "all" }
    ]
  });

  let candidates = installable;
  if (searchMode === "search") {
    const query = await input({ message: "Search query:" });
    candidates = installableSkills(registry, { agent: selectedAgentId, query });
  } else if (searchMode === "all") {
    candidates = filterForAgent(registry.skills, selectedAgentId);
  }

  if (candidates.length === 0) {
    console.log("No matching skills found.");
    return;
  }

  // Group by publisher so long lists stay navigable.
  const choices = [];
  for (const [owner, group] of groupByPublisher(candidates)) {
    choices.push(new Separator(paint("cyan", `── ${owner} ──`)));
    for (const cap of group) {
      choices.push({
        name: displayName(cap),
        value: cap.id,
        description: `${truncate(cap.description || "No description.", 220)} (${cap.security?.risk || "unknown"} risk)`
      });
    }
  }

  const selectedIds = await checkbox({
    message: "Select skills to install (space to select, enter to confirm):",
    choices,
    pageSize: 15,
    required: true
  });

  if (!selectedIds.length) {
    console.log("No capabilities selected.");
    return;
  }

  const finalInstallList = resolveDependencies(selectedIds, registry.skills);
  const resolvedPlans = [];

  for (const cap of finalInstallList) {
    const result = planCapability(cap, selectedAgentId, { scope: "project" });
    resolvedPlans.push({ cap, result });
  }

  const actionable = resolvedPlans.filter(({ result }) =>
    ["install", "configuration", "source-direct", "marketplace"].includes(result.action)
  );

  const blocked = resolvedPlans.filter(({ result }) =>
    ["hold", "blocked", "unsupported", "incompatible", "adapter-pending"].includes(result.action)
  );

  if (blocked.length) {
    console.log("\nSome selected capabilities cannot currently be installed:");
    for (const { cap, result } of blocked) {
      console.log(`- ${cap.id}: ${result.reason || result.action}`);
    }
  }

  if (!actionable.length) {
    console.log("No installable capabilities remain.");
    return;
  }

  const requiresConsent = actionable.some(({ result }) =>
    ["source-direct", "marketplace", "configuration"].includes(result.action)
  );

  if (requiresConsent) {
    console.log("\nExternal installers and agent configuration changes require explicit confirmation.");
  }

  const proceed = await confirm({
    message: `Install ${actionable.length} ${actionable.length === 1 ? "skill" : "skills"} for ${selectedAgentId}?`,
    default: false
  });

  if (!proceed) {
    console.log("Installation aborted.");
    return;
  }

  let failures = 0;
  for (const { cap } of actionable) {
    try {
      const prerequisites = checkPrerequisites(cap.prerequisites);
      if (prerequisites.missing.length) {
        console.error(`Skipped ${cap.id}: missing prerequisites: ${prerequisites.missing.join(", ")}`);
        failures += 1;
        continue;
      }

      const result = await installCapability(cap, {
        agent: selectedAgentId,
        scope: "project",
        confirmed: true,
        env: {}
      });

      if (!result.installed) {
        console.error(`Skipped ${cap.id}: ${result.reason || result.action}`);
        failures += 1;
      } else {
        console.log(`${paint("green", "✔")} Installed ${cap.id}`);
      }
    } catch (error) {
      failures += 1;
      console.error(`Failed to install ${cap.id}: ${error.message}`);
    }
  }

  console.log(failures ? paint("yellow", `Finished with ${failures} failure(s).`) : paint("green", "Installation complete."));
}
