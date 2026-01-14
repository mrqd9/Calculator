/*
 * Adding Calculator Pro - Stable Build (Error Handling)
 * Copyright (C) 2026 mrqd9
 * Licensed under GNU GPL v3 or later.
 */

/* ================= 1. SETUP & DOM ================= */
const DOM = {
  displayContainer: document.querySelector(".display-container"),
  oldLive: document.getElementById("live"), history: document.getElementById("history"),
  total: document.getElementById("total"), archiveModal: document.getElementById("archive-modal"),
  archiveList: document.getElementById("archive-list"), copyBtn: document.getElementById("copy-btn"),
  liveInput: null, liveTotal: null, customCursor: null, liveWrapper: null
};

const STATE = { tokens: [], activeSessionId: null, currentPressedBtn: null, cutTimer: null, isLongPress: false, isEnforcingCursor: false };

(function setupInterface() {
  const wrapper = document.createElement("div"); wrapper.id = "live-wrapper";
  wrapper.innerHTML = `<span id="live-input" tabindex="0" spellcheck="false" autocomplete="off"></span><div id="custom-cursor" class="blinking"></div><span id="live-total"></span>`;
  if (DOM.oldLive) DOM.oldLive.replaceWith(wrapper);
  DOM.liveWrapper = wrapper; DOM.liveInput = document.getElementById("live-input");
  DOM.liveTotal = document.getElementById("live-total"); DOM.customCursor = document.getElementById("custom-cursor");
})();

/* ================= 2. UTILITIES ================= */
const Utils = {
  vibrate: (ms) => { if (navigator.vibrate) navigator.vibrate(ms); },
  cleanNum: (n) => { if (isNaN(n)) return 0; let val = Math.round((n + Number.EPSILON) * 1e12) / 1e12; return Math.abs(val) > 1e20 ? val.toExponential(8) : val; },
  toBillingString: (val) => { let n = Number(val); return Math.abs(n) >= 1e16 ? n.toExponential(8) : n.toFixed(2); },
  formatIN: (str) => {
    if (str === "" || str === "-" || str === "−" || str.includes('e')) return str;
    let [i, d] = String(str).split("."); let sign = (i.startsWith("-") || i.startsWith("−")) ? "−" : "";
    i = i.replace(/[^0-9]/g, ""); let last3 = i.slice(-3), rest = i.slice(0, -3);
    if (rest) rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    return sign + (rest ? rest + "," : "") + last3 + (d !== undefined ? "." + d : "");
  },
  getGrandSum: () => {
    let sum = 0;
    document.querySelectorAll(".h-row").forEach(row => { let v = Number(row.dataset.value); if (!isNaN(v)) sum += v; });
    return Utils.cleanNum(sum);
  }
};

function safeLoad(key, fallback) {
  try { const item = localStorage.getItem(key); return item ? JSON.parse(item) : fallback; } 
  catch (e) { console.error("Corrupt storage for " + key, e); return fallback; }
}

