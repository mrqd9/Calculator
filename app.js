/* ================= DOM ================= */
const historyEl = document.getElementById("history");
const liveEl    = document.getElementById("live");
const totalEl   = document.getElementById("total");

/* ================= MATH ENGINE ================= */
const M = math.create(math.all, {
  number: 'BigNumber',
  precision: 64
});

/* ================= STATE ================= */
let tokens = [];
let percentBase = null;

const OPS = ["+","-","×","÷"];

/* ================= HAPTIC ================= */
const vibrate = ms => navigator.vibrate && navigator.vibrate(ms);

/* ================= HELPERS ================= */
function scrollHistoryToBottom(){
  requestAnimationFrame(()=>{
    historyEl.scrollTop = historyEl.scrollHeight;
  });
}

/* ================= FORMAT ================= */
function formatIN(str){
  if(str === "" || str === "-") return str;

  let [i,d] = str.split(".");
  i = i.replace(/\D/g,"");

  let last3 = i.slice(-3);
  let rest  = i.slice(0,-3);
  if(rest) rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g,",");

  return (rest ? rest + "," : "") + last3 + (d ? "." + d : "");
}

function displayResult(n){
  if(!isFinite(n)) return "Error";
  const s = n.toString();
  return s.includes("e") ? Number(n).toExponential(2) : formatIN(s);
}

function displayTotal(n){
  if(!isFinite(n)) return "Error";
  let s = n.toString();
  if(s.includes("e")){
    s = Number(n).toFixed(12).replace(/\.?0+$/,"");
  }
  return formatIN(s);
}

/* ================= LIVE DISPLAY ================= */
function formatToken(t){
  if(typeof t === "object") return t.text;
  if(/^-\d/.test(t)) return "- " + formatIN(t.slice(1));
  if(/^\d/.test(t)) return formatIN(t);
  return t;
}

function updateLive(){
  const text = tokens.map(formatToken).join(" ");
  liveEl.innerHTML = text
    ? `${text}<span class="caret"></span>`
    : `<span class="caret"></span>`;
}

/* ================= GRAND TOTAL ================= */
function recalcTotal(){
  let sum = M.bignumber(0);

  document.querySelectorAll(".h-row").forEach(r=>{
    const v = r.dataset.value;
    if(v !== undefined){
      sum = sum.plus(M.bignumber(v));
    }
  });

  totalEl.innerText = displayTotal(sum.toString());
  totalEl.classList.toggle("negative", sum.isNegative());
}

/* ================= INPUT ================= */
function digit(d){
  percentBase = null;

  const last = tokens.at(-1);

  if(!tokens.length){
    tokens.push(d === "." ? "0." : d);
    updateLive(); return true;
  }

  if(last === "-" && tokens.length === 1){
    tokens[0] = d === "." ? "-0." : "-" + d;
    updateLive(); return true;
  }

  if(OPS.includes(last)){
    tokens.push(d === "." ? "0." : d);
    updateLive(); return true;
  }

  if(typeof last === "object") return false;
  if(d === "." && last.includes(".")) return false;

  const pure = last.replace("-","").replace(".","");
  if(d !== "." && pure.length >= 12) return false;

  tokens[tokens.length - 1] += d;
  updateLive(); return true;
}

function setOp(op){
  percentBase = null;

  if(!tokens.length){
    if(op === "-"){
      tokens.push("-");
      updateLive(); return true;
    }
    return false;
  }

  const last = tokens.at(-1);
  if(last === "-" && tokens.length === 1) return false;

  OPS.includes(last)
    ? tokens[tokens.length - 1] = op
    : tokens.push(op);

  updateLive(); return true;
}

/* ================= PERCENT (BILLING CORRECT) ================= */
function applyPercent(){
  if(tokens.length < 2) return false;

  const last = tokens.at(-1);
  const op   = tokens.at(-2);
  if(isNaN(last)) return false;

  const B = M.bignumber(last);

  let base;
  if(percentBase !== null){
    base = percentBase;
  }else if(tokens.length >= 3 && !isNaN(tokens.at(-3))){
    base = M.bignumber(tokens.at(-3));
  }else{
    return false;
  }

  let value;
  if(op === "+" || op === "-"){
    value = base.mul(B).div(100);
    percentBase = op === "+"
      ? base.plus(value)
      : base.minus(value);
  }else{
    value = B.div(100);
    percentBase = base;
  }

  tokens[tokens.length - 1] = {
    text: B.toString() + "%",
    value: value.toString()
  };

  updateLive();
  return true;
}

/* ================= EVALUATE ================= */
function evaluate(){
  const expr = tokens.map(t=>{
    if(typeof t === "object") return t.value;
    if(t === "×") return "*";
    if(t === "÷") return "/";
    return t;
  }).join(" ");

  const res = M.evaluate(expr);
  return res.toString();
}

/* ================= ENTER ================= */
function enter(){
  if(!tokens.length) return false;

  let result;
  try{
    result = evaluate();
  }catch{
    return false;
  }

  const row = document.createElement("div");
  row.className = "h-row";
  row.dataset.value = result;

  row.innerHTML = `
    <span class="h-exp">${tokens.map(formatToken).join(" ")} =</span>
    <span class="h-res">${displayResult(result)}</span>
  `;

  if(M.bignumber(result).isNegative()){
    row.querySelector(".h-res").classList.add("negative");
  }

  enableSwipe(row);
  historyEl.appendChild(row);

  tokens = [];
  percentBase = null;
  updateLive();

  recalcTotal();
  scrollHistoryToBottom();
  return true;
}

/* ================= BACKSPACE ================= */
function back(){
  if(!tokens.length) return false;

  percentBase = null;

  const last = tokens.at(-1);

  if(typeof last === "object" || OPS.includes(last)){
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
  if(!tokens.length && !historyEl.children.length) return false;

  tokens = [];
  percentBase = null;
  historyEl.innerHTML = "";
  updateLive();
  recalcTotal();
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
      vibrate(25);
    }
    cutLong = true;
  },450);
}

function cutPressEnd(e){
  e.preventDefault();
  clearTimeout(cutTimer);
  if(!cutLong && back()) vibrate(15);
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
        recalcTotal();
        vibrate(20);
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
recalcTotal();
