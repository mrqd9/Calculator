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
  return Number(parseFloat(n).toFixed(10));
}

function normalizeNumber(n){
  if (!isFinite(n)) return "0";
  let s = n.toString();
  if (!s.includes("e")) return s;
  return n.toFixed(12).replace(/\.?0+$/, "");
}

function getGrandTotalValue(){
  let sum = 0;
  document.querySelectorAll(".h-row").forEach(row=>{
    let v = Number(row.dataset.value);
    if(!isNaN(v)) sum += v;
  });
  return clean(sum);
}

function scrollHistoryToBottom(){
  requestAnimationFrame(()=>{
    historyEl.scrollTop = historyEl.scrollHeight;
  });
}

/* ================= FORMAT ================= */
function formatIN(str){
  if(str==="" || str==="-") return str;
  let parts = str.split(".");
  let i = parts[0].replace(/\D/g,"");
  let d = parts[1];
  let last3 = i.slice(-3);
  let rest  = i.slice(0,-3);
  if(rest) rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g,",");
  return (rest ? rest + "," : "") + last3 + (d!==undefined?"."+d:"");
}

function formatTokenForDisplay(t){
  if(typeof t === "object"){
    return t.gray
      ? `<span style="opacity:.5">${t.text}</span>`
      : t.text.replace("%"," %");
  }
  if(typeof t === "string" && t.endsWith(".")) return t;
  if(/^-\d/.test(t)) return "- " + formatIN(t.slice(1));
  if(/^\d/.test(t)) return formatIN(t);
  return t;
}

/* ================= LIVE ================= */
function updateLive(){
  let html = tokens.map(formatTokenForDisplay).join(" ");
  liveEl.innerHTML = html
    ? `${html}<span class="caret"></span>`
    : `<span class="caret"></span>`;
}

/* ================= DIGIT ================= */
function digit(d){
  let last = tokens[tokens.length-1];

  if(tokens.length===0){
    tokens.push(d==="."?"0.":d);
    updateLive(); return true;
  }

  if(last==="-" && tokens.length===1){
    tokens[0]=d==="."?"-0.":"-"+d;
    updateLive(); return true;
  }

  if(["+","-","×","÷"].includes(last)){
    tokens.push(d==="."?"0.":d);
    updateLive(); return true;
  }

  if(typeof last==="object") return false;
  if(d==="." && last.includes(".")) return false;

  let pure = last.replace("-","").replace(".","");
  if(d!=="." && pure.length>=12) return false;

  tokens[tokens.length-1]+=d;
  updateLive(); return true;
}

/* ================= OPERATOR ================= */
function setOp(op){
  if(tokens.length===0){
    if(op==="-"){ tokens.push("-"); updateLive(); return true; }
    return false;
  }
  let last=tokens[tokens.length-1];
  if(last==="-" && tokens.length===1) return false;

  if(["+","-","×","÷"].includes(last)){
    tokens[tokens.length-1]=op;
  }else{
    tokens.push(op);
  }
  updateLive(); return true;
}

/* ================= PERCENT ================= */
function applyPercent(){
  /* 🔥 GRAND TOTAL DISCOUNT MODE */
  if(tokens.length===2 && tokens[0]==="-" && !isNaN(tokens[1])){
    let base = getGrandTotalValue();
    let B = Number(tokens[1]);
    let value = clean(base * B / 100);

    tokens = [
      "-",
      { text: B+" %", value: value },
      { text: normalizeNumber(base), value: base, gray:true }
    ];
    updateLive();
    return true;
  }

  /* NORMAL PERCENT */
  if(tokens.length<2) return false;
  let last=tokens[tokens.length-1];
  let op=tokens[tokens.length-2];
  if(isNaN(last)) return false;

  let base =
    percentBase ??
    (tokens.length>=3 && !isNaN(tokens[tokens.length-3])
      ? Number(tokens[tokens.length-3])
      : null);

  if(base===null) return false;

  let B=Number(last), value;
  if(op==="+"||op==="-"){
    value=base*B/100;
    percentBase=base+(op==="+"?value:-value);
  }else{
    value=B/100;
    percentBase=base;
  }

  tokens[tokens.length-1]={text:B+"%",value:value};
  updateLive(); return true;
}

/* ================= EVALUATE ================= */
function evaluate(){
  let exp=tokens.map(t=>typeof t==="object"?t.value:t)
    .join(" ").replace(/×/g,"*").replace(/÷/g,"/");
  return clean(Function("return "+exp)());
}

/* ================= ENTER ================= */
function enter(){
  if(tokens.length===0) return false;

  let result;
  try{ result=evaluate(); }catch{ return false; }

  let row=document.createElement("div");
  row.className="h-row";
  row.dataset.value=result;

  row.innerHTML=`
    <span class="h-exp">${tokens.map(t=>{
      if(typeof t==="object") return t.text;
      return t;
    }).join(" ")} =</span>
    <span class="h-res">${formatIN(normalizeNumber(result))}</span>
  `;

  if(result<0) row.querySelector(".h-res").classList.add("negative");
  enableSwipe(row);
  historyEl.appendChild(row);

  tokens=[];
  percentBase=null;
  updateLive();
  recalculateGrandTotal();
  scrollHistoryToBottom();
  return true;
}

/* ================= TOTAL ================= */
function recalculateGrandTotal(){
  let sum=0;
  document.querySelectorAll(".h-row").forEach(r=>{
    let v=Number(r.dataset.value);
    if(!isNaN(v)) sum+=v;
  });
  sum=clean(sum);
  totalEl.innerText=formatIN(normalizeNumber(sum));
  sum<0?totalEl.classList.add("negative"):totalEl.classList.remove("negative");
}

/* ================= BACKSPACE ================= */
function back(){
  if(!tokens.length) return false;
  tokens.pop();
  updateLive(); return true;
}

/* ================= CLEAR ================= */
function clearAll(){
  if(!tokens.length && !historyEl.innerHTML) return false;
  tokens=[];
  percentBase=null;
  historyEl.innerHTML="";
  updateLive();
  recalculateGrandTotal();
  return true;
}

/* ================= SWIPE ================= */
function enableSwipe(row){
  let sx=0,dx=0,drag=false;
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
