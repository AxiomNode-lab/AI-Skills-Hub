import { searchRegistry } from "@ai-skills-hub/discovery";
import { rerankWithModel } from "@ai-skills-hub/discovery/rerank";
import { isInstallable, loadRegistry } from "@ai-skills-hub/core";
import { UsageError } from "../errors.mjs";
import { statusReader, printCapabilityStatus } from "../capability-status.mjs";
import { paint } from "../ui.mjs";

export async function searchCommand(query, options = {}) {
  const registry = loadRegistry();

  const readStatus = statusReader(options);
  // Narrow the pool before ranking so the limit applies to installable matches.
  const pool = options.installable
    ? { ...registry, skills: registry.skills.filter(isInstallable) }
    : registry;
  const lexical = searchRegistry(pool, query || "", {
    agent: options.agent || undefined,
    limit: options.limit || 50
  });
  let ranked = lexical;

  if (options.aiRerank) {
    const baseUrl = process.env.SKILLS_HUB_RERANK_BASE_URL;
    const model = process.env.SKILLS_HUB_RERANK_MODEL;
    if (!baseUrl || !model) {
      throw new UsageError("--ai-rerank requires SKILLS_HUB_RERANK_BASE_URL and SKILLS_HUB_RERANK_MODEL; configure an OpenAI-compatible endpoint first");
    }
    try {
      ranked = await rerankWithModel(lexical, query || "", {
        baseUrl,
        model,
        apiKey: process.env.SKILLS_HUB_RERANK_API_KEY || ""
      });
    } catch (error) {
      // Search should remain useful during provider outages or local-model startup.
      console.error(`AI reranking failed; using keyword ranking: ${error.message}`);
    }
  }

  const results = ranked.map(({ item, score }) => ({ ...item, _score: score, hub_status: readStatus(item) }));

  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  if (results.length === 0) {
    console.log(`No capabilities found matching "${query || ""}".`);
    return;
  }

  console.log(`Found ${results.length} capabilities${options.aiRerank ? " (AI reranking requested)" : ""}:\n`);
  for (const cap of results) {
    console.log(`ID: ${paint("bold", cap.id)}`);
    console.log(`Name: ${cap.name}`);
    printCapabilityStatus(cap.hub_status);
    console.log(`Type: ${cap.artifact_type || cap.type || "skill"}`);
    console.log(`Distribution: ${cap.distribution}`);
    console.log(`Release: ${cap.release?.status || "unknown"}`);
    console.log(`Security: ${cap.security?.risk || "unknown"} / ${cap.security?.scan_status || "unknown"}`);
    console.log(`Description: ${cap.description || "N/A"}`);
    console.log("------------------------------------------");
  }
}