/* ================= 3. INPUT CONTROLLER ================= */
const InputController = {
  config: { operators: ['+', '−', '×', '÷'], ghostChars: [' ', '+', '−', '×', '÷', '='], regex: { isPercent: /^[\+\−]?\d+(\.\d+)?%$/, splitSegments: /[\+\−\×\÷%]/, cleanNum: /[, ]/g } },

  Cursor: {
    ensureFocus() {
      if (document.activeElement !== DOM.liveInput) {
        DOM.liveInput.focus(); const sel = window.getSelection();
        if (sel.rangeCount === 0) { const range = document.createRange(); range.selectNodeContents(DOM.liveInput); range.collapse(false); sel.removeAllRanges(); sel.addRange(range); }
      }
    },
    setCaret(offset) {
      const textNode = DOM.liveInput.firstChild || DOM.liveInput;
      if (DOM.liveInput.innerText === "") { this.renderVisual(); return; }
      if (!textNode || textNode.nodeType !== 3) return;
      offset = Math.max(0, Math.min(offset, textNode.length));
      const range = document.createRange(); range.setStart(textNode, offset); range.setEnd(textNode, offset);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range); this.renderVisual();
    },
    renderVisual() {
      const sel = window.getSelection();
      if (document.activeElement !== DOM.liveInput) { DOM.customCursor.style.opacity = "0"; return; }
      DOM.customCursor.style.opacity = "1";
      if (sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0); let rect; const rects = range.getClientRects();
      if (rects.length > 0) rect = rects[rects.length - 1];
      else { const tempSpan = document.createElement("span"); tempSpan.textContent = "|"; range.insertNode(tempSpan); rect = tempSpan.getBoundingClientRect(); tempSpan.remove(); }
      const wrapperRect = DOM.liveWrapper.getBoundingClientRect();
      let top = rect.top - wrapperRect.top + DOM.liveWrapper.scrollTop; let left = rect.left - wrapperRect.left + DOM.liveWrapper.scrollLeft;
      if (left < 0) left = 0; DOM.customCursor.style.height = `24px`; DOM.customCursor.style.top = `${top}px`; DOM.customCursor.style.left = `${left}px`;
      const buffer = 20;
      if (rect.top < wrapperRect.top + buffer) DOM.liveWrapper.scrollTop -= (wrapperRect.top - rect.top) + buffer;
      else if (rect.bottom > wrapperRect.bottom - buffer) DOM.liveWrapper.scrollTop += (rect.bottom - wrapperRect.bottom) + buffer;
    },
    handleManualTap(clientX, clientY) { setTimeout(() => { this.renderVisual(); this.enforceConstraints(); }, 0); },
    enforceConstraints() {
      if (STATE.isEnforcingCursor) return;
      const sel = window.getSelection(); if (!sel.rangeCount) return;
      const range = sel.getRangeAt(0); const offset = range.startOffset; const text = DOM.liveInput.innerText;
      let newOffset = offset;
      const resultRegex = /=\s*[−-]?\s*[\d.,]+/g; let match;
      while ((match = resultRegex.exec(text)) !== null) {
          const start = match.index; const end = match.index + match[0].length;
          if (newOffset > start && newOffset < end) newOffset = end; 
      }
      if (newOffset === offset) {
          if (offset > 0 && text[offset - 1] === ',') newOffset = offset - 1;
          else {
            const isGhost = (char) => InputController.config.ghostChars.includes(char);
            const charBefore = offset > 0 ? text[offset - 1] : null; const charAfter = offset < text.length ? text[offset] : null;
            if ((charBefore && isGhost(charBefore)) || (charAfter && isGhost(charAfter))) {
              let start = offset, end = offset;
              while (start > 0 && isGhost(text[start - 1])) start--; while (end < text.length && isGhost(text[end])) end++;
              let innerRight = end; while (innerRight > start && text[innerRight - 1] === " ") innerRight--;
              if (innerRight === start && text[start] === " ") innerRight = start;
              const distStart = Math.abs(offset - start); const distInner = Math.abs(offset - innerRight);
              newOffset = (distStart < distInner) ? start : innerRight;
            }
          }
      }
      if (newOffset !== offset) { STATE.isEnforcingCursor = true; this.setCaret(newOffset); setTimeout(() => { STATE.isEnforcingCursor = false; }, 0); }
    }
  },

  Math: {
    tokenize(rawFull) {
        let rawText = rawFull.replace(/[, ]/g, "").replace("=", "").split("=").pop();
        let safeText = rawText.replace(/e\+/gi, "EE_PLUS").replace(/e[\-\−]/gi, "EE_MINUS");
        let parts = safeText.split(/([\+\−\×\÷%])/).map(p => p.trim()).filter(p => p);
        let initialTokens = [], currentNum = null;
        for (let i = 0; i < parts.length; i++) {
            let part = parts[i]; let restored = part.replace(/EE_PLUS/g, "e+").replace(/EE_MINUS/g, "e−");
            if (["+", "−", "×", "÷"].includes(restored)) { if (currentNum !== null) { initialTokens.push(currentNum); currentNum = null; } initialTokens.push(restored); } 
            else if (restored === "%") {
                if (currentNum !== null) {
                    if (typeof currentNum === 'object' && currentNum.isPercent) { currentNum.text += "%"; currentNum.count++; } 
                    else { let val = parseFloat(currentNum); currentNum = { text: currentNum + "%", value: 0, isPercent: true, rawNum: val, count: 1 }; }
                }
            } else { if (currentNum !== null) initialTokens.push(currentNum); currentNum = restored; }
        }
        if (currentNum !== null) initialTokens.push(currentNum);
        let resolvedTokens = [];
        for (let i = 0; i < initialTokens.length; i++) {
            let t = initialTokens[i];
            if (i > 0) {
                let prev = resolvedTokens[resolvedTokens.length - 1];
                let isPrevValue = (typeof prev === 'string' && !["+", "−", "×", "÷"].includes(prev)) || (typeof prev === 'object');
                let isCurrValue = (typeof t === 'string' && !["+", "−", "×", "÷"].includes(t)) || (typeof t === 'object');
                if (isPrevValue && isCurrValue) resolvedTokens.push("×");
            }
            if (typeof t === "object" && t.isPercent) { t.value = calculatePercentageValue(t, resolvedTokens.length, resolvedTokens); resolvedTokens.push(t); } 
            else { resolvedTokens.push(t); }
        }
        return resolvedTokens;
    }
  },

  Insert: {
    handle(char, type) {
      InputController.Cursor.ensureFocus();
      const sel = window.getSelection();
      let offset = (sel.rangeCount > 0) ? sel.getRangeAt(0).startOffset : DOM.liveInput.innerText.length;
      let text = DOM.liveInput.innerText;

      if (type === 'op' && char === '%' && offset > 0) {
          const trimOps = /[\+\−\×\÷\s]+$/; const match = text.slice(0, offset).match(trimOps);
          if (match) { const len = match[0].length; text = text.slice(0, offset - len) + text.slice(offset); offset -= len; }
      }
      if (!this.validate(text, char, type, offset)) return false;

      // Forward Lookahead with Space Skipping
      if (type === 'op' && offset < text.length) {
          const match = text.slice(offset).match(/^\s*([\+\−\×\÷])/); // Find next operator
          if (match) {
              const nextOp = match[1];
              let shouldReplaceNext = true;
              if ((nextOp === '−' || nextOp === '-') && (char !== '−' && char !== '-')) shouldReplaceNext = false; 
              if (shouldReplaceNext) text = text.slice(0, offset) + text.slice(offset + match[0].length);
          }
      }

      // Backward Replacement
      if (type === 'op') {
          const textBefore = text.slice(0, offset); const opBlockRegex = /([\+\−\×\÷])\s*([\+\−\×\÷])?\s*$/;
          const match = textBefore.match(opBlockRegex);
          if (match) {
              const fullMatchStr = match[0]; const firstOp = match[1]; const secondOp = match[2];
              let replaceBlock = true;
              if (!secondOp) { if ((char === '−' || char === '-') && firstOp !== '−' && firstOp !== '-') replaceBlock = false; }
              if (replaceBlock) { text = text.slice(0, offset - fullMatchStr.length) + text.slice(offset); offset -= fullMatchStr.length; }
          }
      }
      const newText = text.slice(0, offset) + char + text.slice(offset);
      DOM.liveInput.innerText = newText; InputController.Format.process(newText, offset + 1); return true;
    },

    validate(fullText, char, type, offset) {
      const textBefore = fullText.substring(0, offset); const prevChar = textBefore.trim().slice(-1);
      const textAfter = fullText.substring(offset); const nextChar = textAfter.trim().charAt(0);
      const endsWithResultRegex = /=\s*[−-]?\s*[\d.,]+$/;
      if (endsWithResultRegex.test(textBefore)) {
          const lastSegment = textBefore.split("=").pop();
          if (/^\s*[−-]?\s*[\d.,]+$/.test(lastSegment) && (type === 'num' || type === 'dot')) return false;
      }
      if (offset === 0) {
        if (type === 'op') { 
            if (char !== '−') return false; 
            if (/^\s*[\+\−\×\÷]/.test(textAfter)) return false; 
        }
        if (type === 'dot') { this.handle("0", "num"); this.handle(".", "dot"); return false; }
        return true;
      }
      if (type === 'op') {
        if (char === '%') { if (!/[\d.]/.test(prevChar)) return false; }
        const isPrevOp = InputController.config.operators.includes(prevChar);
        if (char === '%' && (prevChar === '%' || nextChar === '%')) return false;
      }
      if (type === 'dot') {
        const lastSegment = textBefore.split(InputController.config.regex.splitSegments).pop();
        if (lastSegment.includes('.')) return false;
        if (lastSegment.trim() === "") { this.handle("0", "num"); this.handle(".", "dot"); return false; }
      }
      return true;
    },

    applyPercent() {
      if (!this.handle("%", 'op')) return false;
      const rawText = DOM.liveInput.innerText.replace(InputController.config.regex.cleanNum, "");
      if (InputController.config.regex.isPercent.test(rawText)) {
        const gSum = Utils.getGrandSum();
        if (gSum !== 0) { const gSumStr = Utils.formatIN(Utils.toBillingString(gSum)); DOM.liveInput.innerText = DOM.liveInput.innerText + gSumStr; }
      }
      InputController.Format.process(DOM.liveInput.innerText, DOM.liveInput.innerText.length); return true;
    },

    backspace() {
      InputController.Cursor.ensureFocus(); const text = DOM.liveInput.innerText; if (text === "") return false;
      const sel = window.getSelection(); let offset = (sel.rangeCount > 0) ? sel.getRangeAt(0).startOffset : text.length;
      if (offset === 0) return false;
      const textBefore = text.substring(0, offset); const atomicMatch = textBefore.match(/=\s*[−-]?\s*[\d.,]+$/);
      if (atomicMatch) {
          const suffix = atomicMatch[0].split("=").pop();
          if (/^\s*[−-]?\s*[\d.,]+$/.test(suffix)) {
             const lengthToRemove = atomicMatch[0].length; const newText = text.slice(0, offset - lengthToRemove) + text.slice(offset);
             DOM.liveInput.innerText = newText; InputController.Format.process(newText, offset - lengthToRemove); return true;
          }
      }
      const newText = text.slice(0, offset - 1) + text.slice(offset);
      DOM.liveInput.innerText = newText; InputController.Format.process(newText, offset - 1); return true;
    }
  },

  Format: {
    process(text, desiredCursorPos) {
      let cleanText = text.replace(InputController.config.regex.cleanNum, "");
      cleanText = this.updateChains(cleanText);
      const formattedText = this.formatString(cleanText);
      const originalSub = text.substring(0, desiredCursorPos);
      const meaningfulIndex = originalSub.replace(InputController.config.regex.cleanNum, "").length;
      DOM.liveInput.innerText = formattedText;
      let newOffset = 0;
      if (meaningfulIndex > 0) {
        let charCount = 0;
        for (let i = 0; i < formattedText.length; i++) {
          const char = formattedText[i]; if (char !== "," && char !== " ") charCount++;
          if (charCount === meaningfulIndex) { newOffset = i + 1; break; }
        }
      }
      InputController.Cursor.setCaret(newOffset);
      parseAndRecalculate(false); requestAnimationFrame(() => InputController.Cursor.enforceConstraints());
    },
    updateChains(rawText) {
       if (!rawText.includes("=")) return rawText;
       const segments = rawText.split("="); let newString = ""; let cumulativeExpression = segments[0]; newString += segments[0];
       for (let i = 1; i < segments.length; i++) {
           let result = evaluate(cumulativeExpression); 
           if (result === "Error") return rawText; // Abort chain update on error
           let resultStr = Utils.toBillingString(result);
           if (resultStr.endsWith(".00")) resultStr = resultStr.slice(0, -3);
           newString += "=" + resultStr;
           let currentSeg = segments[i]; const matchNumberAtStart = currentSeg.match(/^\s*[−-]?\s*[\d.]+/);
           if (matchNumberAtStart) { let strippedSeg = currentSeg.substring(matchNumberAtStart[0].length); newString += strippedSeg; cumulativeExpression = resultStr + strippedSeg; } 
           else { newString += currentSeg; cumulativeExpression = resultStr + currentSeg; }
       }
       return newString.replace(/[\+\-\*\/]{2,}/g, (m) => m.slice(-1));
    },
    formatString(rawText) {
      const safe = rawText.replace(/e\+/gi, "__EP__").replace(/e[\-\−]/gi, "__EM__");
      const parts = safe.split(/([\+\−\×\÷%=])/);
      return parts.map(part => {
        const restored = part.replace(/__EP__/g, "e+").replace(/__EM__/g, "e−");
        if (InputController.config.operators.concat(['%', '=']).includes(restored)) return ` ${restored} `;
        if (/^[0-9.,]+$/.test(restored) && !restored.toLowerCase().includes('e')) return Utils.formatIN(restored.replace(/,/g, ""));
        return restored;
      }).join("");
    }
  }
};

