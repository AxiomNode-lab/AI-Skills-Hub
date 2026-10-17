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

// Usage line and notes shown by `<command> --help`.
const COMMAND_HELP = {
  available: "available [query] [--agent <id>] [--json]\n  Skills you can install now. A query filters by keyword.",
  search: "search <query> [--agent <id>] [--installable] [--limit <n>] [--json]\n  Keyword search over the whole catalog, including skills that cannot be installed.",
  info: "info <id> [--agent <id>] [--json]\n  License, security findings, release state and source of one skill.",
  install: "install <id> [<id>...] --agent <id> [--scope project|user] [--force] [--yes] [--json]\n  Installs released skills and their dependencies, all or nothing. IDs may also be comma-separated.",
  list: "list [--agent <id>] [--scope project|user] [--json]\n  Skills the Hub installed in this scope, with whether their files still match.",
  update: "update [id] [--agent <id>] [--dry-run] [--force] [--json]\n  Moves installed skills to the revision the catalog releases now.",
  uninstall: "uninstall <id> [--agent <id>] [--scope project|user] [--force] [--json]\n  Removes a Hub-managed installation. Pass --agent when the skill is installed for several agents.",
  add: "add <phrase>  |  add <git-url>\n  Interactive search across the catalog and public directories (terminal only), or clone a repository into capabilities-library/ for review.",
  sync: "sync\n  Fast-forwards the Git repositories in capabilities-library/.",
  create: "create\n  Scaffolds a new capability in capabilities-library/ (terminal only).",
  mcp: "mcp\n  Read-only MCP server over stdio (tools: search_skills, get_skill). Example: claude mcp add skills-hub -- npx -y @axiomnode-lab/skills-hub mcp",
  serve: "serve [--host <addr>] [--port <n>]\n  Read-only HTTP API and MCP endpoint, 127.0.0.1:8787 by default, no authentication."
};

// The closest known command for a typo, if it is close enough to be a guess.
function suggestCommand(input) {
  const distance = (a, b) => {
    const row = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i += 1) {
      let previous = row[0];
      row[0] = i;
      for (let j = 1; j <= b.length; j += 1) {
        const current = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
        previous = current;
      }
    }
    return row[b.length];
  };
  const [best] = [...COMMANDS].map((name) => [name, distance(input.toLowerCase(), name)]).sort((x, y) => x[1] - y[1]);
  return best && best[1] <= 2 ? best[0] : null;
}

const HELP = `AI Skills Hub — install reviewed Agent Skills into your project

Usage: skills-hub <command> [options]

Find skills
  available [query]         Skills you can install now (filter with --agent)
  search <query>            Search the whole catalog (--installable to filter)
  info <id>                 Catalog, license, security and release details

Manage installed skills
  install <id> [<id>...]    Install released skills, all or nothing (--agent required)
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
  <command> --help          Help for one command

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
  if (command && !COMMANDS.has(command)) {
    if (command.startsWith("-")) throw new UsageError(`Unknown option: ${command}`);
    const guess = suggestCommand(command);
    throw new UsageError(`Unknown command: ${command}${guess ? ` (did you mean '${guess}'?)` : ""}`);
  }
  if (command && (args.includes("--help") || args.includes("-h"))) {
    console.log(`Usage: skills-hub ${COMMAND_HELP[command] ?? command}\n\nRun 'skills-hub help' for all commands and options.`);
    return;
  }

  const { options, positional } = parseOptions(args);
  // Commands that take one ID refuse extra words instead of ignoring them.
  const single = (what) => {
    if (positional.length > 1) throw new UsageError(`${command} takes one ${what}; got: ${positional.join(" ")}`);
    return positional[0];
  };
  // A search phrase may be given with or without quotes.
  const phrase = positional.length ? positional.join(" ") : undefined;
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
      await (await import("../src/commands/add.mjs")).addCommand(phrase, options);
      break;
    case "sync":
      await (await import("../src/commands/sync.mjs")).syncCommand();
      break;
    case "uninstall":
      await (await import("../src/commands/uninstall.mjs")).uninstallCommand(single("capability ID"), options);
      break;
    case "update":
      await (await import("../src/commands/update.mjs")).updateCommand(single("capability ID"), options);
      break;
    case "search":
      await (await import("../src/commands/search.mjs")).searchCommand(need(phrase, "a query"), options);
      break;
    case "info":
      await (await import("../src/commands/info.mjs")).infoCommand(need(single("capability ID"), "a capability ID"), options);
      break;
    case "available":
      await (await import("../src/commands/available.mjs")).availableCommand(phrase, options);
      break;
    case "list":
      await (await import("../src/commands/list.mjs")).listCommand(options);
      break;
    case "install":
      await (await import("../src/commands/install.mjs")).installCommand(positional.flatMap((value) => value.split(",")).filter(Boolean), options);
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
