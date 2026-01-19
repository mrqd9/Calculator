/* Adding Calculator Pro | Copyright 2026 mrqd9 | GNU GPL v3 */

/* --- DOM & STATE --- */
const DOM = {
  displayContainer: document.querySelector(".display-container"),
  history: document.getElementById("history"),
  total: document.getElementById("total"),
  archiveModal: document.getElementById("archive-modal"),
  archiveList: document.getElementById("archive-list"),
  copyBtn: document.getElementById("copy-btn"),
  converterModal: document.getElementById("converter-modal"),
  convFromVal: document.getElementById("conv-from-val"),
  convToVal: document.getElementById("conv-to-val"),
  convFromUnit: document.getElementById("conv-from-unit"),
  convToUnit: document.getElementById("conv-to-unit"),
  labelModal: document.getElementById("label-modal"),
  labelList: document.getElementById("label-list"),
  labelBtn: document.getElementById("label-btn"),
  labelRemove: document.getElementById("label-remove"),
  labelText: document.getElementById("label-text"),
  liveInput: document.getElementById("live-input"), 
  liveTotal: document.getElementById("live-total"), 
  customCursor: document.getElementById("custom-cursor"), 
  liveWrapper: document.getElementById("live-wrapper")
};

const STATE = { tokens: [], activeSessionId: null, currentPressedBtn: null, cutTimer: null, isLongPress: false, isEnforcingCursor: false };

(function setupInterface() {
  if (DOM.liveInput) { DOM.liveInput.focus(); return; }
  const wrapper = document.createElement("div");
  wrapper.id = "live-wrapper";
  wrapper.innerHTML = `<span id="live-input" tabindex="0" spellcheck="false" autocomplete="off"></span><div id="custom-cursor" class="blinking"></div><span id="live-total"></span>`;
  const oldLive = document.getElementById("live");
  if (oldLive) oldLive.replaceWith(wrapper);
  DOM.liveWrapper = wrapper; DOM.liveInput = document.getElementById("live-input"); DOM.liveTotal = document.getElementById("live-total"); DOM.customCursor = document.getElementById("custom-cursor");
})();

/* --- UTILITIES --- */
const Utils = {
  vibrate: (ms) => { if (navigator.vibrate) navigator.vibrate(ms); },
  cleanNum: (n) => {
    if (isNaN(n)) return 0;
    let val = Math.round((n + Number.EPSILON) * 1e12) / 1e12;
    return Math.abs(val) > 1e20 ? val.toExponential(8) : val;
  },
  toBillingString: (val) => {
    let n = Number(val);
    return Math.abs(n) >= 1e16 ? n.toExponential(8) : n.toFixed(2);
  },
  formatIN: (str) => {
    if (str === "" || str === "-" || str === "−" || str.includes('e')) return str;
    let [i, d] = String(str).split(".");
    let sign = (i.startsWith("-") || i.startsWith("−")) ? "−" : "";
    i = i.replace(/[^0-9]/g, "");
    let last3 = i.slice(-3), rest = i.slice(0, -3);
    if (rest) rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    return sign + (rest ? rest + "," : "") + last3 + (d !== undefined ? "." + d : "");
  },
  getGrandSum: () => {
    let sum = 0;
    document.querySelectorAll(".h-row").forEach(row => { let v = Number(row.dataset.value); if (!isNaN(v)) sum += v; });
    return Utils.cleanNum(sum);
  }
};

function safeLoad(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; } }

/* --- LABEL CONTROLLER --- */
const LabelController = {
  items: safeLoad("calc_labels", []), current: null,
  init() { this.renderList(); },
  open() { this.renderList(); DOM.labelModal.style.display = "block"; history.pushState({ modal: "label" }, ""); },
  close() { DOM.labelModal.style.display = "none"; if (history.state?.modal === "label") history.back(); },
  add() {
    const input = document.getElementById("new-tag-input");
    const name = input.value; 
    if (name && name.trim()) {
      const cleaned = name.trim();
      const exists = this.items.some(item => item.toLowerCase() === cleaned.toLowerCase());
      if (exists) { 
          if (typeof Cloud !== "undefined") Cloud.showStatus("Tag already exists");
          else alert("Tag already exists"); 
          return; 
      }
      const formatted = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      this.items.push(formatted);
      localStorage.setItem("calc_labels", JSON.stringify(this.items));
      this.renderList();
      if (typeof Cloud !== "undefined") Cloud.pushData();
      input.value = "";
    }
    input.focus();
  },
  select(name) { this.set(name); history.back(); },
  set(name) { this.current = name; this.updateUI(); },
  clear() { this.current = null; this.updateUI(); Utils.vibrate(30); },
  remove(e, idx) {
    e.stopPropagation();
    if(confirm("Delete '" + this.items[idx] + "'?")) {
      this.items.splice(idx, 1);
      localStorage.setItem("calc_labels", JSON.stringify(this.items));
      this.renderList();
      if (typeof Cloud !== "undefined") Cloud.pushData();
    }
  },
  updateUI() {
    if (this.current) {
      DOM.labelBtn.classList.add("active"); DOM.labelBtn.classList.add("has-tag");
      DOM.labelText.innerText = this.current; DOM.labelText.style.display = "inline";
      DOM.labelRemove.classList.add("visible"); DOM.labelBtn.querySelector("svg").style.display = "none";
    } else {
      DOM.labelBtn.classList.remove("active"); DOM.labelBtn.classList.remove("has-tag");
      DOM.labelText.style.display = "none"; DOM.labelRemove.classList.remove("visible");
      DOM.labelBtn.querySelector("svg").style.display = "block";
    }
  },
  renderList() {
    if (this.items.length === 0) { DOM.labelList.innerHTML = "<div style='text-align:center; color:#999; padding:20px;'>No items added</div>"; return; }
    DOM.labelList.innerHTML = this.items.map((item, idx) => `
      <div class="label-option" onclick="LabelController.select('${item}')">
        <div class="label-del" onclick="LabelController.remove(event, ${idx})">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </div><span>${item}</span>
      </div>`).join("");
  }
};
LabelController.init();

