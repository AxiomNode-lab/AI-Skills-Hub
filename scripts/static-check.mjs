#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const roots=["apps","packages","scripts","tests"];
const files=[];
function walk(dir){
  if(!fs.existsSync(dir)) return;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()) walk(full);
    else if(entry.isFile()&&full.endsWith(".mjs")) files.push(full);
  }
}
for(const root of roots) walk(root);
for(const file of files){
  execFileSync(process.execPath,["--check",file],{stdio:"pipe"});
}
console.log("JavaScript syntax valid:",files.length,"modules");
