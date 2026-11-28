import {createHash} from 'node:crypto';
const HOST="https://zxrysizswqabcuoknxwl.supabase.co", KEY="sb_publishable_IebVrXKD6Mmup8Vw5imMHQ_S-qX9GIK", DATASET='1820219725917949', VERSION='v25.0';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const digest=s=>createHash('sha256').update(s).digest('hex');
export async function handler(req,env=process.env,fetcher=fetch,clock=()=>Date.now()){
 if(env.VERCEL_ENV!=='preview')return json({error:'PREVIEW_ONLY'},403);
 if(req.method!=='POST')return json({error:'POST_REQUIRED'},405);
 const origin='https://'+env.VERCEL_URL;
 if(!env.VERCEL_URL||req.headers.get('origin')!==origin||new URL(req.url).origin!==origin)return json({error:'ORIGIN_DENIED'},403);
 const auth=req.headers.get('authorization')||'';
 if(!/^Bearer [A-Za-z0-9._-]{20,4096}$/.test(auth))return json({error:'LOGIN_REQUIRED'},401);
 try{
  const admin=await fetcher(HOST+'/rest/v1/rpc/sm_preview_integrations',{method:'POST',headers:{apikey:KEY,Authorization:auth,'Content-Type':'application/json'},body:'{"op":"status","payload":{}}',redirect:'error',signal:AbortSignal.timeout(8000)});
  if(!admin.ok)return json({error:'ADMIN_REQUIRED'},403);
  const data=await admin.json();if(data.mode!=='TEST_ONLY'||data.outbound_enabled!==false)return json({error:'ADMIN_REQUIRED'},403);
 }catch{return json({error:'AUTH_CHECK_UNAVAILABLE'},503)}
 let p;try{if(!(req.headers.get('content-type')||'').startsWith('application/json'))throw Error();const raw=await req.text();if(raw.length>400)throw Error();p=JSON.parse(raw)}catch{return json({error:'INVALID_REQUEST'},400)}
 if(!p||!['status','send_test','send_pair','ga_validate','ga_send'].includes(p.op))return json({error:'INVALID_REQUEST'},400);
 if(p.op==='ga_validate'||p.op==='ga_send'){
  if(p.confirm!==true)return json({error:'CONFIRMATION_REQUIRED'},400);
  if(env.GA4_MEASUREMENT_ID!=='G-HGLMQDH5S8'||typeof env.GA4_API_SECRET!=='string'||!env.GA4_API_SECRET.trim())return json({configured:false,error:'GA4_CONFIG_MISSING_OR_WRONG_STREAM'},503);
  const qs='?measurement_id='+encodeURIComponent(env.GA4_MEASUREMENT_ID)+'&api_secret='+encodeURIComponent(env.GA4_API_SECRET);
  const payload={client_id:'123456789.987654321',consent:{ad_user_data:'DENIED',ad_personalization:'DENIED'},events:[{name:'sm_server_diagnostic',params:{debug_mode:1,engagement_time_msec:1,diagnostic_only:'yes'}}]};
  const post=(path,body)=>fetcher('https://www.google-analytics.com'+path+qs,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(10000)});
  try{const r=await post('/debug/mp/collect',{...payload,validation_behavior:'ENFORCE_RECOMMENDATIONS'});const b=await r.json();const valid=r.ok&&Array.isArray(b.validationMessages)&&b.validationMessages.length===0;
  if(!valid||p.op==='ga_validate')return json({configured:true,validation_passed:valid,validation_count:Array.isArray(b.validationMessages)?b.validationMessages.length:null,http:r.status,reporting_event_sent:false,credentials_verified:false});
  const sent=await post('/mp/collect',payload);
  return json({configured:true,validation_passed:true,http:sent.status,request_accepted:sent.ok,event_name:'sm_server_diagnostic',debug_mode:true,reporting_receipt_verified:false,check:'GA4 DebugView'});
  }catch{return json({error:'GA4_REQUEST_UNAVAILABLE_RECONCILE_BEFORE_RETRY'},502)}
 }
 const configured=env.META_DATASET_ID===DATASET&&typeof env.META_CAPI_ACCESS_TOKEN==='string'&&env.META_CAPI_ACCESS_TOKEN.length>20;
 if(!configured)return json({configured:false,error:'META_CONFIG_MISSING_OR_WRONG_DATASET'},503);
 const base='https://graph.facebook.com/'+VERSION+'/'+DATASET;
 const headers={Authorization:'Bearer '+env.META_CAPI_ACCESS_TOKEN,'Content-Type':'application/json'};
 try{
  if(p.op==='status'){
   const r=await fetcher(base+'?fields=id',{headers,redirect:'error',signal:AbortSignal.timeout(8000)});const b=await r.json().catch(()=>null);
   return json({configured:true,dataset:DATASET,read_verified:r.ok&&b?.id===DATASET,provider_http:r.status,provider_code:Number.isInteger(b?.error?.code)?b.error.code:null});
  }
  if(!/^TEST[0-9]{4,12}$/.test(p.test_code||'')||p.confirm!==true)return json({error:'TEST_CODE_AND_CONFIRMATION_REQUIRED'},400);
  const paired=p.op==='send_pair';
  if(paired&&!/^sm-pair-[a-f0-9]{32}$/.test(p.event_id||''))return json({error:'INVALID_PAIR_ID'},400);
  const eventId=paired?p.event_id:'sm-diagnostic-'+digest(DATASET+':'+p.test_code).slice(0,24);
  const eventName=paired?'SMDedupDiagnostic':'SMIntegrationDiagnostic';
  const body={test_event_code:p.test_code,data:[{event_name:eventName,event_time:Math.floor(clock()/1000),event_id:eventId,action_source:'website',event_source_url:origin+(paired?'/pixel-test.html':'/meta-test.html'),user_data:{client_user_agent:'SuperMango-IntegrationDiagnostic/1.0',external_id:[digest('supermango-synthetic-diagnostic-only')]}}]};
  const r=await fetcher(base+'/events',{method:'POST',headers,body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(10000)});const b=await r.json().catch(()=>null);
  return json({configured:true,accepted:r.ok&&b?.events_received===1,provider_http:r.status,provider_code:Number.isInteger(b?.error?.code)?b.error.code:null,event_name:eventName,event_id:eventId,test_code_supplied:true});
 }catch{return json({error:'PROVIDER_UNAVAILABLE_RECONCILE_BEFORE_RETRY'},502)}
}
export default {fetch(req){return handler(req);}};
