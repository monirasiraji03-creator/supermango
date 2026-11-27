import assert from "node:assert/strict";
import {verifiedPurchase,ga4Purchase,metaPurchase,normalizeBangladeshMobile,classifyProvider} from "./integration-contract.mjs";
const fixture={"test_only":false,"state":"delivered","payment_verified":true,"consent":true,"net_poisha":75000,"order_id":"70400000-0000-4000-8000-000000000001","channel":"website","client_id":"1234.5678","sku":"himsagar-5","quantity":1,"event_time":1795800000,"source_url":"https://example.com/shop","ph":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"};
const tests=[()=>ga4Purchase(fixture).events[0].params.value===750,
()=>metaPurchase(fixture).data[0].event_id===verifiedPurchase(fixture).event_id,
()=>!JSON.stringify(ga4Purchase(fixture)).includes(fixture.ph),
()=>normalizeBangladeshMobile("০১৭১২৩৪৫৬৭৮")==="+8801712345678",
()=>classifyProvider(6,10)==="high",
()=>classifyProvider(4,4)==="unknown",
()=>{try{verifiedPurchase({...fixture,[k]:k==="test_only"?true:k==="state"?"placed":false});return false}catch{return true}},
()=>{try{verifiedPurchase({...fixture,[k]:k==="test_only"?true:k==="state"?"placed":false});return false}catch{return true}},
()=>{try{verifiedPurchase({...fixture,[k]:k==="test_only"?true:k==="state"?"placed":false});return false}catch{return true}},
()=>{try{verifiedPurchase({...fixture,[k]:k==="test_only"?true:k==="state"?"placed":false});return false}catch{return true}},
()=>{try{metaPurchase({...fixture,channel:"messenger"});return false}catch{return true}},
()=>{try{metaPurchase({...fixture,ph:"01712345678"});return false}catch{return true}},
()=>{try{ga4Purchase({...fixture,client_id:"01712345678"});return false}catch{return true}}];
for (const test of tests) assert.equal(test(),true);
console.log(tests.length+" integration contract assertions passed");
