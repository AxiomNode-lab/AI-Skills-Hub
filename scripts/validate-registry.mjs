import fs from "node:fs";

const data = JSON.parse(fs.readFileSync("catalog/skills.json", "utf8"));
const bundlesPath = "catalog/bundles.json";
const lockPath = "catalog/skills.lock.json";
const bundlesData = fs.existsSync(bundlesPath) ? JSON.parse(fs.readFileSync(bundlesPath, "utf8")) : {bundles:{}};
const lockData = fs.existsSync(lockPath) ? JSON.parse(fs.readFileSync(lockPath, "utf8")) : {skills:[]};

const allowed = new Set(["bundled", "source-direct", "review-required", "blocked"]);
if (!Array.isArray(data.skills)) throw new Error("catalog.skills must be an array");

const ids = new Set();
for (const skill of data.skills) {
  if (ids.has(skill.id)) throw new Error("Duplicate skill id: " + skill.id);
  ids.add(skill.id);

  for (const field of ["id","name","publisher","source","category","license","distribution","compatibility","security","materialized","release"]) {
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
  if (!["pending","eligible","hold"].includes(skill.release?.status)) throw new Error(skill.id + " invalid release status");
  if (!Array.isArray(skill.release?.reasons)) throw new Error(skill.id + " invalid release reasons");
  if (skill.distribution !== "bundled" && skill.release.status === "eligible") {
    throw new Error(skill.id + " non-bundled skill cannot be release-eligible");
  }
  if (skill.materialized && skill.release.status !== "eligible") {
    throw new Error(skill.id + " materialized skill must be release-eligible");
  }

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

const locked = new Map((lockData.skills ?? []).map((item) => [item.id, item]));
for (const skill of data.skills.filter((s) => s.distribution === "bundled")) {
  const item = locked.get(skill.id);
  if (!item) throw new Error("Bundled skill missing from lockfile: " + skill.id);
  if (item.revision !== skill.source.revision) throw new Error("Lockfile revision mismatch: " + skill.id);
}
for (const item of lockData.skills ?? []) {
  const skill = data.skills.find((s) => s.id === item.id);
  if (!skill) throw new Error("Lockfile references unknown skill: " + item.id);
  if (skill.distribution !== "bundled") throw new Error("Lockfile contains non-bundled skill: " + item.id);
}

console.log("Registry valid:", data.skills.length, "skills;", bundleNames.length, "bundles;", locked.size, "locked");