/* ================= 4. MATH ENGINE ================= */
function parseAndRecalculate(resetCursor = true) {
  STATE.tokens = InputController.Math.tokenize(DOM.liveInput.innerText);
  let currentEval = evaluate();
  
  if (currentEval === "Error") {
      DOM.liveTotal.innerText = "= Error";
      return;
  }

  let rawFull = DOM.liveInput.innerText.replace(/[, ]/g, "");
  const endsWithResultBlock = /=\s*[−-]?\s*[\d.,]+$/.test(rawFull.trim());
  const showTotal = STATE.tokens.length > 0 && !rawFull.trim().endsWith("=") && !endsWithResultBlock;
  DOM.liveTotal.innerText = showTotal ? `= ${Utils.formatIN(Utils.toBillingString(currentEval))}` : "";
}

function handlePercentageToken(restored) { return { text: restored, value: 0, isPercent: true }; }

function calculatePercentageValue(t, i, rawTokens) {
  let val = t.rawNum; for (let k = 0; k < t.count; k++) val = val / 100;
  let calculatedValue = Utils.cleanNum(val);
  if (i > 0) {
      let prev = rawTokens[i - 1];
      if (prev === "+" || prev === "−" || prev === "-") {
          let isUnary = false; if (i - 1 === 0) isUnary = true;
          else if (i - 2 >= 0) { const prevPrev = rawTokens[i - 2]; if (typeof prevPrev === 'string' && ["+", "−", "-", "×", "*", "÷", "/"].includes(prevPrev)) isUnary = true; }
          if (!isUnary) {
              let subExprTokens = rawTokens.slice(0, i - 1); let runningTotal = evaluate(subExprTokens); 
              if (runningTotal === "Error") return 0;
              calculatedValue = Utils.cleanNum(runningTotal * (t.rawNum / 100)); 
          }
      }
  }
  return calculatedValue;
}

