import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { loadRegistry } from "../../../packages/core/src/index.mjs";

const registry=loadRegistry();
const TTL_MS=300000;
const PAGE_SIZE=50;

function materializedSkills(){
  return registry.skills.filter((s)=>
    s.materialized &&
    s.release?.status==="eligible" &&
    s.materialized_root &&
    fs.existsSync(path.resolve(s.materialized_root))
  );
}

function walkFiles(root){
  const files=[];
  const visit=(dir)=>{
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
      const full=path.join(dir,entry.name);
      if(entry.name==="." || entry.name==="..") continue;
      if(entry.isDirectory()) visit(full);
      else if(entry.isFile()) files.push(full);
    }
  };
  visit(root);
  return files.sort();
}

function parseFrontmatter(body){
  const lines=body.split(/\r?\n/);
  const result={};
  if(lines[0]?.trim()!=="---") throw new Error("Invalid SKILL.md frontmatter");
  let closed=false;
  for(const line of lines.slice(1)){
    if(line.trim()==="---"){closed=true;break;}
    const match=line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if(match) result[match[1]]=match[2].trim().replace(/^['"]|['"]$/g,"");
  }
  if(!closed || !result.name || !result.description) throw new Error("Invalid SKILL.md frontmatter");
  return result;
}

function manifestFor(skill){
  const root=path.resolve(skill.materialized_root);
  const skillFile=path.join(root,"SKILL.md");
  const frontmatter=parseFrontmatter(fs.readFileSync(skillFile,"utf8"));
  const skillUri="skill://"+skill.id.replaceAll("/","/")+"/SKILL.md";
  const resources=walkFiles(root).map((full)=>{
    const rel=path.relative(root,full).split(path.sep).join("/");
    const bytes=fs.readFileSync(full);
    return {
      uri:"skill://"+skill.id+"/"+rel,
      digest:"sha256:"+crypto.createHash("sha256").update(bytes).digest("hex"),
      size:bytes.length
    };
  });
  if(resources.length>512) throw new Error("Skill exceeds MCP resource limit: "+skill.id);
  const total=resources.reduce((sum,item)=>sum+item.size,0);
  if(total>16*1024*1024) throw new Error("Skill exceeds MCP size limit: "+skill.id);

  const top=resources.find((r)=>r.uri===skillUri);
  if(!top) throw new Error("Skill SKILL.md missing from manifest: "+skill.id);

  return {
    uri:skillUri,
    frontmatter,
    resources
  };
}

function decodeCursor(cursor){
  if(!cursor) return 0;
  try{
    const value=Number(Buffer.from(cursor,"base64url").toString("utf8"));
    return Number.isInteger(value)&&value>=0?value:0;
  }catch{return 0;}
}

function encodeCursor(offset){
  return Buffer.from(String(offset)).toString("base64url");
}

function jsonRpcResult(id,result){
  return JSON.stringify({jsonrpc:"2.0",id,result})+"\n";
}

function jsonRpcError(id,code,message){
  return JSON.stringify({jsonrpc:"2.0",id,error:{code,message}})+"\n";
}

export function handleMessage(message){
  const {id,method,params={}}=message;
  if(id===undefined && method?.startsWith("notifications/")) return null;

  if(method==="initialize"){
    return jsonRpcResult(id,{
      protocolVersion:params.protocolVersion ?? "2026-07-28",
      capabilities:{
        resources:{},
        extensions:{"io.modelcontextprotocol/skills":{directoryRead:false}}
      },
      serverInfo:{name:"ai-skills-hub",version:"0.2.0"}
    });
  }

  if(method==="ping") return jsonRpcResult(id,{});

  if(method==="skills/list"){
    const skills=materializedSkills();
    const start=decodeCursor(params.cursor);
    const page=skills.slice(start,start+PAGE_SIZE).map(manifestFor);
    const next=start+page.length<skills.length ? encodeCursor(start+page.length) : undefined;
    const result={
      resultType:"complete",
      skills:page,
      ttlMs:TTL_MS,
      cacheScope:"public"
    };
    if(next) result.nextCursor=next;
    return jsonRpcResult(id,result);
  }

  if(method==="skills/get"){
    const uri=params.uri;
    const skill=materializedSkills().find((candidate)=>"skill://"+candidate.id+"/SKILL.md"===uri);
    if(!skill) return jsonRpcError(id,-32602,"Skill not found: "+String(uri));
    return jsonRpcResult(id,{
      resultType:"complete",
      skill:manifestFor(skill),
      ttlMs:TTL_MS,
      cacheScope:"public"
    });
  }

  if(method==="resources/read"){
    const uri=params.uri;
    if(typeof uri!=="string" || !uri.startsWith("skill://")) return jsonRpcError(id,-32602,"Invalid resource URI");
    const rest=uri.slice("skill://".length);
    const slash=rest.indexOf("/");
    if(slash<1) return jsonRpcError(id,-32602,"Invalid resource URI");
    const skillId=rest.slice(0,slash);
    const rel=rest.slice(slash+1);
    const skill=materializedSkills().find((candidate)=>candidate.id===skillId);
    if(!skill) return jsonRpcError(id,-32602,"Resource not found");

    const root=path.resolve(skill.materialized_root);
    const full=path.resolve(root,rel);
    if(!full.startsWith(root+path.sep) || !fs.existsSync(full) || !fs.statSync(full).isFile()){
      return jsonRpcError(id,-32602,"Resource not found");
    }

    const bytes=fs.readFileSync(full);
    const mime=rel.toLowerCase().endsWith(".md")?"text/markdown":"application/octet-stream";
    return jsonRpcResult(id,{
      contents:[mime==="text/markdown"
        ?{uri,mimeType:mime,text:bytes.toString("utf8")}
        :{uri,mimeType:mime,blob:bytes.toString("base64")}]
    });
  }

  return jsonRpcError(id,-32601,"Method not found: "+method);
}

if(process.argv[1] && path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname)){
  let buffer="";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data",(chunk)=>{
    buffer+=chunk;
    let index;
    while((index=buffer.indexOf("\n"))>=0){
      const line=buffer.slice(0,index).trim();
      buffer=buffer.slice(index+1);
      if(!line) continue;
      try{
        const response=handleMessage(JSON.parse(line));
        if(response) process.stdout.write(response);
      }catch(error){
        process.stdout.write(jsonRpcError(null,-32700,"Parse error"));
      }
    }
  });
}
