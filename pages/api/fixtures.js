export default async function handler(req, res) {
  const { teamId, season } = req.query;

  if (!teamId) {
    return res.status(400).json({ error: "Falta el ID del equipo" });
  }

  // El plan gratis no permite el parámetro "last", así que pedimos por temporada
  // y nosotros mismos recortamos los últimos 10 partidos ya jugados.
  const temporada = season || new Date().getFullYear();

  try {
    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures?team=${teamId}&season=${temporada}`,
      {
        headers: {
          "x-apisports-key": process.env.API_FOOTBALL_KEY,
        },
      }
    );

    const data = await response.json();

    if (data.errors && Object.keys(data.errors).length > 0) {
      return res.status(200).json({ error: JSON.stringify(data.errors), raw: data });
    }

    const partidos = data.response || [];

    // Solo partidos ya jugados (con resultado final), ordenados del más reciente al más viejo
    const jugados = partidos
      .filter((f) => f.fixture.status.short === "FT")
      .sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date))
      .slice(0, 10);

    res.status(200).json(jugados);
  } catch (error) {
    res.status(500).json({ error: "No se pudo traer los partidos del equipo" });
  }
}
