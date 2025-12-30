let historyEl = document.getElementById("history");
let liveEl = document.getElementById("live");
let totalEl = document.getElementById("total");

let tokens = [];
let grandTotal = 0;

/* ================= TAP ================= */
function tap(fn){
  let ok = fn();
  if(ok && navigator.vibrate) navigator.vibrate(15);
}

/* ================= HELPERS ================= */
function clean(n){
  return Number(parseFloat(n).toFixed(10));
}

function scrollHistoryToBottom(){
  requestAnimationFrame(()=>{
    historyEl.scrollTop = historyEl.scrollHeight;
  });
}

/* ================= NUMBER FORMAT ================= */
function formatIN(str){
  if(str==="" || str==="-") return str;

  let parts = str.split(".");
  let i = parts[0].replace(/\D/g,"");
  let d = parts[1];

  let last3 = i.slice(-3);
  let rest  = i.slice(0,-3);
  if(rest) rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g,",");

  let out = (rest ? rest + "," : "") + last3;
  if(d !== undefined) return out + "." + d;
  return out;
}

/* ================= TOKEN DISPLAY FORMAT ================= */
function formatTokenForDisplay(t){
  if(/^-\d/.test(t)){
    return "- " + formatIN(t.slice(1));
  }
  if(/^\d/.test(t)){
    return formatIN(t);
  }
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
  let last = tokens[tokens.length - 1];

  if(tokens.length === 0){
    tokens.push(d === "." ? "0." : d);
    updateLive();
    return true;
  }

  if(last === "-" && tokens.length === 1){
    tokens[0] = (d === ".") ? "-0." : "-" + d;
    updateLive();
    return true;
  }

  if(["+","-","×","÷"].includes(last)){
    tokens.push(d === "." ? "0." : d);
    updateLive();
    return true;
  }

  if(d === "." && last.includes(".")) return false;

  let pure = last.replace("-","").replace(".","");
  if(d !== "." && pure.length >= 12) return false;

  tokens[tokens.length - 1] += d;
  updateLive();
  return true;
}

/* ================= OPERATOR (FIXED) ================= */
function setOp(op){
  // No operator allowed at start except unary minus
  if(tokens.length === 0){
    if(op === "-"){
      tokens.push("-");
      updateLive();
      return true;
    }
    return false;
  }

  let last = tokens[tokens.length - 1];

  // ❌ Do NOT replace starting unary minus
  if(last === "-" && tokens.length === 1){
    return false;
  }

  // Replace only binary operators
  if(["+","-","×","÷"].includes(last)){
    tokens[tokens.length - 1] = op;
  }else{
    tokens.push(op);
  }

  updateLive();
  return true;
}

/* ================= EVALUATE ================= */
function evaluate(){
  let exp = tokens.join(" ")
    .replace(/×/g,"*")
    .replace(/÷/g,"/");
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

  row.innerHTML = `
    <span class="h-exp">${tokens.map(formatTokenForDisplay).join(" ")} =</span>
    <span class="h-res">${formatIN(result.toString())}</span>
  `;

  if(result < 0){
    row.querySelector(".h-res").classList.add("negative");
  }

  enableSwipe(row);
  historyEl.appendChild(row);

  grandTotal = clean(grandTotal + result);
  totalEl.innerText = formatIN(grandTotal.toString());
  if(grandTotal < 0) totalEl.classList.add("negative");
  else totalEl.classList.remove("negative");

  tokens = [];
  updateLive();
  scrollHistoryToBottom();
  return true;
}

/* ================= BACKSPACE ================= */
function back(){
  if(tokens.length === 0) return false;

  let last = tokens[tokens.length - 1];

  if(["+","-","×","÷"].includes(last)){
    tokens.pop();
  }else if(last.length > 1){
    tokens[tokens.length - 1] = last.slice(0,-1);
  }else{
    tokens.pop();
  }

  updateLive();
  return true;
}

/* ================= CLEAR ALL ================= */
function clearAll(){
  if(tokens.length === 0 && historyEl.innerHTML === "") return false;

  tokens = [];
  grandTotal = 0;
  historyEl.innerHTML = "";
  totalEl.innerText = "0";
  totalEl.classList.remove("negative");
  updateLive();
  return true;
}

/* ================= LONG PRESS BACKSPACE ================= */
let cutTimer = null;
let cutLongPress = false;

function cutPressStart(e){
  e.preventDefault();
  cutLongPress = false;

  cutTimer = setTimeout(()=>{
    if(tokens.length > 0){
      tokens = [];
      updateLive();
      if(navigator.vibrate) navigator.vibrate(25);
    }
    cutLongPress = true;
  }, 450);
}

function cutPressEnd(e){
  e.preventDefault();
  clearTimeout(cutTimer);

  if(!cutLongPress){
    let ok = back();
    if(ok && navigator.vibrate) navigator.vibrate(15);
  }
}

function cutPressCancel(){
  clearTimeout(cutTimer);
}

/* ================= SWIPE TO DELETE ================= */
function enableSwipe(row){
  let startX = 0;
  let dx = 0;
  let dragging = false;

  row.addEventListener("pointerdown", e=>{
    startX = e.clientX;
    dragging = true;
    row.classList.add("swiping");
    row.style.transition = "none";
  });

  row.addEventListener("pointermove", e=>{
    if(!dragging) return;
    dx = e.clientX - startX;
    if(dx < 0){
      row.style.transform = `translateX(${dx}px)`;
    }
  });

  row.addEventListener("pointerup", ()=>{
    dragging = false;
    row.style.transition = "transform .25s ease";

    if(Math.abs(dx) > row.offsetWidth * 0.35){
      let val = Number(row.dataset.value);
      if(!isNaN(val)){
        grandTotal = clean(grandTotal - val);
        totalEl.innerText = formatIN(grandTotal.toString());
        if(grandTotal < 0) totalEl.classList.add("negative");
        else totalEl.classList.remove("negative");
      }
      row.style.transform = "translateX(-100%)";
      if(navigator.vibrate) navigator.vibrate(20);
      setTimeout(()=>row.remove(),200);
    }else{
      row.style.transform = "translateX(0)";
      row.classList.remove("swiping");
    }
    dx = 0;
  });

  row.addEventListener("pointercancel", ()=>{
    dragging = false;
    row.style.transform = "translateX(0)";
    row.classList.remove("swiping");
  });
}

/* INIT */
updateLive();
