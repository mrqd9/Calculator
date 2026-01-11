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
  copyBtn: document.getElementById("copy-btn"),
  liveInput: null,
  liveTotal: null,
  customCursor: null,
  liveWrapper: null
};

const STATE = {
  tokens: [],
  activeSessionId: null,
  currentPressedBtn: null,
  cutTimer: null,
  isLongPress: false,
  isEnforcingCursor: false
};

// Initialize Custom Interface (No-Edit Mode)
(function setupInterface() {
  const wrapper = document.createElement("div");
  wrapper.id = "live-wrapper";
  wrapper.innerHTML = `
    <span id="live-input" tabindex="0" spellcheck="false" autocomplete="off"></span>
    <div id="custom-cursor" class="blinking"></div>
    <span id="live-total"></span>
  `;

  if (DOM.oldLive) DOM.oldLive.replaceWith(wrapper);
  
  DOM.liveWrapper = wrapper;
  DOM.liveInput = document.getElementById("live-input");
  DOM.liveTotal = document.getElementById("live-total");
  DOM.customCursor = document.getElementById("custom-cursor");
})();

/* =========================================
   2. UTILITIES & FORMATTING
   ========================================= */

const Utils = {
  vibrate: (ms) => { if (navigator.vibrate) navigator.vibrate(ms); },
  
  cleanNum: (n) => {
    if (isNaN(n)) return 0;
    let val = Math.round((n + Number.EPSILON) * 1e12) / 1e12;
    return Math.abs(val) > 1e20 ? val.toExponential(8) : val;
  },

  toBillingString: (val) => {
    let n = Number(val);
    return Math.abs(n) >= 1e20 ? n.toExponential(8) : n.toFixed(2);
  },

  formatIN: (str) => {
    if (str === "" || str === "-" || str.includes('e')) return str;
    let [i, d] = String(str).split(".");
    let sign = i.startsWith("-") ? "-" : "";
    i = i.replace(/[^0-9]/g, "");
    let last3 = i.slice(-3), rest = i.slice(0, -3);
    if (rest) rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    return sign + (rest ? rest + "," : "") + last3 + (d !== undefined ? "." + d : "");
  },

  getGrandSum: () => {
    let sum = 0;
    document.querySelectorAll(".h-row").forEach(row => {
      let v = Number(row.dataset.value);
      if (!isNaN(v)) sum += v;
    });
    return Utils.cleanNum(sum);
  }
};

/* =========================================
   3. INPUT CONTROLLER (Manual Logic)
   ========================================= */

