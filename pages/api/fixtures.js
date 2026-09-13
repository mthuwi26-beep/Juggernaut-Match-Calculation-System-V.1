import { obtenerCache, guardarCache, CACHE_3_HORAS, CACHE_PARA_SIEMPRE } from "../../lib/cacheApi";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

export default async function handler(req, res) {
  const { teamId, season } = req.query;

  if (!teamId) {
    return res.status(400).json({ error: "Falta el ID del equipo" });
  }

  // El plan de API-Football (gratis o pro) se elige desde el panel de admin,
  // no hace falta tocar código cuando lo cambies. En el plan gratis solo se
  // puede ver el historial completo de 2022-2024, así que usamos esa fecha
  // fija y la cacheamos para siempre (ya no cambia). En el plan pro, pedimos
  // la temporada actual — como todavía se está jugando, el caché dura solo
  // unas horas en vez de para siempre.
  const { data: config } = await supabaseAdmin.from("configuracion_app").select("plan_api").eq("id", 1).maybeSingle();
  const esPro = config?.plan_api === "pro";
  const temporada = season || (esPro ? new Date().getFullYear() : 2024);
  const ttl = esPro ? CACHE_3_HORAS : CACHE_PARA_SIEMPRE;

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

    await guardarCache(clave, jugados, ttl);
    res.status(200).json(jugados);
  } catch (error) {
    res.status(500).json({ error: "No se pudo traer los partidos del equipo" });
  }
}
