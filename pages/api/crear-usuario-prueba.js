// RUTA TEMPORAL — crea una cuenta de prueba de MercadoPago vía API (a
// diferencia de crearla desde el panel visual, esto SÍ nos devuelve el
// correo real en la respuesta). Borrar esta ruta cuando ya no se necesite.
import { mpFetch } from "../../lib/mercadopago";

export default async function handler(req, res) {
  try {
    const datos = await mpFetch("/users/test", {
      method: "POST",
      body: JSON.stringify({ site_id: "MCO", description: "Comprador de prueba JMCS" }),
    });
    res.status(200).json(datos);
  } catch (error) {
    res.status(500).json({ error: error.datos || error.message });
  }
}
