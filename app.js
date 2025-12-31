const historyEl = document.getElementById("history");
const liveEl    = document.getElementById("live");
const totalEl   = document.getElementById("total");

let tokens = [];   // ["10", "+", "10%"]
let historyValues = [];

/* ================= UTIL ================= */
const OPS = ["+","-","×","÷"];

function vibrate(ms){
  if(navigator.vibrate) navigator.vibrate(ms);
}

function safeNumber(n){
  return Number.isFinite(n) ? n : 0;
}

/* ================= FORMAT ================= */
function formatNumber(n){
  if(!Number.isFinite(n)) return "0";

  // keep very small numbers raw
  if(Math.abs(n) < 1e-6) return n.toString();

  let [i,d] = n.toString().split(".");
  i = i.replace(/\D/g,"");

  let last3 = i.slice(-3);
  let rest  = i.slice(0,-3);
  if(rest) rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g,",");

  return (rest ? rest + "," : "") + last3 + (d ? "." + d : "");
}

function updateLive(){
  const text = tokens.join(" ");
  liveEl.innerHTML = text
    ? `${text}<span class="caret"></span>`
    : `<span class="caret"></span>`;
}

/* ================= INPUT ================= */
function digit(d){
  const last = tokens.at(-1);

  if(!tokens.length){
    tokens.push(d === "." ? "0." : d);
    updateLive(); return true;
  }

  if(OPS.includes(last)){
    tokens.push(d === "." ? "0." : d);
    updateLive(); return true;
  }

  if(last.includes("%")) return false;
  if(d === "." && last.includes(".")) return false;

  tokens[tokens.length - 1] += d;
  updateLive(); return true;
}

function setOp(op){
  if(!tokens.length){
    if(op === "-"){
      tokens.push("-");
      updateLive(); return true;
    }
    return false;
  }

  const last = tokens.at(-1);
  if(OPS.includes(last)){
    tokens[tokens.length - 1] = op;
  }else{
    tokens.push(op);
  }

  updateLive(); return true;
}

/* ================= PERCENT ================= */
function applyPercent(){
  if(tokens.length < 2) return false;

  const value = tokens.at(-1);
  const op    = tokens.at(-2);

  if(isNaN(value)) return false;

  tokens[tokens.length - 1] = value + "%";
  updateLive(); return true;
}

/* ================= EVALUATE ================= */
function evaluateTokens(){
  let result = Number(tokens[0]);

  for(let i = 1; i < tokens.length; i += 2){
    const op = tokens[i];
    let valToken = tokens[i+1];
    if(!valToken) break;

    let val;
    if(valToken.endsWith("%")){
      const p = Number(valToken.slice(0,-1));
      if(op === "+" || op === "-"){
        val = result * p / 100;
      }else{
        val = p / 100;
      }
    }else{
      val = Number(valToken);
    }

    if(op === "+") result += val;
    if(op === "-") result -= val;
    if(op === "×") result *= val;
    if(op === "÷") result /= val;
  }

  return safeNumber(result);
}

/* ================= ENTER ================= */
function enter(){
  if(!tokens.length) return false;

  const result = evaluateTokens();

  const row = document.createElement("div");
  row.className = "h-row";
  row.dataset.value = result;

  row.innerHTML = `
    <span class="h-exp">${tokens.join(" ")} =</span>
    <span class="h-res">${formatNumber(result)}</span>
  `;

  if(result < 0) row.querySelector(".h-res").classList.add("negative");

  historyEl.appendChild(row);
  historyValues.push(result);

  tokens = [];
  updateLive();
  updateGrandTotal();
  historyEl.scrollTop = historyEl.scrollHeight;
  vibrate(15);
  return true;
}

/* ================= BACKSPACE ================= */
function back(){
  if(!tokens.length) return false;

  let last = tokens.at(-1);
  if(last.length > 1){
    tokens[tokens.length - 1] = last.slice(0,-1);
  }else{
    tokens.pop();
  }

  updateLive(); return true;
}

/* ================= CLEAR ================= */
function clearAll(){
  tokens = [];
  historyValues = [];
  historyEl.innerHTML = "";
  updateLive();
  updateGrandTotal();
  vibrate(20);
  return true;
}

/* ================= TOTAL ================= */
function updateGrandTotal(){
  const sum = historyValues.reduce((a,b)=>a+b,0);
  totalEl.innerText = formatNumber(sum);
  totalEl.classList.toggle("negative", sum < 0);
}

/* INIT */
updateLive();
updateGrandTotal();
