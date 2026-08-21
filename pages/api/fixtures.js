export default async function handler(req, res) {
  const { teamId } = req.query;

  if (!teamId) {
    return res.status(400).json({ error: "Falta el ID del equipo" });
  }

  try {
    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures?team=${teamId}&last=10`,
      {
        headers: {
          "x-apisports-key": process.env.API_FOOTBALL_KEY,
        },
      }
    );

    const data = await response.json();

    // Si la API devuelve errores (ej: límite de temporada en plan gratis), los mostramos
    if (data.errors && Object.keys(data.errors).length > 0) {
      return res.status(200).json({ error: JSON.stringify(data.errors), raw: data });
    }

    res.status(200).json(data.response || []);
  } catch (error) {
    res.status(500).json({ error: "No se pudo traer los partidos del equipo" });
  }
}
