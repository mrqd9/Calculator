/*
 * Adding Calculator Pro
 * Copyright (C) 2026 mrqd9
 * Licensed under GNU GPL v3 or later.
 */

let displayContainer = document.querySelector(".display-container");
let oldLive = document.getElementById("live");

let liveWrapper = document.createElement("div");
liveWrapper.id = "live-wrapper";

let inputSpan = document.createElement("span");
inputSpan.id = "live-input";
inputSpan.setAttribute("contenteditable", "true");
inputSpan.setAttribute("inputmode", "none"); 
inputSpan.setAttribute("spellcheck", "false");

let customCursor = document.createElement("div");
customCursor.id = "custom-cursor";
customCursor.classList.add("blinking");

let totalSpan = document.createElement("span");
totalSpan.id = "live-total";

liveWrapper.appendChild(inputSpan);
liveWrapper.appendChild(customCursor); 
liveWrapper.appendChild(totalSpan);

if (oldLive) oldLive.replaceWith(liveWrapper);

let historyEl = document.getElementById("history");
let liveInput = document.getElementById("live-input"); 
let liveTotal = document.getElementById("live-total"); 
let totalEl = document.getElementById("total");
let archiveModal = document.getElementById("archive-modal");
let archiveList = document.getElementById("archive-list");

let tokens = [];
let activeSessionId = null;
let lastCaretPos = 0;
let currentPressedBtn = null; 
let isProcessing = false; 

function pulse() { if (navigator.vibrate) navigator.vibrate(30); }

// --- CORE INTERACTION HANDLER ---
function tap(fn) { 
  if (isProcessing) return;
  isProcessing = true;
  setTimeout(() => { isProcessing = false; }, 150);

  let result = fn(); 
  
  if (result !== false) {
    pulse(); 
    if (currentPressedBtn) {
      let btn = currentPressedBtn;
      btn.classList.add("pressed");
      setTimeout(() => btn.classList.remove("pressed"), 100);
    }
  }
  currentPressedBtn = null; 
}

// --- EVENT LISTENERS ---
document.querySelectorAll('.btn-key').forEach(btn => {
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault(); 
    currentPressedBtn = btn; 
    btn.click(); 
  });
});

liveWrapper.addEventListener("click", () => {
  if (document.activeElement !== liveInput) liveInput.focus();
});

liveInput.addEventListener("focus", () => {
  liveWrapper.classList.add("focused");
  updateCursor();
});

liveInput.addEventListener("blur", () => {
  liveWrapper.classList.remove("focused");
});

liveInput.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  return false;
});

// --- HELPER FUNCTIONS ---
function clean(n){
  if (isNaN(n)) return 0;
  let val = Math.round((n + Number.EPSILON) * 1e12) / 1e12;
  return Math.abs(val) > 1e15 ? val.toExponential(8) : val;
}

function toBillingString(val) {
  let n = Number(val);
  if (Math.abs(n) >= 1e15) return n.toExponential(8); 
  return n.toFixed(2);
}

function formatIN(str){
  if(str === "" || str === "-" || str.includes('e')) return str;
  let [i, d] = String(str).split("."); 
  let sign = i.startsWith("-") ? "-" : "";
  i = i.replace(/[^0-9]/g, ""); 
  
  let last3 = i.slice(-3), rest = i.slice(0, -3);
  if(rest) rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  
  return sign + (rest ? rest + "," : "") + last3 + (d !== undefined ? "." + d : "");
}

function formatResultForHistory(val) {
  let cleanVal = toBillingString(val);
  let formatted = formatIN(cleanVal);
  if (formatted.length > 13) {
    return Number(val).toExponential(6);
  }
  return formatted;
}

function getGrandSum() {
  let sum = 0;
  document.querySelectorAll(".h-row").forEach(row => {
    let v = Number(row.dataset.value);
    if(!isNaN(v)) sum += v;
  });
  return clean(sum);
}

// --- CURSOR & FORMATTING ENGINE ---

