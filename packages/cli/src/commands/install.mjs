import { readLocalCapabilities, resolveDependencies } from "../utils.mjs";
import { installCapability } from "../install-executor.mjs";

export async function installCommand(ids, options = {}) {
  const report = (results, error = null) => {
    const success = !error && results.length > 0 && results.every(result => result.installed === true);
    if (!success) process.exitCode = 1;
    const output = { success, results, ...(error ? { error } : {}) };
    if (options.json) console.log(JSON.stringify(output, null, 2));
    else {
      if (error) console.error(`Error: ${error}`);
      for (const result of results) {
        if (result.installed) console.log(`Installed ${result.id}.`);
        else console.error(`${result.status}: ${result.id}: ${result.reason}${result.requires_confirmation ? ". Re-run with --yes to confirm." : ""}`);
      }
      console.log(success ? "Installation complete." : "Installation incomplete; not all requested capabilities were installed.");
    }
    return output;
  };
  const invalidRequest = (reason) => report(
    (Array.isArray(ids) ? ids : []).map(id => ({ id, status: "skipped", installed: false, reason })), reason
  );
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
    return invalidRequest(error.message);
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

  for (const cap of finalInstallList) {
    try {
      const result = await installCapability(cap, {
        agent,
        scope,
        cwd: process.cwd(),
        confirmed: options.yes === true,
        env: {},
        json: options.json === true
      });

      const status = result.installed === true ? "success" : result.requires_confirmation ? "confirmation-required" : result.action;
      results.push({
        id: cap.id,
        status,
        installed: result.installed === true,
        requires_confirmation: result.requires_confirmation === true,
        reason: result.reason ?? (result.installed === true ? null : result.action),
        destination: result.destination ?? null
      });

    } catch (error) {
      results.push({ id: cap.id, status: "error", installed: false, reason: error.message, message: error.message });
    }
  }

  return report(results);
}
