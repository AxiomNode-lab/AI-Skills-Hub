#!/usr/bin/env node
// Builds the single user-facing npm package in dist/npm.
//
// The repository is a pnpm workspace of internal packages that import each
// other as @ai-skills-hub/*. End users get one package instead: the runtime
// modules reachable from the CLI (with internal imports rewritten to relative
// paths), the registry, and every released artifact with the evidence the
// installer and server verify at run time. Nothing else from the repository
// is copied: no tests, scripts, ingestion snapshots, reviews of unreleased
// skills, or development configuration.
//
// Usage: node scripts/build-package.mjs [--out dist/npm]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const OUT = path.resolve(ROOT, args.includes("--out") ? args[args.indexOf("--out") + 1] : "dist/npm");

export const PACKAGE_NAME = "@axiomnode-lab/skills-hub";
const ENTRY = "packages/cli/bin/skills-hub.mjs";

const rootPkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const workspace = new Map();
for (const dir of fs.readdirSync(path.join(ROOT, "packages"))) {
  const file = path.join(ROOT, "packages", dir, "package.json");
  if (!fs.existsSync(file)) continue;
  const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
  workspace.set(pkg.name, { dir: path.join(ROOT, "packages", dir), pkg });
}

// Resolves an @ai-skills-hub/<pkg>[/<subpath>] specifier through the package's exports map.
function resolveWorkspace(specifier) {
  const match = specifier.match(/^(@ai-skills-hub\/[^/]+)(\/.+)?$/);
  const entry = match && workspace.get(match[1]);
  if (!entry) throw new Error("Unknown workspace import: " + specifier);
  const key = "." + (match[2] ?? "");
  const target = typeof entry.pkg.exports === "string" && key === "." ? entry.pkg.exports : entry.pkg.exports?.[key];
  if (!target) throw new Error("Unexported workspace path: " + specifier);
  return path.join(entry.dir, target);
}

const IMPORT = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])([^"']+)\2/g;
const modules = new Map(); // absolute source path -> rewritten text
const external = new Set();

function collect(file) {
  if (modules.has(file)) return;
  modules.set(file, null);
  const text = fs.readFileSync(file, "utf8");
  const rewritten = text.replace(IMPORT, (whole, lead, quote, specifier) => {
    if (specifier.startsWith(".")) {
      collect(path.resolve(path.dirname(file), specifier));
      return whole;
    }
    if (specifier.startsWith("@ai-skills-hub/")) {
      const target = resolveWorkspace(specifier);
      collect(target);
      let relative = path.relative(path.dirname(file), target).split(path.sep).join("/");
      if (!relative.startsWith(".")) relative = "./" + relative;
      return `${lead}${quote}${relative}${quote}`;
    }
    if (!specifier.startsWith("node:")) external.add(specifier.split("/").slice(0, specifier.startsWith("@") ? 2 : 1).join("/"));
    return whole;
  });
  modules.set(file, rewritten);
}

collect(path.join(ROOT, ENTRY));

// External runtime dependencies keep the version ranges declared in the workspace.
const dependencies = {};
for (const name of [...external].sort()) {
  const declared = [...workspace.values()].map(({ pkg }) => pkg.dependencies?.[name]).find(Boolean);
  if (!declared) throw new Error(`No declared version for runtime dependency ${name}`);
  dependencies[name] = declared;
}

const registry = JSON.parse(fs.readFileSync(path.join(ROOT, "catalog/skills.json"), "utf8"));
const released = registry.skills.filter((skill) => skill.distribution === "bundled" && skill.materialized === true && skill.release?.status === "eligible");

fs.rmSync(OUT, { recursive: true, force: true });
const write = (relative, data) => {
  const target = path.join(OUT, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, data);
};
const copy = (relative) => write(relative, fs.readFileSync(path.join(ROOT, relative)));

for (const [file, text] of modules) write(path.relative(ROOT, file), text);
fs.chmodSync(path.join(OUT, ENTRY), 0o755);

for (const file of ["catalog/skills.json", "catalog/bundles.json", "catalog/skills.lock.json", "catalog/agents.json", "LICENSE", "NOTICE.md"]) copy(file);
for (const skill of released) {
  const stem = skill.id.replaceAll("/", "__");
  const manifestPath = `catalog/materialized-manifests/${stem}.json`;
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, manifestPath), "utf8"));
  copy(manifestPath);
  copy(manifest.review.path);
  for (const file of manifest.materialized_files) copy(path.posix.join(skill.materialized_root, file.path));
}

const readme = path.join(ROOT, "packages/cli/README.md");
write("README.md", fs.readFileSync(fs.existsSync(readme) ? readme : path.join(ROOT, "README.md")));

const pkg = {
  name: PACKAGE_NAME,
  version: rootPkg.version,
  description: "Install reviewed, license-checked Agent Skills into Claude Code, Codex, Cursor, GitHub Copilot and OpenCode projects.",
  license: "MIT",
  type: "module",
  bin: { "skills-hub": ENTRY },
  engines: rootPkg.engines,
  dependencies,
  repository: { type: "git", url: "git+https://github.com/AxiomNode-lab/AI-Skills-Hub.git" },
  homepage: "https://github.com/AxiomNode-lab/AI-Skills-Hub#readme",
  bugs: { url: "https://github.com/AxiomNode-lab/AI-Skills-Hub/issues" },
  keywords: ["agent-skills", "claude-code", "codex", "cursor", "github-copilot", "opencode", "mcp", "skills"],
  files: ["packages/", "catalog/", "skills/", "README.md", "LICENSE", "NOTICE.md"]
};
write("package.json", JSON.stringify(pkg, null, 2) + "\n");

console.log(`Built ${PACKAGE_NAME}@${pkg.version} in ${path.relative(ROOT, OUT) || "."}: ${modules.size} modules, ${released.length} released skills, dependencies ${Object.keys(dependencies).join(", ")}`);
