// Busca, entre los enfrentamientos históricos de dos equipos, el más cercano a hoy
// (sea pasado o futuro), para usarlo como "partido de referencia" y traer
// árbitro/clima automáticamente, igual que si se hubiera elegido desde el calendario.
import { obtenerCache, guardarCache, CACHE_12_HORAS } from "../../lib/cacheApi";

export default async function handler(req, res) {
  const { team1, team2 } = req.query;

  if (!team1 || !team2) {
    return res.status(400).json({ error: "Faltan los IDs de los equipos" });
  }

  // Ordenamos los IDs antes de armar la clave para que team1=5&team2=9 y team1=9&team2=5
  // compartan el mismo dato cacheado (es el mismo cruce, solo cambia quién lo pidió primero)
  const clave = `h2h-cercano:${[team1, team2].sort().join("-")}`;
  const cacheado = await obtenerCache(clave);
  if (cacheado) return res.status(200).json(cacheado);

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
      const vacio = { partido: null };
      await guardarCache(clave, vacio, CACHE_12_HORAS);
      return res.status(200).json(vacio);
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

    const resultado = { partido: masCercano };
    await guardarCache(clave, resultado, CACHE_12_HORAS);
    res.status(200).json(resultado);
  } catch (error) {
    res.status(500).json({ error: "No se pudo traer el enfrentamiento" });
  }
}