const InputController = {
  config: {
    operators: ['+', '-', '×', '÷'],
    ghostChars: [' ', '+', '-', '×', '÷'], 
    regex: {
      isPercent: /^[\+\-]?\d+(\.\d+)?%$/, 
      splitSegments: /[\+\-\×\÷%]/,      
      cleanNum: /[, ]/g                  
    }
  },

  /* --- Cursor Management --- */
  Cursor: {
    ensureFocus() {
      if (document.activeElement !== DOM.liveInput) {
        DOM.liveInput.focus();
        const sel = window.getSelection();
        if (sel.rangeCount === 0) {
            const range = document.createRange();
            range.selectNodeContents(DOM.liveInput);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
        }
      }
    },

    setCaret(offset) {
      const textNode = DOM.liveInput.firstChild || DOM.liveInput;
      if (DOM.liveInput.innerText === "") {
         this.renderVisual();
         return;
      }
      
      if (!textNode || textNode.nodeType !== 3) return;
      offset = Math.max(0, Math.min(offset, textNode.length));

      const range = document.createRange();
      range.setStart(textNode, offset);
      range.setEnd(textNode, offset);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      this.renderVisual();
    },

    renderVisual() {
      const sel = window.getSelection();
      
      if (document.activeElement !== DOM.liveInput) {
         DOM.customCursor.style.opacity = "0"; 
         return;
      }
      DOM.customCursor.style.opacity = "1";

      if (sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      
      let rect;
      const rects = range.getClientRects();
      
      if (rects.length > 0) {
        rect = rects[0];
      } else {
        const tempSpan = document.createElement("span");
        tempSpan.textContent = "|";
        range.insertNode(tempSpan);
        rect = tempSpan.getBoundingClientRect();
        tempSpan.remove();
      }

      const wrapperRect = DOM.liveWrapper.getBoundingClientRect();
      
      let top = rect.top - wrapperRect.top + DOM.liveWrapper.scrollTop;
      let left = rect.left - wrapperRect.left + DOM.liveWrapper.scrollLeft;
      if (left < 0) left = 0;

      DOM.customCursor.style.height = `24px`; 
      DOM.customCursor.style.top = `${top}px`;
      DOM.customCursor.style.left = `${left}px`;

      // Auto-Scroll
      const buffer = 30;
      if (rect.left < wrapperRect.left + buffer) {
        DOM.liveWrapper.scrollLeft -= (wrapperRect.left - rect.left) + buffer;
      } else if (rect.right > wrapperRect.right - buffer) {
        DOM.liveWrapper.scrollLeft += (rect.right - wrapperRect.right) + buffer;
      }
    },

    handleManualTap(clientX, clientY) {
      setTimeout(() => {
          this.renderVisual();
          this.enforceConstraints();
      }, 0);
    },

    enforceConstraints() {
      if (STATE.isEnforcingCursor) return;
      const sel = window.getSelection();
      if (!sel.rangeCount) return;

      const range = sel.getRangeAt(0);
      const offset = range.startOffset;
      const text = DOM.liveInput.innerText;
      let newOffset = offset;

      if (offset > 0 && text[offset - 1] === ',') {
        newOffset = offset - 1;
      } else {
        const isGhost = (char) => InputController.config.ghostChars.includes(char);
        const charBefore = offset > 0 ? text[offset - 1] : null;
        const charAfter = offset < text.length ? text[offset] : null;

        if ((charBefore && isGhost(charBefore)) || (charAfter && isGhost(charAfter))) {
          let start = offset, end = offset;
          while (start > 0 && isGhost(text[start - 1])) start--;
          while (end < text.length && isGhost(text[end])) end++;

          let innerRight = end;
          while (innerRight > start && text[innerRight - 1] === " ") innerRight--;
          if (innerRight === start && text[start] === " ") innerRight = start;

          const distStart = Math.abs(offset - start);
          const distInner = Math.abs(offset - innerRight);
          newOffset = (distStart < distInner) ? start : innerRight;
        }
      }

      if (newOffset !== offset) {
        STATE.isEnforcingCursor = true;
        this.setCaret(newOffset);
        setTimeout(() => { STATE.isEnforcingCursor = false; }, 0);
      }
    }
  },

  /* --- Insertion Logic --- */
  Insert: {
    handle(char, type) {
      InputController.Cursor.ensureFocus();
      const sel = window.getSelection();
      let offset = 0;
      let text = DOM.liveInput.innerText;

      if (sel.rangeCount > 0) {
          offset = sel.getRangeAt(0).startOffset;
      } else {
          offset = text.length;
      }

      if (!this.validate(text, char, type, offset)) return false;

      // Operator Replacement
      if (type === 'op' && offset > 0) {
          const prevChar = text[offset - 1];
          const isPrevOp = InputController.config.operators.includes(prevChar);
          if (isPrevOp && char !== "%") {
              text = text.slice(0, offset - 1) + text.slice(offset);
              offset--; 
          }
      }

      const newText = text.slice(0, offset) + char + text.slice(offset);
      DOM.liveInput.innerText = newText;
      InputController.Format.process(newText, offset + 1);
      return true;
    },

    validate(fullText, char, type, offset) {
      const textBefore = fullText.substring(0, offset);
      const prevChar = textBefore.trim().slice(-1);
      
      const textAfter = fullText.substring(offset);
      const nextChar = textAfter.trim().charAt(0);

      if (offset === 0) {
        if (type === 'op' && char !== '-') return false;
        if (type === 'dot') {
           this.handle("0", "num");
           this.handle(".", "dot");
           return false; 
        }
        return true;
      }

      if (type === 'op') {
        const isPrevOp = InputController.config.operators.includes(prevChar);
        if (isPrevOp && prevChar === char) return false;
        if (textBefore.trim() === "-" && isPrevOp) return false;
        
        // Prevent stacking operators or %
        const isNextOp = InputController.config.operators.includes(nextChar);
        if (isNextOp) return false;
        if (char === '%' && (prevChar === '%' || nextChar === '%')) return false;
      }

      if (type === 'dot') {
        const lastSegment = textBefore.split(InputController.config.regex.splitSegments).pop();
        if (lastSegment.includes('.')) return false;
        if (lastSegment.trim() === "") {
           this.handle("0", "num");
           this.handle(".", "dot");
           return false;
        }
      }
      return true;
    },

    applyPercent() {
      if (!this.handle("%", 'op')) return false;
      const rawText = DOM.liveInput.innerText.replace(InputController.config.regex.cleanNum, "");
      
      if (InputController.config.regex.isPercent.test(rawText)) {
        const gSum = Utils.getGrandSum();
        if (gSum !== 0) {
           const gSumStr = Utils.formatIN(Utils.toBillingString(Math.abs(gSum)));
           const text = DOM.liveInput.innerText;
           DOM.liveInput.innerText = text + gSumStr;
           InputController.Format.process(DOM.liveInput.innerText, DOM.liveInput.innerText.length);
        }
      }
      return true;
    },

    backspace() {
      InputController.Cursor.ensureFocus();
      const text = DOM.liveInput.innerText;
      if (text === "") return false;

      const sel = window.getSelection();
      let offset = text.length; 
      if (sel.rangeCount > 0) offset = sel.getRangeAt(0).startOffset;

      if (offset === 0) return false;

      const newText = text.slice(0, offset - 1) + text.slice(offset);
      DOM.liveInput.innerText = newText;
      InputController.Format.process(newText, offset - 1);
      return true;
    }
  },

  /* --- Formatting Engine --- */
  Format: {
    process(text, desiredCursorPos) {
      const rawText = text.replace(InputController.config.regex.cleanNum, ""); 
      const formattedText = this.formatString(rawText);
      
      const originalSub = text.substring(0, desiredCursorPos);
      const meaningfulIndex = originalSub.replace(InputController.config.regex.cleanNum, "").length;

      DOM.liveInput.innerText = formattedText;
      
      let newOffset = 0;
      if (meaningfulIndex > 0) {
        let charCount = 0;
        for (let i = 0; i < formattedText.length; i++) {
          const char = formattedText[i];
          if (char !== "," && char !== " ") charCount++;
          if (charCount === meaningfulIndex) { newOffset = i + 1; break; }
        }
      }
      
      InputController.Cursor.setCaret(newOffset);
      parseAndRecalculate(false);
      requestAnimationFrame(() => InputController.Cursor.enforceConstraints());
    },

    formatString(rawText) {
      const safe = rawText.replace(/e\+/gi, "__EP__").replace(/e\-/gi, "__EM__");
      const parts = safe.split(/([\+\-\×\÷%])/);
      return parts.map(part => {
        const restored = part.replace(/__EP__/g, "e+").replace(/__EM__/g, "e-");
        if (InputController.config.operators.concat(['%']).includes(restored)) return ` ${restored} `;
        if (/^[0-9.,]+$/.test(restored) && !restored.toLowerCase().includes('e')) {
          return Utils.formatIN(restored.replace(/,/g, ""));
        }
        return restored;
      }).join("");
    }
  }
};

/* =========================================
   4. MATH ENGINE
   ========================================= */

function parseAndRecalculate(resetCursor = true) {
  let rawText = DOM.liveInput.innerText.replace(/[, ]/g, "");
  let safeText = rawText.replace(/e\+/gi, "EE_PLUS").replace(/e\-/gi, "EE_MINUS");
  let parts = safeText.split(/([\+\-\×\÷])/).map(p => p.trim()).filter(p => p);

  let rawTokens = parts.map(part => {
    let restored = part.replace(/EE_PLUS/g, "e+").replace(/EE_MINUS/g, "e-");
    if (["+", "-", "×", "÷"].includes(restored)) return restored;
    if (restored.includes("%")) return handlePercentageToken(restored);
    return restored;
  });

  STATE.tokens = [];
  for (let i = 0; i < rawTokens.length; i++) {
    let t = rawTokens[i];
    if (typeof t === "object" && t.isPercent) {
      t.value = calculatePercentageValue(t, i, rawTokens);
      STATE.tokens.push(t);
    } else {
      STATE.tokens.push(t);
    }
  }

  let currentEval = evaluate();
  DOM.liveTotal.innerText = STATE.tokens.length > 0 ? `= ${Utils.formatIN(Utils.toBillingString(currentEval))}` : "";
}

function handlePercentageToken(restored) {
  let percentIndex = restored.lastIndexOf("%");
  let suffix = restored.substring(percentIndex + 1);

  if (suffix.length > 0 && !isNaN(parseFloat(suffix))) {
    let prefix = restored.substring(0, percentIndex);
    let pCount = (prefix.match(/%/g) || []).length + 1;
    let numVal = parseFloat(prefix.replace(/%/g, ""));
    let val = numVal;
    for (let k = 0; k < pCount; k++) val = val / 100;
    return { text: restored, value: Utils.cleanNum(val * parseFloat(suffix)), isPercent: true };
  }

  let percentCount = (restored.match(/%/g) || []).length;
  let num = parseFloat(restored.replace(/%/g, ""));
  let val = num;
  for (let k = 0; k < percentCount; k++) val = val / 100;
  return { text: restored, value: Utils.cleanNum(val), isPercent: true, rawNum: num, count: percentCount };
}

function calculatePercentageValue(t, i, rawTokens) {
  let calculatedValue = t.value;
  let nextToken = rawTokens[i + 1];
  let isNextScale = ["×", "÷", "*", "/"].includes(nextToken);

  if (t.count === 1 && !t.text.includes('%')) { /*noop*/ }
  else if (t.count === 1) {
    let percentVal = t.rawNum;
    if (isNextScale) {
      calculatedValue = Utils.cleanNum(percentVal / 100);
    } else if (i === 0 || (i === 1 && rawTokens[0] === "-")) {
      let gSum = Utils.getGrandSum();
      if (gSum !== 0) calculatedValue = Utils.cleanNum(Math.abs(gSum) * (percentVal / 100));
    } else if (i > 1) {
      let op = rawTokens[i - 1];
      if (op === "+" || op === "-") {
        let subExprTokens = STATE.tokens.slice(0, STATE.tokens.length - 1);
        let runningTotal = evaluate(subExprTokens);
        calculatedValue = Utils.cleanNum(Math.abs(runningTotal) * (percentVal / 100));
      }
    }
  }
  return calculatedValue;
}

function evaluate(sourceTokens = STATE.tokens) {
  let tempTokens = [...sourceTokens];
  while (tempTokens.length > 0 && ["+", "-", "×", "÷"].includes(tempTokens.at(-1))) { tempTokens.pop(); }
  if (tempTokens.length === 0) return 0;

  let exp = tempTokens.map(t => (typeof t === "object" ? t.value : t))
    .join(" ").replace(/×/g, "*").replace(/÷/g, "/");
    
  try { return Utils.cleanNum(new Function("return " + exp)()); } catch { return 0; }
}

/* =========================================
   5. UI INTERACTIONS
   ========================================= */

function tap(actionFn) {
  let result = actionFn();
  if (result !== false) Utils.vibrate(30);
  if (STATE.currentPressedBtn) {
    const btn = STATE.currentPressedBtn;
    btn.classList.add("pressed");
    setTimeout(() => btn.classList.remove("pressed"), 100);
    STATE.currentPressedBtn = null;
  }
}

// Global API
window.digit = (d) => tap(() => InputController.Insert.handle(d, d === '.' ? 'dot' : 'num'));
window.setOp = (op) => tap(() => InputController.Insert.handle(op, 'op'));
window.back = () => tap(() => InputController.Insert.backspace());
window.applyPercent = () => tap(() => InputController.Insert.applyPercent());

/* Copy Summary */
window.copyToClipboard = () => {
  const rows = DOM.history.querySelectorAll('.h-row');
  if (rows.length === 0) return false;

  let text = "SUMMARY\n\n";
  rows.forEach(row => {
    const exp = row.querySelector('.h-exp').innerText.trim();
    const res = row.querySelector('.h-res').innerText.trim();
    text += `${exp} ${res}\n`;
  });

  text += "_______________________\n";
  text += `GRAND TOTAL: ${DOM.total.innerText}`;

  if (navigator.clipboard) {
     navigator.clipboard.writeText(text);
  } else {
     const textarea = document.createElement("textarea");
     textarea.value = text;
     document.body.appendChild(textarea);
     textarea.select();
     document.execCommand("copy");
     document.body.removeChild(textarea);
  }
  
  if(DOM.copyBtn) {
      DOM.copyBtn.classList.add("pressed"); 
      setTimeout(() => DOM.copyBtn.classList.remove("pressed"), 200);
  }
  return true;
};

window.enter = () => {
  parseAndRecalculate(false);
  if (!STATE.tokens.length) return false;

  let result = evaluate();
  let row = document.createElement("div");
  row.className = "h-row";
  row.dataset.value = result;

  let expText = DOM.liveInput.innerText;
  let resText = Utils.toBillingString(result);
  resText = Utils.formatIN(resText).length > 18 ? Number(result).toExponential(8) : Utils.formatIN(resText);

  row.innerHTML = `<span class="h-exp">${expText} =</span><span class="h-res ${result < 0 ? 'negative' : ''}">${resText}</span><div class="swipe-arrow"></div>`;
  enableSwipe(row);
  DOM.history.appendChild(row);

  DOM.liveInput.innerText = "";
  DOM.liveTotal.innerText = "";
  STATE.tokens = [];

  recalculateGrandTotal();
  setTimeout(() => row.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
  DOM.liveInput.focus();
  InputController.Cursor.renderVisual();
  return true;
};

// Button Initialization
document.querySelectorAll('.btn-key').forEach(btn => {
  btn.removeAttribute('onpointerdown'); btn.removeAttribute('onpointerup'); btn.removeAttribute('onpointerleave');

  if (btn.classList.contains('cut')) {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault(); STATE.currentPressedBtn = btn; STATE.isLongPress = false;
      STATE.cutTimer = setTimeout(() => {
        if (STATE.tokens.length > 0 || DOM.liveInput.innerText !== "") {
          DOM.liveInput.innerText = ""; parseAndRecalculate(false); Utils.vibrate(30);
          InputController.Cursor.renderVisual(); btn.classList.add("pressed");
          setTimeout(() => btn.classList.remove("pressed"), 100);
        }
        STATE.isLongPress = true;
      }, 450);
    });
    btn.addEventListener('pointerup', (e) => { e.preventDefault(); clearTimeout(STATE.cutTimer); if (!STATE.isLongPress) tap(window.back); });
    btn.addEventListener('pointerleave', (e) => { e.preventDefault(); clearTimeout(STATE.cutTimer); });
  } else {
    let command = btn.getAttribute('onclick');
    if (command) {
      btn.removeAttribute('onclick');
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault(); STATE.currentPressedBtn = btn;
        try { eval(command); } catch (err) { console.error(err); }
      });
    }
  }
});

