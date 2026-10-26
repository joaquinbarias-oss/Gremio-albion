// Gremio Albion Online — lógica de la página
(() => {
const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt = (n, d=0) => isFinite(n) ? Number(n).toLocaleString("es-CL",{maximumFractionDigits:d, minimumFractionDigits:d}) : "—";
const ts = v => typeof v === "number" ? v : (v ? Date.parse(v) : NaN);
const hhmm = v => v ? new Date(ts(v)).toLocaleString("es-CL",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}) : "—";
const dur = ms => { const m = Math.max(0, Math.round(ms/60000)); return m < 60 ? `${m} min` : `${Math.floor(m/60)} h ${m%60} min`; };
const iso = () => new Date().toISOString();
const slug = s => String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"").slice(0,24) || "rol";

/* ---------- datos del juego ---------- */
const TYPES = {
  zvz:      {label:"ZvZ / Territorios", desc:"Peleas grandes, castillos, territorios", mods:{deaths:true, regear:true,  loot:false}},
  dungeon:  {label:"Dungeon de grupo",  desc:"Dungeons, estáticas, corrupta en grupo",  mods:{deaths:true, regear:false, loot:true}},
  avalon:   {label:"Avalon",            desc:"Caminos de Avalon, dungeons avalonianas", mods:{deaths:true, regear:false, loot:true}},
  gank:     {label:"Gank / Roaming",    desc:"Salidas a cazar en zona roja o negra",    mods:{deaths:true, regear:false, loot:true}},
  hce:      {label:"HCE / Mists",       desc:"Expediciones y Las Brumas",               mods:{deaths:true, regear:false, loot:true}},
  gather:   {label:"Recolección",       desc:"Grupo de gathering con escolta",          mods:{deaths:false,regear:false, loot:true}},
  transport:{label:"Transporte",        desc:"Mover material o loot entre ciudades",    mods:{deaths:true, regear:true,  loot:false}},
  other:    {label:"Otro",              desc:"Cualquier otra actividad",                mods:{deaths:true, regear:false, loot:false}},
};
const MODS = {
  deaths: {label:"Registrar muertes",       desc:"El servidor revisa el killboard de cada integrante mientras el grupo está activo."},
  regear: {label:"Reequipamiento (regear)", desc:"Calcula cuánto devolver por cada muerte según las reglas y el rol de cada uno."},
  loot:   {label:"Repartir loot",           desc:"Al finalizar, reparte el valor del cofre entre los participantes."},
};
const SLOTS = {MainHand:"Arma",OffHand:"Secundaria",Head:"Casco",Armor:"Armadura",Shoes:"Botas",Cape:"Capa",Bag:"Bolsa",Mount:"Montura",Potion:"Poción",Food:"Comida"};
const QUAL = {1:"Normal",2:"Buena",3:"Notable",4:"Excelente",5:"Obra maestra"};
const PRICE_CITIES = ["Bridgewatch","Fort Sterling","Lymhurst","Martlock","Thetford","Caerleon","Brecilien"];
const SERVERS = {west:"Americas", europe:"Europe", east:"Asia"};
const STATUS_PILL = {pendiente:"p-pend", aprobado:"p-ok", rechazado:"p-no", pagado:"p-paid"};
// Jerarquía: el administrador tiene acceso total; el resto, según los permisos de su tipo de usuario.
const PERMS = [
  {key:"groups.view",      label:"Ver grupos, unirse y hacer reclamos"},
  {key:"groups.manage",    label:"Crear, editar y disolver grupos; loot", staff:true},
  {key:"regear.approve",   label:"Aprobar reequipamiento", staff:true},
  {key:"disputes.resolve", label:"Responder reclamos", staff:true},
  {key:"users.manage",     label:"Aprobar, bloquear y cambiar tipo de usuarios", staff:true},
  {key:"audit.view",       label:"Ver el registro", staff:true},
  {key:"tool.refining",    label:"Calculadora de materiales"},
  {key:"tool.transport",   label:"Planificador de viajes"},
  {key:"tool.routes",      label:"Rutas por el mapa"},
  {key:"avalon.edit",      label:"Anotar caminos de Avalon"},
];
const STAFF = new Set(PERMS.filter(x => x.staff).map(x => x.key));
const SPECIAL = {admin:"Administrador", pendiente:"Pendiente", bloqueado:"Bloqueado"};
const roleLabel = k => SPECIAL[k] || ((ST.types||[]).find(t => t.key === k) || {}).name || k;
const rolePill = k => k==="admin" ? "p-ok" : k==="pendiente" ? "p-pend" : k==="bloqueado" ? "p-no" : "p-paid";
const typePerms = k => ((ST.types||[]).find(t => t.key === k) || {}).perms || [];
const parseItem = type => { const m = /^T(\d)_(.+?)(?:@(\d))?$/.exec(type||""); return m ? {tier:+m[1], ench:+(m[3]||0), base:m[2]} : {tier:0, ench:0, base:type}; };
const itemTag = type => { const p = parseItem(type); return p.tier ? `T${p.tier}${p.ench?"."+p.ench:""}` : ""; };
const prettyBase = b => (b||"").replace(/_/g," ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const icon = (type, q) => `https://render.albiononline.com/v1/item/${encodeURIComponent(type)}.png?quality=${q||1}&size=64`;
const DISCORD_SVG = `<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.3 4.4A19.6 19.6 0 0 0 15.4 3l-.6 1.3a18 18 0 0 0-5.6 0L8.6 3a19.5 19.5 0 0 0-4.9 1.5C.6 9.1-.3 13.6.1 18.1a19.8 19.8 0 0 0 6 3l1.3-2.1a12.8 12.8 0 0 1-2-1l.5-.4a14.1 14.1 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.7 19.7 0 0 0 6-3c.5-5.2-.8-9.7-3.6-13.7ZM8 15.4c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z"/></svg>`;
const CREST = `<svg class="crest" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#1b222b"/><path d="M32 9l19 8-2 20-17 18-17-18-2-20z" fill="#e0a640"/><path d="M32 17l12 5-1.5 13L32 47 21.5 35 20 22z" fill="#1b222b"/><rect x="30" y="20" width="4" height="22" fill="#e0a640"/><rect x="24" y="27" width="16" height="4" fill="#e0a640"/></svg>`;

// Rol de grupo (tanque, sanador…) configurado por el administrador
const partyRoles = () => (ST.settings && ST.settings.party_roles) || [];
const roleName = k => (partyRoles().find(r => r.key === k) || {}).name || (k ? k : "Sin rol");
const roleCfg = k => partyRoles().find(r => r.key === k) || {};
const roleOptions = (cur, emptyLabel="Sin rol") => `<option value="">${emptyLabel}</option>` + partyRoles().map(r => `<option value="${esc(r.key)}" ${r.key===cur?"selected":""}>${esc(r.name)}</option>`).join("");

// Base del regear (sin % del rol ni topes: eso lo aplica la base de datos)
function evalRegear(items, R){
  const flags = []; let value = 0;
  items.forEach(it => {
    let ok = it.slot==="Mount" ? !!R.mount : it.slot==="Bag" ? !!R.bag : (it.slot==="Potion"||it.slot==="Food") ? !!R.consumables : true;
    const p = parseItem(it.type);
    if (ok && R.maxEquiv && p.tier && p.tier + p.ench > R.maxEquiv) { ok = false; flags.push(`${SLOTS[it.slot]} ${itemTag(it.type)} supera el máximo (${R.maxEquiv}.0 equivalente)`); }
    it.covered = ok;
    const price = it.manual ?? it.price ?? 0;
    if (ok) { value += price * (it.count||1); if (!price) flags.push(`${SLOTS[it.slot]} sin precio: escríbelo a mano`); }
  });
  return {regear_base:Math.round(value), flags};
}

/* ---------- capa de datos (Supabase) ---------- */
const CFG = window.GREMIO_CONFIG || {};
const configured = CFG.supabaseUrl && !/TU_PROYECTO/.test(CFG.supabaseUrl) && CFG.supabaseKey && !/PEGA_AQUI/.test(CFG.supabaseKey);
function realData(){
  const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, {auth:{flowType:"pkce", persistSession:true, autoRefreshToken:true, detectSessionInUrl:true}});
  const ck = ({data, error}) => { if (error) throw new Error(error.message); return data; };
  // El permiso de Discord (provider_token) solo llega en el evento de inicio de sesión: Supabase no lo guarda
  // en la sesión. Se captura aquí, se guarda solo en esta pestaña y se borra apenas se usa.
  const TK = "gremioDiscordTok";
  let providerTok = null; try { providerTok = sessionStorage.getItem(TK); } catch(_){}
  sb.auth.onAuthStateChange((e, s) => {
    if (s && s.provider_token) { providerTok = s.provider_token; try { sessionStorage.setItem(TK, providerTok); } catch(_){} }
    if (e === "SIGNED_OUT") { providerTok = null; try { sessionStorage.removeItem(TK); } catch(_){} }
  });
  return {
    providerToken(){ return providerTok; },
    forgetProviderToken(){ providerTok = null; try { sessionStorage.removeItem(TK); } catch(_){} },
    async session(){ const {data} = await sb.auth.getSession(); return data.session; },
    signIn(){ return sb.auth.signInWithOAuth({provider:"discord", options:{scopes:"identify email guilds", redirectTo: location.origin + location.pathname}}); },
    signOut(){ return sb.auth.signOut(); },
    onAuth(cb){ sb.auth.onAuthStateChange((_e, s) => cb(s)); },
    async me(uid){ return ck(await sb.from("profiles").select("*").eq("id", uid).single()); },
    async settings(){ return ck(await sb.from("settings").select("*").eq("id", 1).single()); },
    async saveSettings(p){ ck(await sb.from("settings").update({...p, updated_at:iso()}).eq("id", 1)); },
    async fn(action, payload={}){
      const {data, error} = await sb.functions.invoke("albion", {body:{action, ...payload}});
      if (error) { let msg = error.message; try { const j = await error.context.json(); msg = j.error || msg; } catch(_){} throw new Error(msg); }
      if (data && data.error) throw new Error(data.error);
      return data;
    },
    async groups(){ return ck(await sb.from("groups").select("*, group_members(count), deaths(count)").order("started_at", {ascending:false}).limit(200)); },
    async myGroups(uid){ return ck(await sb.from("group_members").select("group_id").eq("profile_id", uid)).map(r => r.group_id); },
    async groupFull(id){
      const [g, m, d, x] = await Promise.all([
        sb.from("groups").select("*").eq("id", id).single(),
        sb.from("group_members").select("*").eq("group_id", id).order("albion_name"),
        sb.from("deaths").select("*").eq("group_id", id).order("time", {ascending:false}),
        sb.from("disputes").select("*").eq("group_id", id).order("created_at", {ascending:false}),
      ]);
      return {group:ck(g), members:ck(m), deaths:ck(d), disputes:ck(x)};
    },
    async groupByCode(code){ return ck(await sb.from("groups").select("id,name,type,status,composition").eq("code", code.toUpperCase()).maybeSingle()); },
    async createGroup(g, members){ const row = ck(await sb.from("groups").insert(g).select().single()); if (members.length) ck(await sb.from("group_members").insert(members.map(m => ({...m, group_id:row.id})))); return row; },
    async updateGroup(id, p){ ck(await sb.from("groups").update(p).eq("id", id)); },
    async deleteGroup(id){ ck(await sb.from("groups").delete().eq("id", id)); },
    async addMember(row){ ck(await sb.from("group_members").upsert(row)); },
    async updateMember(gid, aid, p){ ck(await sb.from("group_members").update(p).eq("group_id", gid).eq("albion_id", aid)); },
    async updateDeath(gid, eid, p){ ck(await sb.from("deaths").update(p).eq("group_id", gid).eq("event_id", eid)); },
    async join(code, role){ return ck(await sb.rpc("join_group", {p_code:code, p_role:role||null})); },
    async setMyRole(gid, role){ ck(await sb.rpc("set_my_party_role", {p_group:gid, p_role:role||null})); },
    async confirm(gid){ ck(await sb.rpc("confirm_group", {p_group:gid})); },
    async received(gid){ ck(await sb.rpc("mark_received", {p_group:gid})); },
    async addDispute(row){ ck(await sb.from("disputes").insert(row)); },
    async updateDispute(id, p){ ck(await sb.from("disputes").update(p).eq("id", id)); },
    async profiles(){ return ck(await sb.from("profiles").select("*").order("created_at")); },
    async setRole(id, role){ ck(await sb.rpc("set_role", {p_target:id, p_role:role})); },
    async userTypes(){ return ck(await sb.from("user_types").select("*").order("sort").order("name")); },
    async saveType(row){ ck(await sb.from("user_types").upsert(row)); },
    async deleteType(key){ ck(await sb.from("user_types").delete().eq("key", key)); },
    async unlink(id){ ck(await sb.rpc("unlink_character", {p_target:id})); },
    async touch(){ try { await sb.rpc("touch_seen"); } catch(_){} },
    async audit(){ return ck(await sb.from("audit").select("*").order("id", {ascending:false}).limit(300)); },
    subscribe(cb){ sb.channel("cambios").on("postgres_changes", {event:"*", schema:"public"}, cb).subscribe(); },
  };
}
const DATA = window.__GREMIO_MOCK || (configured ? realData() : null);

