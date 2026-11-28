import assert from 'node:assert/strict';
import {test} from 'node:test';
import {handler} from '../api/meta-diagnostic.mjs';
const now=1795875000000,host='preview.example.test',secret='mock-secret-never-transmit';
const env={VERCEL_ENV:'preview',VERCEL_URL:host,GA4_MEASUREMENT_ID:'G-HGLMQDH5S8',GA4_API_SECRET:secret};
const id='sm-ga-'+'a'.repeat(32);
const body={op:'ga_send',confirm:true,diagnostic_id:id,client_id:'123456789.1795875000',session_id:'1795875000',engagement_ms:1000,captured_at:now};
function fixture(options={}){
 const calls=[],claims=new Set();
 const mock=async(url,init)=>{
  const u=new URL(url),p=JSON.parse(init.body||'{}');
  if(u.pathname.endsWith('/sm_preview_integrations')){calls.push('auth');return Response.json(options.unauthorized?{}:{mode:'TEST_ONLY',outbound_enabled:false},{status:options.unauthorized?403:200})}
  if(u.pathname.endsWith('/sm_ga4_reserve_diagnostic')){
   calls.push('reserve');assert.equal(p.p_diagnostic_id,id);
   if(options.reserveError)throw Error('mock unavailable');
   if(options.reserveBad)return Response.json({unexpected:true});
   if(options.reserveDenied)return Response.json({}, {status:403});
   if(claims.has(p.p_diagnostic_id))return Response.json(false);
   claims.add(p.p_diagnostic_id);return Response.json(true);
  }
  assert.equal(u.hostname,'www.google-analytics.com');assert.equal(u.searchParams.get('api_secret'),secret);
  assert.equal(p.events[0].params.diagnostic_id,id);
  if(u.pathname==='/debug/mp/collect'){calls.push('validate');assert.equal(p.validation_behavior,'ENFORCE_RECOMMENDATIONS');return Response.json({validationMessages:options.invalid?[{description:'bad'}]:[]})}
  if(u.pathname==='/mp/collect'){calls.push('collect');assert.ok(claims.has(id));if(options.timeout)throw Error('mock timeout');return new Response(null,{status:options.providerError?503:204})}
  throw Error('unexpected mock endpoint');
 };
 const run=async(p=body,e=env,headers={})=>{const response=await handler(new Request('https://'+host+'/api/meta-diagnostic',{method:'POST',headers:{origin:'https://'+host,authorization:'Bearer '+'x'.repeat(30),'content-type':'application/json',...headers},body:JSON.stringify(p)}),e,mock,()=>now);return {status:response.status,body:await response.json()}};
 return {calls,claims,run};
}
test('reserve before validation and collect; same ID rejected persistently',async()=>{const f=fixture();assert.equal((await f.run()).status,200);assert.equal((await f.run()).status,409);assert.deepEqual(f.calls,['auth','reserve','validate','collect','auth','reserve'])});
test('concurrent calls: one 200 and one 409, one collect',async()=>{const f=fixture();const results=await Promise.all([f.run(),f.run()]);assert.deepEqual(results.map(x=>x.status).sort(),[200,409]);assert.equal(f.calls.filter(x=>x==='collect').length,1)});
for(const option of ['reserveError','reserveBad','reserveDenied'])test('fail closed '+option,async()=>{const f=fixture({[option]:true});assert.equal((await f.run()).status,503);assert.deepEqual(f.calls,['auth','reserve'])});
test('validation failure consumes claim and blocks replay',async()=>{const f=fixture({invalid:true});assert.equal((await f.run()).status,422);assert.equal((await f.run()).status,409);assert.equal(f.calls.filter(x=>x==='collect').length,0)});
for(const option of ['timeout','providerError'])test('no retry after '+option,async()=>{const f=fixture({[option]:true});assert.equal((await f.run()).status,502);assert.equal((await f.run()).status,409);assert.equal(f.calls.filter(x=>x==='collect').length,1)});
test('validation-only does not reserve or collect',async()=>{const f=fixture();assert.equal((await f.run({...body,op:'ga_validate'})).status,200);assert.deepEqual(f.calls,['auth','validate']);assert.equal(f.claims.size,0)});
test('status checks runtime configuration without provider call or secret disclosure',async()=>{const f=fixture();const r=await f.run({op:'ga_status'});assert.equal(r.status,200);assert.equal(r.body.configured,true);assert.equal(r.body.credentials_verified,false);assert.ok(!JSON.stringify(r).includes(secret));assert.deepEqual(f.calls,['auth'])});
test('missing secret fails closed',async()=>{const f=fixture();assert.equal((await f.run(body,{...env,GA4_API_SECRET:''})).status,503);assert.deepEqual(f.calls,['auth'])});
test('wrong measurement ID fails closed',async()=>{const f=fixture();assert.equal((await f.run(body,{...env,GA4_MEASUREMENT_ID:'G-WRONG'})).status,503);assert.deepEqual(f.calls,['auth'])});
test('production blocked before any request',async()=>{const f=fixture();assert.equal((await f.run(body,{...env,VERCEL_ENV:'production'})).status,403);assert.deepEqual(f.calls,[])});
test('wrong origin blocked',async()=>{const f=fixture();assert.equal((await f.run(body,env,{origin:'https://other.example.test'})).status,403);assert.deepEqual(f.calls,[])});
test('non-admin blocked',async()=>{const f=fixture({unauthorized:true});assert.equal((await f.run()).status,403);assert.deepEqual(f.calls,['auth'])});
test('missing consent blocked',async()=>{const f=fixture();assert.equal((await f.run({...body,confirm:false})).status,400);assert.deepEqual(f.calls,['auth'])});
test('expired context blocked',async()=>{const f=fixture();assert.equal((await f.run({...body,captured_at:now-900001})).status,400);assert.deepEqual(f.calls,['auth'])});
