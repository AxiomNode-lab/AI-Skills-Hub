import { select, checkbox, confirm, input, Separator } from "@inquirer/prompts";
import { detectAgents } from "../../../installer/src/detector.mjs";
import { loadRegistry, filterForAgent } from "@ai-skills-hub/core";
import { searchRegistry, buildAdapterPlan } from "@ai-skills-hub/discovery";
import { installCapability } from "../install-executor.mjs";
import { resolveDependencies, checkPrerequisites } from "../utils.mjs";

function displayName(cap) {
  return `${cap.name} [${cap.distribution}]`;
}

export async function interactiveCommand() {
  console.log("AI Skills Hub CLI v0.2.0");
  console.log("----------------------\n");

  const detectedAgents = await detectAgents();
  if (detectedAgents.length === 0) {
    console.log("No supported AI agents detected.");
    return;
  }

  const selectedAgentId = await select({
    message: "Select the AI agent:",
    choices: detectedAgents.map((agent) => ({
      name: agent.name,
      value: agent.id,
      description: `Type: ${agent.type}`
    }))
  });

  const registry = loadRegistry("catalog/skills.json", "catalog/bundles.json");
  const agentCapabilities = filterForAgent(registry.skills, selectedAgentId);

  if (agentCapabilities.length === 0) {
    console.log(`No catalog capabilities are compatible with ${selectedAgentId}.`);
    return;
  }

  const searchMode = await select({
    message: "How would you like to find capabilities?",
    choices: [
      { name: "Browse compatible capabilities", value: "browse" },
      { name: "Search by keyword or intent", value: "search" }
    ]
  });

  let candidates = agentCapabilities;
  if (searchMode === "search") {
    const query = await input({ message: "Search query:" });
    candidates = searchRegistry(registry, query, {
      agent: selectedAgentId,
      remote: false,
      limit: 50
    }).map(({ item }) => item);
  }

  if (candidates.length === 0) {
    console.log("No matching capabilities found.");
    return;
  }

  const grouped = [
    ["Agent Skills", candidates.filter((cap) => (cap.artifact_type || cap.type) === "skill")],
    ["MCP Servers", candidates.filter((cap) => (cap.artifact_type || cap.type) === "mcp-server")],
    ["Other Capabilities", candidates.filter((cap) => !["skill", "mcp-server"].includes(cap.artifact_type || cap.type))]
  ];

  const choices = [];
  for (const [label, items] of grouped) {
    if (!items.length) continue;
    choices.push(new Separator(`--- ${label} ---`));
    for (const cap of items) {
      choices.push({
        name: displayName(cap),
        value: cap.id,
        description: `${cap.description || "No description."} Security: ${cap.security?.risk || "unknown"}; release: ${cap.release?.status || "unknown"}`
      });
    }
  }

  const selectedIds = await checkbox({
    message: "Select capabilities to install:",
    choices,
    required: true
  });

  if (!selectedIds.length) {
    console.log("No capabilities selected.");
    return;
  }

  const finalInstallList = resolveDependencies(selectedIds, registry.skills);
  const resolvedPlans = [];

  for (const cap of finalInstallList) {
    const result = buildAdapterPlan(cap, selectedAgentId, { scope: "project" });
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
    message: `Install ${actionable.length} capability/capabilities to ${selectedAgentId}?`,
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
        console.log(`Installed ${cap.id}.`);
      }
    } catch (error) {
      failures += 1;
      console.error(`Failed to install ${cap.id}: ${error.message}`);
    }
  }

  console.log(failures ? `Finished with ${failures} failure(s).` : "Installation complete.");
}
