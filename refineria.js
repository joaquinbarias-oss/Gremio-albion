// Calculadora de materiales (refinería) — Gremio Albion Online
(() => {
const $ = id => document.getElementById(id);
const MATS = {
  ore:  {label:"Mineral", raw:"ORE",   ref:"METALBAR",   rawN:"Mineral", refN:"Lingote",          city:"Thetford",      ench:true},
  wood: {label:"Madera",  raw:"WOOD",  ref:"PLANKS",     rawN:"Madera",  refN:"Tablón",           city:"Fort Sterling", ench:true},
  fiber:{label:"Fibra",   raw:"FIBER", ref:"CLOTH",      rawN:"Fibra",   refN:"Tela",             city:"Lymhurst",      ench:true},
  hide: {label:"Piel",    raw:"HIDE",  ref:"LEATHER",    rawN:"Piel",    refN:"Cuero",            city:"Martlock",      ench:true},
  rock: {label:"Piedra",  raw:"ROCK",  ref:"STONEBLOCK", rawN:"Piedra",  refN:"Bloque de piedra", city:"Bridgewatch",   ench:false},
};
const RAW_PER = {2:1,3:2,4:2,5:3,6:4,7:5,8:5};
const ITEM_VALUE = {2:4,3:8,4:16,5:32,6:64,7:128,8:256};      // ×2 por encantamiento
const FOCUS_EST  = {2:10,3:18,4:48,5:83,6:144,7:250,8:433};  // estimado, ×2 por encantamiento
const REGIONS = {
  royal:    {label:"Continente Royal",       cities:["Bridgewatch","Fort Sterling","Lymhurst","Martlock","Thetford"]},
  caerleon: {label:"Caerleon (zona roja)",   cities:["Caerleon"]},
  outlands: {label:"Outlands (Rests y Smugglers)", cities:["Arthurs Rest","Merlyns Rest","Morganas Rest"]},
  mists:    {label:"Brecilien (Las Brumas)", cities:["Brecilien"]},
};
const CITIES = [...Object.values(REGIONS).flatMap(r=>r.cities), "Black Market"];
const allowedCities = () => Object.entries(REGIONS).filter(([k]) => $("reg_"+k).checked).flatMap(([,r]) => r.cities);
// Los mercados de Outlands aparecen en la API como "... Smugglers Network".
const cityAllowed = city => allowedCities().includes(city) || ($("reg_outlands").checked && /Smugglers Network$|Rest$/.test(city));
const regionOf = city => /Smugglers Network$/.test(city) ? "Outlands" : (Object.values(REGIONS).find(r => r.cities.includes(city))||{}).label || city;

const S = {mat:"ore", tier:6, ench:0, start:2, mode:"target", ret:"reuse", prices:{}, dates:{}, cities:{}, retPrices:{}, sale:0, saleDate:null};
const CHEAP = "__cheapest";
const buyLabel = id => S.cities[id] ? `<span class="age">en ${esc(S.cities[id])}</span>` : "";
const fmt = (n, d=0) => isFinite(n) ? n.toLocaleString("es-CL",{maximumFractionDigits:d, minimumFractionDigits:d}) : "—";
const pct = n => fmt(n*100,1) + "%";
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

/* Encantamiento efectivo: solo aplica de T4 hacia arriba.
   T4.x = crudo T4.x + Refinado T3 ; T5.x = crudo T5.x + Refinado T4.x ; etc. */
const ee = t => (t >= 4 ? S.ench : 0);
const suf = t => ee(t) ? `_LEVEL${ee(t)}@${ee(t)}` : "";
const rawId = t => `T${t}_${MATS[S.mat].raw}${suf(t)}`;
const refId = t => `T${t}_${MATS[S.mat].ref}${suf(t)}`;
const tag = t => `T${t}` + (ee(t) ? "." + ee(t) : "");
const rawName = t => `${MATS[S.mat].rawN} ${tag(t)}`;
const refName = t => `${MATS[S.mat].refN} ${tag(t)}`;

/* ---------- persistencia local (comodidad) ---------- */
const FIELDS = ["server","place","customBonus","daily","useFocus","fce","focusPool","qty","budget","haveRaw","havePrev","fee","sellMode","premium","buyCity","sellCity","reg_royal","reg_caerleon","reg_outlands","reg_mists","maxAge"];
function save(){ try{
  const o = {S:{mat:S.mat,tier:S.tier,ench:S.ench,start:S.start,mode:S.mode,ret:S.ret,prices:S.prices,cities:S.cities,retPrices:S.retPrices,sale:S.sale}};
  FIELDS.forEach(f => { const el=$(f); o[f] = el.type==="checkbox" ? el.checked : el.value; });
  localStorage.setItem("refAlbion2", JSON.stringify(o));
}catch(_){} }
function load(){ try{
  const o = JSON.parse(localStorage.getItem("refAlbion2")||"null"); if(!o) return;
  Object.assign(S, o.S||{}); S.dates = {};
  FIELDS.forEach(f => { if(o[f]===undefined) return; const el=$(f); if(el.type==="checkbox") el.checked=o[f]; else el.value=o[f]; });
}catch(_){} }

/* ---------- UI ---------- */
function seg(el, items, cur, onPick, disabledFn){
  el.innerHTML = "";
  items.forEach(([val,label]) => {
    const b = document.createElement("button"); b.type="button"; b.textContent=label;
    b.setAttribute("aria-pressed", String(val===cur));
    if (disabledFn && disabledFn(val)) b.disabled = true;
    b.onclick = () => onPick(val); el.appendChild(b);
  });
}
function buildSegs(){
  seg($("matSeg"), Object.entries(MATS).map(([k,m])=>[k,m.label]), S.mat, v=>{S.mat=v; if(!MATS[v].ench) S.ench=0; resetDerived(); S.sale=0; refresh();});
  seg($("tierSeg"), [2,3,4,5,6,7,8].map(t=>[t,"T"+t]), S.tier, v=>{S.tier=v; if(v<4) S.ench=0; if(S.start>v) S.start=2; resetDerived(); S.sale=0; refresh();});
  seg($("enchSeg"), [0,1,2,3,4].map(e=>[e, "."+e]), S.ench, v=>{S.ench=v; resetDerived(); S.sale=0; refresh();},
      v => v>0 && (S.tier<4 || !MATS[S.mat].ench));
  if (S.start > S.tier) S.start = S.tier;
  $("start").innerHTML = Array.from({length:S.tier-1},(_,i)=>i+2).map(s =>
    `<option value="${s}">T${s} — ${s===2 ? "todo desde crudo" : "compras " + esc(refName(s-1))}</option>`).join("");
  $("start").value = S.start;
  const single = S.start === S.tier;
  [...$("modeSeg").children].forEach(b => {
    b.setAttribute("aria-pressed", String(b.dataset.mode===S.mode));
    b.disabled = b.dataset.mode==="stock" && !single;
  });
  if (S.mode==="stock" && !single) { S.mode="target"; [...$("modeSeg").children].forEach(b=>b.setAttribute("aria-pressed", String(b.dataset.mode===S.mode))); }
  [...$("retSeg").children].forEach(b => b.setAttribute("aria-pressed", String(b.dataset.ret===S.ret)));
}
function resetDerived(){
  $("itemValue").value = ITEM_VALUE[S.tier] * 2**ee(S.tier);
  $("focusBase").value = FOCUS_EST[S.tier] * 2**ee(S.tier);
}
function fillCities(){
  $("buyCity").innerHTML = `<option value="${CHEAP}">La más barata (continentes marcados)</option>` + CITIES.filter(c=>c!=="Black Market").map(c=>`<option>${c}</option>`).join("");
  $("sellCity").innerHTML = CITIES.map(c=>`<option>${c}</option>`).join("");
  $("buyCity").value = CHEAP; $("sellCity").value = "Thetford";
  $("regions").innerHTML = Object.entries(REGIONS).map(([k,r]) =>
    `<label class="check"><input type="checkbox" id="reg_${k}" checked><span>${r.label}<small>${r.cities.join(", ")}</small></span></label>`).join("");
}

/* ---------- cálculo ---------- */
function rates(){
  const place = $("place").value;
  let bonus = place==="bonus" ? 58 : place==="city" ? 18 : (+$("customBonus").value||0);
  bonus += +$("daily").value;
  const focus = $("useFocus").checked;
  if (focus) bonus += 59;
  const R = 1 - 1/(1 + bonus/100);
  return {bonus, focus, R, keep: 1-R, keepNoFocus: 1/(1 + (focus ? bonus-59 : bonus)/100)};
}
// Plan para producir N unidades del tier final, refinando desde S.start.
// sep = true: compras todo sin descontar el retorno y lo devuelto queda aparte como ganancia.
function plan(N, keep, sep){
  const R = 1 - keep, use = sep ? 1 : keep;
  const t = S.tier, s = S.start;
  const ivScale = (+$("itemValue").value||0) / (ITEM_VALUE[t]*2**ee(t));
  const fScale  = (+$("focusBase").value||0) / (FOCUS_EST[t]*2**ee(t));
  const fceMul  = Math.pow(0.5, (+$("fce").value||0)/10000);
  const feeRate = 0.1125 * (+$("fee").value||0) / 100;
  const steps = []; let need = N;
  for (let i = t; i >= s; i--) {
    const k = RAW_PER[i];
    steps.push({
      tier:i, make:need, rawId:rawId(i), rawName:rawName(i), raw:need*k*use,
      retRaw: sep ? need*k*R : 0, retPrev: sep && i>2 ? need*R : 0, prevId: i>2 ? refId(i-1) : null, prevName: i>2 ? refName(i-1) : null,
      fee: need * ITEM_VALUE[i]*2**ee(i)*ivScale * feeRate,
      focus: need * FOCUS_EST[i]*2**ee(i)*fScale*fceMul,
    });
    need = need * use;                  // refinado del tier anterior que consume este paso
  }
  const buyPrev = s > 2 ? {id:refId(s-1), name:refName(s-1), qty:need} : null;
  let cost = 0, fees = 0, focus = 0, missing = [];
  steps.forEach(st => {
    const p = S.prices[st.rawId]||0; if(!p) missing.push(st.rawName);
    st.cost = st.raw*p; cost += st.cost; fees += st.fee; focus += st.focus;
  });
  if (buyPrev) { const p = S.prices[buyPrev.id]||0; if(!p) missing.push(buyPrev.name); buyPrev.cost = buyPrev.qty*p; cost += buyPrev.cost; }
  // Retornos separados: crudo valorado a su precio de compra; refinado previo al de compra (si se compró) o al de mercado.
  const rets = new Map(); let retValue = 0; const retMissing = [];
  const addRet = (id, name, qty, price) => {
    if (qty <= 0) return; if (!price) retMissing.push(name);
    const o = rets.get(id) || {id, name, qty:0, price}; o.qty += qty; rets.set(id, o); retValue += qty*(price||0);
  };
  steps.forEach(st => {
    addRet(st.rawId, st.rawName, st.retRaw, S.prices[st.rawId]||0);
    if (st.retPrev) addRet(st.prevId, st.prevName, st.retPrev, (st.tier===s ? S.prices[st.prevId] : S.retPrices[st.prevId])||0);
  });
  return {steps, buyPrev, cost, fees, total: cost+fees, focus, missing, rets:[...rets.values()].reverse(), retValue, retMissing};
}

function calc(){
  const r = rates(), sep = S.ret === "separate";
  const unit = plan(1, r.keep, sep);
  let N;
  if (S.mode === "target") N = Math.max(0, Math.floor(+$("qty").value || 0));
  else if (S.mode === "budget") N = unit.total>0 && !unit.missing.length ? Math.floor((+$("budget").value||0) / unit.total) : 0;
  else {
    const k = RAW_PER[S.tier], raw = +$("haveRaw").value||0, prev = +$("havePrev").value||0;
    const use = sep ? 1 : r.keep;
    N = Math.floor(Math.min(raw/(k*use), S.tier>2 ? prev/use : Infinity));
  }
  const P = plan(N, r.keep, sep);
  const tax = $("premium").checked ? 0.04 : 0.08;
  const setup = $("sellMode").value==="order" ? 0.025 : 0;
  const netF = 1-tax-setup;
  const netSale = S.sale*netF;
  const retNetUnit = unit.retValue*netF;
  const profitUnit = netSale + retNetUnit - unit.total;
  const focusUnit = r.focus ? unit.focus : 0;
  const maxByFocus = unit.focus>0 ? Math.floor((+$("focusPool").value||0)/unit.focus) : Infinity;
  let focusValue = 0;
  if (r.focus && unit.focus>0) { const nf = plan(1, r.keepNoFocus, sep);
    focusValue = ((nf.total - nf.retValue*netF) - (unit.total - retNetUnit)) / unit.focus; }
  return {r, sep, unit, N, P, tax, setup, netF, netSale, retNetUnit, profitUnit, focusUnit, maxByFocus, focusValue};
}

function render(){
  const c = calc(), t = S.tier, single = S.start === t;
  const k = RAW_PER[t];
  $("recipe").textContent = `1 × ${refName(t)} = ${k} × ${rawName(t)}` + (t>2 ? ` + 1 × ${refName(t-1)}` : "")
    + (single ? "" : `  ·  cadena T${S.start} → ${tag(t)}`);
  $("customWrap").hidden = $("place").value !== "custom";
  $("rrrHint").innerHTML = `Bono total: <b>${fmt(c.r.bonus)}%</b> → retorno <b>${pct(c.r.R)}</b> en cada paso. Bono del material en ${MATS[S.mat].city}.`;
  $("focusPanel").style.opacity = c.r.focus ? 1 : .6;
  $("targetWrap").hidden = S.mode!=="target"; $("budgetWrap").hidden = S.mode!=="budget"; $("stockWrap").hidden = S.mode!=="stock";

  const titles = {target:`Para ${fmt(c.N)} × ${refName(t)}`, budget:`Con tu plata: ${fmt(c.N)} × ${refName(t)}`, stock:`Puedes fabricar ${fmt(c.N)} × ${refName(t)}`};
  $("resTitle").textContent = titles[S.mode];
  const hasCost = !c.unit.missing.length, hasSale = S.sale>0;
  const prof = c.profitUnit*c.N;
  const stats = [
    ["Tasa de retorno", pct(c.r.R), "", "hero"],
    ["Refinados finales", fmt(c.N), S.mode==="budget" && !hasCost ? "faltan precios" : "", ""],
    ["Inversión", hasCost ? fmt(c.P.total) : "—", hasCost ? `${fmt(c.unit.total,1)} c/u` : "faltan precios", ""],
    ["Ganancia total", hasCost&&hasSale ? `<span class="${prof>=0?"pos":"neg"}">${fmt(prof)}</span>` : "—", hasCost&&hasSale ? (c.sep ? `venta ${fmt(c.N*c.netSale)} + retorno ${fmt(c.N*c.retNetUnit)}` : `venta ${fmt(c.N*c.netSale)}`) : "faltan precios", ""],
  ];
  $("stats").innerHTML = stats.map(([k,v,s,cl])=>`<div class="stat ${cl}"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join("");

  // 1 · Lista de compras agrupada por ciudad
  const steps = [...c.P.steps].reverse();          // del tier más bajo al final
  const buys = [];
  if (c.P.buyPrev) buys.push({id:c.P.buyPrev.id, name:c.P.buyPrev.name, qty:Math.ceil(c.P.buyPrev.qty)});
  steps.forEach(st => buys.push({id:st.rawId, name:st.rawName, qty:Math.ceil(st.raw)}));
  const fixedCity = $("buyCity").value !== CHEAP ? $("buyCity").value : null;
  const groups = new Map();
  buys.forEach(b => {
    b.price = S.prices[b.id]||0; b.sub = b.qty*b.price;
    const city = S.cities[b.id] || fixedCity || "Precio escrito a mano";
    if (!groups.has(city)) groups.set(city, []);
    groups.get(city).push(b);
  });
  $("shopList").innerHTML = [...groups].map(([city, list]) => {
    const sum = list.reduce((a,b)=>a+b.sub,0);
    return `<div class="city"><h3>${esc(city)}<span>${list.every(b=>b.price)?fmt(sum)+" plata":""}</span></h3><div class="tablewrap"><table>
      <thead><tr><th>Compra</th><th class="n">Cantidad</th><th class="n">Precio c/u</th><th class="n">Subtotal</th></tr></thead><tbody>`
      + list.map(b => `<tr><td>${esc(b.name)}<br><code>${b.id}</code></td><td class="n qty">${fmt(b.qty)}</td><td class="n">${b.price?fmt(b.price):'<span class="neg">sin precio</span>'}</td><td class="n">${b.price?fmt(b.sub):"—"}</td></tr>`).join("")
      + `</tbody></table></div></div>`;
  }).join("");
  const matCost = buys.reduce((a,b)=>a+b.sub,0), spend = matCost + c.P.fees;
  let sm = `<div><span>Costo de materiales</span><span>${hasCost?fmt(matCost):"faltan precios"}</span></div>
    <div><span>Costo de refinación (tasas de estación)</span><span>${fmt(c.P.fees)}</span></div>
    <div class="big"><span>Total a gastar (materiales + refinación)</span><span>${hasCost?fmt(spend):"—"}</span></div>`;
  if (S.mode==="budget") { const B = +$("budget").value||0;
    sm += `<div><span>Tu plata</span><span>${fmt(B)}</span></div><div><span>Te sobra</span><span>${hasCost?fmt(B-spend):"—"}</span></div>`; }
  $("shopSummary").innerHTML = sm;
  if (hasCost) $("stats").children[2].querySelector(".v").textContent = fmt(spend);
  S.shopText = [...groups].map(([city,list]) => city + ":\n" + list.map(b => `  ${fmt(b.qty)} × ${b.name}${b.price?` a ${fmt(b.price)} = ${fmt(b.sub)}`:""}`).join("\n")).join("\n")
    + `\nTotal a gastar: ${hasCost?fmt(spend):"—"} (materiales ${hasCost?fmt(matCost):"—"} + refinación ${fmt(c.P.fees)})`;

  // 2 · Pasos de refinado
  const use = c.sep ? 1 : c.r.keep;
  $("stepsList").innerHTML = steps.map((st, i) => {
    const prev = st.tier > 2 ? (i===0 ? `${fmt(Math.ceil(st.make*use))} ${esc(refName(st.tier-1))} <i>(comprado)</i>` : `${fmt(Math.ceil(st.make*use))} ${esc(refName(st.tier-1))} <i>(del paso ${i})</i>`) : "";
    const back = c.sep ? `<div class="in">Te devuelve ~<b>${fmt(Math.floor(st.retRaw))}</b> ${esc(st.rawName)}${st.retPrev ? ` + <b>${fmt(Math.floor(st.retPrev))}</b> ${esc(st.prevName)}` : ""} <i>(aparte, tu ganancia)</i></div>` : "";
    return `<li><div><div class="out">Refina ${fmt(Math.ceil(st.make))} × ${esc(refName(st.tier))}</div>
      <div class="in">Usas <b>${fmt(Math.ceil(st.raw))}</b> ${esc(st.rawName)} <i>(comprado)</i>${prev ? ` + <b>${prev.split(" ")[0]}</b> ${prev.slice(prev.indexOf(" ")+1)}` : ""}</div>${back}
      <div class="meta">Costo de refinación ${fmt(st.fee)} plata${c.r.focus ? ` · Foco ${fmt(st.focus)}` : ""}</div></div></li>`;
  }).join("");
  let h = c.sep
    ? "Compras el total sin descontar el retorno. Lo que te devuelve la estación no se vuelve a usar: lo guardas aparte (ver punto 3). Lo que refinas en un paso lo usas en el siguiente."
    : "Las cantidades ya descuentan el retorno: con lo que compras y lo que te devuelve la estación en cada paso alcanzas para todo (promedio esperado). Lo que refinas en un paso lo usas en el siguiente.";
  $("retHint").textContent = c.sep
    ? "Compras todo completo y lo que devuelve la estación queda aparte para vender: se suma a tu ganancia."
    : "Lo que devuelve la estación se usa en los pasos siguientes, así compras menos.";

  // 3 · Retorno separado
  $("retPanel").hidden = !c.sep;
  if (c.sep) {
    $("retList").innerHTML = `<div class="tablewrap"><table class="rett"><thead><tr><th>Te devuelve</th><th class="n">Cantidad</th><th class="n">Valor c/u</th><th class="n">Subtotal</th></tr></thead><tbody>`
      + c.P.rets.map(x => `<tr><td>${esc(x.name)}<br><code>${x.id}</code></td><td class="n qty">${fmt(Math.floor(x.qty))}</td><td class="n">${x.price?fmt(x.price):'<span class="neg">sin precio</span>'}</td><td class="n">${x.price?fmt(Math.floor(x.qty)*x.price):"—"}</td></tr>`).join("")
      + `</tbody></table></div>`;
    const gross = c.P.rets.reduce((a,x)=>a+Math.floor(x.qty)*(x.price||0),0);
    $("retSummary").innerHTML = `<div><span>Valor de mercado del retorno</span><span>${c.P.retMissing.length?"faltan precios":fmt(gross)}</span></div>
      <div><span>Impuestos al venderlo (${pct(c.tax+c.setup)})</span><span>−${fmt(gross*(c.tax+c.setup))}</span></div>
      <div class="big"><span>Ganancia por retorno</span><span class="pos">${c.P.retMissing.length?"—":fmt(gross*c.netF)}</span></div>`;
  }
  if (c.r.focus && isFinite(c.maxByFocus)) h += ` Con tu foco disponible alcanzas para ~${fmt(c.maxByFocus)} refinados finales.`;
  if (c.r.focus && c.P.focus > (+$("focusPool").value||0)) h += " Ojo: este plan necesita más foco del que tienes.";
  $("planHint").textContent = h;

  // Precios (no redibujar mientras se escribe en uno)
  const a = document.activeElement;
  if (!(a && a.dataset && a.dataset.p)) {
    const items = [];
    if (c.P.buyPrev) items.push([c.P.buyPrev.id, c.P.buyPrev.name]);
    [...c.P.steps].reverse().forEach(st => items.push([st.rawId, st.rawName]));
    const retItems = c.sep ? [...c.P.steps].reverse().filter(st => st.tier > S.start).map(st => [st.prevId, st.prevName]) : [];
    const ageTag = d => { if(!d) return ""; const hrs=(Date.now()-Date.parse(d+"Z"))/36e5; return `<span class="age ${hrs>24?"old":""}">${hrs<1?"hace <1 h":"hace "+fmt(hrs)+" h"}</span>`; };
    $("priceBody").innerHTML = items.map(([id,nm]) =>
      `<tr><td>${esc(nm)} <span class="hint">(compra)</span><br><code>${id}</code></td><td class="n"><input type="number" min="0" step="1" data-p="${id}" id="p_${id.replace(/@/,"_")}" value="${S.prices[id]||""}" placeholder="0" aria-label="Precio ${esc(nm)}">${buyLabel(id)}${ageTag(S.dates[id])}</td></tr>`).join("")
      + `<tr><td>${esc(refName(t))} <span class="hint">(venta)</span><br><code>${refId(t)}</code></td><td class="n"><input type="number" min="0" step="1" data-p="__sale" id="p_sale" value="${S.sale||""}" placeholder="0" aria-label="Precio de venta">${ageTag(S.saleDate)}</td></tr>`
      + retItems.map(([id,nm]) => `<tr><td>${esc(nm)} <span class="hint">(valor del retorno)</span><br><code>${id}</code></td><td class="n"><input type="number" min="0" step="1" data-p="ret:${id}" id="pr_${id.replace(/@/,"_")}" value="${S.retPrices[id]||""}" placeholder="0" aria-label="Valor ${esc(nm)}"></td></tr>`).join("");
  }

  // Rentabilidad por unidad final
  const L = [];
  if (c.unit.buyPrev) L.push([`${esc(c.unit.buyPrev.name)} comprado`, `${fmt(c.unit.buyPrev.qty,3)} × ${fmt(S.prices[c.unit.buyPrev.id]||0)}`, c.unit.buyPrev.cost]);
  [...c.unit.steps].reverse().forEach(st => L.push([esc(st.rawName), `${fmt(st.raw,3)} × ${fmt(S.prices[st.rawId]||0)}`, st.cost]));
  L.push(["Tasas de estación", "", c.unit.fees]);
  L.push(["<b>Costo por unidad</b>", "", c.unit.total]);
  L.push(["Venta neta", `${fmt(S.sale)} − ${pct(c.tax+c.setup)}`, c.netSale]);
  if (c.sep) L.push(["Retorno separado (neto)", `${fmt(c.unit.retValue,1)} − ${pct(c.tax+c.setup)}`, c.retNetUnit]);
  $("profitBody").innerHTML = L.map(([a,b,v])=>`<tr><td>${a}</td><td><code>${b}</code></td><td class="n">${fmt(v,1)}</td></tr>`).join("")
    + `<tr class="total"><td>Ganancia por unidad</td><td><code>${S.sale&&c.unit.total? pct(c.profitUnit/c.unit.total)+" margen":""}</code></td><td class="n"><b class="${c.profitUnit>=0?"pos":"neg"}">${hasCost&&hasSale?fmt(c.profitUnit,1):"—"}</b></td></tr>`
    + (c.r.focus && c.unit.focus>0 && hasCost ? `<tr><td>Plata ahorrada por punto de foco</td><td><code>vs. sin foco</code></td><td class="n">${fmt(c.focusValue,2)}</td></tr>` : "");

  $("regionsWrap").hidden = $("buyCity").value !== CHEAP;
  const cmp = S.compare || {}, cmpIds = Object.keys(cmp).filter(id => c.P.steps.some(st=>st.rawId===id) || (c.P.buyPrev && c.P.buyPrev.id===id));
  $("compare").hidden = !cmpIds.length;
  if (cmpIds.length) {
    const ago = d => { const h=(Date.now()-Date.parse(d+"Z"))/36e5; return h<1?"<1 h":fmt(h)+" h"; };
    $("compareBody").innerHTML = cmpIds.map(id => `<div><b>${esc(id)}</b><div class="tablewrap"><table><tbody>`
      + (cmp[id].length ? cmp[id].map((x,i) => `<tr${!x.fresh?' style="opacity:.5"':""}><td>${esc(x.city)}<span class="age">${esc(regionOf(x.city))}</span></td><td class="n">${fmt(x.price)}${x.price===S.prices[id]&&x.city===S.cities[id]?' <b class="pos">← elegido</b>':""}</td><td class="n"><span class="age${x.fresh?"":" old"}">hace ${ago(x.date)}${x.fresh?"":" (ignorado)"}</span></td></tr>`).join("")
        : `<tr><td class="hint">Sin precios en los continentes marcados.</td></tr>`)
      + `</tbody></table></div></div>`).join("");
  }
  $("apiLink").href = apiUrl();
  save();
}
function refresh(){ buildSegs(); render(); }

/* ---------- precios API ---------- */
function neededIds(){
  const r = rates(), sep = S.ret==="separate", P = plan(1, r.keep, sep);
  return {buy:[...(P.buyPrev?[P.buyPrev.id]:[]), ...P.steps.map(s=>s.rawId)], sell:refId(S.tier),
          ret: sep ? P.steps.filter(st => st.tier > S.start).map(st => st.prevId) : []};
}
function apiUrl(){
  const n = neededIds(), list = [...new Set([...n.buy, n.sell, ...n.ret])].join(",");
  const buy = $("buyCity").value === CHEAP ? allowedCities() : [$("buyCity").value];
  const locs = [...new Set([...buy, $("sellCity").value])].join(",");
  return `https://${$("server").value}.albion-online-data.com/api/v2/stats/prices/${list}.json?locations=${encodeURIComponent(locs)}&qualities=1`;
}
function applyPrices(arr){
  if (!Array.isArray(arr)) throw new Error("La respuesta no es una lista de precios.");
  const n = neededIds(), buy = $("buyCity").value, sell = $("sellCity").value, instant = $("sellMode").value==="instant";
  const find = (id, city) => arr.find(r => r.item_id===id && r.city===city && (r.quality===1 || r.quality===undefined));
  let got = 0; const missing = [];
  if (buy === CHEAP && !allowedCities().length) throw new Error("Marca al menos un continente para buscar precios.");
  const maxH = +$("maxAge").value || 0;
  const fresh = d => !maxH || (d && (Date.now() - Date.parse(d + "Z")) / 36e5 <= maxH);
  S.compare = {};
  n.buy.forEach(id => {
    let r;
    if (buy === CHEAP) {
      const opts = arr.filter(x => x.item_id===id && x.city && x.city!=="0" && cityAllowed(x.city) && (x.quality===1 || x.quality===undefined) && x.sell_price_min > 0)
             .sort((a,b) => a.sell_price_min - b.sell_price_min);
      S.compare[id] = opts.map(x => ({city:x.city, price:x.sell_price_min, date:x.sell_price_min_date, fresh:fresh(x.sell_price_min_date)}));
      r = opts.find(x => fresh(x.sell_price_min_date));
    } else r = find(id, buy);
    if (r && r.sell_price_min > 0) { S.prices[id] = r.sell_price_min; S.dates[id] = r.sell_price_min_date; S.cities[id] = r.city; got++; }
    else missing.push(id + (buy===CHEAP ? "" : " en " + buy));
  });
  const r = find(n.sell, sell), f = instant ? "buy_price_max" : "sell_price_min";
  if (r && r[f] > 0) { S.sale = r[f]; S.saleDate = r[f+"_date"]; got++; } else missing.push(n.sell + " en " + sell);
  n.ret.forEach(id => { const x = find(id, sell); if (x && x[f] > 0) { S.retPrices[id] = x[f]; got++; } else missing.push(id + " en " + sell); });
  render();
  return {got, missing};
}
function parseText(t){
  if (typeof t !== "string") t = JSON.stringify(t);
  let a = t.indexOf("[{"); if (a < 0) a = t.indexOf("[");
  let b = t.lastIndexOf("}]"); b = b < 0 ? t.lastIndexOf("]") : b + 1;
  if (a<0 || b<a) throw new Error("No encontré datos de precios en el texto.");
  const s = t.slice(a, b+1);
  try { return JSON.parse(s); } catch(_) { return JSON.parse(s.replace(/\\"/g,'"')); }
}
function status(msg, kind){ const el=$("fetchStatus"); el.hidden=false; el.className="status "+(kind||""); el.textContent=msg; }
function report(r){
  if (r.got && !r.missing.length) status("Precios actualizados.", "ok");
  else if (r.got) status(`Actualizado en parte. Sin datos para: ${r.missing.join(", ")}. Escríbelos a mano.`, "warn");
  else status(`La API no tiene precios recientes para: ${r.missing.join(", ")}. Prueba otra ciudad o escríbelos a mano.`, "warn");
}

async function fetchLive(){
  const btn = $("fetchBtn"); btn.disabled = true; status("Consultando Albion Online Data Project…");
  try {
    const n = neededIds(), items = [...new Set([...n.buy, n.sell, ...n.ret])];
    const buy = $("buyCity").value === CHEAP ? allowedCities() : [$("buyCity").value];
    const locations = [...new Set([...buy, $("sellCity").value])];
    const rows = await window.GremioCommon.fn("prices", {tool:"refining", server:$("server").value, items, locations});
    report(applyPrices(rows));
  } catch (e) {
    status("No pude traer los precios: " + (e.message || "error desconocido") + ". Escríbelos a mano o pégalos abajo.", "err"); $("manual").open = true;
  } finally { btn.disabled = false; }
}

/* ---------- eventos ---------- */
document.addEventListener("input", e => {
  const p = e.target.dataset && e.target.dataset.p;
  if (p) {
    const v = +e.target.value||0;
    if (p==="__sale") { S.sale = v; S.saleDate = null; } else if (p.startsWith("ret:")) { S.retPrices[p.slice(4)] = v; } else { S.prices[p] = v; S.dates[p] = null; S.cities[p] = null; }
    render(); return;
  }
  if (e.target.id==="pasteBox") return;
  render();
});
document.addEventListener("focusout", e => { if (e.target.dataset && e.target.dataset.p) setTimeout(render, 0); });
$("start").addEventListener("change", e => { S.start = +e.target.value; refresh(); });
$("regions").addEventListener("change", () => {
  const ok = new Set(allowedCities());
  if (Object.values(S.cities).some(c => c && !ok.has(c)))
    status("Cambiaste los continentes. Vuelve a traer los precios para buscar el más barato solo en los marcados.", "warn");
});
$("retSeg").addEventListener("click", e => { const b=e.target.closest("button"); if(!b) return; S.ret=b.dataset.ret; refresh(); });
$("modeSeg").addEventListener("click", e => { const b=e.target.closest("button"); if(!b || b.disabled) return; S.mode=b.dataset.mode; refresh(); });
$("fetchBtn").onclick = fetchLive;
$("copyList").onclick = async () => {
  const b = $("copyList");
  try { await navigator.clipboard.writeText(S.shopText||""); b.textContent = "Copiada"; }
  catch(_) { b.textContent = "No se pudo copiar"; }
  setTimeout(() => b.textContent = "Copiar lista", 1500);
};
$("parseBtn").onclick = () => { try { report(applyPrices(parseText($("pasteBox").value))); } catch(e){ status(e.message, "err"); } };
$("copyUrl").onclick = async () => {
  try { await navigator.clipboard.writeText(apiUrl()); $("copyUrl").textContent="Copiada"; setTimeout(()=>$("copyUrl").textContent="Copiar URL",1500); }
  catch(_) { $("pasteBox").value = apiUrl(); $("pasteBox").select(); }
};

window.GremioCommon.guard("refining", "Calculadora de materiales").then(() => {
  fillCities(); load();
  if (!$("itemValue").value) $("itemValue").value = ITEM_VALUE[S.tier]*2**ee(S.tier);
  if (!$("focusBase").value) $("focusBase").value = FOCUS_EST[S.tier]*2**ee(S.tier);
  refresh();
}).catch(() => {});
})();