function recalculateGrandTotal() {
  let sum = Utils.getGrandSum();
  let displaySum = Utils.toBillingString(sum);
  let finalText = Utils.formatIN(displaySum);
  DOM.total.innerText = finalText;
  DOM.history.setAttribute('data-total', finalText);
  
  let len = finalText.length;
  DOM.total.style.fontSize = len <= 16 ? "" : Math.max(16, 26 - (len - 16) * 0.59) + "px";
  DOM.total.classList.toggle("negative", sum < 0);
  let label = document.querySelector(".total-label");
  if(label) label.classList.toggle("is-negative", sum < 0);
  
  localStorage.setItem("billing_calc_history", DOM.history.innerHTML);
  localStorage.setItem("active_session_id", STATE.activeSessionId || "");
}

function clearAll() {
  let hasContent = STATE.tokens.length > 0 || DOM.history.innerHTML.trim() !== "";
  if (!hasContent) return false;
  Utils.vibrate(85);

  if (DOM.history.innerHTML.trim()) {
    let archive = JSON.parse(localStorage.getItem("calc_archive") || "[]");
    const ts = new Date().toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
    let rowsData = [];
    document.querySelectorAll(".h-row").forEach(row => {
      rowsData.push({ exp: row.querySelector(".h-exp").innerText, res: row.querySelector(".h-res").innerText, val: Number(row.dataset.value) });
    });
    let sessionData = { id: STATE.activeSessionId || Date.now(), time: ts, data: rowsData, total: DOM.total.innerText, rawTotal: Utils.getGrandSum() };
    if (STATE.activeSessionId) archive = archive.filter(item => item.id != STATE.activeSessionId);
    archive.unshift(sessionData);
    if(archive.length > 20) archive.pop();
    localStorage.setItem("calc_archive", JSON.stringify(archive));
  }
  
  STATE.tokens = []; DOM.liveInput.innerText = ""; DOM.liveTotal.innerText = ""; DOM.history.innerHTML = ""; STATE.activeSessionId = null; 
  recalculateGrandTotal(); DOM.liveInput.focus(); InputController.Cursor.renderVisual();
  return false;
}

