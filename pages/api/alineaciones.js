export default async function handler(req, res) {
  const { fixtureId } = req.query;

  if (!fixtureId) {
    return res.status(400).json({ error: "Falta el ID del partido" });
  }

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
      return res.status(200).json({ error: "Las alineaciones todavía no están disponibles para este partido" });
    }

    res.status(200).json(alineaciones);
  } catch (error) {
    res.status(500).json({ error: "No se pudieron traer las alineaciones" });
  }
}
