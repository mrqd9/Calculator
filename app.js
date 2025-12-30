let historyEl = document.getElementById("history");
let liveEl = document.getElementById("live");
let totalEl = document.getElementById("total");

let tokens = [];
let grandTotal = 0;

/* TAP */
function tap(fn){
  let ok = fn();
  if(ok && navigator.vibrate) navigator.vibrate(15);
}

/* HELPERS */
function clean(n){
  return Number(parseFloat(n).toFixed(10));
}
function scrollHistoryToBottom(){
  requestAnimationFrame(()=>historyEl.scrollTop = historyEl.scrollHeight);
}

/* FORMAT */
function formatIN(str){
  if(str===""||str==="-") return str;
  let parts = str.split(".");
  let i = parts[0].replace(/\D/g,"");
  let d = parts[1];

  let last3=i.slice(-3), rest=i.slice(0,-3);
  if(rest) rest=rest.replace(/\B(?=(\d{2})+(?!\d))/g,",");
  let out=(rest?rest+",":"")+last3;

  if(d !== undefined){
    return out + "." + d;   // 🔥 keeps 0.
  }
  return out;
}

/* LIVE */
function updateLive(){
  let text = tokens.map(t=>/^\d|\-/.test(t)?formatIN(t):t).join(" ");
  liveEl.innerHTML = text
    ? `${text}<span class="caret"></span>`
    : `<span class="caret"></span>`;
}

/* DIGIT */
function digit(d){
  let last = tokens[tokens.length-1];

  if(tokens.length===0){
    tokens.push(d==="." ? "0." : d);
    updateLive(); return true;
  }

  if(last==="-" && tokens.length===1){
    tokens[0] = d==="." ? "-0." : "-"+d;
    updateLive(); return true;
  }

  if(["+","-","×","÷"].includes(last)){
    tokens.push(d==="." ? "0." : d);
    updateLive(); return true;
  }

  if(d==="." && last.includes(".")) return false;

  let pure = last.replace("-","").replace(".","");
  if(d!=="." && pure.length>=12) return false;

  tokens[tokens.length-1]+=d;
  updateLive();
  return true;
}

/* OPERATOR */
function setOp(op){
  if(tokens.length===0){
    if(op==="-"){tokens.push("-");updateLive();return true;}
    return false;
  }
  let last=tokens[tokens.length-1];
  if(["+","-","×","÷"].includes(last)){
    tokens[tokens.length-1]=op;
  }else{
    tokens.push(op);
  }
  updateLive();
  return true;
}

/* EVALUATE */
function evaluate(){
  let exp=tokens.join(" ")
    .replace(/×/g,"*")
    .replace(/÷/g,"/");
  return clean(Function("return "+exp)());
}

/* ENTER */
function enter(){
  if(tokens.length===0) return false;
  let r;
  try{r=evaluate();}catch{return false;}

  let row=document.createElement("div");
  row.className="h-row";
  row.innerHTML=`
    <span class="h-exp">${tokens.join(" ")} =</span>
    <span class="h-res">${formatIN(r.toString())}</span>
  `;
  if(r<0) row.querySelector(".h-res").classList.add("negative");
  historyEl.appendChild(row);

  grandTotal=clean(grandTotal+r);
  totalEl.innerText=formatIN(grandTotal.toString());
  if(grandTotal<0) totalEl.classList.add("negative");
  else totalEl.classList.remove("negative");

  tokens=[];
  updateLive();
  scrollHistoryToBottom();
  return true;
}

/* BACKSPACE */
function back(){
  if(tokens.length === 0) return false;

  let last = tokens[tokens.length - 1];
  if(last.length > 1){
    tokens[tokens.length - 1] = last.slice(0, -1);
  }else{
    tokens.pop();
  }
  updateLive();
  return true;
}

/* CLEAR */
function clearAll(){
  tokens=[];
  grandTotal=0;
  historyEl.innerHTML="";
  totalEl.innerText="0";
  totalEl.classList.remove("negative");
  updateLive();
  return true;
}

/* INIT */
updateLive();
