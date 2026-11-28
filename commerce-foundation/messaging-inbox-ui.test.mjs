import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../commerce-crm.html',import.meta.url),'utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
function fixture(){
const e=new Map(),calls=[],inbox=[];const orders=[{id:'a-messenger',channel:'messenger',state:'delivered',kg:5},{id:'b-whatsapp',channel:'whatsapp',state:'placed',kg:3}];
function node(){return {textContent:'',value:'',children:[],append(...xs){this.children.push(...xs)},replaceChildren(){this.children=[]},setAttribute(){}}}
const get=id=>{if(!e.has(id))e.set(id,node());return e.get(id)};
const context={document:{getElementById:get,createElement:node},crypto:{randomUUID:()=> 'fixture-id'},fetch:async(url,init)=>{assert.match(url,/sm_preview_messaging$/);const p=JSON.parse(init.body);calls.push(p);if(p.op==='capture')inbox.push({...p.payload,order_id:null});if(p.op==='link')inbox.find(x=>x.id===p.payload.id).order_id=p.payload.order_id;return {ok:true,status:200,json:async()=>p.op==='list'?{test_only:true,outbound_enabled:false,inbox,orders}:{test_only:true}}},location:{reload(){}}};vm.createContext(context);vm.runInContext(script,context);return {get,calls,inbox,context};
}
test('synthetic inbox captures channel, source and intent without personal data or outbound call',async()=>{const f=fixture();f.get('msgChannel').value='messenger';f.get('msgOrigin').value='organic';f.get('msgIntent').value='order_request';f.get('messageFixture').onsubmit({preventDefault(){}});await new Promise(r=>setImmediate(r));assert.deepEqual(f.calls[0],{op:'capture',payload:{id:'fixture-id',channel:'messenger',origin:'organic',intent:'order_request'}});assert.equal(f.calls[1].op,'list');const article=f.get('inboxRows').children[0],pick=article.children[2];assert.equal(pick.children.length,1);assert.equal(pick.children[0].value,'a-messenger');});
test('order link uses existing order and does not create or send conversion',async()=>{const f=fixture();f.inbox.push({id:'fixture-id',channel:'whatsapp',origin:'unknown',intent:'order_request',order_id:null});await vm.runInContext('refreshInbox()',f.context);const article=f.get('inboxRows').children[0];article.children[2].value='b-whatsapp';await article.children[3].onclick();assert.deepEqual(f.calls[1],{op:'link',payload:{id:'fixture-id',order_id:'b-whatsapp'}});assert.equal(f.inbox[0].order_id,'b-whatsapp');});
test('CRM remains test only with no Meta SDK or raw message inputs',()=>{assert.doesNotMatch(html,/connect\.facebook\.net|graph\.facebook\.com|<textarea/);assert.match(html,/synthetic fixture/);assert.match(script,/outbound_enabled!==false/)});
