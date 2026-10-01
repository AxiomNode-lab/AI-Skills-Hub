import { readLocalCapabilities, fileExists } from '../utils.mjs';
import fs from "node:fs/promises";
import path from "node:path";

export async function infoCommand(id, options) {
  if (!id) {
    console.error("Error: Capability ID is required.");
    return;
  }

  const allCapabilities = await readLocalCapabilities();
  const cap = allCapabilities.find(c => c.id === id);

  if (!cap) {
    console.error(`Error: Capability '${id}' not found.`);
    return;
  }

  // Fetch SKILL.md content if it's a skill
  if (cap.type === 'skill') {
    const skillPath = path.join(cap.materialized_root, "SKILL.md");
    if (await fileExists(skillPath)) {
      cap.skill_content = await fs.readFile(skillPath, "utf8");
    }
  }

  if (options.json) {
    console.log(JSON.stringify(cap, null, 2));
    return;
  }

  console.log(`==========================================`);
  console.log(` ID:          ${cap.id}`);
  console.log(` Name:        ${cap.name}`);
  console.log(` Type:        ${cap.type}`);
  console.log(` Description: ${cap.description || 'N/A'}`);
  console.log(` Path:        ${cap.materialized_root}`);
  if (cap.dependencies?.length) {
    console.log(` Dependencies: ${cap.dependencies.join(', ')}`);
  }
  console.log(`==========================================`);

  if (cap.skill_content) {
    console.log(`\n--- SKILL.md Content ---\n`);
    console.log(cap.skill_content);
    console.log(`\n------------------------\n`);
  }
}
