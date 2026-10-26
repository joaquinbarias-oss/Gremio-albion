// Rutas por el mapa — Gremio Albion Online
(() => {
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const GC = window.GremioCommon, GR = window.GremioRutas;
const qs = new URLSearchParams(location.search);
const APP = window.gremioOverlay || null;
const OV = qs.get("flotante") === "1" || !!APP;
const KIND = {city:"Ciudad", portal:"Ciudad portal", rest:"Descanso", avalon:"Camino de Avalon"};
const ZTXT = {
  amarilla:"Zona amarilla: te pueden derribar, pero no pierdes lo que llevas.",
  roja:"Zona roja: si te matan pierdes todo lo que llevas.",
  negra:"Zona negra: full loot y cualquiera puede atacarte.",
};

const R = {server:"west", from:"", to:"", pref:"segura", avoid:[], path:[], step:0, useAvalon:true};
let M = null, editing = false, LINKS = [], canEdit = false, stopWatch = () => {};
function load(){ try { Object.assign(R, JSON.parse(localStorage.getItem("gremioRuta") || "{}")); } catch(_){} if (!Array.isArray(R.avoid)) R.avoid = []; if (!Array.isArray(R.path)) R.path = []; }
function save(){ try { localStorage.setItem("gremioRuta", JSON.stringify(R)); } catch(_){} }
function say(id, msg, kind){ const el = $(id); el.hidden = !msg; el.className = "status " + (kind || ""); el.textContent = msg || ""; }
const status = (msg, kind) => say("formStatus", msg, kind);

const nodeOf = name => M && M.find(name);
const activeLinks = () => R.useAvalon ? LINKS : [];
const left = exp => Math.max(0, Math.round((Date.parse(exp) - Date.now()) / 60000));
const dur = m => m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
const zoneLbl = z => GR.ZONES[z].label.toLowerCase();

// Ruta guardada (por nombre) con el tipo de cada cruce: fijo, portal de ciudad o portal de Avalon
function pathNodes(){
  const P = R.path.map(n => nodeOf(n)).filter(Boolean);
  return P.map((n, i) => {
    if (!i) return {...n};
    const e = GR.edgeBetween(M, P[i - 1].i, n.i, activeLinks());
    return {...n, portal: !!(e && e.portal), link: e && e.link ? e.link : null, broken: !e};
  });
}

function calc(fromName, toName){
  const a = nodeOf(fromName), b = nodeOf(toName);
  if (!a || !b) { status(!a ? `No encuentro el mapa "${fromName}". Elige uno de la lista.` : `No encuentro el mapa "${toName}". Elige uno de la lista.`, "warn"); return false; }
  if (a.i === b.i) { status("El origen y el destino son el mismo mapa.", "warn"); return false; }
  const r = GR.route(M, a.i, b.i, R.pref, R.avoid, activeLinks());
  if (!r) {
    const av = a.kind === "avalon" || b.kind === "avalon";
    status(av ? "No hay ninguna conexión anotada que llegue a ese camino de Avalon." : R.pref === "sinfull" ? "No hay camino solo por zonas azules y amarillas. Prueba con «Más segura»." : "No hay camino con los mapas que estás evitando. Quita alguno.", "warn");
    return false;
  }
  R.path = r.path.map(p => p.name); R.step = 0; status("");
  return true;
}
// Vuelve a calcular desde donde estás (al cambiar preferencia, evitar un mapa o vencer un portal)
function recalcHere(){
  if (!R.path.length) return false;
  const cur = R.path[R.step];
  if (calc(cur, R.to)) { R.from = cur; $("from").value = cur; return true; }
  return false;
}

function go(){
  R.from = $("from").value.trim(); R.to = $("to").value.trim();
  if (calc(R.from, R.to)) { editing = false; render(); }
  save();
}
function setStep(s){
  if (!R.path.length) return;
  R.step = Math.max(0, Math.min(R.path.length - 1, s)); save(); render();
}

// ---------- Teclas configurables ----------
const KEY_DEFAULT = {next:"F8", back:"F7", toggle:"F9"};
const KEY_LABEL = {next:"Avanzar (ya crucé)", back:"Retroceder", toggle:"Mostrar u ocultar la ventana"};
let KEYS = {...KEY_DEFAULT}, capturing = null;
const CODE = c => {
  let m;
  if ((m = /^Key([A-Z])$/.exec(c))) return m[1];
  if ((m = /^Digit(\d)$/.exec(c))) return m[1];
  if ((m = /^F(\d{1,2})$/.exec(c)) && +m[1] >= 1 && +m[1] <= 24) return c;
  if ((m = /^Numpad(\d)$/.exec(c))) return "num" + m[1];
  return ({Space:"Space", ArrowUp:"Up", ArrowDown:"Down", ArrowLeft:"Left", ArrowRight:"Right", Home:"Home", End:"End", PageUp:"PageUp", PageDown:"PageDown",
    Insert:"Insert", Delete:"Delete", Backspace:"Backspace", Enter:"Enter", NumpadEnter:"Enter",
    NumpadAdd:"numadd", NumpadSubtract:"numsub", NumpadMultiply:"nummult", NumpadDivide:"numdiv", NumpadDecimal:"numdec"})[c] || null;
};
function comboOf(e){
  const k = CODE(e.code);
  if (!k) return null;
  return [e.ctrlKey && "Ctrl", e.altKey && "Alt", e.shiftKey && "Shift", k].filter(Boolean).join("+");
}
const keyName = k => String(k || "").replace(/num(\d)/, "Num $1").replace("numadd", "Num +").replace("numsub", "Num −").replace("nummult", "Num ×").replace("numdiv", "Num ÷").replace("numdec", "Num .")
  .replace("Space", "Espacio").replace("Up", "↑").replace("Down", "↓").replace("Left", "←").replace("Right", "→").replace(/\+/g, " + ").replace("Num  +  ", "Num +");
const bare = k => !/[+]/.test(k) && !/^F\d+$/.test(k);   // sin Ctrl/Alt/Shift y no es F1–F24
function loadKeys(){ try { Object.assign(KEYS, JSON.parse(localStorage.getItem("gremioTeclas") || "{}")); } catch(_){} }
function saveKeys(){ try { localStorage.setItem("gremioTeclas", JSON.stringify(KEYS)); } catch(_){} }

async function setKey(action, combo){
  const other = Object.entries(KEYS).find(([a, k]) => a !== action && k === combo && (APP || a !== "toggle"));
  if (other) return say("keysStatus", `${keyName(combo)} ya está en «${KEY_LABEL[other[0]]}».`, "warn");
  const next = {...KEYS, [action]: combo};
  if (APP && APP.setKeys) {
    const err = await APP.setKeys(next);
    if (err) return say("keysStatus", err, "err");
  }
  KEYS = next; saveKeys();
  say("keysStatus", APP && bare(combo) ? `Listo. Ojo: mientras la app esté abierta, ${keyName(combo)} no llegará al juego. Si el juego la usa, elige una tecla F o una combinación con Ctrl o Alt.` : "Listo.", APP && bare(combo) ? "warn" : "ok");
  renderKeys();
}
function renderKeys(){
  const acts = APP ? ["next", "back", "toggle"] : ["next", "back"];
  $("keys").innerHTML = acts.map(a => `<div class="krow"><span>${KEY_LABEL[a]}</span><kbd>${capturing === a ? "…" : esc(keyName(KEYS[a]))}</kbd>
    <button type="button" data-key="${a}" aria-pressed="${capturing === a}">${capturing === a ? "Presiona una tecla" : "Cambiar"}</button></div>`).join("");
  $("keysHint").textContent = APP
    ? "Funcionan aunque estés dentro del juego. Esc cancela el cambio."
    : "Funcionan con esta página abierta y activa. En la app de escritorio funcionan dentro del juego. Esc cancela el cambio.";
  $("keyHint").innerHTML = `Avanza con <kbd>${esc(keyName(KEYS.next))}</kbd> y retrocede con <kbd>${esc(keyName(KEYS.back))}</kbd>${APP ? ", aunque estés dentro del juego" : ""}. Las cambias en «Teclas».`;
}

// ---------- Caminos de Avalon ----------
async function loadLinks(){
  try { LINKS = await GC.avalon.list(R.server); say("avStatus", ""); }
  catch(e) { LINKS = []; say("avStatus", "No pude cargar las conexiones de Avalon: " + e.message, "err"); }
  render();
}
function watchLinks(){ stopWatch(); stopWatch = GC.avalon.watch(R.server, loadLinks); }

async function addLink(){
  const a = nodeOf($("avA").value), b = nodeOf($("avB").value);
  const mins = Math.floor(+$("avH").value || 0) * 60 + Math.floor(+$("avM").value || 0);
  if (!a || !b) return say("avStatus", "Elige los dos mapas de la lista.", "warn");
  if (a.i === b.i) return say("avStatus", "Los dos mapas son el mismo.", "warn");
  if (a.kind !== "avalon" && b.kind !== "avalon") return say("avStatus", "Uno de los dos debe ser un camino de Avalon.", "warn");
  if (mins < 1 || mins > 24 * 60) return say("avStatus", "Pon el tiempo que le queda al portal (entre 1 minuto y 24 horas).", "warn");
  const btn = $("avAdd"); btn.disabled = true;
  try {
    await GC.avalon.add(R.server, a.name, b.name, mins);
    $("avA").value = ""; $("avB").value = ""; $("avH").value = ""; $("avM").value = "";
    say("avStatus", `Anotado: ${a.name} ↔ ${b.name}, vence en ${dur(mins)}.`, "ok");
    await loadLinks();
  } catch(e) { say("avStatus", e.message, "err"); }
  finally { btn.disabled = false; }
}

function renderLinks(){
  const live = LINKS.filter(l => left(l.expires_at) > 0);
  $("avCount").textContent = live.length ? `${live.length} vigentes` : "ninguna";
  $("avUse").checked = R.useAvalon;
  $("avForm").hidden = !canEdit;
  $("avList").innerHTML = live.map(l => {
    const m = left(l.expires_at);
    return `<li><span class="nm">${esc(l.a)} ↔ ${esc(l.b)}<small class="${m < 30 ? "soon" : ""}">vence en ${dur(m)}${l.created_name ? ` · ${esc(l.created_name)}` : ""}</small></span>
      ${canEdit ? `<button type="button" data-unlink="${esc(l.id)}" title="Borrar esta conexión">Borrar</button>` : ""}</li>`;
  }).join("") || `<li><span class="hint">${canEdit ? "Nadie ha anotado conexiones todavía. Cuando entres a un camino, anótalo aquí." : "Nadie ha anotado conexiones todavía."}</span></li>`;
}

// ---------- Vista ----------
function renderForm(){
  const seg = $("prefSeg"); seg.innerHTML = "";
  Object.entries(GR.PREFS).forEach(([k, p]) => {
    const b = document.createElement("button"); b.type = "button"; b.textContent = p.label; b.setAttribute("aria-pressed", String(k === R.pref));
    b.onclick = () => { R.pref = k; recalcHere(); save(); render(); };
    seg.appendChild(b);
  });
  $("prefHint").textContent = GR.PREFS[R.pref].hint;
  $("avoidWrap").hidden = !R.avoid.length;
  $("avoidChips").innerHTML = R.avoid.map((a, i) => `<button type="button" data-unavoid="${i}" title="Volver a permitir">${esc(a)} ×</button>`).join("");
}

function crossing(n){
  if (n.broken) return `<div class="warnz negra">La conexión hacia ${esc(n.name)} venció o la borraron. <button class="btn ghost" type="button" data-recalc style="padding:2px 10px">Buscar otro camino</button></div>`;
  if (n.link) { const m = left(n.link.expires_at); return `<div class="then ava">Por el portal de Avalon · vence en ${dur(m)}${m < 20 ? " (¡apúrate!)" : ""}</div>`; }
  if (n.portal) return `<div class="then">Usa el portal de la ciudad.</div>`;
  return "";
}

function renderNav(P){
  const has = P.length > 1;
  $("navPanel").hidden = !has;
  if (!has) return;
  const s = R.step, cur = P[s], nxt = P[s + 1], then = P[s + 2], last = s === P.length - 1;
  const pct = Math.round(s / (P.length - 1) * 100);
  $("nav").innerHTML = last
    ? `<div class="now">Llegaste</div><div class="next"><span class="zd ${cur.zone}"></span>${esc(cur.name)}</div><div class="bar"><i style="width:100%"></i></div><div class="then">${P.length - 1} mapas recorridos.</div>`
    : `<div class="now">Estás en ${esc(cur.name)} · paso ${s + 1} de ${P.length - 1}</div>
       <div class="next"><span class="zd ${nxt.zone}" title="Zona ${zoneLbl(nxt.zone)}"></span>${esc(nxt.name)}</div>
       ${crossing(nxt)}
       ${ZTXT[nxt.zone] && nxt.zone !== cur.zone ? `<div class="warnz ${nxt.zone}">${ZTXT[nxt.zone]}</div>` : ""}
       <div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
       <div class="then">${then ? `Después: ${esc(then.name)} · ` : ""}${P.length - 1 - s === 1 ? "falta 1 mapa" : `faltan ${P.length - 1 - s} mapas`} hasta ${esc(P[P.length - 1].name)}</div>`;
  $("backBtn").disabled = s === 0;
  $("nextBtn").disabled = last;
  $("nextBtn").textContent = last ? "Llegaste" : "Ya crucé →";
}

function renderList(P){
  const c = {azul:0, amarilla:0, roja:0, negra:0}; P.forEach(p => c[p.zone]++);
  const nAv = P.filter(p => p.kind === "avalon").length;
  $("zcount").innerHTML = P.length ? `<span>${P.length - 1} mapas</span>` + Object.entries(c).filter(([, v]) => v).map(([z, v]) => `<span><i class="zd ${z}"></i>${v} ${zoneLbl(z)}</span>`).join("") + (nAv ? `<span class="ava">${nAv} de Avalon</span>` : "") : "";
  $("route").innerHTML = P.map((p, i) => {
    const meta = [`Zona ${zoneLbl(p.zone)}`, p.tier ? `T${p.tier}` : "", KIND[p.kind] || "", p.kind === "avalon" ? GR.AVALON_KIND[p.sub] || "" : "",
      p.portal ? "por portal" : "", p.link ? `portal de Avalon, vence en ${dur(left(p.link.expires_at))}` : "", p.broken ? "⚠ conexión vencida" : ""].filter(Boolean).join(" · ");
    const endp = i === 0 || i === P.length - 1;
    return `<li class="${i < R.step ? "done" : i === R.step ? "here" : ""}">
      <span class="num">${i}</span><span class="zd ${p.zone}" title="Zona ${zoneLbl(p.zone)}"></span>
      <span class="nm">${esc(p.name)}<small>${meta}</small></span>
      <span class="acts">${i !== R.step ? `<button type="button" data-here="${i}" title="Marcar que estás aquí">Estoy aquí</button>` : ""}${endp || i <= R.step ? "" : `<button type="button" data-avoid="${i}" title="Buscar otro camino que no pase por aquí">Evitar</button>`}</span></li>`;
  }).join("") || `<li><span></span><span></span><span class="hint">Elige un origen y un destino.</span><span></span></li>`;
}

function renderMap(P){
  const box = $("mapbox");
  const W = P.map((p, i) => ({...p, idx:i})).filter(p => p.x != null);   // los caminos de Avalon no tienen posición
  if (W.length < 2) { box.hidden = true; return; }
  box.hidden = false;
  const xs = W.map(p => p.x), ys = W.map(p => -p.y);
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const span = Math.max(40, x1 - x0, y1 - y0), pad = span * .14;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, w = Math.max(x1 - x0, span * .8) + pad * 2, h = Math.max(y1 - y0, span * .5) + pad * 2;
  x0 = cx - w / 2; y0 = cy - h / 2;
  const inView = n => n.x != null && n.x >= x0 && n.x <= x0 + w && -n.y >= y0 && -n.y <= y0 + h;
  const r = span * .012, fs = span * .032;
  const vis = M.nodes.filter(inView), visSet = new Set(vis.map(n => n.i));
  const lines = M.edges.filter(([a, b]) => visSet.has(a) || visSet.has(b)).map(([a, b]) => { const A = M.nodes[a], B = M.nodes[b]; return `<line x1="${A.x}" y1="${-A.y}" x2="${B.x}" y2="${-B.y}"/>`; }).join("");
  const dots = vis.map(n => `<circle cx="${n.x}" cy="${-n.y}" r="${r * .7}" class="zf ${n.zone}" opacity=".35"><title>${esc(n.name)}</title></circle>`).join("");
  const seg = (a, b, cls) => `<line x1="${a.x}" y1="${-a.y}" x2="${b.x}" y2="${-b.y}" class="${cls}"/>`;
  let route = "";
  for (let k = 1; k < W.length; k++) {
    const a = W[k - 1], b = W[k], viaAvalon = b.idx - a.idx > 1;
    route += seg(a, b, b.idx <= R.step ? "rd" : viaAvalon ? "ra" : b.portal ? "rp" : "rt");
  }
  const stops = W.map(p => `<circle cx="${p.x}" cy="${-p.y}" r="${p.idx === R.step ? r * 1.9 : r * 1.15}" class="zf ${p.zone}${p.idx === R.step ? " cur" : ""}"><title>${p.idx}. ${esc(p.name)} (zona ${zoneLbl(p.zone)})</title></circle>`).join("");
  const label = (p, t) => { const right = p.x > x0 + w * .62; return `<text x="${right ? p.x - r * 2.4 : p.x + r * 2.4}" y="${-p.y + fs * .35}" font-size="${fs}" text-anchor="${right ? "end" : "start"}">${esc(t)}</text>`; };
  const cur = W.find(p => p.idx === R.step);
  const labels = label(W[0], W[0].name) + label(W[W.length - 1], W[W.length - 1].name) + (cur && cur !== W[0] && cur !== W[W.length - 1] ? label(cur, cur.name) : "");
  box.innerHTML = `<svg viewBox="${x0} ${y0} ${w} ${h}" role="img" aria-label="Mapa de la ruta de ${esc(P[0].name)} a ${esc(P[P.length - 1].name)}">
    <style>
      .bg line{stroke:var(--line);stroke-width:1;vector-effect:non-scaling-stroke}
      .rt{stroke:var(--accent);stroke-width:4;stroke-linecap:round;vector-effect:non-scaling-stroke}
      .rp{stroke:var(--accent);stroke-width:3;stroke-dasharray:6 5;vector-effect:non-scaling-stroke}
      .ra{stroke:var(--accent);stroke-width:3;stroke-dasharray:2 6;stroke-linecap:round;vector-effect:non-scaling-stroke}
      .rd{stroke:var(--muted);stroke-width:3;stroke-linecap:round;opacity:.6;vector-effect:non-scaling-stroke}
      .zf{stroke:var(--panel);stroke-width:1.5;vector-effect:non-scaling-stroke}
      .zf.azul{fill:var(--z-azul)} .zf.amarilla{fill:var(--z-amarilla)} .zf.roja{fill:var(--z-roja)} .zf.negra{fill:var(--z-negra);stroke:var(--ink)}
      .zf.cur{stroke:var(--accent);stroke-width:3}
      text{fill:var(--ink);font-family:var(--f-body);font-weight:600;paint-order:stroke;stroke:var(--bg);stroke-width:3;vector-effect:non-scaling-stroke}
    </style>
    <g class="bg">${lines}</g>${dots}${route}${stops}${labels}</svg>`;
}

function render(){
  if (!M) return;
  const P = pathNodes();
  if (P.length !== R.path.length) { R.path = []; R.step = 0; }
  const showSetup = !OV || P.length < 2 || editing;
  $("formPanel").hidden = !showSetup;
  $("avPanel").hidden = !showSetup;
  $("keysPanel").hidden = !showSetup;
  $("ovEdit").textContent = editing ? "Cerrar" : "Ajustes";
  renderForm(); renderNav(P); renderList(P); renderMap(P); renderLinks(); renderKeys();
}

async function useServer(server){
  R.server = GR.SERVERS.includes(server) ? server : "west";
  $("server").value = R.server;
  try { M = await GR.load(R.server); }
  catch(e) { status("No pude cargar el mapa: " + e.message, "err"); return; }
  $("maps").innerHTML = M.nodes.slice().sort((a, b) => a.name.localeCompare(b.name)).map(n => `<option value="${esc(n.name)}">${n.kind === "avalon" ? "Camino de Avalon" : ""}</option>`).join("");
  R.avoid = R.avoid.filter(a => nodeOf(a));
  watchLinks(); await loadLinks();
}

function bind(){
  $("server").onchange = async e => { await useServer(e.target.value); if (R.from && R.to) calc(R.from, R.to); else R.path = []; save(); render(); };
  $("from").value = R.from; $("to").value = R.to;
  $("goBtn").onclick = go;
  ["from", "to"].forEach(id => $(id).addEventListener("keydown", e => { if (e.key === "Enter") go(); }));
  $("swapBtn").onclick = () => { const a = $("from").value; $("from").value = $("to").value; $("to").value = a; go(); };
  $("nextBtn").onclick = () => setStep(R.step + 1);
  $("backBtn").onclick = () => setStep(R.step - 1);
  $("ovEdit").onclick = () => { editing = !editing; render(); };
  $("nav").onclick = e => { if (e.target.closest("[data-recalc]")) { recalcHere(); save(); render(); } };
  $("avoidChips").onclick = e => { const b = e.target.closest("[data-unavoid]"); if (!b) return; R.avoid.splice(+b.dataset.unavoid, 1); recalcHere(); save(); render(); };
  $("route").onclick = e => {
    const h = e.target.closest("[data-here]"), a = e.target.closest("[data-avoid]");
    if (h) setStep(+h.dataset.here);
    if (a) {
      const name = R.path[+a.dataset.avoid];
      if (!R.avoid.includes(name)) R.avoid.push(name);
      if (!recalcHere()) R.avoid.pop();
      save(); render();
    }
  };
  // Avalon
  $("avUse").onchange = e => { R.useAvalon = e.target.checked; recalcHere(); save(); render(); };
  $("avAdd").onclick = addLink;
  ["avA", "avB", "avH", "avM"].forEach(id => $(id).addEventListener("keydown", e => { if (e.key === "Enter") addLink(); }));
  $("avList").onclick = async e => {
    const b = e.target.closest("[data-unlink]"); if (!b) return;
    b.disabled = true;
    try { await GC.avalon.remove(isNaN(+b.dataset.unlink) ? b.dataset.unlink : +b.dataset.unlink); await loadLinks(); }
    catch(err) { say("avStatus", err.message, "err"); b.disabled = false; }
  };
  setInterval(() => { LINKS = LINKS.filter(l => left(l.expires_at) > 0); render(); }, 30000);
  // Teclas
  $("keys").onclick = e => { const b = e.target.closest("[data-key]"); if (!b) return; capturing = capturing === b.dataset.key ? null : b.dataset.key; say("keysStatus", ""); renderKeys(); };
  $("keysReset").onclick = async () => {
    capturing = null;
    if (APP && APP.setKeys) { const err = await APP.setKeys({...KEY_DEFAULT}); if (err) { say("keysStatus", err, "err"); return renderKeys(); } }
    KEYS = {...KEY_DEFAULT}; saveKeys(); say("keysStatus", "Teclas restablecidas.", "ok"); renderKeys();
  };
  document.addEventListener("keydown", e => {
    if (capturing) {
      e.preventDefault(); e.stopPropagation();
      if (e.key === "Escape") { capturing = null; say("keysStatus", ""); return renderKeys(); }
      if (["Control", "Alt", "Shift", "Meta", "AltGraph"].includes(e.key)) return;   // espera la tecla principal
      const combo = comboOf(e);
      if (!combo) return say("keysStatus", "Esa tecla no se puede usar. Prueba con F1–F12, letras, números, el teclado numérico o las flechas.", "warn");
      const a = capturing; capturing = null; setKey(a, combo);
      return;
    }
    if (e.target.closest("input,select,textarea")) return;
    const combo = comboOf(e);
    // En la app las teclas configuradas llegan por onKey (globales); aquí solo las de la página
    if (!APP && combo && combo === KEYS.next) { e.preventDefault(); return setStep(R.step + 1); }
    if (!APP && combo && combo === KEYS.back) { e.preventDefault(); return setStep(R.step - 1); }
    if (e.target.closest("button") || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === " " || e.key === "ArrowRight") { e.preventDefault(); setStep(R.step + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); setStep(R.step - 1); }
  }, true);
  // App de escritorio: las teclas llegan aunque el juego tenga el foco
  if (APP && APP.hide) { $("ovHide").hidden = false; $("ovHide").onclick = () => APP.hide(); }
  if (APP && APP.onKey) APP.onKey(k => { if (k === "next") setStep(R.step + 1); else if (k === "back") setStep(R.step - 1); });
}

load(); loadKeys();
if (OV) document.body.classList.add("ov");
if (APP) document.body.classList.add("ovapp");
GC.guard("routes", "Rutas").then(async ({me, settings, perms}) => {
  canEdit = GC.permAllowed(me, settings, perms, "avalon.edit");
  if (APP && APP.getKeys) { try { const k = await APP.getKeys(); if (k) KEYS = {...KEY_DEFAULT, ...k}; } catch(_){} }
  const qServer = qs.get("server"), qFrom = qs.get("from"), qTo = qs.get("to");
  bind();
  await useServer(qServer || R.server);
  if (qFrom && qTo) { $("from").value = qFrom; $("to").value = qTo; go(); }
  render();
}).catch(() => {});
})();
