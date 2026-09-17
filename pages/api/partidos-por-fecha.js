import { obtenerCache, guardarCache, CACHE_3_MINUTOS, CACHE_PARA_SIEMPRE } from "../../lib/cacheApi";

// Estados que todavía pueden cambiar — un partido aplazado (PST) puede
// terminar jugándose en OTRA fecha más adelante, así que ese día viejo no
// es seguro cachearlo para siempre; hay que seguir revisando cada tanto.
const ESTADOS_NO_DEFINITIVOS = ["PST", "TBD", "SUSP", "INT", "ABD"];

// Por si llega una zona horaria vacía o con caracteres raros (no debería,
// pero mejor no mandarle basura a la API externa).
function zonaHorariaValida(tz) {
  if (!tz || typeof tz !== "string" || tz.length > 60) return "America/Bogota";
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz }); // tira si no es una zona real
    return tz;
  } catch {
    return "America/Bogota";
  }
}

export default async function handler(req, res) {
  const { date } = req.query;
  const timezone = zonaHorariaValida(req.query.timezone);

  if (!date) {
    return res.status(400).json({ error: "Falta la fecha" });
  }

  // "Hoy" también calculado en la zona horaria del usuario, no en UTC del
  // servidor — si no, un partido de anoche (hora del usuario) podía
  // quedar marcado como "fecha pasada" o "de hoy" de forma inconsistente.
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: timezone }); // en-CA da YYYY-MM-DD
  const esFechaPasada = date < hoy;

  // La zona horaria es parte de la clave: la misma fecha "2026-09-17" trae
  // partidos distintos según se pida en hora de Colombia o de otro país.
  const clave = `partidos-fecha:${date}:${timezone}`;
  const cacheado = await obtenerCache(clave);
  if (cacheado) return res.status(200).json(cacheado);

  try {
    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures?date=${date}&timezone=${encodeURIComponent(timezone)}`,
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
