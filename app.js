let historyEl = document.getElementById("history");
let liveEl = document.getElementById("live");
let totalEl = document.getElementById("total");
let archiveModal = document.getElementById("archive-modal");
let archiveList = document.getElementById("archive-list");
let tokens = [];

function pulse() { if (navigator.vibrate) navigator.vibrate(30); }
function tap(fn){ let ok = fn(); if(ok) pulse(); }

function clean(n){
  if (isNaN(n)) return 0;
  let val = Math.round((n + Number.EPSILON) * 1e12) / 1e12;
  return Math.abs(val) > 1e13 ? val.toExponential(4) : val;
}

function getGrandSum() {
  let sum = 0;
  document.querySelectorAll(".h-row").forEach(row => {
    let v = Number(row.dataset.value);
    if(!isNaN(v)) sum += v;
  });
  return clean(sum);
}

function recalculateGrandTotal(){
  let sum = getGrandSum();
  totalEl.innerText = formatIN(sum.toString());
  totalEl.classList.toggle("negative", sum < 0);
  saveToLocal();
}

function saveToLocal() { localStorage.setItem("billing_calc_history", historyEl.innerHTML); }
function loadFromLocal() {
  const saved = localStorage.getItem("billing_calc_history");
  if(saved) {
    historyEl.innerHTML = saved;
    document.querySelectorAll(".h-row").forEach(enableSwipe);
    recalculateGrandTotal();
  }
}

function clearAll(){
  if(!tokens.length && !historyEl.innerHTML) return false;
  const currentHistory = historyEl.innerHTML.trim();
  if(currentHistory) {
    let archive = JSON.parse(localStorage.getItem("calc_archive") || "[]");
    const ts = new Date().toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
    let rowsData = [];
    document.querySelectorAll(".h-row").forEach(row => { 
        rowsData.push({ exp: row.querySelector(".h-exp").innerText, res: row.querySelector(".h-res").innerText }); 
    });
    archive.unshift({ time: ts, data: rowsData, total: totalEl.innerText });
    if(archive.length > 10) archive.pop();
    localStorage.setItem("calc_archive", JSON.stringify(archive));
  }
  tokens = []; historyEl.innerHTML = ""; updateLive(); recalculateGrandTotal();
  return true;
}

function showArchive() {
  const archive = JSON.parse(localStorage.getItem("calc_archive") || "[]");
  archiveList.innerHTML = archive.length === 0 ? "<div style='text-align:center; padding:20px;'>No previous history</div>" : "";
  archive.forEach(item => {
    let html = `<div class="archive-item"><div class="archive-time">${item.time}</div><div class="archive-data">`;
    item.data.forEach(row => { html += `<div>${row.exp} ${row.res}</div>`; });
    html += `<div style="font-weight:800; margin-top:5px; border-top:1px solid rgba(0,0,0,0.1);">Total: ${item.total}</div></div></div>`;
    archiveList.innerHTML += html;
  });
  archiveModal.style.display = "block";
  return true;
}
function closeArchive() { archiveModal.style.display = "none"; }

function formatIN(str){
  if(str === "" || str === "-" || str.includes('e')) return str;
  let [i,d] = String(str).split(".");
  let sign = i.startsWith("-") ? "-" : "";
  i = i.replace(/\D/g,"");
  if (i.length > 13) return Number(str).toExponential(4);
  let last3 = i.slice(-3);
  let rest = i.slice(0,-3);
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
  liveEl.scrollTop = liveEl.scrollHeight;
}

function digit(d){
  let last = tokens.at(-1);
  if(typeof last === "object") { tokens.push("×"); tokens.push(d === "." ? "0." : d); updateLive(); return true; }
  if(!tokens.length){ tokens.push(d === "." ? "0." : d); updateLive(); return true; }
  if(last === "-" && tokens.length === 1){ tokens[0] = d === "." ? "-0." : "-" + d; updateLive(); return true; }
  if(["+","-","×","÷"].includes(last)){ tokens.push(d === "." ? "0." : d); updateLive(); return true; }
  if(d === "." && last.includes(".")) return false;
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
  if (tokens.length === 1) {
    let gSum = getGrandSum();
    if (gSum !== 0) {
      tokens[0] = { text: formatIN(last) + "%", value: clean(val / 100) };
      tokens.push("×"); tokens.push(Math.abs(gSum).toString());
      updateLive(); return true;
    }
  }
  let operator = tokens.at(-2);
  let subtotal = Number(tokens[0]);
  for(let i = 1; i < tokens.length - 2; i += 2){
    let op = tokens[i], t = tokens[i+1];
    let v = Number(typeof t === "object" ? t.value : t);
    if(op === "+") subtotal += v; if(op === "-") subtotal -= v;
    if(op === "×") subtotal *= v; if(op === "÷") subtotal /= v;
  }
  let finalVal = (operator === "+" || operator === "-") ? clean(Math.abs(subtotal) * val / 100) : clean(val / 100);
  tokens[tokens.length - 1] = { text: formatIN(last) + "%", value: finalVal };
  updateLive(); return true;
}

