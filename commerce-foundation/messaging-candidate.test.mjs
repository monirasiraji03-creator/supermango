import {crmCandidate} from './messaging-candidate.mjs';
function tests(fn){
 const now=1795850000,id="70400000-0000-4000-8000-000000000001",c={release:"production",enabled:true,messagingApproved:true,pageId:"328899030304755"},r={source:"production_verified_outbox",test_only:false,state:"delivered",payment_verified:true,consent:true,claim_verified:true,attribution_verified:true,page_id:c.pageId,order_id:id,event_id:id+":purchase_verified",net_poisha:75000,event_time:now-20,channel:"messenger",page_scoped_user_id:"1234567890"};
 const check=(v)=>{if(!v)throw Error("FAIL")};let n=0;const reject=(x,y=c)=>{let ok=false;try{fn(x,y,now)}catch{ok=true}check(ok);n++};
 check(fn(r,c,now).data[0].custom_data.value===750);n++;check(fn({...r,channel:"whatsapp",ctwa_clid:"mock_click_id_123456789"},c,now).data[0].user_data.ctwa_clid==="mock_click_id_123456789");n++;
 for(const patch of [{test_only:true},{state:"placed"},{payment_verified:false},{consent:false},{claim_verified:false},{attribution_verified:false},{page_id:"11111"},{page_scoped_user_id:""},{channel:"whatsapp"},{channel:"manual"},{event_id:"duplicate"},{event_time:now-700000}])reject({...r,...patch});reject(r,{...c,messagingApproved:false});return n;
}
console.log(tests(crmCandidate)+' assertions passed');
