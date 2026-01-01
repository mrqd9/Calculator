let historyEl = document.getElementById("history");
let liveEl = document.getElementById("live");
let totalEl = document.getElementById("total");
let tokens = [];

/* ================= tactile vibration ================= */
function pulse() { if (navigator.vibrate) navigator.vibrate(30); }
function tap(fn){ let ok = fn(); if(ok) pulse(); }

/* ================= helpers ================= */
function clean(n){
  if (isNaN(n)) return 0;
  return Math.round((n + Number.EPSILON) * 1e12) / 1e12;
}

function scrollHistoryToBottom(){
  requestAnimationFrame(()=>{ historyEl.scrollTop = historyEl.scrollHeight; });
}

/* ================= storage ================= */
function saveToLocal() { localStorage.setItem("billing_calc_history", historyEl.innerHTML); }
function loadFromLocal() {
  const saved = localStorage.getItem("billing_calc_history");
  if(saved) {
    historyEl.innerHTML = saved;
    document.querySelectorAll(".h-row").forEach(enableSwipe);
    recalculateGrandTotal();
  }
}

function recalculateGrandTotal(){
  let sum = 0;
  document.querySelectorAll(".h-row").forEach(row=>{
    let v = Number(row.dataset.value);
    if(!isNaN(v)) sum += v;
  });
  sum = clean(sum);
  totalEl.innerText = formatIN(sum.toString());
  totalEl.classList.toggle("negative", sum < 0);
  saveToLocal();
}

/* ================= formatting ================= */
function formatIN(str){
  if(str === "" || str === "-" || str.includes('e')) return str;
  let [i,d] = String(str).split(".");
  let sign = i.startsWith("-") ? "-" : "";
  i = i.replace(/\D/g,"");
  let last3 = i.slice(-3);
  let rest  = i.slice(0,-3);
  if(rest) rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g,",");
  return sign + (rest ? rest + "," : "") + last3 + (d !== undefined ? "." + d : "");
}

function formatTokenForDisplay(t){
  if(typeof t === "object") return t.text;
  if(/^-\d/.test(t)) return "- " + formatIN(t.slice(1));
  if(/^\d/.test(t)) return formatIN(t);
  return t;
}

function updateLive(){
  let text = tokens.map(formatTokenForDisplay).join(" ");
  liveEl.innerHTML = text ? `${text}<span class="caret"></span>` : `<span class="caret"></span>`;
}

/* ================= logic ================= */
function digit(d){
  let last = tokens.at(-1);
  // Auto-multiply if number follows a % object
  if(typeof last === "object") { tokens.push("×"); tokens.push(d === "." ? "0." : d); updateLive(); return true; }
  if(!tokens.length){ tokens.push(d === "." ? "0." : d); updateLive(); return true; }
  if(last === "-" && tokens.length === 1){ tokens[0] = d === "." ? "-0." : "-" + d; updateLive(); return true; }
  if(["+","-","×","÷"].includes(last)){ tokens.push(d === "." ? "0." : d); updateLive(); return true; }
  if(d === "." && last.includes(".")) return false;
  let pure = last.replace("-","").replace(".","");
  if(d !== "." && pure.length >= 15) return false;
  tokens[tokens.length - 1] += d;
  updateLive(); return true;
}

function setOp(op){
  if(!tokens.length){ if(op === "-"){ tokens.push("-"); updateLive(); return true; } return false; }
  let last = tokens.at(-1);
  if(last === "-" && tokens.length === 1) return false;
  ["+","-","×","÷"].includes(last) ? tokens[tokens.length - 1] = op : tokens.push(op);
  updateLive(); return true;
}

function applyPercent(){
  if(tokens.length < 1) return false;
  let last = tokens.at(-1);
  if(isNaN(last) || typeof last === "object") return false;

  let val = Number(last);
  let operator = tokens.at(-2);
  let subtotal = Number(tokens[0]);
  
  // Calculate subtotal for context
  for(let i = 1; i < tokens.length - 2; i += 2){
    let op = tokens[i], t = tokens[i+1];
    let v = Number(typeof t === "object" ? t.value : t);
    if(op === "+") subtotal += v; if(op === "-") subtotal -= v;
    if(op === "×") subtotal *= v; if(op === "÷") subtotal /= v;
  }

  let finalPercentVal;
  // Use billing logic only for + and -
  if(operator === "+" || operator === "-") {
    finalPercentVal = clean(Math.abs(subtotal) * val / 100);
  } else {
    // Math logic for everything else (e.g., -100% 20)
    finalPercentVal = clean(val / 100);
  }

  tokens[tokens.length - 1] = {
    text: formatIN(last) + "%",
    value: finalPercentVal
  };
  
  updateLive();
  return true;
}

function evaluate(){
  let exp = tokens.map(t => (typeof t === "object" ? t.value : t)).join(" ")
    .replace(/×/g,"*").replace(/÷/g,"/");
  try { return clean(new Function("return " + exp)()); } catch { return 0; }
}

function enter(){
  if(!tokens.length) return false;
  let result = evaluate();
  let row = document.createElement("div");
  row.className = "h-row";
  row.dataset.value = result;
  row.innerHTML = `<span class="h-exp">${tokens.map(formatTokenForDisplay).join(" ")} =</span>
                   <span class="h-res">${formatIN(result.toString())}</span>`;
  if(result < 0) row.querySelector(".h-res").classList.add("negative");
  enableSwipe(row);
  historyEl.appendChild(row);
  tokens = []; updateLive(); recalculateGrandTotal(); scrollHistoryToBottom();
  return true;
}

function back(){
  if(!tokens.length) return false;
  let last = tokens.at(-1);
  if(typeof last === "object" || ["+","-","×","÷"].includes(last)){ tokens.pop(); }
  else if(last.length > 1){ tokens[tokens.length - 1] = last.slice(0,-1); }
  else { tokens.pop(); }
  updateLive(); return true;
}

function clearAll(){
  if(!tokens.length && !historyEl.innerHTML) return false;
  tokens = []; historyEl.innerHTML = ""; updateLive(); recalculateGrandTotal();
  return true;
}

/* ================= touch ================= */
let cutTimer = null, cutLong = false;
function cutPressStart(e){ 
  e.preventDefault(); cutLong = false; 
  cutTimer = setTimeout(()=>{ if(tokens.length){ tokens = []; updateLive(); pulse(); } cutLong = true; },450); 
}
function cutPressEnd(e){ e.preventDefault(); clearTimeout(cutTimer); if(!cutLong && back()) pulse(); }

function enableSwipe(row){
  let sx=0, dx=0, drag=false;
  row.addEventListener("pointerdown", e=>{ sx = e.clientX; drag = true; row.classList.add("swiping"); row.style.transition = "none"; });
  row.addEventListener("pointermove", e=>{ if(!drag) return; dx = e.clientX - sx; if(dx < 0) row.style.transform = `translateX(${dx}px)`; });
  row.addEventListener("pointerup", ()=>{
    drag = false; row.style.transition = "transform .25s ease";
    if(dx < -(row.offsetWidth * 0.35)){
      row.style.transform = "translateX(-100%)"; pulse();
      setTimeout(()=>{ row.remove(); recalculateGrandTotal(); },200);
    }else{ row.style.transform = "translateX(0)"; setTimeout(() => row.classList.remove("swiping"), 200); }
    dx = 0;
  });
}

loadFromLocal();
updateLive();
