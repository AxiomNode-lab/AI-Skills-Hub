import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildPortablePluginManifest, exportPortablePlugin } from "./index.mjs";

const skillFixture = (temp) => {
  const source=path.join(temp,"source","example");
  fs.mkdirSync(source,{recursive:true});
  fs.writeFileSync(path.join(source,"SKILL.md"),"---\nname: example\ndescription: Example.\n---\n");
  return {
    id:"test/example",
    name:"example",
    publisher:"Example Publisher",
    materialized:true,
    materialized_root:source,
    license:{spdx:"Apache-2.0"},
    source:{repo:"example/repo",path:"skills/example",revision:"a".repeat(40)}
  };
};

test("portable manifest uses Agent Plugins 1.0 schema", () => {
  const m=buildPortablePluginManifest({
    name:"example-plugin",
    description:"Example plugin",
    repository:"https://example.test/repo"
  });
  assert.equal(m.skills,"./skills/");
  assert.match(m.$schema,/agent-plugins.org\/schemas\/1\.0\.0/);
  assert.equal("license" in m,false);
});

test("export refuses unmaterialized skills", () => {
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),"plugin-export-"));
  assert.throws(() => exportPortablePlugin({
    outputDir:temp,
    manifest:buildPortablePluginManifest({name:"x",description:"x"}),
    skills:[{id:"x/y",name:"y",materialized:false}]
  }));
});

test("export includes portable and Codex manifests plus notices", () => {
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),"plugin-export-"));
  const out=path.join(temp,"out");
  const skill=skillFixture(temp);
  const result=exportPortablePlugin({
    outputDir:out,
    manifest:buildPortablePluginManifest({name:"example-plugin",description:"Example"}),
    skills:[skill]
  });
  assert.equal(result.skillCount,1);
  assert.ok(fs.existsSync(path.join(out,"plugin.json")));
  assert.ok(fs.existsSync(path.join(out,".codex-plugin","plugin.json")));
  assert.ok(fs.readFileSync(path.join(out,"THIRD-PARTY-NOTICES.md"),"utf8").includes("Apache-2.0"));
  assert.ok(fs.existsSync(path.join(out,"skills","example","SKILL.md")));
});
