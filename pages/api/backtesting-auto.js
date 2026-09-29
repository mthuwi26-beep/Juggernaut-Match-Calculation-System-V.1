// ============================================================
// Backtesting automatico (ver lib/backtestingAuto.js)
// GET  con CRON_SECRET  -> turno diario de Vercel (hasta ~50 segundos)
// GET  ?detalle=1 (admin) -> estado para el Panel de administrador
// POST { accion: "turno" }  -> turno corto; lo pide la web al abrirse
//                              (maximo uno cada 10 minutos para todos)
// POST (admin) { accion: "guardar", activo, tope, reserva } | { accion: "correr" }
// ============================================================
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { obtenerCache, guardarCache } from "../../lib/cacheApi";
import { ejecutarTurno, leerConfig, consultasRestantes, calculadosHoy } from "../../lib/backtestingAuto";

export const config = { maxDuration: 60 };

async function esAdmin(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return false;
  const { data: fila } = await supabaseAdmin.from("admins").select("user_id").eq("user_id", data.user.id).maybeSingle();
  return !!fila;
}

async function estado() {
  const [config, api, hoy] = await Promise.all([leerConfig(), consultasRestantes(), calculadosHoy()]);
  return { ...config, hoy, api };
}

export default async function handler(req, res) {
  const inicio = Date.now();
  try {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
    const esCron = !!process.env.CRON_SECRET && token === process.env.CRON_SECRET;

    if (req.method === "GET") {
      if (esCron) {
        const r = await ejecutarTurno({ maximo: 40, hastaMs: inicio + 50 * 1000 });
        return res.status(200).json(r);
      }
      if (req.query.detalle === "1") {
        if (!(await esAdmin(req))) return res.status(403).json({ error: "Solo administradores" });
        return res.status(200).json(await estado());
      }
      return res.status(405).json({ error: "Método no permitido" });
    }

    if (req.method === "POST") {
      const { accion } = req.body || {};

      if (accion === "turno") {
        // Candado compartido: un turno cada 10 minutos, lo abra quien lo abra
        if (await obtenerCache("bt-auto:turno")) return res.status(200).json({ hechos: 0, motivo: "En espera" });
        await guardarCache("bt-auto:turno", true, 10 * 60 * 1000);
        const r = await ejecutarTurno({ maximo: 3, hastaMs: inicio + 8 * 1000 });
        return res.status(200).json({ hechos: r.hechos });
      }

      if (!(await esAdmin(req))) return res.status(403).json({ error: "Solo administradores" });

      if (accion === "guardar") {
        const { activo, tope, reserva } = req.body || {};
        const cambios = {};
        if (typeof activo === "boolean") cambios.backtesting_auto_activo = activo;
        if (Number.isFinite(Number(tope))) cambios.backtesting_auto_tope = Math.max(0, Math.min(500, Math.round(Number(tope))));
        if (Number.isFinite(Number(reserva))) cambios.backtesting_auto_reserva = Math.max(0, Math.round(Number(reserva)));
        const { error } = await supabaseAdmin.from("configuracion_app").update(cambios).eq("id", 1);
        if (error) return res.status(500).json({ error: "No se pudo guardar. ¿Ya corriste el SQL de la Tanda 3?" });
        return res.status(200).json(await estado());
      }

      if (accion === "correr") {
        const r = await ejecutarTurno({ maximo: 10, hastaMs: inicio + 45 * 1000, forzar: true });
        return res.status(200).json({ ...(await estado()), ultimoTurno: r });
      }
      return res.status(400).json({ error: "Acción no válida" });
    }
    res.status(405).json({ error: "Método no permitido" });
  } catch {
    res.status(500).json({ error: "No se pudo procesar el Backtesting automático" });
  }
}
