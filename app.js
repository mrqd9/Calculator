let historyEl = document.getElementById("history");
let liveEl = document.getElementById("live");
let totalEl = document.getElementById("total");
let tokens = [];

function tap(fn){
  let ok = fn();
  if(ok && navigator.vibrate) navigator.vibrate(15);
}

function clean(n){ return Number(parseFloat(n).toFixed(12)); }

function scrollHistoryToBottom(){
  requestAnimationFrame(()=>{ historyEl.scrollTop = historyEl.scrollHeight; });
}

/* STORAGE LOGIC */
function saveToLocal() {
  localStorage.setItem("calc_history_html", historyEl.innerHTML);
}

function loadFromLocal() {
  const saved = localStorage.getItem("calc_history_html");
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

function formatIN(str){
  if(str === "" || str === "-") return str;
  let [i,d] = String(str).split(".");
  i = i.replace(/\D/g,"");
  let last3 = i.slice(-3);
  let rest = i.slice(0,-3);
  if(rest) rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g,",");
  return (rest ? rest + "," : "") + last3 + (d !== undefined ? "." + d : "");
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

/* GST LOGIC: +GST adds to total, -GST extracts from total */
function applyGST(rate) {
  if(!tokens.length || isNaN(tokens.at(-1))) return false;
  
  let currentVal = evaluate();
  let gstAmount = 0;
  let label = "";

  if(rate > 0) { // Add GST
    gstAmount = clean(currentVal * (rate / 100));
    label = `+${rate}%G`;
  } else { // Remove GST (Reverse calculation)
    let r = Math.abs(rate);
    gstAmount = clean(currentVal - (currentVal / (1 + r/100)));
    gstAmount = -gstAmount; 
    label = `-${r}%G`;
  }

  tokens.push({ text: label, value: gstAmount });
  updateLive();
  return true;
}

function digit(d){
  let last = tokens.at(-1);
  if(!tokens.length){ tokens.push(d === "." ? "0." : d); updateLive(); return true; }
  if(last === "-" && tokens.length === 1){ tokens[0] = d === "." ? "-0." : "-" + d; updateLive(); return true; }
  if(["+","-","×","÷"].includes(last)){ tokens.push(d === "." ? "0." : d); updateLive(); return true; }
  if(typeof last === "object") return false;
  if(d === "." && last.includes(".")) return false;
  let pure = last.replace("-","").replace(".","");
  if(d !== "." && pure.length >= 12) return false;
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

function evaluate(){
  if(!tokens.length) return 0;
  let exp = tokens.map(t => (typeof t === "object" ? t.value : t)).join(" ")
    .replace(/×/g,"*").replace(/÷/g,"/");
  try { return clean(Function("return " + exp)()); } catch { return 0; }
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
  tokens = [];
  updateLive();
  recalculateGrandTotal();
  scrollHistoryToBottom();
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
  if(confirm("Clear all history?")) {
    tokens = [];
    historyEl.innerHTML = "";
    updateLive();
    recalculateGrandTotal();
    return true;
  }
  return false;
}

/* Long Press Backspace */
let cutTimer = null, cutLong = false;
function cutPressStart(e){ e.preventDefault(); cutLong = false; cutTimer = setTimeout(()=>{ if(tokens.length){ tokens = []; updateLive(); navigator.vibrate && navigator.vibrate(25); } cutLong = true; },450); }
function cutPressEnd(e){ e.preventDefault(); clearTimeout(cutTimer); if(!cutLong && back()) navigator.vibrate && navigator.vibrate(15); }
function cutPressCancel(){ clearTimeout(cutTimer); }

function enableSwipe(row){
  let sx=0, dx=0, drag=false;
  row.addEventListener("pointerdown", e=>{ sx = e.clientX; drag = true; row.classList.add("swiping"); row.style.transition = "none"; });
  row.addEventListener("pointermove", e=>{ if(!drag) return; dx = e.clientX - sx; if(dx < 0) row.style.transform = `translateX(${dx}px)`; });
  row.addEventListener("pointerup", ()=>{
    drag = false; row.style.transition = "transform .25s ease";
    if(Math.abs(dx) > row.offsetWidth * 0.35){
      row.style.transform = "translateX(-100%)";
      setTimeout(()=>{ row.remove(); recalculateGrandTotal(); },200);
    } else { row.style.transform = "translateX(0)"; row.classList.remove("swiping"); }
    dx = 0;
  });
}

// Initialize load
loadFromLocal();
updateLive();
