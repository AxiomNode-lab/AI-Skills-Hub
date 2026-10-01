import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.dirname(fileURLToPath(import.meta.url));
const publicDir=path.join(root,"public");
const port=Number(process.env.PORT ?? 4173);
const apiOrigin=process.env.AI_SKILLS_API_ORIGIN ?? "http://127.0.0.1:8787";

function mime(file){
  if(file.endsWith(".html")) return "text/html; charset=utf-8";
  if(file.endsWith(".js")) return "text/javascript; charset=utf-8";
  if(file.endsWith(".css")) return "text/css; charset=utf-8";
  if(file.endsWith(".json")) return "application/json; charset=utf-8";
  return "application/octet-stream";
}

const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,"http://localhost");

  if(req.method !== "GET"){
    res.writeHead(405,{"content-type":"application/json","allow":"GET"});
    res.end(JSON.stringify({error:"method_not_allowed"}));
    return;
  }

  if(url.pathname.startsWith("/api/")){
    try{
      const upstream=await fetch(apiOrigin+url.pathname+url.search,{headers:{accept:req.headers.accept??"*/*"}});
      res.writeHead(upstream.status,{"content-type":upstream.headers.get("content-type")??"application/json","x-content-type-options":"nosniff"});
      res.end(Buffer.from(await upstream.arrayBuffer()));
    }catch(err){
      res.writeHead(502,{"content-type":"application/json"});
      res.end(JSON.stringify({error:"api_unavailable",message:err.message}));
    }
    return;
  }

  const requested=url.pathname==="/"?"index.html":url.pathname.replace(/^\//,"");
  const candidate=path.resolve(publicDir,requested);
  if(!candidate.startsWith(publicDir+path.sep) || !fs.existsSync(candidate) || !fs.statSync(candidate).isFile()){
    const fallback=path.join(publicDir,"index.html");
    res.writeHead(200,{"content-type":"text/html; charset=utf-8"});
    res.end(fs.readFileSync(fallback));
    return;
  }

  res.writeHead(200,{"content-type":mime(candidate),"cache-control":"no-store","x-content-type-options":"nosniff","x-frame-options":"DENY","referrer-policy":"no-referrer"});
  res.end(fs.readFileSync(candidate));
});

server.listen(port,()=>console.log("AI Skills Hub web server listening on http://localhost:"+port));
