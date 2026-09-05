import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

const TEMAS = {
  claro: {
    fondo: "#FFFFFF",
    texto: "#14251C",
    textoSuave: "#5C7268",
    panel: "#F6F8F6",
    borde: "#DDE4DF",
    encabezadoTabla: "#EFF3EF",
    filaBorde: "#ECF0EC",
  },
  oscuro: {
    fondo: "#0E2A1B",
    texto: "#EAF3EC",
    textoSuave: "#8FC9A8",
    panel: "#153823",
    borde: "#2A5A3A",
    encabezadoTabla: "#1B4229",
    filaBorde: "#1F4A2F",
  },
};

const DORADO = "#D8A93B";
const VERDE_MARCA = "#1E5631";
const ACENTOS_CATEGORIA = {
  local: "#D8A93B",
  visitante: "#C1694F",
  liga: "#3FA79A",
  noLiga: "#8B6FD8",
  forma: "#C1548B",
};

// Convierte un color (rgb(...) o #hex) en una versión tenue para usar de fondo, sin tapar el texto
function colorTenue(color, alpha = 0.16) {
  if (!color) return "transparent";
  if (color.startsWith("rgb")) {
    const nums = color.match(/\d+/g);
    if (!nums || nums.length < 3) return "transparent";
    return `rgba(${nums[0]}, ${nums[1]}, ${nums[2]}, ${alpha})`;
  }
  if (color.startsWith("#")) {
    const hex = color.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return "transparent";
}

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
    posesion: {
      home: extraerStat(statsHome, "Ball Possession"),
      away: extraerStat(statsAway, "Ball Possession"),
    },
  };
}

// Promedio de posesión de balón para un equipo (viene como texto "55%" en la API)
function calcularPosesionPromedio(fixtures, teamId, statsMap) {
  if (!fixtures || fixtures.length === 0) return null;
  let suma = 0, contador = 0;

  fixtures.forEach((f) => {
    const datos = statsMap[f.fixture.id];
    if (!datos || !datos.posesion) return;
    const esLocal = f.teams.home.id === teamId;
    const valorTexto = esLocal ? datos.posesion.home : datos.posesion.away;
    if (valorTexto === null || valorTexto === undefined) return;
    const numero = parseInt(String(valorTexto).replace("%", ""), 10);
    if (!isNaN(numero)) { suma += numero; contador++; }
  });

  return contador ? Math.round(suma / contador) : null;
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

function probabilidad1X2(lambdaLocal, lambdaVisitante) {
  if (lambdaLocal === null || lambdaVisitante === null) return null;
  let pLocal = 0, pEmpate = 0, pVisitante = 0;
  const MAX_GOLES = 10;

  for (let i = 0; i <= MAX_GOLES; i++) {
    for (let j = 0; j <= MAX_GOLES; j++) {
      const p = poissonProb(lambdaLocal, i) * poissonProb(lambdaVisitante, j);
      if (i > j) pLocal += p;
      else if (i === j) pEmpate += p;
      else pVisitante += p;
    }
  }
  return { pLocal, pEmpate, pVisitante };
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

function SubPanel({ titulo, fixtures, teamId, statsMap, tema, acento }) {
  const statsGoles = calcularEstadisticasGoles(fixtures, teamId);
  const statsPuntuales = calcularEstadisticasPuntuales(fixtures, teamId, statsMap);

  return (
    <div style={{ flex: 1, minWidth: 200 }}>
      <h4 style={{ marginBottom: 6, fontSize: 12, color: acento }}>{titulo}</h4>
      {statsGoles ? (
        <div style={{ padding: 10, paddingTop: 8, background: tema.panel, borderRadius: 4, borderTop: `3px solid ${acento}`, fontSize: 12 }}>
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

function BotonFavorito({ equipo, sesion, tema, onPedirLogin }) {
  const [esFavorito, setEsFavorito] = useState(false);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!sesion || !equipo?.team?.id) {
      setEsFavorito(false);
      return;
    }
    let cancelado = false;
    supabase
      .from("favoritos")
      .select("id")
      .eq("user_id", sesion.user.id)
      .eq("team_id", equipo.team.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelado) setEsFavorito(!!data);
      });
    return () => { cancelado = true; };
  }, [sesion, equipo?.team?.id]);

  async function alternar(e) {
    e.stopPropagation();
    if (!sesion) {
      onPedirLogin();
      return;
    }
    setCargando(true);
    if (esFavorito) {
      await supabase.from("favoritos").delete().eq("user_id", sesion.user.id).eq("team_id", equipo.team.id);
      setEsFavorito(false);
    } else {
      await supabase.from("favoritos").insert({
        user_id: sesion.user.id,
        team_id: equipo.team.id,
        team_name: equipo.team.name,
        team_logo: equipo.team.logo,
        team_country: equipo.team.country,
      });
      setEsFavorito(true);
    }
    setCargando(false);
  }

  if (!equipo?.team) return null;

  return (
    <button
      onClick={alternar}
      disabled={cargando}
      aria-label="Favorito"
      style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, lineHeight: 1, display: "inline-flex" }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill={esFavorito ? "#D8A93B" : "none"} stroke={esFavorito ? "#D8A93B" : "#999"} strokeWidth="1.5">
        <path d="M12 2.5l2.9 6.2 6.7.7-5 4.6 1.4 6.7-6-3.5-6 3.5 1.4-6.7-5-4.6 6.7-.7z" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function TarjetaFavorito({ favorito, tema, acento, onQuitar }) {
  const [expandido, setExpandido] = useState(false);
  const [stats, setStats] = useState(null);
  const [cargando, setCargando] = useState(false);

  async function alternarExpandir() {
    if (expandido) {
      setExpandido(false);
      return;
    }
    setExpandido(true);
    if (!stats) {
      setCargando(true);
      try {
        const res = await fetch(`/api/fixtures?teamId=${favorito.team_id}`);
        const data = await res.json();
        if (!data.error) setStats(calcularEstadisticasGoles(data, favorito.team_id));
      } catch (err) {
        // silencioso
      }
      setCargando(false);
    }
  }

  return (
    <div
      onClick={alternarExpandir}
      style={{
        background: tema.panel, borderRadius: 12, border: `2px solid ${acento}`,
        padding: 14, textAlign: "center", cursor: "pointer", width: 170,
      }}
    >
      <img src={favorito.team_logo} alt={favorito.team_name} style={{ width: 70, height: 70, objectFit: "contain", margin: "0 auto 8px" }} />
      <div style={{ fontWeight: "bold", fontSize: 13, marginBottom: 4 }}>{favorito.team_name}</div>
      <div style={{ fontSize: 10, color: tema.textoSuave }}>{favorito.team_country || ""}</div>

      {expandido && (
        <div style={{ marginTop: 10, fontSize: 11, textAlign: "left", borderTop: `1px solid ${tema.borde}`, paddingTop: 8 }}>
          {cargando ? (
            <p style={{ color: tema.textoSuave }}>Cargando...</p>
          ) : stats ? (
            <>
              <FilaStat etiqueta="Récord" valor={`${stats.victorias}-${stats.empates}-${stats.derrotas}`} />
              <FilaStat etiqueta="Goles favor" valor={stats.promedioGolesFavor} />
              <FilaStat etiqueta="% Over 2.5" valor={`${stats.over25Pct}%`} />
              <FilaStat etiqueta="% BTTS" valor={`${stats.bttsPct}%`} />
            </>
          ) : (
            <p style={{ color: tema.textoSuave }}>Sin datos disponibles.</p>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onQuitar(favorito.team_id); }}
            style={{ marginTop: 8, fontSize: 10, background: "transparent", border: "none", color: "#e05555", cursor: "pointer" }}
          >
            Quitar de favoritos
          </button>
        </div>
      )}
    </div>
  );
}

function PanelFavoritosPagina({ sesion, tema, acentoMarca }) {
  const [favoritos, setFavoritos] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    supabase
      .from("favoritos")
      .select("*")
      .eq("user_id", sesion.user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setFavoritos(data || []);
        setCargando(false);
      });
  }, [sesion]);

  async function quitar(teamId) {
    await supabase.from("favoritos").delete().eq("user_id", sesion.user.id).eq("team_id", teamId);
    setFavoritos((prev) => prev.filter((f) => f.team_id !== teamId));
  }

  return (
    <div>
      <h3 style={{ fontSize: 18, marginBottom: 18, textAlign: "center" }}>⭐ Mis favoritos</h3>

      {cargando ? (
        <p style={{ color: tema.textoSuave, textAlign: "center" }}>Cargando...</p>
      ) : favoritos.length === 0 ? (
        <p style={{ color: tema.textoSuave, fontSize: 13, textAlign: "center" }}>
          Aún no tienes equipos favoritos. Toca la estrella junto al nombre de un equipo para guardarlo aquí.
        </p>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center" }}>
          {favoritos.map((f) => (
            <TarjetaFavorito key={f.team_id} favorito={f} tema={tema} acento={acentoMarca} onQuitar={quitar} />
          ))}
        </div>
      )}
    </div>
  );
}

