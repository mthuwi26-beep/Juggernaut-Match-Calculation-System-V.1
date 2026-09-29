// ============================================================
// MOTOR DE CÁLCULO COMPARTIDO
// ============================================================
// Esto es una COPIA de las funciones puras (sin React) que ya existen en
// pages/index.js. No se movieron ni se borraron de ahí — se duplicaron aquí
// para que el vigilante (que corre en el servidor, sin navegador) pueda
// calcular el mismo semáforo que ves en Estudio, para el aviso automático
// de "semáforo en verde" push.
//
// Honestidad importante: como es una copia, si el día de mañana se ajusta
// una fórmula en index.js (por ejemplo el modelo de pesos), hay que
// actualizarla AQUÍ TAMBIÉN a mano — no se sincronizan solas.
// (Tanda 0: esLiga y calcularHeadToHead quedaron idénticas a las de index.js.)
// ============================================================

// Misma lista que esLiga() en pages/index.js (la que ve el usuario en Estudio).
const KEYWORDS_NO_LIGA = ["cup", "copa", "champions", "europa", "conference", "supercopa", "shield", "trophy", "playoff", "friendlies", "amistoso"];

function esLiga(fixture) {
  const nombre = (fixture.league?.name || "").toLowerCase();
  return !KEYWORDS_NO_LIGA.some((k) => nombre.includes(k));
}
// Identica a calcularEstadisticasGoles() de pages/index.js (copiada tal cual en la Tanda 3)
function calcularEstadisticasGoles(fixtures, teamId) {
  if (!fixtures || fixtures.length === 0) return null;

  let golesFavor = 0;
  let golesContra = 0;
  let victorias = 0;
  let empates = 0;
  let derrotas = 0;
  let partidosOver25 = 0;
  let partidosBTTS = 0;

  fixtures.forEach((f) => {
    const esLocal = f.teams.home.id === teamId;
    const gf = esLocal ? f.goals.home : f.goals.away;
    const gc = esLocal ? f.goals.away : f.goals.home;

    golesFavor += gf;
    golesContra += gc;

    if (gf > gc) victorias++;
    else if (gf === gc) empates++;
    else derrotas++;

    if (gf + gc > 2.5) partidosOver25++;
    if (gf > 0 && gc > 0) partidosBTTS++;
  });

  const total = fixtures.length;

  return {
    total,
    promedioGolesFavor: (golesFavor / total).toFixed(2),
    promedioGolesContra: (golesContra / total).toFixed(2),
    victorias,
    empates,
    derrotas,
    over25Pct: Math.round((partidosOver25 / total) * 100),
    bttsPct: Math.round((partidosBTTS / total) * 100),
  };
}

// Identica a calcularGolesNumerico() de pages/index.js (Tanda 3: antes esta
// copia redondeaba a 2 decimales y saltaba partidos sin goles registrados,
// y daba goles esperados un poco distintos a los de Estudio).
function calcularGolesNumerico(fixtures, teamId) {
  if (!fixtures || fixtures.length === 0) return { valor: null, n: 0 };
  let suma = 0;
  fixtures.forEach((f) => {
    const esLocal = f.teams.home.id === teamId;
    suma += esLocal ? f.goals.home : f.goals.away;
  });
  return { valor: suma / fixtures.length, n: fixtures.length };
}

function calcularPuntualesNumerico(fixtures, teamId, statsMap) {
  if (!fixtures || fixtures.length === 0) {
    return {
      corners: { valor: null, n: 0 },
      amarillas: { valor: null, n: 0 },
      faltas: { valor: null, n: 0 },
    };
  }

  let corners = 0, cornersN = 0;
  let amarillas = 0, amarillasN = 0;
  let faltas = 0, faltasN = 0;

  fixtures.forEach((f) => {
    const datos = statsMap[f.fixture.id];
    if (!datos) return;
    const esLocal = f.teams.home.id === teamId;

    const c = esLocal ? datos.corners.home : datos.corners.away;
    const a = esLocal ? datos.amarillas.home : datos.amarillas.away;
    const ft = esLocal ? datos.faltas.home : datos.faltas.away;

    if (c !== null) { corners += c; cornersN++; }
    if (a !== null) { amarillas += a; amarillasN++; }
    if (ft !== null) { faltas += ft; faltasN++; }
  });

  return {
    corners: { valor: cornersN ? corners / cornersN : null, n: cornersN },
    amarillas: { valor: amarillasN ? amarillas / amarillasN : null, n: amarillasN },
    faltas: { valor: faltasN ? faltas / faltasN : null, n: faltasN },
  };
}

