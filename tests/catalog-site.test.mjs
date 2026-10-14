import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const script = path.join(root, "scripts/build-catalog-site.mjs");

test("catalog site build emits compact search data, SEO pages, and a complete sitemap", t => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "ai-skills-hub-site-"));
  t.after(() => fs.rmSync(out, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [script, "--out", out, "--base-url", "https://example.test/catalog/"], {
    cwd: root, encoding: "utf8", timeout: 120_000
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Built AI Skills Hub site:/);

  const raw = JSON.parse(fs.readFileSync(path.join(root, "catalog/skills.json"), "utf8"));
  const compact = JSON.parse(fs.readFileSync(path.join(out, "catalog.json"), "utf8"));
  const eligible = raw.skills.filter(skill => skill.distribution === "bundled" && skill.materialized === true && skill.release?.status === "eligible");
  assert.equal(compact.total, raw.skills.length);
  assert.equal(compact.eligibleCount, eligible.length);
  assert.equal(compact.skills.length, raw.skills.length);
  assert.ok(compact.skills.every(skill => !("securityFindings" in skill) && !("materialized_root" in skill)));

  const pages = fs.readdirSync(path.join(out, "skills")).filter(name => name.endsWith(".html"));
  assert.equal(pages.length, eligible.length);
  const sitemap = fs.readFileSync(path.join(out, "sitemap.xml"), "utf8");
  assert.ok(sitemap.includes("https://example.test/catalog/"));
  assert.ok(sitemap.includes("/skills/"));
  assert.ok(fs.existsSync(path.join(out, "robots.txt")));
  assert.ok(fs.existsSync(path.join(out, "404.html")));
  assert.ok(fs.existsSync(path.join(out, "assets", "app.js")));
  assert.ok(fs.existsSync(path.join(out, "assets", "detail.js")));
  const home = fs.readFileSync(path.join(out, "index.html"), "utf8");
  const app = fs.readFileSync(path.join(out, "assets", "app.js"), "utf8");
  assert.match(home, /id="share-search"/);
  assert.match(app, /URLSearchParams/);
  assert.match(app, /navigator\.clipboard\.writeText/);

  const first = compact.skills.find(skill => skill.releaseStatus === "eligible");
  assert.ok(first?.pageUrl);
  assert.ok(fs.existsSync(path.join(out, first.pageUrl.replace("./", ""))));
  const detail = fs.readFileSync(path.join(out, first.pageUrl.replace("./", "")), "utf8");
  assert.match(detail, /Install from a source checkout/);
  assert.match(detail, /Copy install command/);
  assert.doesNotMatch(detail, /private-user-images|BEGIN PRIVATE KEY/);
});

