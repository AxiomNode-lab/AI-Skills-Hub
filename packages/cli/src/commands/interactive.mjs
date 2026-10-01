import { select, checkbox, confirm, input } from '@inquirer/prompts';
import { detectAgents } from '../../../installer/src/detector.mjs';
import { getAdapter } from '../../../installer/src/adapters/index.mjs';
import { readLocalCapabilities, resolveDependencies, checkPrerequisites, autoSyncCapability } from '../utils.mjs';

// Simple local search engine
function searchCapabilities(query, capabilities) {
  if (!query) return capabilities;
  const lowerQuery = query.toLowerCase();
  return capabilities.filter(c => 
    (c.name && c.name.toLowerCase().includes(lowerQuery)) ||
    (c.description && c.description.toLowerCase().includes(lowerQuery)) ||
    (c.type && c.type.toLowerCase().includes(lowerQuery))
  );
}

export async function interactiveCommand() {
  console.log("AI Skills Hub CLI v0.2.0");
  console.log("────────────────────────\n");

  // Detect Agents
  console.log("Scanning system for AI Agents...");
  const detectedAgents = await detectAgents();
  
  if (detectedAgents.length === 0) {
    console.log("❌ No known AI agents detected on the system or in Docker.");
    return;
  }

  // 2. Select Agent
  const agentChoices = detectedAgents.map(a => ({
    name: a.name + (a.type === 'docker' ? ' 🐳' : ' 💻'),
    value: a.id,
    description: `Type: ${a.type}`
  }));

  const selectedAgentId = await select({
    message: 'Select the AI Agent you want to install capabilities for:',
    choices: agentChoices
  });

  console.log(`\n✅ Selected Agent: ${selectedAgentId}\n`);

  // 3. Read Local Capabilities (Async, fast)
  const allCapabilities = await readLocalCapabilities();
  if (allCapabilities.length === 0) {
    console.log("⚠️ No capabilities found in 'capabilities-library/'.");
    return;
  }

  // 4. Search Option
  const searchMode = await select({
    message: 'How would you like to find capabilities?',
    choices: [
      { name: 'Browse all', value: 'browse' },
      { name: 'Search by keyword / intent', value: 'search' }
    ]
  });

  let displayCapabilities = allCapabilities;
  if (searchMode === 'search') {
    const query = await input({ message: 'Enter your search query:' });
    displayCapabilities = searchCapabilities(query, allCapabilities);
    if (displayCapabilities.length === 0) {
      console.log(`❌ No capabilities found matching "${query}". Exiting.`);
      return;
    }
    console.log(`🔎 Found ${displayCapabilities.length} capabilities matching your query.\n`);
  }

  // 5. Select Capabilities
  const capabilityChoices = displayCapabilities.map(c => ({
    name: `${c.name} [${c.type}] - ${c.description || ''}`,
    value: c.id
  }));

  const selectedIds = await checkbox({
    message: 'Select the capabilities you want to install:',
    choices: capabilityChoices,
    required: true
  });

  if (selectedIds.length === 0) {
    console.log("No capabilities selected. Exiting.");
    return;
  }

  // 6. Resolve Dependencies
  const finalInstallList = resolveDependencies(selectedIds, allCapabilities);
  const extraDeps = finalInstallList.filter(c => !selectedIds.includes(c.id));
  
  if (extraDeps.length > 0) {
    console.log(`\n📦 The following dependencies will also be installed:`);
    for (const dep of extraDeps) {
      console.log(`   - ${dep.name} [${dep.type}]`);
    }
  }

  // 7. Security Consent
  const highRiskCaps = finalInstallList.filter(c => c.type === 'cli-tool' || c.type === 'mcp-server');
  if (highRiskCaps.length > 0) {
    console.log("\n⚠️  SECURITY WARNING ⚠️");
    console.log("The following capabilities require elevated permissions or configuration changes:");
    for (const cap of highRiskCaps) {
      if (cap.type === 'cli-tool') {
        console.log(`- ${cap.name}: Installs executable scripts to your system PATH.`);
      } else if (cap.type === 'mcp-server') {
        console.log(`- ${cap.name}: Modifies the configuration of your AI Agent (${selectedAgentId}).`);
      }
    }
    const consent = await confirm({
      message: `Do you understand the risks and consent to installing these capabilities?`,
      default: false
    });
    
    if (!consent) {
      console.log("\n❌ Installation aborted due to lack of security consent.");
      return;
    }
  } else {
    // Basic confirm if no high risk
    const confirmInstall = await confirm({
      message: `Ready to install ${finalInstallList.length} item(s) to ${selectedAgentId}. Continue?`
    });

    if (!confirmInstall) {
      console.log("Aborted.");
      return;
    }
  }

  // 8. Install
  console.log("\n🚀 Installing capabilities...\n");
  let hasErrors = false;
  let mcpInstalled = false;

  for (const cap of finalInstallList) {
    try {
      console.log(`Installing ${cap.name} (${cap.type})...`);
      
      // Auto-Sync
      await autoSyncCapability(cap.materialized_root);
      
      // Check prerequisites
      if (cap.prerequisites && cap.prerequisites.length > 0) {
        const { missing } = checkPrerequisites(cap.prerequisites);
        if (missing.length > 0) {
          console.error(`❌ Error: Missing prerequisites for ${cap.name}: ${missing.join(', ')}`);
          console.error(`Please install them first (e.g., via brew, apt, or npm).`);
          hasErrors = true;
          continue; // Skip installation for this cap
        }
      }

      // Prompt for requiredEnv
      let env = {};
      if (cap.requiredEnv && cap.requiredEnv.length > 0) {
        console.log(`🔑 This capability requires Environment Variables to function:`);
        for (const envVar of cap.requiredEnv) {
          const val = await input({ 
            message: `${envVar}:`, 
            validate: (v) => v.trim().length > 0 || "This field is required" 
          });
          env[envVar] = val;
        }
      }

      const adapter = getAdapter(cap);
      const result = await adapter.install({
        agent: selectedAgentId,
        scope: "project",
        overwrite: true,
        force: true,
        env
      });
      
      const { writeInstallRecord } = await import('../../../installer/src/state.mjs');
      writeInstallRecord({
        schema_version: "0.2",
        skill_id: cap.id,
        name: cap.name,
        type: cap.type,
        agent: selectedAgentId,
        scope: "project",
        installed_at: new Date().toISOString(),
        destination: result.destination,
        files: []
      });

      if (cap.type === 'mcp-server') mcpInstalled = true;

      console.log(`✅ Success: Installed to ${result.destination}\n`);
    } catch (error) {
      hasErrors = true;
      console.error(`❌ Failed to install ${cap.name}:`, error.message, "\n");
    }
  }

  if (hasErrors) {
    console.log("⚠️ Finished with some errors.");
  } else {
    console.log("🎉 All done successfully!");
  }

  if (mcpInstalled) {
    console.log(`\n⚠️  IMPORTANT: You have installed or updated an MCP server.`);
    console.log(`Please RESTART your AI Agent (e.g. Claude Desktop) for the changes to take effect!`);
  }
}
