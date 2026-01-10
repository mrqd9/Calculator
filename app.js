/*
 * Adding Calculator Pro
 * Copyright (C) 2026 mrqd9
 * Licensed under GNU GPL v3 or later.
 */

/* =========================================
   1. SETUP & DOM ELEMENTS
   ========================================= */
const DOM = {
  displayContainer: document.querySelector(".display-container"),
  oldLive: document.getElementById("live"),
  history: document.getElementById("history"),
  total: document.getElementById("total"),
  archiveModal: document.getElementById("archive-modal"),
  archiveList: document.getElementById("archive-list"),
  copyBtn: document.getElementById("copy-btn")
};

// Create Custom Input Interface (Buttons Only Mode)
let liveWrapper = document.createElement("div");
liveWrapper.id = "live-wrapper";
liveWrapper.innerHTML = `
  <span id="live-input" contenteditable="true" inputmode="none" spellcheck="false" autocomplete="off"></span>
  <div id="custom-cursor" class="blinking"></div>
  <span id="live-total"></span>
`;

if (DOM.oldLive) DOM.oldLive.replaceWith(liveWrapper);

const liveInput = document.getElementById("live-input");
const liveTotal = document.getElementById("live-total");
const customCursor = document.getElementById("custom-cursor");

// App State
let tokens = [];
let activeSessionId = null;
let lastCaretPos = 0;
let currentPressedBtn = null;
let cutTimer = null;
let isLongPress = false;

/* =========================================
   2. INTERACTION ENGINE
   ========================================= */

function pulse() { 
  if (navigator.vibrate) navigator.vibrate(30); 
}

function triggerVisualFeedback(btn) {
  if (!btn) return;
  btn.classList.add("pressed");
  setTimeout(() => btn.classList.remove("pressed"), 100);
}

function tap(fn) { 
  let result = fn();
  if (result !== false) pulse();
  triggerVisualFeedback(currentPressedBtn);
  currentPressedBtn = null; 
}

// Convert HTML buttons to fast JS listeners
document.querySelectorAll('.btn-key').forEach(btn => {
  // A. Backspace (Long Press Logic)
  if (btn.classList.contains('cut')) {
    btn.removeAttribute('onpointerdown');
    btn.removeAttribute('onpointerup');
    btn.removeAttribute('onpointerleave');
    
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      currentPressedBtn = btn;
      isLongPress = false;
      
      cutTimer = setTimeout(() => {
        if(tokens.length > 0 || liveInput.innerText !== ""){
          liveInput.innerText = "";
          parseAndRecalculate(false);
          pulse();
          updateCursor();
          triggerVisualFeedback(btn);
        }
        isLongPress = true;
      }, 450);
    });

    btn.addEventListener('pointerup', (e) => {
      e.preventDefault();
      clearTimeout(cutTimer);
      if (!isLongPress) tap(back);
    });

    btn.addEventListener('pointerleave', (e) => {
      e.preventDefault();
      clearTimeout(cutTimer);
    });
    return;
  }

  // B. Standard Buttons
  let command = btn.getAttribute('onclick');
  if (command) {
    btn.removeAttribute('onclick'); 
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      currentPressedBtn = btn;
      try { eval(command); } catch (err) { console.error(err); }
    });
  }
});

/* =========================================
   3. INPUT LOGIC
   ========================================= */

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
         
         let textNode = range.startContainer;
         if (textNode.nodeType === 3) { 
             let opIndex = fullTextBefore.lastIndexOf(prevChar);
             if (opIndex !== -1) {
                 let replaceRange = document.createRange();
                 replaceRange.setStart(textNode, opIndex);
                 replaceRange.setEnd(textNode, range.startOffset);
                 sel.removeAllRanges();
                 sel.addRange(replaceRange);
             }
         }
       }
     }
     if (type === 'dot') {
       let fullText = liveInput.innerText.substring(0, range.startOffset);
       let lastSegment = fullText.split(/[\+\-\×\÷%]/).pop();
       if (lastSegment.includes('.')) return false; 
       if (lastSegment.trim() === "") char = "0.";
     }
  } else {
    if (type === 'op' && char !== '-') return false; 
    if (type === 'dot') char = "0.";
  }

  document.execCommand('insertText', false, char);
  return true; 
}

