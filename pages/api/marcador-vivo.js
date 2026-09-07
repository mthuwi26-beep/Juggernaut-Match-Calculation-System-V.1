export default async function handler(req, res) {
  const { fixtureId } = req.query;

  if (!fixtureId) {
    return res.status(400).json({ error: "Falta el ID del partido" });
  }

  try {
    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures?id=${fixtureId}`,
      { headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY } }
    );

    const data = await response.json();

    if (data.errors && Object.keys(data.errors).length > 0) {
      return res.status(200).json({ error: JSON.stringify(data.errors) });
    }

    const partido = (data.response || [])[0];
    if (!partido) {
      return res.status(200).json({ error: "No se encontró el partido" });
    }

    res.status(200).json({
      estadoCorto: partido.fixture.status.short, // ej: "NS", "1H", "HT", "2H", "FT"
      minuto: partido.fixture.status.elapsed,
      golesLocal: partido.goals.home,
      golesVisitante: partido.goals.away,
    });
  } catch (error) {
    res.status(500).json({ error: "No se pudo consultar el marcador en vivo" });
  }
}
