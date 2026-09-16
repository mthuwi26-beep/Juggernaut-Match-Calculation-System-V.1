// Helper del lado del servidor para hablar con PitchAPI (momentum real,
// mapa de tiros, mapa de calor — todo esto NO lo tiene API-Football, es
// exclusivo de este proveedor).
const BASE_URL = "https://api.pitchapi.dev/v1";

export async function pitchApiFetch(ruta) {
  const respuesta = await fetch(`${BASE_URL}${ruta}`, {
    headers: { "X-API-KEY": process.env.PITCHAPI_KEY },
  });
  const datos = await respuesta.json();
  if (!respuesta.ok) {
    const error = new Error(datos.error?.message || "Error de PitchAPI");
    error.code = datos.error?.code;
    throw error;
  }
  return datos.data;
}

// Normaliza nombres de equipos para poder compararlos entre proveedores
// distintos (uno puede decir "Man City", el otro "Manchester City")
export function normalizarNombreEquipo(nombre) {
  return (nombre || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // saca tildes
    .replace(/\b(fc|cf|club|deportivo|atletico|real|ac|sc)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

// Busca el partido en PitchAPI que mejor coincida con la fecha y los
// nombres de los equipos de API-Football. No hay forma de conectar los IDs
// directo entre los dos proveedores, así que esto es un "mejor esfuerzo" —
// puede no encontrar coincidencia, sobre todo en ligas chicas.
export async function buscarPartidoPitchApi(fechaISO, nombreLocal, nombreVisitante) {
  const dia = fechaISO.slice(0, 10); // YYYY-MM-DD
  const datos = await pitchApiFetch(`/date/${dia}`);
  const partidos = datos?.matches || [];

  const localBuscado = normalizarNombreEquipo(nombreLocal);
  const visitanteBuscado = normalizarNombreEquipo(nombreVisitante);

  const encontrado = partidos.find((p) => {
    const localApi = normalizarNombreEquipo(p.home_team?.name);
    const visitanteApi = normalizarNombreEquipo(p.away_team?.name);
    return (
      (localApi === localBuscado || localApi.includes(localBuscado) || localBuscado.includes(localApi)) &&
      (visitanteApi === visitanteBuscado || visitanteApi.includes(visitanteBuscado) || visitanteBuscado.includes(visitanteApi))
    );
  });

  return encontrado?.id || null;
}
