#!/usr/bin/env node
import fs from "node:fs";
import { loadRegistry, resolveBundle } from "../packages/core/src/index.mjs";
import { buildPortablePluginManifest, exportPortablePlugin } from "../packages/plugin-export/src/index.mjs";

const [, , bundleName = "@core", outputDir = "dist/plugin"] = process.argv;
const registry=loadRegistry();
const skills=resolveBundle(registry,bundleName);
const materialized=skills.filter((s)=>s.materialized);

if(materialized.length !== skills.length){
  console.error("Plugin export refused: " + (skills.length-materialized.length) + " selected skills are not materialized.");
  process.exit(2);
}

const safeName=bundleName.replace(/^@/,"").replace(/[^a-z0-9._-]+/gi,"-");
const manifest=buildPortablePluginManifest({
  name:"ai-skills-hub-" + safeName,
  version:"0.1.0",
  description:"Portable Agent Skills bundle exported by AI Skills Hub: " + bundleName,
  repository:"https://github.com/AxiomNode-lab/AI-Skills-Hub",
  author:{name:"AxiomNode-lab"}
});
const result=exportPortablePlugin({outputDir,manifest,skills:materialized});
console.log(JSON.stringify(result,null,2));
