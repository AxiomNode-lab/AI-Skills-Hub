import fs from "node:fs";
const data = JSON.parse(fs.readFileSync("catalog/skills.json","utf8"));
const counts = Object.groupBy(data.skills, s => s.distribution);
console.log(JSON.stringify({
  total:data.skills.length,
  bundled:(counts.bundled||[]).length,
  sourceDirect:(counts["source-direct"]||[]).length,
  reviewRequired:(counts["review-required"]||[]).length,
  blocked:(counts.blocked||[]).length
},null,2));
