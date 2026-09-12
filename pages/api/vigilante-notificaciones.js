// Esta ruta NO la llama nadie desde la app — la llama un servicio externo gratuito
// (por ejemplo cron-job.org) cada 1 minuto, porque el cron propio de Vercel en el
// plan gratis solo corre 1 vez por día, y acá necesitamos revisar mucho más seguido.
//
// Qué hace, paso a paso:
// 1) Mira qué equipos tienen la campana activada (favoritos.notificar = true)
// 2) Pide a API-Football TODOS los partidos en vivo del mundo en una sola llamada
// 3) Se queda solo con los que involucran a un equipo vigilado
// 4) Compara contra el último estado que guardamos, para detectar qué CAMBIÓ
//    (arrancó, hubo un gol, hubo una tarjeta, terminó, o algún mercado llegó a verde)
// 5) A cada usuario que corresponda (según sus preferencias) le manda un push
//
// El semáforo verde SOLO se calcula para partidos donde alguien realmente lo quiere
// (notif_semaforo=true), porque revisar córners/tarjetas/faltas requiere traer el
// historial completo de estadísticas de ambos equipos — es la parte más cara en
// cuota de API-Football de todo este archivo.

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { enviarPush } from "../../lib/push";
const motor = require("../../lib/motor");

const ESTADOS_FINALIZADOS = ["FT", "AET", "PEN", "PST", "CANC", "ABD", "AWD", "WO"];
// Si tu dominio cambia, agregá NEXT_PUBLIC_SITE_URL en Vercel con la URL nueva.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://juggernaut-match-calculation-system-nine.vercel.app";

