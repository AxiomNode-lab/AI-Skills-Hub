import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function stateRoot(scope="project", cwd=process.cwd()) {
  return scope === "user"
    ? path.join(os.homedir(), ".ai-skills-hub")
    : path.join(cwd, ".ai-skills-hub");
}

export function stateFile(scope="project", cwd=process.cwd()) {
  return path.join(stateRoot(scope, cwd), "installed.json");
}

function hashFile(file) {
  return "sha256:" + crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function walk(root) {
  const files = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.name === "installed.json") continue;
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) files.push(full);
    }
  };
  if (fs.existsSync(root)) visit(root);
  return files.sort();
}

export function buildInstallRecord(skill, destination, { agent, scope }) {
  const root = path.resolve(destination);
  return {
    schema_version: "0.1",
    skill_id: skill.id,
    name: skill.name,
    agent,
    scope,
    source: {
      repo: skill.source.repo,
      path: skill.source.path,
      revision: skill.source.revision
    },
    installed_at: new Date().toISOString(),
    destination: root,
    files: walk(root).map((full) => ({
      path: path.relative(root, full).split(path.sep).join("/"),
      sha256: hashFile(full),
      bytes: fs.statSync(full).size
    }))
  };
}

export function writeInstallRecord(record, cwd=process.cwd()) {
  const file = stateFile(record.scope, cwd);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const data = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf8"))
    : { schema_version: "0.1", installed: {} };
  data.installed[record.skill_id] = record;
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}

export function readInstallRecords(scope="project", cwd=process.cwd()) {
  const file = stateFile(scope, cwd);
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, "utf8")).installed ?? {};
}

export function removeInstallRecord(skillId, scope="project", cwd=process.cwd()) {
  const file = stateFile(scope, cwd);
  if (!fs.existsSync(file)) return;
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  delete data.installed[skillId];
  if (Object.keys(data.installed).length === 0) {
    fs.rmSync(file, { force: true });
    try { fs.rmdirSync(path.dirname(file)); } catch {}
    return;
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}

export function verifyInstallRecord(record) {
  const root = path.resolve(record.destination);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    return { ok: false, reason: "destination_missing", skill_id: record.skill_id };
  }

  const expected = new Map((record.files ?? []).map((file) => [file.path, file]));
  const actual = new Map(
    walk(root).map((full) => {
      const relative = path.relative(root, full).split(path.sep).join("/");
      return [relative, { sha256: hashFile(full), bytes: fs.statSync(full).size }];
    })
  );

  if (expected.size !== actual.size) {
    return { ok: false, reason: "file_count_changed", skill_id: record.skill_id };
  }

  for (const [relative, expectedFile] of expected) {
    const observed = actual.get(relative);
    if (!observed) {
      return { ok: false, reason: "file_missing", skill_id: record.skill_id, path: relative };
    }
    if (observed.sha256 !== expectedFile.sha256) {
      return { ok: false, reason: "file_hash_changed", skill_id: record.skill_id, path: relative };
    }
    if (observed.bytes !== expectedFile.bytes) {
      return { ok: false, reason: "file_size_changed", skill_id: record.skill_id, path: relative };
    }
  }

  return { ok: true, skill_id: record.skill_id };
}
