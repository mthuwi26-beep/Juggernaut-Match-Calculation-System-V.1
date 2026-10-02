// ============================================================
// Panel de administrador: buscar usuarios, regalar un plan y cancelarlo.
// Lo hace el servidor directamente (antes dependia de funciones RPC de la
// base de datos). Solo administradores.
//   GET  ?termino=correo-o-usuario
//   POST { accion: "otorgar", userId, plan: "mensual" | "anual" }
//   POST { accion: "cancelar", userId }
// ============================================================
import { supabaseAdmin } from "../../lib/supabaseAdmin";

const CAMPOS = "user_id, username, suscripcion_activa, plan_suscripcion, suscripcion_fecha_pago, suscripcion_proximo_pago";

async function esAdmin(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return false;
  const { data: fila } = await supabaseAdmin.from("admins").select("user_id").eq("user_id", data.user.id).maybeSingle();
  return !!fila;
}

// Perfiles con todos los campos, y si existe, el origen del plan
async function leerPerfiles(ids) {
  if (ids.length === 0) return [];
  const conOrigen = await supabaseAdmin.from("perfiles").select(`${CAMPOS}, origen_suscripcion`).in("user_id", ids);
  if (!conOrigen.error) return conOrigen.data || [];
  const sinOrigen = await supabaseAdmin.from("perfiles").select(CAMPOS).in("user_id", ids);
  return sinOrigen.data || [];
}

async function buscar(termino) {
  const t = termino.trim().toLowerCase();
  // Correos (estan en las cuentas de acceso, no en perfiles)
  const correos = {};
  for (let pagina = 1; pagina <= 5; pagina++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: pagina, perPage: 1000 });
    if (error) throw new Error(`No se pudieron leer las cuentas: ${error.message}`);
    if (!data?.users?.length) break;
    data.users.forEach((u) => { correos[u.id] = u.email || ""; });
    if (data.users.length < 1000) break;
  }
  const porCorreo = Object.entries(correos).filter(([, email]) => email.toLowerCase().includes(t)).map(([id]) => id);
  const { data: porNombre } = await supabaseAdmin.from("perfiles").select("user_id").ilike("username", `%${t}%`).limit(20);
  const ids = [...new Set([...porCorreo, ...(porNombre || []).map((p) => p.user_id)])].slice(0, 20);
  const perfiles = await leerPerfiles(ids);
  // Tambien las cuentas que aun no tienen perfil (asi se ven igual en la busqueda)
  return ids.map((id) => {
    const p = perfiles.find((x) => x.user_id === id);
    return p
      ? { ...p, email: correos[id] || "" }
      : { user_id: id, email: correos[id] || "", username: "(sin perfil todavía)", suscripcion_activa: false, plan_suscripcion: null };
  });
}

async function actualizarPerfil(userId, cambios) {
  let r = await supabaseAdmin.from("perfiles").update(cambios).eq("user_id", userId).select("user_id");
  // Si la columna origen_suscripcion todavia no existe, se intenta sin ella
  if (r.error && "origen_suscripcion" in cambios) {
    const { origen_suscripcion, ...resto } = cambios;
    r = await supabaseAdmin.from("perfiles").update(resto).eq("user_id", userId).select("user_id");
  }
  if (r.error) throw new Error(r.error.message);
  if (!r.data || r.data.length === 0) {
    // Cuenta sin perfil: se le crea uno con el plan
    const { origen_suscripcion, wompi_payment_source_id, ...basico } = cambios;
    const nuevo = await supabaseAdmin.from("perfiles").insert({ user_id: userId, ...basico }).select("user_id");
    if (nuevo.error) throw new Error("Ese usuario no tiene perfil todavía. Pídele que entre una vez a JMCS y vuelve a intentarlo.");
  }
}

export default async function handler(req, res) {
  try {
    if (!(await esAdmin(req))) return res.status(403).json({ error: "Solo administradores" });

    if (req.method === "GET") {
      const termino = String(req.query.termino || "");
      if (!termino.trim()) return res.status(400).json({ error: "Escribe un correo o nombre de usuario" });
      return res.status(200).json({ usuarios: await buscar(termino) });
    }

    if (req.method === "POST") {
      const { accion, userId, plan } = req.body || {};
      if (!userId) return res.status(400).json({ error: "Falta el usuario" });
      if (accion === "otorgar") {
        const anual = plan === "anual";
        const ahora = new Date();
        const vence = new Date(ahora);
        if (anual) vence.setFullYear(vence.getFullYear() + 1);
        else vence.setMonth(vence.getMonth() + 1);
        await actualizarPerfil(userId, {
          suscripcion_activa: true,
          plan_suscripcion: anual ? "anual" : "mensual",
          suscripcion_fecha_pago: ahora.toISOString(),
          suscripcion_proximo_pago: vence.toISOString(),
          origen_suscripcion: "regalo",
          // Sin tarjeta: Wompi nunca intenta cobrar un plan regalado
          wompi_payment_source_id: null,
        });
        return res.status(200).json({ ok: true });
      }
      if (accion === "cancelar") {
        await actualizarPerfil(userId, { suscripcion_activa: false });
        return res.status(200).json({ ok: true });
      }
      return res.status(400).json({ error: "Acción no válida" });
    }
    return res.status(405).json({ error: "Método no permitido" });
  } catch (e) {
    return res.status(500).json({ error: e.message || "No se pudo completar" });
  }
}
