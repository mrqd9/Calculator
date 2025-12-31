let historyEl = document.getElementById("history");
let liveEl    = document.getElementById("live");
let totalEl   = document.getElementById("total");

let tokens = [];

/* % helpers */
let percentBase = null;

/* ================= TAP ================= */
function tap(fn){
  let ok = fn();
  if(ok && navigator.vibrate) navigator.vibrate(15);
}

/* ================= HELPERS ================= */
function clean(n){
  return Number(Number(n).toPrecision(15));
}

function scrollHistoryToBottom(){
  requestAnimationFrame(()=>{
    historyEl.scrollTop = historyEl.scrollHeight;
  });
}

/* ================= GRAND TOTAL ================= */
function getCurrentGrandTotal(){
  let sum = 0;
  document.querySelectorAll(".h-row").forEach(row=>{
    let v = Number(row.dataset.value);
    if(!isNaN(v)) sum += v;
  });
  return clean(sum);
}

function recalculateGrandTotal(){
  let sum = getCurrentGrandTotal();
  totalEl.innerText = formatIN(sum.toString());
  sum < 0
    ? totalEl.classList.add("negative")
    : totalEl.classList.remove("negative");
}

/* ================= FORMAT ================= */
function formatIN(str){
  if(str==="" || str==="-") return str;

  if(/e/i.test(str)) return str; // scientific stays scientific

  let parts = str.split(".");
  let i = parts[0].replace(/\D/g,"");
  let d = parts[1];

  let last3 = i.slice(-3);
  let rest  = i.slice(0,-3);
  if(rest) rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g,",");

  return (rest ? rest + "," : "") + last3 + (d ? "." + d : "");
}

/* ================= TOKEN DISPLAY ================= */
function formatTokenForDisplay(t){
  if(typeof t === "object") return t.text;
  if(/^-\d/.test(t)) return "- " + formatIN(t.slice(1));
  if(/^\d/.test(t)) return formatIN(t);
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
    tokens[0] = d === "." ? "-0." : "-" + d;
    updateLive(); return true;
  }

  if(["+","-","×","÷"].includes(last)){
    tokens.push(d === "." ? "0." : d);
    updateLive(); return true;
  }

  if(typeof last === "object") return false;

  if(d === "." && last.includes(".")) return false;

  let pure = last.replace("-","").replace(".","");
  if(d !== "." && pure.length >= 12) return false;

  tokens[tokens.length - 1] += d;
  updateLive(); return true;
}

/* ================= OPERATOR ================= */
function setOp(op){
  if(tokens.length === 0){
    if(op === "-"){
      tokens.push("-");
      updateLive(); return true;
    }
    return false;
  }

  let last = tokens[tokens.length - 1];
  if(last === "-" && tokens.length === 1) return false;

  if(["+","-","×","÷"].includes(last)){
    tokens[tokens.length - 1] = op;
  }else{
    tokens.push(op);
  }

  updateLive(); return true;
}

/* ================= PERCENT ================= */
function applyPercent(){

  /* ===== GRAND TOTAL DISCOUNT ===== */
  if(
    tokens.length === 2 &&
    tokens[0] === "-" &&
    !isNaN(tokens[1])
  ){
    let percent = Number(tokens[1]);
    let base = getCurrentGrandTotal();
    if(base === 0) return false;

    let value = clean(base * percent / 100);

    tokens = [
      "-",
      { text: percent + "%", value: value },
      base.toString()
    ];

    updateLive();
    return true;
  }

  /* ===== NORMAL % ===== */
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

  updateLive();
  return true;
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
  try{ result = evaluate(); }
  catch{ return false; }

  let row = document.createElement("div");
  row.className = "h-row";
  row.dataset.value = result;

  row.innerHTML = `
    <span class="h-exp">${tokens.map(formatTokenForDisplay).join(" ")} =</span>
    <span class="h-res">${formatIN(result.toString())}</span>
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
  }else if(["+","-","×","÷"].includes(last)){
    tokens.pop();
  }else if(last.length > 1){
    tokens[tokens.length - 1] = last.slice(0,-1);
  }else{
    tokens.pop();
  }

  updateLive();
  return true;
}

/* ================= CLEAR ================= */
function clearAll(){
  if(tokens.length === 0 && historyEl.innerHTML === "") return false;

  tokens = [];
  percentBase = null;
  historyEl.innerHTML = "";
  updateLive();
  recalculateGrandTotal();
  return true;
}

/* ================= LONG PRESS BACK ================= */
let cutTimer = null;
let cutLong = false;

function cutPressStart(e){
  e.preventDefault();
  cutLong = false;

  cutTimer = setTimeout(()=>{
    if(tokens.length){
      tokens = [];
      percentBase = null;
      updateLive();
      if(navigator.vibrate) navigator.vibrate(25);
    }
    cutLong = true;
  },450);
}

function cutPressEnd(e){
  e.preventDefault();
  clearTimeout(cutTimer);
  if(!cutLong){
    let ok = back();
    if(ok && navigator.vibrate) navigator.vibrate(15);
  }
}

function cutPressCancel(){
  clearTimeout(cutTimer);
}

/* ================= SWIPE DELETE ================= */
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

/* INIT */
updateLive();
recalculateGrandTotal();
