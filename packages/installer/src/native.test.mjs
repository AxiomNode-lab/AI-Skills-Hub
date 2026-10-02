import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveInstallRoot, normalizeSkillDirectory } from "./targets.mjs";
import { installMaterializedSkill } from "./native.mjs";

test("codex prefers portable .agents/skills project root", () => {
  const cwd=path.join(os.tmpdir(),"project");
  assert.equal(resolveInstallRoot("codex","project",cwd),path.join(cwd,".agents","skills"));
});

test("cursor prefers portable .agents/skills project root", () => {
  const cwd=path.join(os.tmpdir(),"project");
  assert.equal(resolveInstallRoot("cursor","project",cwd),path.join(cwd,".agents","skills"));
});

test("invalid skill names are refused", () => {
  assert.throws(() => normalizeSkillDirectory("/tmp/.agents/skills","../escape"));
});

test("native install copies a materialized skill into the agent root", () => {
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),"ai-skills-hub-"));
  const src=path.join(temp,"source","example-skill");
  fs.mkdirSync(src,{recursive:true});
  fs.writeFileSync(path.join(src,"SKILL.md"),"---\nname: example-skill\ndescription: Example skill.\n---\n");
  const skill={
    id:"test/example",
    name:"example-skill",
    distribution:"bundled",
    materialized:true,
    materialized_root:src,
    release:{status:"eligible"},
    license:{spdx:"MIT",redistributable:true,status:"verified"},
    source:{repo:"test/repo",path:"skills/example-skill",revision:"0000000000000000000000000000000000000000"},
    security:{scan_status:"verified",risk:"none"}
  };
  const result=installMaterializedSkill(skill,{cwd:temp,agent:"codex"});
  assert.equal(result.action,"installed");
  assert.ok(fs.existsSync(path.join(temp,".agents","skills","example-skill","SKILL.md")));
});
