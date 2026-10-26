// Gremio Albion Online — acceso compartido para las herramientas (calculadora y viajes)
(() => {
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const CFG = window.GREMIO_CONFIG || {};
const configured = CFG.supabaseUrl && !/TU_PROYECTO/.test(CFG.supabaseUrl) && CFG.supabaseKey && !/PEGA_AQUI/.test(CFG.supabaseKey);
const MOCK = window.__GREMIO_MOCK;
const sb = !MOCK && configured ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, {auth:{flowType:"pkce", persistSession:true, autoRefreshToken:true, detectSessionInUrl:false}}) : null;

async function fn(action, payload={}){
  if (MOCK) return MOCK.fn(action, payload);
  const {data, error} = await sb.functions.invoke("albion", {body:{action, ...payload}});
  if (error) { let msg = error.message; try { const j = await error.context.json(); msg = j.error || msg; } catch(_){} throw new Error(msg); }
  if (data && data.error) throw new Error(data.error);
  return data;
}
// Mismas reglas que la base de datos (la base de datos y el servidor son los que mandan)
function permAllowed(me, s, perms, perm){
  s = s || {};
  if (!me || ["bloqueado","pendiente"].includes(me.role)) return false;
  const base = (!s.require_discord_server || me.discord_in_server) && (!s.require_mfa_all || me.discord_mfa);
  return base && (me.role === "admin" || (perms || []).includes(perm));
}
const toolAllowed = (me, s, perms, tool) => permAllowed(me, s, perms, "tool." + tool);

// Caminos de Avalon anotados por el gremio
const avalon = {
  async list(server){
    if (MOCK) return MOCK.avalonList(server);
    const {data, error} = await sb.from("avalon_links").select("id,a,b,expires_at,created_name,created_at")
      .eq("server", server).gt("expires_at", new Date().toISOString()).order("expires_at");
    if (error) throw new Error(error.message);
    return data;
  },
  async add(server, a, b, minutes){
    const expires_at = new Date(Date.now() + minutes * 60000).toISOString();
    if (MOCK) return MOCK.avalonAdd({server, a, b, expires_at});
    const {error} = await sb.from("avalon_links").insert({server, a, b, expires_at});
    if (error) throw new Error(/row-level security/.test(error.message) ? "No tienes permiso para anotar caminos." : error.message);
  },
  async remove(id){
    if (MOCK) return MOCK.avalonDel(id);
    const {error} = await sb.from("avalon_links").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
  // Avisa cuando alguien del gremio anota o borra (devuelve una función para dejar de escuchar)
  watch(server, cb){
    if (MOCK || !sb) return () => {};
    const ch = sb.channel("avalon-" + server)
      .on("postgres_changes", {event:"*", schema:"public", table:"avalon_links"}, () => cb())
      .subscribe();
    return () => sb.removeChannel(ch);
  },
};

async function guard(tool, label){
  const bar = document.getElementById("gbar"), gate = document.getElementById("gate"), body = document.getElementById("tool");
  const say = (title, html) => { gate.hidden = false; body.hidden = true; gate.innerHTML = `<h1>${esc(title)}</h1>${html}<p><a class="gbtn" href="index.html">Ir a Gremio Albion</a></p>`; };
  if (!MOCK && !sb) { say("Falta configurar", "<p>Edita <b>config.js</b> con los datos de tu proyecto de Supabase.</p>"); throw new Error("sin configurar"); }
  let me, settings, perms = [];
  try {
    const session = MOCK ? await MOCK.session() : (await sb.auth.getSession()).data.session;
    if (!session) { say("Inicia sesión primero", "<p>Entra con Discord en la página principal y vuelve a abrir esta herramienta.</p>"); throw new Error("sin sesión"); }
    if (MOCK) { [me, settings] = await Promise.all([MOCK.me(session.user.id), MOCK.settings()]); perms = ((await MOCK.userTypes()).find(t => t.key === me.role) || {}).perms || []; }
    else {
      const [a, b] = await Promise.all([sb.from("profiles").select("*").eq("id", session.user.id).single(), sb.from("settings").select("*").eq("id", 1).single()]);
      if (a.error) throw new Error(a.error.message); if (b.error) throw new Error(b.error.message);
      me = a.data; settings = b.data;
      const t = await sb.from("user_types").select("perms").eq("key", me.role).maybeSingle();
      perms = (t.data && t.data.perms) || [];
    }
  } catch(e) { if (!/sin sesión/.test(e.message)) say("No pude cargar tu cuenta", `<p>${esc(e.message)}</p>`); throw e; }
  bar.innerHTML = `<a href="index.html">← Gremio Albion</a><span><b>${esc(label)}</b></span><span class="gme">${esc(me.albion_name || me.discord_name)}</span>`;
  if (!toolAllowed(me, settings, perms, tool)) {
    say("Sin acceso", `<p>Tu tipo de usuario no tiene acceso a <b>${esc(label)}</b>. Pídele al administrador que lo habilite.</p>`);
    throw new Error("sin acceso");
  }
  gate.hidden = true; body.hidden = false;
  return {me, settings, perms};
}
window.GremioCommon = {fn, guard, toolAllowed, permAllowed, avalon, esc};
})();
