// Server-side library only. No live worker/endpoint wired. Caller must authenticate and atomically claim real production outbox rows; flags alone are not authorization. Never log credentials or request payloads.
export function planDelivery(r,c,now){
 if(!c||c.enabled!==true||c.release!=="production")throw Error("RELEASE_DISABLED");
 if(!r||r.source!=="production_verified_outbox"||r.test_only!==false||r.state!=="delivered"||r.payment_verified!==true||r.consent!==true)throw Error("NOT_RELEASE_ELIGIBLE");
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(r.order_id||"")||r.event_id!==r.order_id+":purchase_verified"||!Number.isSafeInteger(r.net_poisha)||r.net_poisha<=0||!Number.isSafeInteger(r.event_time)||r.event_time<=0||!Number.isSafeInteger(now)||r.event_time>now)throw Error("INVALID_EVENT");
 if(r.channel!=="website")throw Error("ASSISTED_CHANNEL_MAPPING_PENDING");
 const value=r.net_poisha/100;
 if(r.destination==="meta_capi"){
  if(now-r.event_time>604800)throw Error("STALE_EVENT");
  if(!/^\d{5,32}$/.test(c.metaDatasetId||"")||!/^v\d{1,2}\.0$/.test(c.metaVersion||"")||!c.metaToken||!/^https:\/\/[a-z0-9.-]+$/i.test(c.storeOrigin||""))throw Error("META_CONFIG_MISSING");
  if(typeof r.source_url!=="string"||!r.source_url.startsWith(c.storeOrigin+"/")||!/^\/[a-z0-9/_-]*$/i.test(r.source_url.slice(c.storeOrigin.length)))throw Error("INVALID_SOURCE_URL");
  if(typeof r.user_agent!=="string"||!r.user_agent.trim()||r.user_agent.length>1024)throw Error("USER_AGENT_REQUIRED");
  const user_data={client_user_agent:r.user_agent};for(const k of ["ph","em"]){if(r[k]!==undefined){if(!/^[a-f0-9]{64}$/.test(r[k]))throw Error("INVALID_MATCH_HASH");user_data[k]=[r[k]]}}if(!user_data.ph&&!user_data.em)throw Error("MATCH_DATA_REQUIRED");
  return {destination:r.destination,url:"https://graph.facebook.com/"+c.metaVersion+"/"+c.metaDatasetId+"/events",headers:{"Content-Type":"application/json",Authorization:"Bearer "+c.metaToken},body:{data:[{event_name:"Purchase",event_id:r.event_id,event_time:r.event_time,action_source:"website",event_source_url:r.source_url,user_data,custom_data:{currency:"BDT",value,order_id:r.order_id}}]}};
 }
 if(r.destination==="ga4"){
  if(now-r.event_time>259200)throw Error("STALE_EVENT");
  if(!/^G-[A-Z0-9]+$/.test(c.gaMeasurementId||"")||typeof c.gaSecret!=="string"||!c.gaSecret)throw Error("GA_CONFIG_MISSING");
  if(!/^\d{1,20}\.\d{1,20}$/.test(r.client_id||"")||!Number.isSafeInteger(r.quantity)||r.quantity<1||!/^[a-z0-9_-]{1,80}$/i.test(r.sku||""))throw Error("GA_MATCH_DATA_REQUIRED");
  const qs="?measurement_id="+encodeURIComponent(c.gaMeasurementId)+"&api_secret="+encodeURIComponent(c.gaSecret);
  return {destination:r.destination,url:"https://www.google-analytics.com/mp/collect"+qs,debugUrl:"https://www.google-analytics.com/debug/mp/collect"+qs,headers:{"Content-Type":"application/json"},body:{client_id:r.client_id,timestamp_micros:r.event_time*1000000,events:[{name:"purchase",params:{transaction_id:r.order_id,value,currency:"BDT",items:[{item_id:r.sku,quantity:r.quantity,price:value/r.quantity}]}}]}};
 }
 throw Error("DESTINATION_NOT_SUPPORTED");
}
export async function sendClaimedEvent(r,c,{fetchImpl,now,signal}){
 if(typeof fetchImpl!=="function"||r?.claim_verified!==true)throw Error("TRUSTED_CLAIM_REQUIRED");
 const p=planDelivery(r,c,now);
 const post=async(url,body)=>{try{return await fetchImpl(url,{method:"POST",headers:p.headers,body:JSON.stringify(body),redirect:"error",signal})}catch{return null}};
 if(p.destination==="ga4"){const x=await post(p.debugUrl,{...p.body,validation_behavior:"ENFORCE_RECOMMENDATIONS"});if(!x?.ok)return {state:"validation_failed"};let j;try{j=await x.json()}catch{return {state:"validation_failed"}}if(!Array.isArray(j.validationMessages)||j.validationMessages.length)return {state:"validation_failed"}}
 const x=await post(p.url,p.body);if(!x)return {state:"unknown_requires_reconciliation"};if(!x.ok)return {state:x.status===429||x.status>=500?"unknown_requires_reconciliation":"provider_rejected",httpStatus:x.status};
 if(p.destination==="meta_capi"){let j;try{j=await x.json()}catch{return {state:"unknown_requires_reconciliation"}}return {state:j.events_received===1?"provider_received":"unknown_requires_reconciliation"}}
 return {state:"http_accepted_reporting_unverified"};
}
