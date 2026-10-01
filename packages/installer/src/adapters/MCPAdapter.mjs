import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function getMCPConfigPath(agent) {
  const home = os.homedir();
  if (agent === "claude-code" || agent === "claude") {
    // Standard Claude Desktop config
    if (process.platform === 'darwin') {
      return path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    } else {
      return path.join(home, '.config', 'Claude', 'claude_desktop_config.json');
    }
  } else if (agent === "cursor") {
    // Cursor uses a different format, but for now we'll pretend there's a local json
    return path.join(home, '.cursor', 'mcp.json');
  } else {
    // Fallback: create a generic mcp config in the project root
    return path.join(process.cwd(), '.agents', 'mcp.json');
  }
}

export class MCPAdapter {
  constructor(capability) {
    this.capability = capability;
  }

  async install(options) {
    const { agent } = options;
    const configPath = getMCPConfigPath(agent);

    // Ensure directory exists
    fs.mkdirSync(path.dirname(configPath), { recursive: true });

    // Read or create config
    let config = { mcpServers: {} };
    if (fs.existsSync(configPath)) {
      try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } catch (e) {
        throw new Error(`Critical Security/Data Loss Prevention: Failed to parse existing agent config at ${configPath}. Please fix the JSON syntax manually or remove the file to start fresh. Original error: ${e.message}`);
      }
    }

    if (!config.mcpServers) config.mcpServers = {};

    // Add server config
    // We expect the capability to have mcp config in capability.mcpConfig
    if (this.capability.mcpConfig) {
      config.mcpServers[this.capability.id] = { ...this.capability.mcpConfig };
    } else {
      // Fallback dummy config if not specified
      config.mcpServers[this.capability.id] = {
        command: "npx",
        args: ["-y", `@modelcontextprotocol/server-${this.capability.id}`]
      };
    }

    // Inject env variables collected from the user
    if (options.env && Object.keys(options.env).length > 0) {
      config.mcpServers[this.capability.id].env = {
        ...(config.mcpServers[this.capability.id].env || {}),
        ...options.env
      };
    }

    // Write back
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    return {
      id: this.capability.id,
      agent,
      action: "installed",
      destination: configPath,
      type: "mcp-server"
    };
  }
}