/* --- INPUT CONTROLLER --- */
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
      DOM.customCursor.style.opacity = "1"; if (sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      let rect, rects = range.getClientRects();
      if (rects.length > 0) rect = rects[rects.length - 1];
      else { const span = document.createElement("span"); span.textContent = "|"; range.insertNode(span); rect = span.getBoundingClientRect(); span.remove(); }
      const wrapRect = DOM.liveWrapper.getBoundingClientRect();
      let top = rect.top - wrapRect.top + DOM.liveWrapper.scrollTop;
      let left = rect.left - wrapRect.left + DOM.liveWrapper.scrollLeft;
      if (left < 0) left = 0;
      DOM.customCursor.style.height = `24px`; DOM.customCursor.style.top = `${top}px`; DOM.customCursor.style.left = `${left}px`;
      const buffer = 20;
      if (rect.top < wrapRect.top + buffer) DOM.liveWrapper.scrollTop -= (wrapRect.top - rect.top) + buffer;
      else if (rect.bottom > wrapRect.bottom - buffer) DOM.liveWrapper.scrollTop += (rect.bottom - wrapRect.bottom) + buffer;
    },
    handleManualTap(cx, cy) { setTimeout(() => { this.renderVisual(); this.enforceConstraints(); }, 0); },
    enforceConstraints() {
      if (STATE.isEnforcingCursor) return;
      const sel = window.getSelection(); if (!sel.rangeCount) return;
      const range = sel.getRangeAt(0), offset = range.startOffset, text = DOM.liveInput.innerText;
      let newOffset = offset;
      let match; const resRegex = /=\s*[−-]?\s*[\d.,]+/g;
      while ((match = resRegex.exec(text)) !== null) { if (newOffset > match.index && newOffset < match.index + match[0].length) newOffset = match.index + match[0].length; }
      if (newOffset === offset) {
        if (offset > 0 && text[offset - 1] === ',') newOffset = offset - 1;
        else {
          const isGhost = (c) => InputController.config.ghostChars.includes(c);
          if ((offset > 0 && isGhost(text[offset - 1])) || (offset < text.length && isGhost(text[offset]))) {
            let start = offset, end = offset;
            while (start > 0 && isGhost(text[start - 1])) start--;
            while (end < text.length && isGhost(text[end])) end++;
            let inner = end;
            while (inner > start && text[inner - 1] === " ") inner--;
            if (inner === start && text[start] === " ") inner = start;
            newOffset = (Math.abs(offset - start) < Math.abs(offset - inner)) ? start : inner;
          }
        }
      }
      if (newOffset !== offset) { STATE.isEnforcingCursor = true; this.setCaret(newOffset); setTimeout(() => { STATE.isEnforcingCursor = false; }, 0); }
    }
  },
  Math: {
    tokenize(rawFull) {
      let rawText = rawFull.replace(/[, ]/g, "").split("=").pop();
      let parts = rawText.replace(/e\+/gi, "EE_PLUS").replace(/e[\-\−]/gi, "EE_MINUS").split(/([\+\−\×\÷%])/).map(p => p.trim()).filter(p => p);
      let initTokens = [], curNum = null;
      for (let part of parts) {
        let restored = part.replace(/EE_PLUS/g, "e+").replace(/EE_MINUS/g, "e−");
        if (["+", "−", "×", "÷"].includes(restored)) { if (curNum !== null) { initTokens.push(curNum); curNum = null; } initTokens.push(restored); } 
        else if (restored === "%") { if (curNum !== null) { if (typeof curNum === 'object' && curNum.isPercent) { curNum.text += "%"; curNum.count++; } else curNum = { text: curNum + "%", value: 0, isPercent: true, rawNum: parseFloat(curNum), count: 1 }; } } 
        else { if (curNum !== null) initTokens.push(curNum); curNum = restored; }
      }
      if (curNum !== null) initTokens.push(curNum);
      let resTokens = [];
      for (let i = 0; i < initTokens.length; i++) {
        let t = initTokens[i];
        if (i > 0) {
          let prev = resTokens[resTokens.length - 1];
          let isPrevVal = (typeof prev === 'string' && !["+", "−", "×", "÷"].includes(prev)) || (typeof prev === 'object');
          let isCurrVal = (typeof t === 'string' && !["+", "−", "×", "÷"].includes(t)) || (typeof t === 'object');
          if (isPrevVal && isCurrVal) resTokens.push("×");
        }
        if (typeof t === "object" && t.isPercent) resTokens.push({ ...t, value: calculatePercentageValue(t, resTokens.length, resTokens) });
        else resTokens.push(t);
      }
      return resTokens;
    }
  },
  Insert: {
    handle(char, type) {
      InputController.Cursor.ensureFocus(); const sel = window.getSelection();
      let offset = sel.rangeCount > 0 ? sel.getRangeAt(0).startOffset : DOM.liveInput.innerText.length; let text = DOM.liveInput.innerText;
      if (type === 'op' && char === '%' && offset > 0) { const match = text.slice(0, offset).match(/[\+\−\×\÷\s]+$/); if (match) { text = text.slice(0, offset - match[0].length) + text.slice(offset); offset -= match[0].length; } }
      if (!this.validate(text, char, type, offset)) return false;
      if (type === 'op' && offset < text.length) { const match = text.slice(offset).match(/^\s*([\+\−\×\÷])/); if (match && !((match[1] === '−' || match[1] === '-') && (char !== '−' && char !== '-'))) { text = text.slice(0, offset) + text.slice(offset + match[0].length); } }
      if (type === 'op') { const match = text.slice(0, offset).match(/([\+\−\×\÷])\s*([\+\−\×\÷])?\s*$/); if (match) { if (match[2] || !((char === '−' || char === '-') && match[1] !== '−' && match[1] !== '-')) { text = text.slice(0, offset - match[0].length) + text.slice(offset); offset -= match[0].length; } } }
      const newText = text.slice(0, offset) + char + text.slice(offset);
      DOM.liveInput.innerText = newText; InputController.Format.process(newText, offset + 1); return true;
    },
    validate(fullText, char, type, offset) {
      const textBefore = fullText.substring(0, offset), prevChar = textBefore.trim().slice(-1);
      const textAfter = fullText.substring(offset), nextChar = textAfter.trim().charAt(0);
      if (/=\s*[−-]?\s*[\d.,]+$/.test(textBefore)) { if (/^\s*[−-]?\s*[\d.,]+$/.test(textBefore.split("=").pop()) && (type === 'num' || type === 'dot')) return false; }
      if (offset === 0) {
        if (type === 'op') { if (char !== '−') return false; if (/^\s*[\+\−\×\÷]/.test(textAfter)) return false; }
        if (type === 'dot') { this.handle("0", "num"); this.handle(".", "dot"); return false; }
        return true;
      }
      if (type === 'op') { if (char === '%' && (!/[\d.]/.test(prevChar) || prevChar === '%' || nextChar === '%')) return false; }
      if (type === 'dot') { const lastSeg = textBefore.split(InputController.config.regex.splitSegments).pop(); if (lastSeg.includes('.')) return false; if (lastSeg.trim() === "") { this.handle("0", "num"); this.handle(".", "dot"); return false; } }
      return true;
    },
    applyPercent() {
      if (!this.handle("%", 'op')) return false;
      const raw = DOM.liveInput.innerText.replace(InputController.config.regex.cleanNum, "");
      if (InputController.config.regex.isPercent.test(raw)) { const gSum = Utils.getGrandSum(); if (gSum !== 0) DOM.liveInput.innerText += Utils.formatIN(Utils.toBillingString(gSum)); }
      InputController.Format.process(DOM.liveInput.innerText, DOM.liveInput.innerText.length); return true;
    },
    backspace() {
      InputController.Cursor.ensureFocus(); const text = DOM.liveInput.innerText; if (text === "") return false;
      const sel = window.getSelection(); let offset = sel.rangeCount > 0 ? sel.getRangeAt(0).startOffset : text.length; if (offset === 0) return false;
      const atomicMatch = text.substring(0, offset).match(/=\s*[−-]?\s*[\d.,]+$/);
      if (atomicMatch) { if (/^\s*[−-]?\s*[\d.,]+$/.test(atomicMatch[0].split("=").pop())) { const newText = text.slice(0, offset - atomicMatch[0].length) + text.slice(offset); DOM.liveInput.innerText = newText; InputController.Format.process(newText, offset - atomicMatch[0].length); return true; } }
      const newText = text.slice(0, offset - 1) + text.slice(offset); DOM.liveInput.innerText = newText; InputController.Format.process(newText, offset - 1); return true;
    }
  },
  Format: {
    process(text, cursor) {
      let clean = text.replace(InputController.config.regex.cleanNum, ""); clean = this.updateChains(clean); const formatted = this.formatString(clean);
      const meaningfulIndex = text.substring(0, cursor).replace(InputController.config.regex.cleanNum, "").length;
      DOM.liveInput.innerText = formatted; let newOffset = 0, charCount = 0;
      if (meaningfulIndex > 0) { for (let i = 0; i < formatted.length; i++) { if (!", ".includes(formatted[i])) charCount++; if (charCount === meaningfulIndex) { newOffset = i + 1; break; } } }
      InputController.Cursor.setCaret(newOffset); parseAndRecalculate(false); requestAnimationFrame(() => InputController.Cursor.enforceConstraints());
    },
    updateChains(raw) {
      if (!raw.includes("=")) return raw; const segs = raw.split("="); let newStr = segs[0], cumul = segs[0];
      for (let i = 1; i < segs.length; i++) {
        let res = evaluate(cumul); if (res === "Error") return raw;
        let resStr = Utils.toBillingString(res).replace(/\.00$/, ""); newStr += "=" + resStr;
        let cur = segs[i], match = cur.match(/^\s*[−-]?\s*[\d.]+/);
        if (match) { newStr += cur.substring(match[0].length); cumul = resStr + cur.substring(match[0].length); } else { newStr += cur; cumul = resStr + cur; }
      }
      return newStr.replace(/[\+\-\*\/]{2,}/g, m => m.slice(-1));
    },
    formatString(raw) {
      return raw.replace(/e\+/gi, "_EP_").replace(/e[\-\−]/gi, "_EM_").split(/([\+\−\×\÷%=])/)
        .map(p => {
          const r = p.replace(/_EP_/g, "e+").replace(/_EM_/g, "e−");
          if (InputController.config.operators.concat(['%', '=']).includes(r)) return ` ${r} `;
          if (/^[0-9.,]+$/.test(r) && !r.toLowerCase().includes('e')) return Utils.formatIN(r.replace(/,/g, ""));
          return r;
        }).join("");
    }
  }
};

