import Head from "next/head";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// ============================================================
// Pagina publica para eliminar la cuenta (Google Play exige una direccion
// web para esto). Explica que se borra y, si hay sesion, permite hacerlo.
// ============================================================
const estiloPagina = {
  minHeight: "100vh",
  background: "#0f1f14",
  color: "#e8f0ea",
  fontFamily: "'IBM Plex Sans', sans-serif",
  padding: "40px 20px",
  lineHeight: 1.6,
};
const estiloP = { fontSize: 14, color: "#c8d6cc", marginBottom: 10 };

export default function EliminarCuenta() {
  const [sesion, setSesion] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [confirmacion, setConfirmacion] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data?.session || null);
      setCargando(false);
    });
  }, []);

  async function eliminar() {
    setError("");
    setEnviando(true);
    try {
      const r = await fetch("/api/eliminar-cuenta", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sesion.access_token}` },
        body: JSON.stringify({ confirmacion }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo eliminar la cuenta.");
      await supabase.auth.signOut();
      setResultado("Tu cuenta y todos tus datos fueron eliminados.");
    } catch (e) {
      setError(e.message);
    }
    setEnviando(false);
  }

  return (
    <div style={estiloPagina}>
      <Head>
        <title>Eliminar mi cuenta — JMCS</title>
        <meta name="robots" content="index, follow" />
      </Head>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>Eliminar mi cuenta de JMCS</h1>
        <p style={{ ...estiloP, color: "#8fae97" }}>JMCS — Juggernaut Match Calculation System</p>

        <h2 style={{ fontSize: 17, color: "#f5c542", marginTop: 24 }}>Qué se borra</h2>
        <p style={estiloP}>
          Tu cuenta de acceso, tu perfil (nombre, foto y preferencias), tus estudios guardados, tus favoritos, tu
          historial, tus notificaciones y los registros de tus compras. El borrado es inmediato y no se puede deshacer.
        </p>
        <p style={estiloP}>
          Los resultados del Backtesting (lo que dijo el semáforo en cada partido) no tienen datos personales y se conservan.
        </p>

        <h2 style={{ fontSize: 17, color: "#f5c542", marginTop: 24 }}>Si tienes un plan pagado</h2>
        <p style={estiloP}>
          Eliminar la cuenta detiene los cobros de la página web (Wompi). Si pagaste con Google Play, cancela también
          la suscripción en Play Store → Pagos y suscripciones, porque el cobro lo maneja Google.
        </p>

        <h2 style={{ fontSize: 17, color: "#f5c542", marginTop: 24 }}>Cómo eliminarla</h2>
        <p style={estiloP}>
          En la app: Perfil → Eliminar mi cuenta. En la web: aquí mismo, con tu sesión iniciada.
        </p>

        <div style={{ background: "#153823", border: "1px solid #2A5A3A", borderRadius: 10, padding: 18, marginTop: 18 }}>
          {cargando ? (
            <p style={estiloP}>Cargando...</p>
          ) : resultado ? (
            <p style={{ ...estiloP, color: "#7ee2a0", fontWeight: "bold" }}>{resultado}</p>
          ) : !sesion ? (
            <p style={estiloP}>
              Para eliminar tu cuenta desde aquí, primero <a href="/" style={{ color: "#f5c542" }}>inicia sesión en JMCS</a> y
              vuelve a esta página.
            </p>
          ) : (
            <>
              <p style={estiloP}>
                Sesión iniciada como <strong>{sesion.user?.email}</strong>. Para confirmar, escribe <strong>ELIMINAR</strong>:
              </p>
              <input
                value={confirmacion}
                onChange={(e) => setConfirmacion(e.target.value)}
                placeholder="ELIMINAR"
                style={{ width: "100%", padding: 10, fontSize: 14, borderRadius: 6, border: "1px solid #2A5A3A", background: "#0f1f14", color: "#e8f0ea", marginBottom: 12 }}
              />
              {error && <p style={{ ...estiloP, color: "#e05555" }}>{error}</p>}
              <button
                onClick={eliminar}
                disabled={confirmacion !== "ELIMINAR" || enviando}
                style={{ width: "100%", padding: 12, fontSize: 14, fontWeight: "bold", border: "none", borderRadius: 6, cursor: confirmacion === "ELIMINAR" ? "pointer" : "not-allowed", background: confirmacion === "ELIMINAR" ? "#e05555" : "#5a3a3a", color: "#fff" }}
              >
                {enviando ? "Eliminando..." : "Eliminar mi cuenta para siempre"}
              </button>
            </>
          )}
        </div>
        <p style={{ ...estiloP, marginTop: 24 }}>
          <a href="/" style={{ color: "#f5c542" }}>← Volver a JMCS</a>
        </p>
      </div>
    </div>
  );
}