function construirFuentesEquipo(fixturesCompletos, teamId, statsMap, competicionExacta) {
  const subsets = {
    local: fixturesCompletos.filter((f) => f.teams.home.id === teamId),
    visitante: fixturesCompletos.filter((f) => f.teams.away.id === teamId),
    liga: competicionExacta
      ? fixturesCompletos.filter((f) => f.league?.id === competicionExacta.id && f.league?.season === competicionExacta.season)
      : fixturesCompletos.filter((f) => esLiga(f)),
    noLiga: fixturesCompletos.filter((f) => !esLiga(f)),
    temporada: fixturesCompletos,
    forma: fixturesCompletos.slice(0, 5),
  };

  const resultado = {};
  Object.entries(subsets).forEach(([clave, subset]) => {
    const goles = calcularEstadisticasGoles(subset, teamId);
    const puntual = calcularPuntualesNumerico(subset, teamId, statsMap);
    resultado[clave] = {
      goles: { valor: goles ? parseFloat(goles.promedioGolesFavor) : null, n: goles ? goles.total : 0 },
      corners: puntual.corners,
      amarillas: puntual.amarillas,
      faltas: puntual.faltas,
    };
  });

  return resultado;
}

function calcularValorEsperado(fuentesStat, esPartidoLiga) {
  const conf = (n, ref) => Math.min(1, n / ref);

  const pesos = {};
  pesos.actual = 35 * conf(fuentesStat.actual.n, 10);
  pesos.contraria = 5 * conf(fuentesStat.contraria.n, 10);

  if (esPartidoLiga) {
    pesos.liga = 20 * conf(fuentesStat.liga.n, 10);
    pesos.noLiga = 0;
  } else {
    pesos.liga = 7.5 * conf(fuentesStat.liga.n, 10);
    pesos.noLiga = 20 * conf(fuentesStat.noLiga.n, 10);
  }

  pesos.temporada = 20 * conf(fuentesStat.temporada.n, 15);
  pesos.h2h = Math.min(15, 3 * fuentesStat.h2h.n);
  pesos.forma = 5 * conf(fuentesStat.forma.n, 5);

  const baseTotal = esPartidoLiga ? 35 + 5 + 20 + 20 + 15 + 5 : 35 + 5 + 7.5 + 20 + 20 + 15 + 5;
  const efectivoTotal = Object.values(pesos).reduce((a, b) => a + b, 0);
  const sobrante = Math.max(0, baseTotal - efectivoTotal);

  const targetPrincipal = esPartidoLiga ? "liga" : "noLiga";
  pesos[targetPrincipal] += sobrante * 0.2;
  pesos.temporada += sobrante * 0.5;
  pesos.actual += sobrante * 0.3;

  const entradas = [
    [fuentesStat.actual.valor, pesos.actual],
    [fuentesStat.contraria.valor, pesos.contraria],
    [fuentesStat.liga.valor, pesos.liga],
    [fuentesStat.noLiga.valor, pesos.noLiga],
    [fuentesStat.temporada.valor, pesos.temporada],
    [fuentesStat.h2h.valor, pesos.h2h],
    [fuentesStat.forma.valor, pesos.forma],
  ];

  let sumaPeso = 0, sumaValorPeso = 0;
  entradas.forEach(([valor, peso]) => {
    if (peso > 0 && valor !== null && !isNaN(valor)) {
      sumaPeso += peso;
      sumaValorPeso += valor * peso;
    }
  });

  return sumaPeso > 0 ? sumaValorPeso / sumaPeso : null;
}