function digit(d){ return safeInsert(d, d === '.' ? 'dot' : 'num'); }
function setOp(op){ return safeInsert(op, 'op'); }

function back(){
  ensureFocus();
  if(liveInput.innerText === "") return false;
  document.execCommand('delete'); 
  return true;
}

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

function enter(){
  parseAndRecalculate(false); 
  if(!tokens.length) return false;
  
  let result = evaluate();
  let row = document.createElement("div");
  row.className = "h-row"; 
  row.dataset.value = result; 
  
  let expText = liveInput.innerText; 
  let resText = formatResultForHistory(result); 
  
  row.innerHTML = `<span class="h-exp">${expText} =</span><span class="h-res ${result < 0 ? 'negative' : ''}">${resText}</span><div class="swipe-arrow"></div>`;
  enableSwipe(row); 
  DOM.history.appendChild(row);
  
  liveInput.innerText = ""; 
  liveTotal.innerText = "";
  tokens = []; 
  
  recalculateGrandTotal();
  setTimeout(() => row.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
  liveInput.focus();
  updateCursor();
  return true;
}

/* =========================================
   4. MATH ENGINE (1e20 Limit)
   ========================================= */

function clean(n){
  if (isNaN(n)) return 0;
  let val = Math.round((n + Number.EPSILON) * 1e12) / 1e12;
  return Math.abs(val) > 1e20 ? val.toExponential(8) : val;
}

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
         return { text: restored, value: clean(val * suffixVal), isPercent: true };
      }

      let percentCount = (restored.match(/%/g) || []).length;
      let num = parseFloat(restored.replace(/%/g, ""));
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
      let nextToken = rawTokens[i + 1];
      let isNextScale = ["×", "÷", "*", "/"].includes(nextToken);

      if (t.count === 1 && !t.text.includes('%') ) { /*noop*/ } 
      else if (t.count === 1) {
          let percentVal = t.rawNum;
          if (isNextScale) {
             calculatedValue = clean(percentVal / 100);
          } else if (i === 0 || (i === 1 && rawTokens[0] === "-")) {
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
  liveTotal.innerText = tokens.length > 0 ? `= ${formatIN(toBillingString(currentEval))}` : "";
}

function evaluate(sourceTokens = tokens){
  let tempTokens = [...sourceTokens]; 
  while (tempTokens.length > 0 && ["+", "-", "×", "÷"].includes(tempTokens.at(-1))) { tempTokens.pop(); }
  if (tempTokens.length === 0) return 0;
  
  let exp = tempTokens.map(t => (typeof t === "object" ? t.value : t))
    .join(" ").replace(/×/g, "*").replace(/÷/g, "/");
    
  try { return clean(new Function("return " + exp)()); } catch { return 0; }
}

/* =========================================
   5. FORMATTING & HELPERS
   ========================================= */

function toBillingString(val) {
  let n = Number(val);
  return Math.abs(n) >= 1e20 ? n.toExponential(8) : n.toFixed(2);
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
  let formatted = formatIN(toBillingString(val));
  return formatted.length > 18 ? Number(val).toExponential(8) : formatted;
}

function getGrandSum() {
  let sum = 0;
  document.querySelectorAll(".h-row").forEach(row => {
    let v = Number(row.dataset.value);
    if(!isNaN(v)) sum += v;
  });
  return clean(sum);
}

function formatEquation(rawText) {
  let safe = rawText.replace(/e\+/gi, "__EP__").replace(/e\-/gi, "__EM__");
  let parts = safe.split(/([\+\-\×\÷%])/);
  return parts.map(part => {
    let restored = part.replace(/__EP__/g, "e+").replace(/__EM__/g, "e-");
    if (["+", "-", "×", "÷", "%"].includes(restored)) return ` ${restored} `;
    if (/^[0-9.,]+$/.test(restored) && !restored.toLowerCase().includes('e')) {
      return formatIN(restored.replace(/,/g, ""));
    }
    return restored;
  }).join("");
}

/* =========================================
   6. UI & CURSOR ENGINE (Smart Magnet)
   ========================================= */

// Move actual DOM caret
function setCaret(offset) {
  let textNode = liveInput.firstChild || liveInput;
  if (!textNode || textNode.nodeType !== 3) return;
  offset = Math.min(offset, textNode.length);
  offset = Math.max(0, offset);

  let range = document.createRange();
  range.setStart(textNode, offset);
  range.setEnd(textNode, offset);
  let sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  
  updateCursor(); 
}

function updateCursor() {
  let sel = window.getSelection();
  if (sel.rangeCount > 0 && sel.anchorNode && (liveInput.contains(sel.anchorNode) || sel.anchorNode === liveInput)) {
    let range = sel.getRangeAt(0);
    
    // Block Text Selection (Calculator Mode)
    if (!range.collapsed) {
       range.collapse(false); 
       sel.removeAllRanges();
       sel.addRange(range);
    }

    let rects = range.getClientRects();
    let rect, wrapperRect = liveWrapper.getBoundingClientRect();

    if (rects.length === 0) {
       let tempSpan = document.createElement("span");
       tempSpan.textContent = "\u200b"; 
       range.insertNode(tempSpan);
       rect = tempSpan.getBoundingClientRect();
       tempSpan.remove();
       range.setEnd(sel.anchorNode, range.startOffset); 
    } else {
       rect = rects[0]; 
    }
    
    customCursor.style.left = (rect.left - wrapperRect.left + liveWrapper.scrollLeft) + "px";
    customCursor.style.top = (rect.top - wrapperRect.top + liveWrapper.scrollTop) + "px";
    customCursor.style.height = rect.height + "px";
    
    // Auto-scroll
    if (rect.left < wrapperRect.left) liveWrapper.scrollLeft -= (wrapperRect.left - rect.left) + 15;
    if (rect.right > wrapperRect.right) liveWrapper.scrollLeft += (rect.right - wrapperRect.right) + 15;
  }
}

// Magnet Logic (Atomic Groups)
let isEnforcingCursor = false;

function enforceCursorConstraints() {
  if (isEnforcingCursor) return;
  
  let sel = window.getSelection();
  if (!sel.rangeCount || document.activeElement !== liveInput) return;
  
  let range = sel.getRangeAt(0);
  let offset = range.startOffset;
  let text = liveInput.innerText;
  
  let newOffset = offset;
  
  // 1. Comma Magnet: ",9" -> Snap left
  if (offset > 0 && text[offset - 1] === ',') {
      newOffset = offset - 1;
  }

  // 2. Operator Magnet: " + " -> Snap to edges
  else {
      let ops = ['+', '-', '×', '÷'];
      let isGhostChar = (c) => c === " " || ops.includes(c);
      
      let charBefore = offset > 0 ? text[offset - 1] : null;
      let charAfter = offset < text.length ? text[offset] : null;
      
      if ((charBefore && isGhostChar(charBefore)) || (charAfter && isGhostChar(charAfter))) {
          // Find Block Boundaries
          let start = offset;
          while (start > 0 && isGhostChar(text[start - 1])) start--;
          
          let end = offset;
          while (end < text.length && isGhostChar(text[end])) end++;
          
          // Find Inner Right (After Op, Before Space)
          let innerRight = end;
          while (innerRight > start && text[innerRight - 1] === " ") innerRight--;
          if (innerRight === start && text[start] === " ") innerRight = start;

          // Snap to closest
          let distStart = Math.abs(offset - start);
          let distInner = Math.abs(offset - innerRight);
          
          newOffset = (distStart < distInner) ? start : innerRight;
      }
  }

  if (newOffset !== offset) {
      isEnforcingCursor = true;
      setCaret(newOffset);
      setTimeout(() => { isEnforcingCursor = false; }, 0);
  }
}

function handleInput() {
  let originalText = liveInput.innerText;
  
  let sel = window.getSelection();
  let range = sel.getRangeAt(0);
  let preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(liveInput);
  preCaretRange.setEnd(range.endContainer, range.endOffset);
  let meaningfulIndex = preCaretRange.toString().replace(/[, ]/g, "").length;

  let rawText = originalText.replace(/[, ]/g, ""); 
  let formattedText = formatEquation(rawText);
  
  if (originalText !== formattedText) {
    liveInput.innerText = formattedText;
    
    let charCount = 0, newOffset = 0;
    if (meaningfulIndex === 0) newOffset = 0;
    else {
      for (let i = 0; i < formattedText.length; i++) {
        let char = formattedText[i];
        if (char !== "," && char !== " ") charCount++;
        if (charCount === meaningfulIndex) {
          newOffset = i + 1;
          break;
        }
      }
    }
    setCaret(newOffset);
  }
  
  parseAndRecalculate(false);
  requestAnimationFrame(enforceCursorConstraints);
}

// UI Listeners
liveWrapper.addEventListener("click", () => { 
  if (document.activeElement !== liveInput) liveInput.focus();
  setTimeout(enforceCursorConstraints, 10);
});

liveInput.addEventListener("contextmenu", (e) => { e.preventDefault(); return false; });

document.addEventListener('selectionchange', () => { 
  if (document.activeElement === liveInput) {
    updateCursor(); 
    enforceCursorConstraints(); 
  }
});

liveInput.addEventListener("input", handleInput);
liveInput.addEventListener("paste", (e) => e.preventDefault()); 
liveInput.addEventListener("focus", () => { liveWrapper.classList.add("focused"); updateCursor(); });
liveInput.addEventListener("blur", () => { liveWrapper.classList.remove("focused"); });

setTimeout(() => { ensureFocus(); updateCursor(); }, 100);

// Keyboard Interceptor
document.addEventListener('keydown', (e) => {
  const key = e.key; const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && key.toLowerCase() === 'p') { e.preventDefault(); tap(() => window.print()); } 
  else if (ctrl && key.toLowerCase() === 'c') { e.preventDefault(); tap(copyToClipboard); } 
  else if (key.toLowerCase() === 'h') { tap(showArchive); } 
  else if (key === 'Escape' || key === 'Delete') { tap(clearAll); }
  else if (key === 'Enter') { e.preventDefault(); tap(enter); }
  
  if (document.activeElement === liveInput) {
      // Allow native Arrows (selectionchange handles the snap)
      if (key === 'ArrowLeft' || key === 'ArrowRight') return; 
      e.preventDefault(); 
  }
});

