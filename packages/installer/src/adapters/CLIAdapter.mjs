import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

export class CLIAdapter {
  constructor(capability) {
    this.capability = capability;
  }

  async install(options) {
    const { agent, overwrite } = options;
    const binDir = path.join(os.homedir(), ".agents", "bin");
    
    // Ensure bin dir exists
    fs.mkdirSync(binDir, { recursive: true });

    // The capability manifest for a CLI tool should specify:
    // { "type": "cli-tool", "executable": "path/to/script.js" }
    
    if (!this.capability.executable) {
      throw new Error(`CLI tool ${this.capability.id} does not specify an executable in its manifest.`);
    }

    const executable = this.capability.executable;
    if (executable.includes("..") || path.isAbsolute(executable)) {
      throw new Error(`Security Violation: Executable path '${executable}' contains path traversal or absolute path attempts. Only paths relative to the capability directory are allowed.`);
    }

    const sourcePath = path.join(this.capability.materialized_root, executable);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Executable not found at ${sourcePath}`);
    }

    const destPath = path.join(binDir, this.capability.id);
    
    if (fs.existsSync(destPath)) {
      if (!overwrite) {
        throw new Error(`CLI tool already exists at ${destPath}. Use overwrite.`);
      }
      fs.rmSync(destPath);
    }

    // Copy the executable
    fs.copyFileSync(sourcePath, destPath);
    
    // Make it executable
    try {
      fs.chmodSync(destPath, 0o755); // rwxr-xr-x
    } catch (e) {
      // Ignored on windows
    }

    return {
      id: this.capability.id,
      agent,
      action: "installed",
      destination: destPath,
      type: "cli-tool"
    };
  }
}
