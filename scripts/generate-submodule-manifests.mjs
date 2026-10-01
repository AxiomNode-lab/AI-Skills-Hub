import fs from 'node:fs';
import path from 'node:path';

const repos = [
  { dir: 'blader-humanizer', name: 'Humanizer Skill', desc: 'A skill to make AI output more human-like.' },
  { dir: 'msitarzewski-agency-agents', name: 'Agency Agents', desc: 'Framework for agency-based agents.' },
  { dir: 'addyosmani-agent-skills', name: 'Agent Skills Collection', desc: 'Collection of useful skills for AI agents by Addy Osmani.' },
  { dir: 'agricidaniel-claude-seo', name: 'Claude SEO', desc: 'SEO analysis and optimization skills for Claude.' },
  { dir: 'alirezarezvani-claude-skills', name: 'Claude Advanced Skills', desc: 'Advanced prompt and tool skills for Claude.' }
];

const libDir = path.resolve(process.cwd(), 'capabilities-library');

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
console.log("Submodule manifests created.");
