// Se ejecuta periódicamente (configurado en cron-job.org, igual que el
// vigilante de notificaciones) — busca suscripciones a las que ya les toca
// pagar de nuevo, y las cobra usando la fuente de pago que ya tienen
// guardada, sin pedirle la tarjeta al usuario de nuevo.
import { wompiFetch, firmarTransaccion } from "../../lib/wompi";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

const PRECIOS = {
  mensual: { monto: 70000 * 100, meses: 1 },
  anual: { monto: 714000 * 100, meses: 12 },
};

export default async function handler(req, res) {
  if (req.query.secret !== process.env.VIGILANTE_SECRET) {
    return res.status(401).json({ error: "No autorizado" });
  }

  try {
    const { data: vencidas, error } = await supabaseAdmin
      .from("perfiles")
      .select("user_id, plan_suscripcion, wompi_payment_source_id")
      .eq("suscripcion_activa", true)
      .not("wompi_payment_source_id", "is", null)
      .lte("suscripcion_proximo_pago", new Date().toISOString());

    if (error) throw error;

    const resultados = [];

    for (const perfil of vencidas || []) {
      const { monto, meses } = PRECIOS[perfil.plan_suscripcion] || {};
      if (!monto) continue;

      try {
        // Necesitamos el correo real del usuario (auth.users), no lo tenemos
        // guardado aparte en perfiles
        const { data: usuario } = await supabaseAdmin.auth.admin.getUserById(perfil.user_id);
        const email = usuario?.user?.email;
        if (!email) continue;

        const referencia = `jmcs-renovacion-${perfil.user_id}-${Date.now()}`;
        const firma = firmarTransaccion(referencia, monto, "COP");
        const transaccion = await wompiFetch("/transactions", {
          method: "POST",
          body: JSON.stringify({
            amount_in_cents: monto,
            currency: "COP",
            customer_email: email,
            payment_source_id: perfil.wompi_payment_source_id,
            payment_method: { installments: 1 },
            reference: referencia,
            signature: firma,
          }),
        });

        const activa = transaccion.data.status === "APPROVED";
        const ahora = new Date();
        const proximoPago = new Date(ahora);
        proximoPago.setMonth(proximoPago.getMonth() + meses);

        await supabaseAdmin
          .from("perfiles")
          .update({
            suscripcion_activa: activa,
            wompi_ultima_transaccion_id: transaccion.data.id,
            suscripcion_fecha_pago: activa ? ahora.toISOString() : undefined,
            suscripcion_proximo_pago: activa ? proximoPago.toISOString() : undefined,
          })
          .eq("user_id", perfil.user_id);

        resultados.push({ user_id: perfil.user_id, estado: transaccion.data.status });
      } catch (errorUsuario) {
        // Si falla el cobro de UN usuario (tarjeta vencida, fondos
        // insuficientes, etc.), no interrumpimos a los demás
        await supabaseAdmin.from("perfiles").update({ suscripcion_activa: false }).eq("user_id", perfil.user_id);
        resultados.push({ user_id: perfil.user_id, estado: "ERROR", detalle: errorUsuario.message });
      }
    }

    res.status(200).json({ procesados: resultados.length, resultados });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
