#!/usr/bin/env node
// Independently re-downloads every file of every released skill from GitHub at
// its pinned commit and compares SHA-256 with the materialization manifest and
// the shipped copy. Proves each bundled skill is an unmodified upstream file.
// Requires network access. Usage: node scripts/verify-upstream.mjs [--concurrency N]
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const concurrency = Number(process.argv[process.argv.indexOf("--concurrency") + 1]) || 8;
const registry = JSON.parse(fs.readFileSync("catalog/skills.json", "utf8"));
const released = registry.skills.filter((skill) => skill.release?.status === "eligible" && skill.materialized);
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

const jobs = [];
for (const skill of released) {
  const manifest = JSON.parse(fs.readFileSync(`catalog/materialized-manifests/${skill.id.replaceAll("/", "__")}.json`, "utf8"));
  const { repo, revision, path: sourcePath } = manifest.source;
  for (const file of manifest.materialized_files) {
    const upstreamPath = file.attached ? file.source_path : `${sourcePath}/${file.path}`;
    jobs.push({
      id: skill.id,
      file: file.path,
      expected: file.sha256,
      local: path.join(skill.materialized_root, ...file.path.split("/")),
      url: `https://raw.githubusercontent.com/${repo}/${revision}/${upstreamPath.split("/").map(encodeURIComponent).join("/")}`
    });
  }
}

const failures = [];
let done = 0;
async function check(job) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(job.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const remote = sha256(Buffer.from(await response.arrayBuffer()));
      const local = sha256(fs.readFileSync(job.local));
      if (remote !== job.expected) failures.push(`${job.id} ${job.file}: upstream differs from manifest`);
      else if (local !== job.expected) failures.push(`${job.id} ${job.file}: shipped copy differs from manifest`);
      return;
    } catch (error) {
      if (attempt === 2) failures.push(`${job.id} ${job.file}: ${error.message}`);
      else await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
}

const queue = [...jobs];
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (queue.length) {
    await check(queue.shift());
    done += 1;
  }
}));

console.log(`Checked ${done} files of ${released.length} released skills against GitHub at their pinned commits.`);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Every shipped file is byte-identical to its upstream source.");
}
