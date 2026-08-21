export default async function handler(req, res) {
  const { teamId } = req.query;

  if (!teamId) {
    return res.status(400).json({ error: "Falta el ID del equipo" });
  }

  try {
    const response = await fetch(
      `https://api.football-data.org/v4/teams/${teamId}/matches?status=FINISHED&limit=10`,
      {
        headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_KEY },
      }
    );

    const data = await response.json();

    if (data.errorCode) {
      return res.status(200).json({ error: data.message || "Error de football-data.org" });
    }

    // Ordenamos del partido más reciente al más viejo
    const partidos = (data.matches || []).sort(
      (a, b) => new Date(b.utcDate) - new Date(a.utcDate)
    );

    res.status(200).json(partidos);
  } catch (error) {
    res.status(500).json({ error: "No se pudo traer los partidos del equipo" });
  }
}
