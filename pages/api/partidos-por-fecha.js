import { obtenerCache, guardarCache, CACHE_3_MINUTOS, CACHE_PARA_SIEMPRE } from "../../lib/cacheApi";

export default async function handler(req, res) {
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ error: "Falta la fecha" });
  }

  // Un día que ya pasó no cambia más (los resultados quedan fijos) — lo cacheamos para
  // siempre. Hoy o un día futuro sí puede cambiar de un minuto a otro (partidos que
  // arrancan, resultados que se actualizan), así que ahí el caché dura solo 3 minutos.
  const hoy = new Date().toISOString().slice(0, 10);
  const esFechaPasada = date < hoy;
  const ttl = esFechaPasada ? CACHE_PARA_SIEMPRE : CACHE_3_MINUTOS;

  const clave = `partidos-fecha:${date}`;
  const cacheado = await obtenerCache(clave);
  if (cacheado) return res.status(200).json(cacheado);

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
    const resultado = (data.response || []).slice(0, 50);
    await guardarCache(clave, resultado, ttl);
    res.status(200).json(resultado);
  } catch (error) {
    res.status(500).json({ error: "No se pudo conectar con API-Football" });
  }
}
