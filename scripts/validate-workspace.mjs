import fs from "node:fs";
import path from "node:path";

const roots=["apps","packages"];
const packageFiles=[];
for(const root of roots){
  const dir=path.resolve(root);
  if(!fs.existsSync(dir)) continue;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(!entry.isDirectory()) continue;
    const file=path.join(dir,entry.name,"package.json");
    if(fs.existsSync(file)) packageFiles.push(file);
  }
}

const errors=[];
const names=new Map();

for(const file of packageFiles){
  let pkg;
  try{ pkg=JSON.parse(fs.readFileSync(file,"utf8")); }
  catch(error){ errors.push(`${file}: invalid package.json: ${error.message}`); continue; }

  if(!pkg.name) errors.push(`${file}: missing package name`);
  else {
    if(names.has(pkg.name)) errors.push(`duplicate workspace package name: ${pkg.name} (${names.get(pkg.name)} and ${file})`);
    names.set(pkg.name,file);
  }

  const packageDir=path.dirname(file);
  for(const [key,value] of Object.entries(pkg.exports??{})){
    if(typeof value!=="string") continue;
    const target=path.resolve(packageDir,value);
    if(!fs.existsSync(target)) errors.push(`${pkg.name}: export ${key} points to missing file ${value}`);
  }

  if(typeof pkg.bin==="string"){
    if(!fs.existsSync(path.resolve(packageDir,pkg.bin))) errors.push(`${pkg.name}: bin target missing: ${pkg.bin}`);
  }else if(pkg.bin&&typeof pkg.bin==="object"){
    for(const [bin,target] of Object.entries(pkg.bin)){
      if(typeof target==="string"&&!fs.existsSync(path.resolve(packageDir,target))) errors.push(`${pkg.name}: bin ${bin} target missing: ${target}`);
    }
  }

  if(pkg.private===false && !pkg.license) errors.push(`${pkg.name}: publishable package must declare a license`);
}

const rootPkg=JSON.parse(fs.readFileSync("package.json","utf8"));
if(rootPkg.packageManager!=="pnpm@10.4.1") errors.push("root packageManager must stay pinned to pnpm@10.4.1");

if(errors.length){
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("Workspace valid:",packageFiles.length,"packages;",names.size,"unique package names");
