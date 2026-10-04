import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PluginAdapter } from "../packages/installer/src/adapters/PluginAdapter.mjs";
import { CLIAdapter } from "../packages/installer/src/adapters/CLIAdapter.mjs";

// Catalog paths are relative to the Hub, not to the project being installed into.
test("plugin and CLI adapters read materialized files from the Hub root, not the current directory", async t => {
  const hub = fs.mkdtempSync(path.join(os.tmpdir(), "hub-root-"));
  const project = fs.mkdtempSync(path.join(os.tmpdir(), "hub-project-"));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "hub-user-"));
  const saved = { cwd: process.cwd(), SKILLS_HUB_HOME: process.env.SKILLS_HUB_HOME, HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };
  t.after(() => {
    process.chdir(saved.cwd);
    for (const key of ["SKILLS_HUB_HOME", "HOME", "USERPROFILE"]) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    for (const dir of [hub, project, home]) fs.rmSync(dir, { recursive: true, force: true });
  });

  fs.mkdirSync(path.join(hub, "plugins", "demo", "bin"), { recursive: true });
  fs.writeFileSync(path.join(hub, "plugins", "demo", "plugin.json"), "{}\n");
  fs.writeFileSync(path.join(hub, "plugins", "demo", "bin", "tool.js"), "#!/usr/bin/env node\n");
  process.env.SKILLS_HUB_HOME = hub;
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  process.chdir(project);

  await new PluginAdapter({ id: "demo/demo", name: "demo", materialized_root: "plugins/demo" })
    .install({ agent: "codex", scope: "project", overwrite: false });
  assert.ok(fs.existsSync(path.join(project, ".agents", "plugins", "demo", "plugin.json")));

  await new CLIAdapter({ id: "demo-tool", name: "demo-tool", materialized_root: "plugins/demo", executable: "bin/tool.js" })
    .install({ agent: "codex", overwrite: false });
  assert.ok(fs.readdirSync(path.join(home, ".agents", "bin")).some(name => name.startsWith("demo-tool")));
});
