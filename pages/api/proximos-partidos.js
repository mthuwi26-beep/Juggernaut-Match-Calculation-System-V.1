export default async function handler(req, res) {
  const { teamId } = req.query;

  if (!teamId) {
    return res.status(400).json({ error: "Falta el ID del equipo" });
  }

  try {
    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures?team=${teamId}&next=5`,
      { headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY } }
    );

    const data = await response.json();

    if (data.errors && Object.keys(data.errors).length > 0) {
      return res.status(200).json({ error: JSON.stringify(data.errors) });
    }

    res.status(200).json(data.response || []);
  } catch (error) {
    res.status(500).json({ error: "No se pudo traer los próximos partidos" });
  }
}