import {pairedGaPayload} from '../api/meta-diagnostic.mjs';
function assertions(fn){
 const now=1795869000000,p={client_id:"123456789.1795869000",session_id:"1795869000",diagnostic_id:"sm-ga-"+"a".repeat(32),captured_at:now-1000,engagement_ms:1000};
 let n=0;const check=(x)=>{if(!x)throw Error("ASSERTION_FAILED");n++};const a=fn(p,now);
 check(a.client_id===p.client_id);check(a.events[0].params.session_id===Number(p.session_id));check(a.events[0].params.diagnostic_id===p.diagnostic_id);check(a.events[0].params.engagement_time_msec===1000);check(a.events[0].params.debug_mode===1);check(a.consent.ad_user_data==="DENIED");check(a.events[0].name==="sm_server_diagnostic");
 for(const patch of [{client_id:"01712345678"},{client_id:undefined},{session_id:"0"},{session_id:"bad"},{diagnostic_id:"bad"},{captured_at:now-900001},{captured_at:now+5001},{engagement_ms:0},{engagement_ms:60001}]){let rejected=false;try{fn({...p,...patch},now)}catch{rejected=true}check(rejected)}
 return n;
}
console.log(assertions(pairedGaPayload)+' assertions passed');
