// Busca, entre los enfrentamientos históricos de dos equipos, un partido para usar
// como "referencia" (árbitro/clima/competición), igual que si se hubiera elegido
// desde el calendario. Prioridad: si hay un partido FUTURO todavía no jugado entre
// ellos, se usa ese siempre — sin importar si está más lejos en el tiempo que uno
// que ya se jugó. Si no hay ninguno futuro, recién ahí se usa el más cercano
// (pasado) como respaldo.
import { obtenerCache, guardarCache, CACHE_12_HORAS } from "../../lib/cacheApi";

const ESTADOS_FINALIZADOS = ["FT", "AET", "PEN", "PST", "CANC", "ABD", "AWD", "WO"];

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
    const futuros = partidos.filter(
      (p) => new Date(p.fixture.date).getTime() > ahora && !ESTADOS_FINALIZADOS.includes(p.fixture.status.short)
    );

    let elegido;
    if (futuros.length > 0) {
      // El futuro MÁS PRÓXIMO (el próximo cruce entre ellos), no el más lejano
      elegido = futuros.reduce((mejor, p) =>
        new Date(p.fixture.date).getTime() < new Date(mejor.fixture.date).getTime() ? p : mejor
      );
    } else {
      // Sin ningún futuro disponible: recién ahí caemos al más cercano en el tiempo (pasado)
      elegido = partidos.reduce((mejor, p) =>
        Math.abs(new Date(p.fixture.date).getTime() - ahora) < Math.abs(new Date(mejor.fixture.date).getTime() - ahora) ? p : mejor
      );
    }

    const resultado = { partido: elegido };
    await guardarCache(clave, resultado, CACHE_12_HORAS);
    res.status(200).json(resultado);
  } catch (error) {
    res.status(500).json({ error: "No se pudo traer el enfrentamiento" });
  }
}
