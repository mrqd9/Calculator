/* ================= DOM ================= */
let historyEl = document.getElementById("history");
let liveEl    = document.getElementById("live");
let totalEl   = document.getElementById("total");

/* ================= STATE ================= */
let tokens = [];
let percentBase = null;

/* ================= TAP ================= */
function tap(fn){
  let ok = fn();
  if(ok && navigator.vibrate) navigator.vibrate(15);
}

/* ================= HELPERS ================= */
function clean(n){
  return Number(parseFloat(n).toFixed(12));
}

function scrollHistoryToBottom(){
  requestAnimationFrame(()=>{
    historyEl.scrollTop = historyEl.scrollHeight;
  });
}

/* ================= SAFE NUMBER DISPLAY ================= */
function normalizeNumber(n){
  if(typeof n === "number"){
    return n.toLocaleString("en-IN",{
      useGrouping:true,
      maximumFractionDigits:20
    });
  }
  return n;
}

/* ================= GRAND TOTAL ================= */
function recalculateGrandTotal(){
  let sum = 0;
  document.querySelectorAll(".h-row").forEach(row=>{
    let v = Number(row.dataset.value);
    if(!isNaN(v)) sum += v;
  });

  sum = clean(sum);
  totalEl.innerText = normalizeNumber(sum);
  sum < 0
    ? totalEl.classList.add("negative")
    : totalEl.classList.remove("negative");
}

/* ================= TOKEN DISPLAY ================= */
function formatTokenForDisplay(t){
  if(typeof t === "object") return t.text;
  if(/^-\d/.test(t)) return "- " + normalizeNumber(Number(t.slice(1)));
  if(/^\d/.test(t)) return normalizeNumber(Number(t));
  return t;
}

/* ================= LIVE ================= */
function updateLive(){
  let text = tokens.map(formatTokenForDisplay).join(" ");
  liveEl.innerHTML = text
    ? `${text}<span class="caret"></span>`
    : `<span class="caret"></span>`;
}

/* ================= DIGIT ================= */
function digit(d){
  let last = tokens[tokens.length - 1];

  if(tokens.length === 0){
    tokens.push(d === "." ? "0." : d);
    updateLive(); return true;
  }

  if(last === "-" && tokens.length === 1){
    tokens[0] = (d === ".") ? "-0." : "-" + d;
    updateLive(); return true;
  }

  if(["+","-","×","÷"].includes(last)){
    tokens.push(d === "." ? "0." : d);
    updateLive(); return true;
  }

  if(typeof last === "object") return false;
  if(d === "." && last.includes(".")) return false;

  let pure = last.replace("-","").replace(".","");
  if(d !== "." && pure.length >= 14) return false;

  tokens[tokens.length - 1] += d;
  updateLive(); return true;
}

/* ================= OPERATOR ================= */
function setOp(op){
  if(tokens.length === 0){
    if(op === "-"){ tokens.push("-"); updateLive(); return true; }
    return false;
  }

  let last = tokens[tokens.length - 1];
  if(last === "-" && tokens.length === 1) return false;

  ["+","-","×","÷"].includes(last)
    ? tokens[tokens.length - 1] = op
    : tokens.push(op);

  updateLive(); return true;
}

/* ================= PERCENT ================= */
function applyPercent(){
  if(tokens.length < 2) return false;

  let last = tokens[tokens.length - 1];
  let op   = tokens[tokens.length - 2];
  if(isNaN(last)) return false;

  let B = Number(last);
  let base =
    percentBase ??
    (tokens.length >= 3 && !isNaN(tokens[tokens.length - 3])
      ? Number(tokens[tokens.length - 3])
      : null);

  if(base === null) return false;

  let value;
  if(op === "+" || op === "-"){
    value = base * B / 100;
    percentBase = base + (op === "+" ? value : -value);
  }else{
    value = B / 100;
    percentBase = base;
  }

  tokens[tokens.length - 1] = {
    text: B + "%",
    value: value
  };

  updateLive(); return true;
}

/* ================= EVALUATE ================= */
function evaluate(){
  let exp = tokens.map(t=>{
    if(typeof t === "object") return t.value;
    return t;
  }).join(" ")
   .replace(/×/g,"*")
   .replace(/÷/g,"/");

  return clean(Function("return " + exp)());
}

/* ================= ENTER ================= */
function enter(){
  if(tokens.length === 0) return false;

  let result;
  try{ result = evaluate(); }catch{ return false; }

  let row = document.createElement("div");
  row.className = "h-row";
  row.dataset.value = result;

  row.innerHTML = `
    <span class="h-exp">${tokens.map(formatTokenForDisplay).join(" ")} =</span>
    <span class="h-res">${normalizeNumber(result)}</span>
  `;

  if(result < 0) row.querySelector(".h-res").classList.add("negative");

  enableSwipe(row);
  historyEl.appendChild(row);

  tokens = [];
  percentBase = null;
  updateLive();

  recalculateGrandTotal();
  scrollHistoryToBottom();
  return true;
}

/* ================= BACKSPACE ================= */
function back(){
  if(tokens.length === 0) return false;

  let last = tokens[tokens.length - 1];

  if(typeof last === "object"){
    tokens.pop();
    percentBase = null;
    updateLive(); return true;
  }

  if(["+","-","×","÷"].includes(last)){
    tokens.pop(); updateLive(); return true;
  }

  if(last.length > 1){
    tokens[tokens.length - 1] = last.slice(0,-1);
  }else{
    tokens.pop();
  }

  updateLive(); return true;
}

/* ================= CLEAR ALL ================= */
function clearAll(){
  if(tokens.length === 0 && historyEl.innerHTML === "") return false;

  tokens = [];
  percentBase = null;
  historyEl.innerHTML = "";
  updateLive();
  recalculateGrandTotal();
  return true;
}

/* ================= SWIPE TO DELETE ================= */
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

    if(Math.abs(dx) > row.offsetWidth * 0.35){
      row.style.transform = "translateX(-100%)";
      setTimeout(()=>{
        row.remove();
        recalculateGrandTotal();
        if(navigator.vibrate) navigator.vibrate(20);
      },200);
    }else{
      row.style.transform = "translateX(0)";
      row.classList.remove("swiping");
    }
    dx = 0;
  });

  row.addEventListener("pointercancel", ()=>{
    drag = false;
    row.style.transform = "translateX(0)";
    row.classList.remove("swiping");
  });
}

/* ================= INIT ================= */
updateLive();
recalculateGrandTotal();
