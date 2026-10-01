import { confirm, select } from "@inquirer/prompts";
import fs from "node:fs";
import { readInstallRecords, removeInstallRecord } from "../../../installer/src/state.mjs";
import { removeMCPServer } from "../../../installer/src/adapters/MCPAdapter.mjs";
import { resolveInstallRoot } from "../../../installer/src/targets.mjs";

function safeInside(root, candidate) {
  const r = require("node:path").resolve(root);
  const c = require("node:path").resolve(candidate);
  return c === r || c.startsWith(r + require("node:path").sep);
}

export async function uninstallCommand(options = {}) {
  const scope = options.scope || "project";
  const records = readInstallRecords(scope);
  const installedList = Object.values(records);

  if (installedList.length === 0) {
    console.log("No capabilities currently installed.");
    return;
  }

  const choices = installedList.map((record) => ({
    name: `${record.name || record.skill_id} [${record.type || "skill"}] (Agent: ${record.agent})`,
    value: record.skill_id
  }));

  const selectedId = await select({
    message: "Select a capability to uninstall:",
    choices
  });

  const record = records[selectedId];
  const proceed = await confirm({
    message: `Are you sure you want to uninstall ${record.name || record.skill_id}?`,
    default: false
  });

  if (!proceed) {
    console.log("Aborted.");
    return;
  }

  try {
    if (record.type === "mcp-server") {
      await removeMCPServer(record.destination, record.skill_id);
    } else {
      const path = await import("node:path");
      const root = resolveInstallRoot(record.agent || "agent-skills", scope, process.cwd());
      const destination = path.resolve(record.destination);
      if (!safeInside(root, destination) || path.dirname(destination) === path.resolve(root)) {
        if (!safeInside(root, destination)) {
          throw new Error("Refusing to remove a path outside the managed installation root.");
        }
      }
      await fs.promises.rm(destination, { recursive: true, force: true });
    }

    removeInstallRecord(record.skill_id, scope, process.cwd());
    console.log(`Successfully uninstalled ${record.skill_id}.`);
  } catch (error) {
    console.error(`Failed to uninstall ${record.skill_id}: ${error.message}`);
  }
}
