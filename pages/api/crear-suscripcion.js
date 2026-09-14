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

    // Mientras estemos probando con cuentas de prueba de MercadoPago, el
    // correo real del usuario logueado en JMCS no sirve como "comprador"
    // (MercadoPago lo rechaza si no es una cuenta real o de prueba suya).
    // Si configurás MERCADOPAGO_TEST_BUYER_EMAIL en Vercel, se usa ese en
    // vez del correo real — SOLO para probar. Cuando pases a cobrar de
    // verdad, borrá esa variable y vuelve a usar el correo real solo.
    const payerEmail = process.env.MERCADOPAGO_TEST_BUYER_EMAIL || email;

    const suscripcion = await mpFetch("/preapproval", {
      method: "POST",
      body: JSON.stringify({
        reason: `JMCS Plan Pro — ${plan === "anual" ? "Anual" : "Mensual"}`,
        external_reference: userId,
        payer_email: payerEmail,
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
    // Lo dejamos anotado en los logs de Vercel (Vercel → tu proyecto →
    // pestaña "Logs" → filtrar por /api/crear-suscripcion) y también se lo
    // mostramos al usuario por ahora, mientras estamos probando — una vez
    // que esté funcionando bien, lo volvemos a un mensaje más genérico.
    console.error("Error creando suscripción en MercadoPago:", JSON.stringify(error.datos || error.message || error));
    res.status(500).json({
      error: "No se pudo crear la suscripción: " + (error.datos?.message || error.message || "error desconocido"),
    });
  }
}
