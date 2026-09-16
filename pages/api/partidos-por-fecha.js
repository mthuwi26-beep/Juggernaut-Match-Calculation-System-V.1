import { obtenerCache, guardarCache, CACHE_3_MINUTOS, CACHE_PARA_SIEMPRE } from "../../lib/cacheApi";

// Estados que todavía pueden cambiar — un partido aplazado (PST) puede
// terminar jugándose en OTRA fecha más adelante, así que ese día viejo no
// es seguro cachearlo para siempre; hay que seguir revisando cada tanto.
const ESTADOS_NO_DEFINITIVOS = ["PST", "TBD", "SUSP", "INT", "ABD"];

export default async function handler(req, res) {
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ error: "Falta la fecha" });
  }

  const hoy = new Date().toISOString().slice(0, 10);
  const esFechaPasada = date < hoy;

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

    // Un día pasado solo se cachea para siempre si TODOS sus partidos ya
    // quedaron en un estado definitivo — si alguno sigue "aplazado" o
    // similar, puede terminar jugándose en otra fecha, así que revisamos
    // de nuevo pronto en vez de congelarlo para siempre.
    const hayPartidosNoDefinitivos = resultado.some((p) => ESTADOS_NO_DEFINITIVOS.includes(p.fixture?.status?.short));
    const ttl = esFechaPasada && !hayPartidosNoDefinitivos ? CACHE_PARA_SIEMPRE : CACHE_3_MINUTOS;

    await guardarCache(clave, resultado, ttl);
    res.status(200).json(resultado);
  } catch (error) {
    res.status(500).json({ error: "No se pudo conectar con API-Football" });
  }
}
