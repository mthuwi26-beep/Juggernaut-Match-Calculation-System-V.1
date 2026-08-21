// Ligas incluidas en el plan gratis de football-data.org
const LIGAS_GRATIS = ["PD", "PL", "CL", "SA", "BL1", "FL1"];

let cache = { data: null, timestamp: 0 };
const DURACION_CACHE = 60 * 60 * 1000; // 1 hora

async function obtenerTodosLosEquipos() {
  const ahora = Date.now();
  if (cache.data && ahora - cache.timestamp < DURACION_CACHE) {
    return cache.data;
  }

  const peticiones = LIGAS_GRATIS.map((codigo) =>
    fetch(`https://api.football-data.org/v4/competitions/${codigo}/teams`, {
      headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_KEY },
    }).then((r) => r.json())
  );

  const resultados = await Promise.all(peticiones);
  const equipos = [];
  const vistos = new Set();

  resultados.forEach((r) => {
    (r.teams || []).forEach((t) => {
      if (!vistos.has(t.id)) {
        vistos.add(t.id);
        equipos.push(t);
      }
    });
  });

  cache = { data: equipos, timestamp: ahora };
  return equipos;
}

export default async function handler(req, res) {
  const { name } = req.query;

  if (!name || name.trim().length < 3) {
    return res.status(400).json({ error: "Escribe al menos 3 letras del nombre del equipo" });
  }

  try {
    const todos = await obtenerTodosLosEquipos();
    const texto = name.toLowerCase();
    const coincidencias = todos.filter(
      (t) =>
        t.name.toLowerCase().includes(texto) ||
        (t.shortName && t.shortName.toLowerCase().includes(texto))
    );
    res.status(200).json(coincidencias);
  } catch (error) {
    res.status(500).json({ error: "No se pudo conectar con football-data.org" });
  }
}
