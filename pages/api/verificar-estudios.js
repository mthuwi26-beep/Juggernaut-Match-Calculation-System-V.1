// ============================================================
// Verifica solos los estudios guardados en "Mis Estudios".
// - La app y la pagina lo llaman al abrir Mis Estudios, con el token de la
//   sesion del usuario: verifica solo los estudios de ese usuario.
// - Ademas, una vez al dia lo llama Vercel (cron) con CRON_SECRET: verifica
//   los pendientes de todos.
// El resultado lo escribe el servidor (service role): nadie puede marcarse
// aciertos a mano.
// ============================================================
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { obtenerCache, guardarCache, CACHE_3_MINUTOS, CACHE_30_MINUTOS, CACHE_12_HORAS, CACHE_PARA_SIEMPRE } from "../../lib/cacheApi";
import { evaluarModelo, evaluarLegado, sumarEstadistica } from "../../lib/verificacion";

const FINALIZADOS = ["FT", "AET", "PEN"];
const ANULADOS = ["CANC", "ABD", "AWD", "WO"];
const TIEMPO_MAXIMO_MS = 8000; // margen para el limite de tiempo de Vercel
const DIA_MS = 24 * 60 * 60 * 1000;

async function pedirApi(ruta) {
  const respuesta = await fetch(`https://v3.football.api-sports.io/${ruta}`, {
    headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY },
  });
  const data = await respuesta.json();
  if (data.errors && Object.keys(data.errors).length > 0) throw new Error(JSON.stringify(data.errors));
  return data.response || [];
}

// Misma clave de cache que /api/partido-por-id, para aprovechar lo ya guardado.
async function partidoPorId(fixtureId) {
  const clave = `partido-por-id:${fixtureId}`;
  const cacheado = await obtenerCache(clave);
  if (cacheado) return cacheado;
  const partido = (await pedirApi(`fixtures?id=${fixtureId}`))[0] || null;
  if (partido) {
    const estado = partido.fixture?.status?.short;
    await guardarCache(clave, partido, FINALIZADOS.includes(estado) || ANULADOS.includes(estado) ? CACHE_PARA_SIEMPRE : CACHE_3_MINUTOS);
  }
  return partido;
}

async function estadisticas(fixtureId) {
  const clave = `estadisticas-partido:${fixtureId}`;
  const cacheado = await obtenerCache(clave);
  if (cacheado) return cacheado;
  const datos = await pedirApi(`fixtures/statistics?fixture=${fixtureId}`);
  await guardarCache(clave, datos, datos.length > 0 ? CACHE_PARA_SIEMPRE : CACHE_30_MINUTOS);
  return datos;
}

// Estudios viejos sin el ID del partido: se busca, entre los enfrentamientos
// de esos dos equipos, el que se jugo mas cerca despues de guardar el estudio.
async function buscarPartidoPorEquipos(p) {
  if (!p.equipo_local_id || !p.equipo_visitante_id) return { partido: null, definitivo: true };
  const clave = `h2h-verificacion:${p.equipo_local_id}-${p.equipo_visitante_id}`;
  let lista = await obtenerCache(clave);
  if (!lista) {
    lista = await pedirApi(`fixtures?h2h=${p.equipo_local_id}-${p.equipo_visitante_id}`);
    await guardarCache(clave, lista, CACHE_12_HORAS);
  }
  const guardado = new Date(p.created_at).getTime();
  const candidatos = lista
    .map((f) => ({ f, t: new Date(f.fixture?.date).getTime() }))
    .filter(({ t }) => t >= guardado - 3 * DIA_MS && t <= guardado + 21 * DIA_MS)
    .sort((a, b) => Math.abs(a.t - guardado) - Math.abs(b.t - guardado));
  if (candidatos.length > 0) return { partido: candidatos[0].f, definitivo: true };
  // Si el estudio es reciente, el partido puede no estar programado aun: se espera.
  return { partido: null, definitivo: Date.now() - guardado > 21 * DIA_MS };
}

