// ============================================================
// MOTOR DE CÁLCULO COMPARTIDO
// ============================================================
// Esto es una COPIA de las funciones puras (sin React) que ya existen en
// pages/index.js. No se movieron ni se borraron de ahí — se duplicaron acá
// para que el vigilante (que corre en el servidor, sin navegador) pueda
// calcular el mismo semáforo que ves en Estudio, para el aviso automático
// de "semáforo en verde" push.
//
// Honestidad importante: como es una copia, si el día de mañana se ajusta
// una fórmula en index.js (por ejemplo el modelo de pesos), hay que
// actualizarla ACÁ TAMBIÉN a mano — no se sincronizan solas.
// ============================================================

const KEYWORDS_NO_LIGA = ["cup", "copa", "champions", "libertadores", "sudamericana", "europa league", "conference", "playoff", "friendlies", "amistoso", "supercopa", "trophy", "shield"];

function esLiga(fixture) {
  const nombre = (fixture.league?.name || "").toLowerCase();
  return !KEYWORDS_NO_LIGA.some((k) => nombre.includes(k));
}

function calcularEstadisticasGoles(fixtures, teamId) {
  if (!fixtures || fixtures.length === 0) return null;
  let victorias = 0, empates = 0, derrotas = 0;
  let golesFavor = 0, golesContra = 0;
  let over25 = 0, btts = 0;

  fixtures.forEach((f) => {
    const esLocal = f.teams.home.id === teamId;
    const gf = esLocal ? f.goals.home : f.goals.away;
    const gc = esLocal ? f.goals.away : f.goals.home;
    if (gf === null || gc === null) return;

    golesFavor += gf;
    golesContra += gc;
    if (gf > gc) victorias++;
    else if (gf === gc) empates++;
    else derrotas++;

    if (gf + gc > 2.5) over25++;
    if (gf > 0 && gc > 0) btts++;
  });

  const total = fixtures.length;
  return {
    total, victorias, empates, derrotas,
    promedioGolesFavor: (golesFavor / total).toFixed(2),
    promedioGolesContra: (golesContra / total).toFixed(2),
    over25Pct: Math.round((over25 / total) * 100),
    bttsPct: Math.round((btts / total) * 100),
  };
}

function calcularGolesNumerico(fixtures, teamId) {
  const s = calcularEstadisticasGoles(fixtures, teamId);
  return { valor: s ? parseFloat(s.promedioGolesFavor) : null, n: s ? s.total : 0 };
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
  const partidos = (fixturesLocal || []).filter(
    (f) =>
      (f.teams.home.id === idLocal && f.teams.away.id === idVisitante) ||
      (f.teams.home.id === idVisitante && f.teams.away.id === idLocal)
  );
  let victoriasLocal = 0, empates = 0, victoriasVisitante = 0;
  let golesLocalTotal = 0, golesVisitanteTotal = 0;

  partidos.forEach((f) => {
    const golesDeLocal = f.teams.home.id === idLocal ? f.goals.home : f.goals.away;
    const golesDeVisitante = f.teams.home.id === idVisitante ? f.goals.home : f.goals.away;
    if (golesDeLocal === null || golesDeVisitante === null) return;
    golesLocalTotal += golesDeLocal;
    golesVisitanteTotal += golesDeVisitante;
    if (golesDeLocal > golesDeVisitante) victoriasLocal++;
    else if (golesDeLocal === golesDeVisitante) empates++;
    else victoriasVisitante++;
  });

  const total = partidos.length;
  return {
    partidos, total, victoriasLocal, empates, victoriasVisitante,
    promedioGolesLocal: total ? (golesLocalTotal / total).toFixed(2) : "0.00",
    promedioGolesVisitante: total ? (golesVisitanteTotal / total).toFixed(2) : "0.00",
  };
}

function procesarEstadisticasPartido(respuestaApi, homeTeamId) {
  if (!Array.isArray(respuestaApi) || respuestaApi.length < 2) return null;
  const buscar = (equipoStats, tipo) => {
    const item = equipoStats?.statistics?.find((s) => s.type === tipo);
    const valor = item?.value;
    if (valor === null || valor === undefined) return null;
    return typeof valor === "string" ? parseFloat(valor) : valor;
  };
  const statsHome = respuestaApi.find((e) => e.team.id === homeTeamId) || respuestaApi[0];
  const statsAway = respuestaApi.find((e) => e.team.id !== homeTeamId) || respuestaApi[1];

  return {
    corners: { home: buscar(statsHome, "Corner Kicks"), away: buscar(statsAway, "Corner Kicks") },
    amarillas: { home: buscar(statsHome, "Yellow Cards"), away: buscar(statsAway, "Yellow Cards") },
    faltas: { home: buscar(statsHome, "Fouls"), away: buscar(statsAway, "Fouls") },
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
