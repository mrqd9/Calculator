let historyEl = document.getElementById("history");
let liveEl = document.getElementById("live");
let totalEl = document.getElementById("total");

let expr = "", originalExpr = "", grandTotal = 0;

/* ===== TAP WRAPPER ===== */
function tap(fn){
  let changed = fn();
  if(changed && navigator.vibrate) navigator.vibrate(15);
}

/* ===== HELPERS ===== */
function clean(n){
  return Number(parseFloat(n).toFixed(10));
}

/* ===== INDIAN FORMAT (STRING SAFE) ===== */
function formatIN(str){
  if(str === "" || str === "-") return str;
  str = str.toString();

  let [intPart, decPart] = str.split(".");
  intPart = intPart.replace(/\D/g,"");

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

/* ===== SCIENTIFIC FORMAT (CAPSULE SAFE) ===== */
function formatScientific(str){
  str = str.replace(/\D/g,"");
  if(!str) return "0";

  const len = str.length;
  const exp = len - 1;

  // mantissa candidates (max → min precision)
  const candidates = [
    str[0] + "." + str.slice(1,3), // 1.23
    str[0] + "." + str[1],         // 1.2
    str[0]                         // 1
  ];

  return `${candidates[0]}E${exp}`;
}

/* ===== FIT CHECK ===== */
function fitsInElement(el, text){
  const test = document.createElement("span");
  test.style.visibility = "hidden";
  test.style.whiteSpace = "nowrap";
  test.style.font = getComputedStyle(el).font;
  test.innerText = text;
  document.body.appendChild(test);
  const fits = test.offsetWidth <= el.clientWidth;
  document.body.removeChild(test);
  return fits;
}

/* ===== ADAPTIVE FORMAT (SUBTOTAL & TOTAL ONLY) ===== */
function formatAdaptive(value, el){
  let str = value.toString();
  let normal = formatIN(str);
  if(fitsInElement(el, normal)) return normal;
  return formatScientific(str);
}

/* ===== LIVE DISPLAY (NO SCIENTIFIC) ===== */
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

/* ===== EVALUATE (BIGINT SAFE) ===== */
function evaluate(e){
  let exp = e.replace(/×/g,"*").replace(/÷/g,"/");

  // BigInt multiplication (integer only)
  if (/^\d+\s*\*\s*\d+$/.test(exp)) {
    let [a,b] = exp.split("*").map(s=>s.trim());
    if (a.length > 15 || b.length > 15) {
      return (BigInt(a) * BigInt(b)).toString();
    }
  }

  return clean(Function("return " + exp)());
}

/* ===== ENTER ===== */
function enter(){
  if(expr==="" || expr==="-" || expr==="−") return false;

  let r;
  try{ r = evaluate(expr); }
  catch{ return false; }

  let row = document.createElement("div");
  row.className = "h-row" + (Number(r) < 0 ? " negative" : "");
  row.innerHTML = `
    <span class="h-exp">${originalExpr} =</span>
    <span class="h-res"></span>
  `;
  historyEl.appendChild(row);

  let resEl = row.querySelector(".h-res");
  resEl.innerText = formatAdaptive(r, resEl);

  historyEl.scrollTop = historyEl.scrollHeight;

  grandTotal = clean(grandTotal + Number(r));
  totalEl.innerText = formatAdaptive(grandTotal.toFixed(2), totalEl);

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
  if(expr==="") return;
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
