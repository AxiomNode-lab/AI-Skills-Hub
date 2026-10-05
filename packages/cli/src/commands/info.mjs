import { readLocalCapabilities } from "../utils.mjs";
import fs from "node:fs/promises";
import { resolveHubPath } from "@ai-skills-hub/core";
import path from "node:path";
import { statusReader, printCapabilityStatus } from "../capability-status.mjs";

export async function infoCommand(id, options = {}) {
  if (!id) {
    console.error("Error: Capability ID is required.");
    process.exitCode = 1;
    return;
  }

  const allCapabilities = readLocalCapabilities();
  const cap = allCapabilities.find((c) => c.id === id || c.name === id);

  if (!cap) {
    console.error(`Error: Capability '${id}' not found.`);
    process.exitCode = 1;
    return;
  }

  const output = { ...cap, hub_status: statusReader(options)(cap) };
  if (cap.artifact_type === "skill" && cap.materialized_root) {
    const skillPath = path.join(resolveHubPath(cap.materialized_root), "SKILL.md");
    try {
      output.skill_content = await fs.readFile(skillPath, "utf8");
    } catch {
      // Materialized content is optional metadata.
    }
  }

  if (options.json) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log("==========================================");
  console.log(` ID:           ${cap.id}`);
  console.log(` Name:         ${cap.name}`);
  printCapabilityStatus(output.hub_status);
  console.log(` Type:         ${cap.artifact_type || cap.type || "skill"}`);
  console.log(` Publisher:    ${cap.publisher || "N/A"}`);
  console.log(` Distribution: ${cap.distribution}`);
  const releaseReasons = cap.release?.reasons?.length ? ` (${cap.release.reasons.join(", ")})` : "";
  console.log(` Release:      ${cap.release?.status || "unknown"}${releaseReasons}`);
  for (const notice of cap.release?.notices ?? []) console.log(` Notice:       ${notice.text}`);
  console.log(` Security:     ${cap.security?.risk || "unknown"} / ${cap.security?.scan_status || "unknown"}`);
  console.log(` Description:  ${cap.description || "N/A"}`);
  if (cap.dependencies?.length) console.log(` Dependencies: ${cap.dependencies.join(", ")}`);
  console.log("==========================================");

  if (output.skill_content) {
    console.log("\n--- SKILL.md Content ---\n");
    console.log(output.skill_content);
  }
}
