// Mapa del mundo y cálculo de rutas (compartido por rutas.html y viajes.html)
(() => {
const ZONES = {
  azul:    {label:"Azul",     rank:0},
  amarilla:{label:"Amarilla", rank:1},
  roja:    {label:"Roja",     rank:2},
  negra:   {label:"Negra",    rank:3},
};
// Costo de entrar a un mapa según la preferencia
const PREFS = {
  corta:  {label:"Más corta",  hint:"El menor número de mapas, sin importar el color de la zona.", cost:{azul:1, amarilla:1, roja:1, negra:1}},
  segura: {label:"Más segura", hint:"Da más vueltas si con eso evita zonas rojas y negras.", cost:{azul:1, amarilla:2, roja:12, negra:25}},
  sinfull:{label:"Sin full loot", hint:"Solo azul y amarilla. Si el destino está en zona roja o negra, solo entra al final.", cost:{azul:1, amarilla:2, roja:Infinity, negra:Infinity}},
};
const SERVERS = ["west", "europe", "east"];
const cache = {};

function load(server){
  if (!SERVERS.includes(server)) server = "west";
  if (cache[server]) return cache[server];
  cache[server] = new Promise((resolve, reject) => {
    const have = window.GREMIO_MAPA && window.GREMIO_MAPA[server];
    if (have) return resolve(prep(have));
    const s = document.createElement("script");
    s.src = `mapa/${server}.js`;
    s.onload = () => window.GREMIO_MAPA && window.GREMIO_MAPA[server] ? resolve(prep(window.GREMIO_MAPA[server])) : reject(new Error("mapa vacío"));
    s.onerror = () => { delete cache[server]; reject(new Error("no pude cargar el mapa")); };
    document.head.appendChild(s);
  });
  return cache[server];
}
const AVALON_KIND = {real:"conecta con el continente real", exterior:"conecta con las Tierras Exteriores", escondite:"con escondite", profundo:"camino profundo"};
function prep(raw){
  const nodes = raw.nodes.map(([name, zone, tier, x, y, kind], i) => ({i, name, zone, tier, x, y, kind}));
  // Caminos de Avalon: sin posición ni conexiones fijas (las anota el gremio cada día). Full loot: zona negra.
  (raw.avalon || []).forEach(([name, tier, sub]) => nodes.push({i: nodes.length, name, zone:"negra", tier, x:null, y:null, kind:"avalon", sub}));
  const adj = nodes.map(() => []);
  raw.edges.forEach(([a, b]) => { adj[a].push({to:b}); adj[b].push({to:a}); });
  raw.portals.forEach(([a, b]) => { adj[a].push({to:b, portal:true}); adj[b].push({to:a, portal:true}); });
  const byName = new Map(nodes.map(n => [n.name.toLowerCase(), n]));
  return {nodes, adj, edges:raw.edges, byName, find: q => byName.get(String(q || "").trim().toLowerCase()) || null};
}

// links: conexiones de Avalon anotadas [{a, b, expires_at}] (por nombre). Solo se usan las vigentes.
function linkAdj(M, links){
  const extra = new Map(), now = Date.now();
  (links || []).forEach(l => {
    const a = M.find(l.a), b = M.find(l.b), exp = Date.parse(l.expires_at);
    if (!a || !b || a.i === b.i || !(exp > now)) return;
    const add = (x, y) => { if (!extra.has(x)) extra.set(x, []); extra.get(x).push({to:y, link:l, exp}); };
    add(a.i, b.i); add(b.i, a.i);
  });
  return extra;
}
// La conexión vigente entre dos mapas (fija, portal o de Avalon)
function edgeBetween(M, a, b, links){
  const fixed = M.adj[a].find(e => e.to === b);
  if (fixed) return fixed;
  const ex = (linkAdj(M, links).get(a) || []).filter(e => e.to === b).sort((x, y) => y.exp - x.exp);
  return ex[0] || null;
}

// Dijkstra simple (≈1000 mapas: no hace falta una cola de prioridad)
function route(M, from, to, pref = "segura", avoid = [], links = []){
  const P = PREFS[pref] || PREFS.segura, n = M.nodes.length;
  const bad = new Set(avoid.map(a => typeof a === "number" ? a : (M.find(a) || {}).i).filter(i => i != null && i !== from && i !== to));
  const dist = new Array(n).fill(Infinity), prev = new Array(n).fill(-1), via = new Array(n).fill(false), done = new Array(n).fill(false);
  const extra = linkAdj(M, links);
  dist[from] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || u === to) break;
    done[u] = true;
    for (const e of extra.has(u) ? M.adj[u].concat(extra.get(u)) : M.adj[u]) {
      const v = e.to;
      if (done[v] || bad.has(v)) continue;
      let c = P.cost[M.nodes[v].zone];
      if (!isFinite(c)) { if (v !== to) continue; c = 30; }
      // a igual costo, preferir menos mapas
      const d = dist[u] + c + 0.001;
      if (d < dist[v]) { dist[v] = d; prev[v] = u; via[v] = e.portal ? "portal" : e.link ? e.link : false; }
    }
  }
  if (!isFinite(dist[to])) return null;
  const path = [];
  for (let v = to; v >= 0; v = prev[v]) path.unshift({...M.nodes[v], portal: via[v] === "portal", link: typeof via[v] === "object" ? via[v] : null});
  const counts = {azul:0, amarilla:0, roja:0, negra:0};
  path.forEach(p => counts[p.zone]++);
  const worst = path.reduce((w, p) => ZONES[p.zone].rank > ZONES[w].rank ? p.zone : w, "azul");
  return {path, counts, worst};
}

window.GremioRutas = {ZONES, PREFS, SERVERS, AVALON_KIND, load, route, edgeBetween};
})();
