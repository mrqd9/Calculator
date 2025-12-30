let historyEl = document.getElementById("history");
let liveEl = document.getElementById("live");
let totalEl = document.getElementById("total");

let expr = "", originalExpr = "", grandTotal = 0;

/* ===== TAP WRAPPER (NO FALSE VIBRATION) ===== */
function tap(fn){
  let changed = fn();
  if(changed && navigator.vibrate) navigator.vibrate(15);
}

/* ===== NUMBER FORMATTERS ===== */
function formatScientific(str){
  str = str.replace(/\D/g,"");
  let len = str.length;
  if(len === 0) return "0";
  let mantissa = str.slice(0,3);
  return `${mantissa[0]}.${mantissa.slice(1)}E${len-1}`;
}

function formatIN(str){
  if(str === "" || str === "-") return str;
  str = str.toString();

  let [intPart, decPart] = str.split(".");
  intPart = intPart.replace(/\D/g,"");

  // 🔴 very large number → scientific
  if(intPart.length > 15){
    return formatScientific(intPart);
  }

  // Indian grouping
  let last3 = intPart.slice(-3);
  let rest = intPart.slice(0,-3);
  if(rest){
    rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g,",");
    intPart = rest + "," + last3;
  } else {
    intPart = last3;
  }

  return decPart ? intPart + "." + decPart : intPart;
}

function clean(n){
  return Number(parseFloat(n).toFixed(10));
}

/* ===== LIVE DISPLAY ===== */
function updateLive(){
  liveEl.innerText = expr
    .split(" ")
    .map(p => /[0-9]/.test(p) ? formatIN(p) : p)
    .join(" ");
}

function currentNumber(){
  return expr.split(" ").pop();
}

/* ===== INPUT ===== */
function digit(d){
  let c = currentNumber();
  if(d==="." && c.includes(".")) return false;
  if(d!=="." && c.replace("-","").replace(".","").length >= 12) return false;
  expr += d;
  originalExpr += d;
  updateLive();
  return true;
}

function setOp(op){
  if(expr==="" && op==="-"){
    expr="-"; originalExpr="-";
    updateLive();
    return true;
  }
  if(expr==="" || expr.endsWith(" ")) return false;
  expr += " " + op + " ";
  originalExpr += " " + op + " ";
  updateLive();
  return true;
}

/* ===== PERCENT ===== */
function applyPercent(){
  let p = expr.trim().split(" ");
  if(p.length < 3) return false;

  let A = parseFloat(p[0]);
  let op = p[1];
  let B = parseFloat(p[2]);

  if(isNaN(A) || isNaN(B)) return false;

  originalExpr += " %";
  let v = (op==="+"||op==="-"||op==="−") ? A*B/100 : B/100;
  expr = `${A} ${op} ${v}`;
  updateLive();
  return true;
}

/* ===== EVALUATE ===== */
function evaluate(e){
  return clean(
    Function("return " + e.replace(/×/g,"*").replace(/÷/g,"/"))()
  );
}

/* ===== ENTER ===== */
function enter(){
  if(expr==="" || expr==="-" || expr==="−") return false;

  let r;
  try{ r = evaluate(expr); }
  catch{ return false; }

  let row = document.createElement("div");
  row.className = "h-row" + (r<0 ? " negative" : "");
  row.innerHTML =
    `<span class="h-exp">${originalExpr} =</span>
     <span class="h-res">${formatIN(r.toString())}</span>`;

  historyEl.appendChild(row);
  historyEl.scrollTop = historyEl.scrollHeight;

  grandTotal = clean(grandTotal + r);
  totalEl.innerText = formatIN(grandTotal.toFixed(2));

  expr = ""; originalExpr = "";
  updateLive();
  return true;
}

/* ===== BACKSPACE ===== */
function back(){
  if(expr === "") return false;
  expr = expr.slice(0,-1);
  originalExpr = originalExpr.slice(0,-1);
  updateLive();
  return true;
}

/* ===== CLEAR ALL ===== */
function clearAll(){
  if(expr==="" && historyEl.innerHTML==="") return false;
  expr=""; originalExpr=""; grandTotal=0;
  historyEl.innerHTML="";
  updateLive();
  totalEl.innerText="0.00";
  return true;
}

/* ===== LONG PRESS CUT ===== */
let cutTimer = null;
let cutLongPress = false;

function cutPressStart(){
  if(expr==="") return;   // 🔑 no false trigger
  cutLongPress = false;

  cutTimer = setTimeout(()=>{
    expr=""; originalExpr="";
    updateLive();
    cutLongPress = true;
    if(navigator.vibrate) navigator.vibrate(25);
  }, 450);
}

function cutPressEnd(){
  clearTimeout(cutTimer);
  if(!cutLongPress){
    let changed = back();
    if(changed && navigator.vibrate) navigator.vibrate(15);
  }
}

function cutPressCancel(){
  clearTimeout(cutTimer);
}
