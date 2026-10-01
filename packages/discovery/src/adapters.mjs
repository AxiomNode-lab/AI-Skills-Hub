export const artifactTypes = ["skill","mcp-server","agent-plugin","cli-tool"];

function sourceUrl(source) {
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
      action:"source-direct",
      adapter:"mcp-config",
      command:["skills-hub","mcp","add",url,"--agent",agent].join(" ")
    };
  }

  if (type === "agent-plugin") {
    return {
      artifact_type:type,
      action:"source-direct",
      adapter:"agent-plugin",
      command:["skills-hub","plugin","add",url,"--agent",agent].join(" ")
    };
  }

  if (type === "cli-tool") {
    return {
      artifact_type:type,
      action:"source-direct",
      adapter:"package-manager",
      command:["skills-hub","tool","add",name].join(" ")
    };
  }

  return { artifact_type:type, action:"unsupported", reason:"unknown_artifact_type", command:null };
}
