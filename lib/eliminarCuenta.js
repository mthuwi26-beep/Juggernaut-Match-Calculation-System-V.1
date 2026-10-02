// ============================================================
// Eliminar una cuenta y TODOS sus datos (lo exige Google Play).
// Se usa desde /api/eliminar-cuenta (web y app).
// ============================================================
import { supabaseAdmin } from "./supabaseAdmin";

// Tablas con datos del usuario (tabla, columna). Si una no existe o no
// tiene esa columna, se sigue con las demas.
const DATOS_DEL_USUARIO = [
  ["favoritos", "user_id"],
  ["predicciones", "user_id"],
  ["push_subscriptions", "user_id"],
  ["fcm_tokens", "user_id"],
  ["historial_busquedas_estudio", "user_id"],
  ["historial_visitas", "user_id"],
  ["alertas_semaforo_enviadas", "user_id"],
  ["referidos", "referidor_id"],
  ["referidos", "referido_id"],
  ["compras_google_play", "user_id"],
  ["admins", "user_id"],
  ["perfiles", "user_id"],
];

export async function eliminarCuenta(userId) {
  // 1) Foto de perfil subida (carpeta del usuario en "avatars")
  try {
    const { data: archivos } = await supabaseAdmin.storage.from("avatars").list(userId);
    if (archivos && archivos.length > 0) {
      await supabaseAdmin.storage.from("avatars").remove(archivos.map((a) => `${userId}/${a.name}`));
    }
  } catch {
    // si no tiene foto propia, no pasa nada
  }
  // 2) Sus datos en cada tabla
  for (const [tabla, columna] of DATOS_DEL_USUARIO) {
    try {
      await supabaseAdmin.from(tabla).delete().eq(columna, userId);
    } catch {
      // tabla o columna que no existe: se sigue
    }
  }
  // 3) La cuenta de acceso (correo / Google)
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
}