/* --- MATH ENGINE --- */
function parseAndRecalculate(resetCursor = true) {
  STATE.tokens = InputController.Math.tokenize(DOM.liveInput.innerText);
  let evalRes = evaluate();
  if (evalRes === "Error") { DOM.liveTotal.innerText = "= Error"; return; }
  const raw = DOM.liveInput.innerText.replace(/[, ]/g, "");
  const show = STATE.tokens.length > 0 && !raw.trim().endsWith("=") && !/=\s*[−-]?\s*[\d.,]+$/.test(raw.trim());
  DOM.liveTotal.innerText = show ? `= ${Utils.formatIN(Utils.toBillingString(evalRes))}` : "";
}

function calculatePercentageValue(t, i, tokens) {
  let val = t.rawNum; for (let k = 0; k < t.count; k++) val /= 100;
  let calc = Utils.cleanNum(val);
  if (i > 0) {
    const prev = tokens[i - 1];
    if ((prev === "+" || prev === "−" || prev === "-") && i > 1) {
      const prevPrev = tokens[i - 2];
      if (typeof prevPrev === 'string' && !["+", "−", "-", "×", "*", "÷", "/"].includes(prevPrev)) { let sub = tokens.slice(0, i - 1); let run = evaluate(sub); if (run !== "Error") calc = Utils.cleanNum(run * (t.rawNum / 100)); }
    }
  }
  return calc;
}

