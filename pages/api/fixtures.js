export default async function handler(req, res) {
  const { teamId, season } = req.query;

  if (!teamId) {
    return res.status(400).json({ error: "Falta el ID del equipo" });
  }

  // MODO PRUEBA (plan gratis): el plan gratis de API-Football solo permite
  // ver las temporadas 2022, 2023 y 2024, y no permite el parámetro "last".
  // Por eso pedimos por temporada y recortamos los últimos 10 nosotros mismos.
  //
  // >>> CUANDO PASES AL PLAN PAGADO <
  // Solo cambia la línea de abajo por: const temporada = season || new Date().getFullYear();
  // y ya podrás traer la temporada actual en vivo, sin tocar nada más del código.
  const temporada = season || 2024;

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
      return res.status(200).json({ error: JSON.stringify(data.errors) });
    }

    const partidos = data.response || [];

    const jugados = partidos
      .filter((f) => f.fixture.status.short === "FT")
      .sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date))
      .slice(0, 10);

    res.status(200).json(jugados);
  } catch (error) {
    res.status(500).json({ error: "No se pudo traer los partidos del equipo" });
  }
}
