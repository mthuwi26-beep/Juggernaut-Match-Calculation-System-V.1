// Trae córners, tarjetas y faltas de UN partido específico (endpoint fixtures/statistics)
export default async function handler(req, res) {
  const { fixtureId } = req.query;

  if (!fixtureId) {
    return res.status(400).json({ error: "Falta el ID del partido" });
  }

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
    res.status(200).json(data.response || []);
  } catch (error) {
    res.status(500).json({ error: "No se pudo traer las estadísticas del partido" });
  }
}