function evaluate(sourceTokens = STATE.tokens) {
  let tempTokens;
  if (Array.isArray(sourceTokens)) tempTokens = [...sourceTokens]; else if (typeof sourceTokens === 'string') tempTokens = InputController.Math.tokenize(sourceTokens); else return 0;
  while (tempTokens.length > 0 && ["+", "−", "×", "÷"].includes(tempTokens.at(-1))) { tempTokens.pop(); }
  if (tempTokens.length === 0) return 0;
  let exp = tempTokens.map(t => (typeof t === "object" ? t.value : t)).join(" ").replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-"); 
  try { 
      let res = new Function("return " + exp)(); 
      if (!isFinite(res) || isNaN(res)) return "Error";
      return Utils.cleanNum(res); 
  } catch { return "Error"; }
}

/* ================= 5. UI INTERACTIONS ================= */
function tap(actionFn) {
  let result = actionFn(); if (result !== false) Utils.vibrate(30);
  if (STATE.currentPressedBtn) { const btn = STATE.currentPressedBtn; btn.classList.add("pressed"); setTimeout(() => btn.classList.remove("pressed"), 40); STATE.currentPressedBtn = null; }
}

window.digit = (d) => tap(() => InputController.Insert.handle(d, d === '.' ? 'dot' : 'num'));
window.setOp = (op) => tap(() => InputController.Insert.handle(op === '-' ? '−' : op, 'op'));
window.back = () => tap(() => InputController.Insert.backspace());
window.applyPercent = () => tap(() => InputController.Insert.applyPercent());

