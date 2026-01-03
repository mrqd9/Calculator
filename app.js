let historyEl = document.getElementById("history");
let liveEl = document.getElementById("live");
let totalEl = document.getElementById("total");
let archiveModal = document.getElementById("archive-modal");
let archiveList = document.getElementById("archive-list");
let tokens = [];
let activeSessionId = null; // New: Tracks which session we are currently editing

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
  localStorage.setItem("active_session_id", activeSessionId || ""); // Save the ID state
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

/** UPDATED: Saves or Overwrites existing sessions */
function clearAll(){
  if(!tokens.length && !historyEl.innerHTML) return false;
  if(historyEl.innerHTML.trim()) {
    let archive = JSON.parse(localStorage.getItem("calc_archive") || "[]");
    const ts = new Date().toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
    
    let rowsData = [];
    document.querySelectorAll(".h-row").forEach(row => { 
        rowsData.push({ exp: row.querySelector(".h-exp").innerText, res: row.querySelector(".h-res").innerText, val: Number(row.dataset.value) }); 
    });

    let sessionData = { 
      id: activeSessionId || Date.now(), // Use existing ID or create new
      time: ts, 
      data: rowsData, 
      total: totalEl.innerText, 
      rawTotal: getGrandSum() 
    };

    if (activeSessionId) {
      // Find and remove old version to avoid duplicates
      archive = archive.filter(item => item.id != activeSessionId);
    }
    
    archive.unshift(sessionData); // Always put latest change on top
    if(archive.length > 20) archive.pop();
    localStorage.setItem("calc_archive", JSON.stringify(archive));
  }
  
  tokens = []; 
  historyEl.innerHTML = ""; 
  activeSessionId = null; // Reset ID for a fresh start
  updateLive(); 
  recalculateGrandTotal();
  return true;
}

/** RESTORE LOGIC: Remembers the ID of the card being edited */
function restoreSession(index) {
  const archive = JSON.parse(localStorage.getItem("calc_archive") || "[]");
  const session = archive[index];
  if (!session) return;
  
  // Important: Save current work before clearing, but don't reset activeSessionId yet
  const currentId = activeSessionId;
  clearAll(); 
  
  activeSessionId = session.id; // Set global ID to the one we are editing
  
  session.data.forEach(rowData => {
    let row = document.createElement("div");
    row.className = "h-row";
    row.dataset.value = rowData.val;
    row.innerHTML = `<span class="h-exp">${rowData.exp}</span><span class="h-res ${rowData.val < 0 ? 'negative' : ''}">${rowData.res}</span><div class="swipe-arrow"></div>`;
    enableSwipe(row);
    historyEl.appendChild(row);
  });
  
  recalculateGrandTotal();
  closeArchive();
  pulse();
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
            <span class="card-icon" onclick="restoreSession(${idx})">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="#2e7d32"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
            </span>
            <span class="card-icon" onclick="shareArchiveItem(${idx})">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="#2e7d32"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 0 5.414 0 12.05c0 2.123.55 4.197 1.592 6.023L0 24l6.135-1.61a11.75 11.75 0 005.91 1.586h.005c6.637 0 12.05-5.414 12.05-12.05a11.77 11.77 0 00-3.51-8.52z"/></svg>
            </span>
            <span class="card-icon" onclick="window.print()">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="#2e7d32"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>
            </span>
          </div>
        </div>
        <div class="archive-data">${rowsHtml}</div>
        <div class="archive-total-row"><span>TOTAL</span><span class="${item.rawTotal < 0 ? 'negative' : ''}">₹${item.total}</span></div>
      </div>`;
  });
  archiveModal.style.display = "block";
  window.history.pushState({ modal: "archive" }, "");
}

function shareArchiveItem(idx) {
  const archive = JSON.parse(localStorage.getItem("calc_archive") || "[]");
  const item = archive[idx];
  let text = `*📋 BILL (${item.time})*\n\n`;
  item.data.forEach(r => { text += `▪️ ${r.exp} *₹${r.res}*\n`; });
  text += `\n--------------------------\n*TOTAL: ₹${item.total}*`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

function clearArchive() {
  if (!confirm("Are you sure you want to permanently delete all archived records?")) return false;
  localStorage.removeItem("calc_archive");
  showArchive();
  pulse();
}

function closeArchive() { archiveModal.style.display = "none"; if (window.history.state?.modal === "archive") window.history.back(); }
window.onpopstate = () => { if (archiveModal.style.display === "block") archiveModal.style.display = "none"; };

function formatIN(str){
  if(str === "" || str === "-" || str.includes('e')) return str;
  let [i, d] = String(str).split(".");
  let sign = i.startsWith("-") ? "-" : "";
  i = i.replace(/\D/g, "");
  if (i.length > 12) return Number(str).toExponential(4);
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
  let liveTotalDisplay = tokens.length > 1 ? `<span style="opacity: 0.5; font-size: 0.85em; margin-left: 8px; font-weight: 400; white-space: nowrap;">= ${formatIN(toBillingString(currentEval))}</span>` : "";
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

function shareWhatsApp() {
  const history = document.querySelectorAll(".h-row"); if (history.length === 0) return false;
  let billText = "*📋 BILLING SUMMARY*\n\n";
  history.forEach(row => { billText += `▪️ ${row.querySelector(".h-exp").innerText} *₹${row.querySelector(".h-res").innerText}*\n`; });
  billText += `\n--------------------------\n*GRAND TOTAL: ₹${totalEl.innerText}*`;
  window.open(`https://wa.me/?text=${encodeURIComponent(billText)}`, '_blank');
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
if(archiveModal) archiveModal.style.display = "none";
loadFromLocal();
updateLive();
