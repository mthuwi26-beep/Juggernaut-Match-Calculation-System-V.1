// ============================================================
// Verificacion automatica de "Mis Estudios".
// Con el "modelo" que se guardo al estudiar el partido (goles esperados de
// cada equipo, corners, tarjetas y faltas esperados, ya con el clima si se
// uso), se vuelven a calcular TODOS los mercados del semaforo con las mismas
// formulas de la pagina, y se comparan contra lo que paso de verdad.
//
// Reglas:
// - Un mercado de si/no cuenta solo si el semaforo se inclino: 55% o mas
//   (se esperaba que SI pasara) o 45% o menos (se esperaba que NO pasara).
//   Entre 45% y 55% es "muy parejo" y no cuenta.
// - Ganador del partido: cuenta si el favorito le saca al menos 10 puntos
//   al segundo.
// - Mercados sin datos (S/D) o con muestra insuficiente no cuentan.
// ============================================================

export const UMBRAL_SI = 0.55;
export const UMBRAL_NO = 0.45;
export const VENTAJA_MINIMA_GANADOR = 0.1;

export const LINEAS_MERCADOS = {
  goles: [0.5, 1.5, 2.5, 3.5, 4.5],
  corners: [7.5, 8.5, 9.5, 10.5, 11.5, 12.5],
  amarillas: [1.5, 2.5, 3.5, 4.5, 5.5],
  faltas: [18.5, 21.5, 24.5, 27.5],
};

const NOMBRES = { goles: "Goles", corners: "Córners", amarillas: "Tarjetas amarillas", faltas: "Faltas" };

