/* ================= DOM ================= */
const historyEl = document.getElementById("history");
const liveEl    = document.getElementById("live");
const totalEl   = document.getElementById("total");

/* ================= STATE ================= */
let tokens = [];
let percentBase = null;

const OPS = ["+","-","×","÷"];

/* ================= HELPERS ================= */
function vibrate(ms){
  if(navigator.vibrate) navigator.vibrate(ms);
}

function clean(n){
  return Number(parseFloat(n).toFixed(10));
}

function commit(){
  updateLive();
  return true;
}

/* ================= FORMAT ================= */
function formatIN(n){
  if(n === "" || n === "-") return n;

  let str = String(n);
  let parts = str.split(".");
  let i = parts[0].replace(/\D/g,"");
  let d = parts[1];

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
    ? text + '<span class="caret"></span>'
    : '<span class="caret"></span>';
}

/* ================= TOTAL ================= */
function recalcTotal(){
  let sum = 0;
  const rows = document.querySelectorAll(".h-row");
  for(let i=0;i<rows.length;i++){
    let v = Number(rows[i].dataset.value);
    if(!isNaN(v)) sum += v;
  }
  sum = clean(sum);
  totalEl.innerText = formatIN(sum);
  totalEl.classList.toggle("negative", sum < 0);
}

/* ================= DIGIT ================= */
function digit(d){
  let last = tokens[tokens.length - 1];

  if(tokens.length === 0){
    tokens.push(d === "." ? "0." : d);
    return commit();
  }

  if(last === "-" && tokens.length === 1){
    tokens[0] = d === "." ? "-0." : "-" + d;
    return commit();
  }

  if(OPS.indexOf(last) !== -1){
    tokens.push(d === "." ? "0." : d);
    return commit();
  }

  if(typeof last === "object") return false;
  if(d === "." && last.indexOf(".") !== -1) return false;

  let pure = last.replace("-","").replace(".","");
  if(d !== "." && pure.length >= 12) return false;

  tokens[tokens.length - 1] += d;
  return commit();
}

/* ================= OPERATOR ================= */
function setOp(op){
  if(tokens.length === 0){
    if(op === "-"){
      tokens.push("-");
      return commit();
    }
    return false;
  }

  let last = tokens[tokens.length - 1];
  if(last === "-" && tokens.length === 1) return false;

  if(OPS.indexOf(last) !== -1){
    tokens[tokens.length - 1] = op;
  }else{
    tokens.push(op);
  }

  return commit();
}

/* ================= PERCENT ================= */
function applyPercent(){
  if(tokens.length < 2) return false;

  let last = tokens[tokens.length - 1];
  let op   = tokens[tokens.length - 2];
  if(isNaN(last)) return false;

  let B = Number(last);
  let base = null;

  if(percentBase !== null){
    base = percentBase;
  }else if(tokens.length >= 3 && !isNaN(tokens[tokens.length - 3])){
    base = Number(tokens[tokens.length - 3]);
  }

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

  return commit();
}

/* ================= EVAL ================= */
function evaluate(){
  let exp = "";
  for(let i=0;i<tokens.length;i++){
    let t = tokens[i];
    exp += (typeof t === "object" ? t.value : t) + " ";
  }
  exp = exp.replace(/×/g,"*").replace(/÷/g,"/");
  return clean(Function("return " + exp)());
}

/* ================= ENTER ================= */
function enter(){
  if(tokens.length === 0) return false;

  let result;
  try{
    result = evaluate();
  }catch{
    return false;
  }

  let row = document.createElement("div");
  row.className = "h-row";
  row.dataset.value = result;

  row.innerHTML =
    '<span class="h-exp">' +
    tokens.map(formatToken).join(" ") +
    ' =</span>' +
    '<span class="h-res">' + formatIN(result) + '</span>';

  if(result < 0){
    row.querySelector(".h-res").classList.add("negative");
  }

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
  if(tokens.length === 0) return false;

  let last = tokens[tokens.length - 1];

  if(typeof last === "object" || OPS.indexOf(last) !== -1){
    tokens.pop();
    return commit();
  }

  if(last.length > 1){
    tokens[tokens.length - 1] = last.slice(0,-1);
  }else{
    tokens.pop();
  }

  return commit();
}

/* ================= CLEAR ================= */
function clearAll(){
  if(tokens.length === 0 && historyEl.children.length === 0) return false;
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

  cutTimer = setTimeout(function(){
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

  row.addEventListener("pointerdown", function(e){
    sx = e.clientX;
    drag = true;
    row.classList.add("swiping");
    row.style.transition = "none";
  });

  row.addEventListener("pointermove", function(e){
    if(!drag) return;
    dx = e.clientX - sx;
    if(dx < 0) row.style.transform = "translateX(" + dx + "px)";
  });

  row.addEventListener("pointerup", function(){
    drag = false;
    row.style.transition = "transform .25s ease";

    if(Math.abs(dx) > row.offsetWidth * 0.35){
      row.style.transform = "translateX(-100%)";
      setTimeout(function(){
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

  row.addEventListener("pointercancel", function(){
    drag = false;
    row.style.transform = "translateX(0)";
    row.classList.remove("swiping");
  });
}

/* ================= INIT ================= */
updateLive();
recalcTotal(); 
