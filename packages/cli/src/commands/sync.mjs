import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

export async function syncCommand() {
  console.log("🔄 Syncing capabilities with their remote Git repositories...");

  const libDir = path.resolve(process.cwd(), "capabilities-library");
  
  try {
    const entries = await fs.readdir(libDir, { withFileTypes: true });
    let syncCount = 0;

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const capPath = path.join(libDir, entry.name);
        const gitDir = path.join(capPath, ".git");
        
        try {
          await fs.access(gitDir);
          // It's a git repo
          console.log(`\n⬇️  Syncing ${entry.name}...`);
          try {
            execSync(`git pull`, { cwd: capPath, stdio: 'inherit' });
            syncCount++;
          } catch (e) {
            console.error(`⚠️ Failed to sync ${entry.name}. Skipping.`);
          }
        } catch {
          // Not a git repo, skip
        }
      }
    }

    if (syncCount === 0) {
      console.log("\nℹ️ No Git-linked capabilities found in your library.");
    } else {
      console.log(`\n✅ Successfully synced ${syncCount} capabilities!`);
      console.log(`Note: To apply these updates to your agents, run the 'skills-hub' interactive installer again.`);
    }

  } catch (error) {
    console.error(`❌ Failed to read capabilities library:`, error.message);
  }
}
