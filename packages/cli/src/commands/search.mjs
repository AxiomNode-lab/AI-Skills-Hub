import { searchRegistry } from "@ai-skills-hub/discovery";
import { isInstallable, loadRegistry } from "@ai-skills-hub/core";
import { statusReader } from "../capability-status.mjs";
import { paint, riskLabel, truncate, whyNotInstallable } from "../ui.mjs";

export function searchCommand(query, options = {}) {
  const registry = loadRegistry();

  const readStatus = statusReader(options);
  // Narrow the pool before ranking so the limit applies to installable matches.
  const pool = options.installable
    ? { ...registry, skills: registry.skills.filter(isInstallable) }
    : registry;
  const results = searchRegistry(pool, query || "", {
    agent: options.agent || undefined,
    limit: options.limit || 50
  }).map(({ item, score }) => ({ ...item, _score: score, hub_status: readStatus(item) }));

  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  if (results.length === 0) {
    console.log(`No skills match "${query || ""}". Try a broader word, or 'skills-hub available' for everything installable.`);
    return;
  }

  const width = Math.max(40, (process.stdout.columns || 100) - 6);
  const installable = results.filter((cap) => cap.hub_status.availability.status === "eligible");
  const other = results.filter((cap) => cap.hub_status.availability.status !== "eligible");
  console.log(paint("bold", `${results.length} results for "${query}" (${installable.length} installable)`));
  const line = (cap, note) => {
    const installed = cap.hub_status.installation.status === "installed" ? paint("green", "  ✔ installed") : "";
    console.log(`  ${paint("bold", cap.id)}  ${note}${installed}`);
    console.log(`    ${paint("dim", truncate(cap.description || "No description.", width))}`);
  };
  if (installable.length) {
    console.log("\n" + paint("green", "Installable now"));
    for (const cap of installable) line(cap, riskLabel(cap.security?.risk));
  }
  if (other.length) {
    console.log("\n" + paint("yellow", "Not installable"));
    for (const cap of other) line(cap, paint("gray", whyNotInstallable(cap, cap.hub_status.availability.status)));
  }
  console.log(`\nInstall: ${paint("green", `skills-hub install <id> --agent ${options.agent || "<agent>"}`)}`);
  console.log("Details: skills-hub info <id>");
}
