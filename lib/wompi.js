// Helper del lado del servidor para hablar con la API de Wompi.
//
// A diferencia de antes, ya NO usa una sola clave fija — consulta la base
// de datos (configuracion_app.wompi_modo) para saber si tiene que usar las
// claves de PRUEBA o las REALES, según lo que haya elegido un admin desde
// el panel. Así el interruptor de "Prueba/Real" cambia algo de verdad, sin
// que haya que entrar a Vercel a mano cada vez.
import crypto from "crypto";
import { supabaseAdmin } from "./supabaseAdmin";

async function obtenerConfigWompi() {
  const { data } = await supabaseAdmin
    .from("configuracion_app")
    .select("wompi_modo")
    .eq("id", 1)
    .maybeSingle();

  const modoReal = data?.wompi_modo === "real";

  if (modoReal) {
    return {
      baseUrl: "https://production.wompi.co/v1",
      llavePrivada: process.env.WOMPI_LLAVE_PRIVADA_REAL,
      secretoIntegridad: process.env.WOMPI_SECRETO_INTEGRIDAD_REAL,
      modo: "real",
    };
  }

  return {
    baseUrl: process.env.WOMPI_BASE_URL || "https://sandbox.wompi.co/v1",
    llavePrivada: process.env.WOMPI_LLAVE_PRIVADA,
    secretoIntegridad: process.env.WOMPI_SECRETO_INTEGRIDAD,
    modo: "prueba",
  };
}

// Wompi exige esta firma en cada transacción, para evitar que alguien
// intercepte y modifique el monto en el camino. Fórmula oficial (el orden
// importa): SHA256(referencia + monto_en_centavos + moneda + secreto)
export async function firmarTransaccion(referencia, montoEnCentavos, moneda = "COP") {
  const { secretoIntegridad, modo } = await obtenerConfigWompi();
  if (!secretoIntegridad) {
    throw new Error(`Falta configurar el secreto de integridad de Wompi para el modo "${modo}" en Vercel`);
  }
  const cadena = `${referencia}${montoEnCentavos}${moneda}${secretoIntegridad}`;
  return crypto.createHash("sha256").update(cadena).digest("hex");
}

export async function wompiFetch(ruta, opciones = {}) {
  const { baseUrl, llavePrivada, modo } = await obtenerConfigWompi();
  if (!llavePrivada) {
    throw new Error(`Falta configurar la llave privada de Wompi para el modo "${modo}" en Vercel`);
  }
  const respuesta = await fetch(`${baseUrl}${ruta}`, {
    ...opciones,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${llavePrivada}`,
      ...(opciones.headers || {}),
    },
  });
  const datos = await respuesta.json();
  if (!respuesta.ok) {
    const error = new Error(datos.error?.reason || "Error de Wompi");
    error.datos = datos;
    throw error;
  }
  return datos;
}
