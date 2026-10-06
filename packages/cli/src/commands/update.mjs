import { isInstallable, loadRegistry } from "@ai-skills-hub/core";
import { readInstallRecords, verifyInstallRecord } from "../../../installer/src/state.mjs";
import { installMaterializedSkill } from "../../../installer/src/native.mjs";
import { paint } from "../ui.mjs";

// Brings installed skills to the revision the catalog currently releases.
// An update happens only when the catalog release differs from the installed
// one, the new release is eligible, and the installed files are unmodified
// (or --force is given). Nothing is installed that is not already installed.
export function planUpdate(record, skill, { force = false } = {}) {
  const base = { id: record.skill_id, agent: record.agent, from: record.source?.revision ?? null };
  if (record.type && record.type !== "skill") return { ...base, status: "unsupported", reason: "only_native_skills_are_updated" };
  if (!skill) return { ...base, status: "not-in-catalog", reason: "capability_not_in_registry" };
  const to = skill.source?.revision ?? null;
  const verification = verifyInstallRecord(record);
  if (to === base.from) {
    return verification.ok
      ? { ...base, to, status: "up-to-date" }
      : { ...base, to, status: "modified", reason: verification.reason };
  }
  if (!isInstallable(skill)) {
    return { ...base, to, status: "not-releasable", reason: (skill.release?.reasons ?? []).join(", ") || skill.release?.status || "not_eligible" };
  }
  if (!verification.ok && !force) return { ...base, to, status: "modified", reason: verification.reason };
  return { ...base, to, status: "update-available" };
}

export async function updateCommand(id, options = {}) {
  const scope = options.scope || "project";
  const registry = loadRegistry();
  const byId = new Map(registry.skills.map((skill) => [skill.id, skill]));
  let records = Object.values(readInstallRecords(scope));
  if (id) records = records.filter((record) => record.skill_id === id);
  if (options.agent) records = records.filter((record) => record.agent === options.agent);

  const results = [];
  if (id && records.length === 0) results.push({ id, status: "not-installed", reason: "not_installed_in_scope" });

  for (const record of records) {
    const skill = byId.get(record.skill_id);
    const plan = planUpdate(record, skill, { force: options.force === true });
    if (plan.status !== "update-available" || options.dryRun) {
      results.push(plan);
      continue;
    }
    try {
      installMaterializedSkill(skill, { agent: record.agent, scope, overwrite: true, force: options.force === true });
      results.push({ ...plan, status: "updated" });
    } catch (error) {
      results.push({ ...plan, status: "error", reason: error.message });
    }
  }

  const failed = results.filter((result) => ["error", "modified", "not-releasable", "not-installed", "not-in-catalog", "unsupported"].includes(result.status));
  if (failed.length) process.exitCode = 1;

  if (options.json) {
    console.log(JSON.stringify({ success: failed.length === 0, dry_run: options.dryRun === true, scope, results }, null, 2));
    return;
  }
  if (!results.length) {
    console.log(`No Hub-managed skills installed in ${scope} scope.`);
    return;
  }
  for (const result of results) {
    const revision = result.to && result.from !== result.to ? ` ${String(result.from).slice(0, 7)} → ${String(result.to).slice(0, 7)}` : "";
    const color = ["updated", "up-to-date"].includes(result.status) ? "green" : result.status === "update-available" ? "cyan" : "yellow";
    console.log(`${paint(color, result.status.padEnd(16))} ${result.id}${revision}${result.reason ? paint("dim", ` (${result.reason})`) : ""}`);
  }
  if (options.dryRun && results.some((result) => result.status === "update-available")) console.log("\nDry run: nothing was changed. Run without --dry-run to update.");
}