window.copyToClipboard = () => {
  const rows = DOM.history.querySelectorAll('.h-row'); if (rows.length === 0) return false;
  let text = "SUMMARY\n";
  rows.forEach(row => { text += `${row.querySelector('.h-exp').innerText.trim()}  ${row.querySelector('.h-res').innerText.trim()}\n`; });
  text += "_______________________\nGRAND TOTAL:  " + DOM.total.innerText;
  if (navigator.clipboard) navigator.clipboard.writeText(text);
  else { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); }
  if(DOM.copyBtn) { DOM.copyBtn.classList.add("pressed"); setTimeout(() => DOM.copyBtn.classList.remove("pressed"), 200); }
  return true;
};

window.resolveInline = () => {
  parseAndRecalculate(false); if (STATE.tokens.length === 0) return false;
  let result = evaluate();
  if (result === "Error") return false;

  let rawText = DOM.liveInput.innerText; const resultBlocks = rawText.match(/=\s*([−-]?\s*[\d.,]+)/g);
  if (resultBlocks && resultBlocks.length > 0) {
      let lastBlock = resultBlocks[resultBlocks.length - 1]; 
      let lastVal = parseFloat(lastBlock.replace(/=/g, "").trim().replace(/,/g, ""));
      if (!isNaN(lastVal) && Math.abs(lastVal - result) < 0.0000001) return false;
  }
  let resStr = Utils.toBillingString(result); if (resStr.endsWith(".00")) resStr = resStr.slice(0, -3);
  InputController.Insert.handle("=", "op"); return true;
};

