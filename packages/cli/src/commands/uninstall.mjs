import { select, confirm } from '@inquirer/prompts';
import { readInstallRecords, removeInstallRecord } from '../../../installer/src/state.mjs';
import fs from "node:fs/promises";
import fsSync from "node:fs";

export async function uninstallCommand() {
  console.log("🗑️  Uninstall Capabilities");

  const records = readInstallRecords("project");
  const installedList = Object.values(records);

  if (installedList.length === 0) {
    console.log("No capabilities currently installed.");
    return;
  }

  const choices = installedList.map(r => ({
    name: `${r.name || r.skill_id} [${r.type || 'skill'}] (Agent: ${r.agent})`,
    value: r.skill_id
  }));

  const selectedId = await select({
    message: 'Select a capability to uninstall:',
    choices
  });

  const record = records[selectedId];

  const proceed = await confirm({
    message: `Are you sure you want to uninstall ${record.name || record.skill_id}?`
  });

  if (!proceed) {
    console.log("Aborted.");
    return;
  }

  console.log(`Uninstalling ${record.skill_id}...`);

  try {
    if (record.type === 'mcp-server') {
      // Modify MCP config to remove it
      if (fsSync.existsSync(record.destination)) {
        const configStr = await fs.readFile(record.destination, 'utf8');
        const config = JSON.parse(configStr);
        if (config.mcpServers && config.mcpServers[record.skill_id]) {
          delete config.mcpServers[record.skill_id];
          await fs.writeFile(record.destination, JSON.stringify(config, null, 2));
        }
      }
    } else {
      // For skill, cli-tool, agent-plugin -> remove the destination directory/file
      if (fsSync.existsSync(record.destination)) {
        await fs.rm(record.destination, { recursive: true, force: true });
      }
    }

    // Remove from state
    removeInstallRecord(record.skill_id, "project");

    console.log(`✅ Successfully uninstalled ${record.skill_id}`);
  } catch (error) {
    console.error(`❌ Failed to uninstall:`, error.message);
  }
}
