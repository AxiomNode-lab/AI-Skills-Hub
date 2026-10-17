import { readLocalCapabilities } from "../utils.mjs";
import fs from "node:fs/promises";
import { resolveHubPath } from "@ai-skills-hub/core";
import path from "node:path";
import { statusReader } from "../capability-status.mjs";
import { availabilityLabel, installationLabel, paint, securitySummary, truncate, whyNotInstallable } from "../ui.mjs";

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

  const status = output.hub_status;
  const availability = status.availability.status;
  const label = (name) => paint("dim", `${name}:`.padEnd(14));
  console.log(paint("bold", cap.id) + (cap.name && cap.name !== cap.id.split("/").pop() ? paint("dim", `  (${cap.name})`) : ""));
  if (cap.description) console.log(`  ${cap.description}`);
  console.log("");
  console.log(`  ${label("Availability")}${availabilityLabel(availability)} — ${availability === "eligible" ? "installable with skills-hub install" : whyNotInstallable(cap, availability)}`);
  const installation = status.installation;
  console.log(`  ${label("Installation")}${installationLabel(installation.status)}${installation.status === "not-recorded" ? "" : ` (${installation.agent}, ${installation.scope})`}${installation.reason && installation.status !== "not-recorded" ? paint("dim", ` ${installation.reason}`) : ""}`);
  const license = cap.license ?? {};
  console.log(`  ${label("License")}${license.spdx ?? "unknown"}${license.scope === "repository" ? paint("dim", " (repository license)") : ""}${license.status ? paint("dim", `, ${license.status}`) : ""}`);
  if (cap.source?.repo) {
    const revision = cap.source.revision ? `@${cap.source.revision.slice(0, 12)}` : "";
    console.log(`  ${label("Source")}github.com/${cap.source.repo}${revision}${cap.source.path ? `  ${cap.source.path}` : ""}`);
  }
  console.log(`  ${label("Publisher")}${cap.publisher || "unknown"}`);
  console.log(`  ${label("Agents")}${(cap.compatibility ?? []).join(", ") || "none listed"}`);
  console.log(`  ${label("Security")}${securitySummary(cap.security, { reviewed: availability === "eligible" })}`);
  for (const finding of cap.security?.findings ?? []) {
    const licenseText = /^(?:LICEN[CS]E|NOTICE|COPYING)/i.test(finding.file ?? "") ? " (license text)" : "";
    console.log(paint("dim", `    ${finding.type} ${finding.file ?? "SKILL.md"}:${finding.line}${licenseText}  “${truncate(finding.evidence, 40)}”`));
  }
  if (cap.security?.review || cap.license?.evidence?.startsWith?.("catalog/reviews/")) console.log(`  ${label("Review")}${cap.security?.review ?? cap.license.evidence}`);
  if (cap.dependencies?.length) console.log(`  ${label("Depends on")}${cap.dependencies.join(", ")}`);
  for (const notice of cap.release?.notices ?? []) console.log(`  ${label("Notice")}${paint("yellow", notice.text)}`);
  console.log("");
  if (availability === "eligible") console.log(`Install: ${paint("green", `skills-hub install ${cap.id} --agent ${options.agent || "<agent>"}`)}`);
  if (output.skill_content) {
    if (options.content) console.log("\n--- SKILL.md ---\n\n" + output.skill_content);
    else console.log(`SKILL.md: skills-hub info ${cap.id} --content`);
  }
}
