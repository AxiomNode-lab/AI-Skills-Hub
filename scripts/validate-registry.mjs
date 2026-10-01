import fs from "node:fs";

const data = JSON.parse(fs.readFileSync("catalog/skills.json", "utf8"));
const bundlesPath = "catalog/bundles.json";
const bundlesData = fs.existsSync(bundlesPath) ? JSON.parse(fs.readFileSync(bundlesPath, "utf8")) : {bundles:{}};

const allowed = new Set(["bundled", "source-direct", "review-required", "blocked"]);
if (!Array.isArray(data.skills)) throw new Error("catalog.skills must be an array");

const ids = new Set();
for (const skill of data.skills) {
  if (ids.has(skill.id)) throw new Error("Duplicate skill id: " + skill.id);
  ids.add(skill.id);

  for (const field of ["id","name","publisher","source","category","license","distribution","compatibility","security","materialized"]) {
    if (!(field in skill)) throw new Error(skill.id + " missing " + field);
  }

  if (!allowed.has(skill.distribution)) throw new Error(skill.id + " invalid distribution");

  if (skill.distribution === "bundled" && (!skill.license.redistributable || skill.license.status !== "verified")) {
    throw new Error(skill.id + " cannot be bundled without verified redistribution rights");
  }

  if (skill.distribution === "bundled" && !/^[0-9a-f]{40}$/.test(skill.source.revision ?? "")) {
    throw new Error(skill.id + " bundled artifact must pin a 40-char git commit");
  }

  if (typeof skill.materialized !== "boolean") throw new Error(skill.id + " invalid materialized flag");

  if (!["verified","pending","review-required"].includes(skill.security.scan_status)) {
    throw new Error(skill.id + " invalid security scan status");
  }
}

const bundleNames = Object.keys(bundlesData.bundles ?? {});
for (const name of bundleNames) {
  if (!Array.isArray(bundlesData.bundles[name])) throw new Error(name + " must be an array");
  for (const id of bundlesData.bundles[name]) {
    if (!ids.has(id)) throw new Error("Bundle " + name + " references unknown skill: " + id);
  }
}

console.log("Registry valid:", data.skills.length, "skills;", bundleNames.length, "bundles");
