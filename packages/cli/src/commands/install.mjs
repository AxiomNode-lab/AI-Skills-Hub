import { readLocalCapabilities, resolveDependencies } from "../utils.mjs";
import { installCapability } from "../install-executor.mjs";
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
    const output = report((Array.isArray(ids) ? ids : []).map(id => ({ id, status: "skipped", installed: false, reason })), reason);
    process.exitCode = 2;
    return output;
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
      reason: missing.includes(id) ? "capability_not_found" : "request_contains_missing_capabilities"
    })));
  }

  const results = [];
  const failed = new Set();

  for (const cap of finalInstallList) {
    // Nothing is installed on top of a dependency that did not install.
    const brokenDependency = (cap.dependencies ?? []).find((dependency) => failed.has(dependency));
    if (brokenDependency) {
      failed.add(cap.id);
      results.push({ id: cap.id, status: "dependency-failed", installed: false, requires_confirmation: false, reason: "dependency_not_installed: " + brokenDependency, destination: null, notices: cap.release?.notices ?? [] });
      continue;
    }
    try {
      const result = await installCapability(cap, {
        agent,
        scope,
        cwd: process.cwd(),
        confirmed: options.yes === true,
        force: options.force === true,
        env: {},
        json: options.json === true
      });

      const status = result.installed === true
        ? (result.action === "already-installed" ? "already-installed" : "success")
        : result.requires_confirmation ? "confirmation-required" : result.action;
      if (result.installed !== true) failed.add(cap.id);
      results.push({
        id: cap.id,
        status,
        installed: result.installed === true,
        requires_confirmation: result.requires_confirmation === true,
        reason: result.reason ?? (result.installed === true ? null : result.action),
        destination: result.destination ?? null,
        notices: cap.release?.notices ?? []
      });

    } catch (error) {
      failed.add(cap.id);
      results.push({ id: cap.id, status: "error", installed: false, reason: error.message, message: error.message });
    }
  }

  return report(results);
}
