import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const MAX_STATE_BYTES = 2 * 1024 * 1024;

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
      if (entry.isSymbolicLink()) {
        throw new Error("symlink_detected:" + path.relative(root, full).split(path.sep).join("/"));
      }
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) files.push(full);
      else throw new Error("unsupported_entry:" + path.relative(root, full));
    }
  };
  if (fs.existsSync(root)) visit(root);
  return files.sort();
}

export function buildInstallRecord(skill, destination, { agent, scope }) {
  const root = path.resolve(destination);
  return {
    schema_version: "0.2",
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

function atomicWrite(file, body) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (Buffer.byteLength(body) > MAX_STATE_BYTES) throw new Error("installation state is too large");
  const temp = file + ".tmp-" + process.pid + "-" + crypto.randomBytes(6).toString("hex");
  fs.writeFileSync(temp, body, { mode: 0o600 });
  fs.renameSync(temp, file);
}

function assertStateFileSafe(file, scope="project") {
  // A project's .ai-skills-hub folder comes with the checkout, so a planted
  // link there would redirect state reads, writes and removal elsewhere.
  if (scope !== "user") {
    try {
      if (fs.lstatSync(path.dirname(file)).isSymbolicLink()) throw new Error("installation state folder cannot be a symbolic link");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  if (!fs.existsSync(file)) return;
  if (fs.lstatSync(file).isSymbolicLink()) {
    throw new Error("installation state file cannot be a symbolic link");
  }
  if (!fs.statSync(file).isFile()) {
    throw new Error("installation state file must be a regular file");
  }
}

export function writeInstallRecord(record, cwd=process.cwd()) {
  const file = stateFile(record.scope, cwd);
  assertStateFileSafe(file, record.scope);
  const data = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf8"))
    : { schema_version: "0.2", installed: {}, history: [] };

  data.schema_version = "0.2";
  data.history = Array.isArray(data.history) ? data.history : [];

  data.installed = normalizeInstalled(data.installed);
  const key = recordKey(record.skill_id, record.agent);
  const previous = data.installed[key];
  if (previous && previous.destination === record.destination) {
    data.history.push({
      skill_id: record.skill_id,
      agent: record.agent ?? null,
      action: "replace",
      at: new Date().toISOString(),
      previous_revision: previous.source?.revision ?? null,
      next_revision: record.source?.revision ?? null
    });
    if (data.history.length > 100) data.history = data.history.slice(-100);
  }

  data.installed[key] = record;
  atomicWrite(file, JSON.stringify(data, null, 2) + "\n");
}

// Records are keyed by skill and agent, so one skill can be installed for
// several agents in the same scope. Files written before that used the skill
// ID alone as the key; they are read the same way.
export function recordKey(skillId, agent) {
  return `${skillId}::${agent ?? "agent-skills"}`;
}

function normalizeInstalled(installed) {
  const out = {};
  for (const record of Object.values(installed ?? {})) {
    if (record && typeof record === "object" && record.skill_id) out[recordKey(record.skill_id, record.agent)] = record;
  }
  return out;
}

// The record for one skill and agent, or null.
export function findInstallRecord(records, skillId, agent) {
  return records[recordKey(skillId, agent)] ?? null;
}

// Every record of one skill in this scope (one per agent).
export function installRecordsFor(records, skillId) {
  return Object.values(records).filter((record) => record.skill_id === skillId);
}

export function readInstallRecords(scope="project", cwd=process.cwd()) {
  const file = stateFile(scope, cwd);
  assertStateFileSafe(file, scope);
  if (!fs.existsSync(file)) return {};
  const body = fs.readFileSync(file, "utf8");
  if (Buffer.byteLength(body) > MAX_STATE_BYTES) throw new Error("installation state is too large");
  const parsed = JSON.parse(body);
  return normalizeInstalled(parsed.installed);
}

export function removeInstallRecord(skillId, scope="project", cwd=process.cwd(), agent) {
  const file = stateFile(scope, cwd);
  assertStateFileSafe(file, scope);
  if (!fs.existsSync(file)) return;
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  data.installed = normalizeInstalled(data.installed);
  delete data.installed[recordKey(skillId, agent)];

  if (Object.keys(data.installed).length === 0) {
    fs.rmSync(file, { force: true });
    try { fs.rmdirSync(path.dirname(file)); } catch {}
    return;
  }

  atomicWrite(file, JSON.stringify(data, null, 2) + "\n");
}

export function verifyInstallRecord(record) {
  const root = path.resolve(record.destination);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory() || fs.lstatSync(root).isSymbolicLink()) {
    return { ok: false, reason: "destination_missing_or_symlink", skill_id: record.skill_id };
  }

  let files;
  try {
    files = walk(root);
  } catch (error) {
    return { ok: false, reason: error.message, skill_id: record.skill_id };
  }

  const expected = new Map((record.files ?? []).map((file) => [file.path, file]));
  const actual = new Map(
    files.map((full) => {
      const relative = path.relative(root, full).split(path.sep).join("/");
      return [relative, {
        sha256: hashFile(full),
        bytes: fs.statSync(full).size,
        mode: (fs.statSync(full).mode & 0o111) ? "100755" : "100644"
      }];
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
    if (expectedFile.mode && observed.mode !== expectedFile.mode) {
      return { ok: false, reason: "file_mode_changed", skill_id: record.skill_id, path: relative };
    }
  }

  return { ok: true, skill_id: record.skill_id };
}
