function buildInstallPlan(skills, agent, options = {}) {
  const allowReview = options.allowReview === true;

  return skills.map((skill) => {
    const compatible = new Set(skill.compatibility ?? []);
    const isCompatible =
      compatible.has(agent) ||
      (agent === "generic-agent" && compatible.has("agent-skills")) ||
      (agent === "agent-skills" && compatible.has("agent-skills"));

    const base = {
      id: skill.id,
      agent,
      distribution: skill.distribution,
      license: skill.license.spdx,
      source: "https://github.com/" + skill.source.repo
    };

    if (!isCompatible) {
      return { ...base, action: "incompatible", reason: "agent_not_supported", command: null };
    }

    if (skill.distribution === "blocked") {
      return { ...base, action: "blocked", reason: "registry_blocked", command: null };
    }

    if (skill.distribution === "source-direct") {
      return {
        ...base,
        action: "source-direct",
        reason: "upstream_direct_install",
        command: [
          "npx skills add",
          "https://github.com/" + skill.source.repo,
          "--skill", JSON.stringify(skill.name),
          "--agent", agent,
          "-y"
        ].join(" ")
      };
    }

    if (skill.distribution === "review-required") {
      if (!allowReview) {
        return { ...base, action: "hold", reason: "manual_review_required", command: null };
      }
      return {
        ...base,
        action: "source-direct",
        reason: "explicit_review_override",
        command: [
          "npx skills add",
          "https://github.com/" + skill.source.repo,
          "--skill", JSON.stringify(skill.name),
          "--agent", agent,
          "-y"
        ].join(" ")
      };
    }

    if (skill.distribution === "bundled") {
      if (skill.release?.status !== "eligible" || !skill.materialized) {
        return {
          ...base,
          action: "hold",
          reason: "bundle_not_released",
          command: null
        };
      }

      return {
        ...base,
        action: "install",
        command: [
          "install-from-registry",
          skill.materialized_root,
          "--agent", agent
        ].join(" ")
      };
    }

    return { ...base, action: "hold", reason: "unknown_distribution_state", command: null };
  });
}

export { buildInstallPlan };
