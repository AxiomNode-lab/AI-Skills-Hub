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

    const command = [
      "npx skills add",
      "https://github.com/" + skill.source.repo,
      "--skill", JSON.stringify(skill.name),
      "--agent", agent,
      "-y"
    ].join(" ");

    return {
      ...base,
      action: skill.distribution === "bundled" ? "install" : "source-direct",
      command
    };
  });
}