// Calcula el semáforo de los 4 mercados (goles, córners, amarillas, faltas) para un
// partido en vivo, usando el mismo motor que la pantalla de Estudio. Devuelve la
// lista de combinaciones mercado+línea que están en verde (>=70%) ahora mismo.
async function calcularMercadosEnVerde(partido) {
  const idLocal = partido.teams.home.id;
  const idVisitante = partido.teams.away.id;

  const [resLocal, resVisitante] = await Promise.all([
    fetch(`${SITE_URL}/api/fixtures?teamId=${idLocal}`).then((r) => r.json()),
    fetch(`${SITE_URL}/api/fixtures?teamId=${idVisitante}`).then((r) => r.json()),
  ]);
  const fixturesLocal = Array.isArray(resLocal) ? resLocal : [];
  const fixturesVisitante = Array.isArray(resVisitante) ? resVisitante : [];
  if (fixturesLocal.length === 0 || fixturesVisitante.length === 0) return [];

  const h2h = motor.calcularHeadToHead(fixturesLocal, fixturesVisitante, idLocal, idVisitante);

  // Datos puntuales (córners/tarjetas/faltas) de todos los partidos históricos que
  // vamos a necesitar — esto es lo que gasta más cuota. Ya está cacheado 30 min
  // en /api/estadisticas-partido, así que revisiones seguidas del mismo partido
  // no vuelven a pagar este costo dentro de esa media hora.
  const fixturesParaStats = [...fixturesLocal, ...fixturesVisitante, ...h2h.partidos];
  const idsUnicos = [...new Set(fixturesParaStats.map((f) => f.fixture.id))];
  const statsMap = {};
  for (const fixtureId of idsUnicos) {
    try {
      const r = await fetch(`${SITE_URL}/api/estadisticas-partido?fixtureId=${fixtureId}`).then((x) => x.json());
      if (!r.error) {
        const homeIdDeEsePartido = fixturesParaStats.find((f) => f.fixture.id === fixtureId)?.teams.home.id;
        const procesado = motor.procesarEstadisticasPartido(r, homeIdDeEsePartido);
        if (procesado) statsMap[fixtureId] = procesado;
      }
    } catch {
      // si falla uno puntual, seguimos con el resto
    }
  }

  const esPartidoLiga = motor.esLiga(partido);
  const fuentesLocal = motor.construirFuentesEquipo(fixturesLocal, idLocal, statsMap, null);
  const fuentesVisitante = motor.construirFuentesEquipo(fixturesVisitante, idVisitante, statsMap, null);
  const h2hGolesLocal = motor.calcularGolesNumerico(h2h.partidos, idLocal);
  const h2hGolesVisitante = motor.calcularGolesNumerico(h2h.partidos, idVisitante);
  const h2hPuntualesLocal = motor.calcularPuntualesNumerico(h2h.partidos, idLocal, statsMap);
  const h2hPuntualesVisitante = motor.calcularPuntualesNumerico(h2h.partidos, idVisitante, statsMap);

  function armarMotor(fuentesEq, actualClave, contrariaClave, h2hGoles, h2hPuntuales) {
    return {
      goles: { actual: fuentesEq[actualClave].goles, contraria: fuentesEq[contrariaClave].goles, liga: fuentesEq.liga.goles, noLiga: fuentesEq.noLiga.goles, temporada: fuentesEq.temporada.goles, forma: fuentesEq.forma.goles, h2h: h2hGoles },
      corners: { actual: fuentesEq[actualClave].corners, contraria: fuentesEq[contrariaClave].corners, liga: fuentesEq.liga.corners, noLiga: fuentesEq.noLiga.corners, temporada: fuentesEq.temporada.corners, forma: fuentesEq.forma.corners, h2h: h2hPuntuales.corners },
      amarillas: { actual: fuentesEq[actualClave].amarillas, contraria: fuentesEq[contrariaClave].amarillas, liga: fuentesEq.liga.amarillas, noLiga: fuentesEq.noLiga.amarillas, temporada: fuentesEq.temporada.amarillas, forma: fuentesEq.forma.amarillas, h2h: h2hPuntuales.amarillas },
      faltas: { actual: fuentesEq[actualClave].faltas, contraria: fuentesEq[contrariaClave].faltas, liga: fuentesEq.liga.faltas, noLiga: fuentesEq.noLiga.faltas, temporada: fuentesEq.temporada.faltas, forma: fuentesEq.forma.faltas, h2h: h2hPuntuales.faltas },
    };
  }

  const motorLocal = armarMotor(fuentesLocal, "local", "visitante", h2hGolesLocal, h2hPuntualesLocal);
  const motorVisitante = armarMotor(fuentesVisitante, "visitante", "local", h2hGolesVisitante, h2hPuntualesVisitante);

  const enVerde = [];
  ["goles", "corners", "amarillas", "faltas"].forEach((mercado) => {
    const lambdaLocal = motor.calcularValorEsperado(motorLocal[mercado], esPartidoLiga);
    const lambdaVisitante = motor.calcularValorEsperado(motorVisitante[mercado], esPartidoLiga);
    if (lambdaLocal === null || lambdaVisitante === null) return;
    const lambdaTotal = lambdaLocal + lambdaVisitante;
    motor.LINEAS_MERCADOS[mercado].forEach((linea) => {
      const prob = motor.probabilidadOver(lambdaTotal, linea);
      if (prob !== null && prob >= 0.7) {
        enVerde.push({ mercado, linea, prob });
      }
    });
  });

  return enVerde;
}

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
      .select("user_id, notif_activadas, notif_gol, notif_empieza, notif_termina, notif_tarjetas, notif_semaforo")
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

      // --- Semáforo verde: solo si alguien realmente lo pidió, porque es lo que
      // más cuota gasta de todo el vigilante (trae historial completo de ambos equipos) ---
      const interesadosEnSemaforo = usuariosConPreferencia(usuariosAmbos, "notif_semaforo");
      if (interesadosEnSemaforo.length > 0) {
        try {
          const enVerde = await calcularMercadosEnVerde(partido);
          for (const item of enVerde) {
            const { data: yaExiste } = await supabaseAdmin
              .from("alertas_semaforo_enviadas")
              .select("id")
              .eq("fixture_id", fixtureId)
              .eq("mercado", item.mercado)
              .eq("linea", item.linea)
              .maybeSingle();
            if (yaExiste) continue;

            const { error: errorInsert } = await supabaseAdmin
              .from("alertas_semaforo_enviadas")
              .insert({ fixture_id: fixtureId, mercado: item.mercado, linea: item.linea });
            if (errorInsert) continue; // ya lo insertó otra ejecución en paralelo, no duplicar

            eventosAEnviar.push({
              userIds: interesadosEnSemaforo,
              titulo: "Semáforo en verde",
              cuerpo: `${marcador}\n${item.mercado} Over ${item.linea}: ${Math.round(item.prob * 100)}%`,
            });
          }
        } catch {
          // si falla el cálculo del semáforo para este partido, seguimos con el resto
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
