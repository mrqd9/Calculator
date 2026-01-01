let historyEl = document.getElementById("history");
let liveEl = document.getElementById("live");
let totalEl = document.getElementById("total");
let tokens = [];

/* ================= TAP ================= */
function tap(fn){
  let ok = fn();
  if(ok && navigator.vibrate) navigator.vibrate(15);
}

/* ================= HELPERS ================= */
function clean(n){
  if (isNaN(n)) return 0;
  return Math.round((n + Number.EPSILON) * 1e12) / 1e12;
}

function scrollHistoryToBottom(){
  requestAnimationFrame(()=>{
    historyEl.scrollTop = historyEl.scrollHeight;
  });
}

/* ================= STORAGE ================= */
function saveToLocal() {
  localStorage.setItem("billing_calc_history", historyEl.innerHTML);
}

function loadFromLocal() {
  const saved = localStorage.getItem("billing_calc_history");
  if(saved) {
    historyEl.innerHTML = saved;
    document.querySelectorAll(".h-row").forEach(enableSwipe);
    recalculateGrandTotal();
  }
}

/* ================= GRAND TOTAL ================= */
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

/* ================= FORMAT ================= */
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

/* ================= LIVE ================= */
function updateLive(){
  let text = tokens.map(formatTokenForDisplay).join(" ");
  liveEl.innerHTML = text ? `${text}<span class="caret"></span>` : `<span class="caret"></span>`;
}

/* ================= DIGIT ================= */
function digit(d){
  let last = tokens.at(-1);
  if(!tokens.length){ tokens.push(d === "." ? "0." : d); updateLive(); return true; }
  if(last === "-" && tokens.length === 1){ tokens[0] = d === "." ? "-0." : "-" + d; updateLive(); return true; }
  if(["+","-","×","÷"].includes(last)){ tokens.push(d === "." ? "0." : d); updateLive(); return true; }
  if(typeof last === "object") return false;
  if(d === "." && last.includes(".")) return false;
  let pure = last.replace("-","").replace(".","");
  if(d !== "." && pure.length >= 15) return false;
  tokens[tokens.length - 1] += d;
  updateLive(); return true;
}

/* ================= OPERATOR ================= */
function setOp(op){
  if(!tokens.length){ if(op === "-"){ tokens.push("-"); updateLive(); return true; } return false; }
  let last = tokens.at(-1);
  if(last === "-" && tokens.length === 1) return false;
  ["+","-","×","÷"].includes(last) ? tokens[tokens.length - 1] = op : tokens.push(op);
  updateLive(); return true;
}

/* ================= PERCENT ================= */
function applyPercent(){
  if(tokens.length < 2) return false;
  let percentToken = tokens.at(-1);
  if(isNaN(percentToken)) return false;
  let subtotal = Number(tokens[0]);
  for(let i = 1; i < tokens.length - 2; i += 2){
    let op = tokens[i], valToken = tokens[i+1];
    let val = Number(typeof valToken === "object" ? valToken.value : valToken);
    if(op === "+") subtotal += val; if(op === "-") subtotal -= val;
    if(op === "×") subtotal *= val; if(op === "÷") subtotal /= val;
  }
  let percentValue = clean(subtotal * Number(percentToken) / 100);
  tokens[tokens.length - 1] = { text: formatIN(percentToken) + "%", value: percentValue };
  updateLive(); return true;
}

/* ================= EVALUATE ================= */
function evaluate(){
  let exp = tokens.map(t => (typeof t === "object" ? t.value : t)).join(" ")
    .replace(/×/g,"*").replace(/÷/g,"/");
  try { return clean(new Function("return " + exp)()); } catch { return 0; }
}

/* ================= ENTER ================= */
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
  tokens = [];
  updateLive();
  recalculateGrandTotal();
  scrollHistoryToBottom();
  return true;
}

/* ================= BACKSPACE ================= */
function back(){
  if(!tokens.length) return false;
  let last = tokens.at(-1);
  if(typeof last === "object" || ["+","-","×","÷"].includes(last)){ tokens.pop(); }
  else if(last.length > 1){ tokens[tokens.length - 1] = last.slice(0,-1); }
  else { tokens.pop(); }
  updateLive(); return true;
}

/* ================= CLEAR ALL (Prompt Removed) ================= */
function clearAll(){
  if(!tokens.length && !historyEl.innerHTML) return false;
  tokens = [];
  historyEl.innerHTML = "";
  updateLive();
  recalculateGrandTotal();
  return true;
}

/* ================= LONG PRESS BACK ================= */
let cutTimer = null, cutLong = false;
function cutPressStart(e){ e.preventDefault(); cutLong = false; cutTimer = setTimeout(()=>{ if(tokens.length){ tokens = []; updateLive(); if(navigator.vibrate) navigator.vibrate(25); } cutLong = true; },450); }
function cutPressEnd(e){ e.preventDefault(); clearTimeout(cutTimer); if(!cutLong && back()) if(navigator.vibrate) navigator.vibrate(15); }
function cutPressCancel(){ clearTimeout(cutTimer); }

/* ================= SWIPE DELETE ================= */
function enableSwipe(row){
  let sx=0, dx=0, drag=false;
  row.addEventListener("pointerdown", e=>{
    sx = e.clientX;
    drag = true;
    row.classList.add("swiping");
    row.style.transition = "none";
  });
  row.addEventListener("pointermove", e=>{
    if(!drag) return;
    dx = e.clientX - sx;
    if(dx < 0) row.style.transform = `translateX(${dx}px)`;
  });
  row.addEventListener("pointerup", ()=>{
    drag = false;
    row.style.transition = "transform .25s ease";
    if(dx < -(row.offsetWidth * 0.35)){
      row.style.transform = "translateX(-100%)";
      if(navigator.vibrate) navigator.vibrate(20);
      setTimeout(()=>{ row.remove(); recalculateGrandTotal(); },200);
    }else{
      row.style.transform = "translateX(0)";
      setTimeout(() => row.classList.remove("swiping"), 200);
    }
    dx = 0;
  });
  row.addEventListener("pointercancel", ()=>{
    drag = false;
    row.style.transform = "translateX(0)";
    row.classList.remove("swiping");
  });
}

loadFromLocal();
updateLive();
