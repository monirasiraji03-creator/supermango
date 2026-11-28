// Offline candidate only, not wired to transport. Verify Meta channel-specific permissions, identifiers and API contract before activation. Claim and consent flags must come from trusted DB, never browser.
export function crmCandidate(row,config,now){
 if(!config||config.release!=="production"||config.enabled!==true||config.messagingApproved!==true)throw Error("MESSAGING_RELEASE_DISABLED");
 if(!row||row.source!=="production_verified_outbox"||row.test_only!==false||row.state!=="delivered"||row.payment_verified!==true||row.consent!==true||row.claim_verified!==true)throw Error("NOT_ELIGIBLE");
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.order_id||"")||row.event_id!==row.order_id+":purchase_verified"||!Number.isSafeInteger(row.net_poisha)||row.net_poisha<=0||!Number.isSafeInteger(row.event_time)||!Number.isSafeInteger(now)||row.event_time<=0||row.event_time>now||now-row.event_time>604800)throw Error("INVALID_EVENT");
 if(config.pageId!=="328899030304755"||row.page_id!==config.pageId||row.attribution_verified!==true)throw Error("ATTRIBUTION_REQUIRED");
 const user_data={page_id:config.pageId};
 if(row.channel==="messenger"){
  if(!/^\d{5,32}$/.test(row.page_scoped_user_id||""))throw Error("PSID_REQUIRED");
  user_data.page_scoped_user_id=row.page_scoped_user_id;
 }else if(row.channel==="whatsapp"){
  if(!/^[A-Za-z0-9_-]{16,512}$/.test(row.ctwa_clid||""))throw Error("CTWA_REQUIRED");
  user_data.ctwa_clid=row.ctwa_clid;
 }else throw Error("UNSUPPORTED_MESSAGING_CHANNEL");
 return {data:[{event_name:"Purchase",event_id:row.event_id,event_time:row.event_time,action_source:"business_messaging",messaging_channel:row.channel,user_data,custom_data:{currency:"BDT",value:row.net_poisha/100,order_id:row.order_id}}]};
}
