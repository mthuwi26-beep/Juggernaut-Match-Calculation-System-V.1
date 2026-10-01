// ============================================================
// Tablas de posiciones (API-Football /standings), ya ordenadas y traducidas
// para la web y la app:
//   tablasDeLiga(liga, temporada) -> un torneo con todas sus tablas
//   tablasDeEquipo(equipo)        -> todos los torneos que juega un equipo
// Todo pasa por el cache (cache_api), asi que muchos usuarios mirando la
// misma tabla gastan una sola consulta.
// ============================================================
import { obtenerCache, guardarCache, CACHE_30_MINUTOS, CACHE_2_HORAS } from "./cacheApi";
import { pedirApi } from "./futbolServidor";

// Colores de las zonas (iguales en la web y la app)
export const COLORES_ZONA = {
  maxima: "#3b82f6", // Champions / Libertadores
  segunda: "#f59e0b", // Europa League / Sudamericana
  tercera: "#22c55e", // Conference / ascenso
  playoffs: "#a855f7",
  siguiente: "#14b8a6", // pasa a la siguiente fase
  descenso: "#ef4444",
  otra: "#9ca3af",
};

function traducirFase(texto) {
  return texto
    .replace(/[:\s]+$/, "")
    .replace(/Knockout Round Play-?offs?/i, "el repechaje")
    .replace(/Round of 32/i, "dieciseisavos de final")
    .replace(/Round of 16|8th Finals|Last 16/i, "octavos de final")
    .replace(/Quarter-?finals?/i, "cuartos de final")
    .replace(/Semi-?finals?/i, "semifinales")
    .replace(/^Final$/i, "la final")
    .replace(/Group Stage/i, "fase de grupos")
    .replace(/League phase|League Stage/i, "fase de liga")
    .replace(/Qualification|Qualifying/i, "fase previa")
    .replace(/Play[- ]?offs?/i, "playoffs")
    .replace(/Knockout Round/i, "fase eliminatoria");
}

// Convierte la descripcion en ingles de la API en tipo de zona + texto en espanol
export function zonaDe(descripcion, nombreLiga) {
  if (!descripcion) return null;
  const d = descripcion;
  const fase = ((d.match(/\(([^)]+)\)/) || [])[1] || "").replace(/[:\s]+$/, "") || undefined;
  const conFase = (base) => (fase ? `${base} (${traducirFase(fase)})` : base);
  // Si la descripcion habla del mismo torneo (ej. dentro de la Libertadores:
  // "Promotion - CONMEBOL Libertadores (Round of 16)"), es pasar de fase.
  const palabraClave = (nombreLiga || "").replace(/^(CONMEBOL|UEFA|CONCACAF|CAF|AFC)\s+/i, "").trim().toLowerCase();
  if (palabraClave && d.toLowerCase().includes(palabraClave) && !/relegation/i.test(d)) {
    if (fase && /play ?offs?/i.test(fase) && !/final|round of|quarter|semi/i.test(fase)) return { tipo: "playoffs", texto: "Clasifica a playoffs / cuadrangulares" };
    if (fase && /play ?offs?/i.test(fase)) return { tipo: "playoffs", texto: `Clasifica a los playoffs (${traducirFase(fase.replace(/^Play ?offs?:?\s*/i, ""))})` };
    return { tipo: "siguiente", texto: fase ? `Pasa a ${traducirFase(fase)}`.replace("Pasa a el ", "Pasa al ") : "Pasa a la siguiente fase" };
  }
  if (/relegation round/i.test(d)) return { tipo: "descenso", texto: "Repechaje por el descenso" };
  if (/relegation/i.test(d)) return { tipo: "descenso", texto: "Descenso" };
  if (/champions league/i.test(d)) return { tipo: "maxima", texto: conFase("Clasifica a la Champions League") };
  if (/libertadores/i.test(d)) return { tipo: "maxima", texto: conFase("Clasifica a la Copa Libertadores") };
  if (/europa league/i.test(d)) return { tipo: "segunda", texto: conFase("Clasifica a la Europa League") };
  if (/sudamericana/i.test(d)) return { tipo: "segunda", texto: conFase("Clasifica a la Copa Sudamericana") };
  if (/conference/i.test(d)) return { tipo: "tercera", texto: conFase("Clasifica a la Conference League") };
  if (/play[- ]?off|final series|playoffs/i.test(d)) return { tipo: "playoffs", texto: "Clasifica a playoffs / cuadrangulares" };
  if (/next round|round of|quarter|semi|knockout|8th finals|last 16/i.test(d)) return { tipo: "siguiente", texto: "Pasa a la siguiente fase" };
  if (/promotion/i.test(d)) return { tipo: "tercera", texto: "Ascenso / clasificaci\u00f3n" };
  return { tipo: "otra", texto: d };
}