/* =========================================
   7. DATA & HISTORY MANAGEMENT
   ========================================= */

function recalculateGrandTotal(){
  let sum = getGrandSum();
  let displaySum = toBillingString(sum);
  let finalText = formatIN(displaySum);

  DOM.total.innerText = finalText;
  DOM.history.setAttribute('data-total', finalText);
  
  // Linear Scaling: 26px -> 16px (16 chars -> 33 chars)
  let len = finalText.length;
  DOM.total.style.fontSize = len <= 16 
      ? "" 
      : Math.max(16, 26 - (len - 16) * 0.59) + "px";
      
  let isNeg = sum < 0;
  DOM.total.classList.toggle("negative", isNeg);
  let label = document.querySelector(".total-label");
  if(label) label.classList.toggle("is-negative", isNeg);
  saveToLocal();
}

function saveToLocal() { 
  localStorage.setItem("billing_calc_history", DOM.history.innerHTML); 
  localStorage.setItem("active_session_id", activeSessionId || "");
}

function loadFromLocal() {
  const saved = localStorage.getItem("billing_calc_history");
  activeSessionId = localStorage.getItem("active_session_id") || null;
  if(saved) {
    DOM.history.innerHTML = saved;
    document.querySelectorAll(".h-row").forEach(enableSwipe);
    recalculateGrandTotal();
  }
}

