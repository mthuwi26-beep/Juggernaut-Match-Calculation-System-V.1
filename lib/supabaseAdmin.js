import { createClient } from "@supabase/supabase-js";

// Cliente con permisos de administrador — SOLO se usa en el servidor.
// Igual que en lib/cacheApi.js, usa la service role key para leer/escribir
// tablas que no pertenecen a un usuario específico (o que necesitan verse
// "a través" de todos los usuarios, como el vigilante de notificaciones).
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
