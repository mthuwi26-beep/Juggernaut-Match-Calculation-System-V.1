import { createClient } from "@supabase/supabase-js";

// Cliente con permisos de administrador — SOLO se usa acá, en el servidor (rutas de pages/api).
// Nunca debe importarse desde un componente de React ni llegar al navegador.
// Usa la SUPABASE_SERVICE_ROLE_KEY que ya estaba en Vercel sin usar, justo para este tipo de
// tarea: leer/escribir una tabla que no le pertenece a ningún usuario en particular.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Números de referencia en milisegundos, para no repetir cuentas en cada archivo
export const CACHE_15_SEGUNDOS = 15 * 1000;
export const CACHE_3_MINUTOS = 3 * 60 * 1000;
export const CACHE_15_MINUTOS = 15 * 60 * 1000;
export const CACHE_30_MINUTOS = 30 * 60 * 1000;
export const CACHE_2_HORAS = 2 * 60 * 60 * 1000;
export const CACHE_3_HORAS = 3 * 60 * 60 * 1000;
export const CACHE_12_HORAS = 12 * 60 * 60 * 1000;
export const CACHE_7_DIAS = 7 * 24 * 60 * 60 * 1000;
// Usamos un número grande en vez de "para siempre" literal, para no complicar la consulta con nulls
export const CACHE_PARA_SIEMPRE = 5 * 365 * 24 * 60 * 60 * 1000;

// Busca algo en el caché. Devuelve null si no está, si ya expiró, o si algo falla —
// en cualquiera de esos casos, quien llama simplemente sigue como si no hubiera caché
// y le pide el dato de nuevo a la API real. Preferimos gastar una consulta de más
// a romper la pantalla del usuario por un problema del caché.
export async function obtenerCache(clave) {
  try {
    const { data, error } = await supabaseAdmin
      .from("cache_api")
      .select("valor")
      .eq("clave", clave)
      .gt("expira_en", new Date().toISOString())
      .maybeSingle();
    if (error || !data) return null;
    return data.valor;
  } catch {
    return null;
  }
}

// Guarda algo en el caché con su fecha de expiración. Si falla, no pasa nada grave —
// la próxima visita simplemente vuelve a pedirlo a la API real.
export async function guardarCache(clave, valor, ttlMs) {
  try {
    await supabaseAdmin.from("cache_api").upsert({
      clave,
      valor,
      expira_en: new Date(Date.now() + ttlMs).toISOString(),
    });
  } catch {
    // silencioso a propósito: el caché es una optimización, no algo de lo que dependa la app
  }
}
