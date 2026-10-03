import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { findExecutable } from "@ai-skills-hub/core";

// Agents with a native skill install target (see targets.mjs and catalog/agents.json).
// Each is detected by an executable on PATH or a configuration directory; detection
// is a convenience for choosing an agent, not a requirement for installing.
function agentSpecs(home, env) {
  const appData = env.APPDATA || path.join(home, "AppData", "Roaming");
  return [
    { id: "claude-code", name: "Claude Code", commands: ["claude"], dirs: [path.join(home, ".claude")] },
    { id: "codex", name: "Codex", commands: ["codex"], dirs: [path.join(home, ".codex")] },
    {
      id: "cursor", name: "Cursor", commands: ["cursor", "cursor-agent"],
      dirs: [path.join(home, ".cursor"), path.join(appData, "Cursor"), path.join(home, "Library", "Application Support", "Cursor"), path.join(home, ".config", "Cursor")]
    },
    { id: "github-copilot", name: "GitHub Copilot", commands: ["copilot"], dirs: [path.join(home, ".copilot")] },
    { id: "opencode", name: "OpenCode", commands: ["opencode"], dirs: [path.join(home, ".config", "opencode"), path.join(home, ".opencode")] }
  ];
}

function isDirectory(candidate) {
  try {
    return fs.statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

// Returns every supported agent with `detected` and the evidence found, detected
// agents first, followed by the generic Agent Skills target (always available).
export async function detectAgents({ env = process.env, home = os.homedir() } = {}) {
  const agents = agentSpecs(home, env).map(({ id, name, commands, dirs }) => {
    const executable = commands.map((command) => findExecutable(command, env)).find(Boolean) ?? null;
    const directory = executable ? null : dirs.find(isDirectory) ?? null;
    const evidence = executable ?? directory;
    return { id, name, type: "local", detected: Boolean(evidence), evidence };
  });
  agents.sort((a, b) => Number(b.detected) - Number(a.detected));
  agents.push({ id: "agent-skills", name: "Agent Skills (generic .agents/skills)", type: "local", detected: true, evidence: null });
  return agents;
}
