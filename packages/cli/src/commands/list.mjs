import { readInstallRecords } from "../../../installer/src/state.mjs";
import { recordedInstallation } from "../capability-status.mjs";

export function listCommand(options = {}) {
  const scope = options.scope || "project";
  const records = readInstallRecords(scope);
  const list = Object.values(records).filter(
    (record) => record.scope === scope && (!options.agent || record.agent === options.agent)
  ).map(record => ({ ...record, hub_status: { installation: recordedInstallation(record) } }));

  if (options.json) {
    console.log(JSON.stringify(list, null, 2));
    return;
  }

  if (list.length === 0) {
    console.log(
      options.agent
        ? `No Hub installation records for agent: ${options.agent}.`
        : "No Hub installation records in this scope."
    );
    return;
  }

  console.log(`Hub Installation Records (${options.agent || "All Agents"}):\n`);
  for (const record of list) {
    console.log(`- ${record.skill_id} [${record.type || "skill"}]`);
    console.log(`  Agent: ${record.agent}`);
    console.log(`  Scope: ${record.scope}`);
    const installation = record.hub_status.installation;
    console.log(`  Installation: ${installation.status}${installation.reason ? ` / ${installation.reason}` : ""}`);
    console.log(`  Installed at: ${record.installed_at}`);
    console.log("");
  }
}
