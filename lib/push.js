import webpush from "web-push";

webpush.setVapidDetails(
  // Cambia esto por un correo de contacto real tuyo — es obligatorio para el
  // protocolo de push (los navegadores lo usan para contactarte si algo anda mal
  // con tus envíos), no es algo que el usuario vea nunca.
  "mailto:contacto@jmcs.app",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Manda una notificación push a UNA suscripción (un navegador/dispositivo).
// Si la suscripción ya no sirve (el usuario desinstaló, borró datos, etc.),
// el servicio de push responde 404 o 410 — en ese caso avisamos que está
// "expirada" para que el que llama la borre de la base y no se siga intentando.
export async function enviarPush(subscription, payload) {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth_key },
      },
      JSON.stringify(payload)
    );
    return { ok: true };
  } catch (err) {
    const expirada = err.statusCode === 410 || err.statusCode === 404;
    return { ok: false, expirada };
  }
}
