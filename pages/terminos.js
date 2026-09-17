import Head from "next/head";

const estiloPagina = {
  minHeight: "100vh",
  background: "#0f1f14",
  color: "#e8f0ea",
  fontFamily: "'IBM Plex Sans', sans-serif",
  padding: "40px 20px",
  lineHeight: 1.6,
};

const estiloContenido = {
  maxWidth: 720,
  margin: "0 auto",
};

const estiloH2 = { fontSize: 18, marginTop: 32, marginBottom: 10, color: "#f5c542" };
const estiloP = { fontSize: 14, color: "#c8d6cc", marginBottom: 10 };

export default function Terminos() {
  return (
    <div style={estiloPagina}>
      <Head>
        <title>Términos y Condiciones — JMCS</title>
        <meta name="robots" content="index, follow" />
      </Head>
      <div style={estiloContenido}>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>Términos y Condiciones de JMCS</h1>
        <p style={{ ...estiloP, color: "#8fae97" }}>Última actualización: septiembre de 2026</p>

        <p style={estiloP}>
          Al crear una cuenta o usar JMCS (Juggernaut Match Calculation System), aceptás estos términos. Si no
          estás de acuerdo, por favor no uses la app.
        </p>

        <h2 style={estiloH2}>1. Qué es JMCS</h2>
        <p style={estiloP}>
          JMCS es una herramienta de métricas y análisis estadístico de fútbol: rendimiento como local/visitante,
          enfrentamientos directos, y probabilidades por competición, calculadas sobre datos históricos reales.
          Las cifras que mostramos son estimaciones estadísticas, no garantías de resultado. La herramienta te da
          los datos, tú sacas tus propias conclusiones.
        </p>

        <h2 style={estiloH2}>2. Tu cuenta</h2>
        <p style={estiloP}>
          Al registrarte, aceptas brindar información real y eres responsable de la actividad en tu cuenta.
          Podemos suspender cuentas que hagan mal uso de la plataforma.
        </p>

        <h2 style={estiloH2}>3. Suscripciones y pagos</h2>
        <p style={estiloP}>
          Los planes "Pro" y "Max" son suscripciones pagas con cobro automático (mensual o anual, según el plan
          elegido) a través de Wompi. Podés cancelar tu suscripción en cualquier momento desde tu perfil — la
          cancelación aplica a partir del próximo ciclo de cobro, y seguís teniendo acceso hasta el final del
          período ya pagado.
        </p>

        <h2 style={estiloH2}>4. Programa de referidos</h2>
        <p style={estiloP}>
          Los premios del programa de referidos (días gratis para quien invita y para quien se registra con un
          código) se otorgan según las condiciones vigentes al momento del registro o la suscripción, y podemos
          ajustar esas condiciones hacia adelante sin afectar premios ya otorgados.
        </p>

        <h2 style={estiloH2}>5. Uso permitido</h2>
        <p style={estiloP}>
          No está permitido intentar vulnerar la seguridad de la plataforma, usar la app para fines ilegales, ni
          revender o redistribuir el contenido de JMCS sin autorización.
        </p>

        <h2 style={estiloH2}>6. Disponibilidad del servicio</h2>
        <p style={estiloP}>
          Hacemos lo posible para que JMCS esté siempre disponible, pero puede haber interrupciones por
          mantenimiento o por fallas de los proveedores externos de datos deportivos de los que dependemos.
        </p>

        <h2 style={estiloH2}>7. Cambios a estos términos</h2>
        <p style={estiloP}>
          Podemos actualizar estos términos con el tiempo. Si hacemos cambios importantes, los vamos a reflejar
          acá con la fecha de actualización.
        </p>

        <h2 style={estiloH2}>8. Contacto</h2>
        <p style={estiloP}>
          Ante cualquier duda sobre estos términos, escribinos a{" "}
          <a href="mailto:jmcsystem26@gmail.com" style={{ color: "#f5c542" }}>jmcsystem26@gmail.com</a>.
        </p>
      </div>
    </div>
  );
}
