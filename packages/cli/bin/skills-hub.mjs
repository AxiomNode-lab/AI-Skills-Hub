#!/usr/bin/env node
import { hubVersion } from "@ai-skills-hub/core";
import { supportedAgents } from "../../installer/src/targets.mjs";
import { UsageError } from "../src/errors.mjs";
import { checkForUpdates } from "../src/utils.mjs";

const [, , command, ...args] = process.argv;

const COMMANDS = new Set(["create", "add", "sync", "uninstall", "update", "search", "info", "available", "list", "install", "mcp", "serve", "help"]);
const LOOPBACK = new Set(["127.0.0.1", "::1", "localhost"]);

function integerOption(name, value, min, max) {
  const number = Number(value);
  if (!/^\d+$/.test(value) || number < min || number > max) throw new UsageError(`${name} must be an integer from ${min} to ${max}`);
  return number;
}

function parseOptions(argsArray) {
  const options = { json: false, yes: false, force: false, dryRun: false, agent: null, scope: "project", port: 8787, host: "127.0.0.1" };
  const positional = [];
  const value = (i, name) => {
    if (i + 1 >= argsArray.length || argsArray[i + 1].startsWith("--")) throw new UsageError(`${name} needs a value`);
    return argsArray[i + 1];
  };

  for (let i = 0; i < argsArray.length; i += 1) {
    const arg = argsArray[i];
    if (arg === "--json") options.json = true;
    else if (arg === "--installable") options.installable = true;
    else if (arg === "--yes" || arg === "-y") options.yes = true;
    else if (arg === "--force") options.force = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--agent") options.agent = value(i++, arg);
    else if (arg === "--scope") options.scope = value(i++, arg);
    else if (arg === "--port") options.port = integerOption("--port", value(i++, arg), 0, 65535);
    else if (arg === "--host") options.host = value(i++, arg);
    else if (arg === "--limit") options.limit = integerOption("--limit", value(i++, arg), 1, 1000);
    else if (arg.startsWith("-") && arg !== "-") throw new UsageError(`Unknown option: ${arg}`);
    else positional.push(arg);
  }

  if (!["project", "user"].includes(options.scope)) throw new UsageError("--scope must be 'project' or 'user'");
  const agents = [...supportedAgents(), "generic-agent"];
  if (options.agent !== null && !agents.includes(options.agent)) {
    throw new UsageError(`Unknown agent '${options.agent}'. Supported: ${supportedAgents().filter((a) => !["generic", "copilot"].includes(a)).join(", ")}`);
  }
  return { options, positional };
}

const HELP = `AI Skills Hub — install reviewed Agent Skills into your project

Usage: skills-hub <command> [options]

Find skills
  available [query]         Skills you can install now (filter with --agent)
  search <query>            Search the whole catalog (--installable to filter)
  info <id>                 Catalog, license, security and release details

Manage installed skills
  install <id[,id...]>      Install released skills (--agent required)
  list                      Skills installed by the Hub in this scope
  update [id]               Update installed skills to the released revision (--dry-run)
  uninstall <id>            Remove a Hub-managed installation

Discovery and local review
  add <query>               Search and pick a capability interactively
  add <git-url>             Clone a repository into capabilities-library/ for review (never installs)
  sync                      Pull Git repositories in capabilities-library/
  create                    Scaffold a new capability in capabilities-library/
  (no command)              Interactive browse and install (terminal only)

Catalog servers (read-only, no authentication)
  mcp                       MCP server over stdio
  serve                     HTTP API and MCP endpoint on 127.0.0.1:8787

Options
  --agent <id>              claude-code, codex, cursor, github-copilot, opencode, agent-skills
  --scope <project|user>    Install location (default: project)
  --yes, -y                 Confirm external installers or agent configuration changes
  --force                   Replace an unmanaged or locally modified installation
  --dry-run                 update: report what would change
  --json                    Machine-readable output
  --installable             search: only skills that can be installed now
  --limit <n>               search: maximum results (default 50)
  --port <n>, --host <addr> serve: bind address (default 127.0.0.1:8787)
  --version, -v             Print the version

Examples
  skills-hub available --agent codex
  skills-hub search "frontend design" --agent codex
  skills-hub install anthropics/frontend-design --agent codex
`;

async function main() {
  if (command === "--version" || command === "-v") {
    console.log(hubVersion());
    return;
  }
  if (command === "--help" || command === "-h" || command === "help") {
    console.log(HELP);
    return;
  }
  if (command && !COMMANDS.has(command)) throw new UsageError(command.startsWith("-") ? `Unknown option: ${command}` : `Unknown command: ${command}`);

  const { options, positional } = parseOptions(args);
  const need = (value, what) => {
    if (!value) throw new UsageError(`${command} needs ${what}`);
    return value;
  };
  // stdout carries protocol messages for `mcp`; never print update notices there.
  if (!options.json && command !== "mcp") await checkForUpdates();

  switch (command) {
    case "create":
      await (await import("../src/commands/create.mjs")).createCommand();
      break;
    case "add":
      await (await import("../src/commands/add.mjs")).addCommand(positional[0], options);
      break;
    case "sync":
      await (await import("../src/commands/sync.mjs")).syncCommand();
      break;
    case "uninstall":
      await (await import("../src/commands/uninstall.mjs")).uninstallCommand(positional[0], options);
      break;
    case "update":
      await (await import("../src/commands/update.mjs")).updateCommand(positional[0], options);
      break;
    case "search":
      await (await import("../src/commands/search.mjs")).searchCommand(need(positional[0], "a query"), options);
      break;
    case "info":
      await (await import("../src/commands/info.mjs")).infoCommand(need(positional[0], "a capability ID"), options);
      break;
    case "available":
      await (await import("../src/commands/available.mjs")).availableCommand(positional[0], options);
      break;
    case "list":
      await (await import("../src/commands/list.mjs")).listCommand(options);
      break;
    case "install":
      await (await import("../src/commands/install.mjs")).installCommand(positional[0]?.split(",").filter(Boolean) || [], options);
      break;
    case "mcp":
      await (await import("@ai-skills-hub/server")).runStdioServer();
      break;
    case "serve": {
      const { createHubServer } = await import("@ai-skills-hub/server");
      const server = createHubServer();
      server.on("error", (error) => {
        console.error(`Cannot listen on ${options.host}:${options.port}: ${error.message}`);
        process.exitCode = 1;
      });
      server.listen(options.port, options.host, () => {
        const { port } = server.address();
        const host = options.host.includes(":") ? `[${options.host}]` : options.host;
        console.log(`AI Skills Hub catalog API on http://${host}:${port}/api/skills (MCP: POST /mcp). Read-only, no authentication.`);
        if (!LOOPBACK.has(options.host)) console.error(`Warning: ${options.host} is not a loopback address. Anyone who can reach it can read the catalog; there is no authentication.`);
      });
      break;
    }
    default:
      if (!process.stdin.isTTY || !process.stdout.isTTY) {
        console.log(HELP);
        throw new UsageError("No command given (interactive mode needs a terminal)");
      }
      await (await import("../src/commands/interactive.mjs")).interactiveCommand();
  }
}

main().catch((error) => {
  if (error instanceof UsageError) {
    // --json callers always get JSON on stdout, including for usage errors.
    if (args.includes("--json")) console.log(JSON.stringify({ success: false, error: error.message, usage_error: true }, null, 2));
    else console.error(`${error.message}. Run 'skills-hub help' for usage.`);
    process.exit(2);
  }
  console.error(`Error: ${error?.message ?? error}`);
  if (process.env.SKILLS_HUB_DEBUG) console.error(error);
  process.exit(1);
});
