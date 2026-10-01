import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { loadRegistry } from "../../../packages/core/src/index.mjs";

const registry = loadRegistry();
const stdin = process.stdin;
const stdout = process.stdout;

function send(id, result) {
  stdout.write(JSON.stringify({jsonrpc:"2.0",id,result}) + "\n");
}

function error(id, code, message) {
  stdout.write(JSON.stringify({jsonrpc:"2.0",id,error:{code,message}}) + "\n");
}

function materializedSkills() {
  return registry.skills.filter((s) =>
    s.materialized &&
    s.materialized_root &&
    fs.existsSync(path.resolve(s.materialized_root))
  );
}

function manifestFor(skill) {
  const root = path.resolve(skill.materialized_root);
  const walk = (dir) => fs.readdirSync(dir,{withFileTypes:true}).flatMap((entry) => {
    const full=path.join(dir,entry.name);
    if (entry.isDirectory()) return walk(full);
    if (entry.isFile() && entry.name !== ".ai-skills-hub.json") return [full];
    return [];
  });
  const files=walk(root).sort();
  return files.map((full) => {
    const bytes=fs.readFileSync(full);
    const rel=path.relative(root,full).split(path.sep).join("/");
    return {
      uri:"skill://"+skill.id+"/"+rel,
      digest:"sha256:"+crypto.createHash("sha256").update(bytes).digest("hex"),
      size:bytes.length
    };
  });
}

function frontmatter(skill) {
  const file=path.resolve(skill.materialized_root,"SKILL.md");
  const body=fs.readFileSync(file,"utf8");
  const lines=body.split(/\r?\n/);
  const fm={};
  if(lines[0]?.trim()==="---"){
    for(const line of lines.slice(1,80)){
      if(line.trim()==="---") break;
      const m=line.match(/^([A-Za-z0-9_-]+):\s*(.+)$/);
      if(m) fm[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,"");
    }
  }
  return fm;
}

async function handle(message){
  const {id,method,params={}}=message;

  if(method==="initialize"){
    return send(id,{
      protocolVersion:params.protocolVersion ?? "2026-07-28",
      capabilities:{
        resources:{},
        extensions:{"io.modelcontextprotocol/skills":{directoryRead:false}}
      },
      serverInfo:{name:"ai-skills-hub",version:"0.1.0"}
    });
  }

  if(method==="ping") return send(id,{});

  if(method==="skills/list"){
    const items=materializedSkills().map((skill)=>({
      uri:"skill://"+skill.id+"/SKILL.md",
      frontmatter:frontmatter(skill),
      resources:manifestFor(skill)
    }));
    return send(id,{skills:items});
  }

  if(method==="skills/get"){
    const uri=params.uri;
    const items=materializedSkills();
    const skill=items.find((s)=>uri === "skill://"+s.id+"/SKILL.md");
    if(!skill) return error(id,-32001,"Skill not served: "+uri);
    return send(id,{uri:"skill://"+skill.id+"/SKILL.md",frontmatter:frontmatter(skill),resources:manifestFor(skill)});
  }

  if(method==="resources/read"){
    const uri=params.uri;
    const prefix="skill://";
    if(!uri?.startsWith(prefix)) return error(id,-32002,"Unsupported resource URI");
    const rest=uri.slice(prefix.length);
    const slash=rest.indexOf("/");
    if(slash<1) return error(id,-32002,"Invalid skill resource URI");
    const skillId=rest.slice(0,slash);
    const rel=rest.slice(slash+1);
    const skill=materializedSkills().find((s)=>s.id===skillId);
    if(!skill) return error(id,-32001,"Skill not served");
    const root=path.resolve(skill.materialized_root);
    const full=path.resolve(root,rel);
    if(!full.startsWith(root+path.sep) || !fs.existsSync(full) || !fs.statSync(full).isFile()) {
      return error(id,-32003,"Resource not found");
    }
    const bytes=fs.readFileSync(full);
    const mime=rel.toLowerCase().endsWith(".md")?"text/markdown":"application/octet-stream";
    const isText=mime.startsWith("text/");
    return send(id,{contents:[isText?{uri,mimeType:mime,text:bytes.toString("utf8")}:{uri,mimeType:mime,blob:bytes.toString("base64")}]});
  }

  return error(id,-32601,"Method not found: "+method);
}

let buffer="";
stdin.setEncoding("utf8");
stdin.on("data",(chunk)=>{
  buffer+=chunk;
  let idx;
  while((idx=buffer.indexOf("\n"))>=0){
    const line=buffer.slice(0,idx).trim();
    buffer=buffer.slice(idx+1);
    if(!line) continue;
    try{handle(JSON.parse(line));}
    catch(err){stdout.write(JSON.stringify({jsonrpc:"2.0",error:{code:-32700,message:"Parse error"}})+"\n");}
  }
});
