import { confirm, select } from "@inquirer/prompts";
import fs from "node:fs";
import path from "node:path";
import { readInstallRecords, removeInstallRecord } from "../../../installer/src/state.mjs";
import { getMCPConfigPath, removeMCPServer } from "../../../installer/src/adapters/MCPAdapter.mjs";
import { uninstallSkillRecord } from "../../../installer/src/native.mjs";
import { UsageError } from "../errors.mjs";

// Removes one Hub-managed installation. Skill directories are removed only if
// they sit directly in the agent's install root, are not symlinks, and still
// match the recorded file hashes (unless force is set); MCP entries only from
// the agent's expected configuration file.
export function removeInstallation(record, { scope, cwd = process.cwd(), force = false }) {
  if (record.type === "mcp-server") {
    const expectedConfig = path.resolve(getMCPConfigPath(record.agent, scope, cwd));
    if (expectedConfig !== path.resolve(record.destination)) {
      throw new Error("Refusing to modify an MCP configuration outside the expected agent scope.");
    }
    removeMCPServer(expectedConfig, record.name || record.skill_id);
    removeInstallRecord(record.skill_id, scope, cwd);
    return { id: record.skill_id, action: "removed", destination: expectedConfig };
  }
  const destination = path.resolve(record.destination);
  if (fs.existsSync(destination) && fs.lstatSync(destination).isSymbolicLink()) {
    throw new Error("Refusing to remove a symbolic-link installation.");
  }
  return uninstallSkillRecord(record.skill_id, { scope, cwd, force });
}

export async function uninstallCommand(id, options = {}) {
  const scope = options.scope || "project";
  const records = readInstallRecords(scope);

  if (id) {
    const record = records[id];
    const output = (result) => {
      if (options.json) console.log(JSON.stringify(result, null, 2));
      else if (result.success) console.log(`Uninstalled ${id} (${result.destination}).`);
      else console.error(`Not uninstalled: ${id}: ${result.reason}`);
      if (!result.success) process.exitCode = 1;
    };
    if (!record) return output({ success: false, id, scope, reason: "not_installed_in_scope" });
    if (options.agent && record.agent !== options.agent) {
      return output({ success: false, id, scope, reason: `installed_for_agent_${record.agent}` });
    }
    try {
      const result = removeInstallation(record, { scope, force: options.force === true });
      return output({ success: true, id, scope, agent: record.agent, destination: result.destination });
    } catch (error) {
      return output({ success: false, id, scope, reason: error.message });
    }
  }

  if (options.json || !process.stdin.isTTY) {
    throw new UsageError("uninstall needs a capability ID when not run interactively");
  }

  const installedList = Object.values(records);
  if (installedList.length === 0) {
    console.log(`No capabilities installed in ${scope} scope.`);
    return;
  }

  const selectedId = await select({
    message: "Select a capability to uninstall:",
    choices: installedList.map((record) => ({
      name: `${record.name || record.skill_id} [${record.type || "skill"}] (Agent: ${record.agent})`,
      value: record.skill_id
    }))
  });

  const record = records[selectedId];
  const proceed = await confirm({ message: `Uninstall ${record.name || record.skill_id}?`, default: false });
  if (!proceed) {
    console.log("Aborted.");
    return;
  }

  try {
    removeInstallation(record, { scope, force: options.force === true });
    console.log(`Uninstalled ${record.skill_id}.`);
  } catch (error) {
    console.error(`Failed to uninstall ${record.skill_id}: ${error.message}`);
    process.exitCode = 1;
  }
}
