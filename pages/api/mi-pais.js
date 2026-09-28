// Devuelve el país aproximado de quien visita, a partir de su conexión.
// Vercel lo manda en el encabezado "x-vercel-ip-country" (ej. "CO").
// No es la ubicación exacta y no hace falta pedirle permiso al usuario.
export default function handler(req, res) {
  const codigo = req.headers["x-vercel-ip-country"] || null;
  res.setHeader("Cache-Control", "private, no-store");
  res.status(200).json({ codigo });
}
