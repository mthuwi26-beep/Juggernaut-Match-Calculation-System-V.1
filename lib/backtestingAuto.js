// ============================================================
// BACKTESTING AUTOMATICO (Tanda 3)
//
// El servidor calcula solo el semaforo de los partidos que todavia no
// empiezan y lo guarda en registro_sistema (origen "servidor"), para que el
// Backtesting y el aprendizaje no dependan de que alguien abra el partido.
//
// Prioridad (primero lo de arriba, hasta llegar al tope del dia):
//   1) Partidos de los equipos favoritos de los usuarios (los mas marcados primero)
//   2) Copas y competencias importantes (Mundial, Champions, Libertadores...)
//   3) Ligas top (las 5 grandes, Brasil, Colombia...)
//
// Frenos: tope diario de partidos y reserva minima de consultas de la API
// (si quedan menos, se detiene solo para no dejar sin datos a la web ni a la
// app). Los dos se cambian desde el Panel de administrador.
//
// El calculo es EL MISMO de Estudio: mismas consultas, mismo cache (se
// comparten datos con los usuarios) y lib/motor.js, que es copia exacta de
// las formulas de pages/index.js.
// ============================================================
import { supabaseAdmin } from "./supabaseAdmin";
import { obtenerCache, guardarCache, CACHE_3_HORAS, CACHE_30_MINUTOS, CACHE_PARA_SIEMPRE } from "./cacheApi";
import { pedirApi } from "./futbolServidor";
import { competicionDe } from "./competiciones";
import { modeloValido } from "./verificacion";

const motor = require("./motor");

export const CONFIG_POR_DEFECTO = { activo: true, tope: 60, reserva: 1500 };
const VENTANA_HORAS = 30;
const MINUTOS_MINIMOS_ANTES = 15;

// Competencias importantes que no estan en COMPETICIONES_TOP
const IMPORTANTES_EXTRA = [
  { puntos: 3000, coincide: (n) => n.includes("world cup") && n.includes("qualif") },
  { puntos: 3000, coincide: (n) => n.includes("copa america") },
  { puntos: 3000, coincide: (n) => n.includes("euro championship") },
  { puntos: 2000, coincide: (n, p) => n.includes("primera a") && p === "colombia" },
  { puntos: 1000, coincide: (n) => n.includes("nations league") },
  { puntos: 1000, coincide: (n) => n.includes("conference league") },
];
const PUNTOS_POR_NIVEL = { 1: 3000, 2: 2000, 3: 1000 };

// ---------- Configuracion y consumo ----------
export async function leerConfig() {
  const { data, error } = await supabaseAdmin
    .from("configuracion_app")
    .select("plan_api, backtesting_auto_activo, backtesting_auto_tope, backtesting_auto_reserva")
    .eq("id", 1)
    .maybeSingle();
  if (error) return { ...CONFIG_POR_DEFECTO, activo: false, sinSql: true, planApi: "gratis" };
  return {
    activo: data?.backtesting_auto_activo !== false,
    tope: Number.isFinite(data?.backtesting_auto_tope) ? data.backtesting_auto_tope : CONFIG_POR_DEFECTO.tope,
    reserva: Number.isFinite(data?.backtesting_auto_reserva) ? data.backtesting_auto_reserva : CONFIG_POR_DEFECTO.reserva,
    planApi: data?.plan_api || "gratis",
  };
}

// Consultas que le quedan HOY al plan de API-Football (el endpoint status no gasta cuota)
export async function consultasRestantes() {
  try {
    const r = await fetch("https://v3.football.api-sports.io/status", {
      headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY },
    });
    const d = await r.json();
    const req = d?.response?.requests;
    if (!req || !Number.isFinite(req.limit_day) || !Number.isFinite(req.current)) return null;
    return { restantes: req.limit_day - req.current, limite: req.limit_day, usadas: req.current };
  } catch {
    return null;
  }
}

function inicioDelDiaUtc() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function calculadosHoy() {
  const { count } = await supabaseAdmin
    .from("registro_sistema")
    .select("fixture_id", { count: "exact", head: true })
    .eq("origen", "servidor")
    .gte("registrado_en", inicioDelDiaUtc());
  return count || 0;
}

