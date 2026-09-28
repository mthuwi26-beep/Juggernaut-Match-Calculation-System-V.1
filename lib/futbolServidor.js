// Consultas a API-Football que usa el servidor (verificación, Backtesting),
// con el mismo caché que el resto de endpoints.
import { obtenerCache, guardarCache, CACHE_3_MINUTOS, CACHE_30_MINUTOS, CACHE_PARA_SIEMPRE } from "./cacheApi";

export const FINALIZADOS = ["FT", "AET", "PEN"];
export const ANULADOS = ["CANC", "ABD", "AWD", "WO"];
export const SIN_EMPEZAR = ["NS", "TBD"];

export async function pedirApi(ruta) {
  const respuesta = await fetch(`https://v3.football.api-sports.io/${ruta}`, {
    headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY },
  });
  const data = await respuesta.json();
  if (data.errors && Object.keys(data.errors).length > 0) throw new Error(JSON.stringify(data.errors));
  return data.response || [];
}

// Misma clave de caché que /api/partido-por-id, para aprovechar lo ya guardado.
export async function partidoPorId(fixtureId) {
  const clave = `partido-por-id:${fixtureId}`;
  const cacheado = await obtenerCache(clave);
  if (cacheado) return cacheado;
  const partido = (await pedirApi(`fixtures?id=${fixtureId}`))[0] || null;
  if (partido) {
    const estado = partido.fixture?.status?.short;
    await guardarCache(clave, partido, FINALIZADOS.includes(estado) || ANULADOS.includes(estado) ? CACHE_PARA_SIEMPRE : CACHE_3_MINUTOS);
  }
  return partido;
}

export async function estadisticasPartido(fixtureId) {
  const clave = `estadisticas-partido:${fixtureId}`;
  const cacheado = await obtenerCache(clave);
  if (cacheado) return cacheado;
  const datos = await pedirApi(`fixtures/statistics?fixture=${fixtureId}`);
  await guardarCache(clave, datos, datos.length > 0 ? CACHE_PARA_SIEMPRE : CACHE_30_MINUTOS);
  return datos;
}

// Goles a los 90 minutos (así se liquidan los mercados) y córners, tarjetas y
// faltas reales. localId indica cuál equipo se estudió como local, por si el
// estudio se hizo con los equipos al revés.
export async function resultadoReal(partido, localId, visitanteId) {
  const tr = partido.score?.fulltime;
  const casa = tr?.home ?? partido.goals?.home;
  const fuera = tr?.away ?? partido.goals?.away;
  if (casa === null || casa === undefined || fuera === null || fuera === undefined) return null;
  const alReves = partido.teams?.home?.id === visitanteId && partido.teams?.away?.id === localId;
  const real = {
    golesLocal: alReves ? fuera : casa,
    golesVisitante: alReves ? casa : fuera,
    corners: null,
    amarillas: null,
    faltas: null,
  };
  return real;
}
