import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cwd=fileURLToPath(new URL("../",import.meta.url));
const cli=fileURLToPath(new URL("../packages/cli/bin/skills-hub.mjs",import.meta.url));
// Keep the CLI's best-effort update check offline and stdout deterministic.
const offline="data:text/javascript,globalThis.fetch=async()=>{throw new Error('offline test')};";
const search=(query,...options)=>execFileSync(process.execPath,["--import",offline,cli,"search",query,...options],{cwd,encoding:"utf8"});

test("CLI unmatched search preserves normal and JSON output with and without --agent",()=>{
  const query="zzzz-no-such-capability-93821";
  for (const options of [[],["--agent","codex"]]) {
    assert.equal(search(query,...options).trim(),`No capabilities found matching "${query}".`);
    assert.deepEqual(JSON.parse(search(query,...options,"--json")),[]);
  }
});

test("CLI matching search preserves result fields, order, and agent compatibility",()=>{
  const query="brainstorming";
  for (const options of [[],["--agent","codex"]]) {
    const results=JSON.parse(search(query,...options,"--json"));
    assert.ok(results.length>0);
    assert.ok(results.some(x=>x.name===query));
    for (const [i,item] of results.entries()) {
      assert.equal(typeof item._score,"number");
      assert.ok(i===0 || results[i-1]._score>=item._score);
      assert.ok([item.id,item.name,item.publisher,item.description,...(item.category??[]),...(item.tags??[])].join(" ").toLowerCase().includes(query));
      if (options.length) assert.ok(item.compatibility.includes("codex"));
    }
    const output=search(query,...options);
    assert.ok(output.startsWith(`Found ${results.length} capabilities:`));
    assert.deepEqual([...output.matchAll(/^ID: (.+)$/gm)].map(x=>x[1]),results.map(x=>x.id));
    for (const label of ["Name","Type","Distribution","Release","Security","Description"]) {
      assert.ok(output.includes(`${label}: `),label);
    }
  }
});
