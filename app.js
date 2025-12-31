/* ================= DOM ================= */
const historyEl = document.getElementById("history");
const liveEl    = document.getElementById("live");
const totalEl   = document.getElementById("total");

/* ================= STATE ================= */
let tokens = [];
let percentBase = null;

const OPS = ["+","-","×","÷"];

/* ================= CORE HELPERS ================= */
const vibrate = ms => navigator.vibrate && navigator.vibrate(ms);

const commit = () => {
  updateLive();
  return true;
};

function clean(n){
  return Number(parseFloat(n).toFixed(10));
}

/* ================= FORMAT ================= */
function formatIN(n){
  if(n === "" || n === "-") return n;
  let str = String(n);

  let [i,d] = str.split(".");
  i = i.replace(/\D/g,"");

  let last3 = i.slice(-3);
  let rest  = i.slice(0,-3);
  if(rest) rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g,",");

  return (rest ? rest + "," : "") + last3 + (d ? "." + d : "");
}

function formatToken(t){
  if(typeof t === "object") return t.text;
  if(/^-\d/.test(t)) return "- " + formatIN(t.slice(1));
  if(/^\d/.test(t)) return formatIN(t);
  return t;
}

/* ================= UI ================= */
function updateLive(){
  const text = tokens.map(formatToken).join(" ");
  liveEl.innerHTML = text
    ? `${text}<span class="caret"></span>`
    : `<span class="caret"></span>`;
}

/* ================= GRAND TOTAL ================= */
function recalcTotal(){
  let sum = 0;
  document.querySelectorAll(".h-row").forEach(r=>{
    let v = Number(r.dataset.value);
    if(!isNaN(v)) sum += v;
  });

  sum = clean(sum);
  totalEl.innerText = formatIN(sum);
  totalEl.classList.toggle("negative", sum < 0);
}

/* ================= INPUT ================= */
function digit(d){
  const last = tokens.at(-1);

  if(!tokens.length){
    tokens.push(d === "." ? "0." : d);
    return commit();
  }

  if(last === "-" && tokens.length === 1){
    tokens[0] = d === "." ? "-0." : "-" + d;
    return commit();
  }

  if(OPS.includes(last)){
    tokens.push(d === "." ? "0." : d);
    return commit();
  }

  if(typeof last === "object") return false;
  if(d === "." && last.includes(".")) return false;

  let pure = last.replace("-","").replace(".","");
  if(d !== "." && pure.length >= 12) return false;

  tokens[tokens.length - 1] += d;
  return commit();
}

function setOp(op){
  if(!tokens.length){
    if(op === "-"){
      tokens.push("-");
      return commit();
    }
    return false;
  }

  const last = tokens.at(-1);
  if(last === "-" && tokens.length === 1) return false;

  OPS.includes(last)
    ? tokens[tokens.length - 1] = op
    : tokens.push(op);

  return commit();
}

/* ================= PERCENT ================= */
function applyPercent(){
  if(tokens.length < 2) return false;

  const last = tokens.at(-1);
  const op   = tokens.at(-2);
  if(isNaN(last)) return false;

  const B = Number(last);
  const base =
    percentBase ??
    (tokens.length >= 3 && !isNaN(tokens.at(-3))
      ? Number(tokens.at(-3))
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
    value
  };

  return commit();
}

/* ================= EVAL ================= */
function evaluate(){
  const exp = tokens.map(t =>
    typeof t === "object" ? t.value : t
  ).join(" ")
   .replace(/×/g,"*")
   .replace(/÷/g,"/");

  return clean(Function("return " + exp)());
}

/* ================= ENTER ================= */
function enter(){
  if(!tokens.length) return false;

  let result;
  try{ result = evaluate(); }
  catch{ return false; }

  const row = document.createElement("div");
  row.className = "h-row";
  row.dataset.value = result;

  row.innerHTML = `
    <span class="h-exp">${tokens.map(formatToken).join(" ")} =</span>
    <span class="h-res">${formatIN(result)}</span>
  `;

  if(result < 0) row.querySelector(".h-res").classList.add("negative");

  enableSwipe(row);
  historyEl.appendChild(row);

  tokens = [];
  percentBase = null;

  updateLive();
  recalcTotal();
  historyEl.scrollTop = historyEl.scrollHeight;
  return true;
}

/* ================= BACKSPACE ================= */
function back(){
  if(!tokens.length) return false;

  const last = tokens.at(-1);

  if(typeof last === "object" || OPS.includes(last)){
    tokens.pop();
    return commit();
  }

  last.length > 1
    ? tokens[tokens.length - 1] = last.slice(0,-1)
    : tokens.pop();

  return commit();
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
