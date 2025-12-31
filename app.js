/* ================= DOM ================= */
const historyEl = document.getElementById("history");
const liveEl    = document.getElementById("live");
const totalEl   = document.getElementById("total");

/* ================= STATE ================= */
let tokens = [];
let percentBase = null;

/* ================= TAP ================= */
function tap(fn){
  try{
    fn();
    if(navigator.vibrate) navigator.vibrate(15);
  }catch(e){
    console.error(e);
  }
}

/* ================= HELPERS ================= */
function scrollHistoryToBottom(){
  requestAnimationFrame(()=>{
    historyEl.scrollTop = historyEl.scrollHeight;
  });
}

/* ================= FORMAT ================= */
function formatIN(str){
  if(str === "" || str === "-") return str;
  str = String(str);

  let [i,d] = str.split(".");
  i = i.replace(/\D/g,"");

  let last3 = i.slice(-3);
  let rest  = i.slice(0,-3);
  if(rest) rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g,",");

  return (rest ? rest + "," : "") + last3 + (d !== undefined ? "." + d : "");
}

/* ================= DISPLAY ================= */
function displayResult(n){
  if(!isFinite(n)) return "Error";
  let s = n.toString();
  if(s.includes("e")) return n.toExponential(2);
  return formatIN(s);
}

function displayTotal(n){
  if(!isFinite(n)) return "Error";
  let s = n.toString();
  if(s.includes("e")){
    s = n.toFixed(12).replace(/\.?0+$/,"");
  }
  return formatIN(s);
}

/* ================= LIVE ================= */
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

/* ================= INPUT ================= */
function digit(d){
  percentBase = null;
  const last = tokens.at(-1);

  if(!tokens.length){
    tokens.push(d === "." ? "0." : d);
    updateLive(); return;
  }

  if(last === "-" && tokens.length === 1){
    tokens[0] = d === "." ? "-0." : "-" + d;
    updateLive(); return;
  }

  if(["+","-","×","÷"].includes(last)){
    tokens.push(d === "." ? "0." : d);
    updateLive(); return;
  }

  if(typeof last === "object") return;
  if(d === "." && last.includes(".")) return;

  tokens[tokens.length - 1] += d;
  updateLive();
}

function setOp(op){
  percentBase = null;

  if(!tokens.length){
    if(op === "-"){ tokens.push("-"); updateLive(); }
    return;
  }

  const last = tokens.at(-1);
  if(last === "-" && tokens.length === 1) return;

  ["+","-","×","÷"].includes(last)
    ? tokens[tokens.length - 1] = op
    : tokens.push(op);

  updateLive();
}

/* ================= PERCENT ================= */
function applyPercent(){
  if(tokens.length < 2) return;

  const last = tokens.at(-1);
  const op   = tokens.at(-2);
  if(isNaN(last)) return;

  const B = Number(last);
  const base =
    percentBase ??
    (!isNaN(tokens.at(-3)) ? Number(tokens.at(-3)) : null);

  if(base === null) return;

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

  updateLive();
}

/* ================= EVALUATE (math.js) ================= */
function evaluate(){
  const exp = tokens.map(t =>
    typeof t === "object" ? t.value : t
  ).join(" ")
   .replace(/×/g,"*")
   .replace(/÷/g,"/");

  return math.evaluate(exp);
}

/* ================= ENTER ================= */
function enter(){
  if(!tokens.length) return;

  let result;
  try{
    result = evaluate();
  }catch{
    return;
  }

  const row = document.createElement("div");
  row.className = "h-row";
  row.dataset.value = result;

  row.innerHTML = `
    <span class="h-exp">${tokens.map(formatToken).join(" ")} =</span>
    <span class="h-res">${displayResult(result)}</span>
  `;

  if(result < 0) row.querySelector(".h-res").classList.add("negative");

  enableSwipe(row);
  historyEl.appendChild(row);

  tokens = [];
  percentBase = null;
  updateLive();

  recalcTotal();
  scrollHistoryToBottom();
}

/* ================= TOTAL ================= */
function recalcTotal(){
  let sum = 0;
  document.querySelectorAll(".h-row").forEach(r=>{
    const v = Number(r.dataset.value);
    if(!isNaN(v)) sum += v;
  });

  totalEl.innerText = displayTotal(sum);
  totalEl.classList.toggle("negative", sum < 0);
}

/* ================= BACKSPACE ================= */
function back(){
  if(!tokens.length) return;

  percentBase = null;
  const last = tokens.at(-1);

  if(typeof last === "object" || ["+","-","×","÷"].includes(last)){
    tokens.pop();
  }else if(last.length > 1){
    tokens[tokens.length - 1] = last.slice(0,-1);
  }else{
    tokens.pop();
  }

  updateLive();
}

/* ================= CLEAR ================= */
function clearAll(){
  tokens = [];
  percentBase = null;
  historyEl.innerHTML = "";
  updateLive();
  recalcTotal();
}

/* ================= LONG PRESS BACK ================= */
let cutTimer = null;
let cutLong = false;

function cutPressStart(e){
  e.preventDefault();
  cutLong = false;

  cutTimer = setTimeout(()=>{
    tokens = [];
    percentBase = null;
    updateLive();
    if(navigator.vibrate) navigator.vibrate(25);
    cutLong = true;
  },450);
}

function cutPressEnd(e){
  e.preventDefault();
  clearTimeout(cutTimer);
  if(!cutLong){
    back();
    if(navigator.vibrate) navigator.vibrate(15);
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
        recalcTotal();
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
recalcTotal();
