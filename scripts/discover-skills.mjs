import fs from 'node:fs';
import path from 'node:path';

// This script searches GitHub for popular AI Agent skills and MCP servers
// and automatically appends them to our registry.json

const SEARCH_QUERIES = [
  'topic:mcp-server stars:>50',
  'topic:agent-skills stars:>50',
  'topic:claude-skills stars:>50'
];

async function discover() {
  console.log('🕵️‍♂️ Starting Auto-Discovery Bot...');
  
  const registryPath = path.resolve(process.cwd(), 'catalog', 'registry.json');
  let registry = [];
  try {
    registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  } catch(e) {
    console.error('Could not read registry.json');
    process.exit(1);
  }

  const existingUrls = new Set(registry.map(r => r.source_url).filter(Boolean));
  let addedCount = 0;

  for (const query of SEARCH_QUERIES) {
    console.log(`\n🔍 Searching GitHub for: ${query}`);
    try {
      const response = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'AI-Skills-Hub-Discovery-Bot'
        }
      });
      
      if (!response.ok) {
        console.log(`Rate limited or error: ${response.status}`);
        continue;
      }

      const data = await response.json();
      
      for (const repo of data.items || []) {
        const cloneUrl = repo.clone_url;
        if (!existingUrls.has(cloneUrl)) {
          console.log(`✨ Discovered new skill: ${repo.name} (${repo.stargazers_count} stars)`);
          
          registry.push({
            id: repo.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
            name: repo.name,
            type: repo.topics?.includes('mcp-server') ? 'mcp-server' : 'skill',
            source_url: cloneUrl,
            description: repo.description || 'Auto-discovered capability.'
          });
          
          existingUrls.add(cloneUrl);
          addedCount++;
        }
      }
    } catch(err) {
      console.error(`Failed to fetch for query ${query}:`, err.message);
    }
  }

  if (addedCount > 0) {
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
    console.log(`\n✅ Added ${addedCount} new capabilities to the registry.`);
  } else {
    console.log('\n🤷 No new capabilities found today.');
  }
}

discover();
