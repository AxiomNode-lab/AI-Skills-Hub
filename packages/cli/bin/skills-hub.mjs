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
import { availableCommand } from "../src/commands/available.mjs";
import { checkForUpdates } from "../src/utils.mjs";
import { createHubServer, runStdioServer } from "@ai-skills-hub/server";

const [, , command, ...args] = process.argv;

function parseOptions(argsArray) {
  const options = { json: false, yes: false, agent: null, scope: "project", port: 8787, host: "127.0.0.1" };
  const positional = [];

  for (let i = 0; i < argsArray.length; i += 1) {
    const arg = argsArray[i];
    if (arg === "--json") options.json = true;
    else if (arg === "--installable") options.installable = true;
    else if (arg === "--yes" || arg === "-y") options.yes = true;
    else if (arg === "--agent" && i + 1 < argsArray.length) options.agent = argsArray[++i];
    else if (arg === "--scope" && i + 1 < argsArray.length) options.scope = argsArray[++i];
    else if (arg === "--port" && i + 1 < argsArray.length) options.port = Number(argsArray[++i]);
    else if (arg === "--host" && i + 1 < argsArray.length) options.host = argsArray[++i];
    else positional.push(arg);
  }

  return { options, positional };
}

async function main() {
  const { options, positional } = parseOptions(args);
  // stdout carries protocol messages for `mcp`; never print update notices there.
  if (!options.json && command !== "mcp") await checkForUpdates();

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
    case "available":
      await availableCommand(positional[0], options);
      break;
    case "list":
      await listCommand(options);
      break;
    case "install":
      await installCommand(positional[0]?.split(",") || [], options);
      break;
    case "mcp":
      await runStdioServer();
      break;
    case "serve": {
      if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65535) {
        console.error("Error: --port must be an integer between 0 and 65535.");
        process.exitCode = 1;
        break;
      }
      const server = createHubServer();
      server.listen(options.port, options.host, () => {
        const { port } = server.address();
        console.log(`AI Skills Hub API on http://${options.host}:${port}/api/skills (MCP: POST /mcp)`);
      });
      break;
    }
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
  available [query]       List skills you can install now (filter with --agent)
  search <query>          Search the whole local registry (--installable to filter)
  info <id>               Show capability metadata
  list                    List installed capabilities
  install <id[,id...]>    Install release-eligible or explicitly approved external capabilities
  mcp                     Run the read-only catalog MCP server over stdio
  serve                   Run the read-only registry API and MCP endpoint over HTTP

Options:
  --agent <id>            Target agent
  --scope <project|user>  Installation scope
  --yes                   Confirm external installer/configuration operations
  --json                  Output machine-readable JSON where supported
  --installable           search: only skills that can be installed now
  --port <n>              serve: port (default 8787)
  --host <addr>           serve: bind address (default 127.0.0.1)

Agents: claude-code, codex, cursor, github-copilot, opencode, agent-skills (generic)

Start here:
  skills-hub available --agent claude-code
  skills-hub install anthropics/frontend-design --agent claude-code
      `);
      break;
    default:
      if (command && !command.startsWith("-")) {
        console.error(`Unknown command: ${command}. Run 'skills-hub help' for usage.`);
        process.exit(1);
      }
      await interactiveCommand();
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
