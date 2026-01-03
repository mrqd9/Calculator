let historyEl = document.getElementById("history");
let liveEl = document.getElementById("live");
let totalEl = document.getElementById("total");
let archiveModal = document.getElementById("archive-modal");
let archiveList = document.getElementById("archive-list");
let tokens = [];
let activeSessionId = null;

function pulse() { if (navigator.vibrate) navigator.vibrate(30); }
function tap(fn){ let result = fn(); if(result !== false) pulse(); }

function clean(n){
  if (isNaN(n)) return 0;
  let val = Math.round((n + Number.EPSILON) * 1e12) / 1e12;
  return Math.abs(val) > 1e15 ? val.toExponential(4) : val;
}

function toBillingString(val) {
  let n = Number(val);
  if (Math.abs(n) >= 1e14) return n.toExponential(4); 
  return n.toFixed(2);
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
  let displaySum = toBillingString(sum);
  totalEl.innerText = formatIN(displaySum);
  historyEl.setAttribute('data-total', totalEl.innerText);
  totalEl.classList.toggle("negative", sum < 0);
  saveToLocal();
}

function saveToLocal() { 
  localStorage.setItem("billing_calc_history", historyEl.innerHTML); 
  localStorage.setItem("active_session_id", activeSessionId || "");
}

function loadFromLocal() {
  const saved = localStorage.getItem("billing_calc_history");
  activeSessionId = localStorage.getItem("active_session_id") || null;
  if(saved) {
    historyEl.innerHTML = saved;
    document.querySelectorAll(".h-row").forEach(enableSwipe);
    recalculateGrandTotal();
  }
}

function clearAll(){
  if(!tokens.length && !historyEl.innerHTML) return false;
  if(historyEl.innerHTML.trim()) {
    let archive = JSON.parse(localStorage.getItem("calc_archive") || "[]");
    const ts = new Date().toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
    let rowsData = [];
    document.querySelectorAll(".h-row").forEach(row => { 
        rowsData.push({ exp: row.querySelector(".h-exp").innerText, res: row.querySelector(".h-res").innerText, val: Number(row.dataset.value) }); 
    });
    let sessionData = { id: activeSessionId || Date.now(), time: ts, data: rowsData, total: totalEl.innerText, rawTotal: getGrandSum() };
    if (activeSessionId) archive = archive.filter(item => item.id != activeSessionId);
    archive.unshift(sessionData);
    if(archive.length > 20) archive.pop();
    localStorage.setItem("calc_archive", JSON.stringify(archive));
  }
  tokens = []; historyEl.innerHTML = ""; activeSessionId = null; updateLive(); recalculateGrandTotal();
  return true;
}

function restoreSession(index) {
  const archive = JSON.parse(localStorage.getItem("calc_archive") || "[]");
  const session = archive[index];
  if (!session) return;
  clearAll(); 
  activeSessionId = session.id;
  session.data.forEach(rowData => {
    let row = document.createElement("div");
    row.className = "h-row";
    row.dataset.value = rowData.val;
    row.innerHTML = `<span class="h-exp">${rowData.exp}</span><span class="h-res ${rowData.val < 0 ? 'negative' : ''}">${rowData.res}</span><div class="swipe-arrow"></div>`;
    
    const tester = document.createElement('span'); 
    tester.style.cssText = 'visibility:hidden; white-space:nowrap; font-size:15px; font-family:inherit; position:absolute; padding: 0 10px;';
    tester.innerText = rowData.exp; document.body.appendChild(tester);
    if (tester.offsetWidth > (historyEl.offsetWidth * 0.55)) row.classList.add("can-expand");
    document.body.removeChild(tester);

    enableSwipe(row);
    historyEl.appendChild(row);
  });
  recalculateGrandTotal(); closeArchive(); pulse();
}

function showArchive() {
  const archive = JSON.parse(localStorage.getItem("calc_archive") || "[]");
  archiveList.innerHTML = archive.length === 0 ? "<div style='text-align:center; padding:40px; color:#999;'>No history records found</div>" : "";
  archive.forEach((item, idx) => {
    let rowsHtml = item.data.map(row => `<div class="archive-data-row"><span style="color:#666; flex:1; text-align:left;">${row.exp}</span><span class="${row.val < 0 ? 'negative' : ''}" style="font-weight:600;">${row.res}</span></div>`).join("");
    archiveList.innerHTML += `
      <div class="archive-item">
        <div class="h-card-actions archive-header-strip">
          <span class="h-time">${item.time} ${activeSessionId == item.id ? '<b style="color:#2e7d32;">(EDITING)</b>' : ''}</span>
          <div class="h-icon-group">
            <span class="card-icon" onclick="restoreSession(${idx})"><svg viewBox="0 0 24 24" width="18" height="18" fill="#2e7d32"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></span>
          </div>
        </div>
        <div class="archive-data">${rowsHtml}</div>
        <div class="archive-total-row"><span>TOTAL</span><span class="${item.rawTotal < 0 ? 'negative' : ''}">₹${item.total}</span></div>
      </div>`;
  });
  archiveModal.style.display = "block"; window.history.pushState({ modal: "archive" }, "");
}

