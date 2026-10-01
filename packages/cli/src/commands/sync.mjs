import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

export async function syncCommand() {
  console.log("🔄 Syncing installed capabilities with their remote Git repositories...");

  const os = await import('node:os');
  const cacheDir = path.resolve(process.cwd(), 'capabilities-library');
  
  try {
    const entries = await fs.readdir(cacheDir, { withFileTypes: true });
    let syncCount = 0;

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const capPath = path.join(cacheDir, entry.name);
        const gitDir = path.join(capPath, ".git");
        
        try {
          await fs.access(gitDir);
          // It's a git repo
          console.log(`\n⬇️  Syncing ${entry.name}...`);
          try {
            execFileSync("git", ["pull"], { cwd: capPath, stdio: 'inherit' });
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
      console.log("\nℹ️ No Git-linked capabilities found in your local cache.");
    } else {
      console.log(`\n✅ Successfully synced ${syncCount} capabilities!`);
      console.log(`Note: To apply these updates to your agents, run the 'skills-hub' interactive installer again.`);
    }

  } catch (error) {
    console.error(`❌ Failed to read capabilities cache:`, error.message);
  }
}
