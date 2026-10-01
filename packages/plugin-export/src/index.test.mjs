import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildPortablePluginManifest, exportPortablePlugin } from "./index.mjs";

test("portable manifest uses the Agent Plugins schema", () => {
  const m=buildPortablePluginManifest({
    name:"example-plugin",
    description:"Example plugin",
    repository:"https://example.test/repo"
  });
  assert.equal(m.skills,"./skills/");
  assert.match(m.$schema,/agent-plugins.org\/schemas\/1\.0\.0/);
});

test("export refuses unmaterialized skills", () => {
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),"plugin-export-"));
  assert.throws(() => exportPortablePlugin({
    outputDir:temp,
    manifest:buildPortablePluginManifest({name:"x",description:"x"}),
    skills:[{id:"x/y",name:"y",materialized:false}]
  }));
});

test("export copies a materialized skill", () => {
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),"plugin-export-"));
  const source=path.join(temp,"source","example");
  fs.mkdirSync(source,{recursive:true});
  fs.writeFileSync(path.join(source,"SKILL.md"),"---\nname: example\ndescription: Example.\n---\n");
  const out=path.join(temp,"out");
  const result=exportPortablePlugin({
    outputDir:out,
    manifest:buildPortablePluginManifest({name:"example-plugin",description:"Example"}),
    skills:[{id:"test/example",name:"example",materialized:true,materialized_root:source}]
  });
  assert.equal(result.skillCount,1);
  assert.ok(fs.existsSync(path.join(out,"skills","example","SKILL.md")));
});
