import fs from 'node:fs';
import path from 'node:path';

const repos = [
  { dir: 'nexu-io-open-design', name: 'Open Design', desc: 'Design systems and workflows for AI.' },
  { dir: 'composiohq-awesome-claude-skills', name: 'Awesome Claude Skills', desc: 'A curated list of awesome Claude skills and prompts.' },
  { dir: 'tt-a1i-archify', name: 'Archify', desc: 'Architecture tools for AI.' },
  { dir: 'hesreallyhim-awesome-claude-code', name: 'Awesome Claude Code', desc: 'Curated list for Claude Code.' },
  { dir: 'voltagent-awesome-openclaw-skills', name: 'Awesome OpenClaw Skills', desc: 'Awesome skills for OpenClaw agents.' }
];

const libDir = path.resolve(process.cwd(), 'capabilities-library', 'agent-skills');

for (const repo of repos) {
  const capPath = path.join(libDir, repo.dir);
  if (fs.existsSync(capPath)) {
    const manifest = {
      id: repo.dir,
      name: repo.name,
      type: "skill",
      description: repo.desc,
      distribution: "source-direct",
      dependencies: []
    };
    fs.writeFileSync(path.join(capPath, 'manifest.json'), JSON.stringify(manifest, null, 2));
  }
}
console.log("New submodule manifests created.");
