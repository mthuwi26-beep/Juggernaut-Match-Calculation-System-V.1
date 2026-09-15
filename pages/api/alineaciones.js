import { obtenerCache, guardarCache, CACHE_15_MINUTOS } from "../../lib/cacheApi";

export default async function handler(req, res) {
  const { fixtureId } = req.query;

  if (!fixtureId) {
    return res.status(400).json({ error: "Falta el ID del partido" });
  }

  // Cache corto a propósito: las alineaciones recién aparecen entre 20 y 40
  // minutos antes del partido, así que si todavía no están, no conviene
  // cachear un "no disponible" por mucho tiempo — mejor volver a chequear pronto.
  const clave = `alineaciones:${fixtureId}`;
  const cacheado = await obtenerCache(clave);
  if (cacheado) return res.status(200).json(cacheado);

  try {
    const response = await fetch(`https://v3.football.api-sports.io/fixtures/lineups?fixture=${fixtureId}`, {
      headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY },
    });
    const data = await response.json();

    if (data.errors && Object.keys(data.errors).length > 0) {
      return res.status(200).json({ disponible: false, error: JSON.stringify(data.errors) });
    }

    const equipos = data.response || [];

    if (equipos.length === 0) {
      // Todavía no se publicaron — es normal, no es un error
      const resultado = { disponible: false };
      await guardarCache(clave, resultado, 5 * 60 * 1000); // 5 min, para reintentar pronto
      return res.status(200).json(resultado);
    }

    const formateado = {
      disponible: true,
      equipos: equipos.map((e) => ({
        equipo: { id: e.team.id, nombre: e.team.name, escudo: e.team.logo },
        formacion: e.formation,
        tecnico: e.coach?.name || null,
        titulares: (e.startXI || []).map((j) => ({
          id: j.player.id,
          nombre: j.player.name,
          numero: j.player.number,
          posicion: j.player.pos,
          grilla: j.player.grid, // formato "fila:columna", ej "4:2"
        })),
        suplentes: (e.substitutes || []).map((j) => ({
          id: j.player.id,
          nombre: j.player.name,
          numero: j.player.number,
          posicion: j.player.pos,
        })),
      })),
    };

    await guardarCache(clave, formateado, CACHE_15_MINUTOS);
    res.status(200).json(formateado);
  } catch (error) {
    res.status(200).json({ disponible: false, error: error.message });
  }
}
