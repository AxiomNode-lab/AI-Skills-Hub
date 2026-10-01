import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const MAX_FILE_BYTES=2*1024*1024;
const MAX_FILES=256;
const MAX_TOTAL_BYTES=20*1024*1024;

function safeRelative(p){
  const normalized=path.posix.normalize(p).replace(/^\.\//,"");
  if(!normalized || normalized.startsWith("../") || normalized.includes("/../") || normalized.startsWith("/")) throw new Error("Unsafe archive path: "+p);
  return normalized;
}

function hash(bytes){return crypto.createHash("sha256").update(bytes).digest("hex");}

export async function materializeSkill(skill,{root="vendor/skills",token,fetchImpl=fetch}={}){
  if(skill.distribution!=="bundled") throw new Error("Skill is not bundled: "+skill.id);
  if(skill.release?.status!=="eligible") throw new Error("Skill has not passed registry release gates: "+skill.id);
  if(skill.security?.scan_status!=="verified" || skill.security?.risk==="high") throw new Error("Skill has not passed security release gates: "+skill.id);
  if(!skill.license?.redistributable || skill.license?.status!=="verified") throw new Error("Skill is not redistribution-eligible: "+skill.id);
  if(!/^[0-9a-f]{40}$/.test(skill.source?.revision??"")) throw new Error("Skill has no immutable source revision: "+skill.id);

  const target=path.resolve(root,skill.name);
  fs.rmSync(target,{recursive:true,force:true});
  fs.mkdirSync(target,{recursive:true});

  const headers={"accept":"application/vnd.github+json","user-agent":"AI-Skills-Hub-materializer/0.2"};
  if(token) headers.authorization="Bearer "+token;
  const treeUrl=`https://api.github.com/repos/${skill.source.repo}/git/trees/${skill.source.revision}?recursive=1`;
  const treeRes=await fetchImpl(treeUrl,{headers});
  if(!treeRes.ok) throw new Error("GitHub tree fetch failed: "+treeRes.status);
  const tree=await treeRes.json();
  if(tree.truncated) throw new Error("GitHub tree was truncated; refusing partial materialization.");

  const prefix=skill.source.path.replace(/\/+$/,"")+"/";
  const files=tree.tree.filter(x=>x.type==="blob" && (x.path===skill.source.path+"/SKILL.md" || x.path.startsWith(prefix)));
  if(!files.length) throw new Error("No files found for "+skill.id);
  if(files.length>MAX_FILES) throw new Error("Skill exceeds file limit: "+skill.id);

  const manifest=[];
  let totalBytes=0;
  for(const item of files.sort((a,b)=>a.path.localeCompare(b.path))){
    if(item.mode==="120000") throw new Error("Symlink materialization is forbidden: "+item.path);
    if(item.type==="commit") throw new Error("Git submodule materialization is forbidden: "+item.path);
    const rel=safeRelative(item.path.slice(prefix.length));
    if(!rel || rel.includes("\0")) throw new Error("Invalid skill-relative path: "+item.path);
    const url=`https://raw.githubusercontent.com/${skill.source.repo}/${skill.source.revision}/${item.path.split("/").map(encodeURIComponent).join("/")}`;
    const res=await fetchImpl(url,{headers:{"user-agent":"AI-Skills-Hub-materializer/0.2"}});
    if(!res.ok) throw new Error("Source fetch failed "+res.status+": "+item.path);
    const bytes=Buffer.from(await res.arrayBuffer());
    if(bytes.length>MAX_FILE_BYTES) throw new Error("File exceeds size limit: "+item.path);
    totalBytes += bytes.length;
    if(totalBytes>MAX_TOTAL_BYTES) throw new Error("Skill exceeds total size limit: "+skill.id);
    const out=path.resolve(target,rel);
    if(!(out===target || out.startsWith(target+path.sep))) throw new Error("Path traversal blocked: "+item.path);
    fs.mkdirSync(path.dirname(out),{recursive:true});
    fs.writeFileSync(out,bytes,{mode: "100755"===item.mode ? 0o755 : 0o644});
    manifest.push({path:rel,sha256:hash(bytes),bytes:bytes.length,mode:(item.mode==="100755"?"100755":"100644")});
  }

  if(!manifest.some(x=>x.path==="SKILL.md")) throw new Error("Materialized skill missing root SKILL.md");
  return {skill_id:skill.id,target,source:{repo:skill.source.repo,path:skill.source.path,revision:skill.source.revision},materialized_files:manifest};
}

export function writeMaterializationManifest(result,root="catalog/materialized-manifests"){
  fs.mkdirSync(root,{recursive:true});
  const name=result.skill_id.replaceAll("/","__")+".json";
  const file=path.join(root,name);
  fs.writeFileSync(file,JSON.stringify(result,null,2)+"\n");
  return file;
}
