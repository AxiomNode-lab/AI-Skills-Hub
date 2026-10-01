import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// Helper to check if a directory or file exists
function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

// Known local agent installation paths / commands
const LOCAL_AGENTS = {
  "claude-code": {
    name: "Claude Code",
    type: "local",
    check: async () => {
      // Check if `claude` command is in PATH
      try {
        await execFileAsync("which", ["claude"]);
        return true;
      } catch {
        return false;
      }
    }
  },
  "cursor": {
    name: "Cursor",
    type: "local",
    check: async () => {
      // Common cursor config paths
      const home = process.env.HOME || process.env.USERPROFILE;
      const paths = [
        path.join(home, ".cursor"),
        path.join(home, "AppData", "Roaming", "Cursor"),
        path.join(home, "Library", "Application Support", "Cursor")
      ];
      return paths.some(exists);
    }
  },
  "opencode": {
    name: "OpenCode",
    type: "local",
    check: async () => {
      const home = process.env.HOME || process.env.USERPROFILE;
      return exists(path.join(home, ".opencode"));
    }
  },
  "agent-skills": {
    name: "Agent Skills (Default)",
    type: "local",
    check: async () => {
      // This is the default project agent, always return true as a fallback
      return true;
    }
  }
};

// Function to detect docker containers running specific agents
async function checkDockerAgents() {
  try {
    const { stdout } = await execFileAsync("docker", ["ps", "--format", "{{.Names}} {{.Image}}"]);
    const lines = stdout.trim().split("\n");
    const found = [];
    for (const line of lines) {
      const [name, image] = line.split(" ");
      if (!name) continue;
      
      const lowerName = name.toLowerCase();
      const lowerImage = image ? image.toLowerCase() : "";

      if (lowerName.includes("gemini") || lowerImage.includes("gemini")) {
        found.push({ id: `docker-gemini-${name}`, name: `Gemini (Docker: ${name})`, type: "docker" });
      } else if (lowerName.includes("chatgpt") || lowerImage.includes("chatgpt")) {
        found.push({ id: `docker-chatgpt-${name}`, name: `ChatGPT (Docker: ${name})`, type: "docker" });
      } else if (lowerName.includes("codex") || lowerImage.includes("codex")) {
        found.push({ id: `docker-codex-${name}`, name: `Codex (Docker: ${name})`, type: "docker" });
      }
    }
    return found;
  } catch (error) {
    // Docker is probably not installed or not running
    return [];
  }
}

export async function detectAgents() {
  const agents = [];

  // Check local agents
  for (const [id, config] of Object.entries(LOCAL_AGENTS)) {
    if (await config.check()) {
      agents.push({ id, name: config.name, type: config.type });
    }
  }

  // Check docker agents
  const dockerAgents = await checkDockerAgents();
  agents.push(...dockerAgents);

  return agents;
}
