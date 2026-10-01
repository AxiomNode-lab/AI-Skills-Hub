import { readInstallRecords } from '../../../installer/src/state.mjs';

export async function listCommand(options) {
  const agent = options.agent || "project"; // Default scope
  const records = readInstallRecords("project");
  
  // Filter by agent if provided, otherwise show all
  const list = Object.values(records).filter(r => options.agent ? r.agent === options.agent : true);

  if (options.json) {
    console.log(JSON.stringify(list, null, 2));
    return;
  }

  if (list.length === 0) {
    console.log(options.agent ? `No capabilities installed for agent: ${options.agent}` : "No capabilities installed.");
    return;
  }

  console.log(`Installed Capabilities (${options.agent || 'All Agents'}):\n`);
  for (const r of list) {
    console.log(`- ${r.skill_id} [${r.type}]`);
    console.log(`  Agent: ${r.agent}`);
    console.log(`  Installed at: ${r.installed_at}`);
    console.log("");
  }
}
