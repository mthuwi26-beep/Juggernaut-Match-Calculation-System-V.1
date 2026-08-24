import { useState, useEffect } from "react";

const TEMAS = {
  claro: {
    fondo: "#ffffff",
    texto: "#111111",
    textoSuave: "#666666",
    panel: "#f7f7f7",
    borde: "#dddddd",
    encabezadoTabla: "#f0f0f0",
    filaBorde: "#eeeeee",
  },
  oscuro: {
    fondo: "#121212",
    texto: "#f0f0f0",
    textoSuave: "#aaaaaa",
    panel: "#1e1e1e",
    borde: "#333333",
    encabezadoTabla: "#2a2a2a",
    filaBorde: "#2a2a2a",
  },
};

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extraerStat(statsEquipo, nombreStat) {
  if (!statsEquipo || !statsEquipo.statistics) return null;
  const item = statsEquipo.statistics.find((s) => s.type === nombreStat);
  if (!item || item.value === null || item.value === undefined) return null;
  return item.value;
}

// A partir de la respuesta de fixtures/statistics (array con 2 elementos: home y away)
// arma un objeto simple { corners: {home, away}, amarillas: {...}, faltas: {...} }
function procesarEstadisticasPartido(respuestaApi, homeTeamId) {
  if (!respuestaApi || respuestaApi.length < 2) return null;

  const statsHome = respuestaApi.find((s) => s.team.id === homeTeamId);
  const statsAway = respuestaApi.find((s) => s.team.id !== homeTeamId);

  return {
    corners: {
      home: extraerStat(statsHome, "Corner Kicks"),
      away: extraerStat(statsAway, "Corner Kicks"),
    },
    amarillas: {
      home: extraerStat(statsHome, "Yellow Cards"),
      away: extraerStat(statsAway, "Yellow Cards"),
    },
    faltas: {
      home: extraerStat(statsHome, "Fouls"),
      away: extraerStat(statsAway, "Fouls"),
    },
  };
}

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

// Promedios de córners/tarjetas/faltas para un equipo, usando el mapa de estadísticas ya cargado
function calcularEstadisticasPuntuales(fixtures, teamId, statsMap) {
  if (!fixtures || fixtures.length === 0) return null;

  let corners = 0, cornersContador = 0;
  let amarillas = 0, amarillasContador = 0;
  let faltas = 0, faltasContador = 0;

  fixtures.forEach((f) => {
    const datos = statsMap[f.fixture.id];
    if (!datos) return;
    const esLocal = f.teams.home.id === teamId;

    const c = esLocal ? datos.corners.home : datos.corners.away;
    const a = esLocal ? datos.amarillas.home : datos.amarillas.away;
    const ft = esLocal ? datos.faltas.home : datos.faltas.away;

    if (c !== null) { corners += c; cornersContador++; }
    if (a !== null) { amarillas += a; amarillasContador++; }
    if (ft !== null) { faltas += ft; faltasContador++; }
  });

  if (cornersContador === 0 && amarillasContador === 0 && faltasContador === 0) return null;

  return {
    promedioCorners: cornersContador ? (corners / cornersContador).toFixed(2) : "—",
    promedioAmarillas: amarillasContador ? (amarillas / amarillasContador).toFixed(2) : "—",
    promedioFaltas: faltasContador ? (faltas / faltasContador).toFixed(2) : "—",
  };
}

// Versión numérica (no formateada) de córners/tarjetas/faltas, con el conteo de partidos
// que realmente aportaron dato — la usa el motor de pesos para saber el N de cada fuente.
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

