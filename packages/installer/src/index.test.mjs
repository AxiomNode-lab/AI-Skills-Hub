import test from "node:test";
import assert from "node:assert/strict";
import { buildInstallPlan } from "./index.mjs";

const skill = (distribution, materialized = false) => ({
  id: "example/" + distribution,
  name: "example",
  distribution,
  materialized,
  compatibility: ["agent-skills", "codex", "claude-code"],
  license: { spdx:"MIT", redistributable:true, status:"verified" },
  source: {
    repo:"example/repo",
    path:"skills/example",
    revision:"0".repeat(40)
  },
  security: { scan_status: materialized ? "verified" : "pending", risk:"none" },
  release: distribution === "bundled"
    ? { status: materialized ? "eligible" : "pending" }
    : { status:"hold" }
});

test("blocked skill never becomes executable", () => {
  const [item] = buildInstallPlan([skill("blocked")], "codex");
  assert.equal(item.action, "blocked");
  assert.equal(item.command, null);
});

test("source-direct always uses upstream bridge", () => {
  const [item] = buildInstallPlan([skill("source-direct", false)], "claude-code");
  assert.equal(item.action, "source-direct");
  assert.match(item.command, /npx skills add/);
});

test("review-required is held by default", () => {
  const [item] = buildInstallPlan([skill("review-required")], "codex");
  assert.equal(item.action, "hold");
  assert.equal(item.command, null);
});

test("unreleased bundled skill cannot bypass release gates", () => {
  const [item] = buildInstallPlan([skill("bundled", false)], "codex");
  assert.equal(item.action, "hold");
  assert.equal(item.reason, "bundle_not_released");
});

test("materialized eligible bundle installs from registry", () => {
  const [item] = buildInstallPlan([skill("bundled", true)], "codex");
  assert.equal(item.action, "install");
  assert.match(item.command, /install-from-registry/);
});

test("review override uses the upstream source bridge", () => {
  const [item] = buildInstallPlan([skill("review-required")], "codex", {allowReview:true});
  assert.equal(item.action, "source-direct");
  assert.match(item.command, /npx skills add/);
});
