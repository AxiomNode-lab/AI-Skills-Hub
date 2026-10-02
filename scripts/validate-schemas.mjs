#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("schemas");
const schemaFiles = fs.readdirSync(root).filter((file) => file.endsWith(".json"));
const errors = [];

function walk(value, currentFile) {
  if (!value || typeof value !== "object") return;

  if (Array.isArray(value)) {
    for (const item of value) walk(item, currentFile);
    return;
  }

  if (typeof value.$ref === "string" && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value.$ref)) {
    const target = path.resolve(path.dirname(currentFile), value.$ref);
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
      errors.push(`${path.relative(process.cwd(), currentFile)}: broken local $ref ${value.$ref}`);
    }
  }

  for (const child of Object.values(value)) walk(child, currentFile);
}

for (const file of schemaFiles) {
  const full = path.join(root, file);
  try {
    walk(JSON.parse(fs.readFileSync(full, "utf8")), full);
  } catch (error) {
    errors.push(`${path.relative(process.cwd(), full)}: invalid JSON: ${error.message}`);
  }
}

const registry = JSON.parse(fs.readFileSync(path.join(root, "registry.v0.2.schema.json"), "utf8"));
if (registry.properties?.skills?.items?.$ref !== "skill.schema.json") {
  errors.push("registry.v0.2.schema.json must reference skill.schema.json");
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("Schema references valid:", schemaFiles.length, "schema files");
