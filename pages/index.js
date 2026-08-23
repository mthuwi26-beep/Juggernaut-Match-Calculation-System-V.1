import { useState } from "react";

function BuscadorEquipo({ etiqueta, onEquipoCargado }) {
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

  return (
    <div style={{ flex: 1, minWidth: 320 }}>
      <h3 style={{ marginBottom: 8 }}>{etiqueta}</h3>

      <form onSubmit={buscarEquipos} style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Escribe un equipo (ej: Barcelona)"
          style={{ flex: 1, padding: 10, fontSize: 15 }}
        />
        <button type="submit" style={{ padding: "10px 16px", fontSize: 15 }}>
          Buscar
        </button>
      </form>

      {loading && <p style={{ marginTop: 12 }}>Cargando...</p>}
      {error && <p style={{ marginTop: 12, color: "red", fontSize: 14 }}>{error}</p>}

      {teams.length > 0 && !selectedTeam && (
        <div style={{ marginTop: 12, maxHeight: 250, overflowY: "auto" }}>
          {teams.map((t) => (
            <div
              key={t.team.id}
              onClick={() => verPartidos(t)}
              style={{
                padding: 8,
                border: "1px solid #ddd",
                marginBottom: 6,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 14,
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
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <img src={selectedTeam.team.logo} alt={selectedTeam.team.name} width={26} height={26} />
            <strong>{selectedTeam.team.name}</strong>
          </div>

          {fixtures.length > 0 ? (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f0f0f0", textAlign: "left" }}>
                  <th style={{ padding: 6 }}>Fecha</th>
                  <th style={{ padding: 6 }}>Torneo</th>
                  <th style={{ padding: 6 }}>Partido</th>
                  <th style={{ padding: 6 }}>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {fixtures.map((f) => (
                  <tr key={f.fixture.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: 6 }}>
                      {new Date(f.fixture.date).toLocaleDateString("es-ES")}
                    </td>
                    <td style={{ padding: 6 }}>{f.league.name}</td>
                    <td style={{ padding: 6 }}>
                      {f.teams.home.name} vs {f.teams.away.name}
                    </td>
                    <td style={{ padding: 6 }}>
                      {f.goals.home} - {f.goals.away}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            !loading && <p style={{ color: "#999" }}>Sin partidos en la temporada 2024.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [equipoA, setEquipoA] = useState(null);
  const [equipoB, setEquipoB] = useState(null);

  return (
    <div style={{ maxWidth: 1100, margin: "40px auto", padding: 20, fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ textAlign: "center" }}>JMCS</h1>
      <p style={{ textAlign: "center", color: "#666" }}>
        Juggernaut Match Calculation System — Selecciona los dos equipos del estudio
      </p>
      <p style={{ textAlign: "center", color: "#c00", fontSize: 13 }}>
        Modo prueba: mostrando temporada 2024 (plan gratis de API-Football)
      </p>

      {equipoA?.team && equipoB?.team && (
        <div style={{ textAlign: "center", margin: "20px 0", fontSize: 18, fontWeight: "bold" }}>
          {equipoA.team.name} vs {equipoB.team.name}
        </div>
      )}

      <div style={{ display: "flex", gap: 30, marginTop: 30, flexWrap: "wrap" }}>
        <BuscadorEquipo
          etiqueta="Equipo A"
          onEquipoCargado={(team) => setEquipoA(team)}
        />
        <BuscadorEquipo
          etiqueta="Equipo B"
          onEquipoCargado={(team) => setEquipoB(team)}
        />
      </div>
    </div>
  );
}
