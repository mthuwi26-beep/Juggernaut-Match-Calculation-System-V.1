export default async function handler(req, res) {
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ error: "Falta la fecha" });
  }

  try {
    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures?date=${date}`,
      {
        headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY },
      }
    );

    const data = await response.json();

    if (data.errors && Object.keys(data.errors).length > 0) {
      return res.status(200).json({ error: JSON.stringify(data.errors) });
    }

    // Limitamos a 50 para no saturar la pantalla (partidos de todo el mundo en un solo día pueden ser cientos)
    res.status(200).json((data.response || []).slice(0, 50));
  } catch (error) {
    res.status(500).json({ error: "No se pudo conectar con API-Football" });
  }
}
