// Esta ruta NO la llama nadie desde la app — la llama un servicio externo gratuito
// (por ejemplo cron-job.org) cada 1 minuto, porque el cron propio de Vercel en el
// plan gratis solo corre 1 vez por día, y acá necesitamos revisar mucho más seguido.
//
// Qué hace, paso a paso:
// 1) Mira qué equipos tienen la campana activada (favoritos.notificar = true)
// 2) Pide a API-Football TODOS los partidos en vivo del mundo en una sola llamada
// 3) Se queda solo con los que involucran a un equipo vigilado
// 4) Compara contra el último estado que guardamos, para detectar qué CAMBIÓ
//    (arrancó, hubo un gol, hubo una tarjeta, terminó)
// 5) A cada usuario que corresponda (según sus preferencias) le manda un push
//
// NOTA IMPORTANTE (para ser honestos): el "semáforo verde" no está acá todavía.
// Ese cálculo hoy vive adentro de la pantalla de React (PanelSemaforo) y no se
// puede correr desde el servidor sin antes sacar esa lógica de ahí — queda
// pendiente para una tanda futura, tal como lo hablamos.

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { enviarPush } from "../../lib/push";

const ESTADOS_FINALIZADOS = ["FT", "AET", "PEN", "PST", "CANC", "ABD", "AWD", "WO"];
// Si tu dominio cambia, agregá NEXT_PUBLIC_SITE_URL en Vercel con la URL nueva.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://juggernaut-match-calculation-system-nine.vercel.app";

