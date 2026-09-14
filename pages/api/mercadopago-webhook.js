// MercadoPago le pega a esta ruta cada vez que cambia el estado de una
// suscripción (se autorizó, se pausó, se canceló). Acá actualizamos el
// perfil del usuario en Supabase según lo que haya pasado.
//
// IMPORTANTE — configurar en MercadoPago (Tus integraciones → la app que
// crees → Webhooks) esta URL:
// https://tu-dominio.vercel.app/api/mercadopago-webhook
// eligiendo el evento "Suscripciones" (subscription_preapproval).
//
// HONESTIDAD: la forma exacta en la que MercadoPago manda el aviso puede
// variar un poco según el tipo de integración. Si al probarlo con el
// simulador de MercadoPago ves que no llega bien, mandame una captura del
// payload real que te muestra el simulador y lo ajustamos — no tengo forma
// de probar esto en vivo desde acá.

import { mpFetch } from "../../lib/mercadopago";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  console.log("Webhook de MercadoPago recibido:", JSON.stringify({ body: req.body, query: req.query }));

  try {
    const tipo = req.body?.type || req.query?.type;
    const preapprovalId = req.body?.data?.id || req.query?.id;

    if (tipo === "subscription_preapproval" && preapprovalId) {
      // Le preguntamos a MercadoPago el estado actual de esa suscripción
      // (no confiamos ciegamente en lo que venga en el aviso, lo verificamos)
      const suscripcion = await mpFetch(`/preapproval/${preapprovalId}`);
      const activa = suscripcion.status === "authorized";
      const userId = suscripcion.external_reference;

      console.log("Suscripción consultada:", JSON.stringify({ status: suscripcion.status, userId, activa }));

      if (userId) {
        const { error } = await supabaseAdmin
          .from("perfiles")
          .update({
            suscripcion_activa: activa,
            suscripcion_fecha_pago: suscripcion.date_created || null,
            suscripcion_proximo_pago: suscripcion.next_payment_date || null,
          })
          .eq("user_id", userId);
        if (error) console.error("Error actualizando perfil desde el webhook:", JSON.stringify(error));
      } else {
        console.error("El webhook no trajo external_reference — no sabemos a qué usuario activar.");
      }
    } else {
      console.log("Webhook ignorado (tipo no reconocido o sin ID):", tipo);
    }

    res.status(200).json({ recibido: true });
  } catch (error) {
    console.error("Error procesando webhook de MercadoPago:", JSON.stringify(error.datos || error.message || error));
    // Respondemos 200 igual — si no, MercadoPago reintenta el mismo aviso
    // muchas veces seguidas. El estado se termina corrigiendo solo en el
    // próximo aviso (por ejemplo, el del siguiente cobro mensual).
    res.status(200).json({ recibido: true, error: "no se pudo procesar" });
  }
}
