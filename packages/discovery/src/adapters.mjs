export const artifactTypes = ["skill","mcp-server","agent-plugin","cli-tool"];

function sourceUrl(source) {
  return source?.install_url ?? source?.url ?? (source?.repo ? "https://github.com/" + source.repo : null);
}

function q(value) {
  return JSON.stringify(String(value ?? ""));
}

export function buildAdapterPlan(item, agent, { scope="project" } = {}) {
  const type = item.artifact_type ?? "skill";
  const url = sourceUrl(item.source);
  const name = item.name;

  if (type === "skill" && item.distribution === "bundled" && !(item.materialized && item.release?.status === "eligible")) {
    return {
      artifact_type:type,
      action:"adapter-pending",
      status:"planned",
      adapter:"registry-release-gate",
      reason:"bundle_not_released",
      command:null,
      argv:null
    };
  }

  if (type === "skill" && item.distribution === "review-required") {
    return {
      artifact_type:type,
      action:"adapter-pending",
      status:"planned",
      adapter:"manual-review",
      reason:"manual_review_required",
      command:null,
      argv:null
    };
  }

  if (type === "skill" && url && name) {
    return {
      artifact_type:type,
      action:"source-direct",
      status:"implemented",
      adapter:"skills-cli",
      argv:["npx","--yes","skills","add",url,"--skill",name,"--agent",agent,"-y"],
      command:["npx","--yes","skills","add",url,"--skill",name,"--agent",agent,"-y"].join(" ")
    };
  }

  if (type === "mcp-server") {
    const install=item.installation ?? {};
    const installScope = scope === "user" ? "user" : "project";

    if (install.method === "remote" && install.url) {
      if (agent === "codex") {
        return {
          artifact_type:type,action:"source-direct",status:"implemented",adapter:"codex-mcp",
          argv:["codex","mcp","add",name,"--url",install.url],
          command:["codex","mcp","add",name,"--url",install.url].join(" ")
        };
      }
      if (agent === "claude-code") {
        const transport = install.type === "sse" ? "sse" : "http";
        return {
          artifact_type:type,action:"source-direct",status:"implemented",adapter:"claude-mcp",
          argv:["claude","mcp","add","--transport",transport,name,install.url,"--scope",installScope],
          command:["claude","mcp","add","--transport",transport,name,install.url,"--scope",installScope].join(" ")
        };
      }
      if (agent === "cursor") {
        return {
          artifact_type:type,action:"configuration",status:"implemented",adapter:"cursor-mcp-json",
          argv:null,command:null,
          config:{mcpServers:{[name]:{url:install.url}}},
          target:scope === "user" ? "~/.cursor/mcp.json" : ".cursor/mcp.json"
        };
      }
      if (agent === "github-copilot") {
        return {
          artifact_type:type,action:"configuration",status:"implemented",adapter:"copilot-mcp-json",
          argv:null,command:null,
          config:{mcpServers:{[name]:{url:install.url}}},
          target:scope === "user" ? "~/.copilot/mcp-config.json" : ".mcp.json"
        };
      }
    }

    if (install.method === "package" && install.identifier) {
      const runtime=install.runtime ?? "npx";
      const args=[...((install.runtimeArguments ?? []))];
      if(runtime === "npx") {
        args.unshift("-y",install.identifier + (install.version ? "@"+install.version : ""));
      } else {
        args.unshift(install.identifier + (install.version ? "@"+install.version : ""));
      }

      if (agent === "codex") {
        return {
          artifact_type:type,action:"source-direct",status:"implemented",adapter:"codex-mcp",
          argv:["codex","mcp","add",name,"--",runtime,...args],
          command:["codex","mcp","add",name,"--",runtime,...args].join(" ")
        };
      }
      if (agent === "claude-code") {
        return {
          artifact_type:type,action:"source-direct",status:"implemented",adapter:"claude-mcp",
          argv:["claude","mcp","add",name,"--scope",installScope,"--",runtime,...args],
          command:["claude","mcp","add",name,"--scope",installScope,"--",runtime,...args].join(" ")
        };
      }
      if (agent === "cursor") {
        return {
          artifact_type:type,action:"configuration",status:"implemented",adapter:"cursor-mcp-json",
          argv:null,command:null,
          config:{mcpServers:{[name]:{command:runtime,args}}},
          target:scope === "user" ? "~/.cursor/mcp.json" : ".cursor/mcp.json"
        };
      }
      if (agent === "github-copilot") {
        return {
          artifact_type:type,action:"configuration",status:"implemented",adapter:"copilot-mcp-json",
          argv:null,command:null,
          config:{mcpServers:{[name]:{command:runtime,args}}},
          target:scope === "user" ? "~/.copilot/mcp-config.json" : ".mcp.json"
        };
      }
    }

    return {
      artifact_type:type,
      action:"adapter-pending",
      status:"planned",
      adapter:"mcp",
      reason:"no-supported-installation-shape",
      command:null
    };
  }

  if (type === "agent-plugin") {
    if (agent === "codex" && item.source?.repo) {
      return {
        artifact_type:type,
        action:"marketplace",
        status:"implemented",
        adapter:"codex-plugin-marketplace",
        argv:["codex","plugin","marketplace","add",item.source.repo],
        command:["codex","plugin","marketplace","add",item.source.repo].join(" "),
        note:"Adds the plugin marketplace; plugin installation is then selected by the client."
      };
    }
    return {
      artifact_type:type,
      action:"adapter-pending",
      status:"planned",
      adapter:"agent-plugin",
      reason:"client-specific-plugin-installation",
      command:null
    };
  }

  if (type === "cli-tool" && item.source?.package) {
    const pkg=item.source.package;
    const version = item.source.version ? "@"+item.source.version : "";
    return {
      artifact_type:type,
      action:"source-direct",
      status:"implemented",
      adapter:"npm-package",
      argv:["pnpm","add","-D",pkg+version],
      command:["pnpm","add","-D",pkg+version].join(" "),
      note:"Installs the package into the current project; choose a global package-manager workflow later if the tool requires it."
    };
  }

  return {
    artifact_type:type,
    action:"unsupported",
    status:"unsupported",
    reason:url ? "unknown_artifact_type" : "missing_source",
    command:null
  };
}

export { q };