/* ---------- estado y permisos ---------- */
const ST = {session:null, me:null, settings:null, profiles:[], groups:[], myGroups:[], cur:null, gtab:"members", msg:{}, confirm:null, draft:null, search:null, synced:false, discordGuilds:null, audit:null, memFilter:"todos"};
// Mismas reglas que la base de datos (la base de datos es la que manda)
function can(perm, me = ST.me){
  const s = ST.settings || {};
  if (!me || me.role === "bloqueado" || me.role === "pendiente") return false;
  const base = (!s.require_discord_server || me.discord_in_server) && (!s.require_mfa_all || me.discord_mfa);
  const ok = STAFF.has(perm) ? base && (!s.require_mfa_staff || me.discord_mfa) : base;
  if (me.role === "admin") return ok;
  const P = typePerms(me.role);
  return ok && (P.includes(perm) || (perm === "groups.view" && P.includes("groups.manage")));
}
function access(){
  const me = ST.me, s = ST.settings || {};
  const staffMfa = !me || !s.require_mfa_staff || me.discord_mfa;
  const isStaff = !!me && (me.role === "admin" || typePerms(me.role).some(x => STAFF.has(x)));
  return {member: can("groups.view"), officer: can("groups.manage"), admin: isAdmin(), staffMfa, isStaff,
    any: !!me && (me.role === "admin" || PERMS.some(x => can(x.key)))};
}
const isAdmin = () => { const me = ST.me, s = ST.settings || {}; return !!me && me.role === "admin" && can("groups.view") && (!s.require_mfa_staff || me.discord_mfa); };
const isOfficer = () => can("groups.manage");
const isMember = () => can("groups.view");
const hasAccess = () => access().any;
const TOOLS = {
  refining:  {label:"Calculadora de materiales", short:"Calculadora", page:"refineria.html", desc:"Refinado desde el tier más bajo: materiales, presupuesto, retorno, foco y ganancia."},
  transport: {label:"Planificador de viajes",    short:"Viajes",      page:"viajes.html",    desc:"Qué llevar, cuántos viajes, ganancia y riesgo de la ruta."},
  routes:    {label:"Rutas por el mapa",         short:"Rutas",       page:"rutas.html",     desc:"El camino entre dos mapas con el color de cada zona, y un paso a paso para ir marcando."},
};
const canUseTool = t => can("tool." + t);
// ¿Puede la persona actual cambiarle el tipo a esta cuenta?
const canManageUser = p => p.id !== ST.me.id && can("users.manage") && (isAdmin() || (p.role !== "admin" && !typePerms(p.role).includes("users.manage")));
const profName = id => { const p = ST.profiles.find(x => x.id === id); return p ? (p.albion_name || p.discord_name) : "Alguien"; };
function route(){ const h = location.hash.replace(/^#\/?/, "").split("/"); return {name:h[0] || "", arg:decodeURIComponent(h[1] || "")}; }
function go(h){ if (location.hash === h) onRoute(); else location.hash = h; }
function flash(where, t, k="ok"){ ST.msg[where] = {t, k}; render(); }
const msgBox = where => ST.msg[where] ? `<div class="status ${ST.msg[where].k}" role="status">${esc(ST.msg[where].t)}</div>` : "";

/* ---------- cálculo del loot ---------- */
function lootCalc(g, members, deaths){
  const L = g.loot || {};
  const gross = (+L.chest||0) + (+L.silver||0);
  const regearPaid = L.deductRegear ? deaths.filter(d => d.status==="aprobado"||d.status==="pagado").reduce((a,d) => a + (+d.regear||0), 0) : 0;
  const afterCosts = Math.max(0, gross - (+L.repairs||0) - regearPaid);
  const guildCut = afterCosts * (+L.guildPct||0) / 100;
  const pool = afterCosts - guildCut;
  const start = ts(g.started_at), end = g.ended_at ? ts(g.ended_at) : Date.now();
  const people = members.filter(m => !m.excluded).map(m => ({m, ms: Math.max(0, Math.min(end, m.left_at ? ts(m.left_at) : end) - Math.max(start, ts(m.joined_at))),
    w: L.method==="role" ? Math.max(0, +(roleCfg(m.party_role).lootWeight ?? 1)) : 1}));
  const rnd = +L.round||0;
  const totalMs = people.reduce((a,p) => a + p.ms, 0) || 1, totalW = people.reduce((a,p) => a + p.w, 0) || 1;
  people.forEach(p => {
    const raw = L.method==="time" ? pool * p.ms / totalMs : L.method==="role" ? pool * p.w / totalW : pool / (people.length||1);
    p.share = rnd ? Math.floor(raw/rnd)*rnd : Math.floor(raw);
  });
  const leftover = pool - people.reduce((a,p) => a + p.share, 0);
  return {gross, regearPaid, afterCosts, guildCut, pool, people, leftover};
}
function compCalc(g, members){
  const active = members.filter(m => !m.left_at);
  const comp = (g.composition || []).filter(c => +c.count > 0);
  const counts = {}; active.forEach(m => counts[m.party_role||""] = (counts[m.party_role||""]||0) + 1);
  const rows = comp.map(c => ({...c, have: counts[c.role]||0}));
  const extra = Object.entries(counts).filter(([k]) => !comp.some(c => c.role===k)).map(([k,n]) => ({role:k, count:0, have:n}));
  return {rows, extra, total: active.length, target: comp.reduce((a,c) => a + (+c.count||0), 0)};
}
function summaryText(C){
  const {group:g, members, deaths} = C;
  const L = [`**${g.name}** — ${(TYPES[g.type]||TYPES.other).label}`, `Inicio ${hhmm(g.started_at)} · ${g.ended_at ? "Fin " + hhmm(g.ended_at) : "en curso"} · ${members.length} integrantes`];
  const cc = compCalc(g, members);
  if (cc.rows.length) L.push("Composición: " + cc.rows.map(r => `${roleName(r.role)} ${r.have}/${r.count}`).join(" · "));
  L.push("", "Integrantes:"); members.forEach(m => L.push(`- ${m.albion_name}${m.party_role?` (${roleName(m.party_role)})`:""}`));
  if (g.mods.deaths) {
    L.push("", `Muertes: ${deaths.length}`);
    deaths.slice().reverse().forEach(d => L.push(`- ${hhmm(d.time)} ${d.name}${d.party_role?` (${roleName(d.party_role)})`:""} por ${d.killer}${d.killer_guild?` [${d.killer_guild}]`:""}${g.mods.regear?` → regear ${fmt(d.regear)} · ${d.status}`:""}`));
  }
  if (g.mods.regear) {
    const per = {}; deaths.filter(d => d.status!=="rechazado").forEach(d => per[d.name] = (per[d.name]||0) + (+d.regear||0));
    L.push("", `Reequipamiento total: ${fmt(Object.values(per).reduce((a,b)=>a+b,0))}`); Object.entries(per).forEach(([n,v]) => L.push(`- ${n}: ${fmt(v)}`));
  }
  if (g.mods.loot) {
    const c = lootCalc(g, members, deaths);
    L.push("", `Cofre: ${fmt(+g.loot.chest||0)} · reparaciones ${fmt(+g.loot.repairs||0)}${c.regearPaid?` · regear ${fmt(c.regearPaid)}`:""} · gremio ${fmt(c.guildCut)}`, `A repartir: ${fmt(c.pool)}${g.loot.method==="role"?" (según rol)":g.loot.method==="time"?" (según tiempo)":""}`);
    if (!g.loot.method || g.loot.method === "equal") L.push(`Cada uno (${c.people.length}): ${fmt(c.people[0] ? c.people[0].share : 0)}`);
    c.people.forEach(p => L.push(`- ${p.m.albion_name}: ${fmt(p.share)}${p.m.received_at ? " ✓ recibido" : ""}`));
    if (c.leftover >= 1) L.push(`Sobrante por redondeo: ${fmt(c.leftover)}`);
  }
  return L.join("\n");
}

/* ================= RENDER ================= */
const DONATION_RE = /^https:\/\/(www\.)?(paypal\.me|paypal\.com|ko-fi\.com|buymeacoffee\.com)\/[A-Za-z0-9_./?=&%-]{1,200}$/;
const DISCLAIMER = "Herramienta de fans, gratuita y no oficial. No está afiliada ni respaldada por Sandbox Interactive GmbH. Albion Online es una marca registrada de Sandbox Interactive GmbH.";
function renderFoot(){
  const s = ST.settings || {};
  const show = ST.session && s.donation_enabled && DONATION_RE.test(s.donation_url || "");
  $("#foot").innerHTML = (show ? `<a class="donate" href="${esc(s.donation_url)}" target="_blank" rel="noopener noreferrer">Apoyar el sitio</a>
    <p>${esc(s.donation_note || "Aporte voluntario para cubrir el hosting.")} Es opcional: no da beneficios, funciones extra ni nada dentro del juego.</p>` : "") + `<p>${DISCLAIMER}</p>`;
}
function renderTop(){
  const show = !!(ST.session && ST.me);
  $("#top").hidden = !show;
  if (!show) return;
  const r = route().name, A = access();
  const pending = can("users.manage") ? ST.profiles.filter(p => p.role==="pendiente" && p.albion_id).length : 0;
  $("#nav").innerHTML = A.any ? [
    `<a class="tab" href="#/" aria-selected="${r===""||r==="g"}">${A.member ? "Grupos" : "Inicio"}</a>`,
    A.officer ? `<a class="tab" href="#/nuevo" aria-selected="${r==="nuevo"}">Nuevo grupo</a>` : "",
    A.member ? `<a class="tab" href="#/unirse" aria-selected="${r==="unirse"}">Unirme</a>` : "",
    can("users.manage") ? `<a class="tab" href="#/miembros" aria-selected="${r==="miembros"}">Usuarios${pending?`<span class="badge">${pending}</span>`:""}</a>` : "",
    can("audit.view") ? `<a class="tab" href="#/registro" aria-selected="${r==="registro"}">Registro</a>` : "",
    ...Object.entries(TOOLS).filter(([k]) => canUseTool(k)).map(([k,t]) => `<a class="tab" href="${t.page}">${t.short}</a>`),
    A.admin ? `<a class="tab" href="#/ajustes" aria-selected="${r==="ajustes"}">Ajustes</a>` : "",
  ].join("") : "";
  const me = ST.me;
  $("#me").innerHTML = `${me.avatar_url?`<img src="${esc(me.avatar_url)}" alt="">`:""}<span><b>${esc(me.albion_name || me.discord_name)}</b> <span class="pill ${rolePill(me.role)}">${roleLabel(me.role)}</span><br><a href="#/perfil" class="muted">Mi cuenta</a> · <a href="#" data-act="signOut" class="muted">Salir</a></span>`;
}
function loginScreen(extra=""){
  return `<div class="login"><div class="card">${CREST}
    <h1>Gremio <span style="color:var(--accent)">Albion</span></h1>
    <p class="muted" style="margin:0">Grupos, muertes, reequipamiento y reparto de loot del gremio.</p>
    <button class="btn discord" data-act="signIn">${DISCORD_SVG}<span>Entrar con Discord</span></button>
    ${extra}
    <p class="fine">Solo se usa tu cuenta de Discord: aquí no hay contraseñas. Para proteger tu cuenta, activa la verificación en dos pasos en Discord (Ajustes de usuario → Mi cuenta).</p>
  </div></div>`;
}
const gate = (title, body) => `<section class="panel" style="max-width:560px;margin:8vh auto 0;text-align:center;align-items:center">${CREST.replace('class="crest"','class="crest" style="width:56px;height:56px"')}<h1>${title}</h1>${body}</section>`;
function render(){
  renderTop(); renderFoot();
  const app = $("#app"), A = access(), S = ST.settings || {}, me = ST.me;
  if (!DATA) { app.innerHTML = loginScreen(`<div class="status warn">La página aún no está configurada: falta editar <b>config.js</b>.</div>`); return bind(); }
  if (!ST.session) { app.innerHTML = loginScreen(msgBox("auth")); return bind(); }
  if (!me) { app.innerHTML = gate("Cargando tu cuenta…", ""); return bind(); }
  const r = route();
  if (me.role === "bloqueado") { app.innerHTML = gate("Acceso bloqueado", `<p>Se bloqueó el acceso de esta cuenta. Si crees que es un error, habla con el administrador por Discord.</p><button class="btn plain" data-act="signOut">Salir</button>`); return bind(); }
  if (!me.discord_checked_at) { app.innerHTML = gate("Verificando tu cuenta de Discord", `<p>${ST.synced ? "No pude verificar tu cuenta. Vuelve a entrar y acepta los permisos que pide Discord." : "Un momento…"}</p>${ST.synced?`<button class="btn discord" data-act="reauth">${DISCORD_SVG}<span>Volver a entrar</span></button>`:""}${msgBox("auth")}`); return bind(); }
  if (S.require_discord_server && !me.discord_in_server) { app.innerHTML = gate("Solo miembros del Discord", `<p>Para entrar tienes que estar en el servidor de Discord <b>${esc(S.discord_server_name || "del gremio")}</b>. Únete y vuelve a entrar.</p><button class="btn discord" data-act="reauth">${DISCORD_SVG}<span>Ya me uní, volver a entrar</span></button>`); return bind(); }
  if (S.require_mfa_all && !me.discord_mfa) { app.innerHTML = gate("Activa la verificación en dos pasos", `<p>El gremio pide que tu cuenta de Discord tenga verificación en dos pasos. Actívala en Discord (Ajustes de usuario → Mi cuenta) y vuelve a entrar.</p><button class="btn discord" data-act="reauth">${DISCORD_SVG}<span>Ya la activé, volver a entrar</span></button>`); return bind(); }
  if (!me.albion_id || r.name==="perfil") { app.innerHTML = viewLink(); return bind(); }
  if (!A.any) { app.innerHTML = gate("Esperando aprobación", `<p>Vinculaste a <b>${esc(me.albion_name)}</b>${me.albion_guild?` (${esc(me.albion_guild)})`:""}. Quien gestiona los usuarios tiene que aprobarte antes de que puedas entrar.</p><a class="btn plain" href="#/perfil">Ver mi cuenta</a>`); return bind(); }
  const banner = A.isStaff && !A.staffMfa ? `<div class="banner"><b>Tus permisos de gestión están en pausa.</b> Se exige verificación en dos pasos en Discord para quienes gestionan. Actívala en Discord y <a href="#" data-act="reauth">vuelve a entrar</a>.</div>` : "";
  let v;
  if (r.name==="g" && A.member) v = viewGroup();
  else if (r.name==="nuevo" && A.officer) v = viewCreate();
  else if (r.name==="unirse" && A.member) v = viewJoin(r.arg);
  else if (r.name==="miembros" && can("users.manage")) v = viewMembers();
  else if (r.name==="registro" && can("audit.view")) v = viewAudit();
  else if (r.name==="ajustes" && A.admin) v = viewSettings();
  else v = viewGroups();
  const conf = ST.confirm ? `<div class="status warn" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between"><span>${esc(ST.confirm.text)}</span><span class="row"><button class="btn sm plain" data-act="confirmNo">Cancelar</button><button class="btn sm danger" data-act="confirmYes">${esc(ST.confirm.ok)}</button></span></div>` : "";
  app.innerHTML = banner + conf + v;
  bind();
}

/* ---- mi cuenta / vincular personaje ---- */
function viewLink(){
  const S = ST.search || {}, me = ST.me, s = ST.settings || {};
  return `<section class="panel" style="max-width:640px;margin:0 auto;width:100%">
    <h1>${me.albion_id ? "Mi cuenta" : "Vincula tu personaje"}</h1>
    ${me.albion_id ? `<div class="tablewrap"><table><tbody>
      <tr><td>Discord</td><td><b>${esc(me.discord_name)}</b></td></tr>
      <tr><td>Personaje</td><td><b>${esc(me.albion_name)}</b> ${me.albion_guild?`(${esc(me.albion_guild)})`:""}</td></tr>
      <tr><td>Tipo de usuario</td><td><span class="pill ${rolePill(me.role)}">${roleLabel(me.role)}</span></td></tr>
      <tr><td>Verificación en dos pasos en Discord</td><td>${me.discord_mfa?'<span class="yes">Activada</span>':'<span class="no">Desactivada</span> — actívala en Discord para proteger tu cuenta'}</td></tr>
      ${s.discord_server_id?`<tr><td>En el servidor de Discord</td><td>${me.discord_in_server?'<span class="yes">Sí</span>':'<span class="no">No</span>'}</td></tr>`:""}
      <tr><td>Última verificación</td><td>${hhmm(me.discord_checked_at)}</td></tr>
    </tbody></table></div>
    <h2>Cambiar personaje</h2>` : ""}
    <p class="hint">Busca tu personaje de Albion (servidor ${SERVERS[s.server]||"Americas"}).${me.albion_id && me.role!=="admin" ? " Si lo cambias, quizás tengan que aprobarte otra vez." : ""}</p>
    <div class="row"><div class="field"><label for="lk_q">Nombre del personaje</label><input type="text" id="lk_q" value="${esc(S.q||"")}" placeholder="Nombre exacto" autocomplete="off"></div><button class="btn" data-act="linkSearch">Buscar</button></div>
    ${S.players ? (S.players.length ? `<div class="list">${S.players.map(p => `<div class="li"><button class="btn sm" data-link="${esc(p.Id)}">Es mío</button> <b>${esc(p.Name)}</b><small>${esc(p.GuildName||"sin gremio")}</small></div>`).join("")}</div>` : `<div class="status warn">No encontré personajes con ese nombre.</div>`) : ""}
    ${msgBox("link")}
    ${me.albion_id ? `<a class="btn plain" href="#/">Volver</a>` : ""}
  </section>`;
}

/* ---- lista de grupos ---- */
function groupCard(g){
  const active = g.status==="active", mine = ST.myGroups.includes(g.id);
  const nm = (g.group_members && g.group_members[0] && g.group_members[0].count) || 0, nd = (g.deaths && g.deaths[0] && g.deaths[0].count) || 0;
  const target = (g.composition||[]).reduce((a,c) => a + (+c.count||0), 0);
  return `<a class="gcard" href="#/g/${esc(g.id)}">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b>${esc(g.name)}</b><span class="pill ${active?"p-active":"p-closed"}">${active?"Activo":"Disuelto"}</span></div>
    <span class="muted">${esc((TYPES[g.type]||TYPES.other).label)} · ${nm}${target?`/${target}`:""} integrantes${mine?" · <b>participas</b>":""}</span>
    <span class="muted">${hhmm(g.started_at)}${g.ended_at?" → "+hhmm(g.ended_at):` · ${dur(Date.now()-ts(g.started_at))}`}</span>
    ${g.mods.deaths?`<span>${nd} muertes</span>`:""}
  </a>`;
}
function viewGroups(){
  const act = ST.groups.filter(g => g.status==="active"), old = ST.groups.filter(g => g.status!=="active");
  const tools = Object.entries(TOOLS).filter(([k]) => canUseTool(k));
  if (!isMember()) return tools.length ? `<section class="panel"><h2>Herramientas</h2><div class="cards">${tools.map(([k,t]) => `<a class="gcard" href="${t.page}"><b>${t.label}</b><span class="muted">${t.desc}</span></a>`).join("")}</div></section>` : `<div class="empty">Tu tipo de usuario no tiene secciones habilitadas todavía.</div>`;
  return `${tools.length ? `<section class="panel"><h2>Herramientas</h2><div class="cards">${tools.map(([k,t]) => `<a class="gcard" href="${t.page}"><b>${t.label}</b><span class="muted">${t.desc}</span></a>`).join("")}</div></section>` : ""}
  <div class="ghead"><h1>Grupos</h1><div class="row">${isOfficer()?`<a class="btn" href="#/nuevo">+ Nuevo grupo</a>`:""}<a class="btn ghost" href="#/unirse">Unirme con código</a></div></div>
  <section class="panel"><h2>Activos</h2>${act.length?`<div class="cards">${act.map(groupCard).join("")}</div>`:`<div class="empty">No hay grupos activos.${isOfficer()?" Crea uno antes de salir al contenido.":" Cuando un oficial cree uno, aparecerá aquí."}</div>`}</section>
  <section class="panel"><h2>Historial</h2>${old.length?`<div class="cards">${old.map(groupCard).join("")}</div>`:`<div class="empty">Aquí quedan los grupos disueltos.</div>`}</section>`;
}

/* ---- unirse ---- */
function viewJoin(code){
  const J = ST.join || {}, g = J.group;
  const cc = g ? compCalc(g, J.members || []) : null;
  return `<section class="panel" style="max-width:560px;margin:0 auto;width:100%"><h1>Unirme a un grupo</h1>
    <p class="hint">Te unirás como <b>${esc(ST.me.albion_name)}</b>. Tus muertes cuentan desde este momento.</p>
    <div class="row"><div class="field"><label for="j_code">Código</label><input type="text" id="j_code" value="${esc(code)}" placeholder="Ej: A1B2C3" style="text-transform:uppercase;font-family:var(--f-num);font-size:1.2rem" autocomplete="off"></div><button class="btn ghost" data-act="joinLook">Ver grupo</button></div>
    ${g ? `<div class="quick"><b>${esc(g.name)}</b><span class="muted">${esc((TYPES[g.type]||TYPES.other).label)}${g.status!=="active"?" · disuelto":""}</span>
      ${cc.rows.length ? `<span class="lbl">Composición buscada</span><div class="comp">${cc.rows.map(r => `<div class="c ${r.have>=r.count?"ok":"miss"}"><small>${esc(roleName(r.role))}</small><b>${r.have}/${r.count}</b>${r.note?`<small>${esc(r.note)}</small>`:""}</div>`).join("")}</div>` : ""}</div>` : ""}
    <div class="field"><label for="j_role">Tu rol en el grupo</label><select id="j_role">${roleOptions(J.role, "Elegir después")}</select></div>
    <div class="row"><button class="btn" data-act="join">Unirme</button></div>
    ${msgBox("join")}</section>`;
}

/* ---- crear grupo (oficial) ---- */
function newDraft(){ return {name:"", type:"zvz", mods:{...TYPES.zvz.mods}, roster:null, filter:"", selected:{}, roles:{}, extra:[], pq:"", players:null, comp:{}}; }
function viewCreate(){
  const D = ST.draft ||= newDraft(), S = ST.settings||{};
  const sel = Object.values(D.selected).concat(D.extra);
  const roster = (D.roster||[]).filter(p => !D.filter || p.Name.toLowerCase().includes(D.filter.toLowerCase()));
  return `<h1>Nuevo grupo</h1>
  <section class="panel"><h2>1 · Qué van a hacer</h2>
    <div class="field"><label for="d_name">Nombre del grupo</label><input type="text" id="d_name" value="${esc(D.name)}" placeholder="Ej: ZvZ domingo 21:00" maxlength="80"></div>
    <span class="lbl">Tipo de contenido</span>
    <div class="types">${Object.entries(TYPES).map(([k,t]) => `<button type="button" class="type" data-type="${k}" aria-pressed="${D.type===k}"><b>${t.label}</b><small>${t.desc}</small></button>`).join("")}</div>
    <span class="lbl">Qué quieres que haga la app</span>
    <div class="mods">${Object.entries(MODS).map(([k,m]) => `<label class="mod"><input type="checkbox" data-mod="${k}" ${D.mods[k]?"checked":""}><span><b>${m.label}</b><small>${m.desc}</small></span></label>`).join("")}</div>
  </section>
  <section class="panel"><h2>2 · Composición (opcional)</h2>
    <p class="hint">Cuántos necesitas de cada rol. Los participantes ven qué falta al unirse.</p>
    <div class="tablewrap"><table><thead><tr><th>Rol</th><th class="n">Cantidad</th><th>Nota (build, arma, IP mínimo…)</th></tr></thead><tbody>
      ${partyRoles().map(r => { const c = D.comp[r.key] || {}; return `<tr><td>${esc(r.name)}</td><td class="n"><input type="number" min="0" max="300" style="max-width:80px" data-comp="${esc(r.key)}:count" value="${c.count||""}" placeholder="0"></td><td><input type="text" maxlength="80" data-comp="${esc(r.key)}:note" value="${esc(c.note||"")}"></td></tr>`; }).join("")}
    </tbody></table></div>
  </section>
  <section class="panel"><h2>3 · Quiénes van</h2>
    <p class="hint">Puedes marcarlos aquí o dejar que cada uno se una con el código del grupo y elija su rol.</p>
    ${S.guild_id ? (D.roster ? `
      <div class="row"><span>Gremio <b>${esc(S.guild_name)}</b> · ${D.roster.length} miembros</span></div>
      <div class="row"><div class="field"><label for="d_filter">Filtrar miembros</label><input type="text" id="d_filter" value="${esc(D.filter)}" placeholder="Parte del nombre"></div>
      <button class="btn sm ghost" data-act="selAll">Marcar visibles</button><button class="btn sm ghost" data-act="selNone">Desmarcar todos</button></div>
      <div class="list">${roster.map(p => `<label><input type="checkbox" data-pick="${esc(p.Id)}" ${D.selected[p.Id]?"checked":""}> ${esc(p.Name)}</label>`).join("") || `<div class="empty">Sin resultados.</div>`}</div>`
      : `<div class="row"><button class="btn" data-act="loadRoster">Cargar miembros de ${esc(S.guild_name)}</button></div>`)
      : `<div class="status warn">El administrador debe configurar el gremio en Ajustes para poder elegir de la lista de miembros.</div>`}
    <div class="row"><div class="field"><label for="d_pq">Agregar jugador por nombre (aliados u otros gremios)</label><input type="text" id="d_pq" value="${esc(D.pq)}" placeholder="Nombre del personaje"></div><button class="btn ghost" data-act="draftSearch">Buscar</button></div>
    ${D.players ? `<div class="list">${D.players.map(p => `<div class="li"><button class="btn sm" data-addplayer="${esc(p.Id)}">Agregar</button> ${esc(p.Name)}<small>${esc(p.GuildName||"sin gremio")}</small></div>`).join("") || `<div class="empty">Sin resultados.</div>`}</div>` : ""}
    ${msgBox("create")}
    <span class="lbl">Seleccionados (${sel.length}) y su rol</span>
    ${sel.length ? `<div class="tablewrap"><table><tbody>${sel.map(p => `<tr><td>${esc(p.Name)}</td><td><select class="mini" data-prole="${esc(p.Id)}" aria-label="Rol de ${esc(p.Name)}">${roleOptions(D.roles[p.Id])}</select></td><td class="n"><button class="btn sm plain" data-unpick="${esc(p.Id)}" title="Quitar">×</button></td></tr>`).join("")}</tbody></table></div>` : `<span class="hint">Nadie todavía. También pueden unirse con el código.</span>`}
  </section>
  <div class="row" style="justify-content:flex-end"><button class="btn plain" data-act="resetDraft">Limpiar</button><button class="btn" data-act="createGroup">Crear e iniciar grupo</button></div>`;
}

/* ---- usuarios (quien gestiona usuarios) ---- */
function roleOptionsFor(p){
  const types = (ST.types||[]).filter(t => isAdmin() || !t.perms.includes("users.manage")).map(t => t.key);
  return [...(isAdmin() ? ["admin"] : []), ...types, "pendiente", "bloqueado"];
}
function roleSelect(p){
  if (p.id === ST.me.id) return `<span class="pill ${rolePill(p.role)}">${esc(roleLabel(p.role))}</span> <span class="muted">tú</span>`;
  if (!canManageUser(p)) return `<span class="pill ${rolePill(p.role)}">${esc(roleLabel(p.role))}</span>`;
  return `<select class="mini" data-setrole="${esc(p.id)}" aria-label="Tipo de usuario de ${esc(p.discord_name)}">${roleOptionsFor(p).map(o => `<option value="${esc(o)}" ${p.role===o?"selected":""} ${!p.albion_id && !["pendiente","bloqueado"].includes(o) && p.role!==o ? "disabled":""}>${esc(roleLabel(o))}</option>`).join("")}</select>`;
}
const autoType = () => { const k = (ST.settings||{}).auto_verify_type || "miembro"; return (ST.types||[]).some(t => t.key === k) ? k : ((ST.types||[]).find(t => !t.perms.includes("users.manage")) || {}).key; };
function viewMembers(){
  const P = ST.profiles, s = ST.settings || {}, F = ST.memFilter;
  const pend = P.filter(p => p.role==="pendiente" && p.albion_id);
  const list = P.filter(p => F==="todos" || p.role===F);
  const keys = ["admin", ...(ST.types||[]).map(t => t.key), "pendiente", "bloqueado"];
  const counts = Object.fromEntries(keys.map(k => [k, P.filter(p => p.role===k).length]));
  return `<h1>Usuarios</h1>
  ${pend.length ? `<section class="panel"><h2>Por aprobar (${pend.length})</h2>
    <div class="tablewrap"><table><thead><tr><th>Discord</th><th>Personaje</th><th>Gremio</th><th>2FA</th>${s.discord_server_id?"<th>En el Discord</th>":""}<th></th></tr></thead><tbody>${pend.map(p => `<tr><td>${esc(p.discord_name)}</td><td><b>${esc(p.albion_name)}</b></td><td>${esc(p.albion_guild||"—")}</td><td>${p.discord_mfa?'<span class="yes">sí</span>':'<span class="no">no</span>'}</td>${s.discord_server_id?`<td>${p.discord_in_server?'<span class="yes">sí</span>':'<span class="no">no</span>'}</td>`:""}<td class="n">${autoType() ? `<button class="btn sm" data-quickrole="${esc(p.id)}:${esc(autoType())}">Aprobar como ${esc(roleLabel(autoType()))}</button>` : ""} <button class="btn sm plain" data-quickrole="${esc(p.id)}:bloqueado">Bloquear</button></td></tr>`).join("")}</tbody></table></div>
    <p class="hint">Antes de aprobar, confirma por Discord que la persona es dueña de ese personaje.</p></section>` : ""}
  <section class="panel"><div class="ghead"><h2>Cuentas</h2>
    <div class="nav">${["todos", ...keys.filter(k => counts[k] || ["admin","pendiente"].includes(k))].map(k => `<button class="tab" data-memf="${k}" aria-selected="${F===k}">${k==="todos"?`Todos (${P.length})`:`${roleLabel(k)} (${counts[k]})`}</button>`).join("")}</div></div>
    <div class="tablewrap"><table><thead><tr><th>Discord</th><th>Personaje</th><th>Gremio</th><th>Tipo de usuario</th><th>2FA</th>${s.discord_server_id?"<th>En el Discord</th>":""}<th>Última visita</th><th></th></tr></thead><tbody>
    ${list.map(p => `<tr><td>${esc(p.discord_name)}</td><td>${esc(p.albion_name||"—")}</td><td>${esc(p.albion_guild||"")}</td>
      <td>${roleSelect(p)}</td><td>${p.discord_mfa?'<span class="yes">sí</span>':'<span class="no">no</span>'}</td>${s.discord_server_id?`<td>${p.discord_in_server?'<span class="yes">sí</span>':'<span class="no">no</span>'}</td>`:""}
      <td class="muted">${hhmm(p.last_seen_at)}</td>
      <td class="n">${p.albion_id && canManageUser(p) ? `<button class="btn sm plain" data-unlink="${esc(p.id)}">Desvincular personaje</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="7" class="muted">Nadie en esta categoría.</td></tr>`}
    </tbody></table></div>
    ${msgBox("members")}
    <p class="hint">El administrador tiene acceso total. Cada tipo de usuario tiene los permisos que el administrador le dio en <b>Ajustes → Tipos de usuario</b>. Quien gestiona usuarios no puede tocar al administrador ni dar el permiso de gestionar usuarios.</p>
  </section>`;
}

/* ---- registro (oficial) ---- */
function viewAudit(){
  const A = ST.audit;
  if (!A) return `<h1>Registro</h1><div class="empty">Cargando…</div>`;
  const gname = id => (ST.groups.find(g => g.id === id) || {}).name;
  const det = d => Object.entries(d||{}).filter(([k]) => k!=="grupo").map(([k,v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join(" · ");
  return `<h1>Registro</h1><section class="panel"><p class="hint">Cambios importantes: roles, aprobaciones, regear, loot, pagos y ajustes. Nadie puede borrarlo desde la página.</p>
    <div class="tablewrap"><table><thead><tr><th>Cuándo</th><th>Quién</th><th>Qué</th><th>Sobre</th><th>Detalle</th></tr></thead><tbody>
    ${A.map(a => `<tr><td class="muted" style="white-space:nowrap">${hhmm(a.at)}</td><td>${a.actor?esc(profName(a.actor)):'<span class="muted">sistema</span>'}</td><td><b>${esc(a.action)}</b></td><td>${esc(a.target||"")}${a.detail&&a.detail.grupo&&gname(a.detail.grupo)?` <span class="muted">(${esc(gname(a.detail.grupo))})</span>`:""}</td><td class="muted" style="font-size:.82rem">${esc(det(a.detail))}</td></tr>`).join("") || `<tr><td colspan="5" class="muted">Sin registros.</td></tr>`}
    </tbody></table></div></section>`;
}

/* ---- ajustes (administrador) ---- */
function viewSettings(){
  const S = ST.settings, R = S.regear || {}, D = ST.search || {};
  return `<h1>Ajustes del gremio</h1>
  ${msgBox("settings")}
  <div class="grid2">
  <section class="panel"><h2>Acceso y seguridad</h2>
    <div class="field"><label for="s_dserver">Servidor de Discord del gremio</label>
      ${ST.discordGuilds ? `<select id="s_dserver"><option value="">Sin servidor</option>${ST.discordGuilds.map(g => `<option value="${esc(g.id)}" ${S.discord_server_id===g.id?"selected":""}>${esc(g.name)}</option>`).join("")}</select>`
        : `<p style="margin:0"><b>${esc(S.discord_server_name || "Sin configurar")}</b></p><p class="hint">Para elegir de tu lista de servidores, <a href="#" data-act="reauth">vuelve a entrar con Discord</a>.</p>`}
    </div>
    <label class="check"><input type="checkbox" id="s_reqserver" ${S.require_discord_server?"checked":""} ${S.discord_server_id?"":"disabled"}> Solo pueden entrar miembros de ese servidor de Discord</label>
    <label class="check"><input type="checkbox" id="s_mfastaff" ${S.require_mfa_staff?"checked":""}> Exigir verificación en dos pasos de Discord a quienes tengan permisos de gestión y al administrador</label>
    <label class="check"><input type="checkbox" id="s_mfaall" ${S.require_mfa_all?"checked":""}> Exigirla a todos</label>
    <label class="check"><input type="checkbox" id="s_auto" ${S.auto_verify_guild?"checked":""}> Aprobar solos a quienes vinculen un personaje del gremio</label>
    <p class="hint">Si exiges la verificación en dos pasos, actívala tú primero en Discord: si no, perderás el acceso a Ajustes hasta activarla.</p>
  </section>
  <section class="panel"><h2>Gremio en Albion</h2>
    <div class="field"><label for="s_server">Servidor del juego</label><select id="s_server">${Object.entries(SERVERS).map(([k,v]) => `<option value="${k}" ${S.server===k?"selected":""}>${v}</option>`).join("")}</select></div>
    <p style="margin:0">Gremio actual: <b>${esc(S.guild_name||"sin configurar")}</b></p>
    <div class="row"><div class="field"><label for="s_gq">Buscar gremio</label><input type="text" id="s_gq" value="${esc(D.gq||"")}" placeholder="Nombre del gremio"></div><button class="btn ghost" data-act="guildSearch">Buscar</button></div>
    ${D.guilds ? `<div class="list">${D.guilds.map(g => `<div class="li"><button class="btn sm" data-setguild="${esc(g.Id)}">Elegir</button> <b>${esc(g.Name)}</b><small>${esc(g.AllianceName||"")}</small></div>`).join("") || `<div class="empty">Sin resultados.</div>`}</div>` : ""}
    <span class="lbl">Ciudades para valorar el equipo (precio más bajo)</span>
    <div class="mods">${PRICE_CITIES.map(c => `<label class="check"><input type="checkbox" data-pcity="${c}" ${(S.price_cities||[]).includes(c)?"checked":""}> ${c}</label>`).join("")}</div>
  </section>
  <section class="panel"><h2>Reglas de reequipamiento</h2>
    <div class="field"><label for="r_equiv">Equivalente máximo cubierto</label><select id="r_equiv">${[0,4,5,6,7,8,9,10,11,12].map(v => `<option value="${v}" ${(+R.maxEquiv||0)===v?"selected":""}>${v?v+".0 equivalente":"Sin límite"}</option>`).join("")}</select></div>
    <p class="hint">Equivalente = tier + encantamiento. Con 8.0 se cubre T8.0, T7.1, T6.2, T5.3 o T4.4.</p>
    <div class="field"><label for="r_max">Tope general por muerte (0 = sin tope)</label><input type="number" id="r_max" min="0" step="10000" value="${+R.maxValue||0}"></div>
    <label class="check"><input type="checkbox" id="r_bag" ${R.bag?"checked":""}> Cubrir bolsa</label>
    <label class="check"><input type="checkbox" id="r_mount" ${R.mount?"checked":""}> Cubrir montura</label>
    <label class="check"><input type="checkbox" id="r_cons" ${R.consumables?"checked":""}> Cubrir comida y pociones</label>
  </section>
  <section class="panel" style="grid-column:1/-1"><h2>Tipos de usuario</h2>
    <p class="hint">Define qué puede ver y hacer cada tipo. Tú, como administrador, siempre tienes acceso total. Los permisos marcados con * son de gestión y exigen verificación en dos pasos si la activaste.</p>
    <div class="tablewrap"><table><thead><tr><th>Tipo</th>${PERMS.map(x => `<th style="text-align:center;font-size:.68rem;max-width:110px;white-space:normal">${esc(x.label)}${x.staff?" *":""}</th>`).join("")}<th></th></tr></thead><tbody>
      ${(ST.types||[]).map(t => `<tr><td><input type="text" maxlength="40" data-tname="${esc(t.key)}" value="${esc(t.name)}" style="min-width:120px"><div class="muted" style="font-size:.72rem">${(ST.profiles||[]).filter(p => p.role===t.key).length} cuentas</div></td>
        ${PERMS.map(x => `<td style="text-align:center"><input type="checkbox" data-tperm="${esc(t.key)}:${x.key}" ${t.perms.includes(x.key)?"checked":""} aria-label="${esc(t.name)}: ${esc(x.label)}"></td>`).join("")}
        <td><button class="btn sm plain" data-tdel="${esc(t.key)}" title="Borrar tipo">×</button></td></tr>`).join("")}
    </tbody></table></div>
    <div class="row"><div class="field" style="flex:0 1 260px"><label for="t_new">Nuevo tipo</label><input type="text" id="t_new" maxlength="40" placeholder="Ej: Refinador"></div><button class="btn ghost" data-act="addType">Agregar tipo</button></div>
    <div class="field" style="max-width:360px"><label for="s_autotype">Tipo que reciben al aprobarse solos</label><select id="s_autotype">${(ST.types||[]).filter(t => !t.perms.includes("users.manage")).map(t => `<option value="${esc(t.key)}" ${S.auto_verify_type===t.key?"selected":""}>${esc(t.name)}</option>`).join("")}</select></div>
  </section>
  <section class="panel"><h2>Aportes voluntarios</h2>
    <p class="hint">Muestra al pie de la página un enlace para quien quiera ayudar con el hosting. Recomendado: pregunta antes al soporte del juego (support@albiononline.com) si lo permiten.</p>
    <label class="check"><input type="checkbox" id="d_on" ${S.donation_enabled?"checked":""} ${S.donation_url?"":"disabled"}> Mostrar el enlace de aportes</label>
    <div class="field"><label for="d_url">Enlace (PayPal.me, PayPal, Ko-fi o Buy Me a Coffee)</label><input type="text" id="d_url" value="${esc(S.donation_url||"")}" placeholder="https://www.paypal.me/tu-usuario" maxlength="240" autocomplete="off"></div>
    <div class="field"><label for="d_note">Mensaje</label><input type="text" id="d_note" value="${esc(S.donation_note||"")}" placeholder="Aporte voluntario para cubrir el hosting." maxlength="200"></div>
    <p class="hint">Siempre se agrega: "Es opcional: no da beneficios, funciones extra ni nada dentro del juego." No ofrezcas nada a cambio de los aportes: dinero real a cambio de algo del juego está prohibido por los términos de Albion.</p>
  </section>
  <section class="panel"><h2>Roles de grupo</h2>
    <p class="hint">Cada rol puede tener su propio % de reequipamiento, su tope (0 = usa el general) y su peso en el reparto por rol.</p>
    <div class="tablewrap"><table><thead><tr><th>Rol</th><th class="n">Regear %</th><th class="n">Tope</th><th class="n">Peso loot</th><th></th></tr></thead><tbody>
      ${partyRoles().map((r,i) => `<tr><td><input type="text" maxlength="30" data-pr="${i}:name" value="${esc(r.name)}"></td><td class="n"><input type="number" min="0" max="100" style="max-width:70px" data-pr="${i}:regearPct" value="${+r.regearPct||0}"></td><td class="n"><input type="number" min="0" step="10000" style="max-width:110px" data-pr="${i}:regearMax" value="${+r.regearMax||0}"></td><td class="n"><input type="number" min="0" max="10" step="0.1" style="max-width:70px" data-pr="${i}:lootWeight" value="${r.lootWeight ?? 1}"></td><td><button class="btn sm plain" data-prdel="${i}" title="Quitar">×</button></td></tr>`).join("")}
    </tbody></table></div>
    <div class="row"><button class="btn sm ghost" data-act="addPartyRole">+ Agregar rol</button></div>
    <p class="hint">El % y el tope se aplican a las muertes nuevas y cuando cambia el rol de alguien.</p>
  </section></div>`;
}

/* ---- grupo ---- */
function viewGroup(){
  const C = ST.cur;
  if (!C) return `<div class="empty">Cargando grupo…</div>${msgBox("group")}`;
  const {group:g, members, deaths, disputes} = C;
  const active = g.status==="active", off = isOfficer();
  const mine = members.find(m => m.profile_id === ST.me.id);
  const open = disputes.filter(d => d.status==="abierto").length;
  const tabs = [["members","Integrantes"], ...(g.mods.deaths?[["deaths",`Muertes (${deaths.length})`]]:[]), ...(g.mods.loot?[["loot","Loot"]]:[]), ["disputes",`Reclamos${open?` (${open})`:""}`], ["summary","Resumen"]];
  if (!tabs.some(t => t[0]===ST.gtab)) ST.gtab = "members";
  const reg = deaths.filter(d => d.status!=="rechazado").reduce((a,d) => a + (+d.regear||0), 0);
  const cc = compCalc(g, members);
  const stats = [["Integrantes", `${members.filter(m => !m.left_at).length}${cc.target?` / ${cc.target}`:""}`], ["Duración", dur((g.ended_at ? ts(g.ended_at) : Date.now()) - ts(g.started_at))]];
  if (g.mods.deaths) stats.push(["Muertes", deaths.length]);
  if (g.mods.regear) stats.push(["Regear", fmt(reg)]);
  if (g.mods.loot) stats.push(["A repartir", fmt(lootCalc(g, members, deaths).pool)]);
  const joinUrl = `${location.origin}${location.pathname}#/unirse/${g.code}`;
  const body = {members:tabMembers, deaths:tabDeaths, loot:tabLoot, disputes:tabDisputes, summary: () => `<section class="panel"><div class="ghead"><h2>Resumen para Discord</h2><button class="btn" data-act="copySummary">Copiar</button></div><pre class="out" id="sumText">${esc(summaryText(C))}</pre></section>`}[ST.gtab](C);
  return `<div class="ghead">
    <div><a class="btn sm plain" href="#/">← Grupos</a>
      <h1 style="margin-top:8px">${esc(g.name)}</h1>
      <div class="muted">${esc((TYPES[g.type]||TYPES.other).label)} · ${Object.entries(g.mods).filter(([,v])=>v).map(([k])=>MODS[k].label).join(" · ")}</div></div>
    <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">
      ${active ? (g.mods.deaths?`<span class="live">Siguiendo muertes · última revisión ${g.last_check?hhmm(g.last_check):"pendiente"}</span>`:`<span class="pill p-active">Activo</span>`) : `<span class="pill p-closed">Disuelto ${hhmm(g.ended_at)}</span>`}
      ${off ? `<div class="row">${g.mods.deaths?`<button class="btn ghost" data-act="checkNow">Revisar ahora</button>`:""}${active?`<button class="btn danger" data-act="dissolve">Disolver grupo</button>`:`<button class="btn plain" data-act="deleteGroup">Eliminar</button>`}</div>` : ""}
    </div>
  </div>
  ${active && off ? `<div class="share"><span>Código para unirse:</span><code>${esc(g.code)}</code><button class="btn sm" data-copy="${esc(joinUrl)}">Copiar enlace</button><span class="hint">Compártelo en Discord; cada uno entra con su cuenta, elige su rol y queda en el grupo.</span></div>` : ""}
  ${msgBox("group")}
  ${myBox(C, mine)}
  <div class="stats">${stats.map(([k,v]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`).join("")}</div>
  <div class="nav">${tabs.map(([k,l]) => `<button class="tab" data-gtab="${k}" aria-selected="${ST.gtab===k}">${l}</button>`).join("")}</div>
  ${body}`;
}
function myBox(C, mine){
  const g = C.group;
  if (!mine) return g.status==="active" ? `<div class="mybox"><b>No estás en este grupo.</b><div class="row"><div class="field" style="flex:0 1 240px"><label for="my_joinrole">Tu rol</label><select id="my_joinrole">${roleOptions("", "Elegir después")}</select></div><button class="btn" data-act="joinThis">Unirme como ${esc(ST.me.albion_name)}</button></div></div>` : "";
  const myDeaths = C.deaths.filter(d => d.albion_id === mine.albion_id);
  const myReg = myDeaths.filter(d => d.status!=="rechazado").reduce((a,d) => a + (+d.regear||0), 0);
  const share = g.mods.loot ? (lootCalc(g, C.members, C.deaths).people.find(p => p.m.albion_id === mine.albion_id) || {}).share : null;
  const rc = roleCfg(mine.party_role);
  return `<div class="mybox">
    <div class="ghead"><b>Tu participación</b><span class="muted">Desde ${hhmm(mine.joined_at)}${mine.left_at?` hasta ${hhmm(mine.left_at)}`:""}</span></div>
    <div class="row" style="gap:18px;align-items:center">
      <span>Rol: ${g.status==="active" ? `<select class="mini" id="my_role" aria-label="Tu rol en el grupo">${roleOptions(mine.party_role)}</select>` : `<span class="rolechip">${esc(roleName(mine.party_role))}</span>`}</span>
      ${g.mods.deaths?`<span>Muertes: <b>${myDeaths.length}</b></span>`:""}
      ${g.mods.regear?`<span>Tu regear: <b>${fmt(myReg)}</b>${mine.party_role && (+rc.regearPct||100)!==100?` <span class="muted">(${rc.regearPct}% por rol)</span>`:""} ${myDeaths.map(d => `<span class="pill ${STATUS_PILL[d.status]}">${d.status}</span>`).join(" ")}</span>`:""}
      ${g.mods.loot?`<span>Tu parte del loot: <b>${share!=null?fmt(share):"—"}</b>${mine.excluded?" (excluido)":""}</span>`:""}
    </div>
    <div class="row">
      ${mine.confirmed_at ? `<span class="pill p-paid">Confirmaste los datos ${hhmm(mine.confirmed_at)}</span>` : `<button class="btn ghost" data-act="confirmMine">Los datos están bien</button>`}
      ${(g.mods.loot||g.mods.regear) ? (mine.received_at ? `<span class="pill p-paid">Pago recibido ${hhmm(mine.received_at)}</span>` : `<button class="btn ghost" data-act="receivedMine">Recibí mi pago</button>`) : ""}
      <button class="btn plain" data-act="openDispute">Hacer un reclamo</button>
    </div>
  </div>`;
}
function compPanel(C){
  const cc = compCalc(C.group, C.members);
  if (!cc.rows.length && !cc.extra.length) return "";
  return `<div class="comp">${cc.rows.map(r => `<div class="c ${r.have>=r.count?"ok":"miss"}"><small>${esc(roleName(r.role))}</small><b>${r.have}/${r.count}</b>${r.note?`<small>${esc(r.note)}</small>`:""}</div>`).join("")}${cc.extra.map(r => `<div class="c"><small>${esc(r.role?roleName(r.role):"Sin rol")}</small><b>${r.have}</b></div>`).join("")}</div>`;
}
function tabMembers(C){
  const {group:g, members, deaths} = C, off = isOfficer(), active = g.status==="active", S = ST.search || {};
  return `<section class="panel"><h2>Integrantes</h2>
    ${compPanel(C)}
    ${off ? `<details><summary class="muted" style="cursor:pointer">Editar composición buscada</summary><div class="tablewrap"><table><thead><tr><th>Rol</th><th class="n">Cantidad</th><th>Nota</th></tr></thead><tbody>
      ${partyRoles().map(r => { const c = (g.composition||[]).find(x => x.role===r.key) || {}; return `<tr><td>${esc(r.name)}</td><td class="n"><input type="number" min="0" max="300" style="max-width:80px" data-gcomp="${esc(r.key)}:count" value="${c.count||""}" placeholder="0"></td><td><input type="text" maxlength="80" data-gcomp="${esc(r.key)}:note" value="${esc(c.note||"")}"></td></tr>`; }).join("")}
    </tbody></table></div></details>` : ""}
    <div class="tablewrap"><table><thead><tr><th>Personaje</th><th>Rol</th><th>Gremio</th><th>Entró</th><th>Salió</th><th class="n">Muertes</th><th>Confirmó</th><th>Recibió</th><th></th></tr></thead><tbody>
    ${members.map(m => { const own = m.profile_id===ST.me.id; const canEdit = active && (off || own); return `<tr class="${own?"mine":""}"><td><b>${esc(m.albion_name)}</b>${m.profile_id?"":' <span class="muted" title="Sin cuenta vinculada">·</span>'}</td>
      <td>${canEdit ? `<select class="mini" data-mrole="${esc(m.albion_id)}" aria-label="Rol de ${esc(m.albion_name)}">${roleOptions(m.party_role)}</select>` : `<span class="rolechip">${esc(roleName(m.party_role))}</span>`}</td>
      <td class="muted">${esc(m.guild||"")}</td><td>${hhmm(m.joined_at)}</td><td>${m.left_at?hhmm(m.left_at):"—"}</td><td class="n">${deaths.filter(d=>d.albion_id===m.albion_id).length}</td>
      <td>${m.confirmed_at?'<span class="pill p-paid">sí</span>':'<span class="muted">—</span>'}</td><td>${m.received_at?'<span class="pill p-paid">sí</span>':'<span class="muted">—</span>'}</td>
      <td class="n">${off && active && !m.left_at ? `<button class="btn sm plain" data-leave="${esc(m.albion_id)}">Marcar salida</button>` : ""}</td></tr>`; }).join("") || `<tr><td colspan="9" class="muted">Todavía no hay integrantes. Comparte el código del grupo.</td></tr>`}
    </tbody></table></div>
    ${off && active ? `<div class="row"><div class="field"><label for="g_pq">Agregar jugador (cuenta desde ahora)</label><input type="text" id="g_pq" value="${esc(S.gq2||"")}" placeholder="Nombre del personaje"></div><button class="btn ghost" data-act="gSearch">Buscar</button></div>
      ${S.gplayers ? `<div class="list">${S.gplayers.map(p => `<div class="li"><button class="btn sm" data-gadd="${esc(p.Id)}">Agregar</button> ${esc(p.Name)}<small>${esc(p.GuildName||"sin gremio")}</small></div>`).join("") || `<div class="empty">Sin resultados.</div>`}</div>` : ""}` : ""}
    <p class="hint">Solo cuentan las muertes entre la entrada y la salida de cada integrante, dentro del horario del grupo. El regear se ajusta según el rol de cada uno.</p>
  </section>`;
}
function tabDeaths(C){
  const {group:g, deaths} = C, off = can("regear.approve");
  if (!deaths.length) return `<section class="panel"><div class="empty">${g.status==="active"?"Sin muertes por ahora. El servidor revisa el killboard cada pocos minutos; las muertes suelen aparecer con algo de atraso.":"No se registraron muertes en este grupo."}</div>
    ${(g.last_errors||[]).length?`<div class="status err">No se pudo revisar a: ${esc(g.last_errors.slice(0,3).join(" · "))}</div>`:""}</section>`;
  return `<section class="panel"><div class="ghead"><h2>Muertes</h2>${off && g.mods.regear?`<button class="btn sm ghost" data-act="approveAll">Aprobar pendientes sin alertas</button>`:""}</div>
  ${(g.last_errors||[]).length?`<div class="status err">Algunos integrantes no se pudieron revisar: ${esc(g.last_errors.slice(0,3).join(" · "))}</div>`:""}
  ${deaths.map(d => { const own = C.members.some(m => m.albion_id===d.albion_id && m.profile_id===ST.me.id); const rc = roleCfg(d.party_role); const pct = d.party_role ? (+rc.regearPct ?? 100) : 100; return `<div class="death ${own?"mine":""}">
    <div class="dh"><span><span class="who">${esc(d.name)}</span> ${d.party_role?`<span class="rolechip">${esc(roleName(d.party_role))}</span>`:""} <span class="muted">· ${hhmm(d.time)} · IP ${esc(d.ip)} · por ${esc(d.killer)}${d.killer_guild?` [${esc(d.killer_guild)}]`:""}</span></span>
      ${g.mods.regear?`<span class="pill ${STATUS_PILL[d.status]}">${d.status}</span>`:""}</div>
    <div class="gear">${(d.items||[]).map(it => `<div class="slot ${g.mods.regear && !it.covered?"off":""}" title="${esc(prettyBase(parseItem(it.type).base))} ${itemTag(it.type)} · ${QUAL[it.quality]||""}${it.price?` · ${fmt(it.price)} en ${esc(it.city||"")}`:""}"><img loading="lazy" src="${icon(it.type,it.quality)}" alt="">${SLOTS[it.slot]||""} ${itemTag(it.type)}<br>${(it.manual??it.price)?fmt(it.manual??it.price):"?"}</div>`).join("")}</div>
    ${g.mods.regear ? `
      ${(d.flags||[]).length?`<div class="flags">${d.flags.map(f => `<span class="flag">${esc(f)}</span>`).join("")}</div>`:""}
      ${off ? `<details><summary class="muted" style="cursor:pointer">Ajustar valores</summary><div class="tablewrap"><table><tbody>${(d.items||[]).map((it,i) => `<tr><td>${SLOTS[it.slot]}: ${esc(prettyBase(parseItem(it.type).base))} ${itemTag(it.type)} <span class="muted">${QUAL[it.quality]||""}${it.price && !it.exact?" · precio de otra calidad":""}</span></td><td class="n"><input type="number" min="0" step="1000" style="max-width:130px" data-dval="${esc(d.event_id)}:${i}" value="${it.manual??it.price??""}" placeholder="0"></td></tr>`).join("")}</tbody></table></div></details>` : ""}
      <div class="row" style="justify-content:space-between"><span>Regear: <b style="font-family:var(--f-num);font-size:1.1rem">${fmt(d.regear)}</b>${pct!==100 || (d.regear_base && d.regear !== Math.round(d.regear_base*pct/100)) ? ` <span class="muted">(equipo ${fmt(d.regear_base)} × ${pct}%${d.regear < Math.round(d.regear_base*pct/100) ? ", con tope" : ""})</span>` : ""}${d.note?` · <span class="muted">${esc(d.note)}</span>`:""}</span>
        <span class="row">${off ? ["aprobado","rechazado","pagado"].map(s => `<button class="btn sm ${d.status===s?"":"plain"}" data-dstatus="${esc(d.event_id)}:${s}">${s==="aprobado"?"Aprobar":s==="rechazado"?"Rechazar":"Pagado"}</button>`).join("") : ""}${own?`<button class="btn sm plain" data-dispute="${esc(d.event_id)}">Reclamar</button>`:""}</span></div>
      ${off ? `<input type="text" placeholder="Nota visible para todos (opcional)" data-dnote="${esc(d.event_id)}" value="${esc(d.note||"")}" maxlength="200">` : ""}` : (own?`<div class="row"><button class="btn sm plain" data-dispute="${esc(d.event_id)}">Reclamar</button></div>`:"")}
  </div>`; }).join("")}</section>`;
}
function tabLoot(C){
  const {group:g, members, deaths} = C, L = g.loot || {}, c = lootCalc(g, members, deaths), off = isOfficer(), dis = off ? "" : "disabled";
  const showW = L.method==="role";
  return `<div class="grid2">
  <section class="panel"><h2>Botín</h2>
    <div class="quick"><label class="lbl" for="l_chest">Valor estimado del cofre</label>
      <input type="number" id="l_chest" min="0" step="10000" value="${L.chest||""}" placeholder="Ej: 12500000" style="font-size:1.4rem;padding:12px" ${dis}>
      <p class="hint">${off?"Dejen todo el loot en el cofre y copien aquí el valor estimado que muestra el juego.":"Lo ingresa quien gestiona el grupo con el valor estimado del cofre."}</p></div>
    <div class="row">
      <div class="field"><label for="l_silver">Plata recogida (además del cofre)</label><input type="number" id="l_silver" min="0" step="1000" value="${+L.silver||0}" ${dis}></div>
      <div class="field"><label for="l_rep">Reparaciones</label><input type="number" id="l_rep" min="0" step="1000" value="${+L.repairs||0}" ${dis}></div>
      <div class="field"><label for="l_pct">% para el gremio</label><input type="number" id="l_pct" min="0" max="100" step="1" value="${+L.guildPct||0}" ${dis}></div>
    </div>
    <div class="row">
      <div class="field"><label for="l_method">Cómo repartir</label><select id="l_method" ${dis}><option value="equal" ${!L.method||L.method==="equal"?"selected":""}>Partes iguales</option><option value="role" ${L.method==="role"?"selected":""}>Según el rol (peso de cada rol)</option><option value="time" ${L.method==="time"?"selected":""}>Según tiempo presente</option></select></div>
      <div class="field"><label for="l_round">Redondear cada parte a</label><select id="l_round" ${dis}>${[[0,"Sin redondear"],[1000,"1.000"],[10000,"10.000"],[100000,"100.000"]].map(([v,t]) => `<option value="${v}" ${(+L.round||0)===v?"selected":""}>${t}</option>`).join("")}</select></div>
    </div>
    ${g.mods.regear?`<label class="check"><input type="checkbox" id="l_dreg" ${L.deductRegear?"checked":""} ${dis}> Descontar regear aprobado del loot</label>`:""}
    ${showW ? `<p class="hint">Pesos actuales: ${partyRoles().map(r => `${esc(r.name)} ${r.lootWeight ?? 1}`).join(" · ")}. Sin rol = 1. El administrador los cambia en Ajustes.</p>` : ""}
  </section>
  <section class="panel"><h2>Reparto</h2>
    <div class="tablewrap"><table><tbody>
      <tr><td>Valor del cofre</td><td class="n">${fmt(+L.chest||0)}</td></tr>
      ${+L.silver?`<tr><td>+ Plata recogida</td><td class="n">${fmt(+L.silver)}</td></tr>`:""}
      <tr><td>− Reparaciones</td><td class="n">${fmt(+L.repairs||0)}</td></tr>
      ${c.regearPaid?`<tr><td>− Regear aprobado</td><td class="n">${fmt(c.regearPaid)}</td></tr>`:""}
      <tr><td>− Gremio (${fmt(+L.guildPct||0)}%)</td><td class="n">${fmt(c.guildCut)}</td></tr>
      <tr class="total"><td>A repartir</td><td class="n">${fmt(c.pool)}</td></tr>
      <tr><td>Personas</td><td class="n">${c.people.length}</td></tr>
      ${!L.method||L.method==="equal" ? `<tr class="total"><td>Le toca a cada uno</td><td class="n" style="font-size:1.2rem">${fmt(c.people[0]?c.people[0].share:0)}</td></tr>` : ""}
      ${c.leftover>=1?`<tr><td>Sobrante por redondeo</td><td class="n">${fmt(c.leftover)}</td></tr>`:""}
    </tbody></table></div>
    <div class="tablewrap"><table><thead><tr><th>Integrante</th><th>Rol</th>${L.method==="time"?'<th class="n">Tiempo</th>':""}${showW?'<th class="n">Peso</th>':""}<th class="n">Le toca</th><th>Recibió</th>${off?'<th class="n">Incluir</th>':""}</tr></thead><tbody>
      ${members.map(m => { const p = c.people.find(x => x.m === m); return `<tr class="${m.profile_id===ST.me.id?"mine":""}"><td>${esc(m.albion_name)}</td><td>${m.party_role?`<span class="rolechip">${esc(roleName(m.party_role))}</span>`:'<span class="muted">—</span>'}</td>${L.method==="time"?`<td class="n">${p?dur(p.ms):"—"}</td>`:""}${showW?`<td class="n">${p?p.w:"—"}</td>`:""}<td class="n"><b>${p?fmt(p.share):"excluido"}</b></td><td>${m.received_at?'<span class="pill p-paid">sí</span>':'<span class="muted">—</span>'}</td>${off?`<td class="n"><input type="checkbox" data-lexcl="${esc(m.albion_id)}" ${m.excluded?"":"checked"} aria-label="Incluir a ${esc(m.albion_name)}"></td>`:""}</tr>`; }).join("")}
    </tbody></table></div>
  </section></div>`;
}
function tabDisputes(C){
  const off = can("disputes.resolve"), mine = C.members.find(m => m.profile_id === ST.me.id), F = ST.dform || {};
  return `<section class="panel"><h2>Reclamos</h2>
    ${mine ? `<div class="quick" id="dform"><label class="lbl" for="x_msg">Nuevo reclamo${F.event?` sobre la muerte de las ${hhmm((C.deaths.find(d=>String(d.event_id)===String(F.event))||{}).time)}`:""}</label>
      <textarea id="x_msg" rows="3" maxlength="500" placeholder="Explica qué no calza: una muerte que no fue en el contenido, un valor mal calculado, un pago que no llegó, tu rol…">${esc(F.msg||"")}</textarea>
      <div class="row"><button class="btn" data-act="sendDispute">Enviar reclamo</button>${F.event?`<button class="btn plain" data-act="clearDisputeEvent">Quitar la muerte</button>`:""}</div></div>` : `<p class="hint">Solo los integrantes del grupo pueden hacer reclamos.</p>`}
    ${msgBox("dispute")}
    ${C.disputes.length ? C.disputes.map(x => `<div class="dispute">
      <div class="ghead"><span><b>${esc(profName(x.profile_id))}</b> <span class="muted">· ${hhmm(x.created_at)}${x.event_id?` · sobre una muerte`:""}</span></span><span class="pill p-${esc(x.status)}">${esc(x.status)}</span></div>
      <div>${esc(x.message)}</div>
      ${x.reply?`<div class="muted">Respuesta: ${esc(x.reply)}</div>`:""}
      ${off && x.status==="abierto" ? `<div class="row"><div class="field"><input type="text" placeholder="Respuesta (opcional)" data-xreply="${esc(x.id)}" maxlength="300"></div><button class="btn sm" data-xresolve="${esc(x.id)}">Marcar resuelto</button></div>` : ""}
    </div>`).join("") : `<div class="empty">No hay reclamos.</div>`}
  </section>`;
}

/* ================= EVENTOS ================= */
function confirmBox(text, ok, fn){ ST.confirm = {text, ok, fn}; render(); }
const safe = (where, fn) => async (...a) => { try { await fn(...a); } catch(e) { flash(where, e.message || String(e), "err"); } };
async function reloadGroup(){ const r = route(); if (r.name==="g" && r.arg) { ST.cur = await DATA.groupFull(r.arg); render(); } }
async function reloadGroups(){ [ST.groups, ST.myGroups] = await Promise.all([DATA.groups(), DATA.myGroups(ST.me.id)]); }
async function reloadMe(){ ST.me = await DATA.me(ST.me.id); }

function bind(){
  $$("[data-act]").forEach(b => b.onclick = e => { e.preventDefault(); const f = ACT[b.dataset.act]; if (f) f(b); });
  const on = (sel, ev, fn) => { const el = $(sel); if (el) el.addEventListener(ev, fn); };
  const enter = (sel, act) => on(sel, "keydown", e => { if (e.key === "Enter") ACT[act](); });
  enter("#lk_q", "linkSearch"); enter("#j_code", "joinLook"); enter("#d_pq", "draftSearch"); enter("#s_gq", "guildSearch"); enter("#g_pq", "gSearch");
  $$("[data-link]").forEach(b => b.onclick = safe("link", async () => { flash("link", "Vinculando…", ""); const r = await DATA.fn("link", {playerId:b.dataset.link}); ST.me = r.profile; ST.search = null; ST.msg = {}; if (isMember()) { ST.profiles = await DATA.profiles(); await reloadGroups(); } go("#/"); }));
  on("#j_role", "change", e => (ST.join ||= {}).role = e.target.value);
  // crear
  const D = ST.draft;
  if (D && route().name==="nuevo") {
    on("#d_name", "input", e => D.name = e.target.value);
    on("#d_pq", "input", e => D.pq = e.target.value);
    on("#d_filter", "input", e => { D.filter = e.target.value; const pos = e.target.selectionStart; render(); const f = $("#d_filter"); f.focus(); f.setSelectionRange(pos, pos); });
    $$("[data-type]").forEach(b => b.onclick = () => { D.type = b.dataset.type; D.mods = {...TYPES[D.type].mods}; render(); });
    $$("[data-mod]").forEach(b => b.onchange = () => { D.mods[b.dataset.mod] = b.checked; if (b.dataset.mod==="regear" && b.checked) D.mods.deaths = true; if (b.dataset.mod==="deaths" && !b.checked) D.mods.regear = false; render(); });
    $$("[data-comp]").forEach(i => i.onchange = () => { const [k, f] = i.dataset.comp.split(":"); (D.comp[k] ||= {})[f] = f==="count" ? Math.max(0, Math.min(300, +i.value||0)) : i.value.slice(0,80); });
    $$("[data-pick]").forEach(c => c.onchange = () => { const p = D.roster.find(x => String(x.Id)===c.dataset.pick); if (c.checked) D.selected[p.Id] = p; else delete D.selected[p.Id]; render(); });
    $$("[data-prole]").forEach(s => s.onchange = () => { D.roles[s.dataset.prole] = s.value; });
    $$("[data-unpick]").forEach(b => b.onclick = () => { delete D.selected[b.dataset.unpick]; D.extra = D.extra.filter(p => String(p.Id)!==b.dataset.unpick); render(); });
    $$("[data-addplayer]").forEach(b => b.onclick = () => { const p = D.players.find(x => String(x.Id)===b.dataset.addplayer); if (p && !D.selected[p.Id] && !D.extra.some(x => x.Id===p.Id)) D.extra.push(p); D.players = null; D.pq = ""; render(); });
  }
  // miembros
  $$("[data-memf]").forEach(b => b.onclick = () => { ST.memFilter = b.dataset.memf; render(); });
  const changeRole = safe("members", async (id, role) => { await DATA.setRole(id, role); ST.profiles = await DATA.profiles(); flash("members", "Tipo de usuario actualizado.", "ok"); });
  $$("[data-setrole]").forEach(s => s.onchange = () => changeRole(s.dataset.setrole, s.value));
  $$("[data-quickrole]").forEach(b => b.onclick = () => { const [id, r] = b.dataset.quickrole.split(":"); changeRole(id, r); });
  $$("[data-unlink]").forEach(b => b.onclick = () => { const p = ST.profiles.find(x => x.id===b.dataset.unlink); confirmBox(`¿Quitar el personaje ${p.albion_name} de la cuenta ${p.discord_name}?`, "Desvincular", safe("members", async () => { await DATA.unlink(p.id); ST.profiles = await DATA.profiles(); flash("members", "Personaje desvinculado.", "ok"); })); });
  // ajustes
  if (route().name==="ajustes" && ST.settings) {
    const S = ST.settings, saveS = safe("settings", async p => { Object.assign(S, p); await DATA.saveSettings(p); flash("settings", "Guardado.", "ok"); });
    on("#s_gq", "input", e => (ST.search ||= {}).gq = e.target.value);
    on("#s_server", "change", e => saveS({server:e.target.value}));
    on("#d_url", "change", e => { const v = e.target.value.trim(); if (v && !DONATION_RE.test(v)) return flash("settings", "El enlace debe empezar con https:// y ser de PayPal.me, PayPal, Ko-fi o Buy Me a Coffee.", "warn"); saveS(v ? {donation_url:v} : {donation_url:null, donation_enabled:false}); });
    on("#d_note", "change", e => saveS({donation_note: e.target.value.trim().slice(0,200) || null}));
    on("#d_on", "change", e => saveS({donation_enabled:e.target.checked}));
    on("#s_autotype", "change", e => saveS({auto_verify_type:e.target.value}));
    const saveType = safe("settings", async row => { await DATA.saveType(row); ST.types = await DATA.userTypes(); flash("settings", "Tipo guardado.", "ok"); });
    $$("[data-tname]").forEach(i => i.onchange = () => { const t = ST.types.find(x => x.key === i.dataset.tname); const name = i.value.trim().slice(0,40); if (name) saveType({...t, name}); });
    $$("[data-tperm]").forEach(c => c.onchange = () => { const [k, perm] = c.dataset.tperm.split(":"); const t = ST.types.find(x => x.key === k);
      const perms = new Set(t.perms); if (c.checked) perms.add(perm); else perms.delete(perm); saveType({...t, perms:[...perms]}); });
    $$("[data-tdel]").forEach(b => b.onclick = () => { const t = ST.types.find(x => x.key === b.dataset.tdel);
      confirmBox(`¿Borrar el tipo ${t.name}? Solo se puede si ninguna cuenta lo tiene.`, "Borrar", safe("settings", async () => { await DATA.deleteType(t.key); ST.types = await DATA.userTypes(); flash("settings", "Tipo borrado.", "ok"); })); });
    on("#s_auto", "change", e => saveS({auto_verify_guild:e.target.checked}));
    on("#s_reqserver", "change", e => saveS({require_discord_server:e.target.checked}));
    on("#s_mfastaff", "change", e => { if (e.target.checked && !ST.me.discord_mfa) { e.target.checked = false; return flash("settings", "Primero activa la verificación en dos pasos en tu Discord y vuelve a entrar; si no, perderías el acceso a Ajustes.", "warn"); } saveS({require_mfa_staff:e.target.checked}); });
    on("#s_mfaall", "change", e => { if (e.target.checked && !ST.me.discord_mfa) { e.target.checked = false; return flash("settings", "Primero activa la verificación en dos pasos en tu Discord y vuelve a entrar.", "warn"); } saveS({require_mfa_all:e.target.checked}); });
    on("#s_dserver", "change", e => { const g = (ST.discordGuilds||[]).find(x => x.id===e.target.value); saveS(g ? {discord_server_id:g.id, discord_server_name:g.name} : {discord_server_id:null, discord_server_name:null, require_discord_server:false}); });
    $$("[data-pcity]").forEach(c => c.onchange = () => saveS({price_cities: $$("[data-pcity]").filter(x => x.checked).map(x => x.dataset.pcity)}));
    const R = () => ({...(S.regear||{})});
    on("#r_equiv", "change", e => saveS({regear:{...R(), maxEquiv:+e.target.value}}));
    on("#r_max", "change", e => saveS({regear:{...R(), maxValue:Math.max(0, +e.target.value||0)}}));
    on("#r_bag", "change", e => saveS({regear:{...R(), bag:e.target.checked}}));
    on("#r_mount", "change", e => saveS({regear:{...R(), mount:e.target.checked}}));
    on("#r_cons", "change", e => saveS({regear:{...R(), consumables:e.target.checked}}));
    $$("[data-setguild]").forEach(b => b.onclick = () => { const g = ST.search.guilds.find(x => String(x.Id)===b.dataset.setguild); ST.search.guilds = null; saveS({guild_id:g.Id, guild_name:g.Name}); });
    $$("[data-pr]").forEach(i => i.onchange = () => { const [k, f] = i.dataset.pr.split(":"); const roles = partyRoles().map(r => ({...r}));
      const r = roles[+k]; if (f==="name") r.name = i.value.trim().slice(0,30) || r.name; else if (f==="regearPct") r.regearPct = Math.max(0, Math.min(100, +i.value||0)); else if (f==="regearMax") r.regearMax = Math.max(0, +i.value||0); else r.lootWeight = Math.max(0, Math.min(10, +i.value||0));
      saveS({party_roles: roles}); });
    $$("[data-prdel]").forEach(b => b.onclick = () => { const roles = partyRoles().filter((_, i) => i !== +b.dataset.prdel); saveS({party_roles: roles}); });
  }
  // grupo
  const C = ST.cur;
  if (route().name==="g" && C) {
    const g = C.group, gid = g.id;
    $$("[data-gtab]").forEach(b => b.onclick = () => { ST.gtab = b.dataset.gtab; render(); });
    $$("[data-copy]").forEach(b => b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = "Copiado"; } catch(_) { b.textContent = b.dataset.copy; } setTimeout(() => b.textContent = "Copiar enlace", 2500); });
    on("#g_pq", "input", e => (ST.search ||= {}).gq2 = e.target.value);
    on("#my_role", "change", safe("group", async e => { await DATA.setMyRole(gid, e.target.value); await reloadGroup(); flash("group", "Rol actualizado.", "ok"); }));
    $$("[data-mrole]").forEach(s => s.onchange = safe("group", async () => { const m = C.members.find(x => x.albion_id === s.dataset.mrole);
      if (m.profile_id === ST.me.id && !isOfficer()) await DATA.setMyRole(gid, s.value); else await DATA.updateMember(gid, m.albion_id, {party_role: s.value || null}); await reloadGroup(); }));
    $$("[data-gcomp]").forEach(i => i.onchange = safe("group", async () => { const [k, f] = i.dataset.gcomp.split(":"); const comp = (g.composition||[]).map(x => ({...x}));
      let c = comp.find(x => x.role===k); if (!c) { c = {role:k, count:0, note:""}; comp.push(c); }
      if (f==="count") c.count = Math.max(0, Math.min(300, +i.value||0)); else c.note = i.value.slice(0,80);
      await DATA.updateGroup(gid, {composition: comp.filter(x => x.count > 0 || x.note)}); await reloadGroup(); }));
    $$("[data-gadd]").forEach(b => b.onclick = safe("group", async () => { const p = ST.search.gplayers.find(x => String(x.Id)===b.dataset.gadd); await DATA.addMember({group_id:gid, albion_id:String(p.Id), albion_name:p.Name, guild:p.GuildName||"", joined_at:iso(), left_at:null}); ST.search.gplayers = null; await reloadGroup(); }));
    $$("[data-leave]").forEach(b => b.onclick = safe("group", async () => { await DATA.updateMember(gid, b.dataset.leave, {left_at:iso()}); await reloadGroup(); }));
    $$("[data-dstatus]").forEach(b => b.onclick = safe("group", async () => { const [id, s] = b.dataset.dstatus.split(":"); const d = C.deaths.find(x => String(x.event_id)===id); await DATA.updateDeath(gid, d.event_id, {status: d.status===s ? "pendiente" : s}); await reloadGroup(); }));
    $$("[data-dnote]").forEach(i => i.onchange = safe("group", async () => { const d = C.deaths.find(x => String(x.event_id)===i.dataset.dnote); await DATA.updateDeath(gid, d.event_id, {note:i.value.slice(0,200)}); }));
    $$("[data-dval]").forEach(i => i.onchange = safe("group", async () => { const [id, k] = i.dataset.dval.split(":"); const d = C.deaths.find(x => String(x.event_id)===id); const items = d.items.map(x => ({...x})); items[+k].manual = i.value==="" ? undefined : Math.max(0, +i.value); const r = evalRegear(items, ST.settings.regear||{}); await DATA.updateDeath(gid, d.event_id, {items, regear_base:r.regear_base, flags:r.flags}); await reloadGroup(); }));
    $$("[data-dispute]").forEach(b => b.onclick = () => { ST.dform = {event:b.dataset.dispute, msg:""}; ST.gtab = "disputes"; render(); $("#x_msg") && $("#x_msg").focus(); });
    on("#x_msg", "input", e => (ST.dform ||= {}).msg = e.target.value);
    $$("[data-xresolve]").forEach(b => b.onclick = safe("dispute", async () => { const r = $(`[data-xreply="${b.dataset.xresolve}"]`); await DATA.updateDispute(b.dataset.xresolve, {status:"resuelto", reply:(r&&r.value.slice(0,300))||null}); await reloadGroup(); }));
    const saveLoot = safe("group", async p => { g.loot = {...g.loot, ...p}; await DATA.updateGroup(gid, {loot:g.loot}); render(); });
    on("#l_chest", "change", e => saveLoot({chest:Math.max(0, +e.target.value||0)}));
    on("#l_silver", "change", e => saveLoot({silver:Math.max(0, +e.target.value||0)}));
    on("#l_rep", "change", e => saveLoot({repairs:Math.max(0, +e.target.value||0)}));
    on("#l_pct", "change", e => saveLoot({guildPct:Math.min(100, Math.max(0, +e.target.value||0))}));
    on("#l_method", "change", e => saveLoot({method:e.target.value}));
    on("#l_round", "change", e => saveLoot({round:+e.target.value||0}));
    on("#l_dreg", "change", e => saveLoot({deductRegear:e.target.checked}));
    $$("[data-lexcl]").forEach(c => c.onchange = safe("group", async () => { await DATA.updateMember(gid, c.dataset.lexcl, {excluded:!c.checked}); await reloadGroup(); }));
  }
}

const ACT = {
  signIn: safe("auth", () => DATA.signIn()),
  reauth: safe("auth", async () => { await DATA.signOut(); await DATA.signIn(); }),
  signOut: safe("auth", async () => { await DATA.signOut(); ST.session = null; ST.me = null; ST.synced = false; go("#/"); render(); }),
  linkSearch: safe("link", async () => { const q = ($("#lk_q")||{}).value.trim(); if (q.length < 2) return; ST.search = {q}; flash("link", "Buscando…", ""); const r = await DATA.fn("search", {q}); ST.search.players = r.players.slice(0, 15); ST.msg.link = null; render(); }),
  joinLook: safe("join", async () => { const code = ($("#j_code")||{}).value.trim(); if (!code) return; const g = await DATA.groupByCode(code); if (!g) return flash("join", "No existe un grupo con ese código.", "warn"); const full = await DATA.groupFull(g.id); ST.join = {...(ST.join||{}), code, group:full.group, members:full.members}; render(); }),
  join: safe("join", async () => { const code = ($("#j_code")||{}).value.trim(); if (!code) return; const id = await DATA.join(code, (ST.join||{}).role); ST.join = null; ST.msg = {}; await reloadGroups(); go(`#/g/${id}`); }),
  joinThis: safe("group", async () => { await DATA.join(ST.cur.group.code, ($("#my_joinrole")||{}).value); flash("group", "Te uniste al grupo.", "ok"); await reloadGroup(); }),
  confirmMine: safe("group", async () => { await DATA.confirm(ST.cur.group.id); await reloadGroup(); }),
  receivedMine: safe("group", async () => { await DATA.received(ST.cur.group.id); await reloadGroup(); }),
  openDispute: () => { ST.dform = {msg:""}; ST.gtab = "disputes"; render(); $("#x_msg") && $("#x_msg").focus(); },
  clearDisputeEvent: () => { ST.dform.event = null; render(); },
  sendDispute: safe("dispute", async () => { const F = ST.dform || {}, msg = (F.msg||"").trim().slice(0,500); if (!msg) return flash("dispute", "Escribe el reclamo.", "warn"); await DATA.addDispute({group_id:ST.cur.group.id, profile_id:ST.me.id, event_id:F.event?+F.event:null, message:msg}); ST.dform = {}; flash("dispute", "Reclamo enviado. Un oficial lo revisará.", "ok"); await reloadGroup(); }),
  loadRoster: safe("create", async () => { flash("create", "Cargando miembros…", ""); const r = await DATA.fn("members", {guildId:ST.settings.guild_id}); ST.draft.roster = r.sort((a,b) => a.Name.localeCompare(b.Name)); ST.msg.create = null; render(); }),
  selAll: () => { const D = ST.draft; D.roster.filter(p => !D.filter || p.Name.toLowerCase().includes(D.filter.toLowerCase())).forEach(p => D.selected[p.Id] = p); render(); },
  selNone: () => { ST.draft.selected = {}; render(); },
  draftSearch: safe("create", async () => { const D = ST.draft, q = (D.pq||"").trim(); if (q.length < 2) return; const r = await DATA.fn("search", {q}); D.players = r.players.slice(0, 15); render(); }),
  resetDraft: () => { ST.draft = newDraft(); ST.msg = {}; render(); },
  createGroup: safe("create", async () => {
    const D = ST.draft, people = Object.values(D.selected).concat(D.extra), now = iso();
    const comp = Object.entries(D.comp).map(([role, c]) => ({role, count:+c.count||0, note:c.note||""})).filter(c => c.count > 0 || c.note);
    const row = await DATA.createGroup({name: D.name.trim().slice(0,80) || `${TYPES[D.type].label} ${hhmm(Date.now())}`, type:D.type, mods:{...D.mods}, composition:comp, created_by:ST.me.id, started_at:now},
      people.map(p => ({albion_id:String(p.Id), albion_name:p.Name, guild:p.GuildName || (D.selected[p.Id] ? ST.settings.guild_name : "") || "", joined_at:now, party_role:D.roles[p.Id] || null})));
    ST.draft = null; ST.msg = {}; await reloadGroups(); ST.gtab = "members"; go(`#/g/${row.id}`);
  }),
  guildSearch: safe("settings", async () => { const q = ((ST.search||{}).gq||"").trim(); if (q.length < 2) return; const r = await DATA.fn("search", {q}); ST.search.guilds = r.guilds.slice(0, 15); render(); }),
  addType: safe("settings", async () => { const name = (($("#t_new")||{}).value||"").trim().slice(0,40); if (!name) return flash("settings", "Escribe el nombre del tipo.", "warn");
    let key = slug(name).slice(0,24), n = 2; if (key.length < 2) key = "tipo"; while (["admin","pendiente","bloqueado","lider"].includes(key) || ST.types.some(t => t.key === key)) key = slug(name).slice(0,20) + "_" + n++;
    await DATA.saveType({key, name, perms:["groups.view"], sort:(ST.types.length+1)*10}); ST.types = await DATA.userTypes(); flash("settings", `Tipo ${name} creado. Marca sus permisos.`, "ok"); }),
  addPartyRole: safe("settings", async () => { const roles = partyRoles().map(r => ({...r})); let n = roles.length + 1, key; do { key = "rol_" + n++; } while (roles.some(r => r.key===key)); roles.push({key, name:"Nuevo rol", regearPct:100, regearMax:0, lootWeight:1}); ST.settings.party_roles = roles; await DATA.saveSettings({party_roles:roles}); flash("settings", "Rol agregado: cámbiale el nombre.", "ok"); }),
  gSearch: safe("group", async () => { const q = ((ST.search||{}).gq2||"").trim(); if (q.length < 2) return; const r = await DATA.fn("search", {q}); ST.search.gplayers = r.players.slice(0, 15); render(); }),
  checkNow: safe("group", async () => { flash("group", "Revisando el killboard…", ""); const r = await DATA.fn("poll", {groupId:ST.cur.group.id, force:true}); await reloadGroup(); flash("group", (r.errors||[]).length ? `Revisado con problemas en ${r.errors.length} integrantes. Muertes nuevas: ${r.added||0}.` : `Revisado. Muertes nuevas: ${r.added||0}.`, (r.errors||[]).length ? "warn" : "ok"); }),
  dissolve: () => confirmBox("¿Disolver el grupo? Se hará una última revisión del killboard y dejarán de contarse muertes nuevas.", "Disolver", safe("group", async () => {
    const g = ST.cur.group; await DATA.updateGroup(g.id, {status:"closed", ended_at:iso()});
    let extra = "";
    if (g.mods.deaths) { try { const r = await DATA.fn("poll", {groupId:g.id, force:true}); extra = ` Muertes nuevas en la revisión final: ${r.added||0}. Puedes volver a revisar más tarde por si alguna aparece con atraso.`; } catch(e) { extra = " La revisión final falló: " + e.message; } }
    ST.gtab = g.mods.loot ? "loot" : "summary"; await reloadGroup(); await reloadGroups(); flash("group", "Grupo disuelto." + extra, "ok");
  })),
  deleteGroup: () => confirmBox("¿Eliminar este grupo y todos sus datos? No se puede deshacer.", "Eliminar", safe("group", async () => { await DATA.deleteGroup(ST.cur.group.id); ST.cur = null; await reloadGroups(); go("#/"); })),
  confirmYes: () => { const f = ST.confirm.fn; ST.confirm = null; f(); },
  confirmNo: () => { ST.confirm = null; render(); },
  approveAll: safe("group", async () => { for (const d of ST.cur.deaths) if (d.status==="pendiente" && !(d.flags||[]).length) await DATA.updateDeath(ST.cur.group.id, d.event_id, {status:"aprobado"}); await reloadGroup(); }),
  copySummary: async b => { try { await navigator.clipboard.writeText($("#sumText").textContent); b.textContent = "Copiado"; } catch(_) { const r = document.createRange(); r.selectNodeContents($("#sumText")); getSelection().removeAllRanges(); getSelection().addRange(r); b.textContent = "Selecciónalo y copia"; } setTimeout(() => b.textContent = "Copiar", 1500); },
};

