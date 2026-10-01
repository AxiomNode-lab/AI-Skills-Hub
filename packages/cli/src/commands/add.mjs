import path from "node:path";
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { confirm, select } from "@inquirer/prompts";
import { hybridSearch, toInstallChoices } from "@ai-skills-hub/discovery";
import { loadRegistry } from "@ai-skills-hub/core";
import { installCapability } from "../install-executor.mjs";

function isGitReference(value) {
  return /^(?:https?|ssh):\/\//i.test(value)
    || /^git@[A-Za-z0-9.-]+:/i.test(value)
    || /^git:\/\//i.test(value)
    || value.endsWith(".git");
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
  if (trimmed.includes("\0")) throw new Error("Invalid Git reference.");
  if (!isGitReference(trimmed)) throw new Error("Unsupported Git reference. Use an HTTPS/SSH Git repository URL.");
}

export async function addCommand(query, options = {}) {
  if (!query) {
    console.error("Error: You must provide a search query or capability ID.");
    console.log("Usage: skills-hub add <query> [--agent <agent-id>] [--yes]");
    return;
  }

  const agent = options.agent || "generic-agent";

  if (isGitReference(query)) {
    try {
      assertGitReference(query);
      const repoName = repositoryName(query);
      const libDir = path.resolve(process.cwd(), "capabilities-library");
      const targetDir = path.join(libDir, repoName);

      await fs.mkdir(libDir, { recursive: true });
      if (await fs.access(targetDir).then(() => true).catch(() => false)) {
        console.error(`Error: A capability named '${repoName}' already exists at ${targetDir}`);
        console.log("Use 'skills-hub sync' to update it instead.");
        return;
      }

      console.log(`Cloning ${query} into ${targetDir}...`);
      execFileSync("git", ["clone", "--", query, targetDir], { stdio: "inherit" });
      console.log(`Successfully added ${repoName} to the local capabilities library.`);
      console.log("Review the source and registry policy before installing it.");
      return;
    } catch (error) {
      console.error(`Failed to add Git capability: ${error.message}`);
      return;
    }
  }

  try {
    const registry = loadRegistry(
      path.resolve(process.cwd(), "catalog", "skills.json"),
      path.resolve(process.cwd(), "catalog", "bundles.json")
    );

    const searchResult = await hybridSearch(registry, query, {
      agent,
      limit: 10
    });

    if (!searchResult.results.length) {
      console.log(`No capabilities found matching "${query}".`);
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

    if (result.action === "blocked" || result.action === "hold" || result.action === "unsupported" || result.action === "incompatible") {
      console.log(`Installation not performed: ${result.reason}`);
      return;
    }

    console.log(`Successfully installed ${selected.name}.`);
  } catch (error) {
    console.error(`Failed to search/install: ${error.message}`);
  }
}