// Busca, entre los enfrentamientos históricos de dos equipos, el más cercano a hoy
// (sea pasado o futuro), para usarlo como "partido de referencia" y traer
// árbitro/clima automáticamente, igual que si se hubiera elegido desde el calendario.
export default async function handler(req, res) {
  const { team1, team2 } = req.query;

  if (!team1 || !team2) {
    return res.status(400).json({ error: "Faltan los IDs de los equipos" });
  }

  try {
    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures/headtohead?h2h=${team1}-${team2}`,
      { headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY } }
    );

    const data = await response.json();

    if (data.errors && Object.keys(data.errors).length > 0) {
      return res.status(200).json({ error: JSON.stringify(data.errors) });
    }

    const partidos = data.response || [];
    if (partidos.length === 0) {
      return res.status(200).json({ partido: null });
    }

    const ahora = Date.now();
    let masCercano = partidos[0];
    let menorDiferencia = Math.abs(new Date(partidos[0].fixture.date).getTime() - ahora);

    partidos.forEach((p) => {
      const diferencia = Math.abs(new Date(p.fixture.date).getTime() - ahora);
      if (diferencia < menorDiferencia) {
        menorDiferencia = diferencia;
        masCercano = p;
      }
    });

    res.status(200).json({ partido: masCercano });
  } catch (error) {
    res.status(500).json({ error: "No se pudo traer el enfrentamiento" });
  }
}
