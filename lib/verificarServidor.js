// Verificación compartida: la usan /api/verificar-estudios (Mis Estudios y
// el registro del sistema) y /api/backtesting.
import { supabaseAdmin } from "./supabaseAdmin";
import { obtenerCache, guardarCache, CACHE_12_HORAS } from "./cacheApi";
import { evaluarModelo, evaluarLegado, sumarEstadistica } from "./verificacion";
import { pedirApi, partidoPorId, estadisticasPartido, resultadoReal, FINALIZADOS, ANULADOS } from "./futbolServidor";

const DIA_MS = 24 * 60 * 60 * 1000;

async function completarEstadisticas(real, fixtureId) {
  try {
    const stats = await estadisticasPartido(fixtureId);
    real.corners = sumarEstadistica(stats, "Corner Kicks");
    real.amarillas = sumarEstadistica(stats, "Yellow Cards");
    real.faltas = sumarEstadistica(stats, "Fouls");
  } catch {
    // sin estadísticas: esos mercados simplemente no cuentan
  }
}

function porcentaje(detalle) {
  if (detalle.length === 0) return null;
  return Math.round((detalle.filter((d) => d.acierto).length / detalle.length) * 1000) / 10;
}

// Estudios viejos sin el ID del partido: se busca, entre los enfrentamientos
// de esos dos equipos, el que se jugó más cerca después de guardar el estudio.
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
  return { partido: null, definitivo: Date.now() - guardado > 21 * DIA_MS };
}

// ---------- Mis Estudios (tabla predicciones) ----------
export async function verificarEstudio(p) {
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
  if (ANULADOS.includes(estado)) return { ...cambiosBase, resultado: "anulado", verificado_en: new Date().toISOString() };
  if (!FINALIZADOS.includes(estado)) return p.fixture_id ? null : cambiosBase;

  const real = await resultadoReal(partido, p.equipo_local_id, p.equipo_visitante_id);
  if (!real) return null;
  await completarEstadisticas(real, partido.fixture.id);

  const nombres = { local: p.equipo_local, visitante: p.equipo_visitante };
  const detalle = p.modelo ? evaluarModelo(p.modelo, real, nombres) : evaluarLegado(p, real, nombres);
  const antes = new Date(p.created_at).getTime() < new Date(partido.fixture.date).getTime();

  // Para el aprendizaje del clima: el mismo estudio calificado SIN el clima.
  let porcentajeSinClima = null;
  if (p.modelo?.clima && p.modelo?.puro) {
    porcentajeSinClima = porcentaje(evaluarModelo({ ...p.modelo, ...p.modelo.puro }, real, nombres));
  }

  return {
    ...cambiosBase,
    resultado: detalle.length === 0 ? "sin_pronostico" : antes ? "verificado" : "referencia",
    antes_del_partido: antes,
    mercados_evaluados: detalle.length,
    mercados_acertados: detalle.filter((d) => d.acierto).length,
    porcentaje_acierto: porcentaje(detalle),
    porcentaje_sin_clima: porcentajeSinClima,
    detalle_verificacion: detalle,
    marcador_final: `${real.golesLocal}-${real.golesVisitante}`,
    verificado_en: new Date().toISOString(),
  };
}

// ---------- Backtesting (tabla registro_sistema) ----------
export async function verificarRegistro(r) {
  const partido = await partidoPorId(r.fixture_id);
  if (!partido) return null;
  const estado = partido.fixture?.status?.short;
  if (ANULADOS.includes(estado)) return { resultado: "anulado", verificado_en: new Date().toISOString() };
  if (!FINALIZADOS.includes(estado)) return null;

  const real = await resultadoReal(partido, r.equipo_local_id, r.equipo_visitante_id);
  if (!real) return null;
  await completarEstadisticas(real, r.fixture_id);
  const detalle = evaluarModelo(r.modelo, real, { local: r.equipo_local, visitante: r.equipo_visitante });
  return {
    resultado: detalle.length === 0 ? "sin_pronostico" : "verificado",
    mercados_evaluados: detalle.length,
    mercados_acertados: detalle.filter((d) => d.acierto).length,
    porcentaje_acierto: porcentaje(detalle),
    detalle_verificacion: detalle,
    marcador_final: `${real.golesLocal}-${real.golesVisitante}`,
    verificado_en: new Date().toISOString(),
  };
}

// Verifica partidos del registro que ya debieron terminar. Con el plan gratis
// de API-Football se revisan pocos por vez, para no gastar las consultas.
export async function verificarRegistroPendiente({ maximo, hastaMs }) {
  let limite = maximo;
  try {
    const { data: config } = await supabaseAdmin.from("configuracion_app").select("plan_api").eq("id", 1).maybeSingle();
    if (config?.plan_api !== "pro") limite = Math.min(limite, 5);
  } catch {
    limite = Math.min(limite, 5);
  }
  const haceDosHoras = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: pendientes } = await supabaseAdmin
    .from("registro_sistema")
    .select("*")
    .eq("resultado", "pendiente")
    .lt("fecha_partido", haceDosHoras)
    .order("fecha_partido", { ascending: true })
    .limit(limite);
  let verificados = 0;
  for (const r of pendientes || []) {
    if (Date.now() > hastaMs) break;
    try {
      const cambios = await verificarRegistro(r);
      if (cambios) {
        await supabaseAdmin.from("registro_sistema").update(cambios).eq("fixture_id", r.fixture_id);
        verificados++;
      }
    } catch {
      // se intenta en la próxima llamada
    }
  }
  return verificados;
}
