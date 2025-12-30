let historyEl = document.getElementById("history");
let liveEl = document.getElementById("live");
let totalEl = document.getElementById("total");

let expr = "", originalExpr = "", grandTotal = 0;

/* HAPTIC */
function tap(fn){
  let changed = fn();
  if(changed && navigator.vibrate) navigator.vibrate(15);
}

/* AUTO SCROLL */
function scrollHistoryToBottom(){
  requestAnimationFrame(()=>{
    historyEl.scrollTop = historyEl.scrollHeight;
  });
}

/* CLEAN FLOAT */
function clean(n){
  return Number(parseFloat(n).toFixed(10));
}

/* FORMAT (INDIAN) */
function formatIN(str){
  if(str===""||str==="-") return str;
  str=str.toString();
  let [i,d]=str.split(".");
  i=i.replace(/\D/g,"");
  let last3=i.slice(-3), rest=i.slice(0,-3);
  if(rest){
    rest=rest.replace(/\B(?=(\d{2})+(?!\d))/g,",");
    i=rest+","+last3;
  }else i=last3;
  return d?i+"."+d:i;
}

/* SCIENTIFIC */
function formatScientific(str){
  str=str.replace(/\D/g,"");
  if(!str) return "0";
  let exp=str.length-1;
  let m=str[0];
  if(str.length>1) m+="."+str.slice(1,3);
  return `${m}E${exp}`;
}

/* FIT CHECK */
function fits(el,text){
  let s=document.createElement("span");
  s.style.visibility="hidden";
  s.style.whiteSpace="nowrap";
  s.style.font=getComputedStyle(el).font;
  s.innerText=text;
  document.body.appendChild(s);
  let ok=s.offsetWidth<=el.clientWidth;
  document.body.removeChild(s);
  return ok;
}

/* ADAPTIVE FORMAT */
function formatAdaptive(val,el){
  let s=val.toString();
  let n=formatIN(s);
  return fits(el,n)?n:formatScientific(s);
}

/* LIVE WITH CARET */
function updateLive(){
  let text = expr.split(" ")
    .map(p=>/[0-9]/.test(p)?formatIN(p):p)
    .join(" ");

  liveEl.innerHTML = text
    ? `${text}<span class="caret"></span>`
    : `<span class="caret"></span>`;
}

function currentNumber(){
  return expr.split(" ").pop();
}

/* DIGIT (FINAL LOGIC incl auto 0.) */
function digit(d){
  let c = currentNumber();

  /* START NEGATIVE */
  if(expr === "-" && c === "-"){
    if(d === "."){
      expr = "-0.";
      originalExpr = "-0.";
    }else{
      expr = "-" + d;
      originalExpr = "-" + d;
    }
    updateLive();
    return true;
  }

  /* DOT PRESSED FIRST → auto 0. */
  if(d === "." && (c === "" || c === undefined)){
    expr += "0.";
    originalExpr += "0.";
    updateLive();
    return true;
  }

  /* DOT AFTER OPERATOR → auto 0. */
  if(d === "." && c === ""){
    expr += "0.";
    originalExpr += "0.";
    updateLive();
    return true;
  }

  /* DOT AFTER "-" → auto -0. */
  if(d === "." && c === "-"){
    expr += "0.";
    originalExpr += "0.";
    updateLive();
    return true;
  }

  /* PREVENT DOUBLE DOT */
  if(d === "." && c.includes(".")) return false;

  /* LENGTH LIMIT (ignore leading -) */
  let pure = c.startsWith("-") ? c.slice(1) : c;
  if(d !== "." && pure.replace(".","").length >= 12) return false;

  expr += d;
  originalExpr += d;
  updateLive();
  return true;
}