function updateCursor() {
  let sel = window.getSelection();
  if (sel.rangeCount > 0 && sel.anchorNode && (liveInput.contains(sel.anchorNode) || sel.anchorNode === liveInput)) {
    let range = sel.getRangeAt(0);
    lastCaretPos = range.startOffset; 
    
    let rects = range.getClientRects();
    if (rects.length === 0) {
       let tempSpan = document.createElement("span");
       tempSpan.textContent = "\u200b"; 
       range.insertNode(tempSpan);
       let tempRect = tempSpan.getBoundingClientRect();
       tempSpan.remove();
       
       let wrapperRect = liveWrapper.getBoundingClientRect();
       customCursor.style.left = (tempRect.left - wrapperRect.left + liveWrapper.scrollLeft) + "px";
       customCursor.style.top = (tempRect.top - wrapperRect.top + liveWrapper.scrollTop) + "px";
       customCursor.style.height = tempRect.height + "px";
    } else {
       let rect = rects[0]; 
       let wrapperRect = liveWrapper.getBoundingClientRect();
       customCursor.style.left = (rect.left - wrapperRect.left + liveWrapper.scrollLeft) + "px";
       customCursor.style.top = (rect.top - wrapperRect.top + liveWrapper.scrollTop) + "px";
       customCursor.style.height = rect.height + "px";
    }
  }
}

document.addEventListener('selectionchange', () => {
  if (document.activeElement !== liveInput) return;
  let sel = window.getSelection();
  if (!sel.rangeCount) return;
  let range = sel.getRangeAt(0);
  let currentPos = range.startOffset;
  
  if (currentPos > 0) {
     let rangeClone = range.cloneRange();
     rangeClone.setStart(range.startContainer, currentPos - 1);
     
     let char = rangeClone.toString();
     if (char === "," || char === " ") {
        if (currentPos > lastCaretPos) {
           if (currentPos < liveInput.innerText.length) {
             range.setStart(range.startContainer, currentPos + 1);
             range.setEnd(range.startContainer, currentPos + 1);
             sel.removeAllRanges();
             sel.addRange(range);
           }
        } else {
           range.setStart(range.startContainer, currentPos - 1);
           range.setEnd(range.startContainer, currentPos - 1);
           sel.removeAllRanges();
           sel.addRange(range);
        }
     }
  }
  updateCursor();
});

function formatEquation(rawText) {
  let safe = rawText.replace(/e\+/gi, "__EP__").replace(/e\-/gi, "__EM__");
  
  let parts = safe.split(/([\+\-\×\÷%])/);
  return parts.map(part => {
    let restored = part.replace(/__EP__/g, "e+").replace(/__EM__/g, "e-");
    
    if (["+", "-", "×", "÷", "%"].includes(restored)) {
      return ` ${restored} `;
    }
    
    if (/^[0-9.,]+$/.test(restored) && !restored.toLowerCase().includes('e')) {
      return formatIN(restored.replace(/,/g, ""));
    }
    return restored;
  }).join("");
}

function handleInput() {
  let originalText = liveInput.innerText;
  
  let sel = window.getSelection();
  let range = sel.getRangeAt(0);
  let preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(liveInput);
  preCaretRange.setEnd(range.endContainer, range.endOffset);
  let textBeforeCaret = preCaretRange.toString();
  
  let meaningfulIndex = textBeforeCaret.replace(/[, ]/g, "").length;

  let rawText = originalText.replace(/[, ]/g, ""); 
  let formattedText = formatEquation(rawText);
  
  if (originalText !== formattedText) {
    liveInput.innerText = formattedText;
    
    let charCount = 0;
    let newOffset = 0;
    for (let i = 0; i < formattedText.length; i++) {
      let char = formattedText[i];
      if (char !== "," && char !== " ") charCount++;
      
      if (charCount === meaningfulIndex && char !== "," && char !== " ") {
        newOffset = i + 1;
        break;
      }
      if (meaningfulIndex === 0) { newOffset = 0; break; }
    }
    
    let newRange = document.createRange();
    let textNode = liveInput.firstChild || liveInput;
    if (textNode.nodeType === 3) {
        newOffset = Math.min(newOffset, textNode.length);
        newRange.setStart(textNode, newOffset);
        newRange.setEnd(textNode, newOffset);
        sel.removeAllRanges();
        sel.addRange(newRange);
        lastCaretPos = newOffset;
    }
  }

  parseAndRecalculate(false);
  
  requestAnimationFrame(() => {
    liveWrapper.scrollTop = liveWrapper.scrollHeight;
    updateCursor();
  });
}

