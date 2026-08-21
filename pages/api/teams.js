export default async function handler(req, res) {
  const { name } = req.query;

  if (!name || name.trim().length < 3) {
    return res.status(400).json({ error: "Escribe al menos 3 letras del nombre del equipo" });
  }

  try {
    const response = await fetch(
      `https://v3.football.api-sports.io/teams?search=${encodeURIComponent(name)}`,
      {
        headers: {
          "x-apisports-key": process.env.API_FOOTBALL_KEY,
        },
      }
    );

    const data = await response.json();
    res.status(200).json(data.response || []);
  } catch (error) {
    res.status(500).json({ error: "No se pudo conectar con API-Football" });
  }
}