function evaluate(tokens = STATE.tokens) {
  let tmp = typeof tokens === 'string' ? InputController.Math.tokenize(tokens) : (Array.isArray(tokens) ? [...tokens] : []);
  while (tmp.length > 0 && ["+", "−", "×", "÷"].includes(tmp.at(-1))) tmp.pop();
  if (tmp.length === 0) return 0;
  let exp = tmp.map(t => typeof t === "object" ? t.value : t).join(" ").replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
  try { let res = new Function("return " + exp)(); return (!isFinite(res) || isNaN(res)) ? "Error" : Utils.cleanNum(res); } catch { return "Error"; }
}

/* --- UI INTERACTIONS --- */
function tap(fn) {
  let res = fn(); if (res !== false) Utils.vibrate(30);
  if (STATE.currentPressedBtn) { const b = STATE.currentPressedBtn; b.classList.add("pressed"); setTimeout(() => b.classList.remove("pressed"), 40); STATE.currentPressedBtn = null; }
}

window.digit = (d) => tap(() => InputController.Insert.handle(d, d === '.' ? 'dot' : 'num'));
window.setOp = (op) => tap(() => InputController.Insert.handle(op === '-' ? '−' : op, 'op'));
window.back = () => tap(() => InputController.Insert.backspace());
window.applyPercent = () => tap(() => InputController.Insert.applyPercent());

window.copyToClipboard = () => {
  const rows = DOM.history.querySelectorAll('.h-row'); if (rows.length === 0) return false;
  let text = "SUMMARY\n";
  rows.forEach(r => {
    const lbl = r.querySelector('.h-lbl') ? r.querySelector('.h-lbl').innerText + " | " : "";
    const math = r.querySelector('.h-math') ? r.querySelector('.h-math').innerText.trim() : r.querySelector('.h-exp').innerText.trim();
    const res = r.querySelector('.h-res').innerText.trim();
    text += `${lbl}${math}  ${res}\n`;
  });
  text += "_______________________\nGRAND TOTAL:  " + DOM.total.innerText;
  if (navigator.clipboard) navigator.clipboard.writeText(text);
  else { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); }
  if(DOM.copyBtn) { DOM.copyBtn.classList.add("pressed"); setTimeout(() => DOM.copyBtn.classList.remove("pressed"), 200); }
  if (typeof Cloud !== "undefined") Cloud.showStatus("Copied");
  return true;
};

window.resolveInline = () => {
  parseAndRecalculate(false); if (STATE.tokens.length === 0) return false; let res = evaluate(); if (res === "Error") return false;
  const blocks = DOM.liveInput.innerText.match(/=\s*([−-]?\s*[\d.,]+)/g);
  if (blocks && Math.abs(parseFloat(blocks[blocks.length-1].replace(/=/g,"").replace(/,/g,"")) - res) < 1e-7) return false;
  let str = Utils.toBillingString(res).replace(/\.00$/, ""); InputController.Insert.handle("=", "op"); return true;
};

window.enter = () => {
  parseAndRecalculate(false); if (!DOM.liveInput.innerText.trim() || !STATE.tokens.length) return false; let res = evaluate(); if (res === "Error") return false;
  let row = document.createElement("div"); row.className = "h-row"; row.dataset.value = res;
  let exp = DOM.liveInput.innerText;
  if (exp.includes("=")) { const lastEq = exp.lastIndexOf("="); if (Math.abs(parseFloat(exp.substring(lastEq + 1).replace(/,/g, "")) - res) < 1e-7) exp = exp.substring(0, lastEq).trim(); }
  exp = exp.replace(/[\s\+\−\×\÷\.\-]+$/, ""); if (!exp) return false;
  let resTxt = Utils.formatIN(Utils.toBillingString(res)); if (resTxt.length > 16) resTxt = Number(res).toExponential(8);
  const labelHtml = LabelController.current ? `<span class="h-lbl">${LabelController.current}</span>` : "";
  row.innerHTML = `<div class="h-exp"> ${labelHtml}<span class="h-math">${exp} =</span></div><span class="h-res ${res < 0 ? 'negative' : ''}">${resTxt}</span><div class="swipe-arrow"></div>`;
  enableSwipe(row); DOM.history.appendChild(row);
  DOM.liveInput.innerText = ""; DOM.liveTotal.innerText = ""; STATE.tokens = [];
  recalculateGrandTotal(); setTimeout(() => row.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
  DOM.liveInput.focus(); InputController.Cursor.renderVisual();
  return true;
};

function recalculateGrandTotal() {
  let sum = Utils.getGrandSum(); let txt = Utils.formatIN(Utils.toBillingString(sum));
  DOM.total.innerText = txt; DOM.history.setAttribute('data-total', txt);
  DOM.total.style.fontSize = txt.length <= 16 ? "" : Math.max(16, 26 - (txt.length - 16) * 0.59) + "px";
  DOM.total.classList.toggle("negative", sum < 0);
  const lbl = document.querySelector(".total-label"); if(lbl) lbl.classList.toggle("is-negative", sum < 0);
  localStorage.setItem("billing_calc_history", DOM.history.innerHTML); localStorage.setItem("active_session_id", STATE.activeSessionId || "");
}

function clearAll() {
  if (STATE.tokens.length === 0 && DOM.history.innerHTML.trim() === "") return false; Utils.vibrate(85);
  if (DOM.history.innerHTML.trim()) {
    let arch = safeLoad("calc_archive", []);
    let data = Array.from(document.querySelectorAll(".h-row")).map(r => ({ exp: r.querySelector(".h-exp").innerHTML, res: r.querySelector(".h-res").innerText, val: Number(r.dataset.value) }));
    let sess = { id: STATE.activeSessionId || Date.now(), time: new Date().toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }), data: data, total: DOM.total.innerText, rawTotal: Utils.getGrandSum() };
    if (STATE.activeSessionId) arch = arch.filter(i => i.id != STATE.activeSessionId);
    arch.unshift(sess); if(arch.length > 512) arch.pop(); localStorage.setItem("calc_archive", JSON.stringify(arch));
  }
  STATE.tokens = []; DOM.liveInput.innerText = ""; DOM.liveTotal.innerText = ""; DOM.history.innerHTML = ""; STATE.activeSessionId = null;
  LabelController.clear(); recalculateGrandTotal(); DOM.liveInput.focus(); InputController.Cursor.renderVisual(); return false;
}

/* --- ARCHIVE & CONVERTER --- */
window.showArchive = () => {
  const arch = safeLoad("calc_archive", []); const isLand = window.matchMedia("(orientation: landscape)").matches;
  if (arch.length === 0) DOM.archiveList.innerHTML = "<div style='text-align:center; padding:40px; color:#999;'>No history records found</div>";
  else {
    const card = (it, idx) => `
      <div class="archive-item">
        <div class="h-card-actions"><span class="h-time">${it.time} ${STATE.activeSessionId == it.id ? '<b style="color:#4caf50;">(EDITING)</b>' : ''}</span>
          <span class="card-icon" onclick="restoreSession(${idx})"><svg viewBox="0 0 24 24" width="18" height="18" fill="#4caf50"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></span>
        </div>
        <div class="archive-data">${it.data.map(r => { let cleanExp = r.exp; return `<div class="archive-data-row"><span style="color:#888; flex:1;">${cleanExp}</span><span class="${r.val < 0 ? 'negative' : ''}" style="font-weight:600;">${r.res}</span></div>`; }).join("")}</div>
        <div class="archive-total-row"><span>TOTAL</span><span class="${it.rawTotal < 0 ? 'negative' : ''}">₹${it.total}</span></div>
      </div>`;
    DOM.archiveList.innerHTML = isLand ? `<div class="archive-col">${arch.filter((_,i)=>i%2==0).map(card).join("")}</div><div class="archive-col">${arch.filter((_,i)=>i%2!=0).map(card).join("")}</div>` : arch.map(card).join("");
  }
  DOM.archiveModal.style.display = "block"; if(!history.state || history.state.modal !== "archive") history.pushState({ modal: "archive" }, ""); return true;
};

window.restoreSession = (idx) => {
  const s = safeLoad("calc_archive", [])[idx]; if (!s) return;
  STATE.tokens = []; DOM.liveInput.innerText = ""; DOM.liveTotal.innerText = ""; DOM.history.innerHTML = ""; STATE.activeSessionId = s.id; LabelController.clear();
  s.data.forEach(d => {
    let r = document.createElement("div"); r.className = "h-row"; r.dataset.value = d.val;
    if (d.exp.includes("<")) r.innerHTML = `<div class="h-exp">${d.exp}</div><span class="h-res ${d.val < 0 ? 'negative' : ''}">${d.res}</span><div class="swipe-arrow"></div>`;
    else r.innerHTML = `<div class="h-exp"><span class="h-math">${d.exp}</span></div><span class="h-res ${d.val < 0 ? 'negative' : ''}">${d.res}</span><div class="swipe-arrow"></div>`;
    enableSwipe(r); DOM.history.appendChild(r);
  });
  recalculateGrandTotal(); window.closeArchive(); tap(()=>{}); if (typeof Cloud !== "undefined") Cloud.showStatus("✔ Restored");
};

function enableSwipe(row) {
  let sx = 0, dx = 0, drag = false;
  row.onclick = (e) => { e.stopPropagation(); 
    if (row.classList.contains("swiping")) return;
    if (row.classList.contains("expanded")) row.classList.remove("expanded");
    else { document.querySelectorAll(".h-row.expanded").forEach(r => r.classList.remove("expanded")); row.classList.add("expanded"); Utils.vibrate(30); setTimeout(() => row.scrollIntoView({behavior:'smooth', block:'nearest'}), 100); }
  };
  row.addEventListener("touchstart", e => { sx = e.touches[0].clientX; drag = true; row.style.transition = "none"; }, {passive:true});
  row.addEventListener("touchmove", e => { 
    if(!drag) return; dx = e.touches[0].clientX - sx;
    let arr = row.querySelector(".swipe-arrow"); row.classList.add("swiping"); row.classList.toggle("edit-mode", dx > 0); row.style.transform = `translateX(${dx}px)`;
    if(arr) arr.style.width = (14 + Math.abs(dx)) + "px";
  }, {passive:true});
  row.addEventListener("touchend", () => { 
    drag = false; row.style.transition = "transform 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28)";
    const th = row.offsetWidth * 0.4;
    if (dx < -th) { row.style.transform = "translateX(-110%)"; Utils.vibrate(30); setTimeout(()=>{ row.remove(); recalculateGrandTotal(); }, 250); }
    else if (dx > th) {
      row.style.transform = "translateX(110%)"; if (STATE.tokens.length) window.enter();
      const lblEl = row.querySelector('.h-lbl'); if (lblEl) LabelController.set(lblEl.innerText); else LabelController.clear();
      let txt = "";
      if (row.querySelector('.h-math')) txt = row.querySelector('.h-math').innerText.replace(/=\s*$/, "").replace(/,/g, "").trim();
      else txt = row.querySelector(".h-exp").innerText.replace(/=\s*$/, "").replace(/,/g, "").trim();
      DOM.liveInput.innerText = txt; InputController.Format.process(txt, txt.length); DOM.liveInput.focus(); tap(()=>{});
      setTimeout(() => { row.style.height="0"; row.style.margin="0"; row.style.opacity="0"; setTimeout(()=>{ row.remove(); recalculateGrandTotal(); }, 300); }, 300);
    } else { row.style.transform = "translateX(0)"; let arr = row.querySelector(".swipe-arrow"); if(arr) arr.style.width = "14px"; setTimeout(() => row.classList.remove("swiping"), 300); }
    dx = 0;
  });
}

const CONVERTER = {
  cur: "0", cat: "length", lastFrom: "m", lastTo: "ft",
  names: { 'm':'Meter','km':'Kilometer','cm':'Centimeter','mm':'Millimeter','in':'Inch','ft':'Foot','yd':'Yard','mi':'Mile','m²':'Sq Meter','ha':'Hectare','km²':'Sq Kilometer','sq ft':'Sq Foot','sq in':'Sq Inch','ac':'Acre','kg':'Kilogram','g':'Gram','mg':'Milligram','lb':'Pound','oz':'Ounce','L':'Liter','ml':'Milliliter','m³':'Cubic Meter','ft³':'Cubic Foot','gal':'Gallon','fl oz':'Fluid Oz' },
  data: { length: {'m':1,'km':1000,'cm':0.01,'mm':0.001,'in':0.0254,'ft':0.3048,'yd':0.9144,'mi':1609.34}, area: {'m²':1,'ha':10000,'km²':1e6,'sq ft':0.0929,'sq in':0.000645,'ac':4046.86}, mass: {'kg':1,'g':0.001,'mg':1e-6,'lb':0.453592,'oz':0.0283495}, volume: {'L':1,'ml':0.001,'m³':1000,'ft³':28.3168,'gal':3.78541,'fl oz':0.02957} },
  init() { this.pop(); DOM.convFromUnit.addEventListener("change", () => this.unitChange('from')); DOM.convToUnit.addEventListener("change", () => this.unitChange('to')); },
  setCat(c) { this.cat = c; this.pop(); },
  pop() {
    const opts = Object.keys(this.data[this.cat]).map(u => `<option value="${u}">${this.names[u]||u} (${u})</option>`).join('');
    DOM.convFromUnit.innerHTML = opts; DOM.convToUnit.innerHTML = opts;
    const defs = { length:{f:'m',t:'ft'}, area:{f:'m²',t:'sq ft'}, mass:{f:'kg',t:'lb'}, volume:{f:'L',t:'gal'} };
    if (defs[this.cat]) { DOM.convFromUnit.value = defs[this.cat].f; DOM.convToUnit.value = defs[this.cat].t; }
    this.lastFrom = DOM.convFromUnit.value; this.lastTo = DOM.convToUnit.value; this.vis(); this.calc();
  },
  unitChange(side) { if (DOM.convFromUnit.value === DOM.convToUnit.value) { if (side === 'from') DOM.convToUnit.value = this.lastFrom; else DOM.convFromUnit.value = this.lastTo; } this.lastFrom = DOM.convFromUnit.value; this.lastTo = DOM.convToUnit.value; this.vis(); this.calc(); },
  vis() { document.getElementById("conv-from-name").innerText = this.names[DOM.convFromUnit.value]; document.getElementById("conv-to-name").innerText = this.names[DOM.convToUnit.value]; },
  append(c) { if (this.cur === "0" && c !== ".") this.cur = c; else { if (c === "." && this.cur.includes(".")) return; if (this.cur.length > 10) return; this.cur += c; } DOM.convFromVal.innerText = this.cur; this.calc(); },
  back() { this.cur = this.cur.length <= 1 ? "0" : this.cur.slice(0, -1); DOM.convFromVal.innerText = this.cur; this.calc(); },
  calc() { const v = parseFloat(this.cur); if (isNaN(v)) { DOM.convToVal.innerText = "0"; return; } const f = this.data[this.cat][DOM.convFromUnit.value], t = this.data[this.cat][DOM.convToUnit.value]; let r = (v * f) / t; DOM.convToVal.innerText = (Math.abs(r) < 1e-6 && r !== 0 || Math.abs(r) > 1e9) ? r.toExponential(4) : parseFloat(r.toPrecision(8)); }
};
CONVERTER.init();

