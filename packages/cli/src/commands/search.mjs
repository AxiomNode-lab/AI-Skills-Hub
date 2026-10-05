import { searchRegistry } from "@ai-skills-hub/discovery";
import { isInstallable, loadRegistry } from "@ai-skills-hub/core";
import { statusReader, printCapabilityStatus } from "../capability-status.mjs";
import { paint } from "../ui.mjs";

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
    console.log(`No capabilities found matching "${query || ""}".`);
    return;
  }

  console.log(`Found ${results.length} capabilities:\n`);
  for (const cap of results) {
    console.log(`ID: ${paint("bold", cap.id)}`);
    console.log(`Name: ${cap.name}`);
    printCapabilityStatus(cap.hub_status);
    console.log(`Type: ${cap.artifact_type || cap.type || "skill"}`);
    console.log(`Distribution: ${cap.distribution}`);
    console.log(`Release: ${cap.release?.status || "unknown"}`);
    console.log(`Security: ${cap.security?.risk || "unknown"} / ${cap.security?.scan_status || "unknown"}`);
    console.log(`Description: ${cap.description || "N/A"}`);
    console.log("------------------------------------------");
  }
}
