import { obtenerCache, guardarCache, CACHE_7_DIAS } from "../../lib/cacheApi";

export default async function handler(req, res) {
  const { name } = req.query;

  if (!name || name.trim().length < 3) {
    return res.status(400).json({ error: "Escribe al menos 3 letras del nombre del equipo" });
  }

  const clave = `teams:${name.trim().toLowerCase()}`;
  const cacheado = await obtenerCache(clave);
  if (cacheado) return res.status(200).json(cacheado);

  try {
    const response = await fetch(
      `https://v3.football.api-sports.io/teams?search=${encodeURIComponent(name)}`,
      {
        headers: {
          "x-apisports-key": process.env.API_FOOTBALL_KEY,
        },
      }
    );

    const data = await response.json();

    if (data.errors && Object.keys(data.errors).length > 0) {
      return res.status(200).json({ error: JSON.stringify(data.errors) });
    }

    const resultado = data.response || [];
    await guardarCache(clave, resultado, CACHE_7_DIAS);
    res.status(200).json(resultado);
  } catch (error) {
    res.status(500).json({ error: "No se pudo conectar con API-Football" });
  }
}
