import fs from "node:fs";

const data = JSON.parse(fs.readFileSync("catalog/skills.json", "utf8"));
const counts = data.skills.reduce((acc, skill) => {
  const key = skill.distribution.replaceAll("-", "_");
  acc[key] = (acc[key] ?? 0) + 1;
  acc.total += 1;
  if (skill.license.status !== "verified") acc.license_unverified += 1;
  if (skill.security.scan_status !== "verified") acc.security_unverified += 1;
  if (skill.security.shell || skill.security.network || skill.security.credentials) acc.capability_sensitive += 1;
  return acc;
}, { total: 0, license_unverified: 0, security_unverified: 0, capability_sensitive: 0 });

console.log(JSON.stringify(counts, null, 2));
