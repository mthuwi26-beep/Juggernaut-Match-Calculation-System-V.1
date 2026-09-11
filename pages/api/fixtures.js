import { obtenerCache, guardarCache, CACHE_PARA_SIEMPRE } from "../../lib/cacheApi";

export default async function handler(req, res) {
  const { teamId, season } = req.query;

  if (!teamId) {
    return res.status(400).json({ error: "Falta el ID del equipo" });
  }

  // MODO PRUEBA (plan gratis): el plan gratis de API-Football solo permite
  // ver las temporadas 2022, 2023 y 2024, y no permite el parámetro "last".
  // Por eso pedimos por temporada y recortamos los últimos 10 nosotros mismos.
  //
  // >>> CUANDO PASES AL PLAN PAGADO <
  // Solo cambia la línea de abajo por: const temporada = season || new Date().getFullYear();
  // y ya podrás traer la temporada actual en vivo, sin tocar nada más del código.
  // OJO: si haces ese cambio, la temporada actual ya NO se debe cachear "para siempre"
  // como las de abajo, porque todavía se están jugando partidos — avísame cuando llegue ese
  // momento y le bajamos el tiempo de caché a esta ruta para esa temporada en curso.
  const temporada = season || 2024;

  const clave = `fixtures:${teamId}:${temporada}`;
  const cacheado = await obtenerCache(clave);
  if (cacheado) return res.status(200).json(cacheado);

  try {
    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures?team=${teamId}&season=${temporada}`,
      {
        headers: {
          "x-apisports-key": process.env.API_FOOTBALL_KEY,
        },
      }
    );

    const data = await response.json();

    if (data.errors && Object.keys(data.errors).length > 0) {
      return res.status(200).json({ error: JSON.stringify(data.errors) });
    }

    const partidos = data.response || [];

    const jugados = partidos
      .filter((f) => f.fixture.status.short === "FT")
      .sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date))
      .slice(0, 10);

    await guardarCache(clave, jugados, CACHE_PARA_SIEMPRE);
    res.status(200).json(jugados);
  } catch (error) {
    res.status(500).json({ error: "No se pudo traer los partidos del equipo" });
  }
}
