let historyEl=document.getElementById("history");
let liveEl=document.getElementById("live");
let totalEl=document.getElementById("total");

let expr="", originalExpr="", grandTotal=0;

/* HAPTIC */
function tap(fn){
  let changed=fn();
  if(changed && navigator.vibrate) navigator.vibrate(15);
}

/* FORMAT */
function formatIN(n){
  if(n===""||n==="-" ) return n;
  let x=Number(n);
  if(isNaN(x)) return n;
  return x.toLocaleString("en-IN",{maximumFractionDigits:10});
}
function clean(n){return Number(parseFloat(n).toFixed(10));}

function updateLive(){
  liveEl.innerText=expr.split(" ").map(p=>isNaN(p)?p:formatIN(p)).join(" ");
}
function currentNumber(){return expr.split(" ").pop();}

/* ACTIONS */
function digit(d){
  let c=currentNumber();
  if(d==="."&&c.includes(".")) return false;
  if(d!=="."&&c.replace("-","").replace(".","").length>=12) return false;
  expr+=d; originalExpr+=d; updateLive(); return true;
}

function setOp(op){
  if(expr===""&&op==="-"){expr="-";originalExpr="-";updateLive();return true;}
  if(expr===""||expr.endsWith(" ")) return false;
  expr+=" "+op+" "; originalExpr+=" "+op+" ";
  updateLive(); return true;
}

function applyPercent(){
  let p=expr.trim().split(" "); if(p.length<3) return false;
  let A=parseFloat(p[0]), op=p[1], B=parseFloat(p[2]);
  originalExpr+=" %";
  let v=(op==="+"||op==="-"||op==="−")?A*B/100:B/100;
  expr=`${A} ${op} ${v}`; updateLive(); return true;
}

function evaluate(e){
  return clean(Function("return "+e.replace(/×/g,"*").replace(/÷/g,"/"))());
}

function enter(){
  if(expr===""||expr==="-"||expr==="−") return false;
  let r; try{r=evaluate(expr);}catch{return false;}

  let row=document.createElement("div");
  row.className="h-row"+(r<0?" negative":"");
  row.innerHTML=`<span class="h-exp">${originalExpr} =</span>
                 <span class="h-res">${formatIN(r)}</span>`;
  historyEl.appendChild(row);
  historyEl.scrollTop=historyEl.scrollHeight;

  grandTotal=clean(grandTotal+r);
  totalEl.innerText=formatIN(grandTotal.toFixed(2));

  expr=""; originalExpr=""; updateLive(); return true;
}

function back(){
  if(expr==="") return false;
  expr=expr.slice(0,-1); originalExpr=originalExpr.slice(0,-1);
  updateLive(); return true;
}

function clearAll(){
  if(expr===""&&historyEl.innerHTML==="") return false;
  expr=""; originalExpr=""; grandTotal=0;
  historyEl.innerHTML=""; updateLive();
  totalEl.innerText="0.00"; return true;
}
