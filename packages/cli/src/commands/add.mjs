import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

export async function addCommand(url) {
  if (!url) {
    console.error("❌ Error: You must provide a Git URL.");
    console.log("Usage: skills-hub add <git-url>");
    return;
  }

  console.log(`📥 Fetching capability from ${url}...`);

  try {
    // Extract repo name from URL
    const repoName = url.split('/').pop().replace('.git', '');
    if (!repoName) throw new Error("Invalid URL format");

    const libDir = path.resolve(process.cwd(), "capabilities-library");
    await fs.mkdir(libDir, { recursive: true });

    const targetDir = path.join(libDir, repoName);
    
    try {
      await fs.access(targetDir);
      console.error(`❌ Error: A capability named '${repoName}' already exists at ${targetDir}`);
      console.log("Use 'skills-hub sync' to update it instead.");
      return;
    } catch {
      // Doesn't exist, proceed
    }

    console.log(`Cloning into ${targetDir}...`);
    try {
      execSync(`git clone ${url} ${targetDir}`, { stdio: 'inherit' });
    } catch (e) {
      console.error(`❌ Failed to clone repository. Cleaning up...`);
      await fs.rm(targetDir, { recursive: true, force: true });
      return;
    }

    console.log(`\n✅ Successfully added ${repoName} to your capabilities library!`);
    console.log(`Run 'skills-hub' to install it to your agents.`);

  } catch (error) {
    console.error(`❌ Failed to add capability:`, error.message);
  }
}
