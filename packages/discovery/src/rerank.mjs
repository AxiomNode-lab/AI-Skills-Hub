function parseJsonArray(text) {
  const body=String(text ?? "").trim();
  try { return JSON.parse(body); } catch {}
  const start=body.indexOf("[");
  const end=body.lastIndexOf("]");
  if(start>=0 && end>start){
    try { return JSON.parse(body.slice(start,end+1)); } catch {}
  }
  return null;
}

export async function rerankWithModel(results,query,{baseUrl,model,apiKey,fetchImpl=fetch,maxCandidates=20}={}) {
  if(!baseUrl || !model || !results.length) return results;
  const candidates=results.slice(0,maxCandidates).map((entry,index)=>({
    index,
    id:entry.item.id ?? ("candidate-"+index),
    name:entry.item.name,
    description:entry.item.description,
    category:entry.item.category,
    publisher:entry.item.publisher
  }));
  const prompt=[
    "Rank these Skill/tool candidates for the user request.",
    "Return JSON only: an array of candidate ids in best-match order.",
    "Do not invent ids and do not explain.",
    "",
    "Request:",query,"","Candidates:",JSON.stringify(candidates)
  ].join("\n");
  const headers={"content-type":"application/json"};
  if(apiKey) headers.authorization="Bearer "+apiKey;
  const response=await fetchImpl(baseUrl.replace(/\/$/,"")+"/chat/completions",{
    method:"POST",headers,
    body:JSON.stringify({
      model,temperature:0,
      messages:[
        {role:"system",content:"You are a tool discovery ranking engine. Rank by task fit first, then compatible agent and release safety."},
        {role:"user",content:prompt}
      ]
    })
  });
  if(!response.ok) throw new Error("AI discovery provider "+response.status);
  const body=await response.json();
  const ordered=parseJsonArray(body.choices?.[0]?.message?.content ?? "");
  if(!Array.isArray(ordered)) return results;
  const order=new Map(ordered.map((id,index)=>[String(id),index]));
  return results.slice().sort((a,b)=>{
    const aa=order.get(String(a.item.id));
    const bb=order.get(String(b.item.id));
    if(aa===undefined && bb===undefined) return b.score-a.score;
    if(aa===undefined) return 1;
    if(bb===undefined) return -1;
    return aa-bb;
  });
}
