import { supabaseAdmin } from "../../lib/supabaseAdmin";

// GET: devuelve todas las fotos guardadas de un partido, para armar el
//      gráfico de momentum aproximado
// POST: saca una foto nueva de las estadísticas actuales — pero solo si no
//       se sacó ninguna en el último minuto y medio, para que no importe
//       cuánta gente esté mirando el mismo partido a la vez (una foto
//       compartida, no una por cada persona)
export default async function handler(req, res) {
  const { fixtureId } = req.method === "GET" ? req.query : req.body;

  if (!fixtureId) {
    return res.status(400).json({ error: "Falta el ID del partido" });
  }

  if (req.method === "GET") {
    const { data, error } = await supabaseAdmin
      .from("momentum_snapshots")
      .select("minuto, tiros_local, tiros_visitante, posesion_local, posesion_visitante, corners_local, corners_visitante, created_at")
      .eq("fixture_id", fixtureId)
      .order("created_at", { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ snapshots: data || [] });
  }

  if (req.method === "POST") {
    try {
      // ¿ya hay una foto reciente? si la hay, no sacamos otra
      const haceUnMinutoYMedio = new Date(Date.now() - 90 * 1000).toISOString();
      const { data: reciente } = await supabaseAdmin
        .from("momentum_snapshots")
        .select("id")
        .eq("fixture_id", fixtureId)
        .gte("created_at", haceUnMinutoYMedio)
        .limit(1)
        .maybeSingle();

      if (reciente) {
        return res.status(200).json({ guardada: false, motivo: "ya había una reciente" });
      }

      const response = await fetch(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${fixtureId}`, {
        headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY },
      });
      const data = await response.json();
      const equipos = data.response || [];
      if (equipos.length < 2) {
        return res.status(200).json({ guardada: false, motivo: "sin estadísticas todavía" });
      }

      function extraer(stats, tipo) {
        return stats.find((s) => s.type === tipo)?.value || 0;
      }

      const local = equipos[0].statistics || [];
      const visitante = equipos[1].statistics || [];

      await supabaseAdmin.from("momentum_snapshots").insert({
        fixture_id: fixtureId,
        minuto: req.body.minuto || 0,
        tiros_local: extraer(local, "Total Shots"),
        tiros_visitante: extraer(visitante, "Total Shots"),
        posesion_local: parseInt(extraer(local, "Ball Possession")) || 0,
        posesion_visitante: parseInt(extraer(visitante, "Ball Possession")) || 0,
        corners_local: extraer(local, "Corner Kicks"),
        corners_visitante: extraer(visitante, "Corner Kicks"),
      });

      // Limpieza: borramos fotos de hace más de 2 días, aprovechando este
      // mismo momento — no hace falta ningún cron aparte para esto
      const hace2Dias = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      await supabaseAdmin.from("momentum_snapshots").delete().lt("created_at", hace2Dias);

      res.status(200).json({ guardada: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
    return;
  }

  res.status(405).json({ error: "Método no permitido" });
}
