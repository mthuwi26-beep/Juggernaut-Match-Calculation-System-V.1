// Trae el partido completo (equipos, liga, fecha, venue, árbitro) por su ID —
// se usa para abrir el resultado de un partido puntual en una pestaña nueva
// (cuando tocás un V/E/D de "Últimos 5"), sin depender de tener los dos
// equipos ya cargados en la pantalla principal.
import { obtenerCache, guardarCache, CACHE_3_MINUTOS, CACHE_PARA_SIEMPRE } from "../../lib/cacheApi";

const ESTADOS_FINALIZADOS = ["FT", "AET", "PEN", "PST", "CANC", "ABD", "AWD", "WO"];

export default async function handler(req, res) {
  const { fixtureId } = req.query;

  if (!fixtureId) {
    return res.status(400).json({ error: "Falta el ID del partido" });
  }

  const clave = `partido-por-id:${fixtureId}`;
  const cacheado = await obtenerCache(clave);
  if (cacheado) return res.status(200).json(cacheado);

  try {
    const response = await fetch(`https://v3.football.api-sports.io/fixtures?id=${fixtureId}`, {
      headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY },
    });

    const data = await response.json();

    if (data.errors && Object.keys(data.errors).length > 0) {
      return res.status(200).json({ error: JSON.stringify(data.errors) });
    }

    const partido = (data.response || [])[0];
    if (!partido) {
      return res.status(200).json({ error: "No se encontró ese partido" });
    }

    // Si ya terminó, no va a cambiar más — se cachea para siempre
    const ttl = ESTADOS_FINALIZADOS.includes(partido.fixture.status.short) ? CACHE_PARA_SIEMPRE : CACHE_3_MINUTOS;
    await guardarCache(clave, partido, ttl);
    res.status(200).json(partido);
  } catch (error) {
    res.status(500).json({ error: "No se pudo traer el partido" });
  }
}
