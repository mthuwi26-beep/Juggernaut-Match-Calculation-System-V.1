import { obtenerCache, guardarCache, CACHE_15_SEGUNDOS, CACHE_PARA_SIEMPRE } from "../../lib/cacheApi";

export default async function handler(req, res) {
  const { fixtureId } = req.query;

  if (!fixtureId) {
    return res.status(400).json({ error: "Falta el ID del partido" });
  }

  const clave = `marcador-vivo:${fixtureId}`;
  const cacheado = await obtenerCache(clave);
  if (cacheado) return res.status(200).json(cacheado);

  try {
    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures?id=${fixtureId}`,
      { headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY } }
    );

    const data = await response.json();

    if (data.errors && Object.keys(data.errors).length > 0) {
      return res.status(200).json({ error: JSON.stringify(data.errors) });
    }

    const partido = (data.response || [])[0];
    if (!partido) {
      return res.status(200).json({ error: "No se encontró el partido" });
    }

    const resultado = {
      estadoCorto: partido.fixture.status.short, // ej: "NS", "1H", "HT", "2H", "FT"
      minuto: partido.fixture.status.elapsed,
      golesLocal: partido.goals.home,
      golesVisitante: partido.goals.away,
    };

    // Si el partido ya terminó, el marcador no va a volver a cambiar — lo dejamos
    // cacheado para siempre. Si sigue en juego, apenas 15 segundos, para que las
    // pantallas de varios usuarios viendo el mismo partido a la vez no dupliquen
    // la consulta a la API en cada polling, pero sin que se vea "viejo".
    const yaTermino = ["FT", "AET", "PEN", "PST", "CANC", "ABD", "AWD", "WO"].includes(resultado.estadoCorto);
    await guardarCache(clave, resultado, yaTermino ? CACHE_PARA_SIEMPRE : CACHE_15_SEGUNDOS);

    res.status(200).json(resultado);
  } catch (error) {
    res.status(500).json({ error: "No se pudo consultar el marcador en vivo" });
  }
}
