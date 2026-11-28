import assert from 'node:assert/strict';
import {test} from 'node:test';
import {handler} from '../api/meta-diagnostic.mjs';
import {readFileSync} from 'node:fs';
const host='preview.example.test',id='sm-pair-'+'b'.repeat(32),env={VERCEL_ENV:'preview',VERCEL_URL:host,META_DATASET_ID:'1820219725917949',META_CAPI_ACCESS_TOKEN:'mock-token-never-transmitted-12345'};
const base={event_id:id,test_code:'TEST12345',confirm:true};
function fixture(opts={}){
 const calls=[],claims=new Set();let payload;
 const fetcher=async(url,init)=>{
  const u=new URL(url),b=JSON.parse(init.body||'{}');
  if(u.pathname.endsWith('/sm_preview_integrations')){calls.push('auth');return Response.json(opts.denied?{}:{mode:'TEST_ONLY',outbound_enabled:false},{status:opts.denied?403:200})}
  if(u.pathname.endsWith('/sm_meta_claim_pair')){calls.push(b.p_stage);assert.equal(b.p_pair_id,id);if(opts.dbError)throw Error('mock timeout');if(opts.dbBad)return Response.json({unexpected:true});if(claims.has(b.p_stage))return Response.json('duplicate');if(b.p_stage==='server'&&!claims.has('browser'))return Response.json('missing_or_expired');claims.add(b.p_stage);return Response.json('reserved')}
  assert.equal(u.hostname,'graph.facebook.com');assert.equal(u.pathname,'/v25.0/1820219725917949/events');calls.push('collect');payload=b;assert.ok(claims.has('server'));if(opts.timeout)throw Error('mock timeout');return Response.json({events_received:opts.rejected?0:1});
 };
 const run=async(op,patch={},e=env)=>{const r=await handler(new Request('https://'+host+'/api/meta-diagnostic',{method:'POST',headers:{origin:'https://'+host,authorization:'Bearer '+'x'.repeat(30),'content-type':'application/json'},body:JSON.stringify({...base,op,...patch})}),e,fetcher,()=>1795875000000);return {status:r.status,body:await r.json()}};
 return {run,calls,get payload(){return payload}};
}
const prepare=f=>f.run('meta_prepare_pair'),send=f=>f.run('send_pair',{browser_receipt_confirmed:true});
test('same event ID and name; browser reservation before one server collect',async()=>{const f=fixture();assert.equal((await prepare(f)).status,200);assert.equal((await send(f)).status,200);assert.equal(f.payload.data[0].event_id,id);assert.equal(f.payload.data[0].event_name,'SMDedupDiagnostic');assert.equal(f.payload.test_event_code,'TEST12345');assert.deepEqual(f.calls,['auth','browser','auth','server','collect']);assert.ok(!JSON.stringify(f.payload).includes('Purchase'))});
test('browser claim duplicate 409',async()=>{const f=fixture();await prepare(f);assert.equal((await prepare(f)).status,409);assert.ok(!f.calls.includes('collect'))});
test('concurrent server duplicate 409',async()=>{const f=fixture();await prepare(f);assert.deepEqual((await Promise.all([send(f),send(f)])).map(x=>x.status).sort(),[200,409]);assert.equal(f.calls.filter(x=>x==='collect').length,1)});
test('server before browser rejected',async()=>{const f=fixture();assert.equal((await send(f)).status,409);assert.ok(!f.calls.includes('collect'))});
test('receipt and consent mandatory',async()=>{const f=fixture();assert.equal((await f.run('send_pair')).status,400);assert.equal((await f.run('meta_prepare_pair',{confirm:false})).status,400);assert.deepEqual(f.calls,['auth','auth'])});
for(const opt of ['dbError','dbBad'])test('database fail closed '+opt,async()=>{const f=fixture({[opt]:true});assert.equal((await prepare(f)).status,503);assert.ok(!f.calls.includes('collect'))});
for(const opt of ['timeout','rejected'])test('no retry on '+opt,async()=>{const f=fixture({[opt]:true});await prepare(f);assert.equal((await send(f)).status,502);assert.equal((await send(f)).status,409);assert.equal(f.calls.filter(x=>x==='collect').length,1)});
test('config status has no event or secret',async()=>{const f=fixture();const r=await f.run('meta_status');assert.equal(r.status,200);assert.equal(r.body.event_sent,false);assert.ok(!JSON.stringify(r).includes(env.META_CAPI_ACCESS_TOKEN));assert.deepEqual(f.calls,['auth'])});
test('legacy send blocked',async()=>{const f=fixture();assert.equal((await f.run('send_test')).status,403);assert.deepEqual(f.calls,['auth'])});
test('production blocked',async()=>{const f=fixture();assert.equal((await f.run('meta_prepare_pair',{}, {...env,VERCEL_ENV:'production'})).status,403);assert.deepEqual(f.calls,[])});
test('nonadmin blocked',async()=>{const f=fixture({denied:true});assert.equal((await prepare(f)).status,403);assert.deepEqual(f.calls,['auth'])});
test('browser and console syntax and contract',()=>{const browser=readFileSync(new URL('../pixel-test.html',import.meta.url),'utf8'),consolePage=readFileSync(new URL('../meta-test.html',import.meta.url),'utf8');for(const page of [browser,consolePage]){const script=page.match(/<script>([\s\S]*?)<\/script>/)[1];new Function(script)}assert.ok(browser.includes('"SMDedupDiagnostic",{diagnostic_only:true},{eventID:pair}'));assert.ok(browser.indexOf('m.type!=="grant"')<browser.indexOf('s.src="https://connect.facebook.net/en_US/fbevents.js"'));assert.ok(consolePage.includes('browser_receipt_confirmed:true'));assert.ok(!browser.includes('Authorization:Bearer'));assert.ok(!consolePage.includes('META_CAPI_ACCESS_TOKEN'))});
