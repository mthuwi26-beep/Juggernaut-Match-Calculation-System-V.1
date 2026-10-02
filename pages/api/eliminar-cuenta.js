// ============================================================
// POST /api/eliminar-cuenta (con el token de sesion del usuario).
// Borra la cuenta y todos sus datos. Lo usan la web (/eliminar-cuenta)
// y la app (Perfil -> Eliminar mi cuenta).
// ============================================================
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { eliminarCuenta } from "../../lib/eliminarCuenta";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  const { data, error } = token ? await supabaseAdmin.auth.getUser(token) : { data: null, error: true };
  if (error || !data?.user) return res.status(401).json({ error: "Inicia sesión de nuevo para eliminar tu cuenta." });
  if ((req.body || {}).confirmacion !== "ELIMINAR") return res.status(400).json({ error: "Falta la confirmación." });
  try {
    await eliminarCuenta(data.user.id);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "No se pudo eliminar la cuenta. Intenta de nuevo o escríbenos." });
  }
}
