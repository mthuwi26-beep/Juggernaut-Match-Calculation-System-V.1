import { obtenerCache, guardarCache, CACHE_PARA_SIEMPRE } from "../../lib/cacheApi";
import { pitchApiFetch, buscarPartidoPitchApi } from "../../lib/pitchapi";

export default async function handler(req, res) {
  const { fecha, nombreLocal, nombreVisitante } = req.query;

  if (!fecha || !nombreLocal || !nombreVisitante) {
    return res.status(400).json({ error: "Faltan datos para buscar el partido" });
  }

  const clave = `pitchapi-partido:${fecha}:${nombreLocal}:${nombreVisitante}`;
  const cacheado = await obtenerCache(clave);
  if (cacheado) return res.status(200).json(cacheado);

  try {
    const idPitchApi = await buscarPartidoPitchApi(fecha, nombreLocal, nombreVisitante);

    if (!idPitchApi) {
      const resultado = { encontrado: false };
      // Este resultado sí se cachea para siempre — si no lo encontramos
      // ahora (mismo día del partido), no lo vamos a encontrar después
      await guardarCache(clave, resultado, CACHE_PARA_SIEMPRE);
      return res.status(200).json(resultado);
    }

    const [resumen, momentum, tiros, mapaCalor] = await Promise.all([
      pitchApiFetch(`/matches/${idPitchApi}`).catch(() => null),
      pitchApiFetch(`/matches/${idPitchApi}/momentum`).catch(() => null),
      pitchApiFetch(`/matches/${idPitchApi}/shots`).catch(() => null),
      pitchApiFetch(`/matches/${idPitchApi}/heatmaps`).catch(() => null),
    ]);

    const resultado = {
      encontrado: true,
      idEquipoLocal: resumen?.home_team?.id || null,
      idEquipoVisitante: resumen?.away_team?.id || null,
      momentum: momentum?.points || [],
      tiros: tiros?.periods || [],
      mapaCalor: mapaCalor || null,
    };

    await guardarCache(clave, resultado, CACHE_PARA_SIEMPRE);
    res.status(200).json(resultado);
  } catch (error) {
    res.status(200).json({ encontrado: false, error: error.message });
  }
}
