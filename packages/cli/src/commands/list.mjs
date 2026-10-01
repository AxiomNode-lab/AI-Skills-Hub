import { readInstallRecords } from "../../../installer/src/state.mjs";

export function listCommand(options = {}) {
  const records = readInstallRecords(options.scope || "project");
  const list = Object.values(records).filter(
    (record) => !options.agent || record.agent === options.agent
  );

  if (options.json) {
    console.log(JSON.stringify(list, null, 2));
    return;
  }

  if (list.length === 0) {
    console.log(
      options.agent
        ? `No capabilities installed for agent: ${options.agent}`
        : "No capabilities installed."
    );
    return;
  }

  console.log(`Installed Capabilities (${options.agent || "All Agents"}):\n`);
  for (const record of list) {
    console.log(`- ${record.skill_id} [${record.type || "skill"}]`);
    console.log(`  Agent: ${record.agent}`);
    console.log(`  Scope: ${record.scope}`);
    console.log(`  Installed at: ${record.installed_at}`);
    console.log("");
  }
}
