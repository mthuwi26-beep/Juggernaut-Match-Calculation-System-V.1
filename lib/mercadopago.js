// Helper del lado del servidor para hablar con la API de MercadoPago.
// No usamos un SDK aparte — MercadoPago tiene una API REST simple, así que
// alcanza con fetch normal, sin agregar una dependencia nueva al proyecto.
const BASE_URL = "https://api.mercadopago.com";

export async function mpFetch(ruta, opciones = {}) {
  const respuesta = await fetch(`${BASE_URL}${ruta}`, {
    ...opciones,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
      ...(opciones.headers || {}),
    },
  });
  const datos = await respuesta.json();
  if (!respuesta.ok) {
    const error = new Error(datos.message || "Error de MercadoPago");
    error.datos = datos;
    throw error;
  }
  return datos;
}