/* ================= ARRANQUE ================= */
let pollTimer = null, refreshTimer = null;
async function onRoute(){
  ST.msg = {}; ST.confirm = null;
  const r = route();
  clearInterval(pollTimer);
  if (!ST.session || !hasAccess()) return render();
  if (r.name !== "unirse") ST.join = null;
  try {
    if (r.name==="g" && r.arg) {
      if (!ST.cur || ST.cur.group.id !== r.arg) { ST.cur = null; ST.gtab = "members"; ST.dform = {}; render(); }
      ST.cur = await DATA.groupFull(r.arg);
      const g = ST.cur.group;
      if (g.status==="active" && g.mods.deaths) { const tick = () => DATA.fn("poll", {groupId:g.id}).catch(() => {}); tick(); pollTimer = setInterval(tick, 90000); }
    } else if (r.name==="miembros") { ST.profiles = await DATA.profiles(); }
    else if (r.name==="registro") { ST.audit = null; render(); [ST.audit, ST.profiles] = await Promise.all([DATA.audit(), DATA.profiles()]); if (!ST.groups.length) await reloadGroups(); }
    else if (r.name==="unirse" && r.arg && !(ST.join && ST.join.group)) { const g = await DATA.groupByCode(r.arg); if (g) { const full = await DATA.groupFull(g.id); ST.join = {code:r.arg, group:full.group, members:full.members}; } }
    else if (r.name==="" && isMember()) { await reloadGroups(); }
  } catch(e) { ST.msg.group = {t:"No pude cargar: " + e.message, k:"err"}; }
  render();
}
async function syncDiscord(){
  // provider_token = permiso que Discord entrega solo al iniciar sesión
  const tok = (ST.session && ST.session.provider_token) || (DATA.providerToken && DATA.providerToken());
  ST.synced = true;
  if (!tok) { if (!ST.me || !ST.me.discord_checked_at) ST.msg.auth = {t:"Discord no entregó el permiso para revisar tu cuenta. Presiona «Volver a entrar».", k:"warn"}; return; }
  try {
    const r = await DATA.fn("discordSync", {providerToken: tok});
    ST.me = r.profile; if (r.guilds) ST.discordGuilds = r.guilds;
    if (DATA.forgetProviderToken) DATA.forgetProviderToken();
  }
  catch(e) { ST.msg.auth = {t:"No pude verificar tu Discord: " + e.message, k:"err"}; }
}
async function boot(){
  if (!DATA) return render();
  ST.session = await DATA.session();
  const m = /#\/unirse\/([A-Za-z0-9]+)/.exec(location.hash); if (m && !ST.session) { try { sessionStorage.setItem("gremioJoin", m[1]); } catch(_){} }
  DATA.onAuth(async s => { const was = ST.session && ST.session.access_token; ST.session = s; if (s && !was) await loadMe(); else if (!s) { ST.me = null; render(); } });
  if (ST.session) await loadMe(); else render();
  window.addEventListener("hashchange", onRoute);
}
async function loadMe(){
  try {
    [ST.me, ST.settings, ST.types] = await Promise.all([DATA.me(ST.session.user.id), DATA.settings(), DATA.userTypes()]);
    render();
    await syncDiscord();
    DATA.touch();
    if (isMember() || can("users.manage")) ST.profiles = await DATA.profiles();
    if (isMember()) await reloadGroups();
    let pending = null; try { pending = sessionStorage.getItem("gremioJoin"); if (pending && isMember()) sessionStorage.removeItem("gremioJoin"); } catch(_){}
    if (pending && isMember() && !/#\/unirse/.test(location.hash)) { location.hash = `#/unirse/${pending}`; return; }
    if (!ST._sub) { ST._sub = true; DATA.subscribe(() => { clearTimeout(refreshTimer); refreshTimer = setTimeout(async () => {
      try { const r = route(); const a = document.activeElement; if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return;
        await reloadMe(); [ST.settings, ST.types] = await Promise.all([DATA.settings(), DATA.userTypes()]);
        if (r.name==="g") await reloadGroup(); else if (r.name==="" && isMember()) { await reloadGroups(); render(); } else if (r.name==="miembros") { ST.profiles = await DATA.profiles(); render(); } else render();
      } catch(_) {} }, 600); }); }
    await onRoute();
  } catch(e) { $("#app").innerHTML = gate("No pude cargar tu cuenta", `<p class="muted">${esc(e.message)}</p><button class="btn" data-act="reload">Reintentar</button>`); const b = $('[data-act="reload"]'); if (b) b.onclick = () => location.reload(); }
}
boot();
})();