window.showConverter = () => { DOM.converterModal.style.display = "block"; history.pushState({modal:"converter"},""); CONVERTER.cur = "0"; DOM.convFromVal.innerText="0"; CONVERTER.calc(); return true; };
window.changeCategory = (c, el) => { document.querySelectorAll('.conv-tab').forEach(b => b.classList.remove('active')); el.classList.add('active'); CONVERTER.setCat(c); Utils.vibrate(30); };
window.switchUnits = () => { const f = DOM.convFromUnit.value, t = DOM.convToUnit.value; DOM.convFromUnit.value = t; DOM.convToUnit.value = f; CONVERTER.lastFrom = t; CONVERTER.lastTo = f; CONVERTER.vis(); CONVERTER.calc(); return true; };
window.closeConverter = () => { DOM.converterModal.style.display = "none"; if (history.state?.modal === "converter") history.back(); };
window.convDigit = (d) => CONVERTER.append(d); window.convBack = () => CONVERTER.back();

/* --- EVENTS --- */
DOM.liveWrapper.addEventListener("mousedown", (e) => { if(DOM.liveWrapper.contains(e.target)){ InputController.Cursor.ensureFocus(); setTimeout(()=>InputController.Cursor.handleManualTap(e.clientX, e.clientY), 10); } });
DOM.liveWrapper.addEventListener("touchstart", (e) => { if(DOM.liveWrapper.contains(e.target)){ InputController.Cursor.ensureFocus(); setTimeout(()=>InputController.Cursor.handleManualTap(e.touches[0].clientX, e.touches[0].clientY), 10); } }, {passive:true});
DOM.liveInput.addEventListener("focus", () => { DOM.liveWrapper.classList.add("focused"); InputController.Cursor.renderVisual(); });
DOM.liveInput.addEventListener("blur", () => { DOM.liveWrapper.classList.remove("focused"); InputController.Cursor.renderVisual(); });
document.addEventListener('selectionchange', () => { if (document.activeElement === DOM.liveInput) { InputController.Cursor.renderVisual(); InputController.Cursor.enforceConstraints(); } });
document.addEventListener('keydown', (e) => {
  const k = e.key, ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && k.toLowerCase() === 'p') { e.preventDefault(); tap(() => window.print()); }
  else if (ctrl && k.toLowerCase() === 'c') { e.preventDefault(); tap(window.copyToClipboard); }
  else if (k.toLowerCase() === 'h') tap(window.showArchive);
  else if (k === 'Escape') { 
    if (DOM.converterModal.style.display === "block") window.closeConverter();
    else if (DOM.archiveModal.style.display === "block") window.closeArchive();
    else if (DOM.labelModal.style.display === "block") LabelController.close();
    else tap(clearAll); 
  }
  else if (k === 'Delete') tap(clearAll);
  else if (k === 'Enter') { e.preventDefault(); tap(window.enter); }
  else if (k === '=') { e.preventDefault(); tap(window.resolveInline); }
  if (document.activeElement === DOM.liveInput && k !== 'ArrowLeft' && k !== 'ArrowRight') e.preventDefault();
});
document.querySelectorAll('.btn-key').forEach(btn => {
  if (btn.classList.contains('eq')) return;
  btn.removeAttribute('onpointerdown'); btn.removeAttribute('onpointerup'); btn.removeAttribute('onpointerleave');
  if (btn.classList.contains('cut')) {
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); STATE.currentPressedBtn = btn; STATE.isLongPress = false; STATE.cutTimer = setTimeout(() => { if (STATE.tokens.length || DOM.liveInput.innerText) { DOM.liveInput.innerText = ""; parseAndRecalculate(false); Utils.vibrate(30); InputController.Cursor.renderVisual(); btn.classList.add("pressed"); setTimeout(()=>btn.classList.remove("pressed"), 100); } STATE.isLongPress = true; }, 450); });
    btn.addEventListener('pointerup', (e) => { e.preventDefault(); clearTimeout(STATE.cutTimer); if (!STATE.isLongPress) tap(window.back); });
    btn.addEventListener('pointerleave', (e) => { e.preventDefault(); clearTimeout(STATE.cutTimer); });
  } else {
    let cmd = btn.getAttribute('onclick'); if (cmd) { btn.removeAttribute('onclick'); btn.addEventListener('pointerdown', (e) => { e.preventDefault(); STATE.currentPressedBtn = btn; try { eval(cmd); } catch (err) {} }); }
  }
});
let eqTimer, eqLong = false;
window.eqPressStart = (e) => { e.preventDefault(); const b = e.currentTarget; STATE.currentPressedBtn = b; eqLong = false; eqTimer = setTimeout(() => { eqLong = true; tap(window.resolveInline); Utils.vibrate(50); b.classList.add("pressed"); }, 400); };
window.eqPressEnd = (e) => { e.preventDefault(); clearTimeout(eqTimer); if (!eqLong) tap(window.enter); if (STATE.currentPressedBtn) { STATE.currentPressedBtn.classList.remove("pressed"); STATE.currentPressedBtn = null; } };
window.eqPressCancel = () => { clearTimeout(eqTimer); if (STATE.currentPressedBtn) { STATE.currentPressedBtn.classList.remove("pressed"); STATE.currentPressedBtn = null; } };
window.closeArchive = () => { DOM.archiveModal.style.display = "none"; if (history.state?.modal === "archive") history.back(); };
window.clearArchive = () => { if(localStorage.getItem("calc_archive") && confirm("Are you sure! Want to delete all saved history? It cannot be reverted.")) { localStorage.setItem("calc_archive", "[]"); window.showArchive(); Utils.vibrate(50); if (typeof Cloud !== "undefined") Cloud.pushData(); } };
window.onpopstate = () => { if (DOM.archiveModal.style.display === "block") DOM.archiveModal.style.display = "none"; if (DOM.converterModal.style.display === "block") DOM.converterModal.style.display = "none"; if (DOM.labelModal.style.display === "block") DOM.labelModal.style.display = "none"; };
window.addEventListener("resize", () => { if (DOM.archiveModal.style.display === "block") showArchive(); });
try {
  const saved = localStorage.getItem("billing_calc_history"); STATE.activeSessionId = localStorage.getItem("active_session_id") || null;
  if (saved) { DOM.history.innerHTML = saved; document.querySelectorAll(".h-row").forEach(enableSwipe); recalculateGrandTotal(); }
} catch (e) {}
setTimeout(() => { 
  if(DOM.liveInput){ 
    DOM.liveInput.focus(); const range = document.createRange(); range.selectNodeContents(DOM.liveInput); range.collapse(false);
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range); InputController.Cursor.renderVisual(); 
    if (DOM.liveInput.innerText.trim() === "") { const cursor = document.getElementById('custom-cursor'); const wrapper = document.getElementById('live-wrapper'); if (cursor && wrapper) { cursor.style.left = (wrapper.clientWidth / 2) + "px"; cursor.style.top = "10px"; cursor.style.opacity = "1"; } }
  } 
}, 150);
const collapseGlobal = (e) => { if (!e.target.closest('.h-row')) { document.querySelectorAll(".h-row.expanded").forEach(r => r.classList.remove("expanded")); } };
document.addEventListener('click', collapseGlobal); document.addEventListener('touchstart', collapseGlobal, {passive: true});
(function ThemeSync() {
  const update = (isDark) => { isDark ? document.documentElement.removeAttribute('data-theme') : document.documentElement.setAttribute('data-theme', 'light'); setTimeout(() => { document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.setAttribute('content', !isDark ? 'default' : 'black-translucent'); }, 50); };
  const m = window.matchMedia('(prefers-color-scheme: dark)'); update(m.matches); m.addEventListener('change', e => update(e.matches));
})();

