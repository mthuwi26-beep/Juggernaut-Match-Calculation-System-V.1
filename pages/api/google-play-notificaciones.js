// ============================================================
// Avisos en tiempo real de Google Play (renovo, se cancelo, fallo el cobro,
// se reembolso...). Google los manda por Pub/Sub a esta direccion:
//   https://<tu-dominio>/api/google-play-notificaciones?secret=<GOOGLE_PLAY_NOTIF_SECRET>
// Con cada aviso se consulta la compra en Google y se deja la cuenta al dia.
// ============================================================
import { sincronizarCompra } from "../../lib/googlePlay";

export default async function handler(req, res) {
  if (!process.env.GOOGLE_PLAY_NOTIF_SECRET || req.query.secret !== process.env.GOOGLE_PLAY_NOTIF_SECRET) {
    return res.status(401).json({ error: "No autorizado" });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  let aviso = null;
  try {
    const datos = req.body?.message?.data;
    aviso = datos ? JSON.parse(Buffer.from(datos, "base64").toString("utf8")) : null;
  } catch {
    aviso = null;
  }
  // Mensaje de prueba de Play Console, o algo que no es de suscripciones
  const token = aviso?.subscriptionNotification?.purchaseToken;
  if (!token) return res.status(200).json({ ok: true, ignorado: true });

  try {
    const r = await sincronizarCompra(token);
    return res.status(200).json({ ok: true, activa: r.activa });
  } catch (e) {
    // 200 igual: si se responde error, Google reintenta sin parar. El
    // respaldo diario vuelve a revisar los planes vencidos.
    return res.status(200).json({ ok: false, error: e.message });
  }
}