function clearAll(){
  let hasContent = tokens.length > 0 || DOM.history.innerHTML.trim() !== "";
  if(!hasContent) return false; 
  if (navigator.vibrate) navigator.vibrate(85); 
  
  if(DOM.history.innerHTML.trim()) {
    let archive = JSON.parse(localStorage.getItem("calc_archive") || "[]");
    const ts = new Date().toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
    let rowsData = [];
    document.querySelectorAll(".h-row").forEach(row => { 
        rowsData.push({ exp: row.querySelector(".h-exp").innerText, res: row.querySelector(".h-res").innerText, val: Number(row.dataset.value) }); 
    });
    let sessionData = { id: activeSessionId || Date.now(), time: ts, data: rowsData, total: DOM.total.innerText, rawTotal: getGrandSum() };
    if (activeSessionId) archive = archive.filter(item => item.id != activeSessionId);
    archive.unshift(sessionData);
    if(archive.length > 20) archive.pop();
    localStorage.setItem("calc_archive", JSON.stringify(archive));
  }
  
  tokens = []; liveInput.innerText = ""; liveTotal.innerText = ""; DOM.history.innerHTML = ""; activeSessionId = null; 
  recalculateGrandTotal(); liveInput.focus(); updateCursor();
  return false;
}

function restoreSession(index) {
  const archive = JSON.parse(localStorage.getItem("calc_archive") || "[]");
  const session = archive[index];
  if (!session) return;
  
  tokens = []; liveInput.innerText = ""; liveTotal.innerText = ""; DOM.history.innerHTML = ""; activeSessionId = session.id;
  session.data.forEach(rowData => {
    let row = document.createElement("div");
    row.className = "h-row";
    row.dataset.value = rowData.val;
    row.innerHTML = `<span class="h-exp">${rowData.exp}</span><span class="h-res ${rowData.val < 0 ? 'negative' : ''}">${rowData.res}</span><div class="swipe-arrow"></div>`;
    enableSwipe(row);
    DOM.history.appendChild(row);
  });
  recalculateGrandTotal(); closeArchive(); pulse();
}

