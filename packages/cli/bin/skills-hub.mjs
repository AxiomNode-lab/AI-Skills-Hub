#!/usr/bin/env node
import { interactiveCommand } from '../src/commands/interactive.mjs';
import { createCommand } from '../src/commands/create.mjs';
import { uninstallCommand } from '../src/commands/uninstall.mjs';
import { addCommand } from '../src/commands/add.mjs';
import { syncCommand } from '../src/commands/sync.mjs';
import { searchCommand } from '../src/commands/search.mjs';
import { infoCommand } from '../src/commands/info.mjs';
import { listCommand } from '../src/commands/list.mjs';
import { installCommand } from '../src/commands/install.mjs';
import { checkForUpdates } from '../src/utils.mjs';

const [, , command, ...args] = process.argv;

// Simple argument parser for flags
function parseOptions(argsArray) {
  const options = { json: false, yes: false, agent: null };
  const positional = [];
  
  for (let i = 0; i < argsArray.length; i++) {
    const arg = argsArray[i];
    if (arg === '--json') options.json = true;
    else if (arg === '--yes' || arg === '-y') options.yes = true;
    else if (arg === '--agent' && i + 1 < argsArray.length) {
      options.agent = argsArray[++i];
    }
    else {
      positional.push(arg);
    }
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
      await addCommand(positional[0]);
      break;
    case "sync":
      await syncCommand();
      break;
    case "uninstall":
      await uninstallCommand();
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
      await installCommand(positional[0]?.split(',') || [], options);
      break;
    case "help":
    case "--help":
    case "-h":
      console.log(`
AI Agent Capability Platform CLI

Usage: skills-hub [command] [options]

Commands:
  (none)             Run interactive installer UI
  create             Wizard to create a new capability
  add <url|query>    Fetch from Git or search via Natural Language
  sync               Update all Git-fetched capabilities in capabilities-library/
  uninstall          Interactive UI to uninstall capabilities
  search <q>         Search capabilities (Headless)
  info <id>          View capability details (Headless)
  list               List installed capabilities (Headless)
  install <id>       Install specific capability (Headless)

Options:
  --json      Output raw JSON (for search, info, list, install)
  --agent <id> Target agent (required for install)
  --yes       Skip security prompts (for install)
      `);
      break;
    default:
      if (command && !command.startsWith('-')) {
        console.error(`Unknown command: ${command}`);
        process.exit(1);
      }
      await interactiveCommand();
      break;
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
