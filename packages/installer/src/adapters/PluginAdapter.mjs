import fs from "node:fs";
import path from "node:path";
import { normalizeSkillDirectory, resolveInstallRoot } from "../targets.mjs";

export class PluginAdapter {
  constructor(capability) {
    this.capability = capability;
  }

  async install(options) {
    const { agent, scope, overwrite, force } = options;
    
    // Plugins are usually similar to skills but might be installed in a different sub-folder
    // like `.agents/plugins` instead of `.agents/skills`.
    // For now, we will install them in the agent's root under a plugins folder.
    
    const root = resolveInstallRoot(agent, scope, process.cwd());
    // Modify root to point to plugins instead of skills
    const pluginsRoot = root.replace(/skills$/, "plugins");
    
    const destination = normalizeSkillDirectory(pluginsRoot, this.capability.name);
    
    if (fs.existsSync(destination)) {
      if (!overwrite) {
        throw new Error("Destination exists; pass overwrite to replace.");
      }
      fs.rmSync(destination, { recursive: true, force: true });
    }

    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.cpSync(this.capability.materialized_root, destination, {
      recursive: true,
      force: overwrite,
      errorOnExist: !overwrite,
      dereference: true
    });

    return {
      id: this.capability.id,
      agent,
      action: "installed",
      destination,
      type: "agent-plugin"
    };
  }
}
