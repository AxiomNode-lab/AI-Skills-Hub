import fs from "node:fs";
import path from "node:path";
import { loadRegistry } from "../../../packages/core/src/index.mjs";

const registry=loadRegistry();
const skills=registry.skills.filter(s=>s.materialized && s.materialized_root);
const TTL=300000;

function jsonRpc(id,result){return {jsonrpc:"2.0",id,result};}
function error(id,code,message){return {jsonrpc:"2.0",id,error:{code,message}};}

function uriFor(skill,relative="SKILL.md"){
  return "skill://"+skill.name+(relative==="SKILL.md"?"/SKILL.md":"/"+relative);
}
function localRoot(skill){return path.resolve(skill.materialized_root);}
function mimeFor(file){
  if(file.endsWith(".md")) return "text/markdown";
  if(file.endsWith(".json")) return "application/json";
  if(file.endsWith(".yaml")||file.endsWith(".yml")) return "application/yaml";
  if(file.endsWith(".js")||file.endsWith(".mjs")||file.endsWith(".ts")) return "text/plain";
  return "application/octet-stream";
}
function manifestFor(skill){
  const manifestPath=path.resolve("catalog/materialized-manifests",skill.id.replaceAll("/","__")+".json");
  if(!fs.existsSync(manifestPath)) return null;
  return JSON.parse(fs.readFileSync(manifestPath,"utf8"));
}
function entryFor(skill){
  const m=manifestFor(skill);
  if(!m) return null;
  const resources=m.materialized_files.map(f=>({uri:uriFor(skill,f.path),digest:"sha256:"+f.sha256,size:f.bytes}));
  const skillText=fs.readFileSync(path.join(localRoot(skill),"SKILL.md"),"utf8");
  const frontmatter={};
  const lines=skillText.split(/\r?\n/);
  if(lines[0]?.trim()==="---"){
    for(const line of lines.slice(1,120)){
      if(line.trim()==="---") break;
      const match=line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
      if(match) frontmatter[match[1]]=match[2].trim().replace(/^['"]|['"]$/g,"");
    }
  }
  return {uri:uriFor(skill),frontmatter,resources};
}

function page(items,cursor){
  const offset=cursor?Number.parseInt(Buffer.from(cursor,"base64url").toString("utf8"),10):0;
  const limit=50;
  const chunk=items.slice(offset,offset+limit);
  const next=offset+limit<items.length?Buffer.from(String(offset+limit)).toString("base64url"):undefined;
  return {chunk,next};
}

export function handleRpc(request){
  const id=request?.id??null;
  const method=request?.method;
  const params=request?.params??{};
  try{
    if(method==="initialize"){
      return jsonRpc(id,{protocolVersion:request.params?.protocolVersion??"2025-06-18",capabilities:{resources:{},extensions:{"io.modelcontextprotocol/skills":{directoryRead:true}}},serverInfo:{name:"ai-skills-hub",version:"0.2.0"}});
    }
    if(method==="server/discover"){
      return jsonRpc(id,{capabilities:{resources:{},extensions:{"io.modelcontextprotocol/skills":{directoryRead:true}}},instructions:"AI Skills Hub serves verified materialized Agent Skills. Use skills/list or skills/get, then resources/read. Verify digests against the skill manifest."});
    }
    if(method==="skills/list"){
      const entries=skills.map(entryFor).filter(Boolean);
      const p=page(entries,params.cursor);
      return jsonRpc(id,{resultType:"complete",skills:p.chunk,nextCursor:p.next,ttlMs:TTL,cacheScope:"public"});
    }
    if(method==="skills/get"){
      const target=String(params.uri??"");
      const skill=skills.find(s=>uriFor(s)===target);
      if(!skill) return error(id,-32602,"No skill is served at "+target);
      return jsonRpc(id,{resultType:"complete",skill:entryFor(skill),ttlMs:TTL,cacheScope:"public"});
    }
    if(method==="resources/read"){
      const target=String(params.uri??"");
      const match=target.match(/^skill:\/\/([^/]+)\/(.+)$/);
      if(!match) return error(id,-32602,"Unsupported resource URI: "+target);
      const skill=skills.find(s=>s.name===match[1]);
      if(!skill) return error(id,-32602,"Unknown skill: "+target);
      const relative=match[2];
      const root=localRoot(skill);
      const file=path.resolve(root,relative);
      if(!(file===root || file.startsWith(root+path.sep)) || !fs.existsSync(file) || !fs.statSync(file).isFile()){
        return error(id,-32602,"Resource is not served: "+target);
      }
      const body=fs.readFileSync(file);
      return jsonRpc(id,{resultType:"complete",contents:[{uri:target,mimeType:mimeFor(file),text:body.toString("utf8")}],ttlMs:TTL,cacheScope:"public"});
    }
    if(method==="resources/directory/read"){
      const target=String(params.uri??"");
      const match=target.match(/^skill:\/\/([^/]+)(?:\/(.*))?$/);
      if(!match) return error(id,-32602,"Invalid directory URI");
      const skill=skills.find(s=>s.name===match[1]);
      if(!skill) return error(id,-32602,"Unknown skill: "+target);
      const root=localRoot(skill);
      const dir=path.resolve(root,match[2]??"");
      if(!(dir===root||dir.startsWith(root+path.sep))||!fs.existsSync(dir)||!fs.statSync(dir).isDirectory()){
        return error(id,-32602,"Not a directory resource: "+target);
      }
      const resources=[];
      for(const e of fs.readdirSync(dir,{withFileTypes:true})){
        const rel=path.relative(root,path.join(dir,e.name)).split(path.sep).join("/");
        resources.push({uri:uriFor(skill,rel),name:e.name,mimeType:e.isDirectory()?"inode/directory":mimeFor(e.name)});
      }
      return jsonRpc(id,{resultType:"complete",resources});
    }
    return error(id,-32601,"Method not found: "+method);
  }catch(e){return error(id,-32603,e.message);}
}