function tituloTabla(grupo, nombreLiga, cantidad) {
  let t = (grupo || "").trim();
  if (nombreLiga && t.toLowerCase().startsWith(nombreLiga.toLowerCase() + ":")) t = t.slice(nombreLiga.length + 1).trim();
  t = t.replace(/^Group\s+/i, "Grupo ").replace(/^Regular Season/i, "Fase regular").replace(/^League Stage/i, "Fase de liga");
  if (!t || t.toLowerCase() === (nombreLiga || "").toLowerCase()) return cantidad > 1 ? "Tabla" : "Tabla general";
  return t;
}

function normalizarLiga(item) {
  const liga = item?.league;
  if (!liga || !Array.isArray(liga.standings)) return null;
  const tablas = liga.standings
    .filter((g) => Array.isArray(g) && g.length > 1)
    .map((grupo) => ({
      titulo: tituloTabla(grupo[0]?.group, liga.name, liga.standings.length),
      filas: grupo.map((f) => ({
        pos: f.rank,
        id: f.team?.id,
        nombre: f.team?.name,
        logo: f.team?.logo,
        pj: f.all?.played ?? 0,
        g: f.all?.win ?? 0,
        e: f.all?.draw ?? 0,
        p: f.all?.lose ?? 0,
        gf: f.all?.goals?.for ?? 0,
        gc: f.all?.goals?.against ?? 0,
        dg: f.goalsDiff ?? 0,
        pts: f.points ?? 0,
        forma: (f.form || "").slice(-5),
        zona: zonaDe(f.description, liga.name),
      })),
    }));
  if (tablas.length === 0) return null;
  return {
    id: liga.id,
    nombre: liga.name,
    logo: liga.logo,
    pais: liga.country,
    bandera: liga.flag,
    temporada: liga.season,
    tablas,
  };
}

// Un torneo con todas sus tablas (null si no tiene tabla, ej. copas por llaves)
export async function tablasDeLiga(liga, temporada) {
  const clave = `posiciones:liga:${liga}:${temporada}`;
  const cacheado = await obtenerCache(clave);
  if (cacheado !== null && cacheado !== undefined) return cacheado.torneo || null;
  const respuesta = await pedirApi(`standings?league=${liga}&season=${temporada}`);
  const torneo = normalizarLiga(respuesta[0]);
  await guardarCache(clave, { torneo }, CACHE_30_MINUTOS);
  return torneo;
}

// Todos los torneos (con tabla) que juega un equipo ahora.
// Se consulta el anio actual y el anterior (las ligas europeas se nombran por
// el anio en que empiezan); de cada torneo queda la temporada mas reciente, y
// se descartan las temporadas viejas que ya no se actualizan hace mas de 75 dias.
export async function tablasDeEquipo(equipo) {
  const clave = `posiciones:equipo:${equipo}`;
  const cacheado = await obtenerCache(clave);
  if (cacheado) return cacheado.torneos || [];

  const anio = new Date().getUTCFullYear();
  const porLiga = {};
  for (const temporada of [anio, anio - 1]) {
    let respuesta = [];
    try {
      respuesta = await pedirApi(`standings?team=${equipo}&season=${temporada}`);
    } catch {
      respuesta = [];
    }
    for (const item of respuesta) {
      const liga = item?.league;
      if (!liga?.id) continue;
      const filas = (liga.standings || []).flat();
      const ultima = filas.map((f) => Date.parse(f.update || "")).filter((x) => !isNaN(x)).sort((a, b) => b - a)[0];
      const vigente = !ultima || Date.now() - ultima < 75 * 86400000;
      if (!vigente) continue;
      if (!porLiga[liga.id] || porLiga[liga.id] < liga.season) porLiga[liga.id] = liga.season;
    }
  }

  const torneos = [];
  for (const [liga, temporada] of Object.entries(porLiga)) {
    try {
      const torneo = await tablasDeLiga(liga, temporada);
      if (torneo) torneos.push(torneo);
    } catch {
      // si una tabla falla, se muestran las demas
    }
  }
  // Primero la liga local (la de mas equipos suele ser la liga), luego el resto
  torneos.sort((a, b) => {
    const ta = Math.max(...a.tablas.map((t) => t.filas.length));
    const tb = Math.max(...b.tablas.map((t) => t.filas.length));
    return (b.tablas.length === 1 ? 1 : 0) - (a.tablas.length === 1 ? 1 : 0) || tb - ta;
  });
  await guardarCache(clave, { torneos }, CACHE_2_HORAS);
  return torneos;
}
