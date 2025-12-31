let historyEl = document.getElementById("history");
let liveEl = document.getElementById("live");
let totalEl = document.getElementById("total");

let tokens = [];
let percentBase = null;

/* ================= TAP ================= */
function tap(fn){
  let ok = fn();
  if(ok && navigator.vibrate) navigator.vibrate(15);
}

/* ================= HELPERS ================= */
function scrollHistoryToBottom(){
  requestAnimationFrame(()=>{
    historyEl.scrollTop = historyEl.scrollHeight;
  });
}

/* ================= SAFE NUMBER ================= */
function safeNumber(n){
  return Number.isFinite(n) ? n : 0;
}

/* ================= GRAND TOTAL ================= */
function recalculateGrandTotal(){
  let sum = 0;
  document.querySelectorAll(".h-row").forEach(row=>{
    let v = Number(row.dataset.value);
    if(!isNaN(v)) sum += v;
  });

  totalEl.innerText = formatDisplay(sum);
  totalEl.classList.toggle("negative", sum < 0);
}

/* ================= FORMAT ================= */
function formatDisplay(n){
  if(!isFinite(n)) return "0";

  // very small OR scientific → show raw
  if(Math.abs(n) < 1e-6) return n.toString();

  let [i,d] = n.toString().split(".");
  i = i.replace(/\D/g,"");

  let last3 = i.slice(-3);
  let rest  = i.slice(0,-3);
  if(rest) rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g,",");

  return (rest ? rest + "," : "") + last3 + (d ? "." + d : "");
}

function formatTokenForDisplay(t){
  if(typeof t === "object") return t.text;
  if(/^-\d/.test(t)) return "- " + formatDisplay(Number(t.slice(1)));
  if(/^\d/.test(t)) return formatDisplay(Number(t));
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

  tokens[tokens.length - 1] += d;
  updateLive(); return true;
}

/* ================= OPERATOR ================= */
function setOp(op){
  if(!tokens.length){
    if(op === "-"){ tokens.push("-"); updateLive(); return true; }
    return false;
  }

  let last = tokens.at(-1);
  if(last === "-" && tokens.length === 1) return false;

  ["+","-","×","÷"].includes(last)
    ? tokens[tokens.length - 1] = op
    : tokens.push(op);

  updateLive(); return true;
}

/* ================= PERCENT (BILLING STYLE) ================= */
function applyPercent(){
  if(tokens.length < 2) return false;

  let valToken = tokens.at(-1);
  let op = tokens.at(-2);
  if(isNaN(valToken)) return false;

  let base = Number(tokens[0]);
  for(let i=1;i<tokens.length-2;i+=2){
    let v = Number(tokens[i+1]);
    if(tokens[i]==="+") base += v;
    if(tokens[i]==="-") base -= v;
    if(tokens[i]==="×") base *= v;
    if(tokens[i]==="÷") base /= v;
  }

  let value =
    (op==="+" || op==="-")
      ? base * Number(valToken) / 100
      : Number(valToken) / 100;

  tokens[tokens.length - 1] = {
    text: valToken + "%",
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

  return safeNumber(Function("return " + exp)());
}

/* ================= ENTER ================= */
function enter(){
  if(!tokens.length) return false;

  let result;
  try{ result = evaluate(); }
  catch{ return false; }

  let row = document.createElement("div");
  row.className = "h-row";
  row.dataset.value = result;

  row.innerHTML = `
    <span class="h-exp">${tokens.map(formatTokenForDisplay).join(" ")} =</span>
    <span class="h-res">${formatDisplay(result)}</span>
  `;

  if(result < 0) row.querySelector(".h-res").classList.add("negative");

  enableSwipe(row);
  historyEl.appendChild(row);

  tokens = [];
  updateLive();
  recalculateGrandTotal();
  scrollHistoryToBottom();
  return true;
}

/* ================= BACKSPACE ================= */
function back(){
  if(!tokens.length) return false;

  let last = tokens.at(-1);
  if(typeof last === "object" || ["+","-","×","÷"].includes(last)){
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
  if(!tokens.length && !historyEl.innerHTML) return false;
  tokens = [];
  historyEl.innerHTML = "";
  updateLive();
  recalculateGrandTotal();
  return true;
}

/* ================= SWIPE DELETE ================= */
function enableSwipe(row){
  let sx=0, dx=0, drag=false;

  row.addEventListener("pointerdown", e=>{
    sx=e.clientX; drag=true;
    row.classList.add("swiping");
    row.style.transition="none";
  });

  row.addEventListener("pointermove", e=>{
    if(!drag) return;
    dx=e.clientX-sx;
    if(dx<0) row.style.transform=`translateX(${dx}px)`;
  });

  row.addEventListener("pointerup", ()=>{
    drag=false;
    row.style.transition="transform .25s ease";
    if(Math.abs(dx)>row.offsetWidth*0.35){
      row.style.transform="translateX(-100%)";
      setTimeout(()=>{
        row.remove();
        recalculateGrandTotal();
        navigator.vibrate && navigator.vibrate(20);
      },200);
    }else{
      row.style.transform="translateX(0)";
      row.classList.remove("swiping");
    }
    dx=0;
  });
}

/* INIT */
updateLive();
recalculateGrandTotal();
