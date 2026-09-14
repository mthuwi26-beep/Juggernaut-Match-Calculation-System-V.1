// Helper del lado del servidor para hablar con la API de Wompi.
// Wompi usa una URL distinta en pruebas (sandbox) y en producción — por eso
// la dejamos configurable en vez de fija. Mientras probemos, va a ser la de
// sandbox; cuando pasemos a cobrar de verdad, se cambia la variable
// WOMPI_BASE_URL en Vercel, no hace falta tocar este archivo.
const BASE_URL = process.env.WOMPI_BASE_URL || "https://sandbox.wompi.co/v1";

export async function wompiFetch(ruta, opciones = {}, llave = null) {
  const respuesta = await fetch(`${BASE_URL}${ruta}`, {
    ...opciones,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${llave || process.env.WOMPI_LLAVE_PRIVADA}`,
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
