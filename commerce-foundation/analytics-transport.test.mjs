import {planDelivery,sendClaimedEvent} from './analytics-transport.mjs';
async function checks(plan,send){
 const now=1795800000,id="70400000-0000-4000-8000-000000000001",c={release:"production",enabled:true,metaDatasetId:"123456789",metaVersion:"v25.0",metaToken:"mock-token",storeOrigin:"https://example.com",gaMeasurementId:"G-TEST123",gaSecret:"mock-secret"},r={source:"production_verified_outbox",test_only:false,state:"delivered",payment_verified:true,consent:true,order_id:id,event_id:id+":purchase_verified",net_poisha:75000,event_time:now-30,channel:"website",destination:"meta_capi",source_url:"https://example.com/shop",user_agent:"Mock UA",ph:"a".repeat(64),client_id:"1234.5678",quantity:1,sku:"himsagar-5",claim_verified:true},out=[];
 const check=(name,ok)=>{if(!ok)throw Error(name);out.push(name)},reject=(row,conf=c)=>{try{plan(row,conf,now);return false}catch{return true}};
 for(const [name,patch] of Object.entries({"test blocked":{test_only:true},"preview blocked":{source:"preview"},"consent required":{consent:false},"payment required":{payment_verified:false},"delivery required":{state:"placed"},"messaging mapping blocked":{channel:"messenger"},"raw phone rejected":{ph:"01712345678"},"foreign origin rejected":{source_url:"https://evil.example/shop"},"UA required":{user_agent:""}}))check(name,reject({...r,...patch}));
 check("release disabled",reject(r,{...c,enabled:false}));check("credential required",reject(r,{...c,metaToken:""}));check("stable ID",plan(r,c,now).body.data[0].event_id===r.event_id);check("net value",plan(r,c,now).body.data[0].custom_data.value===750);
 const ga={...r,destination:"ga4"};check("no GA PII",!JSON.stringify(plan(ga,c,now).body).includes(r.ph));check("GA stale",reject({...ga,event_time:now-260000}));
 let calls=[];const mock=async(url)=>{calls.push(url);return {ok:true,json:async()=>url.includes("/debug/")?{validationMessages:[]}:{events_received:1}}};
 const a=await send(ga,c,{fetchImpl:mock,now});check("GA validation before collect",calls.length===2&&calls[0].includes("/debug/")&&a.state==="http_accepted_reporting_unverified");
 calls=[];const b=await send(ga,c,{fetchImpl:async u=>{calls.push(u);return {ok:true,json:async()=>({validationMessages:[{}]})}},now});check("GA failed validation blocks",calls.length===1&&b.state==="validation_failed");
 check("Meta receipt",(await send(r,c,{fetchImpl:mock,now})).state==="provider_received");check("unknown outcome held",(await send(r,c,{fetchImpl:async()=>{throw Error("offline")},now})).state==="unknown_requires_reconciliation");
 let blocked=false;try{await send({...r,claim_verified:false},c,{fetchImpl:mock,now})}catch{blocked=true}check("claim required",blocked);return out;
}
console.log(await checks(planDelivery,sendClaimedEvent));