window.showArchive = () => {
  const archive = JSON.parse(localStorage.getItem("calc_archive") || "[]");
  DOM.archiveList.innerHTML = archive.length === 0 ? "<div style='text-align:center; padding:40px; color:#999;'>No history records found</div>" : "";
  archive.forEach((item, idx) => {
    let rowsHtml = item.data.map(row => `<div class="archive-data-row"><span style="color:#666; flex:1; text-align:left;">${row.exp}</span><span class="${row.val < 0 ? 'negative' : ''}" style="font-weight:600;">${row.res}</span></div>`).join("");
    DOM.archiveList.innerHTML += `
      <div class="archive-item">
        <div class="h-card-actions archive-header-strip">
          <span class="h-time">${item.time} ${STATE.activeSessionId == item.id ? '<b style="color:#2e7d32;">(EDITING)</b>' : ''}</span>
          <div class="h-icon-group"><span class="card-icon" onclick="restoreSession(${idx})"><svg viewBox="0 0 24 24" width="18" height="18" fill="#2e7d32"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></span></div>
        </div>
        <div class="archive-data">${rowsHtml}</div>
        <div class="archive-total-row"><span>TOTAL</span><span class="${item.rawTotal < 0 ? 'negative' : ''}">₹${item.total}</span></div>
      </div>`;
  });
  DOM.archiveModal.style.display = "block"; window.history.pushState({ modal: "archive" }, "");
  return true; 
};