function PanelFavoritos({ sesion, tema, acentoMarca, onCerrar }) {
  const [favoritos, setFavoritos] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    supabase
      .from("favoritos")
      .select("*")
      .eq("user_id", sesion.user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setFavoritos(data || []);
        setCargando(false);
      });
  }, [sesion]);

  async function quitar(teamId) {
    await supabase.from("favoritos").delete().eq("user_id", sesion.user.id).eq("team_id", teamId);
    setFavoritos((prev) => prev.filter((f) => f.team_id !== teamId));
  }

  return (
    <div
      onClick={onCerrar}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: tema.fondo, borderRadius: 12, padding: 24, width: 640, maxWidth: "100%", maxHeight: "80vh", overflowY: "auto", borderTop: `3px solid ${acentoMarca}` }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>⭐ Mis favoritos</h3>
          <button onClick={onCerrar} style={{ background: "transparent", border: "none", fontSize: 18, cursor: "pointer", color: tema.texto }}>✕</button>
        </div>

        {cargando ? (
          <p style={{ color: tema.textoSuave }}>Cargando...</p>
        ) : favoritos.length === 0 ? (
          <p style={{ color: tema.textoSuave, fontSize: 13 }}>
            Aún no tienes equipos favoritos. Toca la estrella ⭐ junto al nombre de un equipo para guardarlo aquí.
          </p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center" }}>
            {favoritos.map((f) => (
              <TarjetaFavorito key={f.team_id} favorito={f} tema={tema} acento={acentoMarca} onQuitar={quitar} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BuscadorEquipo({ etiqueta, onEquipoCargado, tema, statsMap, equipoForzado, colorMarca, sesion, onPedirLogin }) {
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

  async function verPartidos(team, esDelCalendario) {
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
        onEquipoCargado && onEquipoCargado(team, data, !!esDelCalendario);
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
      verPartidos(equipoForzado, true);
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
        <div style={{ marginTop: 16, background: colorTenue(colorMarca), borderRadius: 8, padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <img src={selectedTeam.team.logo} alt={selectedTeam.team.name} width={26} height={26} />
            <strong style={{ color: colorMarca || tema.texto }}>{selectedTeam.team.name}</strong>
            <BotonFavorito equipo={selectedTeam} sesion={sesion} tema={tema} onPedirLogin={onPedirLogin} />
          </div>

          <div className="jmcs-subpaneles-individual" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <SubPanel titulo="Como Local" fixtures={fixturesLocalVenue} teamId={selectedTeam.team.id} statsMap={statsMap} tema={tema} acento={ACENTOS_CATEGORIA.local} />
            <SubPanel titulo="Como Visitante" fixtures={fixturesVisitanteVenue} teamId={selectedTeam.team.id} statsMap={statsMap} tema={tema} acento={ACENTOS_CATEGORIA.visitante} />
            <SubPanel titulo="Liga actual" fixtures={fixturesLigaActual} teamId={selectedTeam.team.id} statsMap={statsMap} tema={tema} acento={ACENTOS_CATEGORIA.liga} />
            <SubPanel titulo="No liga (copas)" fixtures={fixturesNoLiga} teamId={selectedTeam.team.id} statsMap={statsMap} tema={tema} acento={ACENTOS_CATEGORIA.noLiga} />
            <SubPanel titulo="Forma reciente (5)" fixtures={fixturesFormaReciente} teamId={selectedTeam.team.id} statsMap={statsMap} tema={tema} acento={ACENTOS_CATEGORIA.forma} />
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

function FilaMercado({ nombre, lineas, lambda, lambdaAjustado, tema, advertenciaMuestra }) {
  const sinDatos = lambda === null || lambda === undefined;

  return (
    <div style={{ marginBottom: 18 }}>
      <h4 style={{ marginBottom: 8, fontSize: 14 }}>
        {nombre}{" "}
        <span style={{ fontWeight: "normal", color: tema.textoSuave }}>
          {sinDatos ? "— sin datos suficientes" : `— esperado: ${lambda.toFixed(2)}`}
        </span>
      </h4>

      {advertenciaMuestra && !sinDatos && (
        <p style={{ fontSize: 11, color: "#c9a227", margin: "0 0 6px" }}>⚠️ {advertenciaMuestra}</p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {lineas.map((linea) => {
          if (sinDatos) {
            return (
              <div
                key={linea}
                style={{
                  padding: "8px 14px", borderRadius: 6, background: "#ef4444", color: "#fff",
                  fontSize: 13, fontWeight: "bold", minWidth: 90, textAlign: "center", opacity: 0.85,
                }}
              >
                Over {linea}<br />S/D
              </div>
            );
          }
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

      {lambdaAjustado !== null && lambdaAjustado !== undefined && (
        <div style={{ marginTop: 8 }}>
          <p style={{ fontSize: 11, color: tema.textoSuave, margin: "0 0 6px" }}>
            🌦️ Con estimación de clima — esperado: {lambdaAjustado.toFixed(2)}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {lineas.map((linea) => {
              const p = probabilidadOver(lambdaAjustado, linea);
              const { color } = colorSemaforo(p);
              return (
                <div
                  key={linea}
                  style={{
                    padding: "6px 12px", borderRadius: 6, background: color, color: "#fff",
                    fontSize: 12, fontWeight: "bold", minWidth: 80, textAlign: "center", opacity: 0.85,
                  }}
                >
                  Over {linea}<br />{Math.round(p * 100)}%
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PanelSemaforo({ equipoLocal, equipoVisitante, fixturesLocal, fixturesVisitante, h2h, statsMap, datosPuntualesListos, esPartidoLiga, setEsPartidoLiga, tema, acento, climaAjuste, coberturaPuntuales }) {
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
  const lambdaGolesTotalAjustado = climaAjuste?.activo && lambdaGolesTotal !== null ? lambdaGolesTotal * climaAjuste.factor : null;

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
  const prob1X2 = probabilidad1X2(lambdaGolesLocal, lambdaGolesVisitante);

  let advertenciaMuestra = null;
  if (coberturaPuntuales && coberturaPuntuales.total > 0) {
    const proporcion = coberturaPuntuales.exitos / coberturaPuntuales.total;
    if (coberturaPuntuales.exitos < 5 || proporcion < 0.5) {
      advertenciaMuestra = `Muestra insuficiente (${coberturaPuntuales.exitos}/${coberturaPuntuales.total} partidos con dato real) — tómalo con cautela.`;
    }
  }

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

      {prob1X2 && (
        <div style={{ marginBottom: 18 }}>
          <h4 style={{ marginBottom: 8, fontSize: 14 }}>Ganador del partido</h4>
          <p style={{ fontSize: 10, color: tema.textoSuave, margin: "0 0 8px" }}>
            Aproximación estándar basada en el mismo modelo de goles esperados — no es un modelo profesional de casa de apuestas.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {[
              { etiqueta: equipoLocal.team.name, prob: prob1X2.pLocal },
              { etiqueta: "Empate", prob: prob1X2.pEmpate },
              { etiqueta: equipoVisitante.team.name, prob: prob1X2.pVisitante },
            ].map((item) => {
              const { color } = colorSemaforo(item.prob);
              return (
                <div
                  key={item.etiqueta}
                  style={{
                    padding: "8px 14px", borderRadius: 6, background: color, color: "#fff",
                    fontSize: 13, fontWeight: "bold", minWidth: 110, textAlign: "center",
                  }}
                >
                  {item.etiqueta}<br />{Math.round(item.prob * 100)}%
                </div>
              );
            })}
          </div>
        </div>
      )}

      <FilaMercado nombre="Goles totales del partido" lineas={LINEAS_MERCADOS.goles} lambda={lambdaGolesTotal} lambdaAjustado={lambdaGolesTotalAjustado} tema={tema} />

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

      <FilaMercado nombre="Córners totales del partido" lineas={LINEAS_MERCADOS.corners} lambda={lambdaCornersTotal} tema={tema} advertenciaMuestra={advertenciaMuestra} />
      <FilaMercado nombre="Tarjetas amarillas totales" lineas={LINEAS_MERCADOS.amarillas} lambda={lambdaAmarillasTotal} tema={tema} advertenciaMuestra={advertenciaMuestra} />
      <FilaMercado nombre="Faltas totales del partido" lineas={LINEAS_MERCADOS.faltas} lambda={lambdaFaltasTotal} tema={tema} advertenciaMuestra={advertenciaMuestra} />

      {!datosPuntualesListos && (
        <p style={{ color: tema.textoSuave, fontSize: 12, marginTop: -8, marginBottom: 18 }}>
          ℹ️ Carga los "datos puntuales" arriba para completar córners, tarjetas y faltas con datos reales.
        </p>
      )}

      <p style={{ fontSize: 11, color: tema.textoSuave, marginTop: 16 }}>
        Esto es un modelo estadístico de tendencias, no una certeza. No contempla lesiones, sanciones, clima ni decisiones arbitrales puntuales.
      </p>
    </div>
  );
}

function PanelCalendario({ tema, onSeleccionarPartido, acentoMarca }) {
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [partidos, setPartidos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [buscado, setBuscado] = useState(false);
  const [seleccionado, setSeleccionado] = useState(null);

  async function buscarPartidos() {
    setLoading(true);
    setError("");
    setPartidos([]);
    setSeleccionado(null);
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

  function elegir(p) {
    setSeleccionado(p.fixture.id);
    onSeleccionarPartido(p);
  }

  return (
    <div style={{ background: tema.panel, borderRadius: 6, borderTop: `3px solid ${acentoMarca}`, padding: 16 }}>
      <h3 style={{ fontSize: 13, marginTop: 0, marginBottom: 14, color: acentoMarca }}>📅 Calendario de partidos</h3>

      <input
        type="date"
        value={fecha}
        onChange={(e) => setFecha(e.target.value)}
        style={{
          width: "100%", padding: 9, marginBottom: 8, fontSize: 13,
          background: tema.fondo, color: tema.texto, border: `1px solid ${tema.borde}`, borderRadius: 4,
        }}
      />
      <button
        onClick={buscarPartidos}
        disabled={loading}
        style={{
          width: "100%", padding: 9, marginBottom: 14, fontSize: 12,
          background: acentoMarca, color: "#1B1200", border: "none",
          borderRadius: 4, cursor: "pointer", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em",
        }}
      >
        {loading ? "Buscando..." : "Ver partidos"}
      </button>

      {error && (
        <p style={{ fontSize: 11, color: "#e08a8a", lineHeight: 1.4 }}>{error}</p>
      )}
      {buscado && !loading && !error && partidos.length === 0 && (
        <p style={{ fontSize: 12, color: tema.textoSuave }}>No hay partidos para esta fecha.</p>
      )}

      <div style={{ maxHeight: 600, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
        {partidos.map((p) => {
          const activo = seleccionado === p.fixture.id;
          return (
            <div
              key={p.fixture.id}
              onClick={() => elegir(p)}
              style={{
                padding: "8px 10px", borderRadius: 4, cursor: "pointer", fontSize: 12,
                background: activo ? acentoMarca : tema.fondo,
                color: activo ? "#1B1200" : tema.texto,
                border: `1px solid ${activo ? acentoMarca : tema.borde}`,
                transition: "background 0.15s",
              }}
            >
              <div style={{ color: activo ? "#1B1200" : tema.textoSuave, marginBottom: 5, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {p.league.name}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <img src={p.teams.home.logo} alt="" width={16} height={16} />
                <span>{p.teams.home.name}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <img src={p.teams.away.logo} alt="" width={16} height={16} />
                <span>{p.teams.away.name}</span>
              </div>
            </div>
          );
        })}
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

function ChatIA({ equipoLocal, equipoVisitante, statsGoLocal, statsGoVisitante, h2h, esPartidoLiga, tema, acento, onCerrar }) {
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
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h3 style={{ margin: 0, fontSize: 13 }}>💬 IA sobre este partido</h3>
        {onCerrar && (
          <button onClick={onCerrar} style={{ background: "transparent", border: "none", fontSize: 18, cursor: "pointer", color: tema.texto }}>
            ✕
          </button>
        )}
      </div>

      <div style={{ maxHeight: 350, overflowY: "auto", marginBottom: 14, marginTop: 10 }}>
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

function PanelEquipoLateral({ equipo, stats, posesion, fixtures, tema, acento, sesion, onPedirLogin }) {
  if (!equipo?.team) return null;

  const ultimos5 = (fixtures || []).slice(0, 5);

  return (
    <div style={{ background: colorTenue(acento), borderTop: `3px solid ${acento}`, borderRadius: 6, padding: 16, textAlign: "center" }}>
      <img src={equipo.team.logo} alt={equipo.team.name} style={{ width: "100%", maxWidth: 130, height: "auto", margin: "0 auto 10px" }} />
      <h4 style={{ fontSize: 13, margin: "0 0 12px", color: acento, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        {equipo.team.name}
        <BotonFavorito equipo={equipo} sesion={sesion} tema={tema} onPedirLogin={onPedirLogin} />
      </h4>

      {stats ? (
        <>
          <div style={{ fontSize: 12, textAlign: "left" }}>
            <FilaStat etiqueta="Récord" valor={`${stats.victorias}-${stats.empates}-${stats.derrotas}`} />
            <FilaStat etiqueta="Goles favor" valor={stats.promedioGolesFavor} />
            <FilaStat etiqueta="Goles contra" valor={stats.promedioGolesContra} />
            <FilaStat etiqueta="% Over 2.5" valor={`${stats.over25Pct}%`} />
            <FilaStat etiqueta="% BTTS" valor={`${stats.bttsPct}%`} />
            {posesion !== null && posesion !== undefined && (
              <>
                <div style={{ borderTop: `1px solid ${tema.borde}`, margin: "6px 0" }} />
                <FilaStat etiqueta="Posesión (prom.)" valor={`${posesion}%`} />
              </>
            )}
          </div>

          {ultimos5.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: tema.textoSuave, marginBottom: 6, textAlign: "left" }}>
                Últimos 5
              </p>
              <div style={{ display: "flex", gap: 4 }}>
                {ultimos5.map((f) => {
                  const esLocal = f.teams.home.id === equipo.team.id;
                  const gf = esLocal ? f.goals.home : f.goals.away;
                  const gc = esLocal ? f.goals.away : f.goals.home;
                  const letra = gf > gc ? "V" : gf === gc ? "E" : "D";
                  const color = gf > gc ? "#2e9e4f" : gf === gc ? "#c9a227" : "#c94c4c";
                  return (
                    <div
                      key={f.fixture.id}
                      title={`${f.teams.home.name} ${f.goals.home}-${f.goals.away} ${f.teams.away.name}`}
                      style={{
                        width: 22, height: 22, borderRadius: "50%", background: color, color: "#fff",
                        fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      {letra}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <p style={{ color: tema.textoSuave, fontSize: 11 }}>Sin datos aún.</p>
      )}
    </div>
  );
}

// Extrae el color dominante de un escudo (logo) de equipo, con respaldo si falla
function useColorDeEscudo(logoUrl, colorRespaldo) {
  const [color, setColor] = useState(colorRespaldo);

  useEffect(() => {
    if (!logoUrl) {
      setColor(colorRespaldo);
      return;
    }

    let cancelado = false;
    const img = new window.Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const tam = 40;
        canvas.width = tam;
        canvas.height = tam;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, tam, tam);
        const datos = ctx.getImageData(0, 0, tam, tam).data;

        let sumaR = 0, sumaG = 0, sumaB = 0, contador = 0;
        for (let i = 0; i < datos.length; i += 4) {
          const [r, g, b, a] = [datos[i], datos[i + 1], datos[i + 2], datos[i + 3]];
          if (a < 100) continue; // píxel transparente
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          const saturacion = max === 0 ? 0 : (max - min) / max;
          const brillo = (r + g + b) / 3;
          // Ignoramos blancos/grises/negros casi puros (poco útiles como "color de marca")
          if (saturacion < 0.25 || brillo > 235 || brillo < 25) continue;
          sumaR += r; sumaG += g; sumaB += b; contador++;
        }

        if (cancelado) return;

        if (contador < 5) {
          setColor(colorRespaldo);
          return;
        }

        const r = Math.round(sumaR / contador);
        const g = Math.round(sumaG / contador);
        const b = Math.round(sumaB / contador);
        const hex = "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
        setColor(hex);
      } catch (err) {
        // Canvas "tainted" por CORS u otro error: usamos el color de respaldo
        if (!cancelado) setColor(colorRespaldo);
      }
    };

    img.onerror = () => {
      if (!cancelado) setColor(colorRespaldo);
    };

    img.src = logoUrl;

    return () => { cancelado = true; };
  }, [logoUrl, colorRespaldo]);

  return color;
}

function dividirPorCategorias(fixtures, teamId) {
  return {
    local: fixtures.filter((f) => f.teams.home.id === teamId),
    visitante: fixtures.filter((f) => f.teams.away.id === teamId),
    liga: fixtures.filter((f) => esLiga(f)),
    noLiga: fixtures.filter((f) => !esLiga(f)),
    forma: fixtures.slice(0, 5),
  };
}

function FilaEspejo({ etiqueta, valorLocal, valorVisitante, tema }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: `1px solid ${tema.filaBorde}` }}>
      <div style={{ textAlign: "right", fontSize: 13 }}>{valorLocal}</div>
      <div style={{ fontSize: 10, color: tema.textoSuave, textAlign: "center", minWidth: 90 }}>{etiqueta}</div>
      <div style={{ textAlign: "left", fontSize: 13 }}>{valorVisitante}</div>
    </div>
  );
}

function CategoriaEspejo({ titulo, fixturesLocal, fixturesVisitante, idLocal, idVisitante, statsMap, tema, acento }) {
  const statsL = calcularEstadisticasGoles(fixturesLocal, idLocal);
  const statsV = calcularEstadisticasGoles(fixturesVisitante, idVisitante);
  const puntualesL = calcularEstadisticasPuntuales(fixturesLocal, idLocal, statsMap);
  const puntualesV = calcularEstadisticasPuntuales(fixturesVisitante, idVisitante, statsMap);

  if (!statsL && !statsV) return null;

  return (
    <div style={{ background: tema.panel, borderRadius: 6, borderTop: `3px solid ${acento}`, padding: "12px 16px", marginBottom: 14 }}>
      <h4 style={{ textAlign: "center", margin: "0 0 8px", fontSize: 12, color: acento }}>{titulo}</h4>
      <FilaEspejo etiqueta="Récord" valorLocal={statsL ? `${statsL.victorias}-${statsL.empates}-${statsL.derrotas}` : "—"} valorVisitante={statsV ? `${statsV.victorias}-${statsV.empates}-${statsV.derrotas}` : "—"} tema={tema} />
      <FilaEspejo etiqueta="Goles a favor" valorLocal={statsL?.promedioGolesFavor ?? "—"} valorVisitante={statsV?.promedioGolesFavor ?? "—"} tema={tema} />
      <FilaEspejo etiqueta="Goles en contra" valorLocal={statsL?.promedioGolesContra ?? "—"} valorVisitante={statsV?.promedioGolesContra ?? "—"} tema={tema} />
      <FilaEspejo etiqueta="% Over 2.5" valorLocal={statsL ? `${statsL.over25Pct}%` : "—"} valorVisitante={statsV ? `${statsV.over25Pct}%` : "—"} tema={tema} />
      <FilaEspejo etiqueta="% BTTS" valorLocal={statsL ? `${statsL.bttsPct}%` : "—"} valorVisitante={statsV ? `${statsV.bttsPct}%` : "—"} tema={tema} />
      {(puntualesL || puntualesV) && (
        <>
          <FilaEspejo etiqueta="Córners" valorLocal={puntualesL?.promedioCorners ?? "—"} valorVisitante={puntualesV?.promedioCorners ?? "—"} tema={tema} />
          <FilaEspejo etiqueta="Tarjetas am." valorLocal={puntualesL?.promedioAmarillas ?? "—"} valorVisitante={puntualesV?.promedioAmarillas ?? "—"} tema={tema} />
          <FilaEspejo etiqueta="Faltas" valorLocal={puntualesL?.promedioFaltas ?? "—"} valorVisitante={puntualesV?.promedioFaltas ?? "—"} tema={tema} />
        </>
      )}
    </div>
  );
}

function SeccionEspejo({ equipoLocal, equipoVisitante, fixturesLocal, fixturesVisitante, statsMap, tema }) {
  if (!equipoLocal?.team || !equipoVisitante?.team) return null;

  const catLocal = dividirPorCategorias(fixturesLocal, equipoLocal.team.id);
  const catVisitante = dividirPorCategorias(fixturesVisitante, equipoVisitante.team.id);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: 13, fontWeight: "bold" }}>
        <span>{equipoLocal.team.name}</span>
        <span>{equipoVisitante.team.name}</span>
      </div>

      <CategoriaEspejo titulo="Como Local / Como Visitante" fixturesLocal={catLocal.local} fixturesVisitante={catVisitante.visitante} idLocal={equipoLocal.team.id} idVisitante={equipoVisitante.team.id} statsMap={statsMap} tema={tema} acento={ACENTOS_CATEGORIA.local} />
      <CategoriaEspejo titulo="Liga actual" fixturesLocal={catLocal.liga} fixturesVisitante={catVisitante.liga} idLocal={equipoLocal.team.id} idVisitante={equipoVisitante.team.id} statsMap={statsMap} tema={tema} acento={ACENTOS_CATEGORIA.liga} />
      <CategoriaEspejo titulo="No liga (copas)" fixturesLocal={catLocal.noLiga} fixturesVisitante={catVisitante.noLiga} idLocal={equipoLocal.team.id} idVisitante={equipoVisitante.team.id} statsMap={statsMap} tema={tema} acento={ACENTOS_CATEGORIA.noLiga} />
      <CategoriaEspejo titulo="Forma reciente (5)" fixturesLocal={catLocal.forma} fixturesVisitante={catVisitante.forma} idLocal={equipoLocal.team.id} idVisitante={equipoVisitante.team.id} statsMap={statsMap} tema={tema} acento={ACENTOS_CATEGORIA.forma} />
    </div>
  );
}

function DatosGeneralesEncuentro({ partidoCalendario, climaData, cargandoClima, estimarClima, setEstimarClima, tema, acentoMarca }) {
  if (!partidoCalendario) return null;

  const arbitro = partidoCalendario.fixture?.referee;
  const venue = partidoCalendario.fixture?.venue;

  if (!arbitro && !venue && !climaData && !cargandoClima) return null;

  return (
    <div style={{ background: tema.panel, borderRadius: 6, borderTop: `3px solid ${acentoMarca}`, padding: 14, marginBottom: 18, fontSize: 12 }}>
      <h4 style={{ margin: "0 0 8px", fontSize: 11, color: acentoMarca }}>📋 Datos generales del encuentro</h4>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {venue?.name && <div style={{ minWidth: 0, wordBreak: "break-word" }}>🏟️ {venue.name}{venue.city ? `, ${venue.city}` : ""}</div>}
        <div style={{ minWidth: 0, wordBreak: "break-word" }}>🧑‍⚖️ Árbitro: {arbitro || "Sin datos"}</div>
        {cargandoClima && <div style={{ color: tema.textoSuave }}>Cargando clima...</div>}
        {climaData && (
          <>
            <div style={{ minWidth: 0 }}>🌡️ {climaData.temperaturaMin}° – {climaData.temperaturaMax}°C</div>
            <div style={{ minWidth: 0 }}>🌧️ {climaData.precipitacionMm} mm lluvia</div>
            <div style={{ minWidth: 0 }}>💨 Viento máx. {climaData.vientoMaxKmh} km/h</div>
          </>
        )}
      </div>

      {climaData && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, cursor: "pointer", fontSize: 12 }}>
          <input type="checkbox" checked={estimarClima} onChange={(e) => setEstimarClima(e.target.checked)} style={{ accentColor: acentoMarca }} />
          Incluir estimación de impacto del clima en el semáforo (experimental)
        </label>
      )}
    </div>
  );
}

function AuthModal({ tema, acentoMarca, onCerrar, modoInicial }) {
  const [modo, setModo] = useState(modoInicial || "login"); // "login" | "registro" | "magico"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [cargandoGoogle, setCargandoGoogle] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  async function manejarSubmit(e) {
    e.preventDefault();
    setError("");
    setMensaje("");
    setCargando(true);

    try {
      if (modo === "registro") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMensaje("✅ ¡Cuenta creada! Verifica tu cuenta desde tu bandeja de entrada (revisa spam si no la ves) para poder iniciar sesión.");
      } else if (modo === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onCerrar();
      } else if (modo === "magico") {
        const { error } = await supabase.auth.signInWithOtp({ email });
        if (error) throw error;
        setMensaje("✅ Te enviamos un enlace mágico a tu correo. Ábrelo desde este mismo dispositivo.");
      }
    } catch (err) {
      setError(err.message || "Ocurrió un error");
    }
    setCargando(false);
  }

  async function entrarConGoogle() {
    setError("");
    setCargandoGoogle(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
      });
      if (error) throw error;
    } catch (err) {
      setError(err.message || "No se pudo iniciar sesión con Google");
      setCargandoGoogle(false);
    }
  }

  return (
    <div
      onClick={onCerrar}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: tema.panel, borderRadius: 12, padding: 28, width: 380, maxWidth: "100%", position: "relative", borderTop: `3px solid ${acentoMarca}` }}
      >
        <button
          onClick={onCerrar}
          style={{ position: "absolute", top: 14, right: 14, background: "transparent", border: "none", fontSize: 18, cursor: "pointer", color: tema.texto }}
        >
          ✕
        </button>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 18 }}>
          <img src="/logo.png" alt="JMCS" width={48} height={48} style={{ marginBottom: 8 }} />
          <h3 style={{ margin: 0, fontSize: 17 }}>
            {modo === "registro" ? "Crea tu cuenta en JMCS" : modo === "magico" ? "Enlace mágico" : "Bienvenido de nuevo a JMCS"}
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: tema.textoSuave, textAlign: "center" }}>
            {modo === "registro"
              ? "Guarda tus estudios, favoritos y tu historial de aciertos."
              : modo === "magico"
              ? "Te mandamos un enlace, sin necesidad de contraseña."
              : "Accede a tus estudios, favoritos e historial."}
          </p>
        </div>

        <button
          onClick={entrarConGoogle}
          disabled={cargandoGoogle}
          style={{
            width: "100%", padding: 10, fontSize: 13, marginBottom: 14, display: "flex", alignItems: "center",
            justifyContent: "center", gap: 8, background: tema.fondo, color: tema.texto,
            border: `1px solid ${tema.borde}`, borderRadius: 6, cursor: cargandoGoogle ? "default" : "pointer", fontWeight: 600,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.9 32.6 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.3 0 10.1-2 13.7-5.3l-6.3-5.3C29.4 35.4 26.8 36 24 36c-5.4 0-9.9-3.4-11.3-8.1l-6.5 5C9.6 39.6 16.3 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1 3-3.2 5.4-6 6.9l6.3 5.3C39.7 37.1 44 31.3 44 24c0-1.3-.1-2.7-.4-3.5z" />
          </svg>
          {cargandoGoogle ? "Conectando..." : "Continuar con Google"}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 14px" }}>
          <div style={{ flex: 1, borderTop: `1px solid ${tema.borde}` }} />
          <span style={{ fontSize: 10, color: tema.textoSuave }}>o con tu correo</span>
          <div style={{ flex: 1, borderTop: `1px solid ${tema.borde}` }} />
        </div>

        <form onSubmit={manejarSubmit}>
          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: "100%", padding: 10, marginBottom: 10, fontSize: 14, background: tema.fondo, color: tema.texto, border: `1px solid ${tema.borde}`, borderRadius: 4 }}
          />

          {modo !== "magico" && (
            <div style={{ position: "relative", marginBottom: 10 }}>
              <input
                type={mostrarPassword ? "text" : "password"}
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                style={{ width: "100%", padding: "10px 40px 10px 10px", fontSize: 14, background: tema.fondo, color: tema.texto, border: `1px solid ${tema.borde}`, borderRadius: 4 }}
              />
              <button
                type="button"
                onClick={() => setMostrarPassword(!mostrarPassword)}
                aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                style={{
                  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  background: "transparent", border: "none", cursor: "pointer", fontSize: 15, color: tema.textoSuave,
                }}
              >
                {mostrarPassword ? "🙈" : "👁️"}
              </button>
            </div>
          )}

          {error && <p style={{ color: "#e05555", fontSize: 12, marginBottom: 10 }}>{error}</p>}
          {mensaje && <p style={{ color: "#2e9e4f", fontSize: 12, marginBottom: 10, lineHeight: 1.4 }}>{mensaje}</p>}

          <button
            type="submit"
            disabled={cargando}
            style={{ width: "100%", padding: 10, fontSize: 14, background: acentoMarca, color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: "bold" }}
          >
            {cargando ? "Cargando..." : modo === "registro" ? "Crear cuenta" : modo === "magico" ? "Enviar enlace" : "Entrar"}
          </button>
        </form>

        <div style={{ marginTop: 14, fontSize: 12, textAlign: "center", color: tema.textoSuave }}>
          {modo === "login" && (
            <>
              <div style={{ marginBottom: 6 }}>
                ¿No tienes cuenta?{" "}
                <span onClick={() => { setModo("registro"); setError(""); setMensaje(""); }} style={{ color: acentoMarca, cursor: "pointer", fontWeight: "bold" }}>
                  Regístrate
                </span>
              </div>
              <div>
                <span onClick={() => { setModo("magico"); setError(""); setMensaje(""); }} style={{ color: acentoMarca, cursor: "pointer" }}>
                  O entra con un enlace mágico (sin contraseña)
                </span>
              </div>
            </>
          )}
          {modo === "registro" && (
            <span onClick={() => { setModo("login"); setError(""); setMensaje(""); }} style={{ color: acentoMarca, cursor: "pointer" }}>
              ¿Ya tienes cuenta? Inicia sesión
            </span>
          )}
          {modo === "magico" && (
            <span onClick={() => { setModo("login"); setError(""); setMensaje(""); }} style={{ color: acentoMarca, cursor: "pointer" }}>
              Volver a entrar con contraseña
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function TarjetaPartidoInicio({ p, tema, acentoMarca, onClick }) {
  const fecha = new Date(p.fixture.date);
  const horaTexto = fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const fechaTexto = fecha.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
        padding: "16px 14px", background: tema.panel, borderRadius: 8, cursor: "pointer",
        borderTop: `3px solid ${acentoMarca}`,
      }}
    >
      {/* Extremo izquierdo: equipo Local */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 0 }}>
        <img src={p.teams.home.logo} alt="" width={36} height={36} />
        <span style={{ fontSize: 12, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
          {p.teams.home.name}
        </span>
      </div>

      {/* Centro: datos básicos */}
      <div style={{ flexShrink: 0, textAlign: "center", padding: "0 6px" }}>
        <div style={{ fontSize: 9, color: tema.textoSuave, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 4 }}>
          {p.league.name}
        </div>
        <div style={{ fontSize: 13, fontWeight: "bold", color: acentoMarca }}>VS</div>
        <div style={{ fontSize: 10, color: tema.textoSuave, marginTop: 4 }}>{fechaTexto} · {horaTexto}</div>
      </div>

      {/* Extremo derecho: equipo Visitante */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 0 }}>
        <img src={p.teams.away.logo} alt="" width={36} height={36} />
        <span style={{ fontSize: 12, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
          {p.teams.away.name}
        </span>
      </div>
    </div>
  );
}

function ListaPartidosInicio({ tema, acentoMarca, onTocarPartido }) {
  const [partidos, setPartidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const hoy = new Date().toISOString().split("T")[0];
    setLoading(true);
    fetch(`/api/partidos-por-fecha?date=${hoy}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setPartidos(data);
      })
      .catch(() => setError("No se pudieron cargar los partidos"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h3 style={{ fontSize: 15, marginBottom: 14 }}>⚽ Partidos de hoy</h3>
      {loading && <p style={{ color: tema.textoSuave, fontSize: 13 }}>Cargando partidos...</p>}
      {error && <p style={{ color: "#e05555", fontSize: 13 }}>{error}</p>}
      {!loading && !error && partidos.length === 0 && (
        <p style={{ color: tema.textoSuave, fontSize: 13 }}>No hay partidos disponibles para hoy en este plan.</p>
      )}
      <div className="jmcs-partidos-grid">
      {partidos.map((p) => (
        <TarjetaPartidoInicio key={p.fixture.id} p={p} tema={tema} acentoMarca={acentoMarca} onClick={() => onTocarPartido(p)} />
      ))}
      </div>
    </div>
  );
}

function VistaInicio({ tema, acentoMarca, sesion, onPedirLogin, statsMap, equipoInicio, fixturesInicio, colorMarcaInicio, onSeleccionarPartido, partidoTocado }) {
  return (
    <div>
      {equipoInicio?.team && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ background: colorTenue(colorMarcaInicio), borderTop: `3px solid ${colorMarcaInicio}`, borderRadius: 8, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <img src={equipoInicio.team.logo} alt={equipoInicio.team.name} width={30} height={30} />
              <strong style={{ color: colorMarcaInicio, fontSize: 16 }}>{equipoInicio.team.name}</strong>
              <BotonFavorito equipo={equipoInicio.team} sesion={sesion} tema={tema} onPedirLogin={onPedirLogin} />
            </div>
            {(() => {
              const stats = calcularEstadisticasGoles(fixturesInicio, equipoInicio.team.id);
              if (!stats) return <p style={{ color: tema.textoSuave, fontSize: 12 }}>Sin datos.</p>;
              return (
                <div style={{ fontSize: 13 }}>
                  <FilaStat etiqueta="Récord (V-E-D)" valor={`${stats.victorias}-${stats.empates}-${stats.derrotas}`} />
                  <FilaStat etiqueta="Goles a favor (prom.)" valor={stats.promedioGolesFavor} />
                  <FilaStat etiqueta="Goles en contra (prom.)" valor={stats.promedioGolesContra} />
                  <FilaStat etiqueta="% Over 2.5" valor={`${stats.over25Pct}%`} />
                  <FilaStat etiqueta="% BTTS" valor={`${stats.bttsPct}%`} />
                </div>
              );
            })()}
          </div>
        </div>
      )}

      <ListaPartidosInicio tema={tema} acentoMarca={acentoMarca} onTocarPartido={onSeleccionarPartido} />
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
  const [resumenCarga, setResumenCarga] = useState("");
  const [coberturaPuntuales, setCoberturaPuntuales] = useState(null);
  const [esPartidoLiga, setEsPartidoLiga] = useState(true);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [idiomaAbierto, setIdiomaAbierto] = useState(false);
  const [idioma, setIdioma] = useState("es");
  const [notaProximamente, setNotaProximamente] = useState(false);
  const [tarjetaActivaMovil, setTarjetaActivaMovil] = useState("local");
  const [toqueInicioX, setToqueInicioX] = useState(null);
  const [chatAbierto, setChatAbierto] = useState(false);
  const [sesion, setSesion] = useState(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [authModalAbierto, setAuthModalAbierto] = useState(false);
  const [authModalModo, setAuthModalModo] = useState("login");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session);
      setCargandoSesion(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nuevaSesion) => {
      setSesion(nuevaSesion);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  function abrirLogin() {
    setAuthModalModo("login");
    setAuthModalAbierto(true);
  }

  function abrirRegistro() {
    setAuthModalModo("registro");
    setAuthModalAbierto(true);
  }

  async function cerrarSesion() {
    await supabase.auth.signOut();
    setMenuAbierto(false);
  }

  function mostrarProximamente() {
    setNotaProximamente(true);
    setMenuAbierto(false);
    setTimeout(() => setNotaProximamente(false), 2500);
  }

  // Los accesos del menú piden cuenta si no hay sesión; si ya hay sesión,
  // por ahora siguen siendo "próximamente" porque la función en sí (favoritos,
  // historial de aciertos, etc.) todavía no está construida.
  function accederOPedirCuenta(itemMenu) {
    if (!sesion) {
      setMenuAbierto(false);
      abrirLogin();
    } else if (itemMenu === "Favoritos") {
      setMenuAbierto(false);
      setVistaActual("favoritos");
    } else {
      mostrarProximamente();
    }
  }

  const [favoritosPanelAbierto, setFavoritosPanelAbierto] = useState(false);
  const [vistaActual, setVistaActual] = useState("inicio"); // "inicio" | "estudio" | "favoritos"
  const [busquedaInicio, setBusquedaInicio] = useState("");
  const [equipoInicio, setEquipoInicio] = useState(null);
  const [fixturesInicio, setFixturesInicio] = useState([]);
  const [buscandoInicio, setBuscandoInicio] = useState(false);

  const [equipoForzadoLocal, setEquipoForzadoLocal] = useState(null);
  const [equipoForzadoVisitante, setEquipoForzadoVisitante] = useState(null);
  const [partidoCalendario, setPartidoCalendario] = useState(null);
  const [climaData, setClimaData] = useState(null);
  const [cargandoClima, setCargandoClima] = useState(false);
  const [estimarClima, setEstimarClima] = useState(false);

  function seleccionarPartidoDelCalendario(p) {
    setEquipoForzadoLocal({
      team: { id: p.teams.home.id, name: p.teams.home.name, logo: p.teams.home.logo, country: p.league.country },
    });
    setEquipoForzadoVisitante({
      team: { id: p.teams.away.id, name: p.teams.away.name, logo: p.teams.away.logo, country: p.league.country },
    });
    setPartidoCalendario(p);
  }

  useEffect(() => {
    if (!partidoCalendario?.fixture?.venue?.city || !partidoCalendario?.fixture?.date) {
      setClimaData(null);
      return;
    }
    const ciudad = partidoCalendario.fixture.venue.city;
    const fecha = partidoCalendario.fixture.date.split("T")[0];

    setCargandoClima(true);
    fetch(`/api/clima?ciudad=${encodeURIComponent(ciudad)}&fecha=${fecha}`)
      .then((r) => r.json())
      .then((data) => setClimaData(data.error ? null : data))
      .catch(() => setClimaData(null))
      .finally(() => setCargandoClima(false));
  }, [partidoCalendario]);

  // Si el usuario eligió ambos equipos a mano (no desde el calendario), buscamos
  // el enfrentamiento real más cercano en fecha entre ellos, para poder mostrar
  // árbitro/clima igual que si lo hubiera elegido del calendario.
  useEffect(() => {
    if (partidoCalendario) return; // ya hay uno (del calendario o ya detectado)
    if (!equipoLocal?.team?.id || !equipoVisitante?.team?.id) return;

    let cancelado = false;
    fetch(`/api/enfrentamiento-cercano?team1=${equipoLocal.team.id}&team2=${equipoVisitante.team.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelado && data.partido) {
          setPartidoCalendario(data.partido);
        }
      })
      .catch(() => {});

    return () => { cancelado = true; };
  }, [equipoLocal?.team?.id, equipoVisitante?.team?.id, partidoCalendario]);

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
    setCoberturaPuntuales(null);
    const nuevoMapa = {};
    let exitos = 0;

    for (let i = 0; i < entradas.length; i++) {
      const [fixtureId, homeTeamId] = entradas[i];
      setProgreso(`Cargando ${i + 1}/${entradas.length}...`);
      try {
        const res = await fetch(`/api/estadisticas-partido?fixtureId=${fixtureId}`);
        const data = await res.json();
        if (!data.error) {
          const procesado = procesarEstadisticasPartido(data, homeTeamId);
          if (procesado) {
            nuevoMapa[fixtureId] = procesado;
            exitos++;
          }
        }
      } catch (err) {
        // seguimos con el resto aunque uno falle
      }
      await esperar(650);
    }

    setStatsMap(nuevoMapa);
    setCargandoPuntuales(false);
    setDatosPuntualesListos(true);
    setResumenCarga(`${exitos}/${entradas.length} partidos con datos de córners/tarjetas/faltas`);
    setCoberturaPuntuales({ exitos, total: entradas.length });
    setProgreso("");
  }

  const posesionLocal = equipoLocal?.team ? calcularPosesionPromedio(fixturesLocal, equipoLocal.team.id, statsMap) : null;
  const posesionVisitante = equipoVisitante?.team ? calcularPosesionPromedio(fixturesVisitante, equipoVisitante.team.id, statsMap) : null;

  const colorMarcaLocal = useColorDeEscudo(equipoLocal?.team?.logo, ACENTOS_CATEGORIA.local);
  const colorMarcaVisitante = useColorDeEscudo(equipoVisitante?.team?.logo, ACENTOS_CATEGORIA.visitante);
  const colorMarcaInicio = useColorDeEscudo(equipoInicio?.team?.logo, DORADO);
  const [partidoTocadoInicio, setPartidoTocadoInicio] = useState(null);

  async function buscarEquipoInicio(e) {
    e.preventDefault();
    if (busquedaInicio.trim().length < 3) return;
    setBuscandoInicio(true);
    setEquipoInicio(null);
    setFixturesInicio([]);
    try {
      const res = await fetch(`/api/teams?name=${encodeURIComponent(busquedaInicio)}`);
      const data = await res.json();
      if (!data.error && data.length > 0) {
        const equipo = data[0];
        setEquipoInicio(equipo);
        const resFix = await fetch(`/api/fixtures?teamId=${equipo.team.id}`);
        const fixturesData = await resFix.json();
        if (!fixturesData.error) setFixturesInicio(fixturesData);
      }
    } catch (err) {}
    setBuscandoInicio(false);
  }

  // Ajuste experimental por clima: modesto, basado en tendencias generales, no en un estudio exacto de este partido
  let factorClima = 1;
  if (climaData) {
    if (climaData.precipitacionMm > 5) factorClima *= 0.93;
    if (climaData.vientoMaxKmh > 35) factorClima *= 0.95;
    if (climaData.temperaturaMax > 32) factorClima *= 0.97;
  }
  const climaAjuste = estimarClima && climaData ? { activo: true, factor: factorClima } : { activo: false, factor: 1 };
  const acentoMarca = modoOscuro ? DORADO : "#1F7A46";

  return (
    <div style={{ background: tema.fondo, color: tema.texto, minHeight: "100vh" }}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

        * { box-sizing: border-box; }

        html, body {
          margin: 0;
          padding: 0;
          background: ${tema.fondo};
          font-family: 'IBM Plex Sans', Arial, sans-serif;
        }

        img { max-width: 100%; }

        h1, h3, h4 {
          font-family: 'Barlow Condensed', Arial, sans-serif;
          font-weight: 700;
          letter-spacing: 0.02em;
        }

        h3, h4 {
          text-transform: uppercase;
          font-size: 0.95em;
          letter-spacing: 0.08em;
        }

        table {
          font-variant-numeric: tabular-nums;
          width: 100%;
        }

        table td, table th {
          font-family: 'IBM Plex Mono', monospace;
        }

        table th {
          font-family: 'IBM Plex Sans', Arial, sans-serif;
          text-transform: uppercase;
          font-size: 0.75em;
          letter-spacing: 0.06em;
        }

        button {
          font-family: 'IBM Plex Sans', Arial, sans-serif;
          font-weight: 600;
          letter-spacing: 0.03em;
        }

        input[type="date"], input[type="text"] {
          font-family: 'IBM Plex Sans', Arial, sans-serif;
        }

        .jmcs-grid {
          display: grid;
          grid-template-columns: 1fr;
          grid-template-areas:
            "calendario"
            "centro";
          gap: 16px;
          padding: 12px;
          max-width: 100%;
        }

        .jmcs-calendario { grid-area: calendario; }
        .jmcs-centro { grid-area: centro; min-width: 0; }
        .jmcs-ala-local, .jmcs-ala-visitante { display: none; }

        @media (min-width: 768px) {
          .jmcs-grid {
            grid-template-columns: 260px 1fr;
            grid-template-areas: "calendario centro";
            padding: 20px;
            gap: 20px;
          }
        }

        @media (min-width: 1280px) {
          .jmcs-grid {
            grid-template-columns: 260px 260px 1fr 260px;
            grid-template-areas: "calendario ala-local centro ala-visitante";
            align-items: start;
          }
          .jmcs-ala-local, .jmcs-ala-visitante {
            display: block;
            position: sticky;
            top: 20px;
          }
        }

        /* Carrusel de equipos: solo se activa como carrusel en pantallas angostas */
        .jmcs-carrusel-nav { display: none; }
        @media (max-width: 767px) {
          .jmcs-carrusel-item[data-activo="false"] { display: none; }
          .jmcs-carrusel-nav { display: flex; }
        }
        .jmcs-carrusel-contenedor {
          transition: opacity 0.2s ease;
          touch-action: pan-y;
        }

        /* Burbuja de chat flotante: sin recorte, silueta natural del PNG */
        @keyframes jmcsPulso {
          0% { transform: scale(1); }
          4% { transform: scale(1.18); }
          8% { transform: scale(0.96); }
          12% { transform: scale(1.06); }
          16% { transform: scale(1); }
          100% { transform: scale(1); }
        }

        .jmcs-chat-burbuja {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 78px;
          height: auto;
          background: transparent;
          cursor: pointer;
          z-index: 50;
          border: none;
          padding: 0;
          filter: drop-shadow(0 4px 10px rgba(0,0,0,0.45));
          animation: jmcsPulso 10s ease-in-out infinite;
        }

        .jmcs-chat-burbuja img {
          width: 100%;
          height: auto;
          display: block;
        }

        .jmcs-datos-sticky {
          position: sticky;
          top: 8px;
          z-index: 10;
        }

        .jmcs-partidos-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }

        @media (min-width: 768px) {
          .jmcs-partidos-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        .jmcs-chat-panel {
          position: fixed;
          bottom: 100px;
          right: 20px;
          width: 360px;
          max-width: calc(100vw - 32px);
          max-height: 70vh;
          z-index: 50;
          overflow-y: auto;
          border-radius: 10px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        }

        /* Modo espejo: solo visible en pantallas amplias */
        .jmcs-espejo-desktop { display: none; }
        .jmcs-subpaneles-individual { display: block; }
        @media (min-width: 1024px) {
          .jmcs-espejo-desktop { display: block; }
          .jmcs-subpaneles-individual { display: none; }
        }
      `}</style>

      <div style={{ padding: "12px 12px 0", maxWidth: 2400, margin: "0 auto" }}>
        <div
          style={{
            display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10,
            padding: "12px 20px", background: tema.panel, borderRadius: 6,
            borderBottom: `3px solid ${acentoMarca}`, marginBottom: 6,
          }}
        >
          {/* Zona izquierda: menú hamburguesa + registro/login */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
            <button
              onClick={() => { setMenuAbierto(!menuAbierto); setIdiomaAbierto(false); }}
              aria-label="Menú"
              style={{
                fontSize: 20, background: "transparent", border: `1px solid ${tema.borde}`,
                borderRadius: 6, padding: "6px 10px", cursor: "pointer", color: tema.texto,
              }}
            >
              ☰
            </button>

            {sesion ? (
              <>
                <span style={{ fontSize: 12, color: tema.textoSuave, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {sesion.user.email}
                </span>
                <button
                  onClick={cerrarSesion}
                  style={{
                    padding: "8px 12px", fontSize: 12, background: "transparent",
                    color: tema.texto, border: `1px solid ${tema.borde}`, borderRadius: 6, cursor: "pointer",
                  }}
                >
                  Cerrar sesión
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={abrirRegistro}
                  style={{
                    padding: "8px 12px", fontSize: 12, background: "transparent",
                    color: tema.texto, border: `1px solid ${tema.borde}`, borderRadius: 6, cursor: "pointer",
                  }}
                >
                  Registrarse
                </button>
                <button
                  onClick={abrirLogin}
                  style={{
                    padding: "8px 12px", fontSize: 12, background: acentoMarca,
                    color: modoOscuro ? "#1B1200" : "#fff", border: "none", borderRadius: 6, cursor: "pointer",
                  }}
                >
                  Iniciar sesión
                </button>
              </>
            )}

            {menuAbierto && (
              <div
                style={{
                  position: "absolute", top: "115%", left: 0, background: tema.panel,
                  border: `1px solid ${tema.borde}`, borderRadius: 6, minWidth: 200, zIndex: 20,
                  boxShadow: "0 6px 16px rgba(0,0,0,0.25)", overflow: "hidden",
                }}
              >
                {["Inicio", "Mis estudios", "Favoritos", "Historial de aciertos", "Ajustes"].map((item) => (
                  <div
                    key={item}
                    onClick={item === "Inicio" ? () => setMenuAbierto(false) : () => accederOPedirCuenta(item)}
                    style={{ padding: "10px 14px", fontSize: 13, cursor: "pointer", borderBottom: `1px solid ${tema.borde}` }}
                  >
                    {item}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Zona centro: logo + título */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src="/logo.png" alt="JMCS" width={40} height={40} />
            <div>
              <h1 style={{ margin: 0, fontSize: 24, lineHeight: 1 }}>JMCS</h1>
              <p style={{ margin: "2px 0 0", fontSize: 9, color: tema.textoSuave, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Juggernaut Match Calculation System
              </p>
            </div>
          </div>

          {/* Zona derecha: idioma (bandera) + modo oscuro */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
            <button
              onClick={() => { setIdiomaAbierto(!idiomaAbierto); setMenuAbierto(false); }}
              aria-label="Idioma"
              style={{
                fontSize: 18, background: "transparent", border: `1px solid ${tema.borde}`,
                borderRadius: 6, padding: "5px 9px", cursor: "pointer",
              }}
            >
              {idioma === "es" ? "🇪🇸" : "🇺🇸"}
            </button>

            {idiomaAbierto && (
              <div
                style={{
                  position: "absolute", top: "115%", right: 0, background: tema.panel,
                  border: `1px solid ${tema.borde}`, borderRadius: 6, zIndex: 20,
                  boxShadow: "0 6px 16px rgba(0,0,0,0.25)", overflow: "hidden",
                }}
              >
                <div onClick={() => { setIdioma("es"); setIdiomaAbierto(false); }} style={{ padding: "8px 14px", fontSize: 18, cursor: "pointer" }}>🇪🇸</div>
                <div onClick={mostrarProximamente} style={{ padding: "8px 14px", fontSize: 18, cursor: "pointer" }}>🇺🇸</div>
              </div>
            )}

            <button
              onClick={() => setModoOscuro(!modoOscuro)}
              style={{
                padding: "8px 14px", fontSize: 13,
                background: tema.fondo, color: tema.texto, border: `1px solid ${tema.borde}`,
                borderRadius: 20, cursor: "pointer",
              }}
            >
              {modoOscuro ? "☀️" : "🌙"}
            </button>
          </div>
        </div>

        {notaProximamente && (
          <p style={{ textAlign: "center", color: acentoMarca, fontSize: 12, margin: "4px 0 0" }}>
            🔒 Esta función estará disponible pronto.
          </p>
        )}

        {vistaActual === "estudio" && (
          <p style={{ textAlign: "center", color: acentoMarca, fontSize: 12, margin: "10px 0 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {mensajeEstudio}
          </p>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14 }}>
          {[
            { id: "inicio", etiqueta: "🏠 Inicio" },
            { id: "estudio", etiqueta: "📊 Estudio" },
            { id: "favoritos", etiqueta: "⭐ Favoritos" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setVistaActual(tab.id)}
              style={{
                padding: "8px 18px", fontSize: 13, borderRadius: 20, cursor: "pointer",
                background: vistaActual === tab.id ? acentoMarca : "transparent",
                color: vistaActual === tab.id ? "#fff" : tema.texto,
                border: `1px solid ${vistaActual === tab.id ? acentoMarca : tema.borde}`,
                fontWeight: vistaActual === tab.id ? "bold" : "normal",
              }}
            >
              {tab.etiqueta}
            </button>
          ))}
        </div>
      </div>

      {vistaActual === "inicio" && (
        <div style={{ maxWidth: 800, margin: "20px auto", padding: "0 12px" }}>
          <form onSubmit={buscarEquipoInicio} style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <input
              type="text"
              value={busquedaInicio}
              onChange={(e) => setBusquedaInicio(e.target.value)}
              placeholder="Busca un equipo (ej: Barcelona)"
              style={{ flex: 1, padding: 12, fontSize: 15, background: tema.panel, color: tema.texto, border: `1px solid ${tema.borde}`, borderRadius: 6 }}
            />
            <button
              type="submit"
              disabled={buscandoInicio}
              style={{ padding: "12px 20px", fontSize: 14, background: acentoMarca, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}
            >
              {buscandoInicio ? "..." : "Buscar"}
            </button>
          </form>

          <VistaInicio
            tema={tema}
            acentoMarca={acentoMarca}
            sesion={sesion}
            onPedirLogin={abrirLogin}
            equipoInicio={equipoInicio}
            fixturesInicio={fixturesInicio}
            colorMarcaInicio={colorMarcaInicio}
            onSeleccionarPartido={(p) => {
              seleccionarPartidoDelCalendario(p);
              setVistaActual("estudio");
            }}
            partidoTocado={partidoTocadoInicio}
          />
        </div>
      )}

      {vistaActual === "favoritos" && (
        <div style={{ maxWidth: 900, margin: "20px auto", padding: "0 12px" }}>
          {sesion ? (
            <PanelFavoritosPagina sesion={sesion} tema={tema} acentoMarca={acentoMarca} />
          ) : (
            <div style={{ textAlign: "center", padding: 40 }}>
              <p style={{ color: tema.textoSuave, marginBottom: 16 }}>Inicia sesión para ver tus equipos favoritos.</p>
              <button
                onClick={abrirLogin}
                style={{ padding: "10px 20px", fontSize: 14, background: acentoMarca, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}
              >
                Iniciar sesión
              </button>
            </div>
          )}
        </div>
      )}

      {vistaActual === "estudio" && (
      <div className="jmcs-grid" style={{ maxWidth: 2400, margin: "0 auto" }}>
        <div className="jmcs-calendario">
          <PanelCalendario tema={tema} onSeleccionarPartido={seleccionarPartidoDelCalendario} acentoMarca={acentoMarca} />
        </div>

        <div className="jmcs-ala-local">
          <PanelEquipoLateral equipo={equipoLocal} stats={statsGoLocal} posesion={posesionLocal} fixtures={fixturesLocal} acento={colorMarcaLocal} tema={tema} sesion={sesion} onPedirLogin={abrirLogin} />
        </div>

        <div className="jmcs-centro">
          <div className="jmcs-datos-sticky">
            <DatosGeneralesEncuentro
              partidoCalendario={partidoCalendario}
              climaData={climaData}
              cargandoClima={cargandoClima}
              estimarClima={estimarClima}
              setEstimarClima={setEstimarClima}
              tema={tema}
              acentoMarca={acentoMarca}
            />
          </div>

          {equipoLocal?.team && equipoVisitante?.team && (
            <div style={{ textAlign: "center", margin: "0 0 20px", fontSize: 18, fontWeight: "bold" }}>
              <span style={{ color: colorMarcaLocal }}>{equipoLocal.team.name}</span>
              {" vs "}
              <span style={{ color: colorMarcaVisitante }}>{equipoVisitante.team.name}</span>
            </div>
          )}

          <div
            className="jmcs-carrusel-contenedor"
            style={{ display: "flex", gap: 30, flexWrap: "wrap" }}
            onTouchStart={(e) => setToqueInicioX(e.touches[0].clientX)}
            onTouchEnd={(e) => {
              if (toqueInicioX === null) return;
              const deltaX = e.changedTouches[0].clientX - toqueInicioX;
              const UMBRAL = 45;
              if (deltaX < -UMBRAL && tarjetaActivaMovil === "local") {
                setTarjetaActivaMovil("visitante");
              } else if (deltaX > UMBRAL && tarjetaActivaMovil === "visitante") {
                setTarjetaActivaMovil("local");
              }
              setToqueInicioX(null);
            }}
          >
            <div className="jmcs-carrusel-item" data-activo={tarjetaActivaMovil === "local" ? "true" : "false"} style={{ flex: 1, minWidth: 320 }}>
              <BuscadorEquipo
                etiqueta="Local"
                tema={tema}
                statsMap={statsMap}
                equipoForzado={equipoForzadoLocal}
                colorMarca={colorMarcaLocal}
                sesion={sesion}
                onPedirLogin={abrirLogin}
                onEquipoCargado={(team, fixtures, esDelCalendario) => {
                  setEquipoLocal(team);
                  setFixturesLocal(fixtures || []);
                  setDatosPuntualesListos(false);
                  setStatsMap({});
                  if (!esDelCalendario) setPartidoCalendario(null);
                }}
              />
            </div>
            <div className="jmcs-carrusel-item" data-activo={tarjetaActivaMovil === "visitante" ? "true" : "false"} style={{ flex: 1, minWidth: 320 }}>
              <BuscadorEquipo
                etiqueta="Visitante"
                tema={tema}
                statsMap={statsMap}
                equipoForzado={equipoForzadoVisitante}
                colorMarca={colorMarcaVisitante}
                sesion={sesion}
                onPedirLogin={abrirLogin}
                onEquipoCargado={(team, fixtures, esDelCalendario) => {
                  setEquipoVisitante(team);
                  setFixturesVisitante(fixtures || []);
                  setDatosPuntualesListos(false);
                  setStatsMap({});
                  if (!esDelCalendario) setPartidoCalendario(null);
                }}
              />
            </div>
          </div>

          <div className="jmcs-carrusel-nav" style={{ justifyContent: "center", alignItems: "center", gap: 8, marginTop: 12 }}>
            <div
              onClick={() => setTarjetaActivaMovil("local")}
              style={{
                width: 9, height: 9, borderRadius: "50%", cursor: "pointer",
                background: tarjetaActivaMovil === "local" ? acento : tema.borde,
              }}
            />
            <div
              onClick={() => setTarjetaActivaMovil("visitante")}
              style={{
                width: 9, height: 9, borderRadius: "50%", cursor: "pointer",
                background: tarjetaActivaMovil === "visitante" ? acento : tema.borde,
              }}
            />
          </div>
          <p className="jmcs-carrusel-nav" style={{ justifyContent: "center", fontSize: 11, color: tema.textoSuave, marginTop: 4 }}>
            👉 Desliza para ver {tarjetaActivaMovil === "local" ? "el Visitante" : "el Local"}
          </p>

          <div className="jmcs-espejo-desktop" style={{ marginTop: 20 }}>
            <SeccionEspejo
              equipoLocal={equipoLocal}
              equipoVisitante={equipoVisitante}
              fixturesLocal={fixturesLocal}
              fixturesVisitante={fixturesVisitante}
              statsMap={statsMap}
              tema={tema}
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
              {resumenCarga && (
                <span style={{ display: "block", fontWeight: "normal", fontSize: 12, color: tema.textoSuave, marginTop: 4 }}>
                  ({resumenCarga})
                </span>
              )}
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
            climaAjuste={climaAjuste}
            coberturaPuntuales={coberturaPuntuales}
          />
        </div>

        <div className="jmcs-ala-visitante">
          <PanelEquipoLateral equipo={equipoVisitante} stats={statsGoVisitante} posesion={posesionVisitante} fixtures={fixturesVisitante} acento={colorMarcaVisitante} tema={tema} sesion={sesion} onPedirLogin={abrirLogin} />
        </div>
      </div>
      )}

      {vistaActual === "estudio" && equipoLocal?.team && equipoVisitante?.team && (
        <>
          <div className="jmcs-chat-panel" style={{ background: tema.panel, display: chatAbierto ? "block" : "none" }}>
            <ChatIA
              equipoLocal={equipoLocal}
              equipoVisitante={equipoVisitante}
              statsGoLocal={statsGoLocal}
              statsGoVisitante={statsGoVisitante}
              h2h={h2h}
              esPartidoLiga={esPartidoLiga}
              tema={tema}
              acento={acento}
              onCerrar={() => setChatAbierto(false)}
            />
          </div>

          <button className="jmcs-chat-burbuja" onClick={() => setChatAbierto(!chatAbierto)} aria-label="Chat IA">
            <img src="/chat-icon.png" alt="Chat" />
          </button>
        </>
      )}

      {authModalAbierto && (
        <AuthModal
          tema={tema}
          acentoMarca={acentoMarca}
          modoInicial={authModalModo}
          onCerrar={() => setAuthModalAbierto(false)}
        />
      )}

      {favoritosPanelAbierto && sesion && (
        <PanelFavoritos
          sesion={sesion}
          tema={tema}
          acentoMarca={acentoMarca}
          onCerrar={() => setFavoritosPanelAbierto(false)}
        />
      )}
    </div>
  );
}