/* --- CLOUD SYNC --- */
const Cloud = {
  db: null, user: null,
  config: { apiKey: "AIzaSyBMKa5arpyzC8SCoFTcmxhokAWSYNh2b_w", authDomain: "adding-calculator-pro.firebaseapp.com", projectId: "adding-calculator-pro", storageBucket: "adding-calculator-pro.firebasestorage.app", messagingSenderId: "289708170251", appId: "1:289708170251:web:c30e8d3b744c0f645abb0e", measurementId: "G-70XX5M3NBQ" },
  init() {
    if (!firebase.apps.length) firebase.initializeApp(this.config);
    this.db = firebase.firestore();
    this.db.enablePersistence({ synchronizeTabs: true }).then(()=>console.log("Offline enabled")).catch(e=>console.log(e));
    firebase.auth().onAuthStateChanged((user) => { this.user = user; this.updateUI(user); if (user) { console.log("Logged in"); this.pullData(); } });
  },
  login() { const p = new firebase.auth.GoogleAuthProvider(); firebase.auth().signInWithPopup(p).then(() => this.showStatus("✅ Logged In")).catch(() => this.showStatus("Login Failed")); },
  logout() { firebase.auth().signOut().then(() => location.reload()); },
  pushData() {
    if (!this.user) return;
    const data = { history: localStorage.getItem("billing_calc_history") || "", archive: localStorage.getItem("calc_archive") || "[]", labels: localStorage.getItem("calc_labels") || "[]", lastUpdated: firebase.firestore.FieldValue.serverTimestamp() };
    this.db.collection("users").doc(this.user.uid).set(data, { merge: true }).catch(e => console.log("Queued", e)); 
  },
  pullData() {
    if (!this.user) return;
    this.db.collection("users").doc(this.user.uid).get().then((doc) => {
      if (doc.exists) {
        const d = doc.data();
        if(d.history) localStorage.setItem("billing_calc_history", d.history);
        if(d.archive) localStorage.setItem("calc_archive", d.archive);
        if(d.labels) localStorage.setItem("calc_labels", d.labels);
        if (d.history && DOM.history) { DOM.history.innerHTML = d.history; document.querySelectorAll(".h-row").forEach(enableSwipe); }
        if (typeof LabelController !== "undefined") { LabelController.items = JSON.parse(localStorage.getItem("calc_labels") || "[]"); LabelController.renderList(); }
        if(typeof recalculateGrandTotal === 'function') recalculateGrandTotal();
        this.showStatus("☁ Synced");
      } else this.pushData();
    }).catch(e => console.log("Load failed", e));
  },
  updateUI(user) {
    const btn = document.getElementById("cloud-btn"); if (!btn) return;
    if (user) {
      btn.style.background = "var(--bg-card)"; btn.style.border = "1px solid #4CAF50";
      btn.innerHTML = `<span style="color:#4CAF50; font-size:16px;">●</span> ${user.displayName}`;
      btn.onclick = () => { if(confirm("Log out of Google Sync?")) Cloud.logout(); };
    } else {
      btn.style.background = "transparent"; btn.style.border = "none";
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 18 18" style="margin-right:0px"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.715H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.159 6.656 3.58 9 3.58z"/></svg> <span style="font-weight:600; font-size:14px; color:var(--text-muted);">Sign-in</span>`;
      btn.onclick = () => Cloud.login();
    }
  },
  showStatus(msg) {
    const toast = document.getElementById("toast-msg"); if (!toast) return;
    toast.innerText = msg; toast.className = "show"; setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 2000);
  }
};
Cloud.init();

const cloudOriginalSetItem = localStorage.setItem;
localStorage.setItem = function(key, value) {
  cloudOriginalSetItem.apply(this, arguments);
  if (key === "billing_calc_history" || key === "calc_archive" || key === "calc_labels") { clearTimeout(window.cloudTimer); window.cloudTimer = setTimeout(() => Cloud.pushData(), 2000); }
};
