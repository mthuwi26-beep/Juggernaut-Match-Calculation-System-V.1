import { obtenerCache, guardarCache } from "../../lib/cacheApi";

export default async function handler(req, res) {
  const { fixtureId } = req.query;

  if (!fixtureId) {
    return res.status(400).json({ error: "Falta el ID del partido" });
  }

  // Cache cortito a propósito — API-Football actualiza esto cada 15
  // segundos durante el partido, no tiene sentido cachear más que eso
  const clave = `eventos-vivo:${fixtureId}`;
  const cacheado = await obtenerCache(clave);
  if (cacheado) return res.status(200).json(cacheado);

  try {
    const response = await fetch(`https://v3.football.api-sports.io/fixtures/events?fixture=${fixtureId}`, {
      headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY },
    });
    const data = await response.json();

    const eventos = (data.response || []).map((e) => ({
      minuto: e.time.elapsed,
      minutoExtra: e.time.extra,
      tipo: e.type, // "Goal" | "Card" | "subst" | "Var"
      detalle: e.detail, // "Normal Goal", "Yellow Card", "Substitution 1", etc.
      equipo: e.team?.name,
      jugador: e.player?.name,
      asistencia: e.assist?.name || null,
    }));

    const resultado = { disponible: eventos.length > 0, eventos };
    await guardarCache(clave, resultado, 15 * 1000);
    res.status(200).json(resultado);
  } catch (error) {
    res.status(200).json({ disponible: false, error: error.message });
  }
}