// Arma las 6 "fuentes" (local, visitante, liga, no liga, temporada, forma reciente)
// para UN equipo, con valor y N de cada estadística (goles, córners, amarillas, faltas)
function construirFuentesEquipo(fixturesCompletos, teamId, statsMap) {
  const subsets = {
    local: fixturesCompletos.filter((f) => f.teams.home.id === teamId),
    visitante: fixturesCompletos.filter((f) => f.teams.away.id === teamId),
    liga: fixturesCompletos.filter((f) => esLiga(f)),
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

// El motor de pesos dinámicos: recibe las 7 fuentes de UNA estadística y devuelve
// el valor esperado ya ponderado y normalizado, según la metodología del documento.
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

// --- Distribución de Poisson: convierte un valor esperado (lambda) en probabilidades ---
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

function probabilidadBTTS(lambdaLocal, lambdaVisitante) {
  if (lambdaLocal === null || lambdaVisitante === null) return null;
  const pLocalAnota = 1 - Math.exp(-lambdaLocal);
  const pVisitanteAnota = 1 - Math.exp(-lambdaVisitante);
  return pLocalAnota * pVisitanteAnota;
}

function colorSemaforo(probabilidad) {
  if (probabilidad === null) return { color: "#999", etiqueta: "Sin datos" };
  if (probabilidad >= 0.7) return { color: "#22c55e", etiqueta: "Verde" };
  if (probabilidad >= 0.5) return { color: "#eab308", etiqueta: "Amarillo" };
  return { color: "#ef4444", etiqueta: "Rojo" };
}

const LINEAS_MERCADOS = {
  goles: [0.5, 1.5, 2.5, 3.5, 4.5],
  corners: [7.5, 8.5, 9.5, 10.5, 11.5, 12.5],
  amarillas: [1.5, 2.5, 3.5, 4.5, 5.5],
  faltas: [18.5, 21.5, 24.5, 27.5],
};

function calcularHeadToHead(fixturesLocal, fixturesVisitante, idLocal, idVisitante) {
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

function FilaStat({ etiqueta, valor }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
      <span>{etiqueta}</span>
      <strong>{valor}</strong>
    </div>
  );
}

function MiniTabla({ fixtures, tema }) {
  if (!fixtures || fixtures.length === 0) {
    return <p style={{ color: tema.textoSuave, fontSize: 12 }}>Sin partidos.</p>;
  }
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, marginTop: 8 }}>
      <thead>
        <tr style={{ background: tema.encabezadoTabla, textAlign: "left" }}>
          <th style={{ padding: 4 }}>Fecha</th>
          <th style={{ padding: 4 }}>Partido</th>
          <th style={{ padding: 4 }}>Res.</th>
        </tr>
      </thead>
      <tbody>
        {fixtures.map((f) => (
          <tr key={f.fixture.id} style={{ borderBottom: `1px solid ${tema.filaBorde}` }}>
            <td style={{ padding: 4 }}>{new Date(f.fixture.date).toLocaleDateString("es-ES")}</td>
            <td style={{ padding: 4 }}>{f.teams.home.name} vs {f.teams.away.name}</td>
            <td style={{ padding: 4 }}>{f.goals.home}-{f.goals.away}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function esLiga(fixture) {
  const palabrasNoLiga = ["cup", "copa", "champions", "europa", "conference", "supercopa", "shield", "trophy", "playoff", "friendlies", "amistoso"];
  const nombre = fixture.league.name.toLowerCase();
  return !palabrasNoLiga.some((p) => nombre.includes(p));
}

function SubPanel({ titulo, fixtures, teamId, statsMap, tema }) {
  const statsGoles = calcularEstadisticasGoles(fixtures, teamId);
  const statsPuntuales = calcularEstadisticasPuntuales(fixtures, teamId, statsMap);

  return (
    <div style={{ flex: 1, minWidth: 200 }}>
      <h4 style={{ marginBottom: 6, fontSize: 14 }}>{titulo}</h4>
      {statsGoles ? (
        <div style={{ padding: 10, background: tema.panel, borderRadius: 6, fontSize: 12 }}>
          <FilaStat etiqueta="Récord (V-E-D)" valor={`${statsGoles.victorias}-${statsGoles.empates}-${statsGoles.derrotas}`} />
          <FilaStat etiqueta="Goles a favor (prom.)" valor={statsGoles.promedioGolesFavor} />
          <FilaStat etiqueta="Goles en contra (prom.)" valor={statsGoles.promedioGolesContra} />
          <FilaStat etiqueta="% Over 2.5" valor={`${statsGoles.over25Pct}%`} />
          <FilaStat etiqueta="% BTTS" valor={`${statsGoles.bttsPct}%`} />
          {statsPuntuales && (
            <>
              <div style={{ borderTop: `1px solid ${tema.borde}`, margin: "6px 0" }} />
              <FilaStat etiqueta="Córners (prom.)" valor={statsPuntuales.promedioCorners} />
              <FilaStat etiqueta="Tarjetas am. (prom.)" valor={statsPuntuales.promedioAmarillas} />
              <FilaStat etiqueta="Faltas (prom.)" valor={statsPuntuales.promedioFaltas} />
            </>
          )}
        </div>
      ) : (
        <p style={{ color: tema.textoSuave, fontSize: 12 }}>Sin datos.</p>
      )}
      <MiniTabla fixtures={fixtures} tema={tema} />
    </div>
  );
}

function BuscadorEquipo({ etiqueta, onEquipoCargado, tema, statsMap, equipoForzado }) {
  const [query, setQuery] = useState("");
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function buscarEquipos(e) {
    e.preventDefault();
    setError("");
    setFixtures([]);
    setSelectedTeam(null);
    onEquipoCargado && onEquipoCargado(null, []);

    if (query.trim().length < 3) {
      setError("Escribe al menos 3 letras del nombre del equipo");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/teams?name=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setTeams([]);
      } else {
        setTeams(data);
      }
    } catch (err) {
      setError("Error al buscar equipos");
    }
    setLoading(false);
  }

  async function verPartidos(team) {
    setSelectedTeam(team);
    setFixtures([]);
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`/api/fixtures?teamId=${team.team.id}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setFixtures(data);
        onEquipoCargado && onEquipoCargado(team, data);
      }
    } catch (err) {
      setError("Error al traer los partidos");
    }
    setLoading(false);
  }

  useEffect(() => {
    if (equipoForzado) {
      setQuery(equipoForzado.team.name);
      setTeams([]);
      verPartidos(equipoForzado);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipoForzado?.team?.id]);

  const fixturesLocalVenue = fixtures.filter((f) => selectedTeam && f.teams.home.id === selectedTeam.team.id);
  const fixturesVisitanteVenue = fixtures.filter((f) => selectedTeam && f.teams.away.id === selectedTeam.team.id);
  const fixturesLigaActual = fixtures.filter((f) => esLiga(f));
  const fixturesNoLiga = fixtures.filter((f) => !esLiga(f));
  const fixturesFormaReciente = fixtures.slice(0, 5); // ya vienen ordenados del más reciente al más viejo

  return (
    <div style={{ flex: 1, minWidth: 340 }}>
      <h3 style={{ marginBottom: 8 }}>{etiqueta}</h3>

      <form onSubmit={buscarEquipos} style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Escribe un equipo (ej: Barcelona)"
          style={{
            flex: 1, padding: 10, fontSize: 15,
            background: tema.panel, color: tema.texto,
            border: `1px solid ${tema.borde}`, borderRadius: 4,
          }}
        />
        <button
          type="submit"
          style={{
            padding: "10px 16px", fontSize: 15,
            background: tema.panel, color: tema.texto,
            border: `1px solid ${tema.borde}`, borderRadius: 4, cursor: "pointer",
          }}
        >
          Buscar
        </button>
      </form>

      {loading && <p style={{ marginTop: 12 }}>Cargando...</p>}
      {error && <p style={{ marginTop: 12, color: "#e05555", fontSize: 14 }}>{error}</p>}

      {teams.length > 0 && !selectedTeam && (
        <div style={{ marginTop: 12, maxHeight: 250, overflowY: "auto" }}>
          {teams.map((t) => (
            <div
              key={t.team.id}
              onClick={() => verPartidos(t)}
              style={{
                padding: 8, border: `1px solid ${tema.borde}`, marginBottom: 6,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 14,
              }}
            >
              <img src={t.team.logo} alt={t.team.name} width={22} height={22} />
              <span>{t.team.name} — {t.team.country}</span>
            </div>
          ))}
        </div>
      )}

      {selectedTeam && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <img src={selectedTeam.team.logo} alt={selectedTeam.team.name} width={26} height={26} />
            <strong>{selectedTeam.team.name}</strong>
          </div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <SubPanel titulo="Como Local" fixtures={fixturesLocalVenue} teamId={selectedTeam.team.id} statsMap={statsMap} tema={tema} />
            <SubPanel titulo="Como Visitante" fixtures={fixturesVisitanteVenue} teamId={selectedTeam.team.id} statsMap={statsMap} tema={tema} />
            <SubPanel titulo="Liga actual" fixtures={fixturesLigaActual} teamId={selectedTeam.team.id} statsMap={statsMap} tema={tema} />
            <SubPanel titulo="No liga (copas)" fixtures={fixturesNoLiga} teamId={selectedTeam.team.id} statsMap={statsMap} tema={tema} />
            <SubPanel titulo="Forma reciente (5)" fixtures={fixturesFormaReciente} teamId={selectedTeam.team.id} statsMap={statsMap} tema={tema} />
          </div>
        </div>
      )}
    </div>
  );
}

function TablaComparativa({ nombreLocal, nombreVisitante, statsLocal, statsVisitante, tema }) {
  if (!statsLocal || !statsVisitante) return null;

  const filas = [
    { etiqueta: "Goles a favor (prom.)", local: statsLocal.promedioGolesFavor, visitante: statsVisitante.promedioGolesFavor },
    { etiqueta: "Goles en contra (prom.)", local: statsLocal.promedioGolesContra, visitante: statsVisitante.promedioGolesContra },
    { etiqueta: "% Over 2.5", local: `${statsLocal.over25Pct}%`, visitante: `${statsVisitante.over25Pct}%` },
    { etiqueta: "% BTTS", local: `${statsLocal.bttsPct}%`, visitante: `${statsVisitante.bttsPct}%` },
  ];

  return (
    <div style={{ marginTop: 16 }}>
      <h4>Tabla comparativa — temporada completa</h4>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: tema.encabezadoTabla, textAlign: "left" }}>
            <th style={{ padding: 6 }}>Estadística</th>
            <th style={{ padding: 6 }}>{nombreLocal}</th>
            <th style={{ padding: 6 }}>{nombreVisitante}</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${tema.filaBorde}` }}>
              <td style={{ padding: 6 }}>{f.etiqueta}</td>
              <td style={{ padding: 6 }}>{f.local}</td>
              <td style={{ padding: 6 }}>{f.visitante}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TablaComparativaPuntual({ nombreLocal, nombreVisitante, fixturesLocal, fixturesVisitante, idLocal, idVisitante, statsMap, tema }) {
  const pLocal = calcularEstadisticasPuntuales(fixturesLocal, idLocal, statsMap);
  const pVisitante = calcularEstadisticasPuntuales(fixturesVisitante, idVisitante, statsMap);

  if (!pLocal || !pVisitante) return null;

  const filas = [
    { etiqueta: "Córners (prom.)", local: pLocal.promedioCorners, visitante: pVisitante.promedioCorners },
    { etiqueta: "Tarjetas amarillas (prom.)", local: pLocal.promedioAmarillas, visitante: pVisitante.promedioAmarillas },
    { etiqueta: "Faltas (prom.)", local: pLocal.promedioFaltas, visitante: pVisitante.promedioFaltas },
  ];

  return (
    <div style={{ marginTop: 16 }}>
      <h4>Tabla comparativa — córners, tarjetas y faltas</h4>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: tema.encabezadoTabla, textAlign: "left" }}>
            <th style={{ padding: 6 }}>Estadística</th>
            <th style={{ padding: 6 }}>{nombreLocal}</th>
            <th style={{ padding: 6 }}>{nombreVisitante}</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${tema.filaBorde}` }}>
              <td style={{ padding: 6 }}>{f.etiqueta}</td>
              <td style={{ padding: 6 }}>{f.local}</td>
              <td style={{ padding: 6 }}>{f.visitante}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PanelHeadToHead({ h2h, nombreLocal, nombreVisitante, tema, statsMap, datosPuntualesListos }) {
  if (!h2h) return null;

  if (h2h.partidos.length === 0) {
    return (
      <div style={{ marginTop: 30, padding: 16, background: tema.panel, borderRadius: 6 }}>
        <h3 style={{ marginTop: 0 }}>Enfrentamientos directos</h3>
        <p style={{ color: tema.textoSuave }}>{h2h.mensaje}</p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 30, padding: 16, background: tema.panel, borderRadius: 6 }}>
      <h3 style={{ marginTop: 0 }}>
        Enfrentamientos directos ({h2h.total} partido{h2h.total !== 1 ? "s" : ""})
      </h3>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 13, marginBottom: 16 }}>
        <div>Victorias {nombreLocal}: <strong>{h2h.victoriasLocal}</strong></div>
        <div>Empates: <strong>{h2h.empates}</strong></div>
        <div>Victorias {nombreVisitante}: <strong>{h2h.victoriasVisitante}</strong></div>
        <div>Promedio goles {nombreLocal}: <strong>{h2h.promedioGolesLocal}</strong></div>
        <div>Promedio goles {nombreVisitante}: <strong>{h2h.promedioGolesVisitante}</strong></div>
        <div>% Over 2.5: <strong>{h2h.over25Pct}%</strong></div>
        <div>% BTTS: <strong>{h2h.bttsPct}%</strong></div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: tema.encabezadoTabla, textAlign: "left" }}>
            <th style={{ padding: 6 }}>Fecha</th>
            <th style={{ padding: 6 }}>Torneo</th>
            <th style={{ padding: 6 }}>Partido</th>
            <th style={{ padding: 6 }}>Goles</th>
            {datosPuntualesListos && (
              <>
                <th style={{ padding: 6 }}>Córners</th>
                <th style={{ padding: 6 }}>Amarillas</th>
                <th style={{ padding: 6 }}>Faltas</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {h2h.partidos.map((f) => {
            const datos = statsMap[f.fixture.id];
            return (
              <tr key={f.fixture.id} style={{ borderBottom: `1px solid ${tema.filaBorde}` }}>
                <td style={{ padding: 6 }}>{new Date(f.fixture.date).toLocaleDateString("es-ES")}</td>
                <td style={{ padding: 6 }}>{f.league.name}</td>
                <td style={{ padding: 6 }}>{f.teams.home.name} vs {f.teams.away.name}</td>
                <td style={{ padding: 6 }}>{f.goals.home} - {f.goals.away}</td>
                {datosPuntualesListos && (
                  <>
                    <td style={{ padding: 6 }}>
                      {datos ? `${datos.corners.home ?? "—"} - ${datos.corners.away ?? "—"}` : "—"}
                    </td>
                    <td style={{ padding: 6 }}>
                      {datos ? `${datos.amarillas.home ?? "—"} - ${datos.amarillas.away ?? "—"}` : "—"}
                    </td>
                    <td style={{ padding: 6 }}>
                      {datos ? `${datos.faltas.home ?? "—"} - ${datos.faltas.away ?? "—"}` : "—"}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function calcularGolesNumerico(fixtures, teamId) {
  if (!fixtures || fixtures.length === 0) return { valor: null, n: 0 };
  let suma = 0;
  fixtures.forEach((f) => {
    const esLocal = f.teams.home.id === teamId;
    suma += esLocal ? f.goals.home : f.goals.away;
  });
  return { valor: suma / fixtures.length, n: fixtures.length };
}

function FilaMercado({ nombre, lineas, lambda, tema }) {
  if (lambda === null || lambda === undefined) return null;
  return (
    <div style={{ marginBottom: 18 }}>
      <h4 style={{ marginBottom: 8, fontSize: 14 }}>
        {nombre} <span style={{ fontWeight: "normal", color: tema.textoSuave }}>— esperado: {lambda.toFixed(2)}</span>
      </h4>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {lineas.map((linea) => {
          const p = probabilidadOver(lambda, linea);
          const { color } = colorSemaforo(p);
          return (
            <div
              key={linea}
              style={{
                padding: "8px 14px", borderRadius: 6, background: color, color: "#fff",
                fontSize: 13, fontWeight: "bold", minWidth: 90, textAlign: "center",
              }}
            >
              Over {linea}<br />{Math.round(p * 100)}%
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PanelSemaforo({ equipoLocal, equipoVisitante, fixturesLocal, fixturesVisitante, h2h, statsMap, datosPuntualesListos, esPartidoLiga, setEsPartidoLiga, tema, acento }) {
  if (!equipoLocal?.team || !equipoVisitante?.team) return null;

  const fuentesEqLocal = construirFuentesEquipo(fixturesLocal, equipoLocal.team.id, statsMap);
  const fuentesEqVisitante = construirFuentesEquipo(fixturesVisitante, equipoVisitante.team.id, statsMap);

  const partidosH2H = h2h?.partidos || [];
  const h2hGolesLocal = calcularGolesNumerico(partidosH2H, equipoLocal.team.id);
  const h2hGolesVisitante = calcularGolesNumerico(partidosH2H, equipoVisitante.team.id);
  const h2hPuntualesLocal = calcularPuntualesNumerico(partidosH2H, equipoLocal.team.id, statsMap);
  const h2hPuntualesVisitante = calcularPuntualesNumerico(partidosH2H, equipoVisitante.team.id, statsMap);

  function armarMotor(fuentesEq, actualClave, contrariaClave, h2hGoles, h2hPuntuales) {
    return {
      goles: { actual: fuentesEq[actualClave].goles, contraria: fuentesEq[contrariaClave].goles, liga: fuentesEq.liga.goles, noLiga: fuentesEq.noLiga.goles, temporada: fuentesEq.temporada.goles, forma: fuentesEq.forma.goles, h2h: h2hGoles },
      corners: { actual: fuentesEq[actualClave].corners, contraria: fuentesEq[contrariaClave].corners, liga: fuentesEq.liga.corners, noLiga: fuentesEq.noLiga.corners, temporada: fuentesEq.temporada.corners, forma: fuentesEq.forma.corners, h2h: h2hPuntuales.corners },
      amarillas: { actual: fuentesEq[actualClave].amarillas, contraria: fuentesEq[contrariaClave].amarillas, liga: fuentesEq.liga.amarillas, noLiga: fuentesEq.noLiga.amarillas, temporada: fuentesEq.temporada.amarillas, forma: fuentesEq.forma.amarillas, h2h: h2hPuntuales.amarillas },
      faltas: { actual: fuentesEq[actualClave].faltas, contraria: fuentesEq[contrariaClave].faltas, liga: fuentesEq.liga.faltas, noLiga: fuentesEq.noLiga.faltas, temporada: fuentesEq.temporada.faltas, forma: fuentesEq.forma.faltas, h2h: h2hPuntuales.faltas },
    };
  }

  const motorLocal = armarMotor(fuentesEqLocal, "local", "visitante", h2hGolesLocal, h2hPuntualesLocal);
  const motorVisitante = armarMotor(fuentesEqVisitante, "visitante", "local", h2hGolesVisitante, h2hPuntualesVisitante);

  const lambdaGolesLocal = calcularValorEsperado(motorLocal.goles, esPartidoLiga);
  const lambdaGolesVisitante = calcularValorEsperado(motorVisitante.goles, esPartidoLiga);
  const lambdaGolesTotal = lambdaGolesLocal !== null && lambdaGolesVisitante !== null ? lambdaGolesLocal + lambdaGolesVisitante : null;

  const lambdaCornersLocal = calcularValorEsperado(motorLocal.corners, esPartidoLiga);
  const lambdaCornersVisitante = calcularValorEsperado(motorVisitante.corners, esPartidoLiga);
  const lambdaCornersTotal = lambdaCornersLocal !== null && lambdaCornersVisitante !== null ? lambdaCornersLocal + lambdaCornersVisitante : null;

  const lambdaAmarillasLocal = calcularValorEsperado(motorLocal.amarillas, esPartidoLiga);
  const lambdaAmarillasVisitante = calcularValorEsperado(motorVisitante.amarillas, esPartidoLiga);
  const lambdaAmarillasTotal = lambdaAmarillasLocal !== null && lambdaAmarillasVisitante !== null ? lambdaAmarillasLocal + lambdaAmarillasVisitante : null;

  const lambdaFaltasLocal = calcularValorEsperado(motorLocal.faltas, esPartidoLiga);
  const lambdaFaltasVisitante = calcularValorEsperado(motorVisitante.faltas, esPartidoLiga);
  const lambdaFaltasTotal = lambdaFaltasLocal !== null && lambdaFaltasVisitante !== null ? lambdaFaltasLocal + lambdaFaltasVisitante : null;

  const probBTTS = probabilidadBTTS(lambdaGolesLocal, lambdaGolesVisitante);

  return (
    <div style={{ marginTop: 30, padding: 16, background: tema.panel, borderRadius: 6 }}>
      <h3 style={{ marginTop: 0 }}>🚦 Pronóstico y semáforo</h3>

      <div style={{ marginBottom: 20, fontSize: 13, display: "flex", gap: 16 }}>
        <label style={{ cursor: "pointer" }}>
          <input type="radio" checked={esPartidoLiga} onChange={() => setEsPartidoLiga(true)} style={{ accentColor: acento }} /> Partido de Liga
        </label>
        <label style={{ cursor: "pointer" }}>
          <input type="radio" checked={!esPartidoLiga} onChange={() => setEsPartidoLiga(false)} style={{ accentColor: acento }} /> Partido de Copa/otro torneo
        </label>
      </div>

      <FilaMercado nombre="Goles totales del partido" lineas={LINEAS_MERCADOS.goles} lambda={lambdaGolesTotal} tema={tema} />

      {probBTTS !== null && (
        <div style={{ marginBottom: 18 }}>
          <h4 style={{ marginBottom: 8, fontSize: 14 }}>Ambos anotan (BTTS)</h4>
          {(() => {
            const { color } = colorSemaforo(probBTTS);
            return (
              <div style={{ display: "inline-block", padding: "8px 16px", borderRadius: 6, background: color, color: "#fff", fontWeight: "bold", fontSize: 13 }}>
                {Math.round(probBTTS * 100)}%
              </div>
            );
          })()}
        </div>
      )}

      {datosPuntualesListos ? (
        <>
          <FilaMercado nombre="Córners totales del partido" lineas={LINEAS_MERCADOS.corners} lambda={lambdaCornersTotal} tema={tema} />
          <FilaMercado nombre="Tarjetas amarillas totales" lineas={LINEAS_MERCADOS.amarillas} lambda={lambdaAmarillasTotal} tema={tema} />
          <FilaMercado nombre="Faltas totales del partido" lineas={LINEAS_MERCADOS.faltas} lambda={lambdaFaltasTotal} tema={tema} />
        </>
      ) : (
        <p style={{ color: tema.textoSuave, fontSize: 13 }}>
          Carga los "datos puntuales" arriba para ver el semáforo de córners, tarjetas y faltas.
        </p>
      )}

      <p style={{ fontSize: 11, color: tema.textoSuave, marginTop: 16 }}>
        Esto es un modelo estadístico de tendencias, no una certeza. No contempla lesiones, sanciones, clima ni decisiones arbitrales puntuales.
      </p>
    </div>
  );
}

function PanelCalendario({ tema, onSeleccionarPartido }) {
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [partidos, setPartidos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [buscado, setBuscado] = useState(false);

  async function buscarPartidos() {
    setLoading(true);
    setError("");
    setPartidos([]);
    setBuscado(true);
    try {
      const res = await fetch(`/api/partidos-por-fecha?date=${fecha}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setPartidos(data);
      }
    } catch (err) {
      setError("Error al buscar partidos");
    }
    setLoading(false);
  }

  return (
    <div style={{ width: 300, flexShrink: 0 }}>
      <h3 style={{ fontSize: 15, marginBottom: 10 }}>📅 Calendario de partidos</h3>

      <input
        type="date"
        value={fecha}
        onChange={(e) => setFecha(e.target.value)}
        style={{
          width: "100%", padding: 8, marginBottom: 8, fontSize: 13,
          background: tema.panel, color: tema.texto, border: `1px solid ${tema.borde}`, borderRadius: 4,
        }}
      />
      <button
        onClick={buscarPartidos}
        disabled={loading}
        style={{
          width: "100%", padding: 8, marginBottom: 14, fontSize: 13,
          background: tema.panel, color: tema.texto, border: `1px solid ${tema.borde}`,
          borderRadius: 4, cursor: "pointer",
        }}
      >
        {loading ? "Buscando..." : "Ver partidos de este día"}
      </button>

      {error && (
        <p style={{ fontSize: 12, color: "#e05555" }}>{error}</p>
      )}
      {buscado && !loading && !error && partidos.length === 0 && (
        <p style={{ fontSize: 12, color: tema.textoSuave }}>No hay partidos para esta fecha.</p>
      )}

      <div style={{ maxHeight: 550, overflowY: "auto" }}>
        {partidos.map((p) => (
          <div
            key={p.fixture.id}
            onClick={() => onSeleccionarPartido(p)}
            style={{
              padding: 8, border: `1px solid ${tema.borde}`, marginBottom: 6,
              cursor: "pointer", fontSize: 12,
            }}
          >
            <div style={{ color: tema.textoSuave, marginBottom: 4, fontSize: 11 }}>{p.league.name}</div>
            <div>{p.teams.home.name} vs {p.teams.away.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function armarContextoParaIA({ equipoLocal, equipoVisitante, statsGoLocal, statsGoVisitante, h2h, esPartidoLiga }) {
  let contexto = `Partido: ${equipoLocal.team.name} (Local) vs ${equipoVisitante.team.name} (Visitante)\n`;
  contexto += `Tipo de partido: ${esPartidoLiga ? "Liga" : "Copa/otro torneo"}\n\n`;

  if (statsGoLocal) {
    contexto += `${equipoLocal.team.name} (últimos ${statsGoLocal.total} partidos, temporada 2024): Récord ${statsGoLocal.victorias}V-${statsGoLocal.empates}E-${statsGoLocal.derrotas}D, promedio goles a favor ${statsGoLocal.promedioGolesFavor}, en contra ${statsGoLocal.promedioGolesContra}, % Over 2.5: ${statsGoLocal.over25Pct}%, % BTTS: ${statsGoLocal.bttsPct}%\n`;
  }
  if (statsGoVisitante) {
    contexto += `${equipoVisitante.team.name} (últimos ${statsGoVisitante.total} partidos, temporada 2024): Récord ${statsGoVisitante.victorias}V-${statsGoVisitante.empates}E-${statsGoVisitante.derrotas}D, promedio goles a favor ${statsGoVisitante.promedioGolesFavor}, en contra ${statsGoVisitante.promedioGolesContra}, % Over 2.5: ${statsGoVisitante.over25Pct}%, % BTTS: ${statsGoVisitante.bttsPct}%\n`;
  }

  if (h2h && h2h.partidos && h2h.partidos.length > 0) {
    contexto += `\nEnfrentamientos directos (${h2h.total} partido${h2h.total !== 1 ? "s" : ""}): Victorias ${equipoLocal.team.name}: ${h2h.victoriasLocal}, Empates: ${h2h.empates}, Victorias ${equipoVisitante.team.name}: ${h2h.victoriasVisitante}. Promedio goles ${equipoLocal.team.name}: ${h2h.promedioGolesLocal}, ${equipoVisitante.team.name}: ${h2h.promedioGolesVisitante}. % Over 2.5: ${h2h.over25Pct}%, % BTTS: ${h2h.bttsPct}%\n`;
  } else {
    contexto += `\nNo hay enfrentamientos directos recientes registrados.\n`;
  }

  return contexto;
}

function ChatIA({ equipoLocal, equipoVisitante, statsGoLocal, statsGoVisitante, h2h, esPartidoLiga, tema, acento }) {
  const [pregunta, setPregunta] = useState("");
  const [mensajes, setMensajes] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  if (!equipoLocal?.team || !equipoVisitante?.team) return null;

  async function enviarPregunta(e) {
    e.preventDefault();
    if (!pregunta.trim()) return;

    const preguntaActual = pregunta;
    setMensajes((prev) => [...prev, { rol: "usuario", texto: preguntaActual }]);
    setPregunta("");
    setError("");
    setCargando(true);

    const contexto = armarContextoParaIA({ equipoLocal, equipoVisitante, statsGoLocal, statsGoVisitante, h2h, esPartidoLiga });

    try {
      const res = await fetch("/api/analisis-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contexto, pregunta: preguntaActual }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setMensajes((prev) => [...prev, { rol: "ia", texto: data.respuesta }]);
      }
    } catch (err) {
      setError("No se pudo conectar con la IA");
    }
    setCargando(false);
  }

  return (
    <div style={{ marginTop: 30, padding: 16, background: tema.panel, borderRadius: 6 }}>
      <h3 style={{ marginTop: 0 }}>💬 Pregúntale a la IA sobre este partido</h3>

      <div style={{ maxHeight: 400, overflowY: "auto", marginBottom: 14 }}>
        {mensajes.length === 0 && (
          <p style={{ color: tema.textoSuave, fontSize: 13 }}>
            Ej: "¿Qué opinas de este partido?", "¿Ves valor en el over de goles?", "¿Qué equipo ves más sólido?"
          </p>
        )}
        {mensajes.map((m, i) => (
          <div
            key={i}
            style={{
              marginBottom: 10, padding: 10, borderRadius: 6, fontSize: 13, lineHeight: 1.5,
              background: m.rol === "usuario" ? acento : tema.fondo,
              color: m.rol === "usuario" ? "#fff" : tema.texto,
              maxWidth: "85%",
              marginLeft: m.rol === "usuario" ? "auto" : 0,
            }}
          >
            {m.texto}
          </div>
        ))}
        {cargando && <p style={{ fontSize: 13, color: tema.textoSuave }}>Pensando...</p>}
      </div>

      {error && <p style={{ color: "#e05555", fontSize: 13, marginBottom: 10 }}>{error}</p>}

      <form onSubmit={enviarPregunta} style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          placeholder="Escribe tu pregunta sobre el partido..."
          style={{
            flex: 1, padding: 10, fontSize: 14,
            background: tema.fondo, color: tema.texto, border: `1px solid ${tema.borde}`, borderRadius: 4,
          }}
        />
        <button
          type="submit"
          disabled={cargando}
          style={{
            padding: "10px 18px", fontSize: 14, background: acento, color: "#fff",
            border: "none", borderRadius: 4, cursor: cargando ? "default" : "pointer",
          }}
        >
          Enviar
        </button>
      </form>

      <p style={{ fontSize: 11, color: tema.textoSuave, marginTop: 10 }}>
        Powered by Gemini. La IA solo interpreta los datos ya calculados arriba, no tiene información externa del partido.
      </p>
    </div>
  );
}

export default function Home() {
  const [equipoLocal, setEquipoLocal] = useState(null);
  const [fixturesLocal, setFixturesLocal] = useState([]);
  const [equipoVisitante, setEquipoVisitante] = useState(null);
  const [fixturesVisitante, setFixturesVisitante] = useState([]);
  const [modoOscuro, setModoOscuro] = useState(false);
  const [statsMap, setStatsMap] = useState({});
  const [cargandoPuntuales, setCargandoPuntuales] = useState(false);
  const [progreso, setProgreso] = useState("");
  const [datosPuntualesListos, setDatosPuntualesListos] = useState(false);
  const [esPartidoLiga, setEsPartidoLiga] = useState(true);
  const [equipoForzadoLocal, setEquipoForzadoLocal] = useState(null);
  const [equipoForzadoVisitante, setEquipoForzadoVisitante] = useState(null);

  function seleccionarPartidoDelCalendario(p) {
    setEquipoForzadoLocal({
      team: { id: p.teams.home.id, name: p.teams.home.name, logo: p.teams.home.logo, country: p.league.country },
    });
    setEquipoForzadoVisitante({
      team: { id: p.teams.away.id, name: p.teams.away.name, logo: p.teams.away.logo, country: p.league.country },
    });
  }

  const tema = modoOscuro ? TEMAS.oscuro : TEMAS.claro;

  const h2h =
    equipoLocal?.team && equipoVisitante?.team
      ? calcularHeadToHead(fixturesLocal, fixturesVisitante, equipoLocal.team.id, equipoVisitante.team.id)
      : null;

  const statsGoLocal = equipoLocal?.team ? calcularEstadisticasGoles(fixturesLocal, equipoLocal.team.id) : null;
  const statsGoVisitante = equipoVisitante?.team ? calcularEstadisticasGoles(fixturesVisitante, equipoVisitante.team.id) : null;

  const esFemenino =
    (equipoLocal?.team?.name && /\sW$/.test(equipoLocal.team.name)) ||
    (equipoVisitante?.team?.name && /\sW$/.test(equipoVisitante.team.name)) ||
    fixturesLocal.some((f) => f.league.name.toLowerCase().includes("women")) ||
    fixturesVisitante.some((f) => f.league.name.toLowerCase().includes("women"));

  const acento = esFemenino ? "#ec4899" : "#2563eb";

  const mensajeEstudio =
    equipoLocal?.team && equipoVisitante?.team
      ? `Estudio: ${equipoLocal.team.name} vs ${equipoVisitante.team.name} — historial de temporada 2024 (plan gratis de API-Football)`
      : "Modo prueba: historial de temporada 2024 (plan gratis de API-Football). El calendario de la izquierda sí trae partidos reales.";

  async function cargarDatosPuntuales() {
    if (!equipoLocal?.team || !equipoVisitante?.team) return;

    const idsUnicos = new Map();
    [...fixturesLocal, ...fixturesVisitante].forEach((f) => {
      idsUnicos.set(f.fixture.id, f.teams.home.id);
    });

    const entradas = Array.from(idsUnicos.entries());
    setCargandoPuntuales(true);
    setDatosPuntualesListos(false);
    const nuevoMapa = {};

    for (let i = 0; i < entradas.length; i++) {
      const [fixtureId, homeTeamId] = entradas[i];
      setProgreso(`Cargando ${i + 1}/${entradas.length}...`);
      try {
        const res = await fetch(`/api/estadisticas-partido?fixtureId=${fixtureId}`);
        const data = await res.json();
        if (!data.error) {
          const procesado = procesarEstadisticasPartido(data, homeTeamId);
          if (procesado) nuevoMapa[fixtureId] = procesado;
        }
      } catch (err) {
        // seguimos con el resto aunque uno falle
      }
      await esperar(650);
    }

    setStatsMap(nuevoMapa);
    setCargandoPuntuales(false);
    setDatosPuntualesListos(true);
    setProgreso("");
  }

  return (
    <div style={{ background: tema.fondo, color: tema.texto, minHeight: "100vh" }}>
      <style jsx global>{`
        html, body {
          margin: 0;
          padding: 0;
          background: ${tema.fondo};
        }
      `}</style>
      <div style={{ maxWidth: 1500, margin: "0 auto", padding: 20, fontFamily: "Arial, sans-serif", position: "relative" }}>
        <button
          onClick={() => setModoOscuro(!modoOscuro)}
          style={{
            position: "absolute", top: 20, right: 20, padding: "8px 14px", fontSize: 13,
            background: tema.panel, color: tema.texto, border: `1px solid ${tema.borde}`,
            borderRadius: 20, cursor: "pointer",
          }}
        >
          {modoOscuro ? "☀️ Modo claro" : "🌙 Modo oscuro"}
        </button>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 10 }}>
          <img src="/logo.png" alt="JMCS" width={70} height={70} style={{ marginBottom: 8 }} />
          <h1 style={{ margin: 0 }}>JMCS</h1>
        </div>
        <p style={{ textAlign: "center", color: tema.textoSuave }}>
          Juggernaut Match Calculation System — Selecciona los dos equipos del estudio
        </p>
        <p style={{ textAlign: "center", color: "#c00", fontSize: 13 }}>
          {mensajeEstudio}
        </p>

        <div style={{ display: "flex", gap: 30, marginTop: 20, alignItems: "flex-start" }}>
          <PanelCalendario tema={tema} onSeleccionarPartido={seleccionarPartidoDelCalendario} />

          <div style={{ flex: 1, minWidth: 0 }}>

        {equipoLocal?.team && equipoVisitante?.team && (
          <div style={{ textAlign: "center", margin: "20px 0", fontSize: 18, fontWeight: "bold" }}>
            {equipoLocal.team.name} vs {equipoVisitante.team.name}
          </div>
        )}

        <div style={{ display: "flex", gap: 30, marginTop: 30, flexWrap: "wrap" }}>
          <BuscadorEquipo
            etiqueta="Local"
            tema={tema}
            statsMap={statsMap}
            equipoForzado={equipoForzadoLocal}
            onEquipoCargado={(team, fixtures) => {
              setEquipoLocal(team);
              setFixturesLocal(fixtures || []);
              setDatosPuntualesListos(false);
              setStatsMap({});
            }}
          />
          <BuscadorEquipo
            etiqueta="Visitante"
            tema={tema}
            statsMap={statsMap}
            equipoForzado={equipoForzadoVisitante}
            onEquipoCargado={(team, fixtures) => {
              setEquipoVisitante(team);
              setFixturesVisitante(fixtures || []);
              setDatosPuntualesListos(false);
              setStatsMap({});
            }}
          />
        </div>

        {equipoLocal?.team && equipoVisitante?.team && !datosPuntualesListos && (
          <button
            onClick={cargarDatosPuntuales}
            disabled={cargandoPuntuales}
            style={{
              width: "100%", marginTop: 24, padding: "14px", fontSize: 15, fontWeight: "bold",
              background: cargandoPuntuales ? tema.panel : acento, color: cargandoPuntuales ? tema.texto : "#fff",
              border: "none", borderRadius: 8, cursor: cargandoPuntuales ? "default" : "pointer",
            }}
          >
            {cargandoPuntuales
              ? progreso
              : `📊 Cargar datos puntuales (córners, tarjetas, faltas) — ${equipoLocal.team.name} y ${equipoVisitante.team.name}`}
          </button>
        )}

        {datosPuntualesListos && (
          <p style={{ textAlign: "center", marginTop: 20, color: "#2e9e4f", fontWeight: "bold" }}>
            ✅ Datos puntuales cargados para este encuentro
          </p>
        )}

        <PanelHeadToHead
          h2h={h2h}
          nombreLocal={equipoLocal?.team?.name}
          nombreVisitante={equipoVisitante?.team?.name}
          tema={tema}
          statsMap={statsMap}
          datosPuntualesListos={datosPuntualesListos}
        />

        {equipoLocal?.team && equipoVisitante?.team && (
          <TablaComparativa
            nombreLocal={equipoLocal.team.name}
            nombreVisitante={equipoVisitante.team.name}
            statsLocal={statsGoLocal}
            statsVisitante={statsGoVisitante}
            tema={tema}
          />
        )}

        {datosPuntualesListos && equipoLocal?.team && equipoVisitante?.team && (
          <TablaComparativaPuntual
            nombreLocal={equipoLocal.team.name}
            nombreVisitante={equipoVisitante.team.name}
            fixturesLocal={fixturesLocal}
            fixturesVisitante={fixturesVisitante}
            idLocal={equipoLocal.team.id}
            idVisitante={equipoVisitante.team.id}
            statsMap={statsMap}
            tema={tema}
          />
        )}

        <PanelSemaforo
          equipoLocal={equipoLocal}
          equipoVisitante={equipoVisitante}
          fixturesLocal={fixturesLocal}
          fixturesVisitante={fixturesVisitante}
          h2h={h2h}
          statsMap={statsMap}
          datosPuntualesListos={datosPuntualesListos}
          esPartidoLiga={esPartidoLiga}
          setEsPartidoLiga={setEsPartidoLiga}
          tema={tema}
          acento={acento}
        />

        <ChatIA
          equipoLocal={equipoLocal}
          equipoVisitante={equipoVisitante}
          statsGoLocal={statsGoLocal}
          statsGoVisitante={statsGoVisitante}
          h2h={h2h}
          esPartidoLiga={esPartidoLiga}
          tema={tema}
          acento={acento}
        />
          </div>
        </div>
      </div>
    </div>
  );
}
