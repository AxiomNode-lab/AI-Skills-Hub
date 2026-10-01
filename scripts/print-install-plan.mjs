import fs from "node:fs";

const registry = JSON.parse(fs.readFileSync("catalog/skills.json", "utf8"));
const bundles = JSON.parse(fs.readFileSync("catalog/bundles.json", "utf8"));
const [, , bundleName = "@core", agent] = process.argv;
const ids = bundles.bundles[bundleName];
if (!ids) {
  console.error("Unknown bundle:", bundleName);
  process.exit(1);
}
const items = ids.map((id) => registry.skills.find((s) => s.id === id)).filter(Boolean);
const compatible = agent
  ? items.filter((s) => s.compatibility.includes(agent) || s.compatibility.includes("agent-skills"))
  : items;

const plan = compatible.map((s) => ({
  id: s.id,
  action: s.distribution === "bundled" ? "download-from-registry" :
    s.distribution === "source-direct" ? "open-official-source" :
    s.distribution === "review-required" ? "manual-review" : "blocked"
}));
console.log(JSON.stringify({bundle: bundleName, agent: agent ?? "generic", plan}, null, 2));
