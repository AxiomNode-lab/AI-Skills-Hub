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

  if (type === "skill" && url && name) {
    return {
      artifact_type:type,
      action:"source-direct",
      status:"implemented",
      adapter:"skills-cli",
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
          command:["codex","mcp","add",name,"--url",install.url].join(" ")
        };
      }
      if (agent === "claude-code") {
        const transport = install.type === "sse" ? "sse" : "http";
        return {
          artifact_type:type,action:"source-direct",status:"implemented",adapter:"claude-mcp",
          command:["claude","mcp","add","--transport",transport,name,install.url,"--scope",installScope].join(" ")
        };
      }
      if (agent === "cursor") {
        return {
          artifact_type:type,action:"configuration",status:"implemented",adapter:"cursor-mcp-json",
          command:null,
          config:{
            mcpServers:{
              [name]:{url:install.url}
            }
          },
          target:scope === "user" ? "~/.cursor/mcp.json" : ".cursor/mcp.json"
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
          command:["codex","mcp","add",name,"--",runtime,...args].join(" ")
        };
      }
      if (agent === "claude-code") {
        return {
          artifact_type:type,action:"source-direct",status:"implemented",adapter:"claude-mcp",
          command:["claude","mcp","add",name,"--scope",installScope,"--",runtime,...args].join(" ")
        };
      }
      if (agent === "cursor") {
        return {
          artifact_type:type,action:"configuration",status:"implemented",adapter:"cursor-mcp-json",
          command:null,
          config:{
            mcpServers:{
              [name]:{command:runtime,args}
            }
          },
          target:scope === "user" ? "~/.cursor/mcp.json" : ".cursor/mcp.json"
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
    return {
      artifact_type:type,
      action:"source-direct",
      status:"implemented",
      adapter:"npm-package",
      command:["npx","--yes",pkg].join(" ")
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
