import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const runner = fileURLToPath(new URL("../scripts/run-tests.mjs", import.meta.url));
function fixture(t, files = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "hub test runner "));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(cwd, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return spawnSync(process.execPath, [runner], { cwd, env, encoding: "utf8" });
}

test("test runner rejects discovery with no test files", t => {
  const result = fixture(t, { "tests/README.md": "No tests here" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /No test files found/);
});

test("test runner discovers nested tests in both roots and supports spaces in paths", t => {
  const result = fixture(t, {
    "tests/nested/one.test.mjs": "import test from 'node:test'; test('one', () => {});",
    "packages/example/src/two.test.mjs": "import test from 'node:test'; test('two', () => {});",
    "packages/example/node_modules/ignored.test.mjs": "throw new Error('must not run dependencies');"
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Running 2 test files/);
  assert.match(result.stdout, /^# tests 2$/m);
  assert.match(result.stdout, /^# pass 2$/m);
});

test("test runner propagates failed test results", t => {
  const result = fixture(t, {
    "tests/fail.test.mjs": "import test from 'node:test'; test('failure', () => { throw new Error('expected failure'); });"
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /^# fail 1$/m);
});

test("test runner rejects an entirely skipped suite", t => {
  const result = fixture(t, {
    "tests/skip.test.mjs": "import test from 'node:test'; test.skip('skipped', () => {});"
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /^# skipped 1$/m);
  assert.match(result.stderr, /No passing tests executed/);
});
