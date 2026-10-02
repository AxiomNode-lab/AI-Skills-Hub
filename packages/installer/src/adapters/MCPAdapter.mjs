import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function getMCPConfigPath(agent, scope = "project", cwd = process.cwd()) {
  const effectiveAgent = agent === "copilot" ? "github-copilot" : agent;

  if (effectiveAgent === "cursor") {
    return scope === "user"
      ? path.join(os.homedir(), ".cursor", "mcp.json")
      : path.resolve(cwd, ".cursor", "mcp.json");
  }

  if (effectiveAgent === "github-copilot") {
    return scope === "user"
      ? path.join(os.homedir(), ".copilot", "mcp-config.json")
      : path.resolve(cwd, ".mcp.json");
  }

  throw new Error(
    `MCP configuration installation is not implemented for agent '${agent}'. Use the agent's supported MCP CLI command.`
  );
}

function assertRegularFileOrMissing(file) {
  if (!fs.existsSync(file)) return;
  if (fs.lstatSync(file).isSymbolicLink()) {
    throw new Error(`Refusing to modify symbolic-link configuration: ${file}`);
  }
  if (!fs.statSync(file).isFile()) {
    throw new Error(`MCP configuration path is not a regular file: ${file}`);
  }
}

function serverName(capability) {
  const value = String(
    capability.server_name ?? capability.name ?? capability.id ?? ""
  ).trim();
  if (!value || value.length > 256) {
    throw new Error("MCP capability has an invalid server name.");
  }
  return value;
}

function packageIdentifier(value) {
  const normalized = String(value ?? "").trim();
  if (!/^(?:@[A-Za-z0-9._-]+\/)?[A-Za-z0-9._-]+$/.test(normalized)) {
    throw new Error(`Unsafe MCP package identifier: ${normalized}`);
  }
  return normalized;
}

function runtimeName(value) {
  const normalized = String(value ?? "npx").trim();
  if (!/^[A-Za-z0-9._-]+$/.test(normalized)) {
    throw new Error(`Unsafe MCP runtime: ${normalized}`);
  }
  return normalized;
}

function buildServerConfig(capability, agent, env = {}) {
  const installation = capability.installation;
  if (!installation || typeof installation !== "object") {
    throw new Error(
      "MCP capability has no verified installation metadata; refusing to invent a package or command."
    );
  }

  if (installation.method === "remote") {
    let url;
    try {
      url = new URL(String(installation.url));
    } catch {
      throw new Error("MCP remote installation URL is invalid.");
    }
    if (url.protocol !== "https:") {
      throw new Error("MCP remote installation requires an HTTPS URL.");
    }

    const config = {
      url: url.toString()
    };

    if (installation.headers && typeof installation.headers === "object") {
      config.headers = { ...installation.headers };
    }

    return config;
  }

  if (installation.method === "package") {
    const identifier = packageIdentifier(installation.identifier);
    const runtime = runtimeName(installation.runtime ?? "npx");
    const version = installation.version
      ? String(installation.version).trim()
      : "";
    if (version && !/^[A-Za-z0-9._+-]+$/.test(version)) {
      throw new Error(`Unsafe MCP package version: ${version}`);
    }

    const packageSpec = version ? `${identifier}@${version}` : identifier;
    const args = Array.isArray(installation.runtimeArguments)
      ? installation.runtimeArguments.map((value) => String(value))
      : [];
    if (args.some((value) => value.includes("\0"))) {
      throw new Error("MCP runtime arguments contain an invalid NUL byte.");
    }

    const server = {
      command: runtime,
      args: runtime === "npx" ? ["-y", packageSpec, ...args] : [packageSpec, ...args]
    };

    if (agent === "cursor") {
      server.type = "stdio";
    }

    if (Object.keys(env).length) server.env = { ...env };
    return server;
  }

  throw new Error(
    `Unsupported MCP installation method: ${String(installation.method)}`
  );
}

function readConfig(configPath) {
  assertRegularFileOrMissing(configPath);
  if (!fs.existsSync(configPath)) return { mcpServers: {} };

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    throw new Error(
      `Unable to parse existing MCP configuration at ${configPath}: ${error.message}`
    );
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Existing MCP configuration must contain a JSON object.");
  }

  if (parsed.mcpServers === undefined) parsed.mcpServers = {};
  if (!parsed.mcpServers || typeof parsed.mcpServers !== "object" || Array.isArray(parsed.mcpServers)) {
    throw new Error("Existing MCP configuration has an invalid mcpServers object.");
  }

  return parsed;
}

function atomicWriteJson(file, value) {
  const directory = path.dirname(file);
  fs.mkdirSync(directory, { recursive: true });
  assertRegularFileOrMissing(file);

  const mode = fs.existsSync(file) ? (fs.statSync(file).mode & 0o777) : 0o600;
  const temp = path.join(
    directory,
    `.${path.basename(file)}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );

  try {
    fs.writeFileSync(temp, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
    fs.chmodSync(temp, mode);
    fs.renameSync(temp, file);
  } catch (error) {
    try { fs.rmSync(temp, { force: true }); } catch {}
    throw error;
  }
}

export class MCPAdapter {
  constructor(capability) {
    this.capability = capability;
  }

  async install(options = {}) {
    const agent = options.agent;
    const scope = options.scope ?? "project";
    const cwd = options.cwd ?? process.cwd();
    const configPath = options.configPath ?? getMCPConfigPath(agent, scope, cwd);
    const name = serverName(this.capability);
    const config = readConfig(configPath);
    config.mcpServers[name] = buildServerConfig(this.capability, agent, options.env ?? {});
    atomicWriteJson(configPath, config);

    return {
      id: this.capability.id,
      agent,
      scope,
      action: "installed",
      destination: configPath,
      type: "mcp-server"
    };
  }
}

export function removeMCPServer(configPath, name) {
  assertRegularFileOrMissing(configPath);
  if (!fs.existsSync(configPath)) return false;

  const config = readConfig(configPath);
  if (!Object.prototype.hasOwnProperty.call(config.mcpServers, name)) return false;

  delete config.mcpServers[name];
  atomicWriteJson(configPath, config);
  return true;
}

export { getMCPConfigPath };
