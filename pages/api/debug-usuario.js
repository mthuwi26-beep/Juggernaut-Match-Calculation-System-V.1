// RUTA TEMPORAL — solo para averiguar el correo real de una cuenta de
// prueba de MercadoPago (el panel visual no lo muestra). Borrar esta ruta
// una vez que ya no la necesitemos, no debe quedar en producción.
import { mpFetch } from "../../lib/mercadopago";

export default async function handler(req, res) {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ error: "Pasá ?userId=3688279832 en la URL" });
  }
  try {
    const datos = await mpFetch(`/users/${userId}`);
    res.status(200).json(datos);
  } catch (error) {
    res.status(500).json({ error: error.datos || error.message });
  }
}