function copyToClipboard() {
  const history = document.querySelectorAll(".h-row");
  if (history.length === 0) return false;
  let text = "SUMMARY\n\n";
  history.forEach(row => { text += `${row.querySelector(".h-exp").innerText} ${row.querySelector(".h-res").innerText}\n`; });
  text += `\nGRAND TOTAL: ₹${totalEl.innerText}`;
  
  const btn = document.getElementById('copy-btn');
  const doFeedback = () => {
    btn.classList.add('success');
    setTimeout(() => btn.classList.remove('success'), 400);
  };

  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(doFeedback);
  } else {
    const textArea = document.createElement("textarea");
    textArea.value = text; document.body.appendChild(textArea);
    textArea.select(); document.execCommand('copy');
    document.body.removeChild(textArea); doFeedback();
  }
}

function clearArchive() { if (!confirm("Delete all history?")) return; localStorage.removeItem("calc_archive"); showArchive(); pulse(); }
function closeArchive() { archiveModal.style.display = "none"; if (window.history.state?.modal === "archive") window.history.back(); }
window.onpopstate = () => { if (archiveModal.style.display === "block") archiveModal.style.display = "none"; };

function formatIN(str){
  if(str === "" || str === "-" || str.includes('e')) return str;
  let [i, d] = String(str).split("."); let sign = i.startsWith("-") ? "-" : "";
  i = i.replace(/\D/g, ""); if (i.length > 12) return Number(str).toExponential(4);
  let last3 = i.slice(-3), rest = i.slice(0, -3);
  if(rest) rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
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
  let currentEval = evaluate();
  let liveTotalDisplay = tokens.length > 1 ? `<span style="opacity: 0.5; font-size: 1.1em; margin-left: 10px; font-weight: 500; white-space: nowrap;">= ${formatIN(toBillingString(currentEval))}</span>` : "";
  liveEl.innerHTML = text ? `${text}<span class="caret"></span>${liveTotalDisplay}` : `<span class="caret"></span>`;
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
  let last = tokens.at(-1), val = Number(last);
  if(isNaN(last) || typeof last === "object") return false;
  if (tokens.length === 1) {
    let gSum = getGrandSum();
    if (gSum !== 0) {
      tokens[0] = { text: formatIN(last) + "%", value: clean(val / 100) };
      tokens.push("×"); tokens.push(Math.abs(gSum).toString());
      updateLive(); return true;
    }
  }
  let operator = tokens.at(-2), subtotal = Number(tokens[0]);
  for(let i = 1; i < tokens.length - 2; i += 2){
    let op = tokens[i], t = tokens[i+1], v = Number(typeof t === "object" ? t.value : t);
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
  row.className = "h-row"; row.dataset.value = result; 
  let expText = tokens.map(formatTokenForDisplay).join(" "), resText = formatIN(toBillingString(result));
  row.innerHTML = `<span class="h-exp">${expText} =</span><span class="h-res ${result < 0 ? 'negative' : ''}">${resText}</span><div class="swipe-arrow"></div>`;
  const tester = document.createElement('span'); tester.style.cssText = 'visibility:hidden; white-space:nowrap; font-size:15px; font-family:inherit; position:absolute; padding: 0 10px;';
  tester.innerText = expText + " ="; document.body.appendChild(tester);
  if (tester.offsetWidth > (historyEl.offsetWidth * 0.55)) row.classList.add("can-expand");
  document.body.removeChild(tester);
  enableSwipe(row); historyEl.appendChild(row);
  tokens = []; updateLive(); recalculateGrandTotal();
  setTimeout(() => row.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
  return true;
}

function evaluate(){
  let tempTokens = [...tokens]; while (tempTokens.length > 0 && ["+", "-", "×", "÷"].includes(tempTokens.at(-1))) { tempTokens.pop(); }
  if (tempTokens.length === 0) return 0;
  let exp = tempTokens.map(t => (typeof t === "object" ? t.value : t)).join(" ").replace(/×/g, "*").replace(/÷/g, "/");
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

let cutTimer = null, cutLong = false;
function cutPressStart(e){ cutLong = false; cutTimer = setTimeout(()=>{ if(tokens.length){ tokens = []; updateLive(); pulse(); } cutLong = true; },450); }
function cutPressEnd(e){ clearTimeout(cutTimer); if(!cutLong && back()) pulse(); }
function cutPressCancel(){ clearTimeout(cutTimer); }

function enableSwipe(row){
  let sx=0, dx=0, dragging=false;
  row.onclick = (e) => { e.stopPropagation(); if (row.classList.contains("swiping") || !row.classList.contains("can-expand")) return; const isExpanded = row.classList.contains("expanded"); document.querySelectorAll(".h-row.expanded").forEach(r => r.classList.remove("expanded")); if (!isExpanded) { row.classList.add("expanded"); pulse(); setTimeout(() => row.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100); } };
  row.addEventListener("touchstart", e => { sx = e.touches[0].clientX; dragging = true; row.style.transition = "none"; }, {passive: true});
  row.addEventListener("touchmove", e => { if(!dragging) return; dx = e.touches[0].clientX - sx; if(dx < 0) { row.classList.add("swiping"); row.style.transform = `translateX(${dx}px)`; } }, {passive: true});
  row.addEventListener("touchend", () => { dragging = false; row.style.transition = "transform 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28)"; const threshold = row.offsetWidth * 0.5; if(Math.abs(dx) > threshold){ row.style.transform = "translateX(-110%)"; pulse(); setTimeout(()=>{ row.remove(); recalculateGrandTotal(); }, 250); } else { row.style.transform = "translateX(0)"; setTimeout(() => row.classList.remove("swiping"), 300); } dx = 0; });
}

document.addEventListener("click", () => { document.querySelectorAll(".h-row.expanded").forEach(r => r.classList.remove("expanded")); });
loadFromLocal();
updateLive();
