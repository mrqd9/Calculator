/* ================= DOM ================= */
const historyEl = document.getElementById("history");
const liveEl    = document.getElementById("live");
const totalEl   = document.getElementById("total");

/* ================= STATE ================= */
let tokens = [];
let percentBase = null;

/* ================= UTILS ================= */
const vibrate = ms => navigator.vibrate && navigator.vibrate(ms);

function scrollHistory(){
  requestAnimationFrame(()=>{
    historyEl.scrollTop = historyEl.scrollHeight;
  });
}

/* ================= FORMAT ================= */
function formatIN(str){
  if(str === "" || str === "-") return str;

  let [i,d] = String(str).split(".");
  i = i.replace(/\D/g,"");

  let last3 = i.slice(-3);
  let rest  = i.slice(0,-3);
  if(rest) rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g,",");

  return (rest ? rest + "," : "") + last3 + (d ? "." + d : "");
}

function displayNumber(n){
  if(!isFinite(n)) return "Error";

  let s = math.format(n,{
    notation: "auto",
    precision: 12
  });

  if(s.includes("e")) return s;
  return formatIN(s);
}

/* ================= LIVE ================= */
function updateLive(){
  const text = tokens.map(t=>{
    if(typeof t === "object") return t.text;
    if(/^-\d/.test(t)) return "- " + formatIN(t.slice(1));
    if(/^\d/.test(t)) return formatIN(t);
    return t;
  }).join(" ");

  liveEl.innerHTML = text
    ? `${text}<span class="caret"></span>`
    : `<span class="caret"></span>`;
}

/* ================= GRAND TOTAL ================= */
function recalcTotal(){
  let sum = math.bignumber(0);

  document.querySelectorAll(".h-row").forEach(r=>{
    const v = r.dataset.value;
    if(v) sum = math.add(sum, math.bignumber(v));
  });

  totalEl.innerText = displayNumber(sum);
  totalEl.classList.toggle("negative", sum < 0);
}

/* ================= INPUT ================= */
function digit(d){
  percentBase = null;

  let last = tokens.at(-1);

  if(!tokens.length){
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

  tokens[tokens.length-1] += d;
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

  let last = tokens.at(-1);
  if(last === "-" && tokens.length === 1) return false;

  ["+","-","×","÷"].includes(last)
    ? tokens[tokens.length-1] = op
    : tokens.push(op);

  updateLive(); return true;
}

/* ================= PERCENT ================= */
function applyPercent(){
  if(tokens.length < 2) return false;

  let last = tokens.at(-1);
  let op   = tokens.at(-2);

  if(isNaN(last)) return false;

  let B = math.bignumber(last);
  let base;

  if(percentBase !== null){
    base = percentBase;
  }else if(tokens.length >= 3 && !isNaN(tokens.at(-3))){
    base = math.bignumber(tokens.at(-3));
  }else{
    return false;
  }

  let value;

  if(op === "+" || op === "-"){
    value = math.divide(math.multiply(base, B), 100);
    percentBase = op === "+"
      ? math.add(base, value)
      : math.subtract(base, value);
  }else{
    value = math.divide(B, 100);
    percentBase = base;
  }

  tokens[tokens.length-1] = {
    text: last + "%",
    value: value.toString()
  };

  updateLive(); return true;
}

/* ================= EVALUATE ================= */
function evaluate(){
  let expr = tokens.map(t=>{
    if(typeof t === "object") return t.value;
    if(t === "×") return "*";
    if(t === "÷") return "/";
    return t;
  }).join(" ");

  return math.evaluate(expr);
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
  row.dataset.value = result.toString();

  row.innerHTML = `
    <span class="h-exp">${tokens.map(t=>typeof t==="object"?t.text:t).join(" ")} =</span>
    <span class="h-res">${displayNumber(result)}</span>
  `;

  if(result < 0) row.querySelector(".h-res").classList.add("negative");

  enableSwipe(row);
  historyEl.appendChild(row);

  tokens = [];
  percentBase = null;
  updateLive();
  recalcTotal();
  scrollHistory();
  vibrate(15);
  return true;
}

/* ================= BACKSPACE ================= */
function back(){
  if(!tokens.length) return false;

  percentBase = null;
  let last = tokens.at(-1);

  if(typeof last === "object"){
    tokens.pop();
  }else if(last.length > 1){
    tokens[tokens.length-1] = last.slice(0,-1);
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
  vibrate(20);
  return true;
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
}

/* INIT */
updateLive();
recalcTotal();
