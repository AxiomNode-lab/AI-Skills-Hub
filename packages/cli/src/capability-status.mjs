import { catalogAvailability } from "@ai-skills-hub/core";
import { readInstallRecords, verifyInstallRecord } from "../../installer/src/state.mjs";

export { catalogAvailability };

export function recordedInstallation(record) {
  const base = { agent: record.agent, scope: record.scope, destination: record.destination ?? null };
  // Only managed skill records with file evidence can be verified here.
  if ((record.type ?? "skill") !== "skill" || !record.destination || !record.files?.length) {
    return { ...base, status: "unverified", reason: "record_has_no_verifiable_skill_files" };
  }
  try {
    const verification = verifyInstallRecord(record);
    return { ...base, status: verification.ok ? "installed" : "unverified", reason: verification.reason ?? null };
  } catch (error) {
    return { ...base, status: "unverified", reason: error.message };
  }
}

export function statusReader(options = {}) {
  const scope = options.scope || "project";
  const records = readInstallRecords(scope);
  return (cap) => {
    const record = records[cap.id];
    const matches = record && record.scope === scope && (!options.agent || record.agent === options.agent);
    return {
      availability: catalogAvailability(cap),
      installation: matches ? recordedInstallation(record) : {
        status: "not-recorded", reason: "no_matching_hub_install_record",
        agent: options.agent || null, scope, destination: null
      }
    };
  };
}

export function printCapabilityStatus(status) {
  console.log(`Availability: ${status.availability.status} (${status.availability.reason})`);
  const installed = status.installation;
  console.log(`Installation: ${installed.status} (${installed.scope}, ${installed.agent || "all agents"})${installed.reason ? ` / ${installed.reason}` : ""}`);
}
