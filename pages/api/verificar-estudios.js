// ============================================================
// Verifica solos los estudios guardados en "Mis Estudios".
// - La app y la pagina lo llaman al abrir Mis Estudios, con el token de la
//   sesion del usuario: verifica solo los estudios de ese usuario.
// - Ademas, una vez al dia lo llama Vercel (cron) con CRON_SECRET: verifica
//   los pendientes de todos y tambien el registro del Backtesting.
// El resultado lo escribe el servidor (service role): nadie puede marcarse
// aciertos a mano.
// ============================================================
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { verificarEstudio, verificarRegistroPendiente } from "../../lib/verificarServidor";
import { recalcularAprendizaje } from "../../lib/aprendizaje";
import { revisarVencidasGooglePlay } from "../../lib/googlePlay";

const TIEMPO_MAXIMO_MS = 8000; // margen para el limite de tiempo de Vercel

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
      const cambios = await verificarEstudio(p);
      if (cambios) {
        await supabaseAdmin.from("predicciones").update(cambios).eq("id", p.id);
        if (cambios.resultado && cambios.resultado !== "pendiente") verificados++;
      }
    } catch {
      // si falla uno (por ejemplo la API), se intenta de nuevo en la proxima llamada
    }
  }

  // El cron diario tambien verifica el registro del Backtesting
  let registroVerificado = 0;
  if (esCron) {
    registroVerificado = await verificarRegistroPendiente({ maximo: 60, hastaMs: inicio + TIEMPO_MAXIMO_MS });
    // Y recalcula lo aprendido con todo lo verificado hasta hoy
    try {
      await recalcularAprendizaje();
    } catch {
      // si falla, se intenta en el proximo cron
    }
    // Respaldo de Google Play: planes vencidos sin aviso de renovacion
    try {
      await revisarVencidasGooglePlay();
    } catch {
      // se intenta de nuevo manana
    }
  }

  res.status(200).json({ revisados, verificados, pendientes: (pendientes || []).length - verificados, registroVerificado });
}
