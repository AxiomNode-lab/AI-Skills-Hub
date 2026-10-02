#!/usr/bin/env node
import { interactiveCommand } from "../src/commands/interactive.mjs";
import { createCommand } from "../src/commands/create.mjs";
import { uninstallCommand } from "../src/commands/uninstall.mjs";
import { addCommand } from "../src/commands/add.mjs";
import { syncCommand } from "../src/commands/sync.mjs";
import { searchCommand } from "../src/commands/search.mjs";
import { infoCommand } from "../src/commands/info.mjs";
import { listCommand } from "../src/commands/list.mjs";
import { installCommand } from "../src/commands/install.mjs";
import { checkForUpdates } from "../src/utils.mjs";

const [, , command, ...args] = process.argv;

function parseOptions(argsArray) {
  const options = { json: false, yes: false, agent: null, scope: "project" };
  const positional = [];

  for (let i = 0; i < argsArray.length; i += 1) {
    const arg = argsArray[i];
    if (arg === "--json") options.json = true;
    else if (arg === "--yes" || arg === "-y") options.yes = true;
    else if (arg === "--agent" && i + 1 < argsArray.length) options.agent = argsArray[++i];
    else if (arg === "--scope" && i + 1 < argsArray.length) options.scope = argsArray[++i];
    else positional.push(arg);
  }

  return { options, positional };
}

async function main() {
  await checkForUpdates();
  const { options, positional } = parseOptions(args);

  switch (command) {
    case "create":
      await createCommand();
      break;
    case "add":
      await addCommand(positional[0], options);
      break;
    case "sync":
      await syncCommand();
      break;
    case "uninstall":
      await uninstallCommand(options);
      break;
    case "search":
      await searchCommand(positional[0], options);
      break;
    case "info":
      await infoCommand(positional[0], options);
      break;
    case "list":
      await listCommand(options);
      break;
    case "install":
      await installCommand(positional[0]?.split(",") || [], options);
      break;
    case "help":
    case "--help":
    case "-h":
      console.log(`
AI Skills Hub CLI

Usage: skills-hub [command] [options]

Commands:
  (none)                  Run interactive installer
  create                  Create a new capability
  add <url|query>         Add a Git repository or discover a capability
  sync                    Update Git-linked local capabilities
  uninstall               Remove an installed capability
  search <query>          Search the local registry
  info <id>               Show capability metadata
  list                    List installed capabilities
  install <id[,id...]>    Install release-eligible or explicitly approved external capabilities

Options:
  --agent <id>            Target agent
  --scope <project|user>  Installation scope
  --yes                   Confirm external installer/configuration operations
  --json                  Output machine-readable JSON where supported
      `);
      break;
    default:
      if (command && !command.startsWith("-")) {
        console.error(`Unknown command: ${command}`);
        process.exit(1);
      }
      await interactiveCommand();
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
