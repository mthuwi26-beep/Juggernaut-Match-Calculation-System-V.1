// ============================================================
// BACKTESTING: asi le ha ido al semaforo de JMCS, partido por partido.
// Solo cuenta lo que se registro ANTES de cada partido (sin fuga de datos).
// Es publico: genera confianza mostrar el historial real.
// ============================================================
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { verificarRegistroPendiente } from "../../lib/verificarServidor";

const NOMBRES_MERCADO = {
  ganador: "Ganador", doble: "Doble oportunidad", goles: "Goles (Over)", btts: "Ambos anotan",
  handicap: "Hándicap asiático", marcador: "Marcador exacto", corners: "Córners", amarillas: "Tarjetas amarillas", faltas: "Faltas",
};
const RANGOS = [[0.55, 0.6], [0.6, 0.7], [0.7, 0.8], [0.8, 0.9], [0.9, 1.01]];

export default async function handler(req, res) {
  const inicio = Date.now();
  const periodo = ["semana", "mes", "historico"].includes(req.query.periodo) ? req.query.periodo : "mes";

  // De paso, verifica unos pocos partidos que ya terminaron.
  try {
    await verificarRegistroPendiente({ maximo: 3, hastaMs: inicio + 4000 });
  } catch {
    // no importa: se verifican en la siguiente visita o en el cron diario
  }

  let consulta = supabaseAdmin
    .from("registro_sistema")
    .select("fixture_id, liga, pais, equipo_local, equipo_visitante, fecha_partido, porcentaje_acierto, mercados_evaluados, mercados_acertados, detalle_verificacion, marcador_final")
    .eq("resultado", "verificado")
    .order("fecha_partido", { ascending: false })
    .limit(3000);
  if (periodo !== "historico") {
    const dias = periodo === "semana" ? 7 : 30;
    consulta = consulta.gte("fecha_partido", new Date(Date.now() - dias * 86400000).toISOString());
  }
  const { data: filas, error } = await consulta;
  if (error) return res.status(500).json({ error: "No se pudo leer el Backtesting" });

  const { count: pendientes } = await supabaseAdmin
    .from("registro_sistema")
    .select("fixture_id", { count: "exact", head: true })
    .eq("resultado", "pendiente");

  let evaluados = 0, acertados = 0, sumaBrier = 0, nBrier = 0;
  const porMercado = {};
  const porCompeticion = {};
  const calibracion = RANGOS.map(([desde, hasta]) => ({ desde, hasta, n: 0, sumaProb: 0, aciertos: 0 }));

  for (const f of filas || []) {
    evaluados += f.mercados_evaluados || 0;
    acertados += f.mercados_acertados || 0;
    const comp = `${f.liga || "?"}${f.pais ? ` (${f.pais})` : ""}`;
    porCompeticion[comp] = porCompeticion[comp] || { n: 0, aciertos: 0, partidos: 0 };
    porCompeticion[comp].partidos++;
    for (const d of f.detalle_verificacion || []) {
      const m = d.mercado || "otro";
      porMercado[m] = porMercado[m] || { n: 0, aciertos: 0 };
      porMercado[m].n++;
      porCompeticion[comp].n++;
      if (d.acierto) { porMercado[m].aciertos++; porCompeticion[comp].aciertos++; }
      if (typeof d.prob === "number") {
        const y = d.acierto ? 1 : 0;
        sumaBrier += (d.prob - y) ** 2;
        nBrier++;
        const rango = calibracion.find((r) => d.prob >= r.desde && d.prob < r.hasta);
        if (rango) { rango.n++; rango.sumaProb += d.prob; if (d.acierto) rango.aciertos++; }
      }
    }
  }

  const pct = (a, n) => (n > 0 ? Math.round((a / n) * 1000) / 10 : null);
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
  res.status(200).json({
    periodo,
    partidos: (filas || []).length,
    pendientes: pendientes || 0,
    mercadosEvaluados: evaluados,
    mercadosAcertados: acertados,
    porcentaje: pct(acertados, evaluados),
    // Brier: 0 es perfecto; mientras mas bajo, mejor calibradas las probabilidades
    brier: nBrier > 0 ? Math.round((sumaBrier / nBrier) * 1000) / 1000 : null,
    porMercado: Object.entries(porMercado)
      .map(([m, v]) => ({ mercado: NOMBRES_MERCADO[m] || m, n: v.n, porcentaje: pct(v.aciertos, v.n) }))
      .sort((a, b) => b.n - a.n),
    porCompeticion: Object.entries(porCompeticion)
      .map(([c, v]) => ({ competicion: c, partidos: v.partidos, n: v.n, porcentaje: pct(v.aciertos, v.n) }))
      .sort((a, b) => b.partidos - a.partidos)
      .slice(0, 12),
    calibracion: calibracion.map((r) => ({
      rango: `${Math.round(r.desde * 100)}–${Math.min(100, Math.round(r.hasta * 100))}%`,
      n: r.n,
      dijimos: r.n > 0 ? Math.round((r.sumaProb / r.n) * 1000) / 10 : null,
      paso: pct(r.aciertos, r.n),
    })),
    recientes: (filas || []).slice(0, 20).map((f) => ({
      fixtureId: f.fixture_id,
      local: f.equipo_local,
      visitante: f.equipo_visitante,
      liga: f.liga,
      fecha: f.fecha_partido,
      marcador: f.marcador_final,
      porcentaje: f.porcentaje_acierto,
      acertados: f.mercados_acertados,
      evaluados: f.mercados_evaluados,
    })),
  });
}
