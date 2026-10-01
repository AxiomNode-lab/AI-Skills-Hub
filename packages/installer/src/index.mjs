export function buildInstallPlan(skills, agent, options = {}) {
  const allowReview = options.allowReview === true;

  return skills.map((skill) => {
    const base = {
      id: skill.id,
      agent,
      distribution: skill.distribution,
      license: skill.license.spdx,
      source: "https://github.com/" + skill.source.repo
    };

    if (skill.distribution === "blocked") {
      return { ...base, action: "blocked", reason: "registry_blocked", command: null };
    }

    if (skill.distribution === "review-required" && !allowReview) {
      return { ...base, action: "hold", reason: "manual_review_required", command: null };
    }

    if (skill.distribution === "bundled" && !skill.materialized) {
      return {
        ...base,
        action: "source-bridge",
        reason: "bundle_eligible_but_not_materialized",
        command: [
          "npx skills add",
          "https://github.com/" + skill.source.repo,
          "--skill", JSON.stringify(skill.name),
          "--agent", agent,
          "-y"
        ].join(" ")
      };
    }

    const command = [
      "install-from-registry",
      skill.materialized_root ?? ("skills/" + skill.id),
      "--agent", agent
    ].join(" ");

    return {
      ...base,
      action: "install",
      command
    };
  });
}
