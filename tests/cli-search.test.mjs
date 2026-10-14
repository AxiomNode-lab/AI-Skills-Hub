import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
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


test("CLI --ai-rerank reorders lexical matches through an explicitly configured endpoint", () => {
  const query = "frontend";
  const baseline = JSON.parse(search(query, "--limit", "5", "--json"));
  assert.ok(baseline.length > 1, "fixture query returns multiple local matches");

  const prelude = `globalThis.fetch = async (_url, init) => {
    const request = JSON.parse(init.body);
    const prompt = request.messages.find(message => message.role === "user").content;
    const marker = "Candidates:";
    const candidates = JSON.parse(prompt.slice(prompt.indexOf(marker) + marker.length));
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(candidates.map(candidate => candidate.id).reverse()) } }] }) };
  };`;
  const preloadUrl = "data:text/javascript," + encodeURIComponent(prelude);
  const env = {
    ...process.env,
    SKILLS_HUB_NO_UPDATE_CHECK: "1",
    SKILLS_HUB_RERANK_BASE_URL: "http://127.0.0.1:11434/v1",
    SKILLS_HUB_RERANK_MODEL: "test-model"
  };
  const reranked = spawnSync(process.execPath, ["--import", preloadUrl, cli, "search", query, "--limit", "5", "--ai-rerank", "--json"], {
    cwd, env, encoding: "utf8"
  });
  assert.equal(reranked.status, 0, reranked.stdout + reranked.stderr);
  assert.deepEqual(JSON.parse(reranked.stdout).map(item => item.id), baseline.map(item => item.id).reverse());
});

test("CLI --ai-rerank requires an explicit endpoint and model", () => {
  const result = spawnSync(process.execPath, ["--import", offline, cli, "search", "frontend", "--ai-rerank", "--json"], {
    cwd, encoding: "utf8", env: { ...process.env, SKILLS_HUB_NO_UPDATE_CHECK: "1" }
  });
  assert.equal(result.status, 2);
  const output = JSON.parse(result.stdout);
  assert.equal(output.usage_error, true);
  assert.match(output.error, /SKILLS_HUB_RERANK_BASE_URL/);
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