// ---------- Datos (mismo cache que /api/fixtures y /api/estadisticas-partido) ----------
function crearContador() {
  return { consultas: 0, inicio: Date.now() };
}

// Ritmo maximo del calculo automatico: 3 consultas por segundo (180 por
// minuto). El plan Pro de la API permite unas 300 por minuto, asi que queda
// espacio de sobra para la web y la app aunque este calculando.
const CONSULTAS_POR_SEGUNDO = 3;
async function respetarRitmo(contador) {
  const debioTardar = (contador.consultas / CONSULTAS_POR_SEGUNDO) * 1000;
  const tardo = Date.now() - contador.inicio;
  if (debioTardar > tardo) await new Promise((r) => setTimeout(r, debioTardar - tardo));
}

async function fixturesEquipo(teamId, planApi, contador) {
  const esPro = planApi === "pro";
  const temporada = esPro ? new Date().getFullYear() : 2024;
  const clave = `fixtures:${teamId}:${temporada}`;
  const cacheado = await obtenerCache(clave);
  if (cacheado) return cacheado;
  await respetarRitmo(contador);
  contador.consultas++;
  const partidos = await pedirApi(`fixtures?team=${teamId}&season=${temporada}`);
  const jugados = partidos
    .filter((f) => f.fixture.status.short === "FT")
    .sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date))
    .slice(0, 10);
  await guardarCache(clave, jugados, esPro ? CACHE_3_HORAS : CACHE_PARA_SIEMPRE);
  return jugados;
}

async function estadisticas(fixtureId, contador) {
  const clave = `estadisticas-partido:${fixtureId}`;
  const cacheado = await obtenerCache(clave);
  if (cacheado) return cacheado;
  await respetarRitmo(contador);
  contador.consultas++;
  const datos = await pedirApi(`fixtures/statistics?fixture=${fixtureId}`);
  await guardarCache(clave, datos, datos.length > 0 ? CACHE_PARA_SIEMPRE : CACHE_30_MINUTOS);
  return datos;
}

