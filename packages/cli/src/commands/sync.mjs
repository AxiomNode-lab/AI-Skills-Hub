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
        // Fast-forward only, over https/ssh only; the working copy is never merged or reset.
        execFileSync("git", ["pull", "--ff-only", "--no-recurse-submodules"], {
          cwd: capPath,
          stdio: "inherit",
          env: { ...process.env, GIT_ALLOW_PROTOCOL: "https:ssh", GIT_TERMINAL_PROMPT: "0" }
        });
        syncCount += 1;
      } catch {
        console.error(`Failed to sync ${entry.name}; repository left unchanged.`);
        process.exitCode = 1;
      }
    }

    console.log(
      syncCount === 0
        ? "No Git-linked capabilities found in capabilities-library/."
        : `Successfully synced ${syncCount} capabilities.`
    );
  } catch (error) {
    if (error?.code === "ENOENT") {
      console.log("No Git-linked capabilities found in capabilities-library/.");
      return;
    }
    console.error(`Failed to read capabilities cache: ${error.message}`);
    process.exitCode = 1;
  }
}
