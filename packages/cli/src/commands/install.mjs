import { getAdapter } from '../../../installer/src/adapters/index.mjs';
import { readLocalCapabilities, resolveDependencies, autoSyncCapability } from '../utils.mjs';

export async function installCommand(ids, options) {
  if (!ids || ids.length === 0) {
    console.error("Error: You must specify at least one capability ID to install.");
    return;
  }

  const agent = options.agent;
  if (!agent) {
    console.error("Error: You must specify the target agent using --agent <id>");
    return;
  }

  const allCapabilities = await readLocalCapabilities();
  const missing = ids.filter(id => !allCapabilities.find(c => c.id === id));
  if (missing.length > 0) {
    console.error(`Error: Capabilities not found: ${missing.join(', ')}`);
    return;
  }

  const finalInstallList = resolveDependencies(ids, allCapabilities);

  // Security Check
  const highRiskCaps = finalInstallList.filter(c => c.type === 'cli-tool' || c.type === 'mcp-server');
  if (highRiskCaps.length > 0 && !options.yes) {
    console.error("Error: The following capabilities require elevated permissions:");
    for (const cap of highRiskCaps) {
      console.error(`- ${cap.name} [${cap.type}]`);
    }
    console.error("\nYou must pass the '--yes' flag to explicitly consent to their installation in headless mode.");
    return;
  }

  let hasErrors = false;
  const results = [];

  for (const cap of finalInstallList) {
    try {
      if (!options.json) console.log(`Installing ${cap.id}...`);
      
      // Auto-Sync before installing
      await autoSyncCapability(cap.materialized_root);
      
      const adapter = getAdapter(cap);
      const result = await adapter.install({
        agent,
        scope: "project",
        overwrite: true,
        force: true
      });
      
      const { writeInstallRecord } = await import('../../../installer/src/state.mjs');
      writeInstallRecord({
        schema_version: "0.2",
        skill_id: cap.id,
        name: cap.name,
        type: cap.type,
        agent,
        scope: "project",
        installed_at: new Date().toISOString(),
        destination: result.destination,
        files: []
      });

      results.push({ id: cap.id, status: 'success', destination: result.destination });
    } catch (error) {
      hasErrors = true;
      results.push({ id: cap.id, status: 'error', message: error.message });
      if (!options.json) console.error(`Failed to install ${cap.id}: ${error.message}`);
    }
  }

  if (options.json) {
    console.log(JSON.stringify({ success: !hasErrors, results }, null, 2));
  } else {
    if (hasErrors) console.log("Finished with errors.");
    else console.log("All installed successfully.");
  }
}
