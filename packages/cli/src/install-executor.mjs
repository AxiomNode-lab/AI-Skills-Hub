import { execFileSync } from "node:child_process";
import { buildAdapterPlan } from "@ai-skills-hub/discovery";
import { getAdapter } from "../../installer/src/adapters/index.mjs";
import { writeInstallRecord } from "../../installer/src/state.mjs";

const TRUSTED_BINARIES = new Set(["npx", "pnpm", "codex", "claude", "copilot"]);

function canonicalBinary(value) {
  const base = String(value ?? "").split(/[\\/]/).pop()?.toLowerCase() ?? "";
  return base.replace(/\.(?:cmd|exe|bat)$/i, "");
}

function validHttpsUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function validGithubRepo(value) {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(String(value ?? ""));
}

function validPackage(value) {
  return /^(?:@[A-Za-z0-9._-]+\/)?[A-Za-z0-9._-]+(?:@[A-Za-z0-9._-]+)?$/.test(String(value ?? ""));
}

function assertSafeExternalPlan(plan, agent) {
  if (!Array.isArray(plan.argv) || plan.argv.length === 0) {
    throw new Error("Installation plan does not contain an executable argument vector.");
  }

  if (plan.argv.some((arg) => typeof arg !== "string" || arg.includes("\0"))) {
    throw new Error("Installation plan contains an invalid argument.");
  }

  const binary = canonicalBinary(plan.argv[0]);
  if (!TRUSTED_BINARIES.has(binary)) {
    throw new Error(`External installer '${plan.argv[0]}' is not allowlisted.`);
  }

  switch (plan.adapter) {
    case "skills-cli": {
      const [, flag, cli, action, repository, skillFlag, skillName, agentFlag, targetAgent] = plan.argv;
      if (
        binary !== "npx"
        || flag !== "--yes"
        || cli !== "skills"
        || action !== "add"
        || !validHttpsUrl(repository)
        || skillFlag !== "--skill"
        || !skillName
        || agentFlag !== "--agent"
        || targetAgent !== agent
        || plan.argv[9] !== "-y"
        || plan.argv.length !== 10
      ) {
        throw new Error("Invalid skills CLI installation plan.");
      }
      break;
    }
    case "npm-package": {
      if (binary !== "pnpm" || plan.argv[1] !== "add" || plan.argv[2] !== "-D" || !validPackage(plan.argv[3])) {
        throw new Error("Invalid npm package installation plan.");
      }
      break;
    }
    case "codex-mcp":
      if (
        binary !== "codex"
        || plan.argv[1] !== "mcp"
        || plan.argv[2] !== "add"
        || !plan.argv[3]
        || String(plan.argv[3]).startsWith("-")
        || /[\r\n\0]/.test(String(plan.argv[3]))
      ) {
        throw new Error("Invalid Codex MCP installation plan.");
      }
      if (plan.argv[4] === "--url" && !validHttpsUrl(plan.argv[5])) {
        throw new Error("Invalid Codex MCP URL.");
      }
      break;
    case "claude-mcp":
      if (
        binary !== "claude"
        || plan.argv[1] !== "mcp"
        || plan.argv[2] !== "add"
        || !plan.argv[3]
        || /[\r\n\0]/.test(String(plan.argv[3]))
      ) {
        throw new Error("Invalid Claude MCP installation plan.");
      }
      break;
    case "codex-plugin-marketplace":
      if (
        binary !== "codex"
        || plan.argv[1] !== "plugin"
        || plan.argv[2] !== "marketplace"
        || plan.argv[3] !== "add"
        || !validGithubRepo(plan.argv[4])
      ) {
        throw new Error("Invalid Codex plugin marketplace installation plan.");
      }
      break;
    default:
      throw new Error(`External installation adapter '${plan.adapter ?? "unknown"}' is not approved.`);
  }
}

export async function installCapability(
  capability,
  {
    agent,
    scope = "project",
    cwd = process.cwd(),
    confirmed = false,
    env = {}
  } = {}
) {
  if (!agent) throw new Error("Target agent is required.");

  const plan = buildAdapterPlan(capability, agent, { scope });

  if (["incompatible", "blocked", "adapter-pending", "unsupported"].includes(plan.action)) {
    return { ...plan, action: plan.action, installed: false };
  }

  if (
    plan.action === "source-direct"
    || plan.action === "marketplace"
    || plan.action === "configuration"
  ) {
    if (!confirmed) {
      return {
        ...plan,
        installed: false,
        requires_confirmation: true,
        reason: plan.reason || "explicit_confirmation_required"
      };
    }

    if (plan.action === "configuration") {
      const adapter = getAdapter(capability);
      const result = await adapter.install({
        agent,
        scope,
        cwd,
        overwrite: true,
        force: true,
        env
      });
      return {
        ...plan,
        ...result,
        installed: true
      };
    }

    assertSafeExternalPlan(plan, agent);
    execFileSync(plan.argv[0], plan.argv.slice(1), {
      cwd,
      stdio: "inherit",
      env: { ...process.env, ...env }
    });

    return {
      ...plan,
      installed: true,
      external: true,
      destination: null
    };
  }

  if (plan.action === "configuration" || plan.action === "install") {
    const adapter = getAdapter(capability);
    const result = await adapter.install({
      agent,
      scope,
      cwd,
      overwrite: true,
      force: true,
      env
    });

    if (!result.record && result.destination) {
      writeInstallRecord({
        schema_version: "0.2",
        skill_id: capability.id,
        name: capability.name,
        type: capability.type ?? capability.artifact_type ?? "skill",
        agent,
        scope,
        source: {
          repo: capability.source?.repo ?? null,
          path: capability.source?.path ?? null,
          revision: capability.source?.revision ?? null
        },
        installed_at: new Date().toISOString(),
        destination: result.destination,
        files: []
      }, cwd);
    }

    return {
      ...plan,
      ...result,
      installed: true
    };
  }

  if (plan.action === "hold") {
    return { ...plan, installed: false };
  }

  throw new Error(`Unsupported installation action: ${plan.action}`);
}

export { assertSafeExternalPlan };