// ---------- El calculo (igual que PanelSemaforo en pages/index.js) ----------
export async function calcularModeloServidor(partido, planApi, contador) {
  const idLocal = partido.teams.home.id;
  const idVisitante = partido.teams.away.id;
  const [fixturesLocal, fixturesVisitante] = await Promise.all([
    fixturesEquipo(idLocal, planApi, contador),
    fixturesEquipo(idVisitante, planApi, contador),
  ]);
  if (!fixturesLocal.length || !fixturesVisitante.length) return null;

  // Datos puntuales de los partidos de los dos equipos (como cargarDatosPuntuales)
  const idsUnicos = new Map();
  [...fixturesLocal, ...fixturesVisitante].forEach((f) => idsUnicos.set(f.fixture.id, f.teams.home.id));
  const entradas = Array.from(idsUnicos.entries());
  const statsMap = {};
  let exitos = 0;
  for (let i = 0; i < entradas.length; i += 5) {
    const grupo = entradas.slice(i, i + 5);
    const resultados = await Promise.all(
      grupo.map(([fixtureId]) => estadisticas(fixtureId, contador).catch(() => null))
    );
    resultados.forEach((datos, k) => {
      const [fixtureId, homeTeamId] = grupo[k];
      const procesado = datos ? motor.procesarEstadisticasPartido(datos, homeTeamId) : null;
      if (procesado) {
        statsMap[fixtureId] = procesado;
        exitos++;
      }
    });
  }

  const h2h = motor.calcularHeadToHead(fixturesLocal, fixturesVisitante, idLocal, idVisitante);
  const competicion = { id: partido.league?.id, season: partido.league?.season, nombre: partido.league?.name };
  const esPartidoLiga = motor.esLiga({ league: { name: competicion.nombre } });
  const fuentesLocal = motor.construirFuentesEquipo(fixturesLocal, idLocal, statsMap, competicion);
  const fuentesVisitante = motor.construirFuentesEquipo(fixturesVisitante, idVisitante, statsMap, competicion);
  const partidosH2H = h2h?.partidos || [];
  const h2hGolesLocal = motor.calcularGolesNumerico(partidosH2H, idLocal);
  const h2hGolesVisitante = motor.calcularGolesNumerico(partidosH2H, idVisitante);
  const h2hPuntualesLocal = motor.calcularPuntualesNumerico(partidosH2H, idLocal, statsMap);
  const h2hPuntualesVisitante = motor.calcularPuntualesNumerico(partidosH2H, idVisitante, statsMap);

  function armarMotor(fuentesEq, actualClave, contrariaClave, h2hGoles, h2hPuntuales) {
    const de = (m, h) => ({
      actual: fuentesEq[actualClave][m], contraria: fuentesEq[contrariaClave][m], liga: fuentesEq.liga[m],
      noLiga: fuentesEq.noLiga[m], temporada: fuentesEq.temporada[m], forma: fuentesEq.forma[m], h2h: h,
    });
    return {
      goles: de("goles", h2hGoles),
      corners: de("corners", h2hPuntuales.corners),
      amarillas: de("amarillas", h2hPuntuales.amarillas),
      faltas: de("faltas", h2hPuntuales.faltas),
    };
  }
  const motorLocal = armarMotor(fuentesLocal, "local", "visitante", h2hGolesLocal, h2hPuntualesLocal);
  const motorVisitante = armarMotor(fuentesVisitante, "visitante", "local", h2hGolesVisitante, h2hPuntualesVisitante);

  const lambda = (mercado, m) => motor.calcularValorEsperado(m[mercado], esPartidoLiga);
  const total = (mercado) => {
    const a = lambda(mercado, motorLocal);
    const b = lambda(mercado, motorVisitante);
    return a !== null && b !== null ? a + b : null;
  };
  const r3 = (x) => (x === null || x === undefined ? null : Math.round(x * 1000) / 1000);
  const proporcion = entradas.length > 0 ? exitos / entradas.length : 0;

  return {
    gl: r3(lambda("goles", motorLocal)),
    gv: r3(lambda("goles", motorVisitante)),
    corners: r3(total("corners")),
    amarillas: r3(total("amarillas")),
    faltas: r3(total("faltas")),
    handicap: 0,
    clima: false,
    // Misma regla que advertenciaMuestra en la web
    muestraInsuficiente: entradas.length === 0 || exitos < 5 || proporcion < 0.5,
  };
}

// ---------- Que partidos calcular ----------
async function partidosDelDia(fechaIso, contador) {
  const clave = `bt-auto-dia:${fechaIso}`;
  const cacheado = await obtenerCache(clave);
  if (cacheado) return cacheado;
  await respetarRitmo(contador);
  contador.consultas++;
  const lista = await pedirApi(`fixtures?date=${fechaIso}`);
  // Solo lo necesario, para no guardar miles de partidos completos en el cache
  const livianos = lista
    .filter((p) => ["NS", "TBD"].includes(p.fixture?.status?.short))
    .map((p) => ({
      fixture: { id: p.fixture.id, date: p.fixture.date, status: p.fixture.status },
      league: { id: p.league?.id, season: p.league?.season, name: p.league?.name, country: p.league?.country },
      teams: { home: { id: p.teams?.home?.id, name: p.teams?.home?.name }, away: { id: p.teams?.away?.id, name: p.teams?.away?.name } },
    }));
  await guardarCache(clave, livianos, CACHE_30_MINUTOS);
  return livianos;
}

async function contarFavoritos() {
  const { data } = await supabaseAdmin.from("favoritos").select("team_id").limit(20000);
  const cuenta = {};
  (data || []).forEach((f) => { cuenta[f.team_id] = (cuenta[f.team_id] || 0) + 1; });
  return cuenta;
}

function puntosCompeticion(partido) {
  const n = (partido.league?.name || "").toLowerCase();
  const p = (partido.league?.country || "").toLowerCase();
  const top = competicionDe(partido.league?.name, partido.league?.country);
  let puntos = top ? PUNTOS_POR_NIVEL[top.nivel] || 0 : 0;
  IMPORTANTES_EXTRA.forEach((c) => { if (c.coincide(n, p)) puntos = Math.max(puntos, c.puntos); });
  return puntos;
}

