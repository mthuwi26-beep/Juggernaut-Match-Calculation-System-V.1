// ============================================================
// APRENDIZAJE AUTOMATICO DE JMCS
//
// 1) Calibracion del semaforo: con el Backtesting (lo que dijo el semaforo
//    ANTES de cada partido vs lo que paso), por mercado y por nivel de
//    confianza. Ej: si en "Goles" cuando dijo 70-80% paso solo el 68%, los
//    proximos estudios bajan un poco esa franja.
//    Frenos: minimo 50 mercados por grupo, la correccion crece con la
//    cantidad de datos, y nunca pasa de 8 puntos.
//
// 2) Clima: compara cada estudio con Estudio Climatico contra el mismo
//    estudio sin clima. Si los ajustes ayudan, el clima pesa un poco mas;
//    si empeoran, un poco menos. Los usuarios con mejor historial ajustando
//    el clima pesan mas; cada partido cuenta una sola vez.
//    Frenos: minimo 30 partidos, cambia de a 0.05 por recalculo y queda
//    entre 0.5 y 1.5 (1 = como fue disenado).
// ============================================================
import { supabaseAdmin } from "./supabaseAdmin";

export const MINIMO_POR_GRUPO = 50;
export const TOPE_AJUSTE = 0.08;
export const MINIMO_PARTIDOS_CLIMA = 30;
const RANGOS = [[0.55, 0.6], [0.6, 0.7], [0.7, 0.8], [0.8, 0.9], [0.9, 1.01]];
const MERCADOS = ["ganador", "doble", "goles", "btts", "handicap", "corners", "amarillas", "faltas"];

const limitar = (x, a, b) => Math.max(a, Math.min(b, x));
const r3 = (x) => Math.round(x * 1000) / 1000;

export async function leerAprendizaje() {
  const { data } = await supabaseAdmin.from("aprendizaje_modelo").select("*").eq("id", 1).maybeSingle();
  return data || { id: 1, activo: true, calibracion: null, clima: null, actualizado_en: null };
}

export function calcularCalibracion(filas) {
  const grupos = {};
  MERCADOS.forEach((m) => {
    grupos[m] = RANGOS.map(([desde, hasta]) => ({ desde, hasta, n: 0, sumaProb: 0, aciertos: 0 }));
  });
  for (const f of filas) {
    for (const d of f.detalle_verificacion || []) {
      if (!grupos[d.mercado] || typeof d.prob !== "number") continue;
      const g = grupos[d.mercado].find((r) => d.prob >= r.desde && d.prob < r.hasta);
      if (!g) continue;
      g.n++;
      g.sumaProb += d.prob;
      if (d.acierto) g.aciertos++;
    }
  }
  const salida = {};
  for (const m of MERCADOS) {
    salida[m] = grupos[m].map((g) => {
      const dijimos = g.n > 0 ? g.sumaProb / g.n : null;
      const paso = g.n > 0 ? g.aciertos / g.n : null;
      let ajuste = 0;
      if (g.n >= MINIMO_POR_GRUPO) {
        const peso = g.n / (g.n + 100); // con pocos datos corrige poco
        ajuste = limitar((paso - dijimos) * peso, -TOPE_AJUSTE, TOPE_AJUSTE);
      }
      return { desde: g.desde, hasta: g.hasta, n: g.n, dijimos: dijimos === null ? null : r3(dijimos), paso: paso === null ? null : r3(paso), ajuste: r3(ajuste) };
    });
  }
  return salida;
}

export function calcularClima(estudios, anterior) {
  const kAnterior = typeof anterior?.k === "number" ? anterior.k : 1;
  // Historial de cada usuario: cuanto mejora (en puntos) con su clima
  const porUsuario = {};
  for (const e of estudios) {
    const mejora = e.porcentaje_acierto - e.porcentaje_sin_clima;
    porUsuario[e.user_id] = porUsuario[e.user_id] || { suma: 0, n: 0 };
    porUsuario[e.user_id].suma += mejora;
    porUsuario[e.user_id].n++;
  }
  const pesoUsuario = (id) => {
    const u = porUsuario[id];
    if (!u || u.n < 3) return 0.5; // usuario nuevo: pesa poco
    return limitar(1 + u.suma / u.n / 20, 0.25, 2);
  };
  // Cada partido cuenta una vez: promedio ponderado de los usuarios que lo estudiaron
  const porPartido = {};
  for (const e of estudios) {
    const clave = e.fixture_id || `sin-id-${e.user_id}-${e.created_at}`;
    porPartido[clave] = porPartido[clave] || { suma: 0, pesos: 0 };
    const w = pesoUsuario(e.user_id);
    porPartido[clave].suma += (e.porcentaje_acierto - e.porcentaje_sin_clima) * w;
    porPartido[clave].pesos += w;
  }
  const mejoras = Object.values(porPartido).map((p) => p.suma / p.pesos);
  const partidos = mejoras.length;
  const mejoraPromedio = partidos > 0 ? mejoras.reduce((a, b) => a + b, 0) / partidos : null;
  let k = kAnterior;
  if (partidos >= MINIMO_PARTIDOS_CLIMA) {
    if (mejoraPromedio > 1) k = kAnterior + 0.05;
    else if (mejoraPromedio < -1) k = kAnterior - 0.05;
  }
  return {
    k: r3(limitar(k, 0.5, 1.5)),
    partidos,
    usuarios: Object.keys(porUsuario).length,
    mejoraPromedio: mejoraPromedio === null ? null : Math.round(mejoraPromedio * 10) / 10,
  };
}

export async function recalcularAprendizaje() {
  const actual = await leerAprendizaje();

  const { data: filas } = await supabaseAdmin
    .from("registro_sistema")
    .select("detalle_verificacion")
    .eq("resultado", "verificado")
    .order("fecha_partido", { ascending: false })
    .limit(5000);

  const { data: estudios } = await supabaseAdmin
    .from("predicciones")
    .select("user_id, fixture_id, created_at, porcentaje_acierto, porcentaje_sin_clima")
    .eq("resultado", "verificado")
    .not("porcentaje_sin_clima", "is", null)
    .not("porcentaje_acierto", "is", null)
    .order("created_at", { ascending: false })
    .limit(5000);

  const nuevo = {
    id: 1,
    activo: actual.activo !== false,
    calibracion: calcularCalibracion(filas || []),
    clima: calcularClima(estudios || [], actual.clima),
    actualizado_en: new Date().toISOString(),
  };
  await supabaseAdmin.from("aprendizaje_modelo").upsert(nuevo);
  return nuevo;
}

// Lo que necesitan la web y la app para mostrar el semáforo ajustado.
// Si está apagado, se manda todo neutro (sin correcciones y clima en 1).
export function versionPublica(a) {
  const activo = a?.activo !== false;
  const calibracion = {};
  if (activo && a?.calibracion) {
    for (const [m, grupos] of Object.entries(a.calibracion)) {
      const conAjuste = grupos.filter((g) => g.ajuste !== 0).map((g) => ({ desde: g.desde, hasta: g.hasta, ajuste: g.ajuste }));
      if (conAjuste.length > 0) calibracion[m] = conAjuste;
    }
  }
  return {
    activo,
    calibracion,
    climaK: activo && typeof a?.clima?.k === "number" ? a.clima.k : 1,
    actualizadoEn: a?.actualizado_en || null,
  };
}
