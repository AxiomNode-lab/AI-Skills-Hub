import test from "node:test";
import assert from "node:assert/strict";
import { checkPrerequisites, isExecutableAvailable } from "../packages/cli/src/utils.mjs";
import { assertSafeExternalPlan } from "../packages/cli/src/install-executor.mjs";

test("prerequisite detection uses PATH instead of a shell builtin", () => {
  assert.equal(isExecutableAvailable(process.execPath), true);
  const result = checkPrerequisites([process.execPath, "__definitely_missing_ai_skills_hub_binary__"]);
  assert.equal(result.missing.includes("__definitely_missing_ai_skills_hub_binary__"), true);
  assert.equal(result.missing.includes(process.execPath), false);
});

test("external installation plans reject untrusted executables", () => {
  assert.throws(
    () => assertSafeExternalPlan({
      adapter: "skills-cli",
      argv: ["sh", "-c", "echo compromised"]
    }, "codex"),
    /not allowlisted|Invalid skills CLI/
  );
});

test("skills CLI plans require HTTPS and the requested agent", () => {
  assert.doesNotThrow(
    () => assertSafeExternalPlan({
      adapter: "skills-cli",
      argv: [
        "npx", "--yes", "skills", "add",
        "https://github.com/example/repository",
        "--skill", "demo-skill",
        "--agent", "codex", "-y"
      ]
    }, "codex")
  );

  assert.throws(
    () => assertSafeExternalPlan({
      adapter: "skills-cli",
      argv: [
        "npx", "--yes", "skills", "add",
        "http://evil.example/repository",
        "--skill", "demo-skill",
        "--agent", "codex", "-y"
      ]
    }, "codex"),
    /Invalid skills CLI installation plan/
  );
});
