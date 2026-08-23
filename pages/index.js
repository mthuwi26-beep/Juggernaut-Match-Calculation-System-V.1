import { useState } from "react";

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

function BuscadorEquipo({ etiqueta, onEquipoCargado, tema, statsMap }) {
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

  const fixturesLocal = fixtures.filter((f) => selectedTeam && f.teams.home.id === selectedTeam.team.id);
  const fixturesVisitante = fixtures.filter((f) => selectedTeam && f.teams.away.id === selectedTeam.team.id);

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
            <SubPanel titulo="Como Local" fixtures={fixturesLocal} teamId={selectedTeam.team.id} statsMap={statsMap} tema={tema} />
            <SubPanel titulo="Como Visitante" fixtures={fixturesVisitante} teamId={selectedTeam.team.id} statsMap={statsMap} tema={tema} />
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

  const tema = modoOscuro ? TEMAS.oscuro : TEMAS.claro;

  const h2h =
    equipoLocal?.team && equipoVisitante?.team
      ? calcularHeadToHead(fixturesLocal, fixturesVisitante, equipoLocal.team.id, equipoVisitante.team.id)
      : null;

  const statsGoLocal = equipoLocal?.team ? calcularEstadisticasGoles(fixturesLocal, equipoLocal.team.id) : null;
  const statsGoVisitante = equipoVisitante?.team ? calcularEstadisticasGoles(fixturesVisitante, equipoVisitante.team.id) : null;

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
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 20, fontFamily: "Arial, sans-serif", position: "relative" }}>
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
          Modo prueba: mostrando temporada 2024 (plan gratis de API-Football)
        </p>

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
            onEquipoCargado={(team, fixtures) => {
              setEquipoVisitante(team);
              setFixturesVisitante(fixtures || []);
              setDatosPuntualesListos(false);
              setStatsMap({});
            }}
          />
        </div>

        {equipoLocal?.team && equipoVisitante?.team && (
          <button
            onClick={cargarDatosPuntuales}
            disabled={cargandoPuntuales}
            style={{
              width: "100%", marginTop: 24, padding: "14px", fontSize: 15, fontWeight: "bold",
              background: cargandoPuntuales ? tema.panel : "#2563eb", color: cargandoPuntuales ? tema.texto : "#fff",
              border: "none", borderRadius: 8, cursor: cargandoPuntuales ? "default" : "pointer",
            }}
          >
            {cargandoPuntuales
              ? progreso
              : datosPuntualesListos
              ? "✅ Datos puntuales cargados — Cargar de nuevo"
              : `📊 Cargar datos puntuales (córners, tarjetas, faltas) — ${equipoLocal.team.name} y ${equipoVisitante.team.name}`}
          </button>
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
      </div>
    </div>
  );
}
