// ============================================================
// DESTACADOS DEL DIA (dentro de Backtesting): los mercados donde el semaforo
// esta mas seguro en los proximos partidos. Solo para Pro, Max y
// administradores. A los demas se les mandan datos de relleno (no los
// reales), para que el desenfoque de la pantalla no se pueda saltar.
// ============================================================
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { evaluarModelo } from "../../lib/verificacion";

const CONFIANZA_MINIMA = 0.7;
// Lo casi seguro (ej. "mas de 0.5 goles" al 99%) no se destaca: no aporta nada
const CONFIANZA_MAXIMA = 0.93;
// Mercados con mas valor van primero; las lineas de goles y la doble
// oportunidad solo salen si el partido no tiene nada de lo anterior
const MERCADOS_PREFERIDOS = ["ganador", "btts", "handicap", "corners", "amarillas", "faltas"];

const RELLENO = [
  { local: "Equipo local", visitante: "Equipo visitante", liga: "Competencia", texto: "Mercado destacado: Sí (80%)", prob: 0.8 },
  { local: "Equipo local", visitante: "Equipo visitante", liga: "Competencia", texto: "Mercado destacado: Sí (77%)", prob: 0.77 },
  { local: "Equipo local", visitante: "Equipo visitante", liga: "Competencia", texto: "Mercado destacado: No (75%)", prob: 0.75 },
  { local: "Equipo local", visitante: "Equipo visitante", liga: "Competencia", texto: "Mercado destacado: Sí (73%)", prob: 0.73 },
  { local: "Equipo local", visitante: "Equipo visitante", liga: "Competencia", texto: "Mercado destacado: Sí (71%)", prob: 0.71 },
];

async function tienePlanDePago(token) {
  if (!token) return false;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return false;
  const id = data.user.id;
  const [{ data: admin }, { data: perfil }] = await Promise.all([
    supabaseAdmin.from("admins").select("user_id").eq("user_id", id).maybeSingle(),
    supabaseAdmin.from("perfiles").select("suscripcion_activa").eq("user_id", id).maybeSingle(),
  ]);
  return !!admin || !!perfil?.suscripcion_activa;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  let pago = false;
  try {
    pago = await tienePlanDePago(token);
  } catch {
    pago = false;
  }
  if (!pago) return res.status(200).json({ bloqueado: true, destacados: RELLENO });

  const ahora = new Date();
  const hasta = new Date(ahora.getTime() + 36 * 60 * 60 * 1000);
  const { data: filas, error } = await supabaseAdmin
    .from("registro_sistema")
    .select("fixture_id, liga, pais, equipo_local, equipo_visitante, fecha_partido, modelo")
    .eq("resultado", "pendiente")
    .gte("fecha_partido", ahora.toISOString())
    .lte("fecha_partido", hasta.toISOString())
    .limit(300);
  if (error) return res.status(500).json({ error: "No se pudieron leer los destacados" });

  const candidatos = [];
  for (const f of filas || []) {
    const validos = evaluarModelo(f.modelo, null, { local: f.equipo_local, visitante: f.equipo_visitante })
      .filter((d) => typeof d.prob === "number" && d.prob >= CONFIANZA_MINIMA && d.prob <= CONFIANZA_MAXIMA && d.mercado !== "marcador")
      .sort((a, b) => b.prob - a.prob);
    // El primer mercado de la lista de preferidos que tenga algo valido
    // (ganador antes que ambos anotan, antes que handicap...), con su mejor opcion
    let preferido = null;
    for (const m of MERCADOS_PREFERIDOS) {
      preferido = validos.find((d) => d.mercado === m);
      if (preferido) break;
    }
    // Un solo destacado por partido, para que haya variedad
    const predichos = preferido ? [preferido] : validos.slice(0, 1);
    for (const d of predichos) {
      candidatos.push({
        fixtureId: f.fixture_id,
        local: f.equipo_local,
        visitante: f.equipo_visitante,
        liga: f.liga,
        fecha: f.fecha_partido,
        texto: d.texto,
        prob: d.prob,
      });
    }
  }
  candidatos.sort((a, b) => b.prob - a.prob);
  res.status(200).json({ bloqueado: false, destacados: candidatos.slice(0, 12) });
}