function ensureFocus() {
  if (document.activeElement !== liveInput) {
    liveInput.focus();
    let range = document.createRange();
    range.selectNodeContents(liveInput);
    range.collapse(false);
    let sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

// --- LOGIC FUNCTIONS (Updated safeInsert) ---
function safeInsert(char, type) {
  ensureFocus();
  let sel = window.getSelection();
  if (!sel.rangeCount) return false;
  let range = sel.getRangeAt(0);

  if (range.startOffset > 0) {
     let fullTextBefore = liveInput.innerText.substring(0, range.startOffset);
     let prevChar = fullTextBefore.trim().slice(-1);

     if (type === 'op') {
       if (["+", "-", "×", "÷"].includes(prevChar) && char !== "%") { 
         if (prevChar === char) return false; 
         if (fullTextBefore.trim().length === 1 && prevChar === '-') return false; 
         return false;
       }
     }
     if (type === 'dot') {
       let fullText = liveInput.innerText.substring(0, range.startOffset);
       let lastSegment = fullText.split(/[\+\-\×\÷%]/).pop();
       
       if (lastSegment.includes('.')) return false; 
       
       // NEW: If starting a new number (empty/whitespace), insert "0."
       if (lastSegment.trim() === "") {
         char = "0.";
       }
     }
  } else {
    if (type === 'op' && char !== '-') return false; 
    // NEW: If at start, insert "0."
    if (type === 'dot') char = "0.";
  }

  document.execCommand('insertText', false, char);
  return true; 
}

function digit(d){ return safeInsert(d, d === '.' ? 'dot' : 'num'); }
function setOp(op){ return safeInsert(op, 'op'); }

function applyPercent(){ 
  if(!safeInsert("%", 'op')) return false;
  let rawText = liveInput.innerText.replace(/[, ]/g, "");
  if (/^[\+\-]?\d+(\.\d+)?%$/.test(rawText)) {
      let gSum = getGrandSum();
      if (gSum !== 0) {
          let gSumStr = formatIN(toBillingString(Math.abs(gSum)));
          document.execCommand('insertText', false, gSumStr);
      }
  }
  return true; 
}

function back(){
  ensureFocus();
  if(liveInput.innerText === "") return false;
  document.execCommand('delete'); 
  return true;
}

// --- CORE LOGIC ---
function parseAndRecalculate(resetCursor = true) {
  let rawText = liveInput.innerText.replace(/[, ]/g, "");
  
  let safeText = rawText.replace(/e\+/gi, "EE_PLUS").replace(/e\-/gi, "EE_MINUS");
  
  let parts = safeText.split(/([\+\-\×\÷])/).map(p => p.trim()).filter(p => p);
  
  let rawTokens = parts.map(part => {
    let restored = part.replace(/EE_PLUS/g, "e+").replace(/EE_MINUS/g, "e-");
    
    if (["+", "-", "×", "÷"].includes(restored)) return restored;
    
    if (restored.includes("%")) {
      let percentIndex = restored.lastIndexOf("%");
      let suffix = restored.substring(percentIndex + 1);
      
      if (suffix.length > 0 && !isNaN(parseFloat(suffix))) {
         let prefix = restored.substring(0, percentIndex);
         let pCount = (prefix.match(/%/g) || []).length + 1; 
         let numVal = parseFloat(prefix.replace(/%/g, ""));
         let suffixVal = parseFloat(suffix);
         
         let val = numVal;
         for(let k=0; k<pCount; k++) val = val / 100;
         val = val * suffixVal;
         
         return { text: restored, value: clean(val), isPercent: true };
      }

      let percentCount = (restored.match(/%/g) || []).length;
      let numStr = restored.replace(/%/g, "");
      let num = parseFloat(numStr);
      let val = num;
      for(let k=0; k<percentCount; k++) val = val / 100;
      return { text: restored, value: clean(val), isPercent: true, rawNum: num, count: percentCount };
    }
    return restored;
  });

  tokens = [];
  for (let i = 0; i < rawTokens.length; i++) {
    let t = rawTokens[i];
    if (typeof t === "object" && t.isPercent) {
      let calculatedValue = t.value; 
      if (t.count === 1 && !t.text.includes('%') ) { 
      } else if (t.count === 1) {
          let percentVal = t.rawNum;
          if (i === 0 || (i === 1 && rawTokens[0] === "-")) {
            let gSum = getGrandSum();
            if (gSum !== 0) calculatedValue = clean(Math.abs(gSum) * (percentVal / 100));
          } else if (i > 1) {
            let op = rawTokens[i - 1]; 
            if (op === "+" || op === "-") {
               let subExprTokens = tokens.slice(0, tokens.length - 1); 
               let runningTotal = evaluate(subExprTokens);
               calculatedValue = clean(Math.abs(runningTotal) * (percentVal / 100));
            }
          }
      }
      t.value = calculatedValue;
      tokens.push(t);
    } else {
      tokens.push(t);
    }
  }

  let currentEval = evaluate();
  if (tokens.length > 0) {
    liveTotal.innerText = `= ${formatIN(toBillingString(currentEval))}`;
  } else {
    liveTotal.innerText = "";
  }
}

function evaluate(sourceTokens = tokens){
  let tempTokens = [...sourceTokens]; 
  while (tempTokens.length > 0 && ["+", "-", "×", "÷"].includes(tempTokens.at(-1))) { tempTokens.pop(); }
  if (tempTokens.length === 0) return 0;
  
  let exp = tempTokens.map(t => (typeof t === "object" ? t.value : t))
    .join(" ")
    .replace(/×/g, "*")
    .replace(/÷/g, "/");
    
  try { return clean(new Function("return " + exp)()); } catch { return 0; }
}

liveInput.addEventListener("input", handleInput);
liveInput.addEventListener("paste", (e) => e.preventDefault()); 

function recalculateGrandTotal(){
  let sum = getGrandSum();
  let displaySum = toBillingString(sum);
  totalEl.innerText = formatIN(displaySum);
  historyEl.setAttribute('data-total', totalEl.innerText);
  
  let isNeg = sum < 0;
  totalEl.classList.toggle("negative", isNeg);
  
  // Update Label Dot Color
  let label = document.querySelector(".total-label");
  if(label) label.classList.toggle("is-negative", isNeg);
  
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
  let hasContent = tokens.length > 0 || historyEl.innerHTML.trim() !== "";
  if(!hasContent) return false; 
  
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
  
  tokens = []; 
  liveInput.innerText = ""; 
  liveTotal.innerText = "";
  historyEl.innerHTML = ""; 
  activeSessionId = null; 
  recalculateGrandTotal();
  liveInput.focus();
  updateCursor();
  return true;
}

function restoreSession(index) {
  const archive = JSON.parse(localStorage.getItem("calc_archive") || "[]");
  const session = archive[index];
  if (!session) return;
  
  tokens = []; liveInput.innerText = ""; liveTotal.innerText = ""; historyEl.innerHTML = ""; activeSessionId = null;
  
  activeSessionId = session.id;
  session.data.forEach(rowData => {
    let row = document.createElement("div");
    row.className = "h-row";
    row.dataset.value = rowData.val;
    row.innerHTML = `<span class="h-exp">${rowData.exp}</span><span class="h-res ${rowData.val < 0 ? 'negative' : ''}">${rowData.res}</span><div class="swipe-arrow"></div>`;
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
  return true; 
}

function enter(){
  parseAndRecalculate(false); 
  if(!tokens.length) return false;
  let result = evaluate();
  let row = document.createElement("div");
  row.className = "h-row"; row.dataset.value = result; 
  
  let expText = liveInput.innerText; 
  let resText = formatResultForHistory(result); 
  
  row.innerHTML = `<span class="h-exp">${expText} =</span><span class="h-res ${result < 0 ? 'negative' : ''}">${resText}</span><div class="swipe-arrow"></div>`;
  enableSwipe(row); historyEl.appendChild(row);
  
  liveInput.innerText = ""; 
  liveTotal.innerText = "";
  tokens = []; 
  
  recalculateGrandTotal();
  setTimeout(() => row.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
  liveInput.focus();
  updateCursor();
  return true;
}

function restoreToLive(row) {
  let expText = row.querySelector(".h-exp").innerText;
  let cleanText = expText.replace(/=/g, "").replace(/,/g, "").trim();
  
  liveInput.innerText = cleanText;
  handleInput(); 
  liveInput.focus();
  let range = document.createRange();
  let sel = window.getSelection();
  range.selectNodeContents(liveInput);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);

  pulse();
  setTimeout(() => {
    row.style.height = "0px";
    row.style.margin = "0px";
    row.style.opacity = "0";
    setTimeout(() => { row.remove(); recalculateGrandTotal(); }, 300);
  }, 300);
}

let cutTimer = null, cutLong = false;
function cutPressStart(e){ 
  cutLong = false; 
  cutTimer = setTimeout(()=>{ 
    // LONG PRESS
    if(tokens.length > 0 || liveInput.innerText !== ""){ 
      liveInput.innerText = ""; 
      parseAndRecalculate(false); 
      pulse(); 
      updateCursor(); 
      if(e.target) {
         e.target.classList.add("pressed"); 
         setTimeout(()=>e.target.classList.remove("pressed"), 100);
      }
    } 
    cutLong = true; 
  }, 450); 
}
function cutPressEnd(e){ 
  clearTimeout(cutTimer); 
  if(!cutLong) { 
    tap(back); 
  } 
}
function cutPressCancel(){ clearTimeout(cutTimer); }

function copyToClipboard() {
  const history = document.querySelectorAll(".h-row");
  if (history.length === 0) return false;
  let text = "SUMMARY\n\n";
  history.forEach(row => { text += `${row.querySelector(".h-exp").innerText} ${row.querySelector(".h-res").innerText}\n`; });
  text += `\nGRAND TOTAL: ₹${totalEl.innerText}`;
  if (navigator.clipboard) { navigator.clipboard.writeText(text); }
  const btn = document.getElementById('copy-btn');
  if(btn) { btn.classList.add('success'); setTimeout(() => btn.classList.remove('success'), 400); }
  return true;
}
function clearArchive() { if (!confirm("Delete all history?")) return; localStorage.removeItem("calc_archive"); showArchive(); pulse(); }
function closeArchive() { archiveModal.style.display = "none"; if (window.history.state?.modal === "archive") window.history.back(); }
window.onpopstate = () => { if (archiveModal.style.display === "block") archiveModal.style.display = "none"; };

function enableSwipe(row){
  let sx = 0, dx = 0, dragging = false;
  row.onclick = (e) => { 
    e.stopPropagation(); 
    if (row.classList.contains("swiping")) return; 
    
    if (row.classList.contains("expanded")) {
      row.classList.remove("expanded");
    } else {
      document.querySelectorAll(".h-row.expanded").forEach(r => r.classList.remove("expanded")); 
      row.classList.add("expanded"); 
      pulse(); 
      setTimeout(() => row.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100); 
    }
  };

  row.addEventListener("touchstart", e => { sx = e.touches[0].clientX; dragging = true; row.style.transition = "none"; }, {passive: true});
  row.addEventListener("touchmove", e => { 
    if(!dragging) return; dx = e.touches[0].clientX - sx; 
    let arrow = row.querySelector(".swipe-arrow");
    if (dx < 0) { 
      row.classList.add("swiping"); row.classList.remove("edit-mode"); row.style.transform = `translateX(${dx}px)`; 
      if(arrow) arrow.style.width = (14 + Math.abs(dx)) + "px"; 
    } else if (dx > 0) {
      row.classList.add("swiping"); row.classList.add("edit-mode"); row.style.transform = `translateX(${dx}px)`; 
      if(arrow) arrow.style.width = (14 + Math.abs(dx)) + "px"; 
    }
  }, {passive: true});
  row.addEventListener("touchend", () => { 
    dragging = false; row.style.transition = "transform 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28)"; 
    const threshold = row.offsetWidth * 0.4; 
    let arrow = row.querySelector(".swipe-arrow");
    if (dx < -threshold) { 
      row.style.transform = "translateX(-110%)"; pulse(); setTimeout(()=>{ row.remove(); recalculateGrandTotal(); }, 250); 
    } else if (dx > threshold) {
      row.style.transform = "translateX(110%)"; 
      if (tokens.length) { enter(); } 
      restoreToLive(row); 
    } else { 
      row.style.transform = "translateX(0)"; if(arrow) arrow.style.width = "14px"; setTimeout(() => row.classList.remove("swiping"), 300); 
    } dx = 0; 
  });
}

document.addEventListener("click", () => { document.querySelectorAll(".h-row.expanded").forEach(r => r.classList.remove("expanded")); });
loadFromLocal();

document.addEventListener('keydown', (e) => {
  if (archiveModal.style.display === "block") { if (e.key === 'Escape') closeArchive(); return; }
  const key = e.key; const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && key.toLowerCase() === 'p') { e.preventDefault(); tap(() => window.print()); } 
  else if (ctrl && key.toLowerCase() === 'c') { e.preventDefault(); tap(copyToClipboard); } 
  else if (key.toLowerCase() === 'h') { tap(showArchive); } 
  else if (/[0-9.]/.test(key)) { tap(() => digit(key)); e.preventDefault(); } 
  else if (key === '+') { tap(() => setOp('+')); e.preventDefault(); } 
  else if (key === '-') { tap(() => setOp('-')); e.preventDefault(); } 
  else if (key === '*' || key.toLowerCase() === 'x') { tap(() => setOp('×')); e.preventDefault(); } 
  else if (key === '/') { tap(() => setOp('÷')); e.preventDefault(); } 
  else if (key === '%') { tap(applyPercent); e.preventDefault(); } 
  else if (key === 'Enter' || key === '=') { e.preventDefault(); tap(enter); } 
  else if (key === 'Backspace') { /* Native backspace */ } 
  else if (key === 'Escape' || key === 'Delete') { tap(clearAll); }
});

const resizeObserver = new ResizeObserver(() => {
  historyEl.scrollTop = historyEl.scrollHeight;
});
resizeObserver.observe(liveWrapper);
