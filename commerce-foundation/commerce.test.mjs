import { normalizePhone, makeQuote, paymentBalance } from './commerce.mjs';
function runCases(api){
  const {normalizePhone,makeQuote,paymentBalance}=api;
  const catalog={sample:{active:true,available:10,version:"synthetic-v1",productPoisha:100000,inclusivePoisha:110000,prepaidRecoveryPoisha:8000,prepaidEstimatedCostPoisha:60000},bulk:{active:true,available:2,quoteOnly:true}};
  const cfg={version:"test-v1",enabledMethods:["cod","partial","full"],partialAdvancePoisha:20000,advanceDiscountBps:1200,fullAdvanceOfferEnabled:true,minimumMarginBps:1500};
  const q=(method,over={},c=catalog,conf=cfg)=>makeQuote({sku:"sample",quantity:1,method,...over},c,conf);
  let results=[];
  function check(name,fn){try{if(fn()!==true)throw Error("assertion");results.push({name,pass:true})}catch(e){results.push({name,pass:false,error:e.message})}}
  function rejects(fn,code){try{fn();return false}catch(e){return e.message===code}}
  check("Bangla phone",()=>normalizePhone("০১৭১২৩৪৫৬৭৮")==="+8801712345678");
  check("international phone",()=>normalizePhone("8801712345678")==="+8801712345678");
  check("reject invalid phone",()=>rejects(()=>normalizePhone("123"),"INVALID_PHONE"));
  check("COD all-inclusive",()=>q("cod").totalPoisha===110000&&q("cod").requiredAdvancePoisha===0);
  check("partial credited",()=>q("partial").balanceAfterVerifiedAdvancePoisha===90000);
  check("full product-only discount",()=>q("full").discountPoisha===12000&&q("full").totalPoisha===96000);
  check("client price ignored",()=>q("cod",{totalPoisha:1}).totalPoisha===110000);
  check("reject quantity decimal",()=>rejects(()=>q("cod",{quantity:1.5}),"INVALID_QUANTITY"));
  check("reject stock overflow",()=>rejects(()=>q("cod",{quantity:11}),"OUT_OF_STOCK"));
  check("reject negative quantity",()=>rejects(()=>q("cod",{quantity:-1}),"INVALID_QUANTITY"));
  check("reject inherited SKU",()=>rejects(()=>q("cod",{sku:"__proto__"}),"SKU_NOT_FOUND"));
  check("bulk manual",()=>rejects(()=>q("cod",{sku:"bulk"}),"MANUAL_QUOTE_REQUIRED"));
  check("disabled method",()=>rejects(()=>q("full",{},catalog,{...cfg,enabledMethods:["cod"]}),"PAYMENT_DISABLED"));
  check("disabled offer",()=>rejects(()=>q("full",{},catalog,{...cfg,fullAdvanceOfferEnabled:false}),"OFFER_DISABLED"));
  check("unknown costs",()=>rejects(()=>q("full",{}, {sample:{...catalog.sample,prepaidEstimatedCostPoisha:undefined}}),"COST_UNKNOWN"));
  check("margin protection",()=>rejects(()=>q("full",{}, {sample:{...catalog.sample,prepaidEstimatedCostPoisha:95000}}),"MARGIN_GATE"));
  check("quantity scales price",()=>q("cod",{quantity:2}).totalPoisha===220000);
  check("unverified payment not credited",()=>paymentBalance(110000,0).balancePoisha===110000);
  check("verified deposit credited",()=>paymentBalance(110000,20000).balancePoisha===90000);
  check("overpayment flagged",()=>paymentBalance(110000,120000).overpaymentPoisha===10000);
  check("refund reconciles",()=>paymentBalance(110000,20000,5000).balancePoisha===95000);
  check("reject invalid refund",()=>rejects(()=>paymentBalance(110000,20000,21000),"INVALID_REFUNDS"));
  return results;
}
const results=runCases({normalizePhone,makeQuote,paymentBalance});
for(const r of results) console.log(`${r.pass?'PASS':'FAIL'} ${r.name}${r.error?' '+r.error:''}`);
if(results.some(r=>!r.pass)) process.exitCode=1;