window.enter = () => {
  parseAndRecalculate(false);
  let checkText = DOM.liveInput.innerText.trim();
  if (!checkText || /^[\s\+\−\-\×\÷\%\*\/\.]+$/.test(checkText)) return false;
  if (!STATE.tokens.length) return false;
  
  let result = evaluate();
  if (result === "Error") return false;

  let row = document.createElement("div"); row.className = "h-row"; row.dataset.value = result;
  let expText = DOM.liveInput.innerText;
  if (expText.includes("=")) {
      const lastEqIndex = expText.lastIndexOf("=");
      const valAfterEq = parseFloat(expText.substring(lastEqIndex + 1).trim().replace(/,/g, ""));
      if (!isNaN(valAfterEq) && Math.abs(valAfterEq - result) < 0.0000001) expText = expText.substring(0, lastEqIndex).trim();
  }
  expText = expText.replace(/[\s\+\−\×\÷\.\-]+$/, "");
  if (!expText) return false;

  let resText = Utils.toBillingString(result);
  resText = Utils.formatIN(resText).length > 18 ? Number(result).toExponential(8) : Utils.formatIN(resText);
  row.innerHTML = `<span class="h-exp">${expText} =</span><span class="h-res ${result < 0 ? 'negative' : ''}">${resText}</span><div class="swipe-arrow"></div>`;
  enableSwipe(row); DOM.history.appendChild(row);
  DOM.liveInput.innerText = ""; DOM.liveTotal.innerText = ""; STATE.tokens = [];
  recalculateGrandTotal(); setTimeout(() => row.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
  DOM.liveInput.focus(); InputController.Cursor.renderVisual(); return true;
};

document.querySelectorAll('.btn-key').forEach(btn => {
  if (btn.classList.contains('eq')) return; 
  btn.removeAttribute('onpointerdown'); btn.removeAttribute('onpointerup'); btn.removeAttribute('onpointerleave');
  if (btn.classList.contains('cut')) {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault(); STATE.currentPressedBtn = btn; STATE.isLongPress = false;
      STATE.cutTimer = setTimeout(() => {
        if (STATE.tokens.length > 0 || DOM.liveInput.innerText !== "") { DOM.liveInput.innerText = ""; parseAndRecalculate(false); Utils.vibrate(30); InputController.Cursor.renderVisual(); btn.classList.add("pressed"); setTimeout(() => btn.classList.remove("pressed"), 100); }
        STATE.isLongPress = true;
      }, 450);
    });
    btn.addEventListener('pointerup', (e) => { e.preventDefault(); clearTimeout(STATE.cutTimer); if (!STATE.isLongPress) tap(window.back); });
    btn.addEventListener('pointerleave', (e) => { e.preventDefault(); clearTimeout(STATE.cutTimer); });
  } else {
    let command = btn.getAttribute('onclick');
    if (command) {
      btn.removeAttribute('onclick');
      btn.addEventListener('pointerdown', (e) => { e.preventDefault(); STATE.currentPressedBtn = btn; try { eval(command); } catch (err) { console.error(err); } });
    }
  }
});

