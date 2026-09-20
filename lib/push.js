import webpush from "web-push";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

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

// ============================================
// App Android nativa — Firebase Cloud Messaging
// ============================================
// Se inicializa una sola vez (Vercel reutiliza la misma instancia del
// proceso entre invocaciones, así que evitamos inicializar Firebase de
// nuevo en cada llamada).
function appFirebaseAdmin() {
  if (getApps().length > 0) return getApps()[0];

  // La clave de la cuenta de servicio se guarda en Vercel como una sola
  // variable de entorno con el JSON completo adentro (como texto).
  const credenciales = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  return initializeApp({ credential: cert(credenciales) });
}

// Manda una notificación push a UN dispositivo Android (por su token de
// FCM). Si el token ya no sirve (el usuario desinstaló la app, o el
// token venció), Firebase responde con un código de error específico —
// en ese caso avisamos que está "expirado" para que el que llama lo
// borre de la base, mismo patrón que enviarPush() de arriba.
export async function enviarPushFcm(token, payload) {
  try {
    await getMessaging(appFirebaseAdmin()).send({
      token,
      notification: {
        title: payload.titulo || payload.title || "JMCS",
        body: payload.cuerpo || payload.body || "",
      },
      data: payload.data || {},
    });
    return { ok: true };
  } catch (err) {
    const expirado =
      err.code === "messaging/registration-token-not-registered" ||
      err.code === "messaging/invalid-registration-token";
    return { ok: false, expirada: expirado };
  }
}
