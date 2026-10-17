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
    assert.equal(search(query,...options).trim(),`No skills match "${query}". Try a broader word, or 'skills-hub available' for everything installable.`);
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
    const installable=results.filter(x=>x.hub_status.availability.status==="eligible");
    assert.ok(output.startsWith(`${results.length} results for "${query}" (${installable.length} installable)`));
    // Installable results first, each group in relevance order.
    const listed=[...output.matchAll(/^  (\S+\/\S+)  /gm)].map(x=>x[1]);
    assert.deepEqual(listed,[...installable,...results.filter(x=>!installable.includes(x))].map(x=>x.id));
  }
});

test("search matches words, not substrings, and ignores punctuation inside a word",()=>{
  const ids=(q)=>JSON.parse(search(q,"--json","--limit","200")).map(x=>x.id);
  assert.deepEqual(ids("next.js"),ids("nextjs"));
  assert.ok(ids("nextjs").length>0);
  // "react" must not match "reactive" or "Reactor"-only entries.
  for (const item of JSON.parse(search("react","--json","--limit","200"))) {
    assert.match([item.id,item.name,item.publisher,item.description,...(item.category??[]),...(item.tags??[])].join(" "),/\breact\b/i,item.id);
  }
  // Inflections still match: "deploy" finds deployment skills.
  assert.ok(ids("deploy").some(id=>/deployment/.test(id)));
});

test("blocked entries and entries without a description rank below the rest",()=>{
  const results=JSON.parse(search("react","--json","--limit","200"));
  const firstBlocked=results.findIndex(x=>x.distribution==="blocked");
  assert.ok(firstBlocked>0);
  assert.ok(results.slice(firstBlocked).every(x=>x.distribution==="blocked"||!x.description||x._score<=results[firstBlocked]._score));
});