function recalculateGrandTotal() {
  let sum = Utils.getGrandSum(); let displaySum = Utils.toBillingString(sum); let finalText = Utils.formatIN(displaySum);
  DOM.total.innerText = finalText; DOM.history.setAttribute('data-total', finalText);
  let len = finalText.length; DOM.total.style.fontSize = len <= 16 ? "" : Math.max(16, 26 - (len - 16) * 0.59) + "px";
  DOM.total.classList.toggle("negative", sum < 0);
  let label = document.querySelector(".total-label"); if(label) label.classList.toggle("is-negative", sum < 0);
  localStorage.setItem("billing_calc_history", DOM.history.innerHTML); localStorage.setItem("active_session_id", STATE.activeSessionId || "");
}

function clearAll() {
  let hasContent = STATE.tokens.length > 0 || DOM.history.innerHTML.trim() !== ""; if (!hasContent) return false;
  Utils.vibrate(85);
  if (DOM.history.innerHTML.trim()) {
    let archive = safeLoad("calc_archive", []);
    const ts = new Date().toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
    let rowsData = []; document.querySelectorAll(".h-row").forEach(row => { rowsData.push({ exp: row.querySelector(".h-exp").innerText, res: row.querySelector(".h-res").innerText, val: Number(row.dataset.value) }); });
    let sessionData = { id: STATE.activeSessionId || Date.now(), time: ts, data: rowsData, total: DOM.total.innerText, rawTotal: Utils.getGrandSum() };
    if (STATE.activeSessionId) archive = archive.filter(item => item.id != STATE.activeSessionId);
    archive.unshift(sessionData); if(archive.length > 20) archive.pop(); localStorage.setItem("calc_archive", JSON.stringify(archive));
  }
  STATE.tokens = []; DOM.liveInput.innerText = ""; DOM.liveTotal.innerText = ""; DOM.history.innerHTML = ""; STATE.activeSessionId = null; 
  recalculateGrandTotal(); DOM.liveInput.focus(); InputController.Cursor.renderVisual(); return false;
}

window.showArchive = () => {
  const archive = safeLoad("calc_archive", []);
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
  DOM.archiveModal.style.display = "block"; window.history.pushState({ modal: "archive" }, ""); return true; 
};

window.restoreSession = (index) => {
  const archive = safeLoad("calc_archive", []); const session = archive[index]; if (!session) return;
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
  row.onclick = (e) => { e.stopPropagation(); 
    if (row.classList.contains("swiping")) return; 
    if (row.classList.contains("expanded")) { row.classList.remove("expanded"); } else { document.querySelectorAll(".h-row.expanded").forEach(r => r.classList.remove("expanded")); row.classList.add("expanded"); Utils.vibrate(30); setTimeout(() => row.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100); }
  };
  row.addEventListener("touchstart", e => { sx = e.touches[0].clientX; dragging = true; row.style.transition = "none"; }, {passive: true});
  row.addEventListener("touchmove", e => { 
    if(!dragging) return; dx = e.touches[0].clientX - sx; 
    let arrow = row.querySelector(".swipe-arrow"); row.classList.add("swiping"); row.classList.toggle("edit-mode", dx > 0);
    row.style.transform = `translateX(${dx}px)`; if(arrow) arrow.style.width = (14 + Math.abs(dx)) + "px"; 
  }, {passive: true});
  row.addEventListener("touchend", () => { 
    dragging = false; row.style.transition = "transform 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28)"; 
    const threshold = row.offsetWidth * 0.4; 
    if (dx < -threshold) { row.style.transform = "translateX(-110%)"; Utils.vibrate(30); setTimeout(()=>{ row.remove(); recalculateGrandTotal(); }, 250); } 
    else if (dx > threshold) { row.style.transform = "translateX(110%)"; if (STATE.tokens.length) window.enter(); 
      let cleanText = row.querySelector(".h-exp").innerText.replace(/=\s*$/, "").replace(/,/g, "").trim();
      DOM.liveInput.innerText = cleanText; InputController.Format.process(cleanText, cleanText.length); DOM.liveInput.focus(); tap(()=>{});
      setTimeout(() => { row.style.height = "0px"; row.style.margin = "0px"; row.style.opacity = "0"; setTimeout(() => { row.remove(); recalculateGrandTotal(); }, 300); }, 300);
    } else { row.style.transform = "translateX(0)"; let arrow = row.querySelector(".swipe-arrow"); if(arrow) arrow.style.width = "14px"; setTimeout(() => row.classList.remove("swiping"), 300); } 
    dx = 0; 
  });
}

