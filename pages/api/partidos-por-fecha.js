import { obtenerCache, guardarCache, CACHE_3_MINUTOS, CACHE_PARA_SIEMPRE } from "../../lib/cacheApi";

// Estados que todavía pueden cambiar — un partido aplazado (PST) puede
// terminar jugándose en OTRA fecha más adelante, así que ese día viejo no
// es seguro cachearlo para siempre; hay que seguir revisando cada tanto.
const ESTADOS_NO_DEFINITIVOS = ["PST", "TBD", "SUSP", "INT", "ABD"];

// Para ordenar antes de cortar a 50 — un partido en vivo siempre tiene
// que quedar adentro, sin importar de qué país o liga sea. Cuanto más
// bajo el número, más arriba queda en la lista.
const PRIORIDAD_ESTADO = {
  "1H": 0, "2H": 0, "ET": 0, "P": 0, "LIVE": 0, "BT": 0, // en vivo
  "HT": 1, // entretiempo
  "NS": 2, // todavía no arrancó
};
function prioridadDePartido(p) {
  return PRIORIDAD_ESTADO[p.fixture?.status?.short] ?? 3; // 3 = ya terminado o cualquier otro estado
}

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

    // Ordenamos por prioridad (en vivo primero) antes de limitar a 50 —
    // así un partido en vivo de una liga grande nunca queda afuera solo
    // porque la API devolvió antes un montón de partidos chicos ya
    // terminados. Dentro de cada prioridad, se mantiene el orden original.
    const ordenados = (data.response || [])
      .map((p, indiceOriginal) => ({ p, indiceOriginal }))
      .sort((a, b) => {
        const diff = prioridadDePartido(a.p) - prioridadDePartido(b.p);
        return diff !== 0 ? diff : a.indiceOriginal - b.indiceOriginal;
      })
      .map((x) => x.p);

    // Límite alto a propósito: en simultáneo puede haber más de 100
    // partidos en vivo en el mundo entre todas las ligas (grandes,
    // chicas, femeninas, juveniles) — con 50 se quedaban afuera partidos
    // importantes como un Atlético-Real Madrid solo porque otros países
    // "llenaban el cupo" antes. 200 da mucho más margen sin disparar el
    // tamaño de la respuesta a algo descontrolado.
    const resultado = ordenados.slice(0, 200);

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
