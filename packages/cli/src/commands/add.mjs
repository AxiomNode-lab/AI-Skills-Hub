import path from "node:path";
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { confirm, select } from "@inquirer/prompts";
import { hybridSearch, toInstallChoices } from "@ai-skills-hub/discovery";
import { loadRegistry } from "@ai-skills-hub/core";
import { installCapability } from "../install-executor.mjs";
import { UsageError } from "../errors.mjs";

// Looks like a repository reference rather than a search phrase.
function isGitReference(value) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value) || /^git@/i.test(value) || /^[a-z0-9+.-]+::/i.test(value) || /\.git\/?$/i.test(value);
}

// Only authenticated, remote transports are accepted: https:// and ssh, never
// http://, git://, file paths, or git's ext:: remote helpers.
function validGitUrl(value) {
  if (/^git@[A-Za-z0-9.-]+:[A-Za-z0-9._\/-]+$/.test(value)) return true;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "ssh:") && Boolean(url.hostname) && !url.search && !url.hash && /^[A-Za-z0-9._\/~-]+$/.test(url.pathname);
  } catch {
    return false;
  }
}

function repositoryName(value) {
  const trimmed = String(value).trim().replace(/\/+$/, "");
  const match = trimmed.match(/(?:^|[/:])([^/:]+?)(?:\.git)?$/i);
  const name = match?.[1] ?? "";
  if (!/^[A-Za-z0-9._-]+$/.test(name) || name === "." || name === "..") {
    throw new Error("Unable to derive a safe repository directory name.");
  }
  return name;
}

function assertGitReference(value) {
  const trimmed = String(value).trim();
  if (/[\0\s]/.test(trimmed) || trimmed.startsWith("-") || !validGitUrl(trimmed)) {
    throw new UsageError("Unsupported Git reference. Use an https:// or SSH repository URL");
  }
}

// Success is reported only when the adapter actually installed the capability;
// every other outcome (held, blocked, pending adapter, confirmation needed,
// incompatible, ...) is a failure with its reason.
export function addOutcome(result, name) {
  if (result?.installed !== true) {
    const reason = result?.requires_confirmation ? "confirmation required" : result?.action ?? "not installed";
    return { ok: false, message: `Not installed: ${name} (${reason}${result?.reason ? ": " + result.reason : ""}).` };
  }
  if (result.action === "already-installed") return { ok: true, message: `${name} is already installed.` };
  return { ok: true, message: `Installed ${name}${result.destination ? " → " + result.destination : ""}.` };
}

export async function addCommand(query, options = {}) {
  if (!query) throw new UsageError("add needs a search phrase or a Git repository URL");

  const agent = options.agent || "agent-skills";

  if (isGitReference(query)) {
    assertGitReference(query);
    try {
      const repoName = repositoryName(query);
      const libDir = path.resolve(process.cwd(), "capabilities-library");
      const targetDir = path.join(libDir, repoName);

      await fs.mkdir(libDir, { recursive: true });
      if (await fs.access(targetDir).then(() => true).catch(() => false)) {
        console.error(`A local capability named '${repoName}' already exists at ${targetDir}. Use 'skills-hub sync' to update it.`);
        process.exitCode = 1;
        return;
      }

      console.log(`Cloning ${query} into ${targetDir} for local review...`);
      // Argument vector, no shell; git may only use https and ssh here.
      execFileSync("git", ["clone", "--no-recurse-submodules", "--", query, targetDir], {
        stdio: "inherit",
        env: { ...process.env, GIT_ALLOW_PROTOCOL: "https:ssh", GIT_TERMINAL_PROMPT: "0" }
      });
      console.log(`Added ${repoName} to capabilities-library/ for review. It is not released and nothing was installed.`);
      return;
    } catch (error) {
      console.error(`Failed to add Git repository: ${error.message}`);
      process.exitCode = 1;
      return;
    }
  }

  try {
    const registry = loadRegistry();

    const searchResult = await hybridSearch(registry, query, {
      agent,
      limit: 10
    });

    if (!searchResult.results.length) {
      console.log(`No capabilities found matching "${query}".`);
      process.exitCode = 1;
      return;
    }

    const choices = toInstallChoices(searchResult, agent, { scope: options.scope || "project" });
    const selected = await select({
      message: "Select a capability to install:",
      choices: [
        ...choices.map((choice) => ({
          name: `${choice.name} (${choice.publisher}) [${choice.action}]`,
          value: choice,
          description: `${choice.description || "No description."} Security: ${choice.security?.risk || "unknown"}.`
        })),
        { name: "Cancel", value: null }
      ]
    });

    if (!selected) {
      console.log("Cancelled.");
      return;
    }

    let confirmed = Boolean(options.yes);

    if (
      ["source-direct", "marketplace", "configuration"].includes(selected.action)
      && !confirmed
    ) {
      const proceed = await confirm({
        message: `This action uses an external installer or modifies agent configuration. Continue with ${selected.name}?`,
        default: false
      });
      if (!proceed) {
        console.log("Installation aborted.");
        return;
      }
      confirmed = true;
    }

    const capability = searchResult.results.find((entry) => entry.item.id === selected.id)?.item;
    if (!capability) {
      console.error("Selected capability is no longer present in the search result.");
      return;
    }

    const result = await installCapability(capability, {
      agent,
      scope: options.scope || "project",
      cwd: process.cwd(),
      confirmed,
      env: {}
    });

    const outcome = addOutcome(result, selected.name);
    (outcome.ok ? console.log : console.error)(outcome.message);
    if (!outcome.ok) process.exitCode = 1;
  } catch (error) {
    if (error instanceof UsageError) throw error;
    console.error(`Failed to search or install: ${error.message}`);
    process.exitCode = 1;
  }
}