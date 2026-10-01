import { readLocalCapabilities } from '../utils.mjs';

export async function searchCommand(query, options) {
  const allCapabilities = await readLocalCapabilities();
  
  let results = allCapabilities;
  if (query) {
    const lowerQuery = query.toLowerCase();
    results = allCapabilities.filter(c => 
      (c.name && c.name.toLowerCase().includes(lowerQuery)) ||
      (c.description && c.description.toLowerCase().includes(lowerQuery)) ||
      (c.type && c.type.toLowerCase().includes(lowerQuery)) ||
      (c.id && c.id.toLowerCase().includes(lowerQuery))
    );
  }

  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  if (results.length === 0) {
    console.log(`No capabilities found matching "${query || ''}".`);
    return;
  }

  console.log(`Found ${results.length} capabilities:\n`);
  for (const cap of results) {
    console.log(`ID: ${cap.id}`);
    console.log(`Name: ${cap.name}`);
    console.log(`Type: ${cap.type}`);
    console.log(`Description: ${cap.description || 'N/A'}`);
    if (cap.dependencies?.length) {
      console.log(`Dependencies: ${cap.dependencies.join(', ')}`);
    }
    console.log("------------------------------------------");
  }
}
