// La llama la "trampa de errores" del frontend cada vez que algo se rompe
// del lado del cliente. Guarda el error y avisa a todos los admins que tengan
// las notificaciones push activadas — así se enteran sin tener que estar
// mirando el panel a cada rato.

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { enviarPush } from "../../lib/push";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { mensaje, stack, componentStack, ruta, userId } = req.body || {};

  try {
    await supabaseAdmin.from("errores_cliente").insert({
      mensaje: mensaje || "Error desconocido",
      stack: stack || null,
      component_stack: componentStack || null,
      ruta: ruta || null,
      user_id: userId || null,
    });

    // Avisar a los admins por push (si tienen las notificaciones activadas)
    const { data: admins } = await supabaseAdmin.from("admins").select("user_id");
    const adminIds = (admins || []).map((a) => a.user_id);

    if (adminIds.length > 0) {
      const { data: suscripciones } = await supabaseAdmin
        .from("push_subscriptions")
        .select("*")
        .in("user_id", adminIds);

      for (const sub of suscripciones || []) {
        const resultado = await enviarPush(sub, {
          titulo: "JMCS — Se reportó un error",
          cuerpo: (mensaje || "Error desconocido").slice(0, 120),
          url: "/",
        });
        if (resultado.expirada) {
          await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    // Si esto falla, no queremos que el usuario vea un segundo error encima del primero
    res.status(200).json({ ok: false });
  }
}