window.restoreSession = (index) => {
  const archive = JSON.parse(localStorage.getItem("calc_archive") || "[]");
  const session = archive[index];
  if (!session) return;
  STATE.tokens = []; DOM.liveInput.innerText = ""; DOM.liveTotal.innerText = ""; DOM.history.innerHTML = ""; STATE.activeSessionId = session.id;
  session.data.forEach(rowData => {
    let row = document.createElement("div"); row.className = "h-row"; row.dataset.value = rowData.val;
    row.innerHTML = `<span class="h-exp">${rowData.exp}</span><span class="h-res ${rowData.val < 0 ? 'negative' : ''}">${rowData.res}</span><div class="swipe-arrow"></div>`;
    enableSwipe(row); DOM.history.appendChild(row);
  });
  recalculateGrandTotal(); window.closeArchive(); tap(()=>{});
};

function enableSwipe(row){
  let sx = 0, dx = 0, dragging = false;
  row.onclick = (e) => { 
    e.stopPropagation(); 
    if (row.classList.contains("swiping")) return; 
    if (row.classList.contains("expanded")) { row.classList.remove("expanded"); } else {
      document.querySelectorAll(".h-row.expanded").forEach(r => r.classList.remove("expanded")); 
      row.classList.add("expanded"); Utils.vibrate(30); 
      setTimeout(() => row.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100); 
    }
  };
  row.addEventListener("touchstart", e => { sx = e.touches[0].clientX; dragging = true; row.style.transition = "none"; }, {passive: true});
  row.addEventListener("touchmove", e => { 
    if(!dragging) return; dx = e.touches[0].clientX - sx; 
    let arrow = row.querySelector(".swipe-arrow");
    row.classList.add("swiping"); row.classList.toggle("edit-mode", dx > 0);
    row.style.transform = `translateX(${dx}px)`; 
    if(arrow) arrow.style.width = (14 + Math.abs(dx)) + "px"; 
  }, {passive: true});
  row.addEventListener("touchend", () => { 
    dragging = false; row.style.transition = "transform 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28)"; 
    const threshold = row.offsetWidth * 0.4; 
    if (dx < -threshold) { row.style.transform = "translateX(-110%)"; Utils.vibrate(30); setTimeout(()=>{ row.remove(); recalculateGrandTotal(); }, 250); } 
    else if (dx > threshold) { row.style.transform = "translateX(110%)"; if (STATE.tokens.length) window.enter(); 
      let cleanText = row.querySelector(".h-exp").innerText.replace(/=/g, "").replace(/,/g, "").trim();
      DOM.liveInput.innerText = cleanText; 
      InputController.Format.process(cleanText, cleanText.length);
      DOM.liveInput.focus(); tap(()=>{});
      setTimeout(() => { row.style.height = "0px"; row.style.margin = "0px"; row.style.opacity = "0"; setTimeout(() => { row.remove(); recalculateGrandTotal(); }, 300); }, 300);
    } else { row.style.transform = "translateX(0)"; let arrow = row.querySelector(".swipe-arrow"); if(arrow) arrow.style.width = "14px"; setTimeout(() => row.classList.remove("swiping"), 300); } 
    dx = 0; 
  });
}

