import { input, select } from '@inquirer/prompts';
import fs from "node:fs/promises";
import path from "node:path";

export async function createCommand() {
  console.log("🛠️  Capability Generator Wizard");

  const type = await select({
    message: 'What kind of capability do you want to build?',
    choices: [
      { name: 'Skill (Agent natural language instructions)', value: 'skill' },
      { name: 'MCP Server (External tools/APIs integration)', value: 'mcp-server' },
      { name: 'CLI Tool (Executable script for agent)', value: 'cli-tool' },
      { name: 'Agent Plugin (Direct agent extension)', value: 'agent-plugin' }
    ]
  });

  const name = await input({
    message: 'What is the human-readable name of your capability?',
    validate: (val) => val.trim().length > 0 || 'Name is required'
  });

  const defaultId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const id = await input({
    message: 'Enter the unique ID (folder name) for this capability:',
    default: defaultId,
    validate: (val) => /^[a-z0-9-]+$/.test(val) || 'ID can only contain lowercase letters, numbers, and dashes'
  });

  const description = await input({
    message: 'Enter a short description:',
  });

  const targetDir = path.resolve(process.cwd(), "capabilities-library", id);
  
  try {
    await fs.access(targetDir);
    console.error(`Error: capability '${id}' already exists at ${targetDir}`);
    process.exitCode = 1;
    return;
  } catch {
    // Directory doesn't exist, which is good
  }

  console.log(`\nCreating capability in ${targetDir}...`);
  await fs.mkdir(targetDir, { recursive: true });

  const manifest = {
    id,
    name,
    type,
    description,
    dependencies: []
  };

  if (type === 'mcp-server') {
    manifest.mcpConfig = {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-example"]
    };
  } else if (type === 'cli-tool') {
    manifest.executable = "bin/tool.sh";
    await fs.mkdir(path.join(targetDir, "bin"), { recursive: true });
    await fs.writeFile(path.join(targetDir, "bin/tool.sh"), "#!/bin/bash\necho 'Hello from CLI tool!'\n");
    await fs.chmod(path.join(targetDir, "bin/tool.sh"), 0o755);
  } else if (type === 'skill') {
    const skillMd = `---
name: ${name}
description: ${description}
---

# ${name}

Write your detailed skill instructions here...
`;
    await fs.writeFile(path.join(targetDir, "SKILL.md"), skillMd);
  }

  await fs.writeFile(
    path.join(targetDir, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );

  console.log("✅ Capability created successfully!");
  console.log(`Next steps:
1. cd capabilities-library/${id}
2. Edit manifest.json to tweak settings
${type === 'skill' ? '3. Edit SKILL.md to add instructions' : ''}
`);
}
