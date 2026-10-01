import { readLocalCapabilities, resolveDependencies } from "../utils.mjs";
import { installCapability } from "../install-executor.mjs";

export async function installCommand(ids, options = {}) {
  if (!Array.isArray(ids) || ids.length === 0) {
    console.error("Error: You must specify at least one capability ID to install.");
    return;
  }

  const agent = options.agent;
  if (!agent) {
    console.error("Error: You must specify the target agent using --agent <id>.");
    return;
  }

  const scope = options.scope || "project";
  if (!["project", "user"].includes(scope)) {
    console.error("Error: --scope must be either 'project' or 'user'.");
    return;
  }

  const allCapabilities = readLocalCapabilities();
  const missing = ids.filter((id) => !allCapabilities.find((c) => c.id === id));
  if (missing.length > 0) {
    console.error(`Error: Capabilities not found: ${missing.join(", ")}`);
    return;
  }

  const finalInstallList = resolveDependencies(ids, allCapabilities);
  const results = [];
  let hasErrors = false;

  for (const cap of finalInstallList) {
    try {
      const result = await installCapability(cap, {
        agent,
        scope,
        cwd: process.cwd(),
        confirmed: options.yes === true,
        env: {}
      });

      const status = result.installed ? "success" : result.action;
      results.push({
        id: cap.id,
        status,
        reason: result.reason ?? null,
        destination: result.destination ?? null
      });

      if (!result.installed) {
        if (result.requires_confirmation) {
          hasErrors = true;
          if (!options.json) {
            console.error(
              `Installation of ${cap.id} requires explicit consent. Re-run with --yes.`
            );
          }
        } else if (!options.json) {
          console.error(`Skipped ${cap.id}: ${result.reason ?? result.action}`);
        }
      } else if (!options.json) {
        console.log(`Installed ${cap.id}.`);
      }
    } catch (error) {
      hasErrors = true;
      results.push({ id: cap.id, status: "error", message: error.message });
      if (!options.json) console.error(`Failed to install ${cap.id}: ${error.message}`);
    }
  }

  if (options.json) {
    console.log(JSON.stringify({ success: !hasErrors, results }, null, 2));
  } else {
    console.log(hasErrors ? "Finished with errors." : "Installation complete.");
  }
}
