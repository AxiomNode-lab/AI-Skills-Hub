#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const files = [];
function discover(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory() && !["node_modules", ".git", ".pnpm-store"].includes(entry.name)) discover(full);
    else if (entry.isFile() && entry.name.endsWith(".test.mjs")) files.push(full);
  }
}
for (const root of ["tests", "packages"]) discover(path.resolve(root));
files.sort();

if (files.length === 0) {
  console.error("No test files found in tests/ or packages/; refusing an empty test run.");
  process.exitCode = 1;
} else {
  console.log(`Running ${files.length} test files on ${process.platform}.`);
  const result = spawnSync(process.execPath, ["--test", "--test-reporter=tap", ...files], {
    encoding: "utf8", maxBuffer: 64 * 1024 * 1024
  });
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  const count = name => Number(result.stdout?.match(new RegExp(`^# ${name} (\\d+)\\s*$`, "m"))?.[1] ?? 0);
  if (result.error || result.signal || result.status !== 0) {
    console.error(result.error?.message ?? `Test process failed (${result.signal ?? result.status}).`);
    process.exitCode = 1;
  } else if (count("tests") === 0 || count("pass") === 0) {
    console.error("No passing tests executed; refusing an empty or entirely skipped test run.");
    process.exitCode = 1;
  }
}
