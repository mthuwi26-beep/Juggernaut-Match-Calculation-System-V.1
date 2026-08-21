import { useState } from "react";

export default function Home() {
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
      const res = await fetch(`/api/fixtures?teamId=${team.id}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setFixtures(data);
      }
    } catch (err) {
      setError("Error al traer los partidos");
    }
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 800, margin: "40px auto", padding: 20, fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ textAlign: "center" }}>JMCS</h1>
      <p style={{ textAlign: "center", color: "#666" }}>
        Juggernaut Match Calculation System — Fase 1: búsqueda de equipos
      </p>

      <form onSubmit={buscarEquipos} style={{ display: "flex", gap: 8, marginTop: 30 }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Escribe un equipo (ej: Barcelona)"
          style={{ flex: 1, padding: 10, fontSize: 16 }}
        />
        <button type="submit" style={{ padding: "10px 20px", fontSize: 16 }}>
          Buscar
        </button>
      </form>

      <p style={{ marginTop: 10, fontSize: 13, color: "#999" }}>
        Ligas disponibles: La Liga, Premier League, Champions League, Serie A, Bundesliga, Ligue 1
      </p>

      {loading && <p style={{ marginTop: 20 }}>Cargando...</p>}
      {error && <p style={{ marginTop: 20, color: "red" }}>{error}</p>}

      {teams.length > 0 && !selectedTeam && (
        <div style={{ marginTop: 20 }}>
          <h3>Selecciona el equipo correcto:</h3>
          {teams.map((t) => (
            <div
              key={t.id}
              onClick={() => verPartidos(t)}
              style={{
                padding: 10,
                border: "1px solid #ddd",
                marginBottom: 8,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <img src={t.crest} alt={t.name} width={30} height={30} />
              <span>{t.name} — {t.area?.name}</span>
            </div>
          ))}
        </div>
      )}

      {selectedTeam && fixtures.length > 0 && (
        <div style={{ marginTop: 30 }}>
          <h3>Últimos {fixtures.length} partidos de {selectedTeam.name}</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10 }}>
            <thead>
              <tr style={{ background: "#f0f0f0", textAlign: "left" }}>
                <th style={{ padding: 8 }}>Fecha</th>
                <th style={{ padding: 8 }}>Torneo</th>
                <th style={{ padding: 8 }}>Partido</th>
                <th style={{ padding: 8 }}>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {fixtures.map((f) => (
                <tr key={f.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 8 }}>
                    {new Date(f.utcDate).toLocaleDateString("es-ES")}
                  </td>
                  <td style={{ padding: 8 }}>{f.competition.name}</td>
                  <td style={{ padding: 8 }}>
                    {f.homeTeam.name} vs {f.awayTeam.name}
                  </td>
                  <td style={{ padding: 8 }}>
                    {f.score.fullTime.home} - {f.score.fullTime.away}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
