// Respaldo del webhook: en vez de esperar pasivamente a que MercadoPago nos
// avise, le preguntamos nosotros directo el estado de la suscripción del
// usuario y actualizamos el perfil según lo que responda. Se llama justo
// cuando el usuario vuelve del pago.
import { mpFetch } from "../../lib/mercadopago";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

export default async function handler(req, res) {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "Falta userId" });

  try {
    const { data: perfil } = await supabaseAdmin
      .from("perfiles")
      .select("mercadopago_preapproval_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!perfil?.mercadopago_preapproval_id) {
      return res.status(200).json({ suscripcion_activa: false, motivo: "sin suscripción registrada" });
    }

    const suscripcion = await mpFetch(`/preapproval/${perfil.mercadopago_preapproval_id}`);
    const activa = suscripcion.status === "authorized";

    await supabaseAdmin
      .from("perfiles")
      .update({
        suscripcion_activa: activa,
        suscripcion_fecha_pago: suscripcion.date_created || null,
        suscripcion_proximo_pago: suscripcion.next_payment_date || null,
      })
      .eq("user_id", userId);

    res.status(200).json({ suscripcion_activa: activa, status_mercadopago: suscripcion.status });
  } catch (error) {
    res.status(500).json({ error: error.datos || error.message });
  }
}
