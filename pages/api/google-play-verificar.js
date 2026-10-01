// ============================================================
// La app llama aqui justo despues de comprar en Google Play (y al abrirse,
// para recuperar compras). El servidor verifica la compra con Google y
// activa el plan. POST { purchaseToken } con el token de sesion del usuario.
// ============================================================
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { sincronizarCompra } from "../../lib/googlePlay";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  const { data, error } = token ? await supabaseAdmin.auth.getUser(token) : { data: null, error: true };
  if (error || !data?.user) return res.status(401).json({ error: "Inicia sesión de nuevo" });

  const { purchaseToken } = req.body || {};
  if (!purchaseToken || typeof purchaseToken !== "string") return res.status(400).json({ error: "Falta la compra" });

  try {
    const r = await sincronizarCompra(purchaseToken, { userIdEsperado: data.user.id });
    return res.status(200).json({ activa: r.activa, plan: r.plan, expira: r.expira });
  } catch (e) {
    return res.status(400).json({ error: e.message || "No se pudo verificar la compra" });
  }
}
