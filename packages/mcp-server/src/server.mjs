#!/usr/bin/env node
import http from "node:http";
import { handleRpc } from "./index.mjs";

const port=Number(process.env.PORT??8899);
const server=http.createServer((req,res)=>{
  if(req.method==="GET" && req.url==="/health"){
    res.writeHead(200,{"content-type":"application/json"});
    res.end(JSON.stringify({status:"ok",skills:"materialized"}));
    return;
  }
  if(req.method!=="POST" || req.url.split("?")[0]!=="/mcp"){
    res.writeHead(404,{"content-type":"application/json"});
    res.end(JSON.stringify({error:"not_found"}));
    return;
  }
  let body="";
  req.setEncoding("utf8");
  req.on("data",chunk=>{
    body+=chunk;
    if(body.length>1024*1024){req.destroy();}
  });
  req.on("end",()=>{
    try{
      const request=JSON.parse(body);
      const response=handleRpc(request);
      res.writeHead(200,{"content-type":"application/json","cache-control":"no-store"});
      res.end(JSON.stringify(response));
    }catch(e){
      res.writeHead(400,{"content-type":"application/json"});
      res.end(JSON.stringify({jsonrpc:"2.0",id:null,error:{code:-32700,message:"Parse error"}}));
    }
  });
});
server.listen(port,()=>console.log("AI Skills Hub MCP server listening on http://localhost:"+port+"/mcp"));
