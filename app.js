let historyEl = document.getElementById("history");
let liveEl    = document.getElementById("live");
let totalEl   = document.getElementById("total");

let tokens = [];
let percentBase = null;

/* ================= TAP ================= */
function tap(fn){
  let ok = fn();
  if(ok && navigator.vibrate) navigator.vibrate(15);
}

/* ================= HELPERS ================= */
function clean(n){
  return Number(Number(n).toPrecision(14));
}

function scrollHistoryToBottom(){
  requestAnimationFrame(()=>{
    historyEl.scrollTop = historyEl.scrollHeight;
  });
}

/* ================= GRAND TOTAL ================= */
function recalculateGrandTotal(){
  let sum = 0;
  document.querySelectorAll(".h-row").forEach(r=>{
    let v = Number(r.dataset.value);
    if(!isNaN(v)) sum += v;
  });

  sum = clean(sum);
  totalEl.innerText = formatIN(sum.toString());
  totalEl.classList.toggle("negative", sum < 0);
}

/* ================= FORMAT ================= */
function formatIN(str){
  if(str === "" || str === "-") return str;

  if(/e/i.test(str)) return Number(str).toString();

  let [i,d] = str.split(".");
  i = i.replace(/\D/g,"");

  let last3 = i.slice(-3);
  let rest  = i.slice(0,-3);
  if(rest) rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g,",");

  return (rest ? rest + "," : "") + last3 + (d ? "." + d : "");
}

/* ================= TOKEN DISPLAY ================= */
function formatTokenForDisplay(t){
  if(typeof t === "object"){
    return t.text.replace("%"," %");
  }
  if(/^-\d/.test(t)) return "- " + formatIN(t.slice(1));
  if(/^\d/.test(t)) return formatIN(t);
  return t;
}

/* ================= LIVE ================= */
function updateLive(){
  let txt = tokens.map(formatTokenForDisplay).join(" ");
  liveEl.innerHTML = txt
    ? `${txt}<span class="caret"></span>`
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

  tokens[tokens.length-1] += d;
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
    ? tokens[tokens.length-1] = op
    : tokens.push(op);

  updateLive(); return true;
}

/* ================= PERCENT ================= */
function applyPercent(){
  // 🔥 GRAND TOTAL MODE
  if(tokens.length === 2 && tokens[0] === "-" && !isNaN(tokens[1])){
    let gt = Number(totalEl.innerText.replace(/,/g,""));
    if(isNaN(gt)) return false;

    tokens.push({
      text: tokens[1] + "%",
      value: gt * Number(tokens[1]) / 100
    });
    tokens.push(gt.toString());
    updateLive();
    return true;
  }

  if(tokens.length < 2) return false;

  let last = tokens.at(-1);
  let op   = tokens.at(-2);
  if(isNaN(last)) return false;

  let B = Number(last);
  let base =
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

  tokens[tokens.length-1] = {
    text: B + "%",
    value
  };

  updateLive();
  return true;
}

/* ================= EVALUATE ================= */
function evaluate(){
  let exp = tokens.map(t =>
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
  if(!tokens.length) return false;

  let last = tokens.at(-1);
  if(typeof last === "object" || ["+","-","×","÷"].includes(last)){
    tokens.pop();
  }else if(last.length > 1){
    tokens[tokens.length-1] = last.slice(0,-1);
  }else{
    tokens.pop();
  }

  updateLive(); return true;
}

/* ================= CLEAR ================= */
function clearAll(){
  if(!tokens.length && !historyEl.children.length) return false;
  tokens = [];
  percentBase = null;
  historyEl.innerHTML = "";
  updateLive();
  recalculateGrandTotal();
  return true;
}

/* ================= LONG PRESS BACK ================= */
let cutTimer=null, cutLong=false;

function cutPressStart(e){
  e.preventDefault();
  cutLong=false;
  cutTimer=setTimeout(()=>{
    tokens=[]; percentBase=null;
    updateLive();
    navigator.vibrate?.(25);
    cutLong=true;
  },450);
}
function cutPressEnd(e){
  e.preventDefault();
  clearTimeout(cutTimer);
  if(!cutLong && back()) navigator.vibrate?.(15);
}
function cutPressCancel(){ clearTimeout(cutTimer); }

/* ================= SWIPE DELETE ================= */
function enableSwipe(row){
  let sx=0, dx=0, drag=false;

  row.addEventListener("pointerdown",e=>{
    sx=e.clientX; drag=true;
    row.classList.add("swiping");
    row.style.transition="none";
  });

  row.addEventListener("pointermove",e=>{
    if(!drag) return;
    dx=e.clientX-sx;
    if(dx<0) row.style.transform=`translateX(${dx}px)`;
  });

  row.addEventListener("pointerup",()=>{
    drag=false;
    row.style.transition="transform .25s ease";
    if(Math.abs(dx)>row.offsetWidth*0.35){
      row.style.transform="translateX(-100%)";
      navigator.vibrate?.(20);
      setTimeout(()=>{
        row.remove();
        recalculateGrandTotal();
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