function enter(){
  if(!tokens.length) return false;
  let result = evaluate();
  let row = document.createElement("div");
  row.className = "h-row";
  row.dataset.value = result;
  row.innerHTML = `<span class="h-exp">${tokens.map(formatTokenForDisplay).join(" ")}</span><span class="h-res">${formatIN(result.toString())}</span>`;
  if(result < 0) row.querySelector(".h-res").classList.add("negative");
  enableSwipe(row);
  historyEl.appendChild(row);
  tokens = []; updateLive(); recalculateGrandTotal();
  requestAnimationFrame(()=> historyEl.scrollTop = historyEl.scrollHeight);
  return true;
}

function evaluate(){
  let exp = tokens.map(t => (typeof t === "object" ? t.value : t)).join(" ").replace(/×/g,"*").replace(/÷/g,"/");
  try { return clean(new Function("return " + exp)()); } catch { return 0; }
}

function back(){
  if(!tokens.length) return false;
  let last = tokens.at(-1);
  if(typeof last === "object" || ["+","-","×","÷"].includes(last)) tokens.pop();
  else if(last.length > 1) tokens[tokens.length - 1] = last.slice(0,-1);
  else tokens.pop();
  updateLive(); return true;
}

function shareWhatsApp() {
  const history = document.querySelectorAll(".h-row");
  if (history.length === 0) return false;
  let billText = "*📋 BILLING SUMMARY*\n\n";
  history.forEach(row => { const exp = row.querySelector(".h-exp").innerText; const res = row.querySelector(".h-res").innerText; billText += `▪️ ${exp}: *₹${res}*\n`; });
  billText += `\n--------------------------\n*GRAND TOTAL: ₹${totalEl.innerText}*`;
  window.open(`https://wa.me/?text=${encodeURIComponent(billText)}`, '_blank');
  return true;
}

let cutTimer = null, cutLong = false;
function cutPressStart(e){ e.preventDefault(); cutLong = false; cutTimer = setTimeout(()=>{ if(tokens.length){ tokens = []; updateLive(); pulse(); } cutLong = true; },450); }
function cutPressEnd(e){ e.preventDefault(); clearTimeout(cutTimer); if(!cutLong && back()) pulse(); }
function cutPressCancel(){ clearTimeout(cutTimer); }

function enableSwipe(row){
  let sx=0, dx=0, dragging=false;
  row.onclick = (e) => {
    if (row.classList.contains("swiping")) return;
    const isExp = row.classList.contains("expanded");
    document.querySelectorAll(".h-row.expanded").forEach(r => r.classList.remove("expanded"));
    if (!isExp) { 
        row.classList.add("expanded"); 
        pulse();
    }
  };
  row.addEventListener("touchstart", e => { sx = e.touches[0].clientX; dragging = true; row.style.transition = "none"; }, {passive: true});
  row.addEventListener("touchmove", e => { if(!dragging) return; dx = e.touches[0].clientX - sx; if(dx < 0) { row.classList.add("swiping"); row.style.transform = `translateX(${dx}px)`; } }, {passive: true});
  row.addEventListener("touchend", () => {
    dragging = false; row.style.transition = "transform 0.2s ease";
    if(dx < -(row.offsetWidth * 0.4)){ row.style.transform = "translateX(-110%)"; pulse(); setTimeout(()=>{ row.remove(); recalculateGrandTotal(); }, 200); }
    else { row.style.transform = "translateX(0)"; setTimeout(()=> row.classList.remove("swiping"), 200); }
    dx = 0;
  });
}

document.addEventListener("click", e => { if (!e.target.closest(".h-row")) document.querySelectorAll(".h-row.expanded").forEach(r => r.classList.remove("expanded")); });

loadFromLocal();
updateLive();
