import fs from "node:fs";

const registry=JSON.parse(fs.readFileSync("catalog/skills.json","utf8"));
const groups=new Map();

for(const skill of registry.skills){
  const key=skill.name.toLowerCase();
  const list=groups.get(key)??[];
  list.push(skill);
  groups.set(key,list);
}

const collisions=[...groups.entries()]
  .filter(([,items])=>items.length>1)
  .map(([name,items])=>({
    name,
    candidates:items.map(s=>({
      id:s.id,
      publisher:s.publisher,
      source:s.source.repo,
      distribution:s.distribution
    }))
  }))
  .sort((x,y)=>x.name.localeCompare(y.name));

const report={
  schema_version:"0.1",
  generated_at:"deterministic-from-registry",
  total_skills:registry.skills.length,
  unique_names:groups.size,
  name_collisions:collisions
};

fs.mkdirSync("catalog/reports",{recursive:true});
fs.writeFileSync("catalog/reports/dedupe.json",JSON.stringify(report,null,2)+"\n");
console.log("Dedupe report:",collisions.length,"name collisions");
