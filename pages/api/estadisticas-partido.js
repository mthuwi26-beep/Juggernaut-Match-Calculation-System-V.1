// Trae córners, tarjetas y faltas de UN partido específico (endpoint fixtures/statistics)
import { obtenerCache, guardarCache, CACHE_30_MINUTOS } from "../../lib/cacheApi";

export default async function handler(req, res) {
  const { fixtureId } = req.query;

  if (!fixtureId) {
    return res.status(400).json({ error: "Falta el ID del partido" });
  }

  const clave = `estadisticas-partido:${fixtureId}`;
  const cacheado = await obtenerCache(clave);
  if (cacheado) return res.status(200).json(cacheado);

  try {
    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures/statistics?fixture=${fixtureId}`,
      {
        headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY },
      }
    );

    const data = await response.json();

    if (data.errors && Object.keys(data.errors).length > 0) {
      return res.status(200).json({ error: JSON.stringify(data.errors) });
    }

    // data.response trae un array con las estadísticas de cada equipo (home y away)
    const resultado = data.response || [];
    // Ojo: si este partido está EN VIVO en este momento, córners/tarjetas/faltas pueden
    // quedar desactualizados hasta por 30 minutos. Es un balance a propósito: este es el
    // endpoint que más cuota gasta ("datos puntuales"), y la mayoría de las veces se usa
    // para partidos de referencia ya jugados (H2H), no para seguir uno en vivo minuto a minuto.
    await guardarCache(clave, resultado, CACHE_30_MINUTOS);
    res.status(200).json(resultado);
  } catch (error) {
    res.status(500).json({ error: "No se pudo traer las estadísticas del partido" });
  }
}
