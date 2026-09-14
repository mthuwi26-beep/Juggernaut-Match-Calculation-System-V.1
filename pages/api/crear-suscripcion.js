// Crea una "suscripción" (preapproval) en MercadoPago y devuelve el link
// (init_point) para mandar al usuario a autorizar el cobro recurrente.
// El pago en sí lo maneja MercadoPago en su propia página — nunca vemos ni
// guardamos el número de tarjeta acá.
import { mpFetch } from "../../lib/mercadopago";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://juggernaut-match-calculation-system-nine.vercel.app";

// $70.000 COP/mes, $714.000 COP/año (15% de descuento sobre pagar mes a mes)
const PRECIOS = {
  mensual: { monto: 70000, frecuencia: 1 },
  anual: { monto: 714000, frecuencia: 12 },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { userId, email, plan } = req.body || {};

  if (!userId || !email || !plan || !PRECIOS[plan]) {
    return res.status(400).json({ error: "Faltan datos o el plan no es válido" });
  }

  try {
    const { monto, frecuencia } = PRECIOS[plan];

    const suscripcion = await mpFetch("/preapproval", {
      method: "POST",
      body: JSON.stringify({
        reason: `JMCS Plan Pro — ${plan === "anual" ? "Anual" : "Mensual"}`,
        external_reference: userId,
        payer_email: email,
        auto_recurring: {
          frequency: frecuencia,
          frequency_type: "months",
          transaction_amount: monto,
          currency_id: "COP",
        },
        back_url: `${SITE_URL}/?pago=exito`,
        status: "pending",
      }),
    });

    // Guardamos el ID de la suscripción para poder identificarla cuando
    // llegue el aviso (webhook) de MercadoPago más adelante
    await supabaseAdmin
      .from("perfiles")
      .update({ mercadopago_preapproval_id: suscripcion.id, plan_suscripcion: plan })
      .eq("user_id", userId);

    res.status(200).json({ url: suscripcion.init_point });
  } catch (error) {
    res.status(500).json({ error: "No se pudo crear la suscripción" });
  }
}
