import { SkillAdapter } from "./SkillAdapter.mjs";
import { MCPAdapter } from "./MCPAdapter.mjs";
import { CLIAdapter } from "./CLIAdapter.mjs";
import { PluginAdapter } from "./PluginAdapter.mjs";

export function getAdapter(capability) {
  switch (capability.type) {
    case "mcp-server":
      return new MCPAdapter(capability);
    case "cli-tool":
      return new CLIAdapter(capability);
    case "agent-plugin":
      return new PluginAdapter(capability);
    case "skill":
    default:
      return new SkillAdapter(capability);
  }
}
