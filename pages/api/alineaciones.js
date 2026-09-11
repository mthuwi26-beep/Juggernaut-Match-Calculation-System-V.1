import { obtenerCache, guardarCache, CACHE_15_MINUTOS } from "../../lib/cacheApi";

export default async function handler(req, res) {
  const { fixtureId } = req.query;

  if (!fixtureId) {
    return res.status(400).json({ error: "Falta el ID del partido" });
  }

  const clave = `alineaciones:${fixtureId}`;
  const cacheado = await obtenerCache(clave);
  if (cacheado) return res.status(200).json(cacheado);

  try {
    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures/lineups?fixture=${fixtureId}`,
      { headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY } }
    );

    const data = await response.json();

    if (data.errors && Object.keys(data.errors).length > 0) {
      return res.status(200).json({ error: JSON.stringify(data.errors) });
    }

    const alineaciones = data.response || [];
    if (alineaciones.length < 2) {
      // No cacheamos este caso: significa que todavía no se publicaron, y queremos
      // que la próxima vez que el usuario mire, si ya salieron, las traiga de una.
      return res.status(200).json({ error: "Las alineaciones todavía no están disponibles para este partido" });
    }

    await guardarCache(clave, alineaciones, CACHE_15_MINUTOS);
    res.status(200).json(alineaciones);
  } catch (error) {
    res.status(500).json({ error: "No se pudieron traer las alineaciones" });
  }
}
