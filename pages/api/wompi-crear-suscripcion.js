// Recibe el token de tarjeta (ya generado en el navegador del usuario) y:
// 1. Crea una "fuente de pago" guardada en Wompi (para poder cobrar los
//    meses/años siguientes sin pedir la tarjeta de nuevo)
// 2. Cobra la primera transacción con esa fuente
// 3. Si sale bien, activa la suscripción del usuario en nuestra base
import { wompiFetch, firmarTransaccion } from "../../lib/wompi";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

// $70.000 COP/mes, $714.000 COP/año (15% de descuento sobre pagar mes a mes)
// Wompi trabaja en "centavos" incluso para pesos colombianos — por eso x100
const PRECIOS = {
  mensual: { monto: 70000 * 100, meses: 1 },
  anual: { monto: 714000 * 100, meses: 12 },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { userId, email, plan, cardToken, acceptanceToken, personalDataToken } = req.body || {};

  if (!userId || !email || !plan || !cardToken || !acceptanceToken || !PRECIOS[plan]) {
    return res.status(400).json({ error: "Faltan datos o el plan no es válido" });
  }

  try {
    const { monto, meses } = PRECIOS[plan];

    // 1. Fuente de pago guardada
    const fuentePago = await wompiFetch("/payment_sources", {
      method: "POST",
      body: JSON.stringify({
        type: "CARD",
        token: cardToken,
        customer_email: email,
        acceptance_token: acceptanceToken,
        accept_personal_auth: personalDataToken,
      }),
    });

    const paymentSourceId = fuentePago.data.id;

    // 2. Cobro de la primera transacción, con esa fuente
    const referencia = `jmcs-${userId}-${Date.now()}`;
    const firma = await firmarTransaccion(referencia, monto, "COP");
    const transaccion = await wompiFetch("/transactions", {
      method: "POST",
      body: JSON.stringify({
        amount_in_cents: monto,
        currency: "COP",
        customer_email: email,
        payment_source_id: paymentSourceId,
        payment_method: { installments: 1 },
        reference: referencia,
        acceptance_token: acceptanceToken,
        signature: firma,
      }),
    });

    let estado = transaccion.data.status; // "APPROVED" | "PENDING" | "DECLINED" | "ERROR"
    let transaccionId = transaccion.data.id;

    // Si queda "pendiente", le damos hasta ~10 segundos consultando de
    // nuevo cada 2 segundos, antes de darla por perdida — es normal que
    // en sandbox no resuelva al instante como "aprobada" o "rechazada"
    for (let intento = 0; estado === "PENDING" && intento < 5; intento++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const consulta = await wompiFetch(`/transactions/${transaccionId}`);
      estado = consulta.data.status;
    }

    const activa = estado === "APPROVED";

    const ahora = new Date();
    const proximoPago = new Date(ahora);
    proximoPago.setMonth(proximoPago.getMonth() + meses);

    await supabaseAdmin
      .from("perfiles")
      .update({
        wompi_payment_source_id: paymentSourceId,
        wompi_ultima_transaccion_id: transaccionId,
        plan_suscripcion: plan,
        suscripcion_activa: activa,
        suscripcion_fecha_pago: activa ? ahora.toISOString() : null,
        suscripcion_proximo_pago: activa ? proximoPago.toISOString() : null,
      })
      .eq("user_id", userId);

    res.status(200).json({ estado, activa, transaccion_id: transaccionId });
  } catch (error) {
    res.status(500).json({ error: error.datos?.error?.messages || error.datos || error.message });
  }
}
