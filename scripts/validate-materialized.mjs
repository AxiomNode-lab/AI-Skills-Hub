#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { verifyReviewedDirectory, sha256 } from "../packages/materializer/src/reviewed.mjs";
import { parseFrontmatter as parseFields } from "../packages/core/src/index.mjs";

const root=process.cwd();
const registry=JSON.parse(fs.readFileSync(path.join(root,"catalog/skills.json"),"utf8"));
const failures=[];

function parseFrontmatter(body){
  const lines=body.split(/\r?\n/);
  if(lines[0]?.trim()!=="---") throw new Error("SKILL.md must start with YAML frontmatter");
  if(!lines.slice(1).some(line=>line.trim()==="---")) throw new Error("Unclosed YAML frontmatter");
  const result=parseFields(body);
  if(typeof result.description==="string") result.description=result.description.trim();
  return result;
}

function walkFiles(dir,base=dir){
  const out=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()) out.push(...walkFiles(full,base));
    else if(entry.isFile()) out.push({full,relative:path.relative(base,full).split(path.sep).join("/")});
    else if(entry.isSymbolicLink()) failures.push(path.relative(base,full)+": symlinks are forbidden in materialized skills");
    else failures.push(path.relative(base,full)+": unsupported filesystem entry");
  }
  return out.sort((a,b)=>a.relative.localeCompare(b.relative));
}

for(const skill of registry.skills.filter((s)=>s.materialized)){
  try{
    if(!skill.materialized_root) throw new Error("missing materialized_root");
    const rootDir=path.resolve(skill.materialized_root);
    if(!fs.existsSync(rootDir)||!fs.statSync(rootDir).isDirectory()) throw new Error("materialized root missing");

    const skillFile=path.join(rootDir,"SKILL.md");
    if(!fs.existsSync(skillFile)) throw new Error("missing SKILL.md");
    const frontmatter=parseFrontmatter(fs.readFileSync(skillFile,"utf8"));
    if(frontmatter.name!==skill.name) throw new Error("frontmatter name mismatch");
    if(!frontmatter.description) throw new Error("missing description");
    if(frontmatter.name.length>64) throw new Error("name exceeds 64 characters");
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(frontmatter.name)) throw new Error("invalid skill name");
    if(frontmatter.description.length>1024) throw new Error("description exceeds 1024 characters");
    if(path.basename(rootDir)!==frontmatter.name) throw new Error("directory name does not match frontmatter name");

    const manifestPath=path.join(root,"catalog","materialized-manifests",skill.id.replaceAll("/","__")+".json");
    if(!fs.existsSync(manifestPath)) throw new Error("missing materialization manifest");
    const manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));
    if(manifest.skill_id!==skill.id) throw new Error("manifest skill id mismatch");
    if(manifest.source?.revision!==skill.source.revision) throw new Error("manifest revision mismatch");
    if(manifest.source?.repo!==skill.source.repo || manifest.source?.path!==skill.source.path) throw new Error("manifest source mismatch");
    if(manifest.review){
      const reviewBytes=fs.readFileSync(path.resolve(manifest.review.path));
      if(sha256(reviewBytes)!==manifest.review.sha256) throw new Error("release review hash mismatch");
      if(skill.license.evidence!==manifest.review.path) throw new Error("license review reference mismatch");
      const scan=verifyReviewedDirectory(skill,JSON.parse(reviewBytes),rootDir);
      if(skill.security.risk!==scan.risk) throw new Error("reviewed risk mismatch");
      for(const [key,value] of Object.entries(scan.capabilities)){
        if(skill.security[key]!==value) throw new Error("reviewed capability mismatch: "+key);
      }
    }else if(skill.license.evidence?.startsWith("catalog/reviews/")){
      throw new Error("reviewed release is missing bound review evidence");
    }

    const files=walkFiles(rootDir);
    let totalBytes=0;
    const actual=new Map(files.map((item)=>{
      const bytes=fs.readFileSync(item.full);
      const st=fs.statSync(item.full);
      totalBytes += bytes.length;
      if(st.mode & 0o6000) throw new Error("setuid/setgid bits are forbidden: "+item.relative);
      return [item.relative,{
        sha256:"sha256:"+crypto.createHash("sha256").update(bytes).digest("hex"),
        bytes:bytes.length,
        mode:(st.mode&0o111)?"100755":"100644"
      }];
    }));

    if(totalBytes>20*1024*1024) throw new Error("materialized skill exceeds total size limit");
    if(skill.distribution!=="bundled") throw new Error("only bundled skills may be materialized");
    if(!skill.license?.redistributable || skill.license?.status!=="verified") throw new Error("materialized skill has invalid redistribution license state");
    if(skill.security?.scan_status!=="verified") throw new Error("materialized skill has no verified security scan");
    if(skill.security?.risk==="high") throw new Error("high-risk materialized skill is blocked");

    const expected=manifest.materialized_files??[];
    if(actual.size!==expected.length) throw new Error("file count mismatch");
    for(const entry of expected){
      const observed=actual.get(entry.path);
      if(!observed) throw new Error("missing file: "+entry.path);
      if(observed.sha256!=="sha256:"+entry.sha256) throw new Error("sha256 mismatch: "+entry.path);
      if(observed.bytes!==entry.bytes) throw new Error("size mismatch: "+entry.path);
      if(entry.mode&&observed.mode!==entry.mode) throw new Error("mode mismatch: "+entry.path);
    }
    if(skill.materialized_files!==expected.length) throw new Error("catalog materialized_files mismatch");
  }catch(error){
    failures.push(skill.id+": "+error.message);
  }
}

if(failures.length){
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Materialized integrity validation passed:",registry.skills.filter((s)=>s.materialized).length,"skills");