export async function partidosCandidatos(contador) {
  const ahora = Date.now();
  const hoy = new Date(ahora).toISOString().slice(0, 10);
  const manana = new Date(ahora + 24 * 3600 * 1000).toISOString().slice(0, 10);
  const [a, b, favoritos] = await Promise.all([
    partidosDelDia(hoy, contador),
    partidosDelDia(manana, contador),
    contarFavoritos(),
  ]);
  const desde = ahora + MINUTOS_MINIMOS_ANTES * 60 * 1000;
  const hasta = ahora + VENTANA_HORAS * 3600 * 1000;
  const vistos = new Set();
  const lista = [];
  for (const p of [...a, ...b]) {
    if (vistos.has(p.fixture.id)) continue;
    vistos.add(p.fixture.id);
    const inicio = new Date(p.fixture.date).getTime();
    if (!(inicio > desde && inicio < hasta)) continue;
    const fav = (favoritos[p.teams.home.id] || 0) + (favoritos[p.teams.away.id] || 0);
    const puntos = (fav > 0 ? 10000 + fav * 10 : 0) + puntosCompeticion(p);
    if (puntos > 0) lista.push({ partido: p, puntos, inicio });
  }
  // Se quitan los que ya estan registrados (los abrio alguien o ya se calcularon)
  const ids = lista.map((x) => x.partido.fixture.id);
  const yaRegistrados = new Set();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabaseAdmin.from("registro_sistema").select("fixture_id").in("fixture_id", ids.slice(i, i + 200));
    (data || []).forEach((r) => yaRegistrados.add(Number(r.fixture_id)));
  }
  return lista
    .filter((x) => !yaRegistrados.has(Number(x.partido.fixture.id)))
    .sort((x, y) => y.puntos - x.puntos || x.inicio - y.inicio);
}

// ---------- Un turno de trabajo ----------
// maximo: cuantos partidos como mucho en este turno; hastaMs: hora limite
// (las funciones de Vercel tienen tiempo maximo).
export async function ejecutarTurno({ maximo, hastaMs, forzar = false }) {
  const config = await leerConfig();
  if (config.sinSql) return { hechos: 0, motivo: "Falta correr el SQL de la Tanda 3" };
  if (!config.activo && !forzar) return { hechos: 0, motivo: "Apagado desde el panel" };

  const api = await consultasRestantes();
  if (api && api.restantes < config.reserva) {
    return { hechos: 0, motivo: `Quedan ${api.restantes} consultas de la API (reserva: ${config.reserva})`, api };
  }
  const hoy = await calculadosHoy();
  const cupo = config.tope - hoy;
  if (cupo <= 0) return { hechos: 0, motivo: "Ya se llegó al tope de hoy", hoy, tope: config.tope, api };

  const contador = crearContador();
  const candidatos = await partidosCandidatos(contador);
  let hechos = 0;
  for (const { partido } of candidatos) {
    if (hechos >= Math.min(maximo, cupo) || Date.now() > hastaMs) break;
    // Freno por cuota: cada partido gasta como maximo ~22 consultas
    if (api && api.restantes - contador.consultas - 22 < config.reserva) break;
    try {
      const modelo = await calcularModeloServidor(partido, config.planApi, contador);
      if (!modeloValido(modelo)) continue;
      await supabaseAdmin.from("registro_sistema").upsert({
        fixture_id: partido.fixture.id,
        liga: partido.league?.name || null,
        liga_id: partido.league?.id || null,
        pais: partido.league?.country || null,
        equipo_local: partido.teams?.home?.name || null,
        equipo_visitante: partido.teams?.away?.name || null,
        equipo_local_id: partido.teams?.home?.id || null,
        equipo_visitante_id: partido.teams?.away?.id || null,
        fecha_partido: partido.fixture.date,
        modelo,
        origen: "servidor",
        registrado_en: new Date().toISOString(),
        resultado: "pendiente",
      });
      hechos++;
    } catch {
      // si falla uno (por ejemplo, la API no responde), se sigue con el resto
    }
  }
  return {
    hechos,
    hoy: hoy + hechos,
    tope: config.tope,
    pendientes: Math.max(0, candidatos.length - hechos),
    consultasGastadas: contador.consultas,
    api,
  };
}
