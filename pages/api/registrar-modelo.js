// ============================================================
// Registro del Backtesting: cuando alguien abre el estudio de un partido que
// todavia no empieza, la pagina o la app mandan aqui lo que calculo el
// semaforo (calculo puro, sin clima). Asi queda constancia, con fecha y
// hora, de lo que dijo JMCS ANTES del partido, y al terminar se verifica.
// ============================================================
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { modeloValido } from "../../lib/verificacion";
import { partidoPorId, SIN_EMPEZAR } from "../../lib/futbolServidor";

const SEIS_HORAS_MS = 6 * 60 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
  try {
    const { fixtureId, modelo, origen } = req.body || {};
    const id = Number(fixtureId);
    if (!Number.isFinite(id) || id <= 0 || !modeloValido(modelo)) {
      return res.status(400).json({ error: "Datos no válidos" });
    }

    // Solo se registra si el partido existe y todavia no empieza.
    const partido = await partidoPorId(id);
    const estado = partido?.fixture?.status?.short;
    const inicio = new Date(partido?.fixture?.date).getTime();
    if (!partido || !SIN_EMPEZAR.includes(estado) || !(inicio > Date.now() + 60 * 1000)) {
      return res.status(200).json({ registrado: false, motivo: "El partido ya empezó o no existe" });
    }

    // Si ya hay un registro reciente, no se reemplaza (se refresca cada 6 horas
    // como maximo, para quedarse con el calculo mas cercano al partido).
    const { data: existente } = await supabaseAdmin
      .from("registro_sistema")
      .select("registrado_en")
      .eq("fixture_id", id)
      .maybeSingle();
    if (existente && Date.now() - new Date(existente.registrado_en).getTime() < SEIS_HORAS_MS) {
      return res.status(200).json({ registrado: false, motivo: "Ya registrado" });
    }

    const limpio = {
      gl: modelo.gl, gv: modelo.gv,
      corners: modelo.corners ?? null, amarillas: modelo.amarillas ?? null, faltas: modelo.faltas ?? null,
      handicap: modelo.handicap ?? null,
      clima: false,
      muestraInsuficiente: !!modelo.muestraInsuficiente,
    };

    await supabaseAdmin.from("registro_sistema").upsert({
      fixture_id: id,
      liga: partido.league?.name || null,
      liga_id: partido.league?.id || null,
      pais: partido.league?.country || null,
      equipo_local: partido.teams?.home?.name || null,
      equipo_visitante: partido.teams?.away?.name || null,
      equipo_local_id: partido.teams?.home?.id || null,
      equipo_visitante_id: partido.teams?.away?.id || null,
      fecha_partido: partido.fixture.date,
      modelo: limpio,
      origen: origen === "app" ? "app" : "web",
      registrado_en: new Date().toISOString(),
      resultado: "pendiente",
    });
    res.status(200).json({ registrado: true });
  } catch {
    res.status(200).json({ registrado: false });
  }
}
