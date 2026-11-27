// Pure integration payload contracts. No outbound requests, credentials, or live activation. Only server-side verified inputs may be supplied. Business messaging mappings need merchant permission and verification.
export function verifiedPurchase(input){
 if(!input||input.test_only!==false||input.state!=="delivered"||input.payment_verified!==true||input.consent!==true||!Number.isSafeInteger(input.net_poisha)||input.net_poisha<=0||!(/^[0-9a-f-]{36}$/i.test(input.order_id||"")))throw Error("NOT_RELEASE_ELIGIBLE");
 if(!["website","messenger","whatsapp","phone","manual","community","corporate"].includes(input.channel))throw Error("INVALID_CHANNEL");
 return {event_id:input.order_id+":purchase_verified",transaction_id:input.order_id,value:input.net_poisha/100,currency:"BDT",channel:input.channel};
}

export function ga4Purchase(input){
 const e=verifiedPurchase(input);
 if(e.channel!=="website"||typeof input.client_id!=="string"||!/^[0-9]+\.[0-9]+$/.test(input.client_id)||typeof input.sku!=="string"||!/^[a-z0-9_-]{1,80}$/i.test(input.sku)||!Number.isSafeInteger(input.quantity)||input.quantity<=0)throw Error("GA4_MATCH_UNAVAILABLE");
 return {client_id:input.client_id,events:[{name:"purchase",params:{transaction_id:e.transaction_id,currency:e.currency,value:e.value,items:[{item_id:input.sku,quantity:input.quantity,price:e.value/input.quantity}]}}]};
}

export function metaPurchase(input){
 const e=verifiedPurchase(input);if(e.channel!=="website")throw Error("BUSINESS_MESSAGING_MAPPING_REQUIRES_APPROVAL");
 if(!Number.isSafeInteger(input.event_time)||input.event_time<=0||typeof input.source_url!=="string"||!/^https:\/\/[a-z0-9.-]+\/[a-z0-9/_-]*$/i.test(input.source_url))throw Error("INVALID_EVENT_CONTEXT");
 const user_data={};for(const k of ["ph","em"]){if(input[k]!==undefined){if(!/^[a-f0-9]{64}$/.test(input[k]))throw Error("MATCH_DATA_NOT_HASHED");user_data[k]=[input[k]]}}
 if(!Object.keys(user_data).length)throw Error("META_MATCH_UNAVAILABLE");
 return {data:[{event_name:"Purchase",event_id:e.event_id,event_time:input.event_time,action_source:"website",event_source_url:input.source_url,user_data,custom_data:{currency:e.currency,value:e.value,order_id:e.transaction_id}}]};
}

export function normalizeBangladeshMobile(s){const n=String(s??"").replace(/[০-৯]/g,x=>"০১২৩৪৫৬৭৮৯".indexOf(x)).replace(/[\s()-]/g,"");const v=n.startsWith("+880")?n:n.startsWith("880")?"+"+n:n.startsWith("01")?"+88"+n:"";if(!/^\+8801[3-9]\d{8}$/.test(v))throw Error("INVALID_MOBILE");return v;}

export function classifyProvider(delivered,completed){if(!Number.isSafeInteger(delivered)||!Number.isSafeInteger(completed)||delivered<0||completed<delivered||completed>1000000)throw Error("INVALID_COUNTS");if(completed<5)return "unknown";const p=delivered/completed;return p>=.9?"low":p>=.75?"moderate":p>=.5?"high":"very_high";}
