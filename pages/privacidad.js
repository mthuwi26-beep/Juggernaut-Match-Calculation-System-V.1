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

export default function Privacidad() {
  return (
    <div style={estiloPagina}>
      <Head>
        <title>Política de Privacidad — JMCS</title>
        <meta name="robots" content="index, follow" />
      </Head>
      <div style={estiloContenido}>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>Política de Privacidad de JMCS</h1>
        <p style={{ ...estiloP, color: "#8fae97" }}>Última actualización: septiembre de 2026</p>

        <p style={estiloP}>
          JMCS (Juggernaut Match Calculation System) es una herramienta de análisis y pronósticos de fútbol.
          Esta política explica qué información recolectamos, para qué la usamos y qué control tenés sobre ella.
        </p>

        <h2 style={estiloH2}>1. Qué información recolectamos</h2>
        <p style={estiloP}>
          Cuando creás una cuenta (por correo, Google o enlace mágico) guardamos tu correo electrónico, un nombre
          de usuario, y opcionalmente una foto de perfil. Si iniciás sesión con Google, recibimos tu nombre y
          correo asociados a esa cuenta, según los permisos que apruebes en ese momento — no accedemos a ningún
          otro dato de tu cuenta de Google.
        </p>
        <p style={estiloP}>
          También guardamos la actividad relacionada con el uso de la app: equipos y países que consultás en
          Estudio, pronósticos que guardás y su resultado, equipos que marcás como favoritos, y tu progreso en el
          ranking de aciertos.
        </p>
        <p style={estiloP}>
          Si activás las notificaciones, guardamos la información técnica necesaria para poder enviártelas (una
          "suscripción" de notificaciones de tu navegador). Se borra apenas las desactivás.
        </p>
        <p style={estiloP}>
          Si te suscribís a un plan pago, el procesamiento del pago lo hace Wompi directamente — nosotros no
          almacenamos el número completo de tu tarjeta en ningún momento. Guardamos únicamente una referencia a
          la suscripción y el estado del pago que Wompi nos confirma.
        </p>

        <h2 style={estiloH2}>2. Para qué usamos tu información</h2>
        <p style={estiloP}>
          Para darte acceso a tu cuenta y tus datos guardados, procesar tu suscripción si tenés una, mostrarte tu
          historial y estadísticas de aciertos, y — si activaste las notificaciones — avisarte sobre los partidos
          de tus equipos favoritos.
        </p>

        <h2 style={estiloH2}>3. Con quién compartimos información</h2>
        <p style={estiloP}>
          No vendemos tu información a terceros. Compartimos únicamente lo necesario para que la app funcione,
          con estos proveedores:
        </p>
        <p style={estiloP}>
          <strong>Supabase</strong> (base de datos, autenticación y almacenamiento de archivos), <strong>Wompi</strong>
          {" "}(procesamiento de pagos), <strong>Google</strong> (si elegís iniciar sesión con esa opción), y
          proveedores de datos deportivos (<strong>API-Football</strong> y <strong>PitchAPI</strong>) que reciben
          consultas sobre partidos, pero no reciben tu información personal.
        </p>

        <h2 style={estiloH2}>4. Tus derechos</h2>
        <p style={estiloP}>
          Podés pedirnos en cualquier momento que te mostremos, corrijamos o borremos tu información. Para
          eliminar tu cuenta y todos los datos asociados, escribinos a través del correo de contacto que figura
          más abajo.
        </p>

        <h2 style={estiloH2}>5. Menores de edad</h2>
        <p style={estiloP}>
          JMCS no está dirigido a menores de 18 años y no recolectamos intencionalmente información de menores.
        </p>

        <h2 style={estiloH2}>6. Cambios a esta política</h2>
        <p style={estiloP}>
          Si hacemos cambios importantes a esta política, los vamos a reflejar acá con la fecha de actualización.
        </p>

        <h2 style={estiloH2}>7. Contacto</h2>
        <p style={estiloP}>
          Ante cualquier duda sobre esta política o tus datos, escribinos a{" "}
          <a href="mailto:jmcsystem26@gmail.com" style={{ color: "#f5c542" }}>jmcsystem26@gmail.com</a>.
        </p>
      </div>
    </div>
  );
}
