export const artifactTypes = ["skill","mcp-server","agent-plugin","cli-tool"];

function sourceUrl(source) {
  if (source?.install_url) return source.install_url;
  if (source?.url) return source.url;
  if (source?.repo) return "https://github.com/" + source.repo;
  return null;
}

export function buildAdapterPlan(item, agent) {
  const type = item.artifact_type ?? "skill";
  const url = sourceUrl(item.source);
  const name = item.name;

  if (!url) {
    return { artifact_type:type, action:"unsupported", reason:"missing_source_url", command:null };
  }

  if (type === "skill") {
    return {
      artifact_type:type,
      action:"source-direct",
      adapter:"skills-cli",
      command:["npx","--yes","skills","add",url,"--skill",name,"--agent",agent,"-y"].join(" ")
    };
  }

  if (type === "mcp-server") {
    return {
      artifact_type:type,
      action:"adapter-pending",
      status:"planned",
      adapter:"mcp-config",
      reason:"mcp_adapter_not_implemented",
      command:null
    };
  }

  if (type === "agent-plugin") {
    return {
      artifact_type:type,
      action:"adapter-pending",
      status:"planned",
      adapter:"agent-plugin",
      reason:"plugin_adapter_not_implemented",
      command:null
    };
  }

  if (type === "cli-tool") {
    return {
      artifact_type:type,
      action:"adapter-pending",
      status:"planned",
      adapter:"package-manager",
      reason:"tool_adapter_not_implemented",
      command:null
    };
  }

  return { artifact_type:type, action:"unsupported", reason:"unknown_artifact_type", command:null };
}
