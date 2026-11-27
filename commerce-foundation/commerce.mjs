// Pure, dependency-free commerce primitives. NOT an order API; no persistence or provider calls.
// Catalog/config must come from trusted server storage. All money is integer poisha.
function normalizePhone(input) {
  if(typeof input!=="string" || input.length>40) throw new Error("INVALID_PHONE");
  const bn="০১২৩৪৫৬৭৮৯";
  let n=input.replace(/[০-৯]/g,c=>String(bn.indexOf(c))).trim().replace(/[ \-()]/g,"");
  if(/^01[3-9]\d{8}$/.test(n)) n="+88"+n;
  else if(/^8801[3-9]\d{8}$/.test(n)) n="+"+n;
  if(!/^\+8801[3-9]\d{8}$/.test(n)) throw new Error("INVALID_PHONE");
  return n;
}

function requireInt(value,min,max,code) {
  if(!Number.isSafeInteger(value)||value<min||value>max) throw new Error(code);
  return value;
}

function makeQuote(input, catalog, config) {
  if(!input||typeof input!=="object"||!catalog||!config) throw new Error("INVALID_REQUEST");
  const {sku,quantity,method}=input;
  if(typeof sku!=="string"||sku.length>80||!Object.prototype.hasOwnProperty.call(catalog,sku)) throw new Error("SKU_NOT_FOUND");
  const p=catalog[sku];
  if(!p||p.active!==true) throw new Error("SKU_UNAVAILABLE");
  const qty=requireInt(quantity,1,100,"INVALID_QUANTITY");
  if(qty>requireInt(p.available,0,1000000,"INVALID_STOCK")) throw new Error("OUT_OF_STOCK");
  if(p.quoteOnly===true) throw new Error("MANUAL_QUOTE_REQUIRED");
  if(!["cod","partial","full"].includes(method)) throw new Error("INVALID_PAYMENT_METHOD");
  if(!Array.isArray(config.enabledMethods)||!config.enabledMethods.includes(method)) throw new Error("PAYMENT_DISABLED");
  const gross=requireInt(p.productPoisha,1,100000000,"INVALID_PRODUCT_PRICE")*qty;
  const regular=requireInt(p.inclusivePoisha,p.productPoisha,100000000,"INVALID_INCLUSIVE_PRICE")*qty;
  if(typeof p.version!=="string"||p.version.length===0) throw new Error("INVALID_PRICE_VERSION");
  if(typeof config.version!=="string"||config.version.length===0) throw new Error("INVALID_POLICY_VERSION");
  let discount=0,total=regular;
  if(method==="full"){
    const prepaidRecovery=requireInt(p.prepaidRecoveryPoisha,0,100000000,"INVALID_PREPAID_RECOVERY")*qty;
    const bps=requireInt(config.advanceDiscountBps,0,10000,"INVALID_DISCOUNT");
    if(bps>0&&config.fullAdvanceOfferEnabled!==true) throw new Error("OFFER_DISABLED");
    discount=Math.floor((gross*bps+5000)/10000);
    total=gross-discount+prepaidRecovery;
    if(total<=0||total>regular) throw new Error("INVALID_PREPAID_TOTAL");
    if(bps>0){
      const estimatedCost=requireInt(p.prepaidEstimatedCostPoisha,0,100000000,"COST_UNKNOWN")*qty;
      const marginBps=requireInt(config.minimumMarginBps,0,10000,"INVALID_MARGIN");
      if(gross-discount<=0||(total-estimatedCost)*10000<(gross-discount)*marginBps) throw new Error("MARGIN_GATE");
    }
  }
  const requiredAdvance=method==="full"?total:method==="partial"?Math.min(total,requireInt(config.partialAdvancePoisha,1,100000000,"INVALID_DEPOSIT")):0;
  return Object.freeze({sku,quantity:qty,method,priceVersion:p.version,policyVersion:config.version,productGrossPoisha:gross,discountPoisha:discount,totalPoisha:total,requiredAdvancePoisha:requiredAdvance,balanceAfterVerifiedAdvancePoisha:total-requiredAdvance});
}

function paymentBalance(total, verifiedReceipts, verifiedRefunds=0) {
  requireInt(total,1,10000000000,"INVALID_TOTAL");
  requireInt(verifiedReceipts,0,10000000000,"INVALID_RECEIPTS");
  requireInt(verifiedRefunds,0,verifiedReceipts,"INVALID_REFUNDS");
  const net=verifiedReceipts-verifiedRefunds;
  return Object.freeze({netVerifiedPoisha:net,balancePoisha:Math.max(0,total-net),overpaymentPoisha:Math.max(0,net-total)});
}

export { normalizePhone, makeQuote, paymentBalance };
