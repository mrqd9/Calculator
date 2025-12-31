/* ================= DOM ================= */
const historyEl = document.getElementById("history");
const liveEl    = document.getElementById("live");
const totalEl   = document.getElementById("total");

/* ================= STATE ================= */
let expr = "";
let grandTotal = 0;

/* ================= UTILS ================= */
const vibrate = ms => navigator.vibrate && navigator.vibrate(ms);

function clean(n){
  return Number(parseFloat(n).toPrecision(15));
}

function scrollHistory(){
  requestAnimationFrame(()=>{
    historyEl.scrollTop = historyEl.scrollHeight;
  });
}

/* ================= FORMAT ================= */
function formatIN(n){
  if(n === "" || n === "-") return n;
  let str = String(n);
  if(str.includes("e")) return str;

  let [i,d] = str.split(".");
  i = i.replace(/\B(?=(\d{3})+(?!\d))/g,",");
  return d ? i + "." + d : i;
}

/* ================= LIVE ================= */
function updateLive(){
  liveEl.innerHTML = expr
    ? `${formatIN(expr)}<span class="caret"></span>`
    : `<span class="caret"></span>`;
}

/* ================= INPUT ================= */
function digit(d){
  if(d === "." && /(\.\d*)$/.test(expr)) return false;
  expr += d;
  updateLive();
  vibrate(8);
  return true;
}

function setOp(op){
  if(!expr && op !== "-") return false;

  if(/[+\-×÷]$/.test(expr)){
    expr = expr.slice(0,-1) + op;
  }else{
    expr += op;
  }
  updateLive();
  vibrate(8);
  return true;
}

/* ================= ADVANCED % ================= */
function applyPercent(){
  if(!expr) return false;

  // last number
  let numMatch = expr.match(/(-?\d+\.?\d*)$/);
  if(!numMatch) return false;

  let B = Number(numMatch[1]);

  // left side operator + base
  let left = expr.slice(0, numMatch.index);
  let opMatch = left.match(/([+\-×÷])\s*(-?\d+\.?\d*)$/);

  let value;

  if(opMatch){
    let op = opMatch[1];
    let A = Number(opMatch[2]);

    if(op === "+" || op === "-"){
      value = A * B / 100;
    }else{
      value = B / 100;
    }
  }else{
    value = B / 100;
  }

  expr = left + value;
  updateLive();
  vibrate(10);
  return true;
}

/* ================= EVALUATE ================= */
function evaluateExpression(){
  let safe = expr
    .replace(/×/g,"*")
    .replace(/÷/g,"/");

  return clean(Function("return " + safe)());
}

/* ================= ENTER ================= */
function enter(){
  if(!expr) return false;

  let result;
  try{
    result = evaluateExpression();
  }catch{
    return false;
  }

  let row = document.createElement("div");
  row.className = "h-row";
  row.dataset.value = result;

  row.innerHTML = `
    <span class="h-exp">${formatIN(expr)} =</span>
    <span class="h-res">${formatIN(result)}</span>
  `;

  if(result < 0){
    row.querySelector(".h-res").classList.add("negative");
  }

  enableSwipe(row);
  historyEl.appendChild(row);

  grandTotal = clean(grandTotal + result);
  totalEl.innerText = formatIN(grandTotal);
  totalEl.classList.toggle("negative", grandTotal < 0);

  expr = "";
  updateLive();
  scrollHistory();
  vibrate(20);
  return true;
}

/* ================= BACKSPACE ================= */
function back(){
  if(!expr) return false;
  expr = expr.slice(0,-1);
  updateLive();
  vibrate(8);
  return true;
}

/* ================= CLEAR ================= */
function clearAll(){
  if(!expr && !historyEl.children.length) return false;
  expr = "";
  grandTotal = 0;
  historyEl.innerHTML = "";
  totalEl.innerText = "0";
  totalEl.classList.remove("negative");
  updateLive();
  vibrate(30);
  return true;
}

/* ================= SWIPE DELETE ================= */
function enableSwipe(row){
  let startX=0, dx=0, drag=false;

  row.addEventListener("pointerdown", e=>{
    startX = e.clientX;
    drag = true;
    row.classList.add("swiping");
    row.style.transition = "none";
  });

  row.addEventListener("pointermove", e=>{
    if(!drag) return;
    dx = e.clientX - startX;
    if(dx < 0) row.style.transform = `translateX(${dx}px)`;
  });

  row.addEventListener("pointerup", ()=>{
    drag = false;
    row.style.transition = "transform .25s ease";

    if(Math.abs(dx) > row.offsetWidth * 0.35){
      let v = Number(row.dataset.value);
      if(!isNaN(v)) grandTotal = clean(grandTotal - v);
      totalEl.innerText = formatIN(grandTotal);
      totalEl.classList.toggle("negative", grandTotal < 0);

      row.style.transform = "translateX(-100%)";
      setTimeout(()=>row.remove(),200);
      vibrate(20);
    }else{
      row.style.transform = "translateX(0)";
      row.classList.remove("swiping");
    }
    dx = 0;
  });
}

/* INIT */
updateLive();
