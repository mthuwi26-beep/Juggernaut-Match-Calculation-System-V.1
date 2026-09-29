// ============================================================
// Aprendizaje automatico.
// GET  -> lo que usan la web y la app para mostrar el semaforo ajustado.
//         Con ?detalle=1 y token de admin, trae todo para el panel.
// POST -> solo administradores: { accion: "recalcular" } o
//         { accion: "activar", activo: true/false } (el interruptor).
// ============================================================
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { leerAprendizaje, recalcularAprendizaje, versionPublica, MINIMO_POR_GRUPO, MINIMO_PARTIDOS_CLIMA } from "../../lib/aprendizaje";

async function esAdmin(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return false;
  const { data: fila } = await supabaseAdmin.from("admins").select("user_id").eq("user_id", data.user.id).maybeSingle();
  return !!fila;
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const a = await leerAprendizaje();
      if (req.query.detalle === "1") {
        if (!(await esAdmin(req))) return res.status(403).json({ error: "Solo administradores" });
        return res.status(200).json({ ...a, minimoPorGrupo: MINIMO_POR_GRUPO, minimoPartidosClima: MINIMO_PARTIDOS_CLIMA });
      }
      res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600");
      return res.status(200).json(versionPublica(a));
    }

    if (req.method === "POST") {
      if (!(await esAdmin(req))) return res.status(403).json({ error: "Solo administradores" });
      const { accion, activo } = req.body || {};
      if (accion === "activar") {
        await supabaseAdmin.from("aprendizaje_modelo").upsert({ id: 1, activo: !!activo });
        return res.status(200).json({ ok: true, activo: !!activo });
      }
      if (accion === "recalcular") {
        const nuevo = await recalcularAprendizaje();
        return res.status(200).json({ ok: true, ...nuevo, minimoPorGrupo: MINIMO_POR_GRUPO, minimoPartidosClima: MINIMO_PARTIDOS_CLIMA });
      }
      return res.status(400).json({ error: "Acción no válida" });
    }
    res.status(405).json({ error: "Método no permitido" });
  } catch (e) {
    res.status(500).json({ error: "No se pudo procesar el aprendizaje" });
  }
}
