// ============================================================
// Tablas de posiciones
//   GET /api/posiciones?equipo=ID            -> { torneos: [...] }
//   GET /api/posiciones?liga=ID&temporada=YYYY -> { torneo: {...} | null }
// Formato de cada torneo: { id, nombre, logo, pais, bandera, temporada,
//   tablas: [{ titulo, filas: [{ pos, id, nombre, logo, pj, g, e, p, gf, gc,
//   dg, pts, forma, zona: { tipo, texto } }] }] }
// ============================================================
import { tablasDeEquipo, tablasDeLiga, COLORES_ZONA } from "../../lib/posiciones";

export default async function handler(req, res) {
  const { equipo, liga, temporada } = req.query;
  try {
    if (equipo && /^\d+$/.test(String(equipo))) {
      const torneos = await tablasDeEquipo(equipo);
      res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=1800");
      return res.status(200).json({ torneos, colores: COLORES_ZONA });
    }
    if (liga && temporada && /^\d+$/.test(String(liga)) && /^\d{4}$/.test(String(temporada))) {
      const torneo = await tablasDeLiga(liga, temporada);
      res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=900");
      return res.status(200).json({ torneo, colores: COLORES_ZONA });
    }
    return res.status(400).json({ error: "Falta el equipo o la liga y temporada" });
  } catch (e) {
    return res.status(500).json({ error: "No se pudo cargar la tabla de posiciones" });
  }
}
