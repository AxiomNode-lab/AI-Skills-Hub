import fs from "node:fs";

const data = JSON.parse(fs.readFileSync("catalog/skills.json","utf8"));
const allowed = new Set(["bundled","source-direct","review-required","blocked"]);
if (!Array.isArray(data.skills)) throw new Error("catalog.skills must be an array");

const ids = new Set();
for (const skill of data.skills) {
  if (ids.has(skill.id)) throw new Error("Duplicate skill id: " + skill.id);
  ids.add(skill.id);
  for (const field of ["id","name","publisher","source","category","license","distribution","compatibility","security"]) {
    if (!(field in skill)) throw new Error(skill.id + " missing " + field);
  }
  if (!allowed.has(skill.distribution)) throw new Error(skill.id + " invalid distribution");
  if (skill.distribution === "bundled" && !skill.license.redistributable) {
    throw new Error(skill.id + " cannot be bundled when redistributable=false");
  }
  if (skill.license.status !== "verified") {
    if (skill.distribution === "bundled") throw new Error(skill.id + " cannot be bundled with unverified license");
  }
}
console.log("Registry valid:", data.skills.length, "skills");
