import os from "node:os";
import path from "node:path";

const targets = {
  "generic": { project: [".agents/skills"], user: [".agents/skills"] },
  "agent-skills": { project: [".agents/skills"], user: [".agents/skills"] },
  "codex": { project: [".agents/skills", ".codex/skills"], user: [".agents/skills", ".codex/skills"] },
  "claude-code": { project: [".claude/skills", ".agents/skills"], user: [".claude/skills", ".agents/skills"] },
  "cursor": { project: [".agents/skills", ".cursor/skills"], user: [".cursor/skills", ".agents/skills"] },
  "github-copilot": { project: [".github/skills", ".agents/skills"], user: ["~/.copilot/skills", "~/.agents/skills"] },
  "copilot": { project: [".github/skills", ".agents/skills"], user: ["~/.copilot/skills", "~/.agents/skills"] },
  "opencode": { project: [".opencode/skills"], user: ["~/.config/opencode/skills"] }
};

function expandHome(value) {
  return value.startsWith("~/") ? path.join(os.homedir(), value.slice(2)) : value;
}

export function supportedAgents() {
  return Object.keys(targets);
}

export function resolveInstallRoot(agent, scope = "project", cwd = process.cwd()) {
  const spec = targets[agent] ?? targets.generic;
  const roots = spec[scope] ?? spec.project;
  const relative = roots[0];
  return path.resolve(scope === "user" ? os.homedir() : cwd, expandHome(relative));
}

export function candidateInstallRoots(agent, scope = "project", cwd = process.cwd()) {
  const spec = targets[agent] ?? targets.generic;
  const roots = spec[scope] ?? spec.project;
  return roots.map((root) => path.resolve(scope === "user" ? os.homedir() : cwd, expandHome(root)));
}

export function normalizeSkillDirectory(root, skillName) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skillName)) {
    throw new Error("Invalid skill directory name: " + skillName);
  }
  return path.join(root, skillName);
}