export default async function handler(req, res) {
  if (req.query.secret !== process.env.VIGILANTE_SECRET) {
    return res.status(401).json({ error: "No autorizado" });
  }

  try {
    // 1) Equipos con la campana activada
    const { data: favoritosVigilados } = await supabaseAdmin
      .from("favoritos")
      .select("user_id, team_id, team_name")
      .eq("notificar", true);

    if (!favoritosVigilados || favoritosVigilados.length === 0) {
      return res.status(200).json({ mensaje: "Nadie tiene equipos vigilados todavía" });
    }

    const equiposVigiladosIds = [...new Set(favoritosVigilados.map((f) => f.team_id))];

    // 2) Todos los partidos en vivo del mundo, en una sola llamada
    const response = await fetch("https://v3.football.api-sports.io/fixtures?live=all", {
      headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY },
    });
    const data = await response.json();
    const partidosEnVivo = data.response || [];

    // 3) Solo los que tienen algún equipo vigilado
    const partidosRelevantes = partidosEnVivo.filter(
      (p) => equiposVigiladosIds.includes(p.teams.home.id) || equiposVigiladosIds.includes(p.teams.away.id)
    );

    const idsRelevantes = partidosRelevantes.map((p) => p.fixture.id);

    // 4) Traemos el último estado que teníamos guardado de esos partidos (y de
    // cualquier otro que estuviera en curso, para poder detectar los que "salieron"
    // de la lista de en vivo porque ya terminaron)
    const { data: estadosPrevios } = await supabaseAdmin.from("estado_partidos_vigilados").select("*");
    const mapaPrevios = {};
    (estadosPrevios || []).forEach((e) => { mapaPrevios[e.fixture_id] = e; });

    // Preferencias de todos los usuarios que tienen algo vigilado, en una sola consulta
    const userIdsVigilantes = [...new Set(favoritosVigilados.map((f) => f.user_id))];
    const { data: perfiles } = await supabaseAdmin
      .from("perfiles")
      .select("user_id, notif_activadas, notif_gol, notif_empieza, notif_termina, notif_tarjetas")
      .in("user_id", userIdsVigilantes);
    const mapaPerfiles = {};
    (perfiles || []).forEach((p) => { mapaPerfiles[p.user_id] = p; });

    const eventosAEnviar = []; // { userIds: Set, titulo, cuerpo }

    function usuariosQueVigilanEquipo(teamId) {
      return favoritosVigilados.filter((f) => f.team_id === teamId).map((f) => f.user_id);
    }

    function usuariosConPreferencia(userIds, campo) {
      return userIds.filter((uid) => {
        const perfil = mapaPerfiles[uid];
        return perfil && perfil.notif_activadas && perfil[campo];
      });
    }

    // --- Detectar partidos nuevos, goles, y fin de partido ---
    for (const partido of partidosRelevantes) {
      const fixtureId = partido.fixture.id;
      const previo = mapaPrevios[fixtureId];
      const nombreLocal = partido.teams.home.name;
      const nombreVisitante = partido.teams.away.name;
      const golesLocal = partido.goals.home ?? 0;
      const golesVisitante = partido.goals.away ?? 0;
      const marcador = `${nombreLocal} ${golesLocal}-${golesVisitante} ${nombreVisitante}`;

      const usuariosLocal = usuariosQueVigilanEquipo(partido.teams.home.id);
      const usuariosVisitante = usuariosQueVigilanEquipo(partido.teams.away.id);
      const usuariosAmbos = [...new Set([...usuariosLocal, ...usuariosVisitante])];

      if (!previo) {
        // Primera vez que lo vemos en vivo → "empezó"
        const destinatarios = usuariosConPreferencia(usuariosAmbos, "notif_empieza");
        if (destinatarios.length > 0) {
          eventosAEnviar.push({
            userIds: destinatarios,
            titulo: "Arrancó el partido",
            cuerpo: `${nombreLocal} vs ${nombreVisitante} ya está en juego`,
          });
        }
      } else {
        if (golesLocal > (previo.goles_local ?? 0)) {
          const destinatarios = usuariosConPreferencia(usuariosAmbos, "notif_gol");
          if (destinatarios.length > 0) {
            eventosAEnviar.push({ userIds: destinatarios, titulo: `¡Gol de ${nombreLocal}!`, cuerpo: marcador });
          }
        }
        if (golesVisitante > (previo.goles_visitante ?? 0)) {
          const destinatarios = usuariosConPreferencia(usuariosAmbos, "notif_gol");
          if (destinatarios.length > 0) {
            eventosAEnviar.push({ userIds: destinatarios, titulo: `¡Gol de ${nombreVisitante}!`, cuerpo: marcador });
          }
        }
      }

      // --- Tarjetas: solo pedimos los eventos del partido si hay alguien que
      // realmente quiere ese aviso, para no gastar cuota de más en partidos donde
      // a nadie le interesa ---
      const interesadosEnTarjetas = usuariosConPreferencia(usuariosAmbos, "notif_tarjetas");
      if (interesadosEnTarjetas.length > 0) {
        try {
          const resEventos = await fetch(`https://v3.football.api-sports.io/fixtures/events?fixture=${fixtureId}`, {
            headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY },
          });
          const dataEventos = await resEventos.json();
          const eventos = dataEventos.response || [];
          const tarjetasLocalAhora = eventos.filter((e) => e.type === "Card" && e.team.id === partido.teams.home.id).length;
          const tarjetasVisitanteAhora = eventos.filter((e) => e.type === "Card" && e.team.id === partido.teams.away.id).length;

          if (previo && tarjetasLocalAhora > (previo.tarjetas_local ?? 0)) {
            const destinatarios = usuariosConPreferencia(usuariosLocal, "notif_tarjetas");
            if (destinatarios.length > 0) {
              eventosAEnviar.push({ userIds: destinatarios, titulo: `Tarjeta para ${nombreLocal}`, cuerpo: marcador });
            }
          }
          if (previo && tarjetasVisitanteAhora > (previo.tarjetas_visitante ?? 0)) {
            const destinatarios = usuariosConPreferencia(usuariosVisitante, "notif_tarjetas");
            if (destinatarios.length > 0) {
              eventosAEnviar.push({ userIds: destinatarios, titulo: `Tarjeta para ${nombreVisitante}`, cuerpo: marcador });
            }
          }

          await supabaseAdmin.from("estado_partidos_vigilados").upsert({
            fixture_id: fixtureId,
            estado_corto: partido.fixture.status.short,
            goles_local: golesLocal,
            goles_visitante: golesVisitante,
            tarjetas_local: tarjetasLocalAhora,
            tarjetas_visitante: tarjetasVisitanteAhora,
            team_local_id: partido.teams.home.id,
            team_visitante_id: partido.teams.away.id,
            nombre_local: nombreLocal,
            nombre_visitante: nombreVisitante,
            actualizado_en: new Date().toISOString(),
          });
        } catch {
          // si falla lo de tarjetas, igual guardamos el resto del estado más abajo
        }
      } else {
        await supabaseAdmin.from("estado_partidos_vigilados").upsert({
          fixture_id: fixtureId,
          estado_corto: partido.fixture.status.short,
          goles_local: golesLocal,
          goles_visitante: golesVisitante,
          tarjetas_local: previo?.tarjetas_local ?? 0,
          tarjetas_visitante: previo?.tarjetas_visitante ?? 0,
          team_local_id: partido.teams.home.id,
          team_visitante_id: partido.teams.away.id,
          nombre_local: nombreLocal,
          nombre_visitante: nombreVisitante,
          actualizado_en: new Date().toISOString(),
        });
      }
    }

    // --- Partidos que estaban en curso y ya no aparecen en la lista de en vivo:
    // lo más probable es que hayan terminado. Los confirmamos con nuestra propia
    // ruta de marcador (que ya está cacheada) y avisamos "terminó".
    const fixturesQueSalieron = (estadosPrevios || []).filter(
      (e) => !idsRelevantes.includes(e.fixture_id) && !ESTADOS_FINALIZADOS.includes(e.estado_corto)
    );

    for (const previo of fixturesQueSalieron) {
      try {
        const resMarcador = await fetch(`${SITE_URL}/api/marcador-vivo?fixtureId=${previo.fixture_id}`);
        const marcadorData = await resMarcador.json();
        if (marcadorData.error) continue;

        if (ESTADOS_FINALIZADOS.includes(marcadorData.estadoCorto)) {
          const marcador = `${previo.nombre_local} ${marcadorData.golesLocal}-${marcadorData.golesVisitante} ${previo.nombre_visitante}`;
          const usuariosLocal = usuariosQueVigilanEquipo(previo.team_local_id);
          const usuariosVisitante = usuariosQueVigilanEquipo(previo.team_visitante_id);
          const usuariosAmbos = [...new Set([...usuariosLocal, ...usuariosVisitante])];
          const destinatarios = usuariosConPreferencia(usuariosAmbos, "notif_termina");
          if (destinatarios.length > 0) {
            eventosAEnviar.push({ userIds: destinatarios, titulo: "Partido finalizado", cuerpo: marcador });
          }

          await supabaseAdmin
            .from("estado_partidos_vigilados")
            .update({ estado_corto: marcadorData.estadoCorto, actualizado_en: new Date().toISOString() })
            .eq("fixture_id", previo.fixture_id);
        }
      } catch {
        // si no se pudo confirmar, lo dejamos para el próximo minuto
      }
    }

    // 5) Mandar los push
    let enviados = 0;
    const userIdsAEnviar = [...new Set(eventosAEnviar.flatMap((e) => e.userIds))];
    if (userIdsAEnviar.length > 0) {
      const { data: suscripciones } = await supabaseAdmin
        .from("push_subscriptions")
        .select("*")
        .in("user_id", userIdsAEnviar);

      for (const evento of eventosAEnviar) {
        const subsDelEvento = (suscripciones || []).filter((s) => evento.userIds.includes(s.user_id));
        for (const sub of subsDelEvento) {
          const resultado = await enviarPush(sub, { titulo: evento.titulo, cuerpo: evento.cuerpo, url: "/" });
          if (resultado.ok) enviados++;
          if (resultado.expirada) {
            await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
          }
        }
      }
    }

    res.status(200).json({ partidosRevisados: partidosRelevantes.length, eventosDetectados: eventosAEnviar.length, pushEnviados: enviados });
  } catch (error) {
    res.status(500).json({ error: "El vigilante falló: " + error.message });
  }
}
