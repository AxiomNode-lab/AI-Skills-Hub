import { readLocalCapabilities, resolveDependencies } from "../utils.mjs";
import { installCapability, preflightCapability } from "../install-executor.mjs";
import { captureDirectory, restoreDirectory } from "../../../installer/src/native.mjs";
import { findInstallRecord, readInstallRecords, removeInstallRecord, writeInstallRecord } from "../../../installer/src/state.mjs";
import { paint } from "../ui.mjs";

export async function installCommand(ids, options = {}) {
  const report = (results, error = null) => {
    const success = !error && results.length > 0 && results.every(result => result.installed === true);
    if (!success) process.exitCode = 1;
    const output = { success, results, ...(error ? { error } : {}) };
    if (options.json) console.log(JSON.stringify(output, null, 2));
    else {
      if (error) console.error(paint("red", `Error: ${error}`, process.stderr));
      for (const result of results) {
        if (result.installed) {
          const verb = result.status === "already-installed" ? "Already installed" : "Installed";
          console.log(`${paint("green", "✔")} ${verb} ${result.id}${result.destination ? paint("dim", ` → ${result.destination}`) : ""}`);
          for (const notice of result.notices ?? []) console.log(`  ${paint("yellow", "⚠ Notice:")} ${notice.text}`);
        } else {
          console.error(`${paint("red", "✖", process.stderr)} ${result.status}: ${result.id}: ${result.reason}${result.requires_confirmation ? ". Re-run with --yes to confirm." : ""}`);
          if (result.command) console.error(`  Command that --yes would run: ${result.command.map((part) => (/^[\w@./:=-]+$/.test(part) ? part : JSON.stringify(part))).join(" ")}`);
          // Shown before the user confirms with --yes.
          if (result.requires_confirmation) for (const notice of result.notices ?? []) console.error(`  ${paint("yellow", "⚠ Notice:", process.stderr)} ${notice.text}`);
        }
      }
      console.log(success ? paint("green", "Installation complete.") : paint("yellow", "Installation incomplete; not all requested capabilities were installed."));
    }
    return output;
  };
  // A request that cannot run as given is a usage error (exit code 2).
  const invalidRequest = (reason) => {
    const results = (Array.isArray(ids) ? ids : []).map(id => ({ id, status: "skipped", installed: false, reason }));
    process.exitCode = 2;
    if (options.json) {
      const output = { success: false, results, error: reason };
      console.log(JSON.stringify(output, null, 2));
      return output;
    }
    console.error(paint("red", `Error: ${reason}`, process.stderr));
    console.error("Usage: skills-hub install <id> [<id>...] --agent <claude-code|codex|cursor|github-copilot|opencode|agent-skills>");
    return { success: false, results, error: reason };
  };
  if (!Array.isArray(ids) || ids.length === 0) {
    return invalidRequest("You must specify at least one capability ID to install.");
  }

  const agent = options.agent;
  if (!agent) {
    return invalidRequest("You must specify the target agent using --agent <id>.");
  }

  const scope = options.scope || "project";
  if (!["project", "user"].includes(scope)) {
    return invalidRequest("--scope must be either 'project' or 'user'.");
  }

  let allCapabilities;
  try {
    allCapabilities = readLocalCapabilities();
  } catch (error) {
    return report(ids.map(id => ({ id, status: "skipped", installed: false, reason: error.message })), error.message);
  }
  const finalInstallList = resolveDependencies(ids, allCapabilities);
  const requested = [...new Set([...ids, ...finalInstallList.flatMap(cap => cap.dependencies ?? [])])];
  const missing = requested.filter((id) => !allCapabilities.find((c) => c.id === id));
  if (missing.length > 0) {
    return report(requested.map(id => ({
      id, status: missing.includes(id) ? "not-found" : "skipped", installed: false,
      // Bundle aliases (@name) are catalog groupings only; install takes skill IDs.
      reason: !missing.includes(id) ? "request_contains_missing_capabilities" : id.startsWith("@") ? "bundle_aliases_not_supported" : "capability_not_found"
    })));
  }

  const installOptions = {
    agent,
    scope,
    cwd: process.cwd(),
    confirmed: options.yes === true,
    force: options.force === true,
    env: {},
    json: options.json === true
  };
  const notices = cap => cap.release?.notices ?? [];
  const resultFor = (cap, result) => {
    const status = result.installed === true
      ? (result.action === "already-installed" ? "already-installed" : "success")
      : result.requires_confirmation ? "confirmation-required" : result.action;
    return {
      id: cap.id,
      status,
      installed: result.installed === true,
      requires_confirmation: result.requires_confirmation === true,
      reason: result.reason ?? (result.installed === true ? null : result.action),
      destination: result.destination ?? null,
      // The exact external command --yes would run, shown before consent.
      ...(result.requires_confirmation && Array.isArray(result.argv) ? { command: result.argv } : {}),
      notices: notices(cap)
    };
  };
  const errorResult = (cap, error) => ({ id: cap.id, status: "error", installed: false, reason: error.message, message: error.message, notices: notices(cap) });

  // Phase 1: check every item before anything is written or run. One item that
  // cannot install stops the whole request, so a command never leaves half of
  // what was asked for behind.
  const checks = new Map();
  const failed = new Set();
  const results = [];
  for (const cap of finalInstallList) {
    const brokenDependency = (cap.dependencies ?? []).find((dependency) => failed.has(dependency));
    if (brokenDependency) {
      failed.add(cap.id);
      results.push({ id: cap.id, status: "dependency-failed", installed: false, requires_confirmation: false, reason: "dependency_not_installed: " + brokenDependency, destination: null, notices: notices(cap) });
      continue;
    }
    try {
      const check = preflightCapability(cap, installOptions);
      checks.set(cap.id, check);
      // Two requested skills with the same folder name would overwrite each other.
      const clash = check.ok && check.destination && [...checks].find(([id, other]) => id !== cap.id && other.destination === check.destination);
      if (clash) {
        failed.add(cap.id);
        results.push({ id: cap.id, status: "error", installed: false, requires_confirmation: false, reason: "destination_conflict: " + clash[0], destination: check.destination, notices: notices(cap) });
      } else if (!check.ok) {
        failed.add(cap.id);
        results.push(resultFor(cap, check.result));
      } else {
        results.push(null);
      }
    } catch (error) {
      failed.add(cap.id);
      results.push(errorResult(cap, error));
    }
  }
  if (failed.size > 0) {
    return report(results.map((result, index) => result ?? {
      id: finalInstallList[index].id, status: "skipped", installed: false, requires_confirmation: false,
      reason: "not_installed_request_incomplete", destination: null, notices: notices(finalInstallList[index])
    }));
  }

  // Phase 2: install in dependency order. Each native write is journaled with
  // the folder and record it replaces; if a later item fails, those are put
  // back. External installers cannot be undone and are reported as such.
  const applied = [];
  const journal = [];
  let failure = null;
  for (const cap of finalInstallList) {
    const check = checks.get(cap.id);
    try {
      if (!check.external && !check.unchanged) {
        journal.push({ id: cap.id, destination: check.destination, folder: captureDirectory(check.destination), record: findInstallRecord(readInstallRecords(scope, installOptions.cwd), cap.id, agent) });
      }
      const result = await installCapability(cap, installOptions);
      const entry = resultFor(cap, result);
      applied.push(entry);
      if (!entry.installed) { failure = cap.id; break; }
    } catch (error) {
      applied.push(errorResult(cap, error));
      failure = cap.id;
      break;
    }
  }
  if (!failure) return report(applied);

  const rolledBack = new Set();
  for (const step of journal.reverse()) {
    try {
      restoreDirectory(step.destination, step.folder);
      if (step.record) writeInstallRecord(step.record, installOptions.cwd);
      else removeInstallRecord(step.id, scope, installOptions.cwd, agent);
      rolledBack.add(step.id);
    } catch (error) {
      const entry = applied.find((result) => result.id === step.id);
      if (entry) entry.rollback_error = error.message;
    }
  }
  const final = finalInstallList.map((cap) => {
    const entry = applied.find((result) => result.id === cap.id);
    if (!entry) return { id: cap.id, status: "skipped", installed: false, requires_confirmation: false, reason: "not_installed_request_incomplete", destination: null, notices: notices(cap) };
    if (entry.id === failure) return entry;
    if (rolledBack.has(cap.id)) return { ...entry, status: "rolled-back", installed: false, reason: "rolled_back_after_failure: " + failure };
    // Already present before this command, or an external installer that ran.
    return checks.get(cap.id).external ? { ...entry, rollback: "not-possible" } : entry;
  });
  return report(final);
}