function factorial(n) {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function poissonProb(lambda, k) {
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
}

function esNumero(x) {
  return typeof x === "number" && Number.isFinite(x);
}

export function probabilidadOver(lambda, linea) {
  if (!esNumero(lambda)) return null;
  const kMax = Math.floor(linea);
  let acumulada = 0;
  for (let k = 0; k <= kMax; k++) acumulada += poissonProb(lambda, k);
  return Math.max(0, Math.min(1, 1 - acumulada));
}

export function probabilidadBTTS(lambdaLocal, lambdaVisitante) {
  if (!esNumero(lambdaLocal) || !esNumero(lambdaVisitante)) return null;
  return (1 - Math.exp(-lambdaLocal)) * (1 - Math.exp(-lambdaVisitante));
}

export function probabilidad1X2(lambdaLocal, lambdaVisitante) {
  if (!esNumero(lambdaLocal) || !esNumero(lambdaVisitante)) return null;
  let pLocal = 0, pEmpate = 0, pVisitante = 0;
  for (let i = 0; i <= 10; i++) {
    for (let j = 0; j <= 10; j++) {
      const p = poissonProb(lambdaLocal, i) * poissonProb(lambdaVisitante, j);
      if (i > j) pLocal += p;
      else if (i === j) pEmpate += p;
      else pVisitante += p;
    }
  }
  return { pLocal, pEmpate, pVisitante };
}

function probabilidadMarcadorMasProbable(lambdaLocal, lambdaVisitante) {
  if (!esNumero(lambdaLocal) || !esNumero(lambdaVisitante)) return null;
  let mejor = null;
  for (let i = 0; i <= 6; i++) {
    for (let j = 0; j <= 6; j++) {
      const p = poissonProb(lambdaLocal, i) * poissonProb(lambdaVisitante, j);
      if (!mejor || p > mejor.prob) mejor = { local: i, visitante: j, prob: p };
    }
  }
  return mejor;
}

// Igual que probabilidadHandicapAsiatico de la pagina.
function probabilidadHandicap(lambdaLocal, lambdaVisitante, linea) {
  if (!esNumero(lambdaLocal) || !esNumero(lambdaVisitante) || !esNumero(linea)) return null;
  function simple(l) {
    let cubre = 0, noCubre = 0;
    for (let i = 0; i <= 10; i++) {
      for (let j = 0; j <= 10; j++) {
        const p = poissonProb(lambdaLocal, i) * poissonProb(lambdaVisitante, j);
        const diff = i - j + l;
        if (diff > 0) cubre += p;
        else if (diff < 0) noCubre += p;
      }
    }
    return { cubre, noCubre };
  }
  const fraccion = Math.abs(linea % 1);
  const esCuarto = Math.abs(fraccion - 0.25) < 0.001 || Math.abs(fraccion - 0.75) < 0.001;
  if (!esCuarto) return simple(linea);
  const baja = Math.floor(linea * 2) / 2;
  const r1 = simple(baja);
  const r2 = simple(baja + 0.5);
  return { cubre: (r1.cubre + r2.cubre) / 2, noCubre: (r1.noCubre + r2.noCubre) / 2 };
}

// Resultado real del handicap del local: 1 cubre, -1 no cubre, 0 push (no cuenta).
function resultadoHandicap(golesLocal, golesVisitante, linea) {
  const fraccion = Math.abs(linea % 1);
  const esCuarto = Math.abs(fraccion - 0.25) < 0.001 || Math.abs(fraccion - 0.75) < 0.001;
  const lineas = esCuarto ? [Math.floor(linea * 2) / 2, Math.floor(linea * 2) / 2 + 0.5] : [linea];
  let suma = 0;
  lineas.forEach((l) => {
    const d = golesLocal - golesVisitante + l;
    suma += d > 0 ? 1 : d < 0 ? -1 : 0;
  });
  return Math.sign(suma);
}

function pct(p) {
  return Math.round(p * 100);
}

// Evalua un mercado de si/no. Devuelve null si el semaforo no se inclino.
function evaluarSiNo(mercado, texto, prob, paso) {
  if (!esNumero(prob)) return null;
  let esperaba;
  if (prob >= UMBRAL_SI) esperaba = true;
  else if (prob <= UMBRAL_NO) esperaba = false;
  else return null;
  return {
    mercado,
    texto: `${texto}: ${esperaba ? "Sí" : "No"} (${pct(esperaba ? prob : 1 - prob)}%)`,
    acierto: esperaba === paso,
  };
}

function suma(a, b) {
  return esNumero(a) && esNumero(b) ? a + b : null;
}

// real = { golesLocal, golesVisitante, corners, amarillas, faltas } (los tres
// ultimos pueden ser null si la API no los trae).
export function evaluarModelo(modelo, real, nombres = {}) {
  const detalle = [];
  const agregar = (r) => { if (r) detalle.push(r); };
  const gl = modelo.gl, gv = modelo.gv;
  const golesTotales = real.golesLocal + real.golesVisitante;
  const nombreLocal = nombres.local || "Local";
  const nombreVisitante = nombres.visitante || "Visitante";

  // Ganador del partido
  const p1x2 = probabilidad1X2(gl, gv);
  if (p1x2) {
    const opciones = [
      { clave: "local", texto: `Gana ${nombreLocal}`, p: p1x2.pLocal },
      { clave: "empate", texto: "Empate", p: p1x2.pEmpate },
      { clave: "visitante", texto: `Gana ${nombreVisitante}`, p: p1x2.pVisitante },
    ].sort((a, b) => b.p - a.p);
    if (opciones[0].p - opciones[1].p >= VENTAJA_MINIMA_GANADOR) {
      const realClave = real.golesLocal > real.golesVisitante ? "local" : real.golesLocal === real.golesVisitante ? "empate" : "visitante";
      detalle.push({ mercado: "ganador", texto: `Ganador: ${opciones[0].texto} (${pct(opciones[0].p)}%)`, acierto: opciones[0].clave === realClave });
    }

    // Doble oportunidad
    const gano = real.golesLocal > real.golesVisitante, empato = real.golesLocal === real.golesVisitante, perdio = real.golesLocal < real.golesVisitante;
    agregar(evaluarSiNo("doble", `${nombreLocal} o Empate`, p1x2.pLocal + p1x2.pEmpate, gano || empato));
    agregar(evaluarSiNo("doble", `${nombreLocal} o ${nombreVisitante}`, p1x2.pLocal + p1x2.pVisitante, gano || perdio));
    agregar(evaluarSiNo("doble", `Empate o ${nombreVisitante}`, p1x2.pEmpate + p1x2.pVisitante, empato || perdio));
  }

  // Marcador exacto (casi nunca pasa del 45%, asi que normalmente no cuenta)
  const marcador = probabilidadMarcadorMasProbable(gl, gv);
  if (marcador && marcador.prob >= UMBRAL_SI) {
    detalle.push({
      mercado: "marcador",
      texto: `Marcador exacto: ${marcador.local}-${marcador.visitante} (${pct(marcador.prob)}%)`,
      acierto: marcador.local === real.golesLocal && marcador.visitante === real.golesVisitante,
    });
  }

  // Handicap asiatico (la linea que el usuario tenia elegida)
  if (esNumero(modelo.handicap)) {
    const h = probabilidadHandicap(gl, gv, modelo.handicap);
    const resultado = resultadoHandicap(real.golesLocal, real.golesVisitante, modelo.handicap);
    const lineaTexto = modelo.handicap > 0 ? `+${modelo.handicap}` : `${modelo.handicap}`;
    if (h && resultado !== 0) {
      if (h.cubre >= UMBRAL_SI) {
        detalle.push({ mercado: "handicap", texto: `Hándicap ${lineaTexto}: cubre ${nombreLocal} (${pct(h.cubre)}%)`, acierto: resultado > 0 });
      } else if (h.noCubre >= UMBRAL_SI) {
        detalle.push({ mercado: "handicap", texto: `Hándicap ${lineaTexto}: no cubre ${nombreLocal} (${pct(h.noCubre)}%)`, acierto: resultado < 0 });
      }
    }
  }

  // Goles totales y ambos anotan
  const lambdaGoles = suma(gl, gv);
  LINEAS_MERCADOS.goles.forEach((l) => agregar(evaluarSiNo("goles", `Goles Over ${l}`, probabilidadOver(lambdaGoles, l), golesTotales > l)));
  agregar(evaluarSiNo("btts", "Ambos anotan", probabilidadBTTS(gl, gv), real.golesLocal > 0 && real.golesVisitante > 0));

  // Corners, tarjetas y faltas: solo si hubo muestra suficiente y la API trae el dato real
  if (!modelo.muestraInsuficiente) {
    ["corners", "amarillas", "faltas"].forEach((m) => {
      if (!esNumero(real[m])) return;
      LINEAS_MERCADOS[m].forEach((l) =>
        agregar(evaluarSiNo(m, `${NOMBRES[m]} Over ${l}`, probabilidadOver(modelo[m], l), real[m] > l))
      );
    });
  }

  return detalle;
}

// Estudios viejos (antes de guardar el modelo): solo tienen ganador,
// Over 2.5 y ambos anotan.
export function evaluarLegado(prediccion, real, nombres = {}) {
  const detalle = [];
  const golesTotales = real.golesLocal + real.golesVisitante;
  const pick = (prediccion.pick_1x2 || "").trim().toLowerCase();
  if (pick) {
    let esperado = null;
    if (pick === (nombres.local || "").trim().toLowerCase()) esperado = "local";
    else if (pick === (nombres.visitante || "").trim().toLowerCase()) esperado = "visitante";
    else if (pick === "empate" || pick === "draw") esperado = "empate";
    if (esperado) {
      const realClave = real.golesLocal > real.golesVisitante ? "local" : real.golesLocal === real.golesVisitante ? "empate" : "visitante";
      detalle.push({ mercado: "ganador", texto: `Ganador: ${prediccion.pick_1x2}`, acierto: esperado === realClave });
    }
  }
  if (esNumero(prediccion.prob_over25)) {
    const r = evaluarSiNo("goles", "Goles Over 2.5", prediccion.prob_over25 / 100, golesTotales > 2.5);
    if (r) detalle.push(r);
  }
  if (esNumero(prediccion.prob_btts)) {
    const r = evaluarSiNo("btts", "Ambos anotan", prediccion.prob_btts / 100, real.golesLocal > 0 && real.golesVisitante > 0);
    if (r) detalle.push(r);
  }
  return detalle;
}

// Suma una estadistica de los dos equipos desde fixtures/statistics.
export function sumarEstadistica(respuestaStats, nombreStat) {
  if (!Array.isArray(respuestaStats) || respuestaStats.length < 2) return null;
  let total = 0;
  for (const equipo of respuestaStats) {
    const item = (equipo.statistics || []).find((s) => s.type === nombreStat);
    if (!item || item.value === null || item.value === undefined) return null;
    const n = typeof item.value === "number" ? item.value : parseInt(item.value, 10);
    if (!Number.isFinite(n)) return null;
    total += n;
  }
  return total;
}