function factorial(n) {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function poissonProb(lambda, k) {
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
}

function probabilidadOver(lambda, linea) {
  if (lambda === null || lambda === undefined) return null;
  const kMax = Math.floor(linea);
  let acumulada = 0;
  for (let k = 0; k <= kMax; k++) acumulada += poissonProb(lambda, k);
  return Math.max(0, Math.min(1, 1 - acumulada));
}

function calcularHeadToHead(fixturesLocal, fixturesVisitante, idLocal, idVisitante) {
  // Igual que en pages/index.js: se juntan los últimos partidos de AMBOS equipos,
  // se quedan los cruces entre ellos, sin duplicados, del más reciente al más antiguo.
  const todos = [...(fixturesLocal || []), ...(fixturesVisitante || [])];
  const vistos = new Set();
  const enfrentamientos = [];

  todos.forEach((f) => {
    const ids = [f.teams.home.id, f.teams.away.id].sort().join("-");
    const idsBuscados = [idLocal, idVisitante].sort().join("-");
    if (ids === idsBuscados && !vistos.has(f.fixture.id)) {
      vistos.add(f.fixture.id);
      enfrentamientos.push(f);
    }
  });

  enfrentamientos.sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date));

  if (enfrentamientos.length === 0) {
    return { partidos: [], mensaje: "No hay enfrentamientos directos dentro de los últimos 10 partidos de cada equipo." };
  }

  let golesLocalTotal = 0, golesVisitanteTotal = 0;
  let victoriasLocal = 0, victoriasVisitante = 0, empates = 0;
  let partidosOver25 = 0, partidosBTTS = 0;

  enfrentamientos.forEach((f) => {
    const localEsHome = f.teams.home.id === idLocal;
    const golesLocal = localEsHome ? f.goals.home : f.goals.away;
    const golesVisitante = localEsHome ? f.goals.away : f.goals.home;

    golesLocalTotal += golesLocal;
    golesVisitanteTotal += golesVisitante;

    if (golesLocal > golesVisitante) victoriasLocal++;
    else if (golesVisitante > golesLocal) victoriasVisitante++;
    else empates++;

    if (golesLocal + golesVisitante > 2.5) partidosOver25++;
    if (golesLocal > 0 && golesVisitante > 0) partidosBTTS++;
  });

  const total = enfrentamientos.length;

  return {
    partidos: enfrentamientos,
    total,
    promedioGolesLocal: (golesLocalTotal / total).toFixed(2),
    promedioGolesVisitante: (golesVisitanteTotal / total).toFixed(2),
    victoriasLocal,
    victoriasVisitante,
    empates,
    over25Pct: Math.round((partidosOver25 / total) * 100),
    bttsPct: Math.round((partidosBTTS / total) * 100),
  };
}

// Identica a extraerStat() y procesarEstadisticasPartido() de pages/index.js
function extraerStat(statsEquipo, nombreStat) {
  if (!statsEquipo || !statsEquipo.statistics) return null;
  const item = statsEquipo.statistics.find((s) => s.type === nombreStat);
  if (!item || item.value === null || item.value === undefined) return null;
  return item.value;
}

function procesarEstadisticasPartido(respuestaApi, homeTeamId) {
  if (!respuestaApi || respuestaApi.length < 2) return null;

  const statsHome = respuestaApi.find((s) => s.team.id === homeTeamId);
  const statsAway = respuestaApi.find((s) => s.team.id !== homeTeamId);

  return {
    corners: { home: extraerStat(statsHome, "Corner Kicks"), away: extraerStat(statsAway, "Corner Kicks") },
    amarillas: { home: extraerStat(statsHome, "Yellow Cards"), away: extraerStat(statsAway, "Yellow Cards") },
    rojas: { home: extraerStat(statsHome, "Red Cards"), away: extraerStat(statsAway, "Red Cards") },
    faltas: { home: extraerStat(statsHome, "Fouls"), away: extraerStat(statsAway, "Fouls") },
    posesion: { home: extraerStat(statsHome, "Ball Possession"), away: extraerStat(statsAway, "Ball Possession") },
    tirosTotales: { home: extraerStat(statsHome, "Total Shots"), away: extraerStat(statsAway, "Total Shots") },
    tirosPuerta: { home: extraerStat(statsHome, "Shots on Goal"), away: extraerStat(statsAway, "Shots on Goal") },
  };
}


const LINEAS_MERCADOS = {
  goles: [0.5, 1.5, 2.5, 3.5, 4.5],
  corners: [7.5, 8.5, 9.5, 10.5, 11.5, 12.5],
  amarillas: [1.5, 2.5, 3.5, 4.5, 5.5],
  faltas: [18.5, 21.5, 24.5, 27.5],
};

module.exports = {
  esLiga,
  calcularEstadisticasGoles,
  calcularGolesNumerico,
  calcularPuntualesNumerico,
  construirFuentesEquipo,
  calcularValorEsperado,
  factorial,
  poissonProb,
  probabilidadOver,
  calcularHeadToHead,
  procesarEstadisticasPartido,
  LINEAS_MERCADOS,
};
