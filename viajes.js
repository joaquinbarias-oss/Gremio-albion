// Planificador de viajes — Gremio Albion Online
(() => {
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt = (n, d=0) => isFinite(n) ? Number(n).toLocaleString("es-CL",{maximumFractionDigits:d, minimumFractionDigits:d}) : "—";
const ITEM_RE = /^T\d_[A-Z0-9_]{2,60}(@\d)?$/;

const CITIES = ["Bridgewatch","Fort Sterling","Lymhurst","Martlock","Thetford","Caerleon","Brecilien"];
const MATS = {
  ore:  {label:"Mineral", raw:"ORE",   ref:"METALBAR",   rawN:"Mineral", refN:"Lingote",          ench:true},
  wood: {label:"Madera",  raw:"WOOD",  ref:"PLANKS",     rawN:"Madera",  refN:"Tablón",           ench:true},
  fiber:{label:"Fibra",   raw:"FIBER", ref:"CLOTH",      rawN:"Fibra",   refN:"Tela",             ench:true},
  hide: {label:"Piel",    raw:"HIDE",  ref:"LEATHER",    rawN:"Piel",    refN:"Cuero",            ench:true},
  rock: {label:"Piedra",  raw:"ROCK",  ref:"STONEBLOCK", rawN:"Piedra",  refN:"Bloque de piedra", ench:false},
};
const ZONES = {
  azul:    {label:"Azul",     risk:0, text:"Zona segura: otros jugadores no pueden atacarte (salvo que actives la hostilidad)."},
  amarilla:{label:"Amarilla", risk:1, text:"Te pueden derribar, pero al morir no pierdes lo que llevas."},
  roja:    {label:"Roja",     risk:2, text:"Si te matan pierdes todo lo que llevas (full loot)."},
  negra:   {label:"Negra",    risk:3, text:"Full loot y sin castigo de reputación para quien te ataca: el riesgo más alto."},
};

const T = {server:"west", origin:"Martlock", dest:"Caerleon", zone:"roja", sellMode:"order", premium:true, capacity:"", minutes:"",
  kind:"ref", mat:"ore", tier:5, ench:0, items:[]};
let W = {}; // peso por ítem, recordado en este navegador
function load(){ try { Object.assign(T, JSON.parse(localStorage.getItem("gremioViajes")||"{}")); W = JSON.parse(localStorage.getItem("gremioPesos")||"{}"); } catch(_){} }
function save(){ try { localStorage.setItem("gremioViajes", JSON.stringify(T)); localStorage.setItem("gremioPesos", JSON.stringify(W)); } catch(_){} }

function pickId(){
  if (T.kind === "id") return ($("customId").value || "").trim().toUpperCase();
  const m = MATS[T.mat], e = T.tier >= 4 && m.ench ? T.ench : 0;
  return `T${T.tier}_${T.kind==="raw" ? m.raw : m.ref}${e ? `_LEVEL${e}@${e}` : ""}`;
}
function itemName(id){
  const mm = /^T(\d)_([A-Z_]+?)(?:_LEVEL\d)?(?:@(\d))?$/.exec(id);
  if (mm) for (const m of Object.values(MATS)) {
    const tag = `T${mm[1]}${mm[3] ? "." + mm[3] : ""}`;
    if (mm[2] === m.raw) return `${m.rawN} ${tag}`;
    if (mm[2] === m.ref) return `${m.refN} ${tag}`;
  }
  const p = /^T(\d)_(.+?)(?:@(\d))?$/.exec(id);
  return p ? `${p[2].replace(/_/g," ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase())} T${p[1]}${p[3] ? "." + p[3] : ""}` : id;
}

function seg(el, items, cur, onPick, disabled){
  el.innerHTML = "";
  items.forEach(([v, l]) => { const b = document.createElement("button"); b.type = "button"; b.textContent = l; b.setAttribute("aria-pressed", String(v === cur)); if (disabled && disabled(v)) b.disabled = true; b.onclick = () => onPick(v); el.appendChild(b); });
}
function buildPicker(){
  seg($("kindSeg"), [["raw","Recurso crudo"],["ref","Refinado"],["id","Otro (ID)"]], T.kind, v => { T.kind = v; refresh(); });
  seg($("matSeg"), Object.entries(MATS).map(([k,m]) => [k, m.label]), T.mat, v => { T.mat = v; if (!MATS[v].ench) T.ench = 0; refresh(); });
  seg($("tierSeg"), [2,3,4,5,6,7,8].map(t => [t, "T"+t]), T.tier, v => { T.tier = v; if (v < 4) T.ench = 0; refresh(); });
  seg($("enchSeg"), [0,1,2,3,4].map(e => [e, "."+e]), T.ench, v => { T.ench = v; refresh(); }, v => v > 0 && (T.tier < 4 || !MATS[T.mat].ench));
  seg($("zoneSeg"), Object.entries(ZONES).map(([k,z]) => [k, z.label]), T.zone, v => { T.zone = v; refresh(); });
  $("pickRes").hidden = T.kind === "id"; $("pickId").hidden = T.kind !== "id";
  const id = pickId();
  $("pickPreview").textContent = ITEM_RE.test(id) ? `Vas a agregar: ${itemName(id)} (${id})` : (T.kind === "id" ? "Escribe un ID válido, por ejemplo T6_BAG." : "");
}

function calc(){
  const BM = T.dest === "Black Market";
  const fee = (T.premium ? 0.04 : 0.08) + (!BM && T.sellMode === "order" ? 0.025 : 0);
  const cap = +T.capacity || 0;
  const rows = T.items.map(it => {
    const w = W[it.id] ?? null, qty = +it.qty || 0, buy = +it.buy || 0, sell = +it.sell || 0;
    const net = sell * (1 - fee), unit = net - buy;
    return {...it, w, qty, buy, sell, net, unit, profit: unit * qty, cost: buy * qty, weight: w != null ? w * qty : null, perKg: w ? unit / w : null};
  });
  const missingW = rows.filter(r => r.w == null || r.w === "").length;
  const missingP = rows.filter(r => !r.buy || !r.sell).length;
  const weight = rows.reduce((a, r) => a + (r.weight || 0), 0);
  const cost = rows.reduce((a, r) => a + r.cost, 0), profit = rows.reduce((a, r) => a + r.profit, 0);
  const trips = cap > 0 && weight > 0 ? Math.ceil(weight / cap) : 0;
  const riskPerTrip = trips ? Math.min(cost, cost / weight * cap) : cost;
  // Mejor carga para un viaje: primero lo que más gana por kilo
  let left = cap, best = [], bestProfit = 0, bestWeight = 0;
  if (cap > 0) for (const r of rows.filter(r => r.perKg > 0).sort((a, b) => b.perKg - a.perKg)) {
    const units = Math.min(r.qty, Math.floor(left / r.w)); if (units <= 0) continue;
    best.push({r, units}); left -= units * r.w; bestProfit += units * r.unit; bestWeight += units * r.w;
  }
  return {BM, fee, cap, rows, missingW, missingP, weight, cost, profit, trips, riskPerTrip, best, bestProfit, bestWeight};
}

function render(){
  const c = calc(), z = ZONES[T.zone];
  $("zoneHint").textContent = z.text;
  $("sellMode").disabled = c.BM;
  $("resTitle").textContent = `${T.origin} → ${T.dest}`;
  const perTrip = c.trips ? c.profit / c.trips : null;
  const perHour = c.trips && +T.minutes ? c.profit / (c.trips * +T.minutes / 60) : null;
  const stats = [
    ["Ganancia total", T.items.length && !c.missingP ? `<span class="${c.profit>=0?"pos":"neg"}">${fmt(c.profit)}</span>` : "—", c.missingP ? `faltan ${c.missingP} precios` : `inversión ${fmt(c.cost)}`],
    ["Peso total", c.missingW ? "—" : `${fmt(c.weight)} kg`, c.missingW ? `falta el peso de ${c.missingW}` : (c.cap ? `capacidad ${fmt(c.cap)} kg` : "pon tu peso máximo")],
    ["Viajes", c.trips || "—", perTrip != null && !c.missingP ? `${fmt(perTrip)} por viaje` : ""],
    ["Por hora", perHour != null && !c.missingP ? fmt(perHour) : "—", +T.minutes ? `${T.minutes} min por viaje` : "pon los minutos por viaje"],
  ];
  $("stats").innerHTML = stats.map(([k, v, s], i) => `<div class="stat ${i===0?"hero":""}"><div class="k">${k}</div><div class="v">${v}</div><div class="s" style="font-size:.75rem;color:var(--muted)">${s}</div></div>`).join("");
  const riskVal = c.trips ? c.riskPerTrip : c.cost;
  $("riskBox").innerHTML = z.risk >= 2 && T.items.length ? `<div class="status warn"><b>Ruta con zona ${z.label.toLowerCase()}.</b> En cada viaje arriesgas cerca de <b>${fmt(riskVal)}</b> en carga, más tu equipo. Si te matan, lo pierdes. ${c.trips > 1 ? "Hacer más viajes con menos carga reduce lo que arriesgas en cada uno." : ""}</div>`
    : z.risk === 1 && T.items.length ? `<div class="status">Ruta con zona amarilla: te pueden derribar y retrasar, pero no pierdes la carga.</div>` : "";

  $("itemsBody").innerHTML = c.rows.map((r, i) => `<tr>
    <td>${esc(itemName(r.id))}<br><code>${esc(r.id)}</code></td>
    <td class="n"><input type="number" min="0" step="1" data-q="${i}" value="${r.qty}" aria-label="Cantidad de ${esc(itemName(r.id))}"></td>
    <td class="n"><input type="number" min="0" step="0.01" data-w="${esc(r.id)}" value="${r.w ?? ""}" placeholder="?" aria-label="Peso de ${esc(itemName(r.id))}"></td>
    <td class="n"><input type="number" min="0" step="1" data-b="${i}" value="${r.buy || ""}" placeholder="0" aria-label="Precio de compra">${r.buyDate ? `<span class="age">${ago(r.buyDate)}</span>` : ""}</td>
    <td class="n"><input type="number" min="0" step="1" data-s="${i}" value="${r.sell || ""}" placeholder="0" aria-label="Precio de venta">${r.sellDate ? `<span class="age">${ago(r.sellDate)}</span>` : ""}</td>
    <td class="n ${r.profit>=0?"pos":"neg"}">${r.buy && r.sell ? fmt(r.profit) : "—"}</td>
    <td class="n">${r.perKg != null && r.buy && r.sell ? fmt(r.perKg, 1) : "—"}</td>
    <td><button class="btn ghost" type="button" data-del="${i}" title="Quitar" style="padding:2px 9px">×</button></td></tr>`).join("")
    || `<tr><td colspan="8" class="hint" style="padding:14px 6px">Agrega lo que vas a llevar con el panel "Agregar a la carga".</td></tr>`;

  $("bestBody").innerHTML = !c.cap ? `<tr><td class="hint">Pon tu peso máximo para calcularla.</td></tr>`
    : c.best.length ? c.best.map(b => `<tr><td>${esc(itemName(b.r.id))}</td><td class="n"><b>${fmt(b.units)}</b> u.</td><td class="n">${fmt(b.units * b.r.w)} kg</td><td class="n pos">${fmt(b.units * b.r.unit)}</td></tr>`).join("")
      + `<tr class="total"><td>Total del viaje</td><td></td><td class="n">${fmt(c.bestWeight)} / ${fmt(c.cap)} kg</td><td class="n pos">${fmt(c.bestProfit)}</td></tr>`
    : `<tr><td class="hint">Ningún ítem deja ganancia con estos precios, o falta su peso.</td></tr>`;
  save();
  suggestRoute();
}
const ago = d => { const h = (Date.now() - Date.parse(String(d).replace(/Z?$/, "Z"))) / 36e5; return isFinite(h) ? (h < 1 ? "hace <1 h" : `hace ${fmt(h)} h`) : ""; };
function refresh(){ buildPicker(); render(); }

// Ruta sugerida entre las ciudades (más segura) y su peor zona
let ACC = {routes:false}, routeKey = "";
async function suggestRoute(){
  const box = $("routeHint"), GR = window.GremioRutas;
  const to = T.dest === "Black Market" ? "Caerleon" : T.dest, key = [T.server, T.origin, to, T.zone].join("|");
  if (key === routeKey) return; routeKey = key;
  box.hidden = true;
  if (!GR || T.origin === to) return;
  let M; try { M = await GR.load(T.server); } catch(_) { return; }
  if (key !== routeKey) return;
  const a = M.find(T.origin), b = M.find(to);
  if (!a || !b) { box.hidden = false; box.className = "status"; box.textContent = [T.origin, to].includes("Brecilien") ? "Brecilien está en las Brumas y no tiene un camino fijo. Elige la zona a mano." : `No encuentro ${!a ? T.origin : to} en el mapa. Elige la zona a mano.`; return; }
  const r = GR.route(M, a.i, b.i, "segura");
  if (!r) return;
  const z = GR.ZONES[r.worst].label.toLowerCase();
  const link = ACC.routes ? ` <a href="rutas.html?server=${encodeURIComponent(T.server)}&from=${encodeURIComponent(T.origin)}&to=${encodeURIComponent(to)}">Ver la ruta paso a paso</a>` : "";
  box.hidden = false; box.className = "status";
  box.innerHTML = `Camino más seguro: <b>${r.path.length - 1} mapas</b>, la zona más peligrosa es <b>${esc(z)}</b>. ${r.worst !== T.zone ? `<button class="btn ghost" type="button" id="useZone" style="padding:2px 10px">Usar zona ${esc(z)}</button>` : ""}${link}`;
  const u = $("useZone"); if (u) u.onclick = () => { T.zone = r.worst; refresh(); };
}
function status(msg, kind){ const el = $("fetchStatus"); el.hidden = false; el.className = "status " + (kind || ""); el.textContent = msg; }

async function fetchPrices(){
  if (!T.items.length) return status("Agrega primero lo que vas a llevar.", "warn");
  const btn = $("fetchBtn"); btn.disabled = true; status("Consultando Albion Online Data Project…");
  try {
    const ids = [...new Set(T.items.map(i => i.id))];
    const rows = await window.GremioCommon.fn("prices", {tool:"transport", server:T.server, items:ids, locations:[...new Set([T.origin, T.dest])]});
    const BM = T.dest === "Black Market", f = BM || T.sellMode === "instant" ? "buy_price_max" : "sell_price_min";
    const find = (id, city) => rows.find(r => r.item_id === id && r.city === city && (r.quality === 1 || r.quality === undefined));
    const missing = [];
    T.items.forEach(it => {
      const b = find(it.id, T.origin), s = find(it.id, T.dest);
      if (b && b.sell_price_min > 0) { it.buy = b.sell_price_min; it.buyDate = b.sell_price_min_date; } else missing.push(`compra de ${itemName(it.id)} en ${T.origin}`);
      if (s && s[f] > 0) { it.sell = s[f]; it.sellDate = s[f + "_date"]; } else missing.push(`venta de ${itemName(it.id)} en ${T.dest}`);
    });
    render();
    status(missing.length ? `Sin datos para: ${missing.join(", ")}. Escríbelos a mano.` : "Precios actualizados.", missing.length ? "warn" : "ok");
  } catch(e) { status("No pude traer los precios: " + e.message + ". Escríbelos a mano.", "err"); }
  finally { btn.disabled = false; }
}

function bind(){
  const sel = (id, list, val) => { $(id).innerHTML = list.map(c => `<option ${c===val?"selected":""}>${c}</option>`).join(""); };
  sel("origin", CITIES, T.origin); sel("dest", [...CITIES, "Black Market"], T.dest);
  $("server").value = T.server; $("sellMode").value = T.sellMode; $("premium").checked = T.premium;
  $("capacity").value = T.capacity; $("minutes").value = T.minutes;
  $("server").onchange = e => { T.server = e.target.value; render(); };
  $("origin").onchange = e => { T.origin = e.target.value; T.items.forEach(i => { i.buy = 0; i.buyDate = null; }); render(); };
  $("dest").onchange = e => { T.dest = e.target.value; T.items.forEach(i => { i.sell = 0; i.sellDate = null; }); render(); };
  $("sellMode").onchange = e => { T.sellMode = e.target.value; render(); };
  $("premium").onchange = e => { T.premium = e.target.checked; render(); };
  $("capacity").oninput = e => { T.capacity = e.target.value; render(); };
  $("minutes").oninput = e => { T.minutes = e.target.value; render(); };
  $("customId").oninput = () => buildPicker();
  $("addBtn").onclick = () => {
    const id = pickId(), qty = Math.max(1, Math.floor(+$("addQty").value || 0));
    if (!ITEM_RE.test(id)) return status("Ese ID no es válido. Ejemplo: T6_BAG o T5_MAIN_SWORD@1.", "warn");
    const ex = T.items.find(i => i.id === id);
    if (ex) ex.qty = (+ex.qty || 0) + qty; else T.items.push({id, qty, buy:0, sell:0});
    $("fetchStatus").hidden = true; render();
  };
  $("fetchBtn").onclick = fetchPrices;
  $("clearBtn").onclick = () => { T.items = []; render(); };
  $("itemsBody").addEventListener("change", e => {
    const t = e.target, d = t.dataset;
    if (d.q != null) T.items[+d.q].qty = Math.max(0, Math.floor(+t.value || 0));
    else if (d.w != null) { if (t.value === "") delete W[d.w]; else W[d.w] = Math.max(0, +t.value); }
    else if (d.b != null) { T.items[+d.b].buy = Math.max(0, +t.value || 0); T.items[+d.b].buyDate = null; }
    else if (d.s != null) { T.items[+d.s].sell = Math.max(0, +t.value || 0); T.items[+d.s].sellDate = null; }
    else return;
    render();
  });
  $("itemsBody").addEventListener("click", e => { const b = e.target.closest("[data-del]"); if (b) { T.items.splice(+b.dataset.del, 1); render(); } });
}

load();
window.GremioCommon.guard("transport", "Planificador de viajes").then(({me, settings, perms}) => {
  ACC.routes = window.GremioCommon.toolAllowed(me, settings, perms, "routes");
  bind(); refresh();
}).catch(() => {});
})();
