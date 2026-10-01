// ============================================================
// GOOGLE PLAY: verificacion de las suscripciones compradas en la app.
// - El servidor le pregunta a Google el estado real de cada compra
//   (nunca se confia en lo que diga el celular).
// - La confirma ("acknowledge"): si no se confirma en 3 dias, Google la
//   reembolsa sola.
// - Activa o desactiva el plan en la cuenta JMCS.
// Necesita en Vercel: GOOGLE_PLAY_CUENTA_SERVICIO (el JSON completo de la
// cuenta de servicio con acceso a Play Console).
// ============================================================
import crypto from "crypto";
import { supabaseAdmin } from "./supabaseAdmin";

export const PAQUETE_APP = "com.jmcs.app";
export const PRODUCTO_SUSCRIPCION = "jmcs_suscripcion";
// Plan base de Google Play -> plan de JMCS
const PLAN_POR_BASE = { "pro-mensual": "mensual", "max-anual": "anual" };
const API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";

let tokenGuardado = null;

// Token de acceso de Google con la cuenta de servicio (JWT firmado, sin librerias extra)
async function tokenAcceso() {
  if (tokenGuardado && tokenGuardado.expira > Date.now() + 60000) return tokenGuardado.valor;
  let cuenta = null;
  try {
    cuenta = JSON.parse(process.env.GOOGLE_PLAY_CUENTA_SERVICIO || "null");
  } catch {
    cuenta = null;
  }
  if (!cuenta?.client_email || !cuenta?.private_key) throw new Error("Falta GOOGLE_PLAY_CUENTA_SERVICIO en Vercel");
  const ahora = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const cuerpo = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: cuenta.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token",
    iat: ahora,
    exp: ahora + 3600,
  })}`;
  const firma = crypto.createSign("RSA-SHA256").update(cuerpo).sign(cuenta.private_key, "base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${cuerpo}.${firma}` }),
  });
  const d = await r.json();
  if (!r.ok || !d.access_token) throw new Error(`Google no entrego el token: ${d.error_description || d.error || r.status}`);
  tokenGuardado = { valor: d.access_token, expira: Date.now() + (d.expires_in || 3600) * 1000 };
  return tokenGuardado.valor;
}

async function pedirGoogle(ruta, opciones = {}) {
  const token = await tokenAcceso();
  const r = await fetch(`${API}/${PAQUETE_APP}/${ruta}`, {
    ...opciones,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opciones.headers || {}) },
  });
  const texto = await r.text();
  const datos = texto ? JSON.parse(texto) : {};
  if (!r.ok) throw new Error(datos?.error?.message || `Google respondio ${r.status}`);
  return datos;
}

const ESTADOS_ACTIVOS = ["SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD"];

// Consulta una compra en Google y deja la cuenta JMCS al dia.
// userIdEsperado: la cuenta que dice haber comprado (desde la app). Si la
// compra es de otra cuenta, se rechaza.
export async function sincronizarCompra(purchaseToken, { userIdEsperado = null } = {}) {
  const sub = await pedirGoogle(`purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`);
  const linea = (sub.lineItems || [])[0] || {};
  const productId = linea.productId || PRODUCTO_SUSCRIPCION;
  const planBase = linea.offerDetails?.basePlanId || null;
  const expira = linea.expiryTime ? new Date(linea.expiryTime) : null;

  // A que cuenta pertenece: la app manda el id de la cuenta JMCS al comprar
  const { data: previa } = await supabaseAdmin
    .from("compras_google_play")
    .select("user_id, orden")
    .eq("purchase_token", purchaseToken)
    .maybeSingle();
  let userId = sub.externalAccountIdentifiers?.obfuscatedExternalAccountId || previa?.user_id || null;
  if (!userId && sub.linkedPurchaseToken) {
    const { data: enlazada } = await supabaseAdmin
      .from("compras_google_play")
      .select("user_id")
      .eq("purchase_token", sub.linkedPurchaseToken)
      .maybeSingle();
    userId = enlazada?.user_id || null;
  }
  if (userIdEsperado && userId && userId !== userIdEsperado) throw new Error("Esta compra pertenece a otra cuenta");
  if (!userId) userId = userIdEsperado;
  if (!userId) throw new Error("No se sabe a que cuenta pertenece la compra");

  // Cancelada = el usuario apago la renovacion, pero tiene acceso hasta que expire
  const activa =
    ESTADOS_ACTIVOS.includes(sub.subscriptionState) ||
    (sub.subscriptionState === "SUBSCRIPTION_STATE_CANCELED" && !!expira && expira > new Date());
  const pagoNuevo = !!sub.latestOrderId && sub.latestOrderId !== previa?.orden;

  await supabaseAdmin.from("compras_google_play").upsert({
    purchase_token: purchaseToken,
    user_id: userId,
    producto: productId,
    plan_base: planBase,
    estado: sub.subscriptionState,
    expira: expira ? expira.toISOString() : null,
    orden: sub.latestOrderId || null,
    actualizado_en: new Date().toISOString(),
  });

  // Solo se toca el perfil si la compra esta activa, o si su plan actual es
  // de Google Play (asi un aviso viejo no apaga un plan pagado en la web).
  const { data: perfil } = await supabaseAdmin
    .from("perfiles")
    .select("origen_suscripcion, suscripcion_activa")
    .eq("user_id", userId)
    .maybeSingle();
  if (activa || perfil?.origen_suscripcion === "google_play") {
    const cambios = {
      suscripcion_activa: activa,
      origen_suscripcion: "google_play",
      suscripcion_proximo_pago: expira ? expira.toISOString() : null,
    };
    if (PLAN_POR_BASE[planBase]) cambios.plan_suscripcion = PLAN_POR_BASE[planBase];
    if (activa && pagoNuevo) cambios.suscripcion_fecha_pago = new Date().toISOString();
    // Si antes pago con Wompi, se borra su tarjeta guardada: asi Wompi nunca le cobra doble
    if (activa) cambios.wompi_payment_source_id = null;
    await supabaseAdmin.from("perfiles").update(cambios).eq("user_id", userId);
  }

  // Confirmar la compra (si no se confirma en 3 dias, Google la reembolsa)
  if (activa && sub.acknowledgementState === "ACKNOWLEDGEMENT_STATE_PENDING") {
    await pedirGoogle(`purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`, {
      method: "POST",
      body: "{}",
    });
  }

  return { activa, plan: PLAN_POR_BASE[planBase] || null, expira, userId };
}

// Respaldo diario: planes de Google Play que ya pasaron su fecha y no han
// llegado avisos (renovo, se cancelo, fallo el cobro...). Se vuelven a consultar.
export async function revisarVencidasGooglePlay(maximo = 40) {
  if (!process.env.GOOGLE_PLAY_CUENTA_SERVICIO) return 0;
  const { data: vencidas } = await supabaseAdmin
    .from("perfiles")
    .select("user_id")
    .eq("origen_suscripcion", "google_play")
    .eq("suscripcion_activa", true)
    .lte("suscripcion_proximo_pago", new Date().toISOString())
    .limit(maximo);
  let revisadas = 0;
  for (const p of vencidas || []) {
    const { data: compra } = await supabaseAdmin
      .from("compras_google_play")
      .select("purchase_token")
      .eq("user_id", p.user_id)
      .order("actualizado_en", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!compra) continue;
    try {
      await sincronizarCompra(compra.purchase_token);
      revisadas++;
    } catch {
      // se intenta de nuevo manana
    }
  }
  return revisadas;
}
