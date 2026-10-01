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
    distribution:"bundled",
    release:{status:"eligible"},
    security:{scan_status:"verified",risk:"none"},
    license:{spdx:"Apache-2.0",redistributable:true,status:"verified"},
    source:{repo:"example/repo",path:"skills/example",revision:"a".repeat(40)}
  };
};

test("portable manifest contains only Agent Plugins core fields", () => {
  const m=buildPortablePluginManifest({
    name:"example-plugin",
    description:"Example plugin",
    repository:"https://example.test/repo"
  });
  assert.equal("$schema" in m,true);
  assert.equal(m.name,"example-plugin");
  assert.equal("skills" in m,false);
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

test("portable export uses fixed skills directory and notices", () => {
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),"plugin-export-"));
  const out=path.join(temp,"out");
  const skill=skillFixture(temp);
  const result=exportPortablePlugin({
    outputDir:out,
    manifest:buildPortablePluginManifest({name:"example-plugin",description:"Example"}),
    skills:[skill]
  });
  assert.equal(result.skillCount,1);
  const manifest=JSON.parse(fs.readFileSync(path.join(out,"plugin.json"),"utf8"));
  assert.equal("skills" in manifest,false);
  assert.ok(fs.existsSync(path.join(out,"skills","example","SKILL.md")));
  assert.ok(fs.existsSync(path.join(out,"THIRD-PARTY-NOTICES.md")));
  assert.match(fs.readFileSync(path.join(out,"THIRD-PARTY-NOTICES.md"),"utf8"),/Apache-2\.0/);
});


test("export rejects unverified release state even when materialized",()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),"plugin-export-"));
  const skill=skillFixture(temp);
  assert.throws(() => exportPortablePlugin({
    outputDir:path.join(temp,"out"),
    manifest:buildPortablePluginManifest({name:"example-plugin",description:"Example"}),
    skills:[{...skill,release:{status:"pending"},security:{scan_status:"verified",risk:"none"}}]
  }),/release gates/);
});

test("export accepts only release-eligible bundled artifacts",()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),"plugin-export-"));
  const skill=skillFixture(temp);
  const result=exportPortablePlugin({
    outputDir:path.join(temp,"out"),
    manifest:buildPortablePluginManifest({name:"example-plugin",description:"Example"}),
    skills:[{...skill,distribution:"bundled",release:{status:"eligible"},security:{scan_status:"verified",risk:"none"},license:{spdx:"MIT",redistributable:true,status:"verified"}}]
  });
  assert.equal(result.skillCount,1);
});