// ===========================================
// EVENTS
// ===========================================

const handleWrapperInteraction = (e) => {
  if (DOM.liveWrapper.contains(e.target)) {
    InputController.Cursor.ensureFocus();
    
    if (e.type === 'touchstart' || e.type === 'mousedown') {
       let cx = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
       let cy = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
       setTimeout(() => { InputController.Cursor.handleManualTap(cx, cy); }, 10);
    }
  }
};

DOM.liveWrapper.addEventListener("mousedown", handleWrapperInteraction);
DOM.liveWrapper.addEventListener("touchstart", handleWrapperInteraction, { passive: true });

DOM.liveInput.addEventListener("contextmenu", (e) => { e.preventDefault(); return false; });

DOM.liveInput.addEventListener("focus", () => { DOM.liveWrapper.classList.add("focused"); InputController.Cursor.renderVisual(); });
DOM.liveInput.addEventListener("blur", () => { DOM.liveWrapper.classList.remove("focused"); InputController.Cursor.renderVisual(); });

document.addEventListener('selectionchange', () => { 
  if (document.activeElement === DOM.liveInput) { 
    InputController.Cursor.renderVisual(); 
    InputController.Cursor.enforceConstraints(); 
  }
});

document.addEventListener('keydown', (e) => {
  const key = e.key; const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && key.toLowerCase() === 'p') { e.preventDefault(); tap(() => window.print()); } 
  else if (ctrl && key.toLowerCase() === 'c') { e.preventDefault(); tap(window.copyToClipboard); } 
  else if (key.toLowerCase() === 'h') { tap(window.showArchive); } 
  else if (key === 'Escape' || key === 'Delete') { tap(clearAll); }
  else if (key === 'Enter') { e.preventDefault(); tap(window.enter); }
  if (document.activeElement === DOM.liveInput) { if (key !== 'ArrowLeft' && key !== 'ArrowRight') e.preventDefault(); }
});

if (DOM.copyBtn) DOM.copyBtn.addEventListener("click", () => tap(window.copyToClipboard));

document.addEventListener("click", () => { document.querySelectorAll(".h-row.expanded").forEach(r => r.classList.remove("expanded")); });
window.closeArchive = () => { DOM.archiveModal.style.display = "none"; if (window.history.state?.modal === "archive") window.history.back(); };
window.onpopstate = () => { if (DOM.archiveModal.style.display === "block") DOM.archiveModal.style.display = "none"; };
window.clearArchive = () => {}; 

// Load & Init
const saved = localStorage.getItem("billing_calc_history");
STATE.activeSessionId = localStorage.getItem("active_session_id") || null;
if (saved) { DOM.history.innerHTML = saved; document.querySelectorAll(".h-row").forEach(enableSwipe); recalculateGrandTotal(); }
setTimeout(() => { InputController.Cursor.ensureFocus(); InputController.Cursor.renderVisual(); }, 100);