function showArchive() {
  const archive = JSON.parse(localStorage.getItem("calc_archive") || "[]");
  DOM.archiveList.innerHTML = archive.length === 0 ? "<div style='text-align:center; padding:40px; color:#999;'>No history records found</div>" : "";
  archive.forEach((item, idx) => {
    let rowsHtml = item.data.map(row => `<div class="archive-data-row"><span style="color:#666; flex:1; text-align:left;">${row.exp}</span><span class="${row.val < 0 ? 'negative' : ''}" style="font-weight:600;">${row.res}</span></div>`).join("");
    DOM.archiveList.innerHTML += `
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
  DOM.archiveModal.style.display = "block"; window.history.pushState({ modal: "archive" }, "");
  return true; 
}

function restoreToLive(row) {
  let cleanText = row.querySelector(".h-exp").innerText.replace(/=/g, "").replace(/,/g, "").trim();
  liveInput.innerText = cleanText;
  handleInput(); liveInput.focus();
  
  let range = document.createRange();
  range.selectNodeContents(liveInput);
  range.collapse(false);
  let sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  pulse();
  setTimeout(() => {
    row.style.height = "0px"; row.style.margin = "0px"; row.style.opacity = "0";
    setTimeout(() => { row.remove(); recalculateGrandTotal(); }, 300);
  }, 300);
}

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

// Global Exports
window.closeArchive = () => { DOM.archiveModal.style.display = "none"; if (window.history.state?.modal === "archive") window.history.back(); };
window.restoreSession = restoreSession;
window.onpopstate = () => { if (DOM.archiveModal.style.display === "block") DOM.archiveModal.style.display = "none"; };
window.clearArchive = clearArchive;

// Init
const resizeObserver = new ResizeObserver(() => { DOM.history.scrollTop = DOM.history.scrollHeight; });
resizeObserver.observe(liveWrapper);
document.addEventListener("click", () => { document.querySelectorAll(".h-row.expanded").forEach(r => r.classList.remove("expanded")); });
loadFromLocal();