/* OPERATOR */
function setOp(op){
  if(expr===""){
    if(op==="-"){
      expr="-";
      originalExpr="-";
      updateLive();
      return true;
    }
    return false;
  }

  if(expr==="-" && op==="-") return false;

  if(expr.endsWith(" ")){
    expr = expr.slice(0,-3)+" "+op+" ";
    originalExpr = originalExpr.slice(0,-3)+" "+op+" ";
  }else{
    expr += " "+op+" ";
    originalExpr += " "+op+" ";
  }
  updateLive();
  return true;
}

/* PERCENT */
function applyPercent(){
  let p = expr.trim().split(" ");
  if(p.length<3) return false;

  let A=+p[0], op=p[1], B=+p[2];
  if(isNaN(A)||isNaN(B)) return false;

  originalExpr+=" %";
  let v=(op==="+"||op==="-"||op==="−")?A*B/100:B/100;
  expr=`${A} ${op} ${v}`;
  updateLive();
  return true;
}

/* EVALUATE */
function evaluate(e){
  let ex=e.replace(/×/g,"*").replace(/÷/g,"/");
  if(/^\d+\s*\*\s*\d+$/.test(ex)){
    let[a,b]=ex.split("*").map(s=>s.trim());
    if(a.length>15||b.length>15)
      return (BigInt(a)*BigInt(b)).toString();
  }
  return clean(Function("return "+ex)());
}

/* ENTER */
function enter(){
  if(expr===""||expr==="-"||expr==="−") return false;

  let r;
  try{r=evaluate(expr);}catch{return false;}

  let row=document.createElement("div");
  row.className="h-row";
  row.dataset.value=r;
  row.innerHTML=`
    <span class="h-exp">${originalExpr} =</span>
    <span class="h-res"></span>
  `;
  historyEl.appendChild(row);

  let res=row.querySelector(".h-res");
  res.innerText=formatAdaptive(r,res);
  if(Number(r)<0) res.classList.add("negative");

  enableSwipe(row);

  grandTotal=clean(grandTotal+Number(r));
  totalEl.innerText=formatAdaptive(grandTotal.toFixed(2),totalEl);
  if(grandTotal<0) totalEl.classList.add("negative");
  else totalEl.classList.remove("negative");

  scrollHistoryToBottom();
  expr=""; originalExpr="";
  updateLive();
  return true;
}

/* DELETE ROW */
function deleteRow(row){
  let v=Number(row.dataset.value);
  if(!isNaN(v)){
    grandTotal=clean(grandTotal-v);
    totalEl.innerText=formatAdaptive(grandTotal.toFixed(2),totalEl);
    if(grandTotal<0) totalEl.classList.add("negative");
    else totalEl.classList.remove("negative");
  }
  row.remove();
  scrollHistoryToBottom();
}

/* SWIPE */
function enableSwipe(row){
  let sx=0, dx=0, drag=false;

  row.addEventListener("pointerdown",e=>{
    sx=e.clientX;
    drag=true;
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
    row.classList.remove("swiping");
    row.style.transition="transform .2s ease";

    if(Math.abs(dx)>row.offsetWidth*0.35){
      row.style.transform="translateX(-100%)";
      setTimeout(()=>deleteRow(row),200);
      if(navigator.vibrate) navigator.vibrate(20);
    }else{
      row.style.transform="translateX(0)";
    }
    dx=0;
  });

  row.addEventListener("pointercancel",()=>{
    drag=false;
    row.classList.remove("swiping");
    row.style.transform="translateX(0)";
  });
}

/* BACK */
function back(){
  if(expr==="") return false;
  expr=expr.slice(0,-1);
  originalExpr=originalExpr.slice(0,-1);
  updateLive();
  return true;
}

/* CLEAR */
function clearAll(){
  if(expr===""&&historyEl.innerHTML==="") return false;
  expr=""; originalExpr=""; grandTotal=0;
  historyEl.innerHTML="";
  updateLive();
  totalEl.innerText="0.00";
  totalEl.classList.remove("negative");
  scrollHistoryToBottom();
  return true;
}

/* INIT */
updateLive();