async function verificarUno(p) {
  let partido = null;
  if (p.fixture_id) {
    partido = await partidoPorId(p.fixture_id);
  } else {
    const r = await buscarPartidoPorEquipos(p);
    if (!r.partido) {
      if (r.definitivo) return { resultado: "sin_partido", verificado_en: new Date().toISOString() };
      return null;
    }
    partido = r.partido;
  }
  if (!partido) return null;

  const estado = partido.fixture?.status?.short;
  const cambiosBase = { fixture_id: partido.fixture.id, fecha_partido: partido.fixture.date };
  if (ANULADOS.includes(estado)) {
    return { ...cambiosBase, resultado: "anulado", verificado_en: new Date().toISOString() };
  }
  if (!FINALIZADOS.includes(estado)) {
    // Aun no termina: solo se guarda el partido encontrado, sigue pendiente.
    return p.fixture_id ? null : cambiosBase;
  }

  // Goles a los 90 minutos (asi se liquidan los mercados), si la API los trae.
  const tiempoReglamentario = partido.score?.fulltime;
  let golesCasa = tiempoReglamentario?.home ?? partido.goals?.home;
  let golesFuera = tiempoReglamentario?.away ?? partido.goals?.away;
  if (golesCasa === null || golesCasa === undefined || golesFuera === null || golesFuera === undefined) return null;

  // Si el usuario estudio los equipos al reves (visitante como local), se voltea.
  const alReves =
    partido.teams?.home?.id === p.equipo_visitante_id && partido.teams?.away?.id === p.equipo_local_id;
  const real = {
    golesLocal: alReves ? golesFuera : golesCasa,
    golesVisitante: alReves ? golesCasa : golesFuera,
    corners: null,
    amarillas: null,
    faltas: null,
  };
  try {
    const stats = await estadisticas(partido.fixture.id);
    real.corners = sumarEstadistica(stats, "Corner Kicks");
    real.amarillas = sumarEstadistica(stats, "Yellow Cards");
    real.faltas = sumarEstadistica(stats, "Fouls");
  } catch {
    // sin estadisticas: esos mercados simplemente no cuentan
  }

  const nombres = { local: p.equipo_local, visitante: p.equipo_visitante };
  const detalle = p.modelo ? evaluarModelo(p.modelo, real, nombres) : evaluarLegado(p, real, nombres);
  const acertados = detalle.filter((d) => d.acierto).length;
  const antes = new Date(p.created_at).getTime() < new Date(partido.fixture.date).getTime();

  return {
    ...cambiosBase,
    resultado: detalle.length === 0 ? "sin_pronostico" : antes ? "verificado" : "referencia",
    antes_del_partido: antes,
    mercados_evaluados: detalle.length,
    mercados_acertados: acertados,
    porcentaje_acierto: detalle.length > 0 ? Math.round((acertados / detalle.length) * 1000) / 10 : null,
    detalle_verificacion: detalle,
    marcador_final: `${real.golesLocal}-${real.golesVisitante}`,
    verificado_en: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  const inicio = Date.now();
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return res.status(401).json({ error: "Falta la sesión" });

  let userId = null;
  const esCron = !!process.env.CRON_SECRET && token === process.env.CRON_SECRET;
  if (!esCron) {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: "Sesión no válida" });
    userId = data.user.id;
  }

  let consulta = supabaseAdmin
    .from("predicciones")
    .select("*")
    .eq("resultado", "pendiente")
    .order("created_at", { ascending: true })
    .limit(esCron ? 60 : 15);
  if (userId) consulta = consulta.eq("user_id", userId);
  const { data: pendientes, error } = await consulta;
  if (error) return res.status(500).json({ error: "No se pudieron leer los estudios" });

  let verificados = 0;
  let revisados = 0;
  for (const p of pendientes || []) {
    if (Date.now() - inicio > TIEMPO_MAXIMO_MS) break;
    revisados++;
    try {
      const cambios = await verificarUno(p);
      if (cambios) {
        await supabaseAdmin.from("predicciones").update(cambios).eq("id", p.id);
        if (cambios.resultado && cambios.resultado !== "pendiente") verificados++;
      }
    } catch {
      // si falla uno (por ejemplo la API), se intenta de nuevo en la proxima llamada
    }
  }

  res.status(200).json({ revisados, verificados, pendientes: (pendientes || []).length - verificados });
}