const handleWrapperInteraction = (e) => {
  if (DOM.liveWrapper.contains(e.target)) {
    InputController.Cursor.ensureFocus();
    if (e.type === 'touchstart' || e.type === 'mousedown') {
       let cx = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX; let cy = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
       setTimeout(() => { InputController.Cursor.handleManualTap(cx, cy); }, 10);
    }
  }
};

DOM.liveWrapper.addEventListener("mousedown", handleWrapperInteraction);
DOM.liveWrapper.addEventListener("touchstart", handleWrapperInteraction, { passive: true });
DOM.liveInput.addEventListener("contextmenu", (e) => { e.preventDefault(); return false; });
DOM.liveInput.addEventListener("focus", () => { DOM.liveWrapper.classList.add("focused"); InputController.Cursor.renderVisual(); });
DOM.liveInput.addEventListener("blur", () => { DOM.liveWrapper.classList.remove("focused"); InputController.Cursor.renderVisual(); });
document.addEventListener('selectionchange', () => { if (document.activeElement === DOM.liveInput) { InputController.Cursor.renderVisual(); InputController.Cursor.enforceConstraints(); } });
document.addEventListener('keydown', (e) => {
  const key = e.key; const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && key.toLowerCase() === 'p') { e.preventDefault(); tap(() => window.print()); } 
  else if (ctrl && key.toLowerCase() === 'c') { e.preventDefault(); tap(window.copyToClipboard); } 
  else if (key.toLowerCase() === 'h') { tap(window.showArchive); } 
  else if (key === 'Escape' || key === 'Delete') { tap(clearAll); }
  else if (key === 'Enter') { e.preventDefault(); tap(window.enter); }
  else if (key === '=') { e.preventDefault(); tap(window.resolveInline); }
  if (document.activeElement === DOM.liveInput) { if (key !== 'ArrowLeft' && key !== 'ArrowRight') e.preventDefault(); }
});
if (DOM.copyBtn) DOM.copyBtn.addEventListener("click", () => tap(window.copyToClipboard));
document.addEventListener("click", () => { document.querySelectorAll(".h-row.expanded").forEach(r => r.classList.remove("expanded")); });
window.closeArchive = () => { DOM.archiveModal.style.display = "none"; if (window.history.state?.modal === "archive") window.history.back(); };
window.onpopstate = () => { if (DOM.archiveModal.style.display === "block") DOM.archiveModal.style.display = "none"; };
window.clearArchive = () => {
  if(!localStorage.getItem("calc_archive")) return;
  if(confirm("Clear entire history archive?")) { localStorage.removeItem("calc_archive"); window.showArchive(); Utils.vibrate(50); }
};

let eqTimer = null; let eqLongPressed = false;
window.eqPressStart = (e) => { e.preventDefault(); const btn = e.currentTarget; STATE.currentPressedBtn = btn; eqLongPressed = false; eqTimer = setTimeout(() => { eqLongPressed = true; tap(window.resolveInline); Utils.vibrate(50); btn.classList.add("pressed"); }, 400); };
window.eqPressEnd = (e) => { e.preventDefault(); clearTimeout(eqTimer); if (!eqLongPressed) { tap(window.enter); } if (STATE.currentPressedBtn) { STATE.currentPressedBtn.classList.remove("pressed"); STATE.currentPressedBtn = null; } };
window.eqPressCancel = () => { clearTimeout(eqTimer); if (STATE.currentPressedBtn) { STATE.currentPressedBtn.classList.remove("pressed"); STATE.currentPressedBtn = null; } };

const saved = localStorage.getItem("billing_calc_history"); STATE.activeSessionId = localStorage.getItem("active_session_id") || null;
if (saved) { DOM.history.innerHTML = saved; document.querySelectorAll(".h-row").forEach(enableSwipe); recalculateGrandTotal(); }
setTimeout(() => { InputController.Cursor.ensureFocus(); InputController.Cursor.renderVisual(); }, 100);
