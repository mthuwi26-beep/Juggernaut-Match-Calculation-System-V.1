import { obtenerCache, guardarCache, CACHE_15_MINUTOS } from "../../lib/cacheApi";
import { competicionDe } from "../../lib/competiciones";

// Hasta cuántos días hacia adelante se busca antes de rendirse y decir "no
// encontramos nada". 21 días cubre bien el calendario típico de estas
// competiciones (Champions League, ligas semanales, Libertadores, etc.) sin
// que la búsqueda se vuelva lenta o carísima en llamadas a la API externa.
const DIAS_A_BUSCAR = 21;

function zonaHorariaValida(tz) {
  if (!tz || typeof tz !== "string" || tz.length > 60) return "America/Bogota";
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return tz;
  } catch {
    return "America/Bogota";
  }
}

export default async function handler(req, res) {
  const { etiqueta } = req.query;
  const timezone = zonaHorariaValida(req.query.timezone);

  if (!etiqueta) {
    return res.status(400).json({ error: "Falta la etiqueta de la competición" });
  }

  const clave = `proximo-competicion:${etiqueta}:${timezone}`;
  const cacheado = await obtenerCache(clave);
  if (cacheado) return res.status(200).json(cacheado);

  try {
    const hoy = new Date();

    for (let i = 1; i <= DIAS_A_BUSCAR; i++) {
      const fecha = new Date(hoy);
      fecha.setDate(fecha.getDate() + i);
      const fechaStr = fecha.toLocaleDateString("en-CA", { timeZone: timezone });

      const response = await fetch(
        `https://v3.football.api-sports.io/fixtures?date=${fechaStr}&timezone=${encodeURIComponent(timezone)}`,
        { headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY } }
      );
      const data = await response.json();

      if (data.errors && Object.keys(data.errors).length > 0) continue;

      const encontrado = (data.response || []).find(
        (p) => competicionDe(p.league?.name, p.league?.country)?.etiqueta === etiqueta
      );

      if (encontrado) {
        const resultado = { partido: encontrado };
        await guardarCache(clave, resultado, CACHE_15_MINUTOS);
        return res.status(200).json(resultado);
      }
    }

    // No se encontró nada en las próximas DIAS_A_BUSCAR — se cachea igual,
    // por poco tiempo, para no repetir 21 llamadas si el usuario vuelve a
    // tocar el mismo chip enseguida.
    const resultado = { partido: null };
    await guardarCache(clave, resultado, CACHE_15_MINUTOS);
    res.status(200).json(resultado);
  } catch (error) {
    res.status(500).json({ error: "No se pudo conectar con API-Football" });
  }
}
