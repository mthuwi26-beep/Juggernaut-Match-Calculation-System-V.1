import { obtenerCache, guardarCache, CACHE_2_HORAS } from "../../lib/cacheApi";

export default async function handler(req, res) {
  const { teamId } = req.query;

  if (!teamId) {
    return res.status(400).json({ error: "Falta el ID del equipo" });
  }

  const clave = `proximos-partidos:${teamId}`;
  const cacheado = await obtenerCache(clave);
  if (cacheado) return res.status(200).json(cacheado);

  try {
    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures?team=${teamId}&next=5`,
      { headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY } }
    );

    const data = await response.json();

    if (data.errors && Object.keys(data.errors).length > 0) {
      return res.status(200).json({ error: JSON.stringify(data.errors) });
    }

    const resultado = data.response || [];
    await guardarCache(clave, resultado, CACHE_2_HORAS);
    res.status(200).json(resultado);
  } catch (error) {
    res.status(500).json({ error: "No se pudo traer los próximos partidos" });
  }
}
