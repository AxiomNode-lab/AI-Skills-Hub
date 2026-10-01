import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function cacheKey(parts) {
  return crypto.createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

export function readCache(dir,key,ttlMs=300000) {
  const file=path.join(dir,key+".json");
  if(!fs.existsSync(file)) return null;
  try {
    const value=JSON.parse(fs.readFileSync(file,"utf8"));
    if(Date.now()-value.cachedAt>ttlMs) return null;
    return value.data;
  } catch {
    return null;
  }
}

export function writeCache(dir,key,data) {
  fs.mkdirSync(dir,{recursive:true});
  const file=path.join(dir,key+".json");
  fs.writeFileSync(file,JSON.stringify({cachedAt:Date.now(),data})+"\n",{mode:0o600});
  return file;
}
