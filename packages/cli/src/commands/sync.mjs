import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

export async function syncCommand() {
  const cacheDir = path.resolve(process.cwd(), "capabilities-library");

  try {
    const entries = await fs.readdir(cacheDir, { withFileTypes: true });
    let syncCount = 0;

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const capPath = path.join(cacheDir, entry.name);
      const gitDir = path.join(capPath, ".git");

      try {
        await fs.access(gitDir);
      } catch {
        continue;
      }

      console.log(`Syncing ${entry.name}...`);
      try {
        execFileSync("git", ["pull", "--ff-only"], {
          cwd: capPath,
          stdio: "inherit"
        });
        syncCount += 1;
      } catch {
        console.error(`Failed to sync ${entry.name}; repository left unchanged.`);
      }
    }

    console.log(
      syncCount === 0
        ? "No Git-linked capabilities found in capabilities-library/."
        : `Successfully synced ${syncCount} capabilities.`
    );
  } catch (error) {
    console.error(`Failed to read capabilities cache: ${error.message}`);
  }
}
