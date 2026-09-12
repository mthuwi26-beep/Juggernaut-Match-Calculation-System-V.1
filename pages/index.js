import React, { useState, useEffect, useRef } from "react";
import Head from "next/head";
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

// Códigos ISO de los mismos países de arriba, para pedirle la bandera como IMAGEN a flagcdn.com
// (gratis, sin key, no ocupa espacio en nuestra base). Solo se usa cuando la API no nos manda
// ya una URL de bandera propia (eso pasa con equipos, no con partidos/ligas).
const CODIGOS_ISO_PAISES = {
  Argentina: "ar", Brazil: "br", Spain: "es", England: "gb-eng", Italy: "it",
  Germany: "de", France: "fr", Portugal: "pt", Mexico: "mx", Colombia: "co",
  Chile: "cl", Uruguay: "uy", Peru: "pe", Ecuador: "ec", "United-States": "us",
  Netherlands: "nl", Belgium: "be", Turkey: "tr", Japan: "jp", "South-Korea": "kr",
  Paraguay: "py", Bolivia: "bo", Venezuela: "ve", "Costa-Rica": "cr", Honduras: "hn",
  Panama: "pa", Guatemala: "gt", Russia: "ru", Ukraine: "ua", Poland: "pl",
  Croatia: "hr", Serbia: "rs", Switzerland: "ch", Austria: "at", Scotland: "gb-sct",
  Wales: "gb-wls", Ireland: "ie", Denmark: "dk", Sweden: "se", Norway: "no",
  Greece: "gr", Egypt: "eg", Morocco: "ma", Nigeria: "ng", Senegal: "sn",
  "Saudi-Arabia": "sa", Qatar: "qa", "United-Arab-Emirates": "ae", China: "cn",
  India: "in", Australia: "au",
};

// Bandera como imagen real (reemplaza los emoji 🇦🇷 que en PC/Windows a veces se ven como texto "AR").
// Prioridad: 1) la URL que ya nos manda la API en el partido (league.flag), 2) nuestro propio mapa por
// código ISO vía flagcdn.com, 3) no muestra nada (mejor vacío que un ícono roto o equivocado).
function BanderaPais({ pais, url, size = 16 }) {
  const codigo = pais ? CODIGOS_ISO_PAISES[pais] : null;
  const src = url || (codigo ? `https://flagcdn.com/w80/${codigo}.png` : null);
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      width={size}
      style={{ height: "auto", borderRadius: 2, verticalAlign: "middle", display: "inline-block" }}
      onError={(e) => { e.target.style.display = "none"; }}
    />
  );
}

// Íconos propios en SVG (línea fina, estilo consistente) para reemplazar los emoji sueltos.
// La idea: mismo significado, pero con un trazo propio de la marca en vez del emoji del sistema operativo.
const ICONOS_SVG = {
  hogar: <><path d="M3 10.5L12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9.5 21v-6h5v6" /></>,
  barras: <><rect x="3.5" y="12" width="4" height="8.5" /><rect x="10" y="7" width="4" height="13.5" /><rect x="16.5" y="3" width="4" height="17.5" /></>,
  estrella: <path d="M12 2.5l3 6.2 6.7.9-4.9 4.7 1.2 6.7-6-3.2-6 3.2 1.2-6.7-4.9-4.7 6.7-.9z" />,
  calendario: <><rect x="3" y="5" width="18" height="16" rx="2" /><line x1="16" y1="3" x2="16" y2="7" /><line x1="8" y1="3" x2="8" y2="7" /><line x1="3" y1="10" x2="21" y2="10" /></>,
  balon: <><circle cx="12" cy="12" r="9" /><path d="M12 7.3l3 2.2-1.1 3.6h-3.8l-1.1-3.6z" /><path d="M12 3v4.3M5 7.8l2.5 1.6M5 16.2l2.9-.8M19 7.8l-2.5 1.6M19 16.2l-2.9-.8M12 21v-4" /></>,
  trofeo: <><path d="M7 4h10v4a5 5 0 0 1-10 0z" /><path d="M7 5H4a3 3 0 0 0 3 4" /><path d="M17 5h3a3 3 0 0 1-3 4" /><line x1="12" y1="13" x2="12" y2="17" /><line x1="8" y1="20" x2="16" y2="20" /><line x1="9" y1="17" x2="15" y2="17" /></>,
  campana: <><path d="M6 9a6 6 0 0 1 12 0c0 6 2 8 2 8H4s2-2 2-8" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  campanaTachada: <><path d="M6 9a6 6 0 0 1 10.5-4" /><path d="M18 9c0 6 2 8 2 8H7" /><path d="M4 17s1.2-1.2 1.7-3.3" /><path d="M10 20a2 2 0 0 0 4 0" /><line x1="3" y1="3" x2="21" y2="21" /></>,
  disquete: <><path d="M5 3h11l3 3v15H5z" /><rect x="8" y="3" width="7" height="5" /><rect x="7.5" y="13" width="9" height="7" /></>,
  banderin: <><line x1="5" y1="3" x2="5" y2="21" /><path d="M5 4h12l-3.2 4L17 12H5" /></>,
  tarjeta: <rect x="6" y="3" width="12" height="18" rx="2" />,
  semaforo: <><rect x="8.5" y="2" width="7" height="19" rx="3.5" /><circle cx="12" cy="6.3" r="1.4" /><circle cx="12" cy="11.5" r="1.4" /><circle cx="12" cy="16.7" r="1.4" /></>,
  chat: <path d="M4 4h16v12.5H9L4 20.5z" />,
  cerrar: <><line x1="5.5" y1="5.5" x2="18.5" y2="18.5" /><line x1="18.5" y1="5.5" x2="5.5" y2="18.5" /></>,
  objetivo: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" /></>,
  porteria: <><rect x="4" y="5" width="16" height="11" /><line x1="8.6" y1="5" x2="8.6" y2="16" /><line x1="13.2" y1="5" x2="13.2" y2="16" /><line x1="17.8" y1="5" x2="17.8" y2="16" /><line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="12.5" x2="20" y2="12.5" /></>,
  portapapeles: <><rect x="6" y="4" width="12" height="17" rx="2" /><rect x="9" y="2" width="6" height="4" rx="1" /><line x1="9" y1="11.5" x2="15" y2="11.5" /><line x1="9" y1="15.5" x2="15" y2="15.5" /></>,
  estadio: <><path d="M12 21s7-7.4 7-12.2A7 7 0 0 0 5 8.8C5 13.6 12 21 12 21z" /><circle cx="12" cy="8.8" r="2.6" /></>,
  balanza: <><line x1="12" y1="3" x2="12" y2="21" /><line x1="5" y1="7" x2="19" y2="7" /><path d="M5 7l-3 6a3 3 0 0 0 6 0z" /><path d="M19 7l-3 6a3 3 0 0 0 6 0z" /></>,
  termometro: <path d="M12 3.5a2 2 0 0 0-2 2v9.3a4 4 0 1 0 4 0V5.5a2 2 0 0 0-2-2z" />,
  lluvia: <><path d="M6.5 15a4 4 0 0 1 .6-7.9 5.3 5.3 0 0 1 10.2 1.6A3.6 3.6 0 0 1 17 15z" /><line x1="9" y1="18" x2="9" y2="21.5" /><line x1="13" y1="18" x2="13" y2="21.5" /><line x1="17" y1="18" x2="17" y2="21.5" /></>,
  viento: <><path d="M3 8h11.5a2.5 2.5 0 1 0-2.5-2.5" /><path d="M3 12.5h15.5a2.5 2.5 0 1 1-2.5 2.5" /><path d="M3 17h9.5" /></>,
  gota: <path d="M12 3s6.2 7.2 6.2 11.2a6.2 6.2 0 1 1-12.4 0C5.8 10.2 12 3 12 3z" />,
  llave: <><circle cx="7.5" cy="15" r="4" /><line x1="10.8" y1="11.7" x2="20" y2="2.5" /><line x1="15.3" y1="7.2" x2="18.3" y2="10.2" /><line x1="12.3" y1="10.2" x2="15.3" y2="13.2" /></>,
  camara: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8.5 7l1.7-2.7h3.6L15.5 7" /><circle cx="12" cy="13.3" r="3.7" /></>,
  apreton: <><circle cx="7" cy="12" r="4" /><circle cx="17" cy="12" r="4" /><line x1="11" y1="12" x2="13" y2="12" /></>,
  foco: <><path d="M9.3 18h5.4" /><path d="M10 21h4" /><path d="M12 3.5a6.2 6.2 0 0 0-4 11c.7.6 1 1.3 1 2.4h6c0-1.1.3-1.8 1-2.4a6.2 6.2 0 0 0-4-11z" /></>,
  grafico: <><polyline points="3 17 9 11 13 15 21 6" /><polyline points="15 6 21 6 21 12" /></>,
  check: <polyline points="4 12.5 9 17.5 20 6" />,
  sol: <><circle cx="12" cy="12" r="4" /><line x1="12" y1="2.5" x2="12" y2="5.3" /><line x1="12" y1="18.7" x2="12" y2="21.5" /><line x1="2.5" y1="12" x2="5.3" y2="12" /><line x1="18.7" y1="12" x2="21.5" y2="12" /><line x1="4.9" y1="4.9" x2="6.9" y2="6.9" /><line x1="17.1" y1="17.1" x2="19.1" y2="19.1" /><line x1="4.9" y1="19.1" x2="6.9" y2="17.1" /><line x1="17.1" y1="6.9" x2="19.1" y2="4.9" /></>,
  luna: <path d="M20.5 13.2A8.8 8.8 0 1 1 10.8 3.5a7 7 0 0 0 9.7 9.7z" />,
  refrescar: <><path d="M20.5 12a8.5 8.5 0 1 1-2.8-6.3" /><polyline points="20.5 3 20.5 8.5 15 8.5" /></>,
  exclamacion: <><path d="M12 3.5l9.5 16.5H2.5z" /><line x1="12" y1="9.3" x2="12" y2="14" /><circle cx="12" cy="17.2" r="0.9" fill="currentColor" stroke="none" /></>,
  flecha: <><line x1="4" y1="12" x2="19" y2="12" /><polyline points="13.5 6 19.5 12 13.5 18" /></>,
  corona: <><path d="M3.5 8.3l3.6 2.7L12 4.5l4.9 6.5 3.6-2.7L19 18.3H5z" /><line x1="5" y1="18.3" x2="19" y2="18.3" /></>,
  persona: <><circle cx="12" cy="8" r="4" /><path d="M4.3 20.5c0-4.1 3.9-6.3 7.7-6.3s7.7 2.2 7.7 6.3" /></>,
  menu: <><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></>,
  candado: <><rect x="5.5" y="11" width="13" height="9.5" rx="2" /><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" /></>,
  moneda: <><circle cx="12" cy="12" r="9" /><line x1="12" y1="6.5" x2="12" y2="17.5" /><path d="M15 9.3c0-1.3-1.3-2.3-3-2.3s-3 1-3 2.3 1.3 1.8 3 2.3 3 1 3 2.3-1.3 2.3-3 2.3-3-1-3-2.3" /></>,
  puntoLleno: <circle cx="12" cy="12" r="6.5" fill="currentColor" stroke="none" />,
};

function Icono({ tipo, size = 15, color = "currentColor", style }) {
  const contenido = ICONOS_SVG[tipo];
  if (!contenido) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ verticalAlign: "middle", flexShrink: 0, ...style }}
    >
      {contenido}
    </svg>
  );
}

// Los países más "famosos" en fútbol — la fila de accesos rápidos de Inicio muestra estos primero
const PAISES_POPULARES = [
  "Argentina", "Brazil", "Spain", "England", "Italy", "Germany",
  "France", "Portugal", "Mexico", "Colombia", "Chile", "Uruguay",
];

// El usuario busca en español; la API guarda el país en inglés — esta tabla los conecta
const PAISES_ES_A_EN = {
  colombia: "Colombia", argentina: "Argentina", brasil: "Brazil", brazil: "Brazil",
  españa: "Spain", espana: "Spain", spain: "Spain", inglaterra: "England", england: "England",
  italia: "Italy", italy: "Italy", alemania: "Germany", germany: "Germany",
  francia: "France", france: "France", portugal: "Portugal", mexico: "Mexico", méxico: "Mexico",
  chile: "Chile", uruguay: "Uruguay",
};

// Equipos famosos por país — lista curada a mano (la API no ofrece esto como dato),
// solo cubre los países populares de arriba.
const EQUIPOS_FAMOSOS_POR_PAIS = {
  Argentina: ["River Plate", "Boca Juniors", "Racing Club", "Independiente"],
  Brazil: ["Flamengo", "Palmeiras", "Corinthians", "Sao Paulo"],
  Spain: ["Real Madrid", "Barcelona", "Atletico Madrid", "Sevilla"],
  England: ["Manchester United", "Liverpool", "Arsenal", "Chelsea"],
  Italy: ["Juventus", "AC Milan", "Inter", "AS Roma"],
  Germany: ["Bayern Munich", "Borussia Dortmund", "RB Leipzig", "Bayer Leverkusen"],
  France: ["Paris Saint Germain", "Marseille", "Lyon", "Monaco"],
  Portugal: ["Benfica", "Porto", "Sporting CP"],
  Mexico: ["America", "Chivas", "Cruz Azul", "Pumas UNAM"],
  Colombia: ["Millonarios", "Atletico Nacional", "America de Cali", "Junior"],
  Chile: ["Colo-Colo", "Universidad de Chile", "Universidad Catolica"],
  Uruguay: ["Penarol", "Nacional"],
};

const VERDE_MARCA = "#1E5631";
// Traducción del "esqueleto" de la app (menú, pestañas, botones principales).
// Las etiquetas internas de estadísticas siguen en español por ahora (fase 2 de traducción).
const TEXTOS = {
  es: {
    inicio: "Inicio", estudio: "Estudio", favoritos: "Favoritos",
    registrarse: "Registrarse", iniciarSesion: "Iniciar sesión", cerrarSesion: "Cerrar sesión",
    buscar: "Buscar", local: "Local", visitante: "Visitante",
    menuInicio: "Inicio", menuMisEstudios: "Mis estudios", menuFavoritos: "Favoritos",
    menuHistorial: "Historial de aciertos", menuAjustes: "Ajustes",
    buscarEquipoPlaceholder: "Busca un equipo (ej: Barcelona)",
    // Etiquetas de estadísticas (las que más se repiten en toda la app)
    record: "Récord (V-E-D)", golesFavor: "Goles a favor (prom.)", golesContra: "Goles en contra (prom.)",
    over25: "% Over 2.5", btts: "% BTTS", corners: "Córners (prom.)", tarjetasAm: "Tarjetas am. (prom.)",
    faltas: "Faltas (prom.)", posesion: "Posesión (prom.)", ultimos5: "Últimos 5",
    comoLocal: "Como Local", comoVisitante: "Como Visitante", ligaActual: "Liga actual",
    noLiga: "No liga (copas)", formaReciente: "Forma reciente (5)", sinDatos: "Sin datos.",
    sinPartidos: "Sin partidos.", fecha: "Fecha", partido: "Partido", resultado: "Res.",
    proximosEncuentros: "Próximos encuentros",
    // Semáforo y mercados
    golesTotales: "Goles totales del partido", ambosAnotan: "Ambos anotan (BTTS)",
    ganadorPartido: "Ganador del partido", cornersTotales: "Córners totales del partido",
    amarillasTotales: "Tarjetas amarillas totales", faltasTotales: "Faltas totales del partido",
    empate: "Empate", datosGenerales: "Datos generales del encuentro", arbitro: "Árbitro",
    sinDatosCorto: "Sin datos", guardarPronostico: "Guardar este pronóstico en mi historial",
    pronosticoGuardado: "Pronóstico guardado en tu historial",
    // Fase 2 de traducción — pantallas más visibles
    partidosDeHoy: "Partidos de hoy", buscarPorFecha: "Buscar partidos por fecha",
    calendarioPartidos: "Calendario de partidos", todos: "Todos",
    misFavoritos: "Mis favoritos", sinFavoritosTexto: "Aún no tienes equipos favoritos. Toca la estrella junto al nombre de un equipo para guardarlo aquí.",
    editarPerfil: "Editar perfil", panelAdmin: "Panel de administrador",
    historialAciertos: "Historial de aciertos", pronosticoYSemaforo: "Pronóstico y semáforo",
    calculadoraValor: "Calculadora de valor", valorSi: "Podría tener valor", valorNo: "No parece tener valor",
    guardado: "Guardado", guardando: "Guardando...", guardarEnHistorial: "Guardar en mi Historial",
    estudioClimatico: "Estudio Climático Personalizado", conEstudioClimatico: "Con mi Estudio Climático:",
    avisarSemaforoVerde: "Avisarme cuando haya semáforo verde",
    seleccionNacionalLabel: "Selección nacional:", equiposFamosos: "Equipos más famosos:",
    alineacionesConfirmadas: "Alineaciones confirmadas", statsEnVivo: "Estadísticas en vivo",
    statsReales: "Estadísticas reales de este encuentro",
    cornersCorto: "Córners", amarillasCorto: "Amarillas", rojasCorto: "Rojas",
    faltasCorto: "Faltas", posesionCorto: "Posesión", tirosTotalesCorto: "Tiros totales", tirosPuertaCorto: "Tiros a puerta",
    goles: "Goles", ambosAnotanChip: "Ambos anotan", ganadorChip: "Ganador",
    subirFoto: "Subir mi propia foto", perfilActualizado: "Perfil actualizado.",
    chatTitulo: "IA sobre este partido", chatSugerencia: 'Ej: "¿Qué opinas de este partido?", "¿Ves valor en el over de goles?", "¿Qué equipo ves más sólido?"',
    chatPensando: "Pensando...", chatPlaceholder: "Escribe tu pregunta sobre el partido...",
    chatEnviar: "Enviar", chatErrorConexion: "No se pudo conectar con la IA",
    panelAdminCargando: "Cargando panel...", panelAdminUsuarios: "Usuarios registrados",
    panelAdminEstudios: "Estudios guardados", panelAdminAciertos: "% de aciertos (verificados)",
    panelAdminFavoritos: "Equipos en favoritos", panelAdminSinDatos: "Sin datos aún",
    comoLocalVisitante: "Como Local / Como Visitante",
    tutClimaTitulo: "¿Cuánto pesa cada punto?",
    tutClimaTexto: "Cada punto de diferencia que muevas (0 a 10) equivale aproximadamente a un 1.5% de cambio en la probabilidad de ese equipo — es nuestra propia fórmula, no un dato científicamente validado. Además, cada mercado reacciona distinto: por ejemplo, más viento baja nuestra estimación de goles pero sube la de córners, porque asumimos más centros mal ejecutados. El punto de JMCS (fijo) siempre representa el clima real; el tuyo es tu propio criterio.",
    tutInicioTitulo: "Bienvenido a Inicio",
    tutInicioTexto: "Aquí ves los partidos del día agrupados por país. Busca un equipo o un país arriba (aparecen resultados mientras escribes), o toca cualquier tarjeta de partido para abrir su Estudio completo.",
    tutFavoritosTitulo: "Tus equipos favoritos",
    tutFavoritosTexto: "Guarda cualquier equipo tocando la estrella junto a su nombre, en cualquier parte de la app. Aquí los verás todos juntos — toca uno para ver su perfil completo.",
    tutEstudioTitulo: "Cómo funciona Estudio",
    tutEstudioTexto: "Elige un partido del calendario a la izquierda, o busca Local y Visitante a mano abajo. Comparamos sus estadísticas reales y calculamos un semáforo de probabilidades — verde es más probable, rojo menos.",
    ajustesTitulo: "Ajustes", prefsNotifTitulo: "Preferencias de notificaciones",
    prefsNotifDesc: "Avisos de los partidos de tus equipos favoritos que tengan la campana activada. Funciona mientras el navegador esté instalado o abierto — en iPhone, solo si agregaste la app a tu pantalla de inicio (Safari 16.4 o más nuevo).",
    notifNoSoportado: "Tu navegador no soporta notificaciones push. Probá desde Chrome o Firefox en Android, o instalando la app en la pantalla de inicio en iPhone (Safari 16.4+).",
    notifSinPermiso: "No diste permiso de notificaciones — no vamos a poder avisarte.",
    notifActivadasMsg: "Notificaciones activadas.", notifErrorActivar: "No se pudieron activar las notificaciones. Intenta de nuevo.",
    notifDesactivadasMsg: "Notificaciones desactivadas.", notifErrorDesactivar: "No se pudo desactivar. Intenta de nuevo.",
    notifErrorGuardar: "No se pudo guardar el cambio. Intenta de nuevo.",
    unMomento: "Un momento...", desactivarNotif: "Desactivar notificaciones", activarNotif: "Activar notificaciones",
    notifGol: "Gol", notifEmpieza: "Empieza el partido", notifTermina: "Termina el partido", notifTarjetas: "Tarjetas",
    notifSemaforoEtiqueta: "Semáforo en verde", notifSemaforoAviso: "Puede tardar un poco más en avisar (revisamos el historial completo de ambos equipos antes de calcular el semáforo).",
  },
  en: {
    inicio: "Home", estudio: "Study", favoritos: "Favorites",
    registrarse: "Sign up", iniciarSesion: "Log in", cerrarSesion: "Log out",
    buscar: "Search", local: "Home", visitante: "Away",
    menuInicio: "Home", menuMisEstudios: "My studies", menuFavoritos: "Favorites",
    menuHistorial: "Track record", menuAjustes: "Settings",
    buscarEquipoPlaceholder: "Search a team (e.g. Barcelona)",
    record: "Record (W-D-L)", golesFavor: "Goals for (avg.)", golesContra: "Goals against (avg.)",
    over25: "% Over 2.5", btts: "% BTTS", corners: "Corners (avg.)", tarjetasAm: "Yellow cards (avg.)",
    faltas: "Fouls (avg.)", posesion: "Possession (avg.)", ultimos5: "Last 5",
    comoLocal: "As Home", comoVisitante: "As Away", ligaActual: "Current league",
    noLiga: "Non-league (cups)", formaReciente: "Recent form (5)", sinDatos: "No data.",
    sinPartidos: "No matches.", fecha: "Date", partido: "Match", resultado: "Res.",
    proximosEncuentros: "Upcoming matches",
    golesTotales: "Total match goals", ambosAnotan: "Both teams score (BTTS)",
    ganadorPartido: "Match winner", cornersTotales: "Total match corners",
    amarillasTotales: "Total yellow cards", faltasTotales: "Total match fouls",
    empate: "Draw", datosGenerales: "Match general info", arbitro: "Referee",
    sinDatosCorto: "No data", guardarPronostico: "Save this prediction to my history",
    pronosticoGuardado: "Prediction saved to your history",
    // Phase 2 translation — most visible screens
    partidosDeHoy: "Today's matches", buscarPorFecha: "Search matches by date",
    calendarioPartidos: "Match calendar", todos: "All",
    misFavoritos: "My favorites", sinFavoritosTexto: "You don't have any favorite teams yet. Tap the star next to a team's name to save it here.",
    editarPerfil: "Edit profile", panelAdmin: "Admin panel",
    historialAciertos: "Track record", pronosticoYSemaforo: "Prediction and traffic light",
    calculadoraValor: "Value calculator", valorSi: "Could have value", valorNo: "Doesn't seem to have value",
    guardado: "Saved", guardando: "Saving...", guardarEnHistorial: "Save to my History",
    estudioClimatico: "Personalized Weather Study", conEstudioClimatico: "With my Weather Study:",
    avisarSemaforoVerde: "Notify me when it hits green light",
    seleccionNacionalLabel: "National team:", equiposFamosos: "Most famous teams:",
    alineacionesConfirmadas: "Confirmed lineups", statsEnVivo: "Live stats",
    statsReales: "Real stats for this match",
    cornersCorto: "Corners", amarillasCorto: "Yellow cards", rojasCorto: "Red cards",
    faltasCorto: "Fouls", posesionCorto: "Possession", tirosTotalesCorto: "Total shots", tirosPuertaCorto: "Shots on target",
    goles: "Goals", ambosAnotanChip: "Both teams score", ganadorChip: "Winner",
    subirFoto: "Upload my own photo", perfilActualizado: "Profile updated.",
    chatTitulo: "AI about this match", chatSugerencia: 'E.g.: "What do you think of this match?", "Do you see value in over goals?", "Which team looks stronger?"',
    chatPensando: "Thinking...", chatPlaceholder: "Type your question about the match...",
    chatEnviar: "Send", chatErrorConexion: "Could not connect to the AI",
    panelAdminCargando: "Loading panel...", panelAdminUsuarios: "Registered users",
    panelAdminEstudios: "Saved studies", panelAdminAciertos: "% correct (verified)",
    panelAdminFavoritos: "Teams in favorites", panelAdminSinDatos: "No data yet",
    comoLocalVisitante: "As Home / As Away",
    tutClimaTitulo: "How much does each point weigh?",
    tutClimaTexto: "Each point of difference you move (0 to 10) is roughly a 1.5% change in that team's probability — it's our own formula, not a scientifically validated figure. Also, each market reacts differently: for example, more wind lowers our goals estimate but raises corners, since we assume more mis-hit crosses. The JMCS point (fixed) always represents the real weather; yours is your own judgment.",
    tutInicioTitulo: "Welcome to Home",
    tutInicioTexto: "Here you see today's matches grouped by country. Search for a team or country above (results appear as you type), or tap any match card to open its full Study.",
    tutFavoritosTitulo: "Your favorite teams",
    tutFavoritosTexto: "Save any team by tapping the star next to its name, anywhere in the app. Here you'll see them all together — tap one to see its full profile.",
    tutEstudioTitulo: "How Study works",
    tutEstudioTexto: "Pick a match from the calendar on the left, or search Home and Away manually below. We compare their real stats and calculate a probability traffic light — green is more likely, red less.",
    ajustesTitulo: "Settings", prefsNotifTitulo: "Notification preferences",
    prefsNotifDesc: "Alerts for matches of your favorite teams that have the bell turned on. Works while the browser is installed or open — on iPhone, only if you added the app to your home screen (Safari 16.4 or newer).",
    notifNoSoportado: "Your browser doesn't support push notifications. Try Chrome or Firefox on Android, or install the app to your home screen on iPhone (Safari 16.4+).",
    notifSinPermiso: "You didn't grant notification permission — we won't be able to notify you.",
    notifActivadasMsg: "Notifications enabled.", notifErrorActivar: "Couldn't enable notifications. Try again.",
    notifDesactivadasMsg: "Notifications disabled.", notifErrorDesactivar: "Couldn't disable. Try again.",
    notifErrorGuardar: "Couldn't save the change. Try again.",
    unMomento: "One moment...", desactivarNotif: "Disable notifications", activarNotif: "Enable notifications",
    notifGol: "Goal", notifEmpieza: "Match starts", notifTermina: "Match ends", notifTarjetas: "Cards",
    notifSemaforoEtiqueta: "Green light", notifSemaforoAviso: "May take a bit longer to alert (we check both teams' full history before calculating the traffic light).",
  },
};

// Función de traducción accesible desde cualquier componente del archivo.
// Lee el idioma actual de una variable simple que Home mantiene actualizada en cada render,
// así no hay que pasar "idioma" como prop por cada componente de la app.
let IDIOMA_ACTUAL = "es";
function traducir(clave) {
  return TEXTOS[IDIOMA_ACTUAL]?.[clave] || TEXTOS.es[clave] || clave;
}

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
    corners: { home: extraerStat(statsHome, "Corner Kicks"), away: extraerStat(statsAway, "Corner Kicks") },
    amarillas: { home: extraerStat(statsHome, "Yellow Cards"), away: extraerStat(statsAway, "Yellow Cards") },
    rojas: { home: extraerStat(statsHome, "Red Cards"), away: extraerStat(statsAway, "Red Cards") },
    faltas: { home: extraerStat(statsHome, "Fouls"), away: extraerStat(statsAway, "Fouls") },
    posesion: { home: extraerStat(statsHome, "Ball Possession"), away: extraerStat(statsAway, "Ball Possession") },
    tirosTotales: { home: extraerStat(statsHome, "Total Shots"), away: extraerStat(statsAway, "Total Shots") },
    tirosPuerta: { home: extraerStat(statsHome, "Shots on Goal"), away: extraerStat(statsAway, "Shots on Goal") },
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
// para UN equipo, con valor y N de cada estadística (goles, córners, amarillas, faltas).
// Si se pasa "competicionExacta" ({id, season} del partido que se está estudiando), la fuente
// "liga" deja de ser "cualquier partido de liga" y pasa a ser SOLO esa competición+temporada
// exacta — más preciso, aunque con menos partidos de muestra. El motor de pesos (más abajo)
// ya baja el peso solo con pocos partidos, así que no hace falta un mínimo fijo.
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

// Doble oportunidad: no es un cálculo nuevo, es una suma directa de las probabilidades de 1X2
// que ya tenemos (1X = Local o Empate, 12 = Local o Visitante, X2 = Empate o Visitante).
function probabilidadDobleOportunidad(p1X2) {
  if (!p1X2) return null;
  return {
    p1X: p1X2.pLocal + p1X2.pEmpate,
    p12: p1X2.pLocal + p1X2.pVisitante,
    pX2: p1X2.pEmpate + p1X2.pVisitante,
  };
}

// Marcador exacto: usa la misma matriz de Poisson independiente que ya usamos para 1X2,
// pero en vez de agrupar en Local/Empate/Visitante, guarda cada combinación de goles.
// Devuelve los marcadores más probables ordenados de mayor a menor.
function probabilidadMarcadorExacto(lambdaLocal, lambdaVisitante, maxGoles = 6, top = 5) {
  if (lambdaLocal === null || lambdaVisitante === null) return null;
  const resultados = [];
  for (let i = 0; i <= maxGoles; i++) {
    for (let j = 0; j <= maxGoles; j++) {
      resultados.push({ local: i, visitante: j, prob: poissonProb(lambdaLocal, i) * poissonProb(lambdaVisitante, j) });
    }
  }
  resultados.sort((a, b) => b.prob - a.prob);
  return resultados.slice(0, top);
}

// Líneas de hándicap asiático disponibles para elegir (desde el punto de vista del Local:
// negativo = el Local tiene que ganar por esa diferencia; positivo = arranca con esa ventaja).
const LINEAS_HANDICAP = [-2, -1.5, -1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1, 1.5, 2];

// Hándicap asiático — metodología estándar de casas de apuestas: en líneas "enteras" (0, ±1, ±2...)
// puede haber "push" (se devuelve la apuesta si el resultado ajustado queda exacto en 0). En líneas
// de cuarto (.25/.75) la apuesta se reparte 50/50 entre las dos líneas vecinas de .5 — acá mostramos
// el promedio de cubrir esas dos líneas, que es la forma simplificada en la que lo mostramos (no es
// una simulación exacta de devolución de apuesta, es nuestra forma de resumirlo en un solo %).
function probabilidadHandicapAsiatico(lambdaLocal, lambdaVisitante, lineaLocal, maxGoles = 10) {
  if (lambdaLocal === null || lambdaVisitante === null) return null;

  function calcularLineaSimple(linea) {
    let cubre = 0, push = 0, noCubre = 0;
    for (let i = 0; i <= maxGoles; i++) {
      for (let j = 0; j <= maxGoles; j++) {
        const p = poissonProb(lambdaLocal, i) * poissonProb(lambdaVisitante, j);
        const diff = i - j + linea;
        if (diff > 0) cubre += p;
        else if (diff === 0) push += p;
        else noCubre += p;
      }
    }
    return { cubre, push, noCubre };
  }

  const fraccion = Math.abs(lineaLocal % 1);
  const esLineaCuarto = Math.abs(fraccion - 0.25) < 0.001 || Math.abs(fraccion - 0.75) < 0.001;

  if (!esLineaCuarto) {
    const r = calcularLineaSimple(lineaLocal);
    return { probCubre: r.cubre, probPush: r.push, probNoCubre: r.noCubre, esLineaCuarto: false };
  }

  const lineaBaja = Math.floor(lineaLocal * 2) / 2;
  const lineaAlta = lineaBaja + 0.5;
  const r1 = calcularLineaSimple(lineaBaja);
  const r2 = calcularLineaSimple(lineaAlta);
  return {
    probCubre: (r1.cubre + r2.cubre) / 2,
    probPush: 0,
    probNoCubre: (r1.noCubre + r2.noCubre) / 2,
    esLineaCuarto: true,
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

function MiniTabla({ fixtures, tema, idioma = "es" }) {
  if (!fixtures || fixtures.length === 0) {
    return <p style={{ color: tema.textoSuave, fontSize: 12 }}>{traducir("sinPartidos")}</p>;
  }
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, marginTop: 8 }}>
      <thead>
        <tr style={{ background: tema.encabezadoTabla, textAlign: "left" }}>
          <th style={{ padding: 4 }}>{traducir("fecha")}</th>
          <th style={{ padding: 4 }}>{traducir("partido")}</th>
          <th style={{ padding: 4 }}>{traducir("resultado")}</th>
        </tr>
      </thead>
      <tbody>
        {fixtures.map((f) => (
          <tr key={f.fixture.id} style={{ borderBottom: `1px solid ${tema.filaBorde}` }}>
            <td style={{ padding: 4 }}>{new Date(f.fixture.date).toLocaleDateString(idioma === "en" ? "en-US" : "es-ES")}</td>
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

function SubPanel({ titulo, fixtures, teamId, statsMap, tema, acento, idioma = "es" }) {
  const statsGoles = calcularEstadisticasGoles(fixtures, teamId);
  const statsPuntuales = calcularEstadisticasPuntuales(fixtures, teamId, statsMap);

  return (
    <div style={{ flex: 1, minWidth: 200 }}>
      <h4 style={{ marginBottom: 6, fontSize: 12, color: acento }}>{titulo}</h4>
      {statsGoles ? (
        <div style={{ padding: 10, paddingTop: 8, background: tema.panel, borderRadius: 4, borderTop: `3px solid ${acento}`, fontSize: 12 }}>
          <FilaStat etiqueta={traducir("record")} valor={`${statsGoles.victorias}-${statsGoles.empates}-${statsGoles.derrotas}`} />
          <FilaStat etiqueta={traducir("golesFavor")} valor={statsGoles.promedioGolesFavor} />
          <FilaStat etiqueta={traducir("golesContra")} valor={statsGoles.promedioGolesContra} />
          <FilaStat etiqueta={traducir("over25")} valor={`${statsGoles.over25Pct}%`} />
          <FilaStat etiqueta={traducir("btts")} valor={`${statsGoles.bttsPct}%`} />
          {statsPuntuales && (
            <>
              <div style={{ borderTop: `1px solid ${tema.borde}`, margin: "6px 0" }} />
              <FilaStat etiqueta={traducir("corners")} valor={statsPuntuales.promedioCorners} />
              <FilaStat etiqueta={traducir("tarjetasAm")} valor={statsPuntuales.promedioAmarillas} />
              <FilaStat etiqueta={traducir("faltas")} valor={statsPuntuales.promedioFaltas} />
            </>
          )}
        </div>
      ) : (
        <p style={{ color: tema.textoSuave, fontSize: 12 }}>{traducir("sinDatos")}</p>
      )}
      <MiniTabla fixtures={fixtures} tema={tema} idioma={idioma} />
    </div>
  );
}

function BotonFavorito({ equipo, sesion, tema, onPedirLogin, mostrarToast }) {
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
    try {
      if (esFavorito) {
        const { error } = await supabase.from("favoritos").delete().eq("user_id", sesion.user.id).eq("team_id", equipo.team.id);
        if (error) throw error;
        setEsFavorito(false);
      } else {
        const { error } = await supabase.from("favoritos").insert({
          user_id: sesion.user.id,
          team_id: equipo.team.id,
          team_name: equipo.team.name,
          team_logo: equipo.team.logo,
          team_country: equipo.team.country,
        });
        if (error) throw error;
        setEsFavorito(true);
      }
    } catch (err) {
      mostrarToast && mostrarToast("No se pudo guardar el favorito. Intenta de nuevo.");
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
      <img src={corregirEscudo(favorito.team_logo)} alt={favorito.team_name} style={{ width: 70, height: 70, objectFit: "contain", margin: "0 auto 8px" }} onError={manejarErrorEscudo} />
      <div style={{ fontWeight: "bold", fontSize: 13, marginBottom: 4 }}>{favorito.team_name}</div>
      <div style={{ fontSize: 10, color: tema.textoSuave }}>{favorito.team_country || ""}</div>

      {expandido && (
        <div style={{ marginTop: 10, fontSize: 11, textAlign: "left", borderTop: `1px solid ${tema.borde}`, paddingTop: 8 }}>
          {cargando ? (
            <p style={{ color: tema.textoSuave }}>Cargando...</p>
          ) : stats ? (
            <>
              <FilaStat etiqueta={traducir("record")} valor={`${stats.victorias}-${stats.empates}-${stats.derrotas}`} />
              <FilaStat etiqueta="Goles favor" valor={stats.promedioGolesFavor} />
              <FilaStat etiqueta={traducir("over25")} valor={`${stats.over25Pct}%`} />
              <FilaStat etiqueta={traducir("btts")} valor={`${stats.bttsPct}%`} />
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

function PanelFavoritosPagina({ sesion, tema, acentoMarca, onAbrirPerfil, mostrarToast }) {
  const [favoritos, setFavoritos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [notifActivadas, setNotifActivadas] = useState(false);

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
    supabase
      .from("perfiles")
      .select("notif_activadas")
      .eq("user_id", sesion.user.id)
      .maybeSingle()
      .then(({ data }) => setNotifActivadas(!!data?.notif_activadas));
  }, [sesion]);

  async function quitar(teamId) {
    const { error } = await supabase.from("favoritos").delete().eq("user_id", sesion.user.id).eq("team_id", teamId);
    if (error) {
      mostrarToast && mostrarToast("No se pudo quitar el favorito. Intenta de nuevo.");
      return;
    }
    setFavoritos((prev) => prev.filter((f) => f.team_id !== teamId));
  }

  async function alternarNotificar(teamId, valorActual) {
    if (!valorActual && !notifActivadas) {
      mostrarToast && mostrarToast("Primero activá las notificaciones en Ajustes > Preferencias de notificaciones.");
      return;
    }
    setFavoritos((prev) => prev.map((f) => (f.team_id === teamId ? { ...f, notificar: !valorActual } : f)));
    const { error } = await supabase.from("favoritos").update({ notificar: !valorActual }).eq("user_id", sesion.user.id).eq("team_id", teamId);
    if (error) {
      setFavoritos((prev) => prev.map((f) => (f.team_id === teamId ? { ...f, notificar: valorActual } : f)));
      mostrarToast && mostrarToast("No se pudo guardar el cambio. Intenta de nuevo.");
    }
  }

  return (
    <div>
      <h3 style={{ fontSize: 18, marginBottom: 18, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}><Icono tipo="estrella" size={16} /> {traducir("misFavoritos")}</h3>

      {cargando ? (
        <p style={{ color: tema.textoSuave, textAlign: "center" }}>Cargando...</p>
      ) : favoritos.length === 0 ? (
        <p style={{ color: tema.textoSuave, fontSize: 13, textAlign: "center" }}>
          Aún no tienes equipos favoritos. Toca la estrella junto al nombre de un equipo para guardarlo aquí.
        </p>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center" }}>
          {favoritos.map((f) => (
            <div
              key={f.team_id}
              onClick={() => onAbrirPerfil({ id: f.team_id, name: f.team_name, logo: f.team_logo, country: f.team_country })}
              style={{
                width: 160, background: tema.panel, borderTop: `3px solid ${acentoMarca}`, borderRadius: 8,
                padding: 16, textAlign: "center", cursor: "pointer",
              }}
            >
              <img src={corregirEscudo(f.team_logo)} alt={f.team_name} width={60} height={60} style={{ marginBottom: 10 }} onError={manejarErrorEscudo} />
              <div style={{ fontSize: 13, fontWeight: "bold", marginBottom: 4 }}><BanderaPais pais={f.team_country} size={16} /> {f.team_name}</div>
              {f.team_country && <div style={{ fontSize: 11, color: tema.textoSuave, marginBottom: 10 }}>{f.team_country}</div>}
              <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                <button
                  onClick={(e) => { e.stopPropagation(); alternarNotificar(f.team_id, f.notificar); }}
                  title={f.notificar ? "Dejar de avisarme de este equipo" : "Avisarme de este equipo"}
                  style={{
                    fontSize: 11, background: "transparent", border: `1px solid ${f.notificar ? acentoMarca : tema.borde}`,
                    color: f.notificar ? acentoMarca : tema.textoSuave, borderRadius: 4, padding: "4px 8px", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 4,
                  }}
                >
                  <Icono tipo={f.notificar ? "campana" : "campanaTachada"} size={12} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); quitar(f.team_id); }}
                  style={{ fontSize: 11, background: "transparent", border: `1px solid ${tema.borde}`, color: tema.textoSuave, borderRadius: 4, padding: "4px 8px", cursor: "pointer" }}
                >
                  Quitar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PanelFavoritos({ sesion, tema, acentoMarca, onCerrar, mostrarToast }) {
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
    const { error } = await supabase.from("favoritos").delete().eq("user_id", sesion.user.id).eq("team_id", teamId);
    if (error) {
      mostrarToast && mostrarToast("No se pudo quitar el favorito. Intenta de nuevo.");
      return;
    }
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
          <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 7 }}><Icono tipo="estrella" size={15} /> {traducir("misFavoritos")}</h3>
          <button onClick={onCerrar} style={{ background: "transparent", border: "none", fontSize: 18, cursor: "pointer", color: tema.texto }}><Icono tipo="cerrar" size={16} /></button>
        </div>

        {cargando ? (
          <p style={{ color: tema.textoSuave }}>Cargando...</p>
        ) : favoritos.length === 0 ? (
          <p style={{ color: tema.textoSuave, fontSize: 13 }}>
            {traducir("sinFavoritosTexto")}
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

function BuscadorEquipo({ etiqueta, onEquipoCargado, tema, statsMap, equipoForzado, colorMarca, sesion, onPedirLogin, onAbrirPerfil, mostrarToast, competicionActual }) {
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
        mostrarToast && mostrarToast(data.error);
        setTeams([]);
      } else {
        setTeams(data);
      }
    } catch (err) {
      setError("Error al buscar equipos");
      mostrarToast && mostrarToast("Error al buscar equipos");
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
        mostrarToast && mostrarToast(data.error);
      } else {
        setFixtures(data);
        onEquipoCargado && onEquipoCargado(team, data, !!esDelCalendario);
      }
    } catch (err) {
      setError("Error al traer los partidos");
      mostrarToast && mostrarToast("Error al traer los partidos");
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
  const fixturesLigaActual = competicionActual
    ? fixtures.filter((f) => f.league?.id === competicionActual.id && f.league?.season === competicionActual.season)
    : fixtures.filter((f) => esLiga(f));
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
              <img src={corregirEscudo(t.team.logo)} alt={t.team.name} width={22} height={22} onError={manejarErrorEscudo} />
              <span>{t.team.name} — {t.team.country}</span>
            </div>
          ))}
        </div>
      )}

      {selectedTeam && (
        <div style={{ marginTop: 16, background: colorTenue(colorMarca), borderRadius: 8, padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div
              onClick={() => onAbrirPerfil && onAbrirPerfil(selectedTeam.team)}
              style={{ display: "flex", alignItems: "center", gap: 8, cursor: onAbrirPerfil ? "pointer" : "default" }}
              title="Ver perfil completo del equipo"
            >
              <img src={corregirEscudo(selectedTeam.team.logo)} alt={selectedTeam.team.name} width={26} height={26} onError={manejarErrorEscudo} />
              <strong style={{ color: colorMarca || tema.texto }}><BanderaPais pais={selectedTeam.team.country} size={16} /> {selectedTeam.team.name}</strong>
            </div>
            <BotonFavorito equipo={selectedTeam} sesion={sesion} tema={tema} onPedirLogin={onPedirLogin} mostrarToast={mostrarToast} />
          </div>

          <div className="jmcs-subpaneles-individual" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <SubPanel titulo={traducir("comoLocal")} fixtures={fixturesLocalVenue} teamId={selectedTeam.team.id} statsMap={statsMap} tema={tema} acento={ACENTOS_CATEGORIA.local} />
            <SubPanel titulo={traducir("comoVisitante")} fixtures={fixturesVisitanteVenue} teamId={selectedTeam.team.id} statsMap={statsMap} tema={tema} acento={ACENTOS_CATEGORIA.visitante} />
            <SubPanel titulo={competicionActual?.nombre || traducir("ligaActual")} fixtures={fixturesLigaActual} teamId={selectedTeam.team.id} statsMap={statsMap} tema={tema} acento={ACENTOS_CATEGORIA.liga} />
            <SubPanel titulo={traducir("noLiga")} fixtures={fixturesNoLiga} teamId={selectedTeam.team.id} statsMap={statsMap} tema={tema} acento={ACENTOS_CATEGORIA.noLiga} />
            <SubPanel titulo={traducir("formaReciente")} fixtures={fixturesFormaReciente} teamId={selectedTeam.team.id} statsMap={statsMap} tema={tema} acento={ACENTOS_CATEGORIA.forma} />
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
        <p style={{ fontSize: 11, color: "#c9a227", margin: "0 0 6px", display: "flex", alignItems: "center", gap: 5 }}><Icono tipo="exclamacion" size={13} color="#c9a227" /> {advertenciaMuestra}</p>
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
            <Icono tipo="lluvia" size={13} /> Con estimación de clima — esperado: {lambdaAjustado.toFixed(2)}
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

function CalculadoraValor({ opciones, tema, acento }) {
  const [opcionIndex, setOpcionIndex] = useState(0);
  const [cuota, setCuota] = useState("");

  const opcion = opciones[opcionIndex];
  const cuotaNum = parseFloat(cuota);
  const probImplicita = cuotaNum > 1 ? (1 / cuotaNum) * 100 : null;
  const nuestraProb = opcion ? Math.round(opcion.prob * 100) : null;
  const hayValor = probImplicita !== null && nuestraProb !== null && nuestraProb > probImplicita;

  return (
    <div style={{ marginTop: 20, padding: 14, background: "#111", borderRadius: 8 }}>
      <h4 style={{ margin: "0 0 4px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><Icono tipo="moneda" size={14} /> {traducir("calculadoraValor")}</h4>
      <p style={{ fontSize: 10, color: "#9fc4ac", margin: "0 0 12px" }}>
        Compara la cuota de tu casa de apuestas contra nuestra probabilidad — es tan buena como nuestro propio modelo, no una garantía.
      </p>

      <select
        value={opcionIndex}
        onChange={(e) => setOpcionIndex(Number(e.target.value))}
        style={{ width: "100%", padding: 9, marginBottom: 10, fontSize: 13, background: tema.fondo, color: tema.texto, border: `1px solid ${tema.borde}`, borderRadius: 4 }}
      >
        {opciones.map((o, i) => (
          <option key={i} value={i}>{o.etiqueta} — nuestra prob.: {Math.round(o.prob * 100)}%</option>
        ))}
      </select>

      <input
        type="number"
        step="0.01"
        min="1.01"
        placeholder="Cuota de tu casa de apuestas (ej: 2.10)"
        value={cuota}
        onChange={(e) => setCuota(e.target.value)}
        style={{ width: "100%", padding: 9, marginBottom: 10, fontSize: 13, background: tema.fondo, color: tema.texto, border: `1px solid ${tema.borde}`, borderRadius: 4 }}
      />

      {probImplicita !== null && (
        <div style={{ fontSize: 12, color: tema.texto }}>
          <div>Probabilidad implícita de esa cuota: <strong>{probImplicita.toFixed(1)}%</strong></div>
          <div>Nuestra probabilidad: <strong>{nuestraProb}%</strong></div>
          <div style={{
            marginTop: 8, padding: "8px 12px", borderRadius: 6, fontWeight: "bold",
            background: hayValor ? "#2e9e4f" : "#e05555", color: "#fff", display: "inline-block",
          }}>
            {hayValor
              ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icono tipo="check" size={13} color="#2e9e4f" /> {traducir("valorSi")}</span>
              : <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icono tipo="exclamacion" size={13} /> {traducir("valorNo")}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function PanelSemaforo({ equipoLocal, equipoVisitante, fixturesLocal, fixturesVisitante, h2h, statsMap, datosPuntualesListos, esPartidoLiga, setEsPartidoLiga, tema, acento, climaAjuste, coberturaPuntuales, sesion, onPedirLogin, mercadosPreferidos, mostrarToast, competicionActual }) {
  const mostrarMercado = (id) => !mercadosPreferidos || mercadosPreferidos.length === 0 || mercadosPreferidos.includes(id);
  const [lineaHandicap, setLineaHandicap] = useState(0);
  const [permisoNotificaciones, setPermisoNotificaciones] = useState(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported"
  );
  const yaNotificado = useRef(new Set());
  const opcionesValorRef = useRef([]);
  const infoPartidoRef = useRef({ nombreLocal: "", nombreVisitante: "", claveEncuentro: "" });

  function activarNotificaciones() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    Notification.requestPermission().then((permiso) => setPermisoNotificaciones(permiso));
  }

  // Este efecto va ANTES de cualquier "return" condicional de la función —
  // en React, los hooks siempre deben llamarse en el mismo orden en cada render,
  // sin importar si el partido está listo o no todavía.
  useEffect(() => {
    if (permisoNotificaciones !== "granted") return;
    const { nombreLocal, nombreVisitante, claveEncuentro } = infoPartidoRef.current;
    if (!claveEncuentro) return;
    opcionesValorRef.current.forEach((o) => {
      if (o.prob >= 0.7) {
        const clave = `${claveEncuentro}-${o.etiqueta}`;
        if (!yaNotificado.current.has(clave)) {
          yaNotificado.current.add(clave);
          const titulo = "JMCS — Semáforo en verde";
          const opciones = {
            body: `${nombreLocal} vs ${nombreVisitante}\n${o.etiqueta}: ${Math.round(o.prob * 100)}%`,
            icon: "/logo.png",
          };
          // Si hay un Service Worker activo (se registra al activar las notificaciones push),
          // el navegador EXIGE mostrar la notificación a través de él — usar "new Notification"
          // directo revienta con "Illegal constructor". Si no hay Service Worker, seguimos
          // usando el constructor viejo, que funciona igual de bien en ese caso.
          if ("serviceWorker" in navigator) {
            navigator.serviceWorker.getRegistration().then((registro) => {
              if (registro) registro.showNotification(titulo, opciones);
              else new Notification(titulo, opciones);
            });
          } else {
            new Notification(titulo, opciones);
          }
        }
      }
    });
  }, [permisoNotificaciones, equipoLocal?.team?.id, equipoVisitante?.team?.id, datosPuntualesListos]);

  if (!equipoLocal?.team || !equipoVisitante?.team) return null;

  const fuentesEqLocal = construirFuentesEquipo(fixturesLocal, equipoLocal.team.id, statsMap, competicionActual);
  const fuentesEqVisitante = construirFuentesEquipo(fixturesVisitante, equipoVisitante.team.id, statsMap, competicionActual);

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
  const lambdaGolesTotalAjustado =
    climaAjuste?.activo && lambdaGolesLocal !== null && lambdaGolesVisitante !== null
      ? lambdaGolesLocal * climaAjuste.factorLocal + lambdaGolesVisitante * climaAjuste.factorVisitante
      : null;

  const lambdaCornersLocal = calcularValorEsperado(motorLocal.corners, esPartidoLiga);
  const lambdaCornersVisitante = calcularValorEsperado(motorVisitante.corners, esPartidoLiga);
  const lambdaCornersTotal = lambdaCornersLocal !== null && lambdaCornersVisitante !== null ? lambdaCornersLocal + lambdaCornersVisitante : null;
  const lambdaCornersTotalAjustado =
    climaAjuste?.activo && lambdaCornersLocal !== null && lambdaCornersVisitante !== null
      ? lambdaCornersLocal * (climaAjuste.factorLocalPorMercado?.corners ?? 1) + lambdaCornersVisitante * (climaAjuste.factorVisitantePorMercado?.corners ?? 1)
      : null;

  const lambdaAmarillasLocal = calcularValorEsperado(motorLocal.amarillas, esPartidoLiga);
  const lambdaAmarillasVisitante = calcularValorEsperado(motorVisitante.amarillas, esPartidoLiga);
  const lambdaAmarillasTotal = lambdaAmarillasLocal !== null && lambdaAmarillasVisitante !== null ? lambdaAmarillasLocal + lambdaAmarillasVisitante : null;
  const lambdaAmarillasTotalAjustado =
    climaAjuste?.activo && lambdaAmarillasLocal !== null && lambdaAmarillasVisitante !== null
      ? lambdaAmarillasLocal * (climaAjuste.factorLocalPorMercado?.amarillas ?? 1) + lambdaAmarillasVisitante * (climaAjuste.factorVisitantePorMercado?.amarillas ?? 1)
      : null;

  const lambdaFaltasLocal = calcularValorEsperado(motorLocal.faltas, esPartidoLiga);
  const lambdaFaltasVisitante = calcularValorEsperado(motorVisitante.faltas, esPartidoLiga);
  const lambdaFaltasTotal = lambdaFaltasLocal !== null && lambdaFaltasVisitante !== null ? lambdaFaltasLocal + lambdaFaltasVisitante : null;
  const lambdaFaltasTotalAjustado =
    climaAjuste?.activo && lambdaFaltasLocal !== null && lambdaFaltasVisitante !== null
      ? lambdaFaltasLocal * (climaAjuste.factorLocalPorMercado?.faltas ?? 1) + lambdaFaltasVisitante * (climaAjuste.factorVisitantePorMercado?.faltas ?? 1)
      : null;

  const probBTTS = probabilidadBTTS(lambdaGolesLocal, lambdaGolesVisitante);
  const prob1X2 = probabilidad1X2(lambdaGolesLocal, lambdaGolesVisitante);
  const probDobleOportunidad = probabilidadDobleOportunidad(prob1X2);
  const marcadoresProbables = probabilidadMarcadorExacto(lambdaGolesLocal, lambdaGolesVisitante);
  const probHandicap = probabilidadHandicapAsiatico(lambdaGolesLocal, lambdaGolesVisitante, lineaHandicap);

  const lambdaGolesLocalAjustado = climaAjuste?.activo && lambdaGolesLocal !== null ? lambdaGolesLocal * climaAjuste.factorLocal : null;
  const lambdaGolesVisitanteAjustado = climaAjuste?.activo && lambdaGolesVisitante !== null ? lambdaGolesVisitante * climaAjuste.factorVisitante : null;
  const probBTTSAjustado = climaAjuste?.activo ? probabilidadBTTS(lambdaGolesLocalAjustado, lambdaGolesVisitanteAjustado) : null;
  const prob1X2Ajustado = climaAjuste?.activo ? probabilidad1X2(lambdaGolesLocalAjustado, lambdaGolesVisitanteAjustado) : null;

  let advertenciaMuestra = null;
  if (coberturaPuntuales && coberturaPuntuales.total > 0) {
    const proporcion = coberturaPuntuales.exitos / coberturaPuntuales.total;
    if (coberturaPuntuales.exitos < 5 || proporcion < 0.5) {
      advertenciaMuestra = `Muestra insuficiente (${coberturaPuntuales.exitos}/${coberturaPuntuales.total} partidos con dato real) — tómalo con cautela.`;
    }
  }

  // Opciones disponibles para la calculadora de valor (solo mercados con datos reales)
  const opcionesValor = [];
  if (prob1X2) {
    opcionesValor.push({ etiqueta: `Gana ${equipoLocal.team.name}`, prob: prob1X2.pLocal });
    opcionesValor.push({ etiqueta: traducir("empate"), prob: prob1X2.pEmpate });
    opcionesValor.push({ etiqueta: `Gana ${equipoVisitante.team.name}`, prob: prob1X2.pVisitante });
  }
  if (probBTTS !== null) opcionesValor.push({ etiqueta: "Ambos anotan (BTTS)", prob: probBTTS });
  if (lambdaGolesTotal !== null) {
    LINEAS_MERCADOS.goles.forEach((l) => opcionesValor.push({ etiqueta: `Goles Over ${l}`, prob: probabilidadOver(lambdaGolesTotal, l) }));
  }
  if (lambdaCornersTotal !== null) {
    LINEAS_MERCADOS.corners.forEach((l) => opcionesValor.push({ etiqueta: `Córners Over ${l}`, prob: probabilidadOver(lambdaCornersTotal, l) }));
  }
  if (lambdaAmarillasTotal !== null) {
    LINEAS_MERCADOS.amarillas.forEach((l) => opcionesValor.push({ etiqueta: `Tarjetas Over ${l}`, prob: probabilidadOver(lambdaAmarillasTotal, l) }));
  }
  if (lambdaFaltasTotal !== null) {
    LINEAS_MERCADOS.faltas.forEach((l) => opcionesValor.push({ etiqueta: `Faltas Over ${l}`, prob: probabilidadOver(lambdaFaltasTotal, l) }));
  }

  // Guardamos esto en referencias (no en hooks) para que el useEffect de arriba
  // —que corre siempre, antes de cualquier "return" de esta función— pueda leerlo
  // cuando le toque ejecutarse, sin romper el orden de los hooks de React.
  opcionesValorRef.current = opcionesValor;
  infoPartidoRef.current = {
    nombreLocal: equipoLocal.team.name,
    nombreVisitante: equipoVisitante.team.name,
    claveEncuentro: `${equipoLocal.team.id}-${equipoVisitante.team.id}`,
  };

  return (
    <div style={{ marginTop: 30, padding: 16, background: tema.panel, borderRadius: 6 }}>
      <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 7 }}><Icono tipo="semaforo" size={16} /> {traducir("pronosticoYSemaforo")}</h3>

      {permisoNotificaciones !== "unsupported" && (
        <div style={{ marginBottom: 16 }}>
          {permisoNotificaciones === "granted" ? (
            <span style={{ fontSize: 11, color: "#2e9e4f", display: "inline-flex", alignItems: "center", gap: 4 }}><Icono tipo="campana" size={12} color="#2e9e4f" /> Te avisaremos si algo aquí llega a semáforo verde (mientras esta pestaña esté abierta).</span>
          ) : permisoNotificaciones === "denied" ? (
            <span style={{ fontSize: 11, color: tema.textoSuave, display: "inline-flex", alignItems: "center", gap: 4 }}><Icono tipo="campanaTachada" size={12} /> Notificaciones bloqueadas — actívalas desde la configuración de tu navegador si quieres recibirlas.</span>
          ) : (
            <button
              onClick={activarNotificaciones}
              style={{ fontSize: 11, padding: "6px 12px", background: "transparent", border: `1px solid ${acento}`, color: acento, borderRadius: 14, cursor: "pointer" }}
            >
              <Icono tipo="campana" size={13} /> {traducir("avisarSemaforoVerde")}
            </button>
          )}
        </div>
      )}

      <div style={{ marginBottom: 20, fontSize: 13, display: "flex", gap: 16 }}>
        <label style={{ cursor: "pointer" }}>
          <input type="radio" checked={esPartidoLiga} onChange={() => setEsPartidoLiga(true)} style={{ accentColor: acento }} /> Partido de Liga
        </label>
        <label style={{ cursor: "pointer" }}>
          <input type="radio" checked={!esPartidoLiga} onChange={() => setEsPartidoLiga(false)} style={{ accentColor: acento }} /> Partido de Copa/otro torneo
        </label>
      </div>

      {prob1X2 && mostrarMercado("ganador") && (
        <div style={{ marginBottom: 18 }}>
          <h4 style={{ marginBottom: 8, fontSize: 14 }}>{traducir("ganadorPartido")}</h4>
          <p style={{ fontSize: 10, color: tema.textoSuave, margin: "0 0 8px" }}>
            Aproximación estándar basada en el mismo modelo de goles esperados — no es un modelo profesional de casa de apuestas.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {[
              { etiqueta: equipoLocal.team.name, prob: prob1X2.pLocal },
              { etiqueta: traducir("empate"), prob: prob1X2.pEmpate },
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

          {prob1X2Ajustado && (
            <div style={{ marginTop: 8 }}>
              <p style={{ fontSize: 11, color: tema.textoSuave, margin: "0 0 6px", display: "flex", alignItems: "center", gap: 5 }}><Icono tipo="lluvia" size={13} /> {traducir("conEstudioClimatico")}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {[
                  { etiqueta: equipoLocal.team.name, prob: prob1X2Ajustado.pLocal },
                  { etiqueta: traducir("empate"), prob: prob1X2Ajustado.pEmpate },
                  { etiqueta: equipoVisitante.team.name, prob: prob1X2Ajustado.pVisitante },
                ].map((item) => {
                  const { color } = colorSemaforo(item.prob);
                  return (
                    <div
                      key={item.etiqueta}
                      style={{
                        padding: "8px 14px", borderRadius: 6, background: color, color: "#fff", opacity: 0.85,
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
        </div>
      )}

      {probDobleOportunidad && mostrarMercado("dobleOportunidad") && (
        <div style={{ marginBottom: 18 }}>
          <h4 style={{ marginBottom: 8, fontSize: 14 }}>Doble oportunidad</h4>
          <p style={{ fontSize: 10, color: tema.textoSuave, margin: "0 0 8px" }}>
            Sale de sumar las mismas probabilidades de Ganador del partido de arriba — no es un cálculo aparte.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {[
              { etiqueta: `${equipoLocal.team.name} o Empate`, prob: probDobleOportunidad.p1X },
              { etiqueta: `${equipoLocal.team.name} o ${equipoVisitante.team.name}`, prob: probDobleOportunidad.p12 },
              { etiqueta: `Empate o ${equipoVisitante.team.name}`, prob: probDobleOportunidad.pX2 },
            ].map((item) => {
              const { color } = colorSemaforo(item.prob);
              return (
                <div
                  key={item.etiqueta}
                  style={{
                    padding: "8px 14px", borderRadius: 6, background: color, color: "#fff",
                    fontSize: 13, fontWeight: "bold", minWidth: 130, textAlign: "center",
                  }}
                >
                  {item.etiqueta}<br />{Math.round(item.prob * 100)}%
                </div>
              );
            })}
          </div>
        </div>
      )}

      {marcadoresProbables && mostrarMercado("marcadorExacto") && (
        <div style={{ marginBottom: 18 }}>
          <h4 style={{ marginBottom: 8, fontSize: 14 }}>Marcador exacto</h4>
          <p style={{ fontSize: 10, color: tema.textoSuave, margin: "0 0 8px" }}>
            Los {marcadoresProbables.length} marcadores más probables según nuestro modelo — el marcador exacto siempre es un mercado de probabilidad baja, aunque salga en verde no es un resultado esperado con certeza.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {marcadoresProbables.map((m, i) => (
              <div
                key={i}
                style={{
                  padding: "8px 14px", borderRadius: 6, background: tema.panel, border: `1px solid ${tema.borde}`,
                  fontSize: 13, fontWeight: "bold", minWidth: 80, textAlign: "center", color: tema.texto,
                }}
              >
                {m.local} - {m.visitante}
                <br />
                <span style={{ fontWeight: "normal", fontSize: 11, color: tema.textoSuave }}>{(m.prob * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {probHandicap && mostrarMercado("handicapAsiatico") && (
        <div style={{ marginBottom: 18 }}>
          <h4 style={{ marginBottom: 8, fontSize: 14 }}>Hándicap asiático (Local)</h4>
          <p style={{ fontSize: 10, color: tema.textoSuave, margin: "0 0 8px" }}>
            Negativo = {equipoLocal.team.name} tiene que ganar por esa diferencia. Positivo = arranca con esa ventaja.
            {probHandicap.esLineaCuarto && " Esta línea es de cuarto: se reparte entre las dos líneas vecinas, así que mostramos el promedio de cubrir ambas."}
          </p>
          <select
            value={lineaHandicap}
            onChange={(e) => setLineaHandicap(parseFloat(e.target.value))}
            style={{
              marginBottom: 10, padding: "6px 10px", fontSize: 13, borderRadius: 6,
              border: `1px solid ${tema.borde}`, background: tema.fondo, color: tema.texto,
            }}
          >
            {LINEAS_HANDICAP.map((l) => (
              <option key={l} value={l}>{l > 0 ? `+${l}` : l}</option>
            ))}
          </select>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(() => {
              const { color } = colorSemaforo(probHandicap.probCubre);
              return (
                <div style={{ padding: "8px 14px", borderRadius: 6, background: color, color: "#fff", fontSize: 13, fontWeight: "bold", minWidth: 130, textAlign: "center" }}>
                  Cubre {equipoLocal.team.name}<br />{Math.round(probHandicap.probCubre * 100)}%
                </div>
              );
            })()}
            {!probHandicap.esLineaCuarto && probHandicap.probPush > 0.005 && (
              <div style={{ padding: "8px 14px", borderRadius: 6, background: tema.panel, border: `1px solid ${tema.borde}`, color: tema.texto, fontSize: 13, fontWeight: "bold", minWidth: 100, textAlign: "center" }}>
                Push<br />{Math.round(probHandicap.probPush * 100)}%
              </div>
            )}
          </div>
        </div>
      )}

      {mostrarMercado("goles") && (
        <FilaMercado nombre={traducir("golesTotales")} lineas={LINEAS_MERCADOS.goles} lambda={lambdaGolesTotal} lambdaAjustado={lambdaGolesTotalAjustado} tema={tema} />
      )}

      {probBTTS !== null && mostrarMercado("btts") && (
        <div style={{ marginBottom: 18 }}>
          <h4 style={{ marginBottom: 8, fontSize: 14 }}>{traducir("ambosAnotan")}</h4>
          {(() => {
            const { color } = colorSemaforo(probBTTS);
            return (
              <div style={{ display: "inline-block", padding: "8px 16px", borderRadius: 6, background: color, color: "#fff", fontWeight: "bold", fontSize: 13 }}>
                {Math.round(probBTTS * 100)}%
              </div>
            );
          })()}

          {probBTTSAjustado !== null && (
            <div style={{ marginTop: 8 }}>
              <p style={{ fontSize: 11, color: tema.textoSuave, margin: "0 0 6px", display: "flex", alignItems: "center", gap: 5 }}><Icono tipo="lluvia" size={13} /> {traducir("conEstudioClimatico")}</p>
              {(() => {
                const { color } = colorSemaforo(probBTTSAjustado);
                return (
                  <div style={{ display: "inline-block", padding: "8px 16px", borderRadius: 6, background: color, color: "#fff", opacity: 0.85, fontWeight: "bold", fontSize: 13 }}>
                    {Math.round(probBTTSAjustado * 100)}%
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {mostrarMercado("corners") && (
        <FilaMercado nombre={traducir("cornersTotales")} lineas={LINEAS_MERCADOS.corners} lambda={lambdaCornersTotal} lambdaAjustado={lambdaCornersTotalAjustado} tema={tema} advertenciaMuestra={advertenciaMuestra} />
      )}
      {mostrarMercado("amarillas") && (
        <FilaMercado nombre={traducir("amarillasTotales")} lineas={LINEAS_MERCADOS.amarillas} lambda={lambdaAmarillasTotal} lambdaAjustado={lambdaAmarillasTotalAjustado} tema={tema} advertenciaMuestra={advertenciaMuestra} />
      )}
      {mostrarMercado("faltas") && (
        <FilaMercado nombre={traducir("faltasTotales")} lineas={LINEAS_MERCADOS.faltas} lambda={lambdaFaltasTotal} lambdaAjustado={lambdaFaltasTotalAjustado} tema={tema} advertenciaMuestra={advertenciaMuestra} />
      )}

      {!datosPuntualesListos && (
        <p style={{ color: tema.textoSuave, fontSize: 12, marginTop: -8, marginBottom: 18 }}>
          <Icono tipo="portapapeles" size={13} /> Carga los "datos puntuales" arriba para completar córners, tarjetas y faltas con datos reales.
        </p>
      )}

      <p style={{ fontSize: 11, color: tema.textoSuave, marginTop: 16 }}>
        Esto es un modelo estadístico de tendencias, no una certeza. No contempla lesiones, sanciones, clima ni decisiones arbitrales puntuales.
      </p>

      {mostrarMercado("valor") && opcionesValor.length > 0 && <CalculadoraValor opciones={opcionesValor} tema={tema} acento={acento} />}

      <BotonGuardarPronostico
        sesion={sesion}
        onPedirLogin={onPedirLogin}
        tema={tema}
        acento={acento}
        mostrarToast={mostrarToast}
        datos={{
          equipo_local: equipoLocal.team.name,
          equipo_visitante: equipoVisitante.team.name,
          goles_esperados: lambdaGolesTotal !== null ? Number(lambdaGolesTotal.toFixed(2)) : null,
          prob_over25: lambdaGolesTotal !== null ? Math.round(probabilidadOver(lambdaGolesTotal, 2.5) * 100) : null,
          prob_btts: probBTTS !== null ? Math.round(probBTTS * 100) : null,
          pick_1x2: prob1X2
            ? (prob1X2.pLocal >= prob1X2.pEmpate && prob1X2.pLocal >= prob1X2.pVisitante
                ? equipoLocal.team.name
                : prob1X2.pEmpate >= prob1X2.pVisitante
                ? traducir("empate")
                : equipoVisitante.team.name)
            : null,
        }}
      />
    </div>
  );
}

function BotonGuardarPronostico({ sesion, onPedirLogin, tema, acento, datos, mostrarToast }) {
  const [guardado, setGuardado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    if (!sesion) {
      onPedirLogin();
      return;
    }
    setGuardando(true);
    const { error } = await supabase.from("predicciones").insert({
      user_id: sesion.user.id,
      equipo_local: datos.equipo_local,
      equipo_visitante: datos.equipo_visitante,
      goles_esperados: datos.goles_esperados,
      prob_over25: datos.prob_over25,
      prob_btts: datos.prob_btts,
      pick_1x2: datos.pick_1x2,
    });
    if (!error) {
      setGuardado(true);
    } else {
      mostrarToast && mostrarToast("No se pudo guardar el pronóstico. Intenta de nuevo.");
    }
    setGuardando(false);
  }

  return (
    <button
      onClick={guardar}
      disabled={guardando || guardado}
      style={{
        width: "100%", marginTop: 16, padding: 12, fontSize: 13, fontWeight: "bold",
        background: guardado ? "#2e9e4f" : acento, color: "#fff", border: "none",
        borderRadius: 6, cursor: guardado ? "default" : "pointer",
      }}
    >
      {guardado
        ? <><Icono tipo="check" size={13} /> {traducir("pronosticoGuardado")}</>
        : guardando ? traducir("guardando") : <><Icono tipo="disquete" size={13} /> {traducir("guardarPronostico")}</>}
    </button>
  );
}

function PanelCalendario({ tema, onSeleccionarPartido, acentoMarca, onAbrirPerfil, mostrarToast }) {
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [partidos, setPartidos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [buscado, setBuscado] = useState(false);
  const [seleccionado, setSeleccionado] = useState(null);
  const [paisFiltro, setPaisFiltro] = useState(null);

  async function buscarPartidos() {
    setLoading(true);
    setError("");
    setPartidos([]);
    setSeleccionado(null);
    setBuscado(true);
    setPaisFiltro(null);
    try {
      const res = await fetch(`/api/partidos-por-fecha?date=${fecha}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        mostrarToast && mostrarToast(data.error);
      } else {
        setPartidos(data);
      }
    } catch (err) {
      setError("Error al buscar partidos");
      mostrarToast && mostrarToast("Error al buscar partidos");
    }
    setLoading(false);
  }

  function elegir(p) {
    setSeleccionado(p.fixture.id);
    onSeleccionarPartido(p);
  }

  const paisesDisponibles = [...new Set(partidos.map((p) => p.league?.country).filter(Boolean))].sort();
  const partidosFiltrados = paisFiltro ? partidos.filter((p) => p.league?.country === paisFiltro) : partidos;

  return (
    <div style={{ background: tema.panel, borderRadius: 6, borderTop: `3px solid ${acentoMarca}`, padding: 16 }}>
      <h3 style={{ fontSize: 13, marginTop: 0, marginBottom: 14, color: acentoMarca, display: "flex", alignItems: "center", gap: 6 }}><Icono tipo="calendario" size={14} /> {traducir("calendarioPartidos")}</h3>

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

      {paisesDisponibles.length > 1 && (
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 10 }}>
          <button
            onClick={() => setPaisFiltro(null)}
            style={{
              flexShrink: 0, padding: "5px 12px", fontSize: 11, borderRadius: 14, whiteSpace: "nowrap", cursor: "pointer",
              background: !paisFiltro ? acentoMarca : "transparent", color: !paisFiltro ? "#fff" : tema.texto,
              border: `1px solid ${!paisFiltro ? acentoMarca : tema.borde}`,
            }}
          >
            {traducir("todos")}
          </button>
          {paisesDisponibles.map((pais) => (
            <button
              key={pais}
              onClick={() => setPaisFiltro(pais === paisFiltro ? null : pais)}
              style={{
                flexShrink: 0, display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", fontSize: 11, borderRadius: 14, whiteSpace: "nowrap", cursor: "pointer",
                background: paisFiltro === pais ? acentoMarca : "transparent", color: paisFiltro === pais ? "#fff" : tema.texto,
                border: `1px solid ${paisFiltro === pais ? acentoMarca : tema.borde}`,
              }}
            >
              <BanderaPais pais={pais} url={partidos.find((x) => x.league?.country === pais)?.league?.flag} size={14} />
              {pais}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p style={{ fontSize: 11, color: "#e08a8a", lineHeight: 1.4 }}>{error}</p>
      )}
      {buscado && !loading && !error && partidos.length === 0 && (
        <p style={{ fontSize: 12, color: tema.textoSuave }}>No hay partidos para esta fecha.</p>
      )}

      <div style={{ maxHeight: 600, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
        {partidosFiltrados.map((p) => {
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
                <img
                  src={corregirEscudo(p.teams.home.logo)} alt="" width={16} height={16}
                  onError={manejarErrorEscudo}
                  onClick={(e) => { e.stopPropagation(); onAbrirPerfil && onAbrirPerfil({ id: p.teams.home.id, name: p.teams.home.name, logo: p.teams.home.logo, country: p.league.country }); }}
                  style={{ cursor: onAbrirPerfil ? "pointer" : "default" }}
                />
                <span
                  onClick={(e) => { e.stopPropagation(); onAbrirPerfil && onAbrirPerfil({ id: p.teams.home.id, name: p.teams.home.name, logo: p.teams.home.logo, country: p.league.country }); }}
                  style={{ cursor: onAbrirPerfil ? "pointer" : "default" }}
                >
                  {p.teams.home.name}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <img
                  src={corregirEscudo(p.teams.away.logo)} alt="" width={16} height={16}
                  onError={manejarErrorEscudo}
                  onClick={(e) => { e.stopPropagation(); onAbrirPerfil && onAbrirPerfil({ id: p.teams.away.id, name: p.teams.away.name, logo: p.teams.away.logo, country: p.league.country }); }}
                  style={{ cursor: onAbrirPerfil ? "pointer" : "default" }}
                />
                <span
                  onClick={(e) => { e.stopPropagation(); onAbrirPerfil && onAbrirPerfil({ id: p.teams.away.id, name: p.teams.away.name, logo: p.teams.away.logo, country: p.league.country }); }}
                  style={{ cursor: onAbrirPerfil ? "pointer" : "default" }}
                >
                  {p.teams.away.name}
                </span>
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

  if (IDIOMA_ACTUAL === "en") {
    contexto += "\n(Please answer the user in English.)\n";
  }

  return contexto;
}

function ChatIA({ equipoLocal, equipoVisitante, statsGoLocal, statsGoVisitante, h2h, esPartidoLiga, tema, acento, onCerrar, contextoOverride, tituloOverride, sugerenciasOverride }) {
  const [pregunta, setPregunta] = useState("");
  const [mensajes, setMensajes] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const usaModoGenerico = !!contextoOverride;
  if (!usaModoGenerico && !(equipoLocal?.team && equipoVisitante?.team)) return null;

  async function enviarPregunta(e) {
    e.preventDefault();
    if (!pregunta.trim()) return;

    const preguntaActual = pregunta;
    setMensajes((prev) => [...prev, { rol: "usuario", texto: preguntaActual }]);
    setPregunta("");
    setError("");
    setCargando(true);

    const contexto = usaModoGenerico
      ? contextoOverride
      : armarContextoParaIA({ equipoLocal, equipoVisitante, statsGoLocal, statsGoVisitante, h2h, esPartidoLiga });

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
      setError(traducir("chatErrorConexion"));
    }
    setCargando(false);
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h3 style={{ margin: 0, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><Icono tipo="chat" size={14} /> {tituloOverride || traducir("chatTitulo")}</h3>
        {onCerrar && (
          <button onClick={onCerrar} style={{ background: "transparent", border: "none", fontSize: 18, cursor: "pointer", color: tema.texto }}>
            <Icono tipo="cerrar" size={16} />
          </button>
        )}
      </div>

      <div style={{ maxHeight: 350, overflowY: "auto", marginBottom: 14, marginTop: 10 }}>
        {mensajes.length === 0 && (
          <p style={{ color: tema.textoSuave, fontSize: 13 }}>
            {sugerenciasOverride || traducir("chatSugerencia")}
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
        {cargando && <p style={{ fontSize: 13, color: tema.textoSuave }}>{traducir("chatPensando")}</p>}
      </div>

      {error && <p style={{ color: "#e05555", fontSize: 13, marginBottom: 10 }}>{error}</p>}

      <form onSubmit={enviarPregunta} style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          placeholder={traducir("chatPlaceholder")}
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
          {traducir("chatEnviar")}
        </button>
      </form>

      <p style={{ fontSize: 11, color: tema.textoSuave, marginTop: 10 }}>
        Powered by Gemini. La IA solo interpreta los datos ya calculados arriba, no tiene información externa del partido.
      </p>
    </div>
  );
}

function PanelEquipoLateral({ equipo, stats, posesion, fixtures, tema, acento, sesion, onPedirLogin, onAbrirPerfil, mostrarToast }) {
  if (!equipo?.team) return null;

  const ultimos5 = (fixtures || []).slice(0, 5);

  return (
    <div style={{ background: colorTenue(acento), borderTop: `3px solid ${acento}`, borderRadius: 6, padding: 16, textAlign: "center" }}>
      <div
        onClick={() => onAbrirPerfil && onAbrirPerfil(equipo.team)}
        style={{ cursor: onAbrirPerfil ? "pointer" : "default" }}
        title="Ver perfil completo del equipo"
      >
        <img src={corregirEscudo(equipo.team.logo)} alt={equipo.team.name} style={{ width: "100%", maxWidth: 130, height: "auto", margin: "0 auto 10px" }} onError={manejarErrorEscudo} />
      </div>
      <h4 style={{ fontSize: 13, margin: "0 0 12px", color: acento, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <span onClick={() => onAbrirPerfil && onAbrirPerfil(equipo.team)} style={{ cursor: onAbrirPerfil ? "pointer" : "default" }}>
          <BanderaPais pais={equipo.team.country} size={16} /> {equipo.team.name}
        </span>
        <BotonFavorito equipo={equipo} sesion={sesion} tema={tema} onPedirLogin={onPedirLogin} mostrarToast={mostrarToast} />
      </h4>

      {stats ? (
        <>
          <div style={{ fontSize: 12, textAlign: "left" }}>
            <FilaStat etiqueta={traducir("record")} valor={`${stats.victorias}-${stats.empates}-${stats.derrotas}`} />
            <FilaStat etiqueta="Goles favor" valor={stats.promedioGolesFavor} />
            <FilaStat etiqueta="Goles contra" valor={stats.promedioGolesContra} />
            <FilaStat etiqueta={traducir("over25")} valor={`${stats.over25Pct}%`} />
            <FilaStat etiqueta={traducir("btts")} valor={`${stats.bttsPct}%`} />
            {posesion !== null && posesion !== undefined && (
              <>
                <div style={{ borderTop: `1px solid ${tema.borde}`, margin: "6px 0" }} />
                <FilaStat etiqueta={traducir("posesion")} valor={`${posesion}%`} />
              </>
            )}
          </div>

          {ultimos5.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: tema.textoSuave, marginBottom: 6, textAlign: "left" }}>
                {traducir("ultimos5")}
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

function dividirPorCategorias(fixtures, teamId, competicionExacta) {
  return {
    local: fixtures.filter((f) => f.teams.home.id === teamId),
    visitante: fixtures.filter((f) => f.teams.away.id === teamId),
    liga: competicionExacta
      ? fixtures.filter((f) => f.league?.id === competicionExacta.id && f.league?.season === competicionExacta.season)
      : fixtures.filter((f) => esLiga(f)),
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
      <FilaEspejo etiqueta={traducir("record")} valorLocal={statsL ? `${statsL.victorias}-${statsL.empates}-${statsL.derrotas}` : "—"} valorVisitante={statsV ? `${statsV.victorias}-${statsV.empates}-${statsV.derrotas}` : "—"} tema={tema} />
      <FilaEspejo etiqueta={traducir("golesFavor")} valorLocal={statsL?.promedioGolesFavor ?? "—"} valorVisitante={statsV?.promedioGolesFavor ?? "—"} tema={tema} />
      <FilaEspejo etiqueta={traducir("golesContra")} valorLocal={statsL?.promedioGolesContra ?? "—"} valorVisitante={statsV?.promedioGolesContra ?? "—"} tema={tema} />
      <FilaEspejo etiqueta={traducir("over25")} valorLocal={statsL ? `${statsL.over25Pct}%` : "—"} valorVisitante={statsV ? `${statsV.over25Pct}%` : "—"} tema={tema} />
      <FilaEspejo etiqueta={traducir("btts")} valorLocal={statsL ? `${statsL.bttsPct}%` : "—"} valorVisitante={statsV ? `${statsV.bttsPct}%` : "—"} tema={tema} />
      {(puntualesL || puntualesV) && (
        <>
          <FilaEspejo etiqueta={traducir("corners")} valorLocal={puntualesL?.promedioCorners ?? "—"} valorVisitante={puntualesV?.promedioCorners ?? "—"} tema={tema} />
          <FilaEspejo etiqueta={traducir("tarjetasAm")} valorLocal={puntualesL?.promedioAmarillas ?? "—"} valorVisitante={puntualesV?.promedioAmarillas ?? "—"} tema={tema} />
          <FilaEspejo etiqueta={traducir("faltas")} valorLocal={puntualesL?.promedioFaltas ?? "—"} valorVisitante={puntualesV?.promedioFaltas ?? "—"} tema={tema} />
        </>
      )}
    </div>
  );
}

function SeccionEspejo({ equipoLocal, equipoVisitante, fixturesLocal, fixturesVisitante, statsMap, tema, competicionActual }) {
  if (!equipoLocal?.team || !equipoVisitante?.team) return null;

  const catLocal = dividirPorCategorias(fixturesLocal, equipoLocal.team.id, competicionActual);
  const catVisitante = dividirPorCategorias(fixturesVisitante, equipoVisitante.team.id, competicionActual);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: 13, fontWeight: "bold" }}>
        <span>{equipoLocal.team.name}</span>
        <span>{equipoVisitante.team.name}</span>
      </div>

      <CategoriaEspejo titulo={traducir("comoLocalVisitante")} fixturesLocal={catLocal.local} fixturesVisitante={catVisitante.visitante} idLocal={equipoLocal.team.id} idVisitante={equipoVisitante.team.id} statsMap={statsMap} tema={tema} acento={ACENTOS_CATEGORIA.local} />
      <CategoriaEspejo titulo={competicionActual?.nombre || traducir("ligaActual")} fixturesLocal={catLocal.liga} fixturesVisitante={catVisitante.liga} idLocal={equipoLocal.team.id} idVisitante={equipoVisitante.team.id} statsMap={statsMap} tema={tema} acento={ACENTOS_CATEGORIA.liga} />
      <CategoriaEspejo titulo={traducir("noLiga")} fixturesLocal={catLocal.noLiga} fixturesVisitante={catVisitante.noLiga} idLocal={equipoLocal.team.id} idVisitante={equipoVisitante.team.id} statsMap={statsMap} tema={tema} acento={ACENTOS_CATEGORIA.noLiga} />
      <CategoriaEspejo titulo={traducir("formaReciente")} fixturesLocal={catLocal.forma} fixturesVisitante={catVisitante.forma} idLocal={equipoLocal.team.id} idVisitante={equipoVisitante.team.id} statsMap={statsMap} tema={tema} acento={ACENTOS_CATEGORIA.forma} />
    </div>
  );
}

// Estadios cubiertos conocidos (lista manual — el clima no los afecta)
const ESTADIOS_CUBIERTOS = [
  "johan cruyff arena", "amsterdam arena", "mercedes-benz stadium",
  "u.s. bank stadium", "allegiant stadium", "at&t stadium",
  "state farm stadium", "sapporo dome", "singapore national stadium",
  "docomo stadium", "friends arena", "wanda metropolitano",
  "tottenham hotspur stadium", "principality stadium", "juegos olimpicos stadium",
];

function esEstadioCubierto(nombreEstadio) {
  if (!nombreEstadio) return false;
  const nombre = nombreEstadio.toLowerCase();
  return ESTADIOS_CUBIERTOS.some((e) => nombre.includes(e));
}

const ESTADOS_EN_VIVO = ["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"];
const ETIQUETAS_ESTADO = {
  "1H": "1er tiempo", HT: "Entretiempo", "2H": "2do tiempo", ET: "Tiempo extra",
  BT: "Descanso (extra)", P: "Penales", SUSP: "Suspendido", INT: "Interrumpido",
  LIVE: "En vivo", FT: "Finalizado", AET: "Finalizado (extra)", PEN: "Finalizado (penales)",
  NS: "Aún no comienza", PST: "Pospuesto", CANC: "Cancelado",
};

function FilaEnfrentada({ etiqueta, icono, valorLocal, valorVisitante, tema, destacar }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${tema.borde}` }}>
      <div style={{ flex: 1, textAlign: "right", fontWeight: "bold", fontSize: destacar ? 15 : 13, color: destacar ? "#e05555" : tema.texto }}>
        {valorLocal ?? "—"}
      </div>
      <div style={{ flex: 1.4, textAlign: "center", fontSize: 11, color: tema.textoSuave, padding: "0 6px", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
        {icono && <Icono tipo={icono} size={12} />} {etiqueta}
      </div>
      <div style={{ flex: 1, textAlign: "left", fontWeight: "bold", fontSize: destacar ? 15 : 13, color: destacar ? "#e05555" : tema.texto }}>
        {valorVisitante ?? "—"}
      </div>
    </div>
  );
}

function MiniCancha({ equipo, colorEquipo, invertido }) {
  const ANCHO = 260;
  const ALTO = 220;
  const jugadores = equipo?.startXI || [];

  // Agrupamos por fila del grid ("fila:columna") para repartir el ancho entre los de la misma línea
  const porFila = {};
  jugadores.forEach((j) => {
    const grid = j.player?.grid;
    if (!grid) return;
    const [fila] = grid.split(":").map(Number);
    if (!porFila[fila]) porFila[fila] = [];
    porFila[fila].push(j);
  });

  const filas = Object.keys(porFila).map(Number).sort((a, b) => a - b);
  const maxFila = filas.length > 0 ? Math.max(...filas) : 1;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <img src={corregirEscudo(equipo?.team?.logo)} alt="" width={18} height={18} onError={manejarErrorEscudo} />
        <strong style={{ fontSize: 11 }}>{equipo?.team?.name}</strong>
        <span style={{ fontSize: 10, color: "#9fc4ac" }}>({equipo?.formation || "—"})</span>
      </div>
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} width="100%" height={ALTO} style={{ background: "#1a4d2e", borderRadius: 6 }}>
        <line x1="0" y1={ALTO / 2} x2={ANCHO} y2={ALTO / 2} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
        <circle cx={ANCHO / 2} cy={ALTO / 2} r="24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
        {filas.map((fila) => {
          const jugadoresFila = porFila[fila].sort((a, b) => {
            const colA = Number(a.player.grid.split(":")[1]);
            const colB = Number(b.player.grid.split(":")[1]);
            return colA - colB;
          });
          const yBase = invertido
            ? (fila / (maxFila + 1)) * ALTO
            : ALTO - (fila / (maxFila + 1)) * ALTO;

          return jugadoresFila.map((j, i) => {
            const x = ((i + 1) / (jugadoresFila.length + 1)) * ANCHO;
            return (
              <g key={j.player.id}>
                <circle cx={x} cy={yBase} r="11" fill={colorEquipo} stroke="#fff" strokeWidth="1.5" />
                <text x={x} y={yBase + 4} textAnchor="middle" fontSize="9" fill="#fff" fontWeight="bold">
                  {j.player.number ?? "-"}
                </text>
                <text x={x} y={yBase + 20} textAnchor="middle" fontSize="7" fill="#fff">
                  {(j.player.name || "").split(" ").pop()}
                </text>
              </g>
            );
          });
        })}
      </svg>
    </div>
  );
}

function AlineacionesPartido({ fixtureId, colorMarcaLocal, colorMarcaVisitante, tema, acentoMarca }) {
  const [alineaciones, setAlineaciones] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!fixtureId) { setAlineaciones(null); setCargando(false); return; }
    let cancelado = false;
    setCargando(true);
    fetch(`/api/alineaciones?fixtureId=${fixtureId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelado) return;
        setAlineaciones(!data.error && Array.isArray(data) ? data : null);
        setCargando(false);
      })
      .catch(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, [fixtureId]);

  if (cargando || !alineaciones || alineaciones.length < 2) return null;

  return (
    <div style={{ background: tema.panel, borderRadius: 6, borderTop: `3px solid ${acentoMarca}`, padding: 14, marginBottom: 18 }}>
      <h4 style={{ margin: "0 0 12px", fontSize: 11, color: acentoMarca, display: "flex", alignItems: "center", gap: 6 }}><Icono tipo="balon" size={13} /> {traducir("alineacionesConfirmadas")}</h4>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <MiniCancha equipo={alineaciones[0]} colorEquipo={colorMarcaLocal} invertido={false} />
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <MiniCancha equipo={alineaciones[1]} colorEquipo={colorMarcaVisitante} invertido={true} />
        </div>
      </div>
    </div>
  );
}

function EstadisticasPartidoReal({ fixtureId, nombreLocal, nombreVisitante, tema, acentoMarca }) {
  const [stats, setStats] = useState(null);
  const [enVivo, setEnVivo] = useState(false);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!fixtureId) { setStats(null); setCargando(false); return; }
    let cancelado = false;

    async function actualizar() {
      try {
        const resMarcador = await fetch(`/api/marcador-vivo?fixtureId=${fixtureId}`);
        const marcador = await resMarcador.json();
        if (cancelado) return;

        const enCurso = !marcador.error && ESTADOS_EN_VIVO.includes(marcador.estadoCorto);
        const finalizado = !marcador.error && ["FT", "AET", "PEN"].includes(marcador.estadoCorto);
        setEnVivo(enCurso);

        if (!enCurso && !finalizado) { setStats(null); setCargando(false); return; }

        const res = await fetch(`/api/estadisticas-partido?fixtureId=${fixtureId}`);
        const data = await res.json();
        if (cancelado) return;
        if (!data.error) {
          setStats(procesarEstadisticasPartido(data, data?.[0]?.team?.id));
        }
        setCargando(false);
      } catch {
        if (!cancelado) setCargando(false);
      }
    }

    actualizar();
    const intervalo = setInterval(actualizar, 20000);
    return () => { cancelado = true; clearInterval(intervalo); };
  }, [fixtureId]);

  if (cargando || !stats) return null;

  return (
    <div style={{ background: tema.panel, borderRadius: 6, borderTop: `3px solid ${enVivo ? "#e05555" : acentoMarca}`, padding: 14, marginBottom: 18, fontSize: 12 }}>
      <h4 style={{ margin: "0 0 4px", fontSize: 11, color: enVivo ? "#e05555" : acentoMarca }}>
        {enVivo
          ? <><Icono tipo="puntoLleno" size={9} color="#e05555" /> {traducir("statsEnVivo")}</>
          : <><Icono tipo="barras" size={12} /> {traducir("statsReales")}</>}
      </h4>
      <div style={{ display: "flex", marginBottom: 8 }}>
        <div style={{ flex: 1, textAlign: "right", fontSize: 11, fontWeight: "bold" }}>{nombreLocal}</div>
        <div style={{ flex: 1.4 }} />
        <div style={{ flex: 1, textAlign: "left", fontSize: 11, fontWeight: "bold" }}>{nombreVisitante}</div>
      </div>

      <FilaEnfrentada icono="banderin" etiqueta={traducir("cornersCorto")} valorLocal={stats.corners.home} valorVisitante={stats.corners.away} tema={tema} />
      <FilaEnfrentada icono="tarjeta" etiqueta={traducir("amarillasCorto")} valorLocal={stats.amarillas.home} valorVisitante={stats.amarillas.away} tema={tema} />
      {(stats.rojas.home || stats.rojas.away) && (
        <FilaEnfrentada icono="tarjeta" etiqueta={traducir("rojasCorto")} valorLocal={stats.rojas.home} valorVisitante={stats.rojas.away} tema={tema} destacar />
      )}
      <FilaEnfrentada icono="exclamacion" etiqueta={traducir("faltasCorto")} valorLocal={stats.faltas.home} valorVisitante={stats.faltas.away} tema={tema} />
      <FilaEnfrentada icono="balon" etiqueta={traducir("posesionCorto")} valorLocal={stats.posesion.home} valorVisitante={stats.posesion.away} tema={tema} />
      {(stats.tirosTotales.home || stats.tirosTotales.away) && (
        <FilaEnfrentada icono="objetivo" etiqueta={traducir("tirosTotalesCorto")} valorLocal={stats.tirosTotales.home} valorVisitante={stats.tirosTotales.away} tema={tema} />
      )}
      {(stats.tirosPuerta.home || stats.tirosPuerta.away) && (
        <FilaEnfrentada icono="porteria" etiqueta={traducir("tirosPuertaCorto")} valorLocal={stats.tirosPuerta.home} valorVisitante={stats.tirosPuerta.away} tema={tema} />
      )}

      <p style={{ fontSize: 9, color: tema.textoSuave, marginTop: 8, marginBottom: 0 }}>
        Datos totales del partido — no siempre está disponible el desglose por tiempo, según la cobertura de la liga.
      </p>
    </div>
  );
}

function MarcadorEnVivo({ fixtureId, equipoLocal, equipoVisitante, tema, acentoMarca, sesion, onPedirLogin, mostrarToast }) {
  const [marcador, setMarcador] = useState(null);
  const [error, setError] = useState("");
  const [vigilando, setVigilando] = useState(false);
  const [cargandoVigilancia, setCargandoVigilancia] = useState(false);
  const [compacto, setCompacto] = useState(false);

  const nombreLocal = equipoLocal?.team?.name;
  const nombreVisitante = equipoVisitante?.team?.name;

  // Al bajar la pantalla, se achica un poco para no ocupar tanto espacio fijo;
  // al volver arriba del todo, recupera su tamaño normal.
  useEffect(() => {
    function alScrollear() {
      setCompacto(window.scrollY > 60);
    }
    alScrollear();
    window.addEventListener("scroll", alScrollear, { passive: true });
    return () => window.removeEventListener("scroll", alScrollear);
  }, []);

  useEffect(() => {
    if (!fixtureId) return;
    let cancelado = false;

    async function consultar() {
      try {
        const res = await fetch(`/api/marcador-vivo?fixtureId=${fixtureId}`);
        const data = await res.json();
        if (cancelado) return;
        if (data.error) setError(data.error);
        else { setMarcador(data); setError(""); }
      } catch {
        if (!cancelado) setError("No se pudo consultar el marcador");
      }
    }

    consultar();
    const enVivo = marcador && ESTADOS_EN_VIVO.includes(marcador.estadoCorto);
    const intervalo = setInterval(consultar, enVivo ? 20000 : 60000);

    return () => { cancelado = true; clearInterval(intervalo); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixtureId, marcador?.estadoCorto]);

  // Revisa si ya se está avisando de alguno de los dos equipos de este partido
  useEffect(() => {
    if (!sesion || !equipoLocal?.team?.id || !equipoVisitante?.team?.id) { setVigilando(false); return; }
    let cancelado = false;
    supabase
      .from("favoritos")
      .select("team_id, notificar")
      .eq("user_id", sesion.user.id)
      .in("team_id", [equipoLocal.team.id, equipoVisitante.team.id])
      .then(({ data }) => {
        if (!cancelado) setVigilando(!!(data || []).some((f) => f.notificar));
      });
    return () => { cancelado = true; };
  }, [sesion, equipoLocal?.team?.id, equipoVisitante?.team?.id]);

  // Activa o desactiva el aviso de gol/fin de partido para AMBOS equipos de este encuentro
  // (si todavía no eran favoritos, los agrega — es un atajo rápido para no tener que ir a Favoritos)
  async function alternarVigilancia() {
    if (!sesion) { onPedirLogin && onPedirLogin(); return; }
    if (!equipoLocal?.team?.id || !equipoVisitante?.team?.id) return;
    setCargandoVigilancia(true);
    try {
      if (!vigilando) {
        const { data: perfilData } = await supabase.from("perfiles").select("notif_activadas").eq("user_id", sesion.user.id).maybeSingle();
        if (!perfilData?.notif_activadas) {
          mostrarToast && mostrarToast("Primero activá las notificaciones en Ajustes > Preferencias de notificaciones.");
          setCargandoVigilancia(false);
          return;
        }
      }
      for (const eq of [equipoLocal, equipoVisitante]) {
        const { data: existente } = await supabase.from("favoritos").select("id").eq("user_id", sesion.user.id).eq("team_id", eq.team.id).maybeSingle();
        if (existente) {
          const { error } = await supabase.from("favoritos").update({ notificar: !vigilando }).eq("user_id", sesion.user.id).eq("team_id", eq.team.id);
          if (error) throw error;
        } else if (!vigilando) {
          const { error } = await supabase.from("favoritos").insert({
            user_id: sesion.user.id, team_id: eq.team.id, team_name: eq.team.name, team_logo: eq.team.logo, team_country: eq.team.country, notificar: true,
          });
          if (error) throw error;
        }
      }
      setVigilando(!vigilando);
      mostrarToast && mostrarToast(!vigilando ? "Te vamos a avisar de los goles y el final de este partido." : "Dejamos de avisarte de este partido.");
    } catch {
      mostrarToast && mostrarToast("No se pudo actualizar el aviso. Intenta de nuevo.");
    }
    setCargandoVigilancia(false);
  }

  if (!fixtureId || error || !marcador) return null;

  const enVivo = ESTADOS_EN_VIVO.includes(marcador.estadoCorto);
  const finalizado = ["FT", "AET", "PEN"].includes(marcador.estadoCorto);

  if (!enVivo && !finalizado) return null; // "NS" (aún no comienza) no muestra nada

  return (
    <>
      {/* Espacio reservado en el flujo normal, para que el contenido de abajo no
          salte hacia arriba al sacar la caja del marcador del flujo (position: fixed) */}
      <div style={{ height: compacto ? 40 : 66, marginBottom: 14 }} />
      <div className="jmcs-marcador-sticky">
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: compacto ? 10 : 16, flexWrap: "wrap",
          background: tema.panel, borderRadius: 8, padding: compacto ? "5px 12px" : "10px 16px",
          border: enVivo ? `2px solid ${acentoMarca}` : `1px solid ${tema.borde}`,
          boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
          transition: "padding 0.15s ease, gap 0.15s ease",
        }}>
          {enVivo && (
            <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#e05555", fontWeight: "bold", fontSize: compacto ? 10 : 12 }}>
              <span style={{ width: compacto ? 6 : 8, height: compacto ? 6 : 8, borderRadius: "50%", background: "#e05555", display: "inline-block", animation: "jmcsPulso 1.5s ease-in-out infinite" }} />
              {!compacto && "EN VIVO"}
              <button
                onClick={alternarVigilancia}
                disabled={cargandoVigilancia}
                title={vigilando ? "Dejar de avisarme de este partido" : "Avisarme de goles y del final de este partido"}
                style={{
                  background: "transparent", border: "none", cursor: cargandoVigilancia ? "default" : "pointer",
                  color: vigilando ? acentoMarca : tema.textoSuave, padding: 0, display: "flex", alignItems: "center",
                }}
              >
                <Icono tipo={vigilando ? "campana" : "campanaTachada"} size={compacto ? 11 : 14} />
              </button>
            </span>
          )}
          <span style={{ fontSize: compacto ? 12 : 15 }}>{nombreLocal}</span>
          <span style={{ fontSize: compacto ? 15 : 20, fontWeight: "bold" }}>{marcador.golesLocal} - {marcador.golesVisitante}</span>
          <span style={{ fontSize: compacto ? 12 : 15 }}>{nombreVisitante}</span>
          {!compacto && (
            <span style={{ fontSize: 12, color: tema.textoSuave }}>
              {marcador.minuto ? `${marcador.minuto}'` : ""} {ETIQUETAS_ESTADO[marcador.estadoCorto] || marcador.estadoCorto}
            </span>
          )}
        </div>
      </div>
    </>
  );
}

// ===== Estudio Climático Personalizado =====

const VERDE_FOSFO = "#39ff14";
const VERDE_APAGADO = "#2e6b3e";
const COLOR_AJUSTE_USUARIO = "#ff8a3d";

// Convierte los datos reales de clima (mm, km/h, °C, %) a una escala 0-10,
// usando las fórmulas que acordamos. La de temperatura es una primera
// propuesta (18°C = impacto mínimo, los extremos suben hacia 10) — ajustable.
function normalizarClima(climaData) {
  if (!climaData) return null;
  const viento = Math.min(10, (climaData.vientoMaxKmh || 0) / 6);
  const lluvia = Math.min(10, (climaData.precipitacionMm || 0) / 2);
  const humedad = Math.min(10, (climaData.humedadPct || 0) / 10);
  const tempProm = ((climaData.temperaturaMax || 18) + (climaData.temperaturaMin || 18)) / 2;
  const temperatura = Math.min(10, Math.abs(tempProm - 18) / 1.7);
  return { viento, lluvia, temperatura, humedad };
}

// Genera los puntos de una onda senoidal uniforme. phase=0 arranca en el valle,
// phase=1 arranca en el pico — así las dos ondas de una misma línea se cruzan.
function genWave(ancho, alto, phase, puntos = 60) {
  const pts = [];
  for (let i = 0; i <= puntos; i++) {
    const x = (i / puntos) * ancho;
    const angulo = (i / puntos) * Math.PI * 4 + (phase ? Math.PI : 0);
    const y = alto / 2 + Math.sin(angulo) * (alto * 0.32);
    pts.push([x, y]);
  }
  return pts;
}

// Construye el "d" del SVG <path>, revelando solo el tramo hasta limitX
function pathHastaX(puntos, limitX) {
  const visibles = puntos.filter((p) => p[0] <= limitX);
  if (visibles.length < 2) return "";
  return visibles.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
}

// Altura de la onda en una posición X exacta (interpolando entre los puntos más cercanos)
function waveY(puntos, x) {
  for (let i = 0; i < puntos.length - 1; i++) {
    if (x >= puntos[i][0] && x <= puntos[i + 1][0]) {
      const t = (x - puntos[i][0]) / (puntos[i + 1][0] - puntos[i][0] || 1);
      return puntos[i][1] + (puntos[i + 1][1] - puntos[i][1]) * t;
    }
  }
  return puntos[puntos.length - 1][1];
}

function DatosGeneralesEncuentro({ partidoCalendario, climaData, cargandoClima, tema, acentoMarca, cubierto: cubiertoProp, onAbrirEstudioClimatico }) {
  if (!partidoCalendario) return null;

  const arbitro = partidoCalendario.fixture?.referee;
  const venue = partidoCalendario.fixture?.venue;
  const cubierto = esEstadioCubierto(venue?.name);

  if (!arbitro && !venue && !climaData && !cargandoClima) return null;

  return (
    <div style={{ background: tema.panel, borderRadius: 6, borderTop: `3px solid ${acentoMarca}`, padding: 14, marginBottom: 18, fontSize: 12 }}>
      <h4 style={{ margin: "0 0 8px", fontSize: 11, color: acentoMarca, display: "flex", alignItems: "center", gap: 6 }}><Icono tipo="portapapeles" size={13} /> {traducir("datosGenerales")}</h4>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {venue?.name && (
          <div style={{ minWidth: 0, wordBreak: "break-word" }}>
            <Icono tipo="estadio" size={12} /> {venue.name}{venue.city ? `, ${venue.city}` : ""}{cubierto && " (cubierto)"}
          </div>
        )}
        <div style={{ minWidth: 0, wordBreak: "break-word", display: "flex", alignItems: "center", gap: 5 }}><Icono tipo="balanza" size={12} /> {traducir("arbitro")}: {arbitro || traducir("sinDatosCorto")}</div>
        {cargandoClima && <div style={{ color: tema.textoSuave }}>Cargando clima...</div>}
        {climaData && !cubierto && (
          <>
            <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 5 }}><Icono tipo="termometro" size={12} /> {climaData.temperaturaMin}° – {climaData.temperaturaMax}°C</div>
            <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 5 }}><Icono tipo="lluvia" size={12} /> {climaData.precipitacionMm} mm lluvia</div>
            <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 5 }}><Icono tipo="viento" size={12} /> Viento máx. {climaData.vientoMaxKmh} km/h</div>
            {climaData.humedadPct !== null && climaData.humedadPct !== undefined && (
              <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 5 }}><Icono tipo="gota" size={12} /> Humedad {Math.round(climaData.humedadPct)}%</div>
            )}
          </>
        )}
      </div>

      {climaData && !cubierto && (
        <button
          onClick={onAbrirEstudioClimatico}
          style={{
            marginTop: 12, padding: "8px 14px", fontSize: 12, fontWeight: "bold",
            background: acentoMarca, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer",
          }}
        >
          <Icono tipo="lluvia" size={14} /> {traducir("estudioClimatico")}
        </button>
      )}
      {climaData && cubierto && (
        <p style={{ marginTop: 10, fontSize: 11, color: tema.textoSuave }}>
          Opción no disponible: estadio cerrado.
        </p>
      )}
    </div>
  );
}

function TimelineClima({ titulo, valorOficial, activo, valorUsuario, onToggleActivo, onCambiarValor, tema, unidadTexto }) {
  const ANCHO = 280;
  const ALTO = 72;
  const svgRef = useRef(null);
  const [arrastrando, setArrastrando] = useState(false);

  const ondaOficial = genWave(ANCHO, ALTO, 0);
  const ondaUsuario = genWave(ANCHO, ALTO, 1);

  const xOficial = (valorOficial / 10) * ANCHO;
  const xUsuario = (valorUsuario / 10) * ANCHO;

  // Cuando el usuario NO activó su ajuste, JMCS brilla (fosforescente).
  // Cuando SÍ lo activó, el usuario pasa a brillar y JMCS baja de intensidad.
  const colorOficial = activo ? VERDE_APAGADO : VERDE_FOSFO;
  const colorUsuario = VERDE_FOSFO;

  function valorDesdeEvento(clientX) {
    const rect = svgRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(ANCHO, ((clientX - rect.left) / rect.width) * ANCHO));
    return Math.round((x / ANCHO) * 10 * 10) / 10; // redondeado a 1 decimal
  }

  function iniciarArrastre(e) {
    if (!activo) return;
    setArrastrando(true);
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    onCambiarValor(valorDesdeEvento(clientX));
  }

  function moverArrastre(e) {
    if (!arrastrando) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    onCambiarValor(valorDesdeEvento(clientX));
  }

  function soltarArrastre() {
    setArrastrando(false);
  }

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: "bold", color: "#9fc4ac", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {titulo}
        </span>
        <label style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 5, cursor: "pointer", color: "#9fc4ac" }}>
          <input type="checkbox" checked={activo} onChange={(e) => onToggleActivo(e.target.checked)} style={{ accentColor: COLOR_AJUSTE_USUARIO }} />
          Mi propio ajuste
        </label>
      </div>

      <div style={{ background: "#0a0a0a", borderRadius: 6, padding: "8px 10px" }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${ANCHO} ${ALTO}`}
          width="100%"
          height={ALTO}
          style={{ display: "block", touchAction: "none", cursor: activo ? "pointer" : "default" }}
          onMouseDown={iniciarArrastre}
          onMouseMove={moverArrastre}
          onMouseUp={soltarArrastre}
          onMouseLeave={soltarArrastre}
          onTouchStart={iniciarArrastre}
          onTouchMove={moverArrastre}
          onTouchEnd={soltarArrastre}
        >
          {/* Línea guía central punteada */}
          <line x1="0" y1={ALTO / 2} x2={ANCHO} y2={ALTO / 2} stroke="#333" strokeDasharray="2,3" />

          {/* Onda del dato oficial de JMCS */}
          <path d={pathHastaX(ondaOficial, xOficial)} fill="none" stroke={colorOficial} strokeWidth="1.5" opacity={activo ? 0.5 : 0.75} />
          <circle cx={xOficial} cy={waveY(ondaOficial, xOficial)} r="5" fill={colorOficial} opacity={activo ? 1 : 0.78} />

          {/* Onda del ajuste del usuario (solo si está activo) */}
          {activo && (
            <>
              <path d={pathHastaX(ondaUsuario, xUsuario)} fill="none" stroke={colorUsuario} strokeWidth="1.5" opacity="0.8" />
              {arrastrando ? (
                <rect x={xUsuario - 1.5} y="2" width="3" height={ALTO - 4} fill={colorUsuario} opacity="0.8" />
              ) : (
                <circle cx={xUsuario} cy={waveY(ondaUsuario, xUsuario)} r="5" fill={colorUsuario} opacity="0.78" />
              )}
            </>
          )}
        </svg>

        {/* Escala 0-10 */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "#666", marginTop: 2 }}>
          <span>0</span><span>5</span><span>10</span>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginTop: 6, color: "#9fc4ac" }}>
        <span>Oficial (JMCS): <strong style={{ color: colorOficial }}>{valorOficial.toFixed(1)}</strong>{unidadTexto ? ` · ${unidadTexto}` : ""}</span>
        {activo && <span>Mi ajuste: <strong style={{ color: colorUsuario }}>{valorUsuario.toFixed(1)}</strong></span>}
      </div>
    </div>
  );
}

const NOMBRES_VARIABLES = { viento: "Viento", lluvia: "Lluvia", temperatura: "Temperatura", humedad: "Humedad" };

function TarjetaEquipoClima({ equipo, rol, ajustes, climaOficial, onCambiar, tema, colorMarca }) {
  return (
    <div style={{ flex: 1, minWidth: 260, background: "#111", borderRadius: 8, padding: 14, borderTop: `3px solid ${colorMarca}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <img src={corregirEscudo(equipo.logo)} alt={equipo.name} width={26} height={26} onError={manejarErrorEscudo} />
        <strong style={{ color: colorMarca, fontSize: 14 }}><BanderaPais pais={equipo.country} size={16} /> {equipo.name}</strong>
      </div>
      {["viento", "lluvia", "temperatura", "humedad"].map((v) => (
        <TimelineClima
          key={v}
          titulo={NOMBRES_VARIABLES[v]}
          valorOficial={climaOficial[v]}
          activo={ajustes[v]?.activo || false}
          valorUsuario={ajustes[v]?.valorUsuario ?? climaOficial[v]}
          onToggleActivo={(activo) => onCambiar(rol, v, { activo, valorUsuario: activo ? (ajustes[v]?.valorUsuario ?? climaOficial[v]) : ajustes[v]?.valorUsuario })}
          onCambiarValor={(valor) => onCambiar(rol, v, { valorUsuario: valor })}
          tema={tema}
        />
      ))}
    </div>
  );
}

function ModalEstudioClimatico({
  equipoLocal, equipoVisitante, climaOficial, ajustesClima, onCambiarAjuste,
  modoGlobalClima, onPedirActivarGlobal, onDesactivarGlobal,
  confirmarGlobalAbierto, onConfirmarGlobal, onCancelarConfirmarGlobal,
  lambdaGolesLocalReal, lambdaGolesVisitanteReal, factorLocal, factorVisitante,
  onRestaurar, onGuardar, guardando, guardado,
  tema, acentoMarca, colorMarcaLocal, colorMarcaVisitante, onCerrar,
  tutorialesOcultos, onOcultarPermanente,
}) {
  if (!ajustesClima || !climaOficial) return null;

  // Mismo cálculo exacto que usa el semáforo real de Estudio — sin aproximaciones.
  const baseLocal = lambdaGolesLocalReal ?? 1.3;
  const baseVisitante = lambdaGolesVisitanteReal ?? 1.1;
  const totalOficial = baseLocal + baseVisitante;
  const totalPersonal = baseLocal * factorLocal + baseVisitante * factorVisitante;
  const over25Oficial = Math.round(probabilidadOver(totalOficial, 2.5) * 100);
  const over25Personal = Math.round(probabilidadOver(totalPersonal, 2.5) * 100);
  const bttsOficial = Math.round((probabilidadBTTS(baseLocal, baseVisitante) || 0) * 100);
  const bttsPersonal = Math.round((probabilidadBTTS(baseLocal * factorLocal, baseVisitante * factorVisitante) || 0) * 100);

  return (
    <div onClick={onCerrar} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 12 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "rgba(14, 42, 27, 0.93)", borderRadius: 12, padding: 20, width: "min(92vw, 900px)", maxHeight: "90vh", overflowY: "auto", position: "relative", color: "#EAF3EC" }}>
        <div style={{ position: "sticky", top: 0, display: "flex", justifyContent: "flex-end", zIndex: 10, marginBottom: -8 }}>
          <button
            onClick={onCerrar}
            style={{
              background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: "50%",
              width: 30, height: 30, fontSize: 16, cursor: "pointer", color: "#fff",
              boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
            }}
          >
            <Icono tipo="cerrar" size={16} />
          </button>
        </div>

        <h3 style={{ margin: "0 0 4px", fontSize: 16, display: "flex", alignItems: "center", gap: 7 }}><Icono tipo="lluvia" size={17} /> {traducir("estudioClimatico")}</h3>
        <p style={{ margin: "0 0 4px", fontSize: 12, color: "#b9d6c3" }}>{equipoLocal.team.name} vs {equipoVisitante.team.name}</p>
        <p style={{ margin: "0 0 16px", fontSize: 11, color: "#b9d6c3", fontStyle: "italic" }}>
          Esto es tu estudio personal — no cambia el pronóstico oficial de JMCS, solo lo que ves aquí y en tu Estudio mientras esté activo.
        </p>

        <TutorialFlotante
          id="clima"
          titulo={traducir("tutClimaTitulo")}
          texto={traducir("tutClimaTexto")}
          tema={tema}
          acentoMarca={acentoMarca}
          tutorialesOcultos={tutorialesOcultos}
          onOcultarPermanente={onOcultarPermanente}
        />

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18, padding: "8px 10px", background: "rgba(255,60,60,0.08)", borderRadius: 6, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={modoGlobalClima}
            onChange={(e) => (e.target.checked ? onPedirActivarGlobal() : onDesactivarGlobal())}
            style={{ accentColor: "#e05555" }}
          />
          <span style={{ fontSize: 12, color: "#e05555", fontWeight: "bold" }}>Aplicar para todos los encuentros</span>
        </label>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <TarjetaEquipoClima equipo={equipoLocal.team} rol="local" ajustes={ajustesClima.local} climaOficial={climaOficial} onCambiar={onCambiarAjuste} tema={tema} colorMarca={colorMarcaLocal} />
          <TarjetaEquipoClima equipo={equipoVisitante.team} rol="visitante" ajustes={ajustesClima.visitante} climaOficial={climaOficial} onCambiar={onCambiarAjuste} tema={tema} colorMarca={colorMarcaVisitante} />
        </div>

        <div style={{ marginTop: 20, padding: 14, background: "#111", borderRadius: 8 }}>
          <h4 style={{ margin: "0 0 10px", fontSize: 12, color: "#b9d6c3", textTransform: "uppercase" }}>Comparación (ilustrativa)</h4>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 13 }}>
            <div>Over 2.5 — Oficial: <strong style={{ color: VERDE_APAGADO }}>{over25Oficial}%</strong> · Mi estudio: <strong style={{ color: COLOR_AJUSTE_USUARIO }}>{over25Personal}%</strong></div>
            <div>BTTS — Oficial: <strong style={{ color: VERDE_APAGADO }}>{bttsOficial}%</strong> · Mi estudio: <strong style={{ color: COLOR_AJUSTE_USUARIO }}>{bttsPersonal}%</strong></div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button onClick={onRestaurar} style={{ flex: 1, padding: 10, fontSize: 13, background: "transparent", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", borderRadius: 6, cursor: "pointer" }}>
            ↺ Restaurar a lo oficial
          </button>
          <button onClick={onGuardar} disabled={guardando || guardado} style={{ flex: 1, padding: 10, fontSize: 13, fontWeight: "bold", background: guardado ? "#2e9e4f" : acentoMarca, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
            {guardado
              ? <><Icono tipo="check" size={13} /> {traducir("guardado")}</>
              : guardando ? traducir("guardando") : <><Icono tipo="disquete" size={13} /> {traducir("guardarEnHistorial")}</>}
          </button>
        </div>
        <p style={{ fontSize: 10, color: "#9fc4ac", marginTop: 6, textAlign: "center" }}>
          Tu ajuste ya está activo en Estudio sin necesidad de guardar — esto solo envía una copia a tu Historial de aciertos, para comparar después contra el resultado real.
        </p>

        {confirmarGlobalAbierto && (
          <div onClick={(e) => e.stopPropagation()} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20 }}>
            <div style={{ background: tema.panel, borderRadius: 10, padding: 22, maxWidth: 360 }}>
              <h4 style={{ marginTop: 0, fontSize: 14 }}>Aplicar a todos los encuentros</h4>
              <p style={{ fontSize: 12, color: tema.textoSuave, lineHeight: 1.5 }}>
                Vas a aplicar tu ajuste climático a todos los partidos que analices de ahora en adelante — no un valor fijo, sino tu misma diferencia respecto al clima real de cada encuentro. Puedes desactivarlo cuando quieras. ¿Estás de acuerdo?
              </p>
              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <button onClick={onCancelarConfirmarGlobal} style={{ flex: 1, padding: 10, fontSize: 13, background: "transparent", border: `1px solid ${tema.borde}`, color: tema.texto, borderRadius: 6, cursor: "pointer" }}>
                  Cancelar
                </button>
                <button onClick={onConfirmarGlobal} style={{ flex: 1, padding: 10, fontSize: 13, fontWeight: "bold", background: "#e05555", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
                  Sí, activar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


function ContenedorToasts({ toasts }) {
  return (
    <div style={{ position: "fixed", bottom: 90, left: 12, zIndex: 500, display: "flex", flexDirection: "column", gap: 8, maxWidth: "calc(100vw - 24px)" }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            background: "rgba(20,20,20,0.95)", color: "#fff", padding: "10px 16px", borderRadius: 8,
            fontSize: 12, boxShadow: "0 4px 14px rgba(0,0,0,0.4)", borderLeft: "3px solid #e0a83a",
            animation: t.saliendo ? "jmcsToastSalir 0.35s ease-in forwards" : "jmcsToastEntrar 0.35s ease-out",
            maxWidth: 320,
          }}
        >
          <Icono tipo="exclamacion" size={13} /> {t.mensaje}
        </div>
      ))}
    </div>
  );
}

function AuthModal({ tema, acentoMarca, onCerrar, modoInicial }) {
  const [modo, setModo] = useState(modoInicial || "login"); // "login" | "registro" | "magico"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
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
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user) {
          await supabase.from("perfiles").insert({ user_id: data.user.id, username: username.trim() || null });
        }
        setMensaje("¡Cuenta creada! Verifica tu cuenta desde tu bandeja de entrada (revisa spam si no la ves) para poder iniciar sesión.");
      } else if (modo === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onCerrar();
      } else if (modo === "magico") {
        const { error } = await supabase.auth.signInWithOtp({ email });
        if (error) throw error;
        setMensaje("Te enviamos un enlace mágico a tu correo. Ábrelo desde este mismo dispositivo.");
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
          <Icono tipo="cerrar" size={16} />
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
          {modo === "registro" && (
            <input
              type="text"
              placeholder="Nombre de usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              maxLength={24}
              style={{ width: "100%", padding: 10, marginBottom: 10, fontSize: 14, background: tema.fondo, color: tema.texto, border: `1px solid ${tema.borde}`, borderRadius: 4 }}
            />
          )}

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
                  background: "transparent", border: "none", cursor: "pointer", color: tema.textoSuave,
                  display: "flex", alignItems: "center", padding: 4,
                }}
              >
                {mostrarPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-10-8-10-8a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s3-8 11-8 11 8 11 8-3 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
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

function MigasDePan({ vistaActual, vistaAnterior, equipoPerfil, tema, acentoMarca, onIrA }) {
  const nombres = { inicio: "Inicio", estudio: "Estudio", favoritos: "Favoritos" };

  const segmentos = [{ id: "inicio", etiqueta: "Inicio" }];

  if (vistaActual === "estudio") {
    segmentos.push({ id: "estudio", etiqueta: "Estudio" });
  } else if (vistaActual === "favoritos") {
    segmentos.push({ id: "favoritos", etiqueta: "Favoritos" });
  } else if (vistaActual === "equipo") {
    if (vistaAnterior !== "inicio") {
      segmentos.push({ id: vistaAnterior, etiqueta: nombres[vistaAnterior] || "Inicio" });
    }
    segmentos.push({ id: "equipo", etiqueta: equipoPerfil?.name || "Equipo" });
  }

  if (segmentos.length < 2) return null;

  return (
    <div className="jmcs-solo-pc" style={{ textAlign: "center", marginTop: 10, fontSize: 12, color: tema.textoSuave, textTransform: "uppercase", letterSpacing: "0.04em" }}>
      {segmentos.map((s, i) => (
        <span key={s.id}>
          {i > 0 && <span style={{ margin: "0 6px" }}>/</span>}
          {s.id === "equipo" ? (
            <span style={{ color: acentoMarca, fontWeight: "bold" }}>{s.etiqueta}</span>
          ) : (
            <span onClick={() => onIrA(s.id)} style={{ cursor: "pointer" }}>
              {s.etiqueta}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

function manejarErrorEscudo(e) {
  e.target.onerror = null;
  e.target.src = "/logo.png";
}

// La API reutiliza el mismo archivo "23394.png" como su aviso de "imagen no
// disponible" (HTTP 200, no un error real). Lo detectamos por su nombre exacto,
// ya que por tamaño no se puede distinguir de un escudo real (ambos son 150x150).
function corregirEscudo(url) {
  if (url && url.includes("23394.png")) return "/logo.png";
  return url;
}

function TarjetaPartidoInicio({ p, tema, acentoMarca, onClick, onAbrirPerfil, modoOscuro }) {
  const fecha = new Date(p.fixture.date);
  const horaTexto = fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const fechaTexto = fecha.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  const estado = p.fixture?.status?.short;
  const enVivo = ESTADOS_EN_VIVO.includes(estado);
  const yaTermino = ["FT", "AET", "PEN"].includes(estado);

  function irAPerfil(e, equipo) {
    e.stopPropagation();
    onAbrirPerfil({ id: equipo.id, name: equipo.name, logo: equipo.logo, country: p.league.country });
  }

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
        padding: "16px 14px",
        background: yaTermino ? (modoOscuro ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)") : tema.panel,
        borderRadius: 8, cursor: "pointer",
        borderTop: `3px solid ${enVivo ? "#e05555" : acentoMarca}`,
        opacity: yaTermino ? 0.72 : 1,
      }}
    >
      {/* Extremo izquierdo: equipo Local */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 0 }}>
        <img
          src={corregirEscudo(p.teams.home.logo)} alt="" width={36} height={36}
          onError={manejarErrorEscudo}
          onClick={(e) => irAPerfil(e, p.teams.home)}
          style={{ cursor: "pointer" }}
        />
        <span
          onClick={(e) => irAPerfil(e, p.teams.home)}
          style={{ fontSize: 12, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%", cursor: "pointer" }}
        >
          {p.teams.home.name}
        </span>
      </div>

      {/* Centro: datos básicos */}
      <div style={{ flexShrink: 0, textAlign: "center", padding: "0 6px" }}>
        <div style={{ fontSize: 9, color: tema.textoSuave, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 4 }}>
          {p.league.name}
        </div>
        {(() => {
          const yaJugado = estado && estado !== "NS" && estado !== "TBD" && estado !== "PST" && estado !== "CANC";
          if (yaJugado && p.goals?.home !== null && p.goals?.home !== undefined) {
            return (
              <>
                <div style={{ fontSize: 16, fontWeight: "bold", color: enVivo ? "#e05555" : acentoMarca }}>
                  {p.goals.home} - {p.goals.away}
                </div>
                <div style={{ fontSize: 8, color: enVivo ? "#e05555" : tema.textoSuave, fontWeight: enVivo ? "bold" : "normal" }}>
                  {enVivo ? `${p.fixture.status.elapsed || ""}' EN VIVO` : (ETIQUETAS_ESTADO[estado] || estado)}
                </div>
                {enVivo && p.fixture?.venue?.name && (
                  <div style={{ fontSize: 8, color: tema.textoSuave, marginTop: 2, display: "flex", alignItems: "center", gap: 3 }}><Icono tipo="estadio" size={9} /> {p.fixture.venue.name}</div>
                )}
              </>
            );
          }
          return <div style={{ fontSize: 13, fontWeight: "bold", color: acentoMarca }}>VS</div>;
        })()}
        <div style={{ fontSize: 10, color: tema.textoSuave, marginTop: 4 }}>{fechaTexto} · {horaTexto}</div>
      </div>

      {/* Extremo derecho: equipo Visitante */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 0 }}>
        <img
          src={corregirEscudo(p.teams.away.logo)} alt="" width={36} height={36}
          onError={manejarErrorEscudo}
          onClick={(e) => irAPerfil(e, p.teams.away)}
          style={{ cursor: "pointer" }}
        />
        <span
          onClick={(e) => irAPerfil(e, p.teams.away)}
          style={{ fontSize: 12, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%", cursor: "pointer" }}
        >
          {p.teams.away.name}
        </span>
      </div>
    </div>
  );
}

function ListaPartidosInicio({ tema, acentoMarca, onTocarPartido, onAbrirPerfil, mostrarToast, modoOscuro }) {
  const [partidos, setPartidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paisFiltro, setPaisFiltro] = useState(null);

  useEffect(() => {
    const hoy = new Date().toISOString().split("T")[0];
    setLoading(true);
    fetch(`/api/partidos-por-fecha?date=${hoy}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); mostrarToast && mostrarToast(data.error); }
        else setPartidos(data);
      })
      .catch(() => { setError("No se pudieron cargar los partidos"); mostrarToast && mostrarToast("No se pudieron cargar los partidos"); })
      .finally(() => setLoading(false));
  }, []);

  const partidosFiltrados = paisFiltro ? partidos.filter((p) => p.league?.country === paisFiltro) : partidos;

  // Orden dentro de cada país: en vivo primero, luego por jugar, jugados al final
  function prioridadPartido(p) {
    const estado = p.fixture?.status?.short;
    if (ESTADOS_EN_VIVO.includes(estado)) return 0;
    if (["FT", "AET", "PEN"].includes(estado)) return 2;
    return 1;
  }

  const grupos = {};
  partidosFiltrados.forEach((p) => {
    const pais = p.league?.country || "Otros";
    if (!grupos[pais]) grupos[pais] = [];
    grupos[pais].push(p);
  });
  Object.keys(grupos).forEach((pais) => {
    grupos[pais].sort((a, b) => prioridadPartido(a) - prioridadPartido(b));
  });

  // El minuto más alto entre los partidos en vivo de un país (-1 si no tiene ninguno en vivo)
  function minutoMasAltoEnVivo(partidosPais) {
    const enVivo = partidosPais.filter((p) => ESTADOS_EN_VIVO.includes(p.fixture?.status?.short));
    if (enVivo.length === 0) return -1;
    return Math.max(...enVivo.map((p) => p.fixture?.status?.elapsed || 0));
  }

  // Países con partidos en vivo van primero (el que tenga el minuto más alto, arriba de todo).
  // Los países sin nada en vivo quedan después, ordenados alfabéticamente como antes.
  const paisesOrdenados = Object.keys(grupos).sort((a, b) => {
    const minutoA = minutoMasAltoEnVivo(grupos[a]);
    const minutoB = minutoMasAltoEnVivo(grupos[b]);
    if (minutoA >= 0 && minutoB < 0) return -1;
    if (minutoA < 0 && minutoB >= 0) return 1;
    if (minutoA >= 0 && minutoB >= 0) return minutoB - minutoA;
    return a.localeCompare(b);
  });

  // Solo mostramos en la fila de accesos rápidos los países populares que sí tienen partidos hoy
  const paisesPopularesConPartidos = PAISES_POPULARES.filter((pais) => partidos.some((p) => p.league?.country === pais));

  return (
    <div>
      <h3 style={{ fontSize: 15, marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}><Icono tipo="balon" size={16} /> {traducir("partidosDeHoy")}</h3>

      {paisesPopularesConPartidos.length > 0 && (
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 10, marginBottom: 14 }}>
          <button
            onClick={() => setPaisFiltro(null)}
            style={{
              flexShrink: 0, padding: "6px 14px", fontSize: 12, borderRadius: 16, whiteSpace: "nowrap", cursor: "pointer",
              background: !paisFiltro ? acentoMarca : "transparent", color: !paisFiltro ? "#fff" : tema.texto,
              border: `1px solid ${!paisFiltro ? acentoMarca : tema.borde}`,
            }}
          >
            {traducir("todos")}
          </button>
          {paisesPopularesConPartidos.map((pais) => (
            <button
              key={pais}
              onClick={() => setPaisFiltro(pais === paisFiltro ? null : pais)}
              style={{
                flexShrink: 0, display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", fontSize: 12, borderRadius: 16, whiteSpace: "nowrap", cursor: "pointer",
                background: paisFiltro === pais ? acentoMarca : "transparent", color: paisFiltro === pais ? "#fff" : tema.texto,
                border: `1px solid ${paisFiltro === pais ? acentoMarca : tema.borde}`,
              }}
            >
              <BanderaPais pais={pais} url={partidos.find((x) => x.league?.country === pais)?.league?.flag} size={16} />
              {pais}
            </button>
          ))}
        </div>
      )}

      {loading && <p style={{ color: tema.textoSuave, fontSize: 13 }}>Cargando partidos...</p>}
      {error && <p style={{ color: "#e05555", fontSize: 13 }}>{error}</p>}
      {!loading && !error && partidosFiltrados.length === 0 && (
        <p style={{ color: tema.textoSuave, fontSize: 13 }}>No hay partidos disponibles para hoy en este plan.</p>
      )}
      {paisesOrdenados.map((pais) => (
        <div key={pais} id={`pais-${pais}`} style={{ marginBottom: 24 }}>
          <h4 style={{
            fontSize: 13, textTransform: "uppercase", letterSpacing: "0.04em", color: acentoMarca,
            borderBottom: `2px solid ${acentoMarca}`, paddingBottom: 6, marginBottom: 12,
          }}>
            <BanderaPais pais={pais} url={grupos[pais]?.[0]?.league?.flag} size={18} /> {pais}
          </h4>
          <div className="jmcs-partidos-grid">
            {grupos[pais].map((p) => (
              <TarjetaPartidoInicio key={p.fixture.id} p={p} tema={tema} acentoMarca={acentoMarca} onClick={() => onTocarPartido(p)} onAbrirPerfil={onAbrirPerfil} modoOscuro={modoOscuro} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TablaProximosEncuentros({ partidos, tema }) {
  if (!partidos || partidos.length === 0) {
    return <p style={{ color: tema.textoSuave, fontSize: 13 }}>No hay próximos encuentros programados por ahora.</p>;
  }
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr style={{ background: tema.encabezadoTabla, textAlign: "left" }}>
          <th style={{ padding: 6 }}>Fecha</th>
          <th style={{ padding: 6 }}>Torneo</th>
          <th style={{ padding: 6 }}>Partido</th>
        </tr>
      </thead>
      <tbody>
        {partidos.map((f) => (
          <tr key={f.fixture.id} style={{ borderBottom: `1px solid ${tema.filaBorde}` }}>
            <td style={{ padding: 6 }}>{new Date(f.fixture.date).toLocaleDateString("es-ES")}</td>
            <td style={{ padding: 6 }}>{f.league.name}</td>
            <td style={{ padding: 6 }}>{f.teams.home.name} vs {f.teams.away.name}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Convierte la clave pública VAPID (texto) al formato que pide el navegador para suscribirse a push
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function PantallaAjustes({ sesion, perfil, onPerfilActualizado, tema, acentoMarca, mostrarToast }) {
  const [procesando, setProcesando] = useState(false);
  const activadas = !!perfil?.notif_activadas;
  const soportado = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

  async function activarNotificaciones() {
    if (!soportado) {
      mostrarToast(traducir("notifNoSoportado"));
      return;
    }
    setProcesando(true);
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        mostrarToast(traducir("notifSinPermiso"));
        setProcesando(false);
        return;
      }
      const registro = await navigator.serviceWorker.register("/sw.js");
      const suscripcion = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
      });
      const json = suscripcion.toJSON();
      await supabase.from("push_subscriptions").upsert(
        {
          user_id: sesion.user.id,
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth_key: json.keys.auth,
        },
        { onConflict: "endpoint" }
      );
      const { data } = await supabase
        .from("perfiles")
        .update({ notif_activadas: true })
        .eq("user_id", sesion.user.id)
        .select()
        .maybeSingle();
      if (data) onPerfilActualizado(data);
      mostrarToast(traducir("notifActivadasMsg"));
    } catch (err) {
      mostrarToast(traducir("notifErrorActivar"));
    }
    setProcesando(false);
  }

  async function desactivarNotificaciones() {
    setProcesando(true);
    try {
      if (soportado) {
        const registro = await navigator.serviceWorker.getRegistration("/sw.js");
        const suscripcion = await registro?.pushManager.getSubscription();
        if (suscripcion) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", suscripcion.endpoint);
          await suscripcion.unsubscribe();
        }
      }
      const { data } = await supabase
        .from("perfiles")
        .update({ notif_activadas: false })
        .eq("user_id", sesion.user.id)
        .select()
        .maybeSingle();
      if (data) onPerfilActualizado(data);
      mostrarToast(traducir("notifDesactivadasMsg"));
    } catch (err) {
      mostrarToast(traducir("notifErrorDesactivar"));
    }
    setProcesando(false);
  }

  async function alternarTipo(campo, valorActual) {
    const { data, error } = await supabase
      .from("perfiles")
      .update({ [campo]: !valorActual })
      .eq("user_id", sesion.user.id)
      .select()
      .maybeSingle();
    if (data) onPerfilActualizado(data);
    else mostrarToast && mostrarToast(traducir("notifErrorGuardar"));
  }

  const TIPOS = [
    { campo: "notif_gol", icono: "balon", etiqueta: traducir("notifGol") },
    { campo: "notif_empieza", icono: "calendario", etiqueta: traducir("notifEmpieza") },
    { campo: "notif_termina", icono: "check", etiqueta: traducir("notifTermina") },
    { campo: "notif_tarjetas", icono: "tarjeta", etiqueta: traducir("notifTarjetas") },
    { campo: "notif_semaforo", icono: "semaforo", etiqueta: traducir("notifSemaforoEtiqueta") },
  ];

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <h3 style={{ fontSize: 18, marginBottom: 18, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
        <Icono tipo="menu" size={16} /> {traducir("ajustesTitulo")}
      </h3>

      <div style={{ background: tema.panel, border: `1px solid ${tema.borde}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <h4 style={{ margin: "0 0 6px", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
          <Icono tipo="campana" size={15} /> {traducir("prefsNotifTitulo")}
        </h4>
        <p style={{ fontSize: 11, color: tema.textoSuave, margin: "0 0 12px" }}>
          {traducir("prefsNotifDesc")}
        </p>

        <button
          onClick={activadas ? desactivarNotificaciones : activarNotificaciones}
          disabled={procesando}
          style={{
            width: "100%", padding: "10px 14px", borderRadius: 6, cursor: procesando ? "default" : "pointer",
            background: activadas ? "transparent" : acentoMarca, color: activadas ? "#e05555" : "#fff",
            border: activadas ? "1px solid #e05555" : "none", fontWeight: "bold", fontSize: 13, marginBottom: activadas ? 14 : 0,
          }}
        >
          {procesando ? traducir("unMomento") : activadas ? traducir("desactivarNotif") : traducir("activarNotif")}
        </button>

        {activadas && (
          <div>
            {TIPOS.map((tipo) => (
              <label
                key={tipo.campo}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: `1px solid ${tema.borde}`, fontSize: 13, cursor: "pointer" }}
              >
                <input
                  type="checkbox"
                  checked={!!perfil?.[tipo.campo]}
                  onChange={() => alternarTipo(tipo.campo, !!perfil?.[tipo.campo])}
                />
                <Icono tipo={tipo.icono} size={14} />
                {tipo.etiqueta}
              </label>
            ))}
            <p style={{ fontSize: 10, color: tema.textoSuave, marginTop: 10 }}>
              {traducir("notifSemaforoAviso")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function VistaAdmin({ sesion, esAdminPrincipal, tema, acentoMarca, mostrarToast }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [admins, setAdmins] = useState([]);
  const [nuevoEmail, setNuevoEmail] = useState("");
  const [mensajeAdmin, setMensajeAdmin] = useState("");
  const [errorAdmin, setErrorAdmin] = useState("");
  const [errores, setErrores] = useState([]);
  const [erroresAbiertos, setErroresAbiertos] = useState({});
  const [mantenimientoActivo, setMantenimientoActivo] = useState(false);
  const [mensajeMantenimiento, setMensajeMantenimiento] = useState("");

  function cargarTodo() {
    setCargando(true);
    supabase.rpc("admin_dashboard_stats").then(({ data, error }) => {
      if (error) setError(error.message);
      else setStats(data);
      setCargando(false);
    });
    supabase.rpc("listar_admins").then(({ data }) => {
      if (data) setAdmins(data);
    });
    supabase.rpc("listar_errores_cliente").then(({ data }) => {
      if (data) setErrores(data);
    });
    supabase
      .from("configuracion_app")
      .select("mantenimiento, mensaje_mantenimiento")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        setMantenimientoActivo(!!data?.mantenimiento);
        setMensajeMantenimiento(data?.mensaje_mantenimiento || "");
      });
  }

  useEffect(() => { cargarTodo(); }, []); // eslint-disable-line

  async function corregirError() {
    const { error } = await supabase.rpc("activar_mantenimiento", { mensaje: null });
    if (error) mostrarToast && mostrarToast("No se pudo activar el modo mantenimiento.");
    else { setMantenimientoActivo(true); mostrarToast && mostrarToast("Modo mantenimiento activado — los usuarios ya lo están viendo."); }
  }

  async function desactivarMantenimiento() {
    const { error } = await supabase.rpc("desactivar_mantenimiento");
    if (error) mostrarToast && mostrarToast("No se pudo desactivar.");
    else { setMantenimientoActivo(false); mostrarToast && mostrarToast("Modo mantenimiento desactivado."); }
  }

  async function borrarError(id) {
    const { error } = await supabase.rpc("borrar_error_cliente", { error_id: id });
    if (!error) setErrores((prev) => prev.filter((e) => e.id !== id));
  }

  async function agregarAdmin(e) {
    e.preventDefault();
    setMensajeAdmin("");
    setErrorAdmin("");
    const { error } = await supabase.rpc("agregar_admin", { nuevo_email: nuevoEmail });
    if (error) {
      setErrorAdmin(error.message);
    } else {
      setMensajeAdmin(`${nuevoEmail} ahora es administrador.`);
      setNuevoEmail("");
      cargarTodo();
    }
  }

  async function quitarAdmin(userId) {
    setErrorAdmin("");
    const { error } = await supabase.rpc("quitar_admin", { admin_user_id: userId });
    if (error) setErrorAdmin(error.message);
    else cargarTodo();
  }

  if (cargando) return <p style={{ textAlign: "center", color: tema.textoSuave }}>{traducir("panelAdminCargando")}</p>;
  if (error) return <p style={{ textAlign: "center", color: "#e05555", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}><Icono tipo="exclamacion" size={13} /> {error}</p>;
  if (!stats) return null;

  const resueltas = stats.aciertos + stats.fallos;
  const porcentajeAciertos = resueltas > 0 ? Math.round((stats.aciertos / resueltas) * 100) : null;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 12px" }}>
      <h3 style={{ fontSize: 18, marginBottom: 18, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Icono tipo="corona" size={18} /> {traducir("panelAdmin")}</h3>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 24 }}>
        {[
          { etiqueta: traducir("panelAdminUsuarios"), valor: stats.totalUsuarios },
          { etiqueta: traducir("panelAdminEstudios"), valor: stats.totalEstudiosGuardados },
          { etiqueta: traducir("panelAdminAciertos"), valor: porcentajeAciertos !== null ? `${porcentajeAciertos}%` : traducir("panelAdminSinDatos") },
          { etiqueta: traducir("panelAdminFavoritos"), valor: stats.totalFavoritos },
        ].map((c) => (
          <div key={c.etiqueta} style={{ flex: "1 1 200px", background: tema.panel, borderRadius: 8, padding: 16, borderTop: `3px solid ${acentoMarca}` }}>
            <div style={{ fontSize: 22, fontWeight: "bold" }}>{c.valor}</div>
            <div style={{ fontSize: 12, color: tema.textoSuave, marginTop: 4 }}>{c.etiqueta}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 24 }}>
        <div style={{ flex: "1 1 320px", background: tema.panel, borderRadius: 8, padding: 16 }}>
          <h4 style={{ margin: "0 0 10px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><Icono tipo="estrella" size={14} /> Equipos más marcados como favoritos</h4>
          {stats.equiposFavoritosTop.length === 0 ? (
            <p style={{ fontSize: 12, color: tema.textoSuave }}>Todavía no hay suficientes datos.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(() => {
                const max = Math.max(...stats.equiposFavoritosTop.map((e) => e.veces));
                return stats.equiposFavoritosTop.map((e) => (
                  <div key={e.team_name}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
                      <span>{e.team_name}</span>
                      <strong>{e.veces}</strong>
                    </div>
                    <div style={{ background: tema.fondo, borderRadius: 4, height: 8, overflow: "hidden" }}>
                      <div style={{ width: `${(e.veces / max) * 100}%`, background: acentoMarca, height: "100%", borderRadius: 4 }} />
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>

        <div style={{ flex: "1 1 220px", background: tema.panel, borderRadius: 8, padding: 16 }}>
          <h4 style={{ margin: "0 0 10px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><Icono tipo="grafico" size={14} /> Aciertos vs fallos verificados</h4>
          {resueltas === 0 ? (
            <p style={{ fontSize: 12, color: tema.textoSuave }}>Todavía no hay pronósticos verificados.</p>
          ) : (
            <>
              <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", height: 18, marginBottom: 8 }}>
                <div style={{ width: `${(stats.aciertos / resueltas) * 100}%`, background: "#2e9e4f" }} />
                <div style={{ width: `${(stats.fallos / resueltas) * 100}%`, background: "#e05555" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: tema.textoSuave }}>
                <span><span style={{ color: "#2e9e4f", fontWeight: "bold" }}>●</span> Aciertos: {stats.aciertos}</span>
                <span><span style={{ color: "#e05555", fontWeight: "bold" }}>●</span> Fallos: {stats.fallos}</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ background: tema.panel, borderRadius: 8, padding: 16, marginBottom: 24, border: mantenimientoActivo ? "2px solid #e05555" : `1px solid ${tema.borde}` }}>
        <h4 style={{ margin: "0 0 10px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
          <Icono tipo="exclamacion" size={14} /> Errores reportados por la app {errores.length > 0 && `(${errores.length})`}
        </h4>

        {mantenimientoActivo && (
          <div style={{ background: "#e05555", color: "#fff", borderRadius: 6, padding: "8px 12px", fontSize: 12, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <span>Modo mantenimiento ACTIVO — los usuarios (que no sean admin) están viendo la pantalla de mantenimiento ahora mismo.</span>
            <button
              onClick={desactivarMantenimiento}
              style={{ fontSize: 11, background: "#fff", color: "#e05555", border: "none", borderRadius: 4, padding: "5px 10px", cursor: "pointer", fontWeight: "bold", whiteSpace: "nowrap" }}
            >
              Desactivar
            </button>
          </div>
        )}

        {errores.length === 0 ? (
          <p style={{ fontSize: 12, color: tema.textoSuave }}>No hay errores reportados. Buena señal.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {errores.map((e) => (
              <div key={e.id} style={{ background: tema.fondo, borderRadius: 6, padding: 10, fontSize: 12 }}>
                <div
                  onClick={() => setErroresAbiertos((prev) => ({ ...prev, [e.id]: !prev[e.id] }))}
                  style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", gap: 10 }}
                >
                  <span style={{ fontWeight: "bold" }}>{e.mensaje}</span>
                  <span style={{ color: tema.textoSuave, fontSize: 10, whiteSpace: "nowrap" }}>{new Date(e.creado_en).toLocaleString()}</span>
                </div>
                {e.ruta && <div style={{ color: tema.textoSuave, fontSize: 10, marginTop: 2 }}>Ruta: {e.ruta}</div>}

                {erroresAbiertos[e.id] && e.stack && (
                  <pre style={{ whiteSpace: "pre-wrap", fontSize: 10, color: tema.textoSuave, marginTop: 8, maxHeight: 200, overflowY: "auto" }}>
                    {e.stack}
                  </pre>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    onClick={corregirError}
                    disabled={mantenimientoActivo}
                    style={{
                      fontSize: 11, background: mantenimientoActivo ? tema.borde : "#e05555", color: "#fff", border: "none",
                      borderRadius: 4, padding: "5px 10px", cursor: mantenimientoActivo ? "default" : "pointer", fontWeight: "bold",
                    }}
                  >
                    {mantenimientoActivo ? "Mantenimiento activo" : "CORREGIR ERROR"}
                  </button>
                  <button
                    onClick={() => borrarError(e.id)}
                    style={{ fontSize: 11, background: "transparent", border: `1px solid ${tema.borde}`, color: tema.textoSuave, borderRadius: 4, padding: "5px 10px", cursor: "pointer" }}
                  >
                    Borrar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {esAdminPrincipal && (
        <div style={{ background: tema.panel, borderRadius: 8, padding: 16 }}>
          <h4 style={{ margin: "0 0 10px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><Icono tipo="llave" size={14} /> Gestión de administradores</h4>

          <form onSubmit={agregarAdmin} style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <input
              type="email"
              value={nuevoEmail}
              onChange={(e) => setNuevoEmail(e.target.value)}
              placeholder="Correo de la nueva persona admin"
              required
              style={{ flex: 1, padding: 10, fontSize: 13, background: tema.fondo, color: tema.texto, border: `1px solid ${tema.borde}`, borderRadius: 4 }}
            />
            <button type="submit" style={{ padding: "10px 16px", fontSize: 13, background: acentoMarca, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
              Agregar
            </button>
          </form>

          {mensajeAdmin && <p style={{ fontSize: 12, color: "#2e9e4f", marginBottom: 10 }}>{mensajeAdmin}</p>}
          {errorAdmin && <p style={{ fontSize: 12, color: "#e05555", marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}><Icono tipo="exclamacion" size={13} /> {errorAdmin}</p>}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {admins.map((a) => (
              <div key={a.user_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "8px 10px", background: tema.fondo, borderRadius: 6 }}>
                <span>{a.email} {a.es_principal && <strong style={{ color: acentoMarca }}>(Principal)</strong>}</span>
                {!a.es_principal && (
                  <button
                    onClick={() => quitarAdmin(a.user_id)}
                    style={{ fontSize: 11, background: "transparent", border: "1px solid #e05555", color: "#e05555", borderRadius: 4, padding: "4px 10px", cursor: "pointer" }}
                  >
                    Quitar
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


const AVATARES_PREDEFINIDOS = [
  { id: "escudo-jmcs", src: "/avatars/escudo-jmcs.png" },
  { id: "alas", src: "/avatars/alas.png" },
  { id: "porteria", src: "/avatars/porteria.png" },
];

function VistaPerfil({ sesion, perfil, onPerfilActualizado, tema, acentoMarca }) {
  const [username, setUsername] = useState(perfil?.username || "");
  const [avatarSeleccionado, setAvatarSeleccionado] = useState(perfil?.avatar_url || "");
  const [mercadosPreferidos, setMercadosPreferidos] = useState(perfil?.mercados_preferidos || []);
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  function alternarMercado(id) {
    setMercadosPreferidos((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  }

  async function subirFoto(e) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setError("");
    setSubiendo(true);
    try {
      const extension = archivo.name.split(".").pop();
      const ruta = `${sesion.user.id}/avatar-${Date.now()}.${extension}`;
      const { error: errorSubida } = await supabase.storage.from("avatars").upload(ruta, archivo, { upsert: true });
      if (errorSubida) throw errorSubida;
      const { data } = supabase.storage.from("avatars").getPublicUrl(ruta);
      setAvatarSeleccionado(data.publicUrl);
    } catch (err) {
      setError(err.message || "No se pudo subir la imagen");
    }
    setSubiendo(false);
  }

  async function guardar(e) {
    e.preventDefault();
    setMensaje("");
    setError("");
    setGuardando(true);
    const { data, error: errorGuardar } = await supabase
      .from("perfiles")
      .update({
        username: username.trim(), avatar_url: avatarSeleccionado || null,
        mercados_preferidos: mercadosPreferidos.length > 0 ? mercadosPreferidos : null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", sesion.user.id)
      .select()
      .maybeSingle();
    if (errorGuardar) {
      setError(errorGuardar.message.includes("duplicate") ? "Ese nombre de usuario ya está en uso." : errorGuardar.message);
    } else {
      setMensaje(traducir("perfilActualizado"));
      onPerfilActualizado(data);
    }
    setGuardando(false);
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 12px" }}>
      <h3 style={{ fontSize: 18, marginBottom: 18, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Icono tipo="persona" size={18} /> {traducir("editarPerfil")}</h3>

      <form onSubmit={guardar}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <img
            src={avatarSeleccionado || "/logo.png"}
            alt="Tu avatar"
            width={90}
            height={90}
            style={{ borderRadius: "50%", objectFit: "cover", border: `3px solid ${acentoMarca}`, marginBottom: 10 }}
          />
          <div>
            <label style={{ fontSize: 12, color: acentoMarca, cursor: "pointer" }}>
              {subiendo ? traducir("guardando") : <><Icono tipo="camara" size={13} /> {traducir("subirFoto")}</>}
              <input type="file" accept="image/*" onChange={subirFoto} disabled={subiendo} style={{ display: "none" }} />
            </label>
          </div>
        </div>

        <p style={{ fontSize: 12, color: tema.textoSuave, marginBottom: 8, textAlign: "center" }}>O elige un avatar:</p>
        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 20 }}>
          {AVATARES_PREDEFINIDOS.map((a) => (
            <img
              key={a.id}
              src={a.src}
              alt={a.id}
              width={56}
              height={56}
              onClick={() => setAvatarSeleccionado(a.src)}
              style={{
                borderRadius: "50%", objectFit: "cover", cursor: "pointer",
                border: avatarSeleccionado === a.src ? `3px solid ${acentoMarca}` : `1px solid ${tema.borde}`,
                padding: 2,
              }}
            />
          ))}
        </div>

        <label style={{ fontSize: 12, color: tema.textoSuave, display: "block", marginBottom: 6 }}>Nombre de usuario</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          maxLength={24}
          style={{ width: "100%", padding: 10, marginBottom: 20, fontSize: 14, background: tema.panel, color: tema.texto, border: `1px solid ${tema.borde}`, borderRadius: 4 }}
        />

        <label style={{ fontSize: 12, color: tema.textoSuave, display: "block", marginBottom: 6 }}>
          Mercados que me interesan (deja todos sin marcar para ver todos, como hoy)
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          {[
            { id: "goles", icono: "balon", etiqueta: traducir("goles") },
            { id: "btts", icono: "apreton", etiqueta: traducir("ambosAnotanChip") },
            { id: "ganador", icono: "trofeo", etiqueta: traducir("ganadorChip") },
            { id: "corners", icono: "banderin", etiqueta: traducir("cornersCorto") },
            { id: "amarillas", icono: "tarjeta", etiqueta: traducir("tarjetasAm") },
            { id: "faltas", icono: "exclamacion", etiqueta: traducir("faltasCorto") },
            { id: "dobleOportunidad", icono: "objetivo", etiqueta: "Doble oportunidad" },
            { id: "marcadorExacto", icono: "porteria", etiqueta: "Marcador exacto" },
            { id: "handicapAsiatico", icono: "balanza", etiqueta: "Hándicap asiático" },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => alternarMercado(m.id)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 14px", fontSize: 12, borderRadius: 16, cursor: "pointer",
                background: mercadosPreferidos.includes(m.id) ? acentoMarca : "transparent",
                color: mercadosPreferidos.includes(m.id) ? "#fff" : tema.texto,
                border: `1px solid ${mercadosPreferidos.includes(m.id) ? acentoMarca : tema.borde}`,
              }}
            >
              <Icono tipo={m.icono} size={13} />
              {m.etiqueta}
            </button>
          ))}
        </div>

        {mensaje && <p style={{ fontSize: 12, color: "#2e9e4f", marginBottom: 10 }}>{mensaje}</p>}
        {error && <p style={{ fontSize: 12, color: "#e05555", marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}><Icono tipo="exclamacion" size={13} /> {error}</p>}

        <button
          type="submit"
          disabled={guardando}
          style={{ width: "100%", padding: 12, fontSize: 14, fontWeight: "bold", background: acentoMarca, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}
        >
          {guardando ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>
    </div>
  );
}

function TutorialFlotante({ id, titulo, texto, tema, acentoMarca, tutorialesOcultos, onOcultarPermanente }) {
  const [visible, setVisible] = useState(true);

  if (!visible || (tutorialesOcultos || []).includes(id)) return null;

  return (
    <div style={{
      background: "rgba(20, 20, 20, 0.85)", color: "#fff", borderRadius: 8, padding: 14,
      marginBottom: 16, borderLeft: `4px solid ${acentoMarca}`, fontSize: 12, lineHeight: 1.5,
    }}>
      <strong style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, color: acentoMarca }}><Icono tipo="foco" size={14} /> {titulo}</strong>
      <p style={{ margin: "0 0 10px" }}>{texto}</p>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={() => setVisible(false)}
          style={{ fontSize: 11, background: "transparent", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", borderRadius: 4, padding: "5px 10px", cursor: "pointer" }}
        >
          Cerrar
        </button>
        <button
          onClick={() => { setVisible(false); onOcultarPermanente(id); }}
          style={{ fontSize: 11, background: acentoMarca, border: "none", color: "#fff", borderRadius: 4, padding: "5px 10px", cursor: "pointer", fontWeight: "bold" }}
        >
          Entendido, no volver a mostrar
        </button>
      </div>
    </div>
  );
}

function VistaHistorial({ sesion, tema, acentoMarca, onPedirLogin, mostrarToast }) {
  const [predicciones, setPredicciones] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!sesion) return;
    supabase
      .from("predicciones")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setPredicciones(data || []);
        setCargando(false);
      });
  }, [sesion]);

  async function marcarResultado(id, resultado) {
    const { error } = await supabase.from("predicciones").update({ resultado }).eq("id", id);
    if (error) {
      mostrarToast && mostrarToast("No se pudo guardar. Intenta de nuevo.");
      return;
    }
    setPredicciones((prev) => prev.map((p) => (p.id === id ? { ...p, resultado } : p)));
  }

  if (!sesion) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <p style={{ color: tema.textoSuave, marginBottom: 16 }}>Inicia sesión para ver tu historial de aciertos.</p>
        <button onClick={onPedirLogin} style={{ padding: "10px 20px", fontSize: 14, background: acentoMarca, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
          Iniciar sesión
        </button>
      </div>
    );
  }

  const resueltas = predicciones.filter((p) => p.resultado !== "pendiente");
  const aciertos = resueltas.filter((p) => p.resultado === "acierto").length;
  const porcentaje = resueltas.length > 0 ? Math.round((aciertos / resueltas.length) * 100) : null;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 12px" }}>
      <h3 style={{ fontSize: 18, marginBottom: 6, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Icono tipo="grafico" size={18} /> {traducir("historialAciertos")}</h3>
      {porcentaje !== null && (
        <p style={{ textAlign: "center", color: acentoMarca, fontWeight: "bold", marginBottom: 20 }}>
          {aciertos}/{resueltas.length} aciertos verificados — {porcentaje}%
        </p>
      )}

      {cargando ? (
        <p style={{ color: tema.textoSuave, textAlign: "center" }}>Cargando...</p>
      ) : predicciones.length === 0 ? (
        <p style={{ color: tema.textoSuave, fontSize: 13, textAlign: "center" }}>
          Aún no has guardado ningún pronóstico. Ve a "Estudio", arma un análisis, y toca "Guardar este pronóstico".
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {predicciones.map((p) => (
            <div key={p.id} style={{ background: tema.panel, borderRadius: 8, padding: 14, borderTop: `3px solid ${acentoMarca}` }}>
              <div style={{ fontWeight: "bold", marginBottom: 6 }}>{p.equipo_local} vs {p.equipo_visitante}</div>
              <div style={{ fontSize: 12, color: tema.textoSuave, marginBottom: 8, lineHeight: 1.6 }}>
                Ganador estimado: <strong>{p.pick_1x2 || "—"}</strong> · Goles esperados: <strong>{p.goles_esperados ?? "—"}</strong> · Over 2.5: <strong>{p.prob_over25 ?? "—"}%</strong> · BTTS: <strong>{p.prob_btts ?? "—"}%</strong>
                <br />
                Guardado: {new Date(p.created_at).toLocaleDateString("es-ES")}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: tema.textoSuave }}>Resultado real:</span>
                {["pendiente", "acierto", "fallo"].map((r) => (
                  <button
                    key={r}
                    onClick={() => marcarResultado(p.id, r)}
                    style={{
                      fontSize: 11, padding: "4px 10px", borderRadius: 12, cursor: "pointer",
                      border: `1px solid ${p.resultado === r ? acentoMarca : tema.borde}`,
                      background: p.resultado === r ? acentoMarca : "transparent",
                      color: p.resultado === r ? "#fff" : tema.texto,
                    }}
                  >
                    {r === "pendiente" ? "Pendiente" : r === "acierto" ? <><Icono tipo="check" size={12} color="#2e9e4f" /> Acertó</> : <><Icono tipo="cerrar" size={12} color="#e05555" /> Falló</>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VistaEquipoCompleto({ equipo, tema, sesion, onPedirLogin, onVolver, mostrarToast }) {
  const [fixtures, setFixtures] = useState([]);
  const [proximos, setProximos] = useState([]);
  const [errorProximos, setErrorProximos] = useState("");
  const [loading, setLoading] = useState(true);
  const colorMarca = useColorDeEscudo(equipo?.logo, DORADO);

  useEffect(() => {
    if (!equipo?.id) return;
    setLoading(true);
    setErrorProximos("");
    Promise.all([
      fetch(`/api/fixtures?teamId=${equipo.id}`).then((r) => r.json()),
      fetch(`/api/proximos-partidos?teamId=${equipo.id}`).then((r) => r.json()),
    ]).then(([fx, prox]) => {
      setFixtures(Array.isArray(fx) ? fx : []);
      if (Array.isArray(prox)) {
        setProximos(prox);
      } else {
        setProximos([]);
        setErrorProximos((prox && prox.error) || "Respuesta inesperada al pedir los próximos encuentros.");
      }
      setLoading(false);
    });
  }, [equipo?.id]);

  if (!equipo) return null;

  const categorias = dividirPorCategorias(fixtures, equipo.id);

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 12px" }}>
      <button
        onClick={onVolver}
        style={{ background: "transparent", border: "none", color: tema.textoSuave, cursor: "pointer", fontSize: 13, marginBottom: 14 }}
      >
        ← Volver
      </button>

      <div style={{ background: colorTenue(colorMarca), borderTop: `3px solid ${colorMarca}`, borderRadius: 8, padding: 20, marginBottom: 20, textAlign: "center" }}>
        <img src={corregirEscudo(equipo.logo)} alt={equipo.name} width={70} height={70} style={{ marginBottom: 10 }} onError={manejarErrorEscudo} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <h2 style={{ margin: 0, color: colorMarca }}><BanderaPais pais={equipo.country} size={22} /> {equipo.name}</h2>
          <BotonFavorito equipo={{ team: equipo }} sesion={sesion} tema={tema} onPedirLogin={onPedirLogin} mostrarToast={mostrarToast} />
        </div>
        {equipo.country && <p style={{ margin: "4px 0 0", color: tema.textoSuave, fontSize: 12 }}>{equipo.country}</p>}
      </div>

      {loading ? (
        <p style={{ color: tema.textoSuave, textAlign: "center" }}>Cargando estadísticas...</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 30 }}>
            <SubPanel titulo={traducir("comoLocal")} fixtures={categorias.local} teamId={equipo.id} statsMap={{}} tema={tema} acento={ACENTOS_CATEGORIA.local} />
            <SubPanel titulo={traducir("comoVisitante")} fixtures={categorias.visitante} teamId={equipo.id} statsMap={{}} tema={tema} acento={ACENTOS_CATEGORIA.visitante} />
            <SubPanel titulo={traducir("ligaActual")} fixtures={categorias.liga} teamId={equipo.id} statsMap={{}} tema={tema} acento={ACENTOS_CATEGORIA.liga} />
            <SubPanel titulo={traducir("noLiga")} fixtures={categorias.noLiga} teamId={equipo.id} statsMap={{}} tema={tema} acento={ACENTOS_CATEGORIA.noLiga} />
            <SubPanel titulo={traducir("formaReciente")} fixtures={categorias.forma} teamId={equipo.id} statsMap={{}} tema={tema} acento={ACENTOS_CATEGORIA.forma} />
          </div>

          <h3 style={{ fontSize: 15, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}><Icono tipo="calendario" size={16} /> Próximos encuentros</h3>
          {errorProximos && (
            <p style={{ color: "#e05555", fontSize: 12, marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}><Icono tipo="exclamacion" size={13} /> {errorProximos}</p>
          )}
          <TablaProximosEncuentros partidos={proximos} tema={tema} />
        </>
      )}
    </div>
  );
}

function VistaInicio({ tema, acentoMarca, sesion, onPedirLogin, statsMap, equipoInicio, fixturesInicio, colorMarcaInicio, onSeleccionarPartido, partidoTocado, onAbrirPerfil, refrescarKey, paisDetectado, onBuscarEquipoPorNombre, mostrarToast, modoOscuro }) {
  const [calendarioAbierto, setCalendarioAbierto] = useState(false);
  return (
    <div className="jmcs-inicio-grid">
      <div className="jmcs-inicio-principal">
      {paisDetectado && (
        <div style={{ marginBottom: 24, background: colorTenue(acentoMarca), borderTop: `3px solid ${acentoMarca}`, borderRadius: 8, padding: 18 }}>
          <button
            onClick={() => document.getElementById(`pais-${paisDetectado}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            style={{
              display: "flex", alignItems: "center", gap: 10, background: "transparent", border: "none",
              cursor: "pointer", padding: 0, marginBottom: 16,
            }}
            title={`Ver partidos de hoy de ${paisDetectado}`}
          >
            <BanderaPais pais={paisDetectado} size={40} />
            <span style={{ fontSize: 26, fontWeight: "bold", color: acentoMarca }}>{paisDetectado}</span>
          </button>

          <p style={{ fontSize: 11, color: tema.textoSuave, margin: "0 0 6px" }}>{traducir("seleccionNacionalLabel")}</p>
          <button
            onClick={() => onBuscarEquipoPorNombre(paisDetectado)}
            style={{ padding: "8px 14px", fontSize: 13, fontWeight: "bold", background: acentoMarca, color: "#fff", border: "none", borderRadius: 14, cursor: "pointer", marginBottom: 16 }}
          >
            <Icono tipo="trofeo" size={14} /> Selección {paisDetectado}
          </button>

          {EQUIPOS_FAMOSOS_POR_PAIS[paisDetectado] && (
            <>
              <p style={{ fontSize: 11, color: tema.textoSuave, margin: "0 0 8px" }}>{traducir("equiposFamosos")}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {EQUIPOS_FAMOSOS_POR_PAIS[paisDetectado].map((nombre) => (
                  <button
                    key={nombre}
                    onClick={() => onBuscarEquipoPorNombre(nombre)}
                    style={{ padding: "6px 12px", fontSize: 12, background: tema.panel, color: tema.texto, border: `1px solid ${tema.borde}`, borderRadius: 14, cursor: "pointer" }}
                  >
                    {nombre}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {equipoInicio?.team && (
        <div style={{ marginBottom: 24 }}>
          <div
            onClick={() => onAbrirPerfil(equipoInicio.team)}
            style={{ background: colorTenue(colorMarcaInicio), borderTop: `3px solid ${colorMarcaInicio}`, borderRadius: 8, padding: 16, cursor: "pointer" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <img src={corregirEscudo(equipoInicio.team.logo)} alt={equipoInicio.team.name} width={30} height={30} onError={manejarErrorEscudo} />
              <strong style={{ color: colorMarcaInicio, fontSize: 16 }}>{equipoInicio.team.name}</strong>
              <span onClick={(e) => e.stopPropagation()}>
                <BotonFavorito equipo={equipoInicio} sesion={sesion} tema={tema} onPedirLogin={onPedirLogin} mostrarToast={mostrarToast} />
              </span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: tema.textoSuave }}>Toca para ver todo →</span>
            </div>
            {(() => {
              const stats = calcularEstadisticasGoles(fixturesInicio, equipoInicio.team.id);
              if (!stats) return <p style={{ color: tema.textoSuave, fontSize: 12 }}>Sin datos.</p>;
              return (
                <div style={{ fontSize: 13 }}>
                  <FilaStat etiqueta={traducir("record")} valor={`${stats.victorias}-${stats.empates}-${stats.derrotas}`} />
                  <FilaStat etiqueta={traducir("golesFavor")} valor={stats.promedioGolesFavor} />
                  <FilaStat etiqueta={traducir("golesContra")} valor={stats.promedioGolesContra} />
                  <FilaStat etiqueta={traducir("over25")} valor={`${stats.over25Pct}%`} />
                  <FilaStat etiqueta={traducir("btts")} valor={`${stats.bttsPct}%`} />
                </div>
              );
            })()}
          </div>
        </div>
      )}

      <ListaPartidosInicio key={refrescarKey} tema={tema} acentoMarca={acentoMarca} onTocarPartido={onSeleccionarPartido} onAbrirPerfil={onAbrirPerfil} mostrarToast={mostrarToast} modoOscuro={modoOscuro} />
      </div>

      <div className="jmcs-inicio-calendario-col">
        <button
          className="jmcs-calendario-toggle-btn"
          onClick={() => setCalendarioAbierto((v) => !v)}
          style={{
            display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "12px 14px",
            background: tema.panel, color: acentoMarca, border: `1px solid ${tema.borde}`, borderRadius: 6,
            cursor: "pointer", fontSize: 13, fontWeight: "bold", textAlign: "left", marginBottom: 10,
          }}
        >
          <Icono tipo="calendario" size={15} /> {traducir("buscarPorFecha")}
          <span style={{ marginLeft: "auto", fontSize: 11, color: tema.textoSuave }}>{calendarioAbierto ? "▲ Ocultar" : "▼ Mostrar"}</span>
        </button>
        <div className="jmcs-calendario-body" style={{ display: calendarioAbierto ? "block" : "none" }}>
          <PanelCalendario tema={tema} onSeleccionarPartido={onSeleccionarPartido} acentoMarca={acentoMarca} onAbrirPerfil={onAbrirPerfil} mostrarToast={mostrarToast} />
        </div>
      </div>
    </div>
  );
}

function PantallaMantenimiento({ mensaje, onIniciarSesion }) {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      background: "#0f1f14", color: "#fff", padding: 24, textAlign: "center",
    }}>
      <img src="/logo.png" alt="JMCS" style={{ width: 90, height: 90, marginBottom: 20 }} />
      <h1 style={{ fontSize: 20, marginBottom: 10 }}>JMCS está en mantenimiento</h1>
      <p style={{ fontSize: 14, color: "#c8d6cc", maxWidth: 420, lineHeight: 1.5 }}>
        {mensaje || "Ya estamos trabajando en solucionarlo — volvemos enseguida."}
      </p>
      <button
        onClick={onIniciarSesion}
        style={{ marginTop: 24, fontSize: 12, background: "transparent", border: "1px solid #3a4f3f", color: "#8fae97", borderRadius: 6, padding: "8px 14px", cursor: "pointer" }}
      >
        Soy administrador, iniciar sesión
      </button>
    </div>
  );
}

function Home() {
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
  const menuRef = useRef(null);
  const masBtnRef = useRef(null);

  useEffect(() => {
    function manejarClicAfuera(e) {
      if (
        menuRef.current && !menuRef.current.contains(e.target) &&
        (!masBtnRef.current || !masBtnRef.current.contains(e.target))
      ) {
        setMenuAbierto(false);
      }
    }
    document.addEventListener("mousedown", manejarClicAfuera);
    document.addEventListener("touchstart", manejarClicAfuera);
    return () => {
      document.removeEventListener("mousedown", manejarClicAfuera);
      document.removeEventListener("touchstart", manejarClicAfuera);
    };
  }, []);

  const [idiomaAbierto, setIdiomaAbierto] = useState(false);
  const [idioma, setIdioma] = useState("es");
  IDIOMA_ACTUAL = idioma; // se actualiza en cada render, antes de que los hijos usen traducir()

  const [toasts, setToasts] = useState([]);
  function mostrarToast(mensaje) {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, mensaje, saliendo: false }]);
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, saliendo: true } : t)));
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 350);
    }, 2000);
  }
  const t = traducir;
  const [notaProximamente, setNotaProximamente] = useState(false);
  const [tarjetaActivaMovil, setTarjetaActivaMovil] = useState("local");
  const [toqueInicioX, setToqueInicioX] = useState(null);
  const [toqueInicioY, setToqueInicioY] = useState(null);
  const [chatAbierto, setChatAbierto] = useState(false);
  const [sesion, setSesion] = useState(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [authModalAbierto, setAuthModalAbierto] = useState(false);
  const [authModalModo, setAuthModalModo] = useState("login");
  const [esAdmin, setEsAdmin] = useState(false);
  const [esAdminPrincipal, setEsAdminPrincipal] = useState(false);
  const [cargandoChequeoAdmin, setCargandoChequeoAdmin] = useState(true);
  const [perfil, setPerfil] = useState(null);
  const [tutorialesOcultosLocal, setTutorialesOcultosLocal] = useState([]);

  async function ocultarTutorialPermanente(id) {
    if (!sesion) {
      setTutorialesOcultosLocal((prev) => [...new Set([...prev, id])]);
      return;
    }
    const actuales = perfil?.tutoriales_ocultos || [];
    if (actuales.includes(id)) return;
    const nuevos = [...actuales, id];
    const { data } = await supabase
      .from("perfiles")
      .update({ tutoriales_ocultos: nuevos })
      .eq("user_id", sesion.user.id)
      .select()
      .maybeSingle();
    if (data) setPerfil(data);
  }

  const tutorialesOcultos = sesion ? (perfil?.tutoriales_ocultos || []) : tutorialesOcultosLocal;
  const [vistaPerfilAbierta, setVistaPerfilAbierta] = useState(false);

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

  useEffect(() => {
    if (!sesion) { setPerfil(null); return; }
    supabase
      .from("perfiles")
      .select("*")
      .eq("user_id", sesion.user.id)
      .maybeSingle()
      .then(async ({ data }) => {
        if (data) {
          setPerfil(data);
        } else {
          // Cuentas creadas por Google/enlace mágico no pasan por el formulario de registro —
          // les creamos un perfil básico automáticamente para que todo funcione igual.
          const nombrePorDefecto = sesion.user.email.split("@")[0];
          const { data: nuevo } = await supabase
            .from("perfiles")
            .insert({ user_id: sesion.user.id, username: nombrePorDefecto })
            .select()
            .maybeSingle();
          setPerfil(nuevo || { user_id: sesion.user.id, username: nombrePorDefecto, avatar_url: null });
        }
      });
  }, [sesion]);

  useEffect(() => {
    if (!sesion) { setEsAdmin(false); setEsAdminPrincipal(false); setCargandoChequeoAdmin(false); return; }
    supabase
      .from("admins")
      .select("es_principal")
      .eq("user_id", sesion.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setEsAdmin(!!data);
        setEsAdminPrincipal(!!data?.es_principal);
        setCargandoChequeoAdmin(false);
      });
  }, [sesion]);

  // Modo mantenimiento: lo puede leer cualquiera, incluso sin sesión. Si está activo
  // y quien mira NO es admin, se le muestra la pantalla de mantenimiento en vez de la app.
  const [configApp, setConfigApp] = useState(null);
  useEffect(() => {
    supabase
      .from("configuracion_app")
      .select("mantenimiento, mensaje_mantenimiento")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => setConfigApp(data));
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
    } else if (itemMenu === "favoritos") {
      setMenuAbierto(false);
      setVistaActual("favoritos");
    } else if (itemMenu === "estudio") {
      setMenuAbierto(false);
      setVistaActual("estudio");
    } else if (itemMenu === "historial") {
      setMenuAbierto(false);
      setVistaActual("historial");
    } else if (itemMenu === "ajustes") {
      setMenuAbierto(false);
      setVistaActual("ajustes");
    } else {
      mostrarProximamente();
    }
  }

  const [favoritosPanelAbierto, setFavoritosPanelAbierto] = useState(false);
  const [contextoFavoritosIA, setContextoFavoritosIA] = useState("");
  const [vistaActual, setVistaActual] = useState("inicio"); // "inicio" | "estudio" | "favoritos" | "equipo"
  const [toqueSwipeX, setToqueSwipeX] = useState(null);
  const [toqueSwipeY, setToqueSwipeY] = useState(null);
  const [vistaAnterior, setVistaAnterior] = useState("inicio");
  const [equipoPerfil, setEquipoPerfil] = useState(null);

  function abrirPerfilEquipo(team) {
    setVistaAnterior(vistaActual);
    setEquipoPerfil(team);
    setVistaActual("equipo");
  }

  useEffect(() => {
    if (vistaActual !== "favoritos" || !sesion) return;
    let cancelado = false;

    supabase
      .from("favoritos")
      .select("*")
      .eq("user_id", sesion.user.id)
      .order("created_at", { ascending: false })
      .limit(8)
      .then(async ({ data }) => {
        if (!data || data.length === 0 || cancelado) return;
        const partes = await Promise.all(
          data.map(async (f) => {
            try {
              const res = await fetch(`/api/fixtures?teamId=${f.team_id}`);
              const fixtures = await res.json();
              const s = calcularEstadisticasGoles(Array.isArray(fixtures) ? fixtures : [], f.team_id);
              if (!s) return `${f.team_name}: sin datos suficientes.`;
              return `${f.team_name}: Récord ${s.victorias}V-${s.empates}E-${s.derrotas}D, prom. goles a favor ${s.promedioGolesFavor}, en contra ${s.promedioGolesContra}, % Over 2.5: ${s.over25Pct}%, % BTTS: ${s.bttsPct}%`;
            } catch {
              return `${f.team_name}: no se pudo cargar.`;
            }
          })
        );
        if (!cancelado) {
          setContextoFavoritosIA(`Equipos favoritos del usuario (últimos partidos de cada uno):\n${partes.join("\n")}`);
        }
      });

    return () => { cancelado = true; };
  }, [vistaActual, sesion]);

  const [busquedaInicio, setBusquedaInicio] = useState("");
  const [paisDetectadoInicio, setPaisDetectadoInicio] = useState(null);
  const [resultadosVivos, setResultadosVivos] = useState([]);
  const [paisVivo, setPaisVivo] = useState(null);
  const [buscandoVivo, setBuscandoVivo] = useState(false);
  const [dropdownAbierto, setDropdownAbierto] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function manejarClicAfueraDropdown(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownAbierto(false);
      }
    }
    document.addEventListener("mousedown", manejarClicAfueraDropdown);
    document.addEventListener("touchstart", manejarClicAfueraDropdown);
    return () => {
      document.removeEventListener("mousedown", manejarClicAfueraDropdown);
      document.removeEventListener("touchstart", manejarClicAfueraDropdown);
    };
  }, []);

  useEffect(() => {
    const texto = busquedaInicio.trim();
    if (texto.length < 3) {
      setResultadosVivos([]);
      setPaisVivo(null);
      setDropdownAbierto(false);
      return;
    }

    const textoNormalizado = texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const paisCoincide = PAISES_ES_A_EN[textoNormalizado];
    setPaisVivo(paisCoincide || null);

    const idTimeout = setTimeout(() => {
      setBuscandoVivo(true);
      fetch(`/api/teams?name=${encodeURIComponent(texto)}`)
        .then((r) => r.json())
        .then((data) => {
          setResultadosVivos(!data.error && Array.isArray(data) ? data.slice(0, 6) : []);
          setDropdownAbierto(true);
        })
        .catch(() => setResultadosVivos([]))
        .finally(() => setBuscandoVivo(false));
    }, 400);

    return () => clearTimeout(idTimeout);
  }, [busquedaInicio]);

  function elegirResultadoVivo(equipo) {
    setEquipoInicio(equipo);
    setPaisDetectadoInicio(null);
    setDropdownAbierto(false);
    fetch(`/api/fixtures?teamId=${equipo.team.id}`)
      .then((r) => r.json())
      .then((data) => { if (!data.error) setFixturesInicio(data); });
  }

  function elegirPaisVivo() {
    setPaisDetectadoInicio(paisVivo);
    setEquipoInicio(null);
    setFixturesInicio([]);
    setDropdownAbierto(false);
  }

  const [refrescarInicioKey, setRefrescarInicioKey] = useState(0);
  const [jalando, setJalando] = useState(false);
  const [jaladoSuficiente, setJaladoSuficiente] = useState(false);
  const [toqueJalarY, setToqueJalarY] = useState(null);
  const [equipoInicio, setEquipoInicio] = useState(null);
  const [fixturesInicio, setFixturesInicio] = useState([]);
  const [buscandoInicio, setBuscandoInicio] = useState(false);

  const [equipoForzadoLocal, setEquipoForzadoLocal] = useState(null);
  const [equipoForzadoVisitante, setEquipoForzadoVisitante] = useState(null);
  const [partidoCalendario, setPartidoCalendario] = useState(null);
  const [climaData, setClimaData] = useState(null);
  const [cargandoClima, setCargandoClima] = useState(false);
  // (estimarClima quedó reemplazado por el nuevo Estudio Climático Personalizado)

  function seleccionarPartidoDelCalendario(p) {
    setEquipoForzadoLocal({
      team: { id: p.teams.home.id, name: p.teams.home.name, logo: p.teams.home.logo, country: p.league.country },
    });
    setEquipoForzadoVisitante({
      team: { id: p.teams.away.id, name: p.teams.away.name, logo: p.teams.away.logo, country: p.league.country },
    });
    setPartidoCalendario(p);
  }

  // Si el partido que se está estudiando vino del calendario, sabemos exactamente en qué
  // competición y temporada se juega — el motor usa eso en vez de "cualquier partido de liga".
  // Si el usuario buscó los dos equipos a mano (sin pasar por el calendario), no hay forma de saber
  // la competición exacta del próximo cruce, así que el motor cae de vuelta al comportamiento genérico.
  const competicionActual = partidoCalendario?.league?.id
    ? { id: partidoCalendario.league.id, season: partidoCalendario.league.season, nombre: partidoCalendario.league.name }
    : null;

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
      .then((data) => {
        if (data.error) {
          setClimaData(null);
          mostrarToast(data.error);
        } else {
          setClimaData(data);
        }
      })
      .catch(() => { setClimaData(null); mostrarToast("No se pudo cargar el clima"); })
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

  async function buscarEquipoPorNombre(nombre) {
    setPaisDetectadoInicio(null);
    setBuscandoInicio(true);
    setEquipoInicio(null);
    setFixturesInicio([]);
    try {
      const res = await fetch(`/api/teams?name=${encodeURIComponent(nombre)}`);
      const data = await res.json();
      if (!data.error && data.length > 0) {
        const equipo = data[0];
        setEquipoInicio(equipo);
        const resFix = await fetch(`/api/fixtures?teamId=${equipo.team.id}`);
        const fixturesData = await resFix.json();
        if (!fixturesData.error) setFixturesInicio(fixturesData);
      } else {
        mostrarToast(`No encontramos "${nombre}". Prueba con otro nombre.`);
      }
    } catch (err) {
      mostrarToast("No se pudo buscar ese equipo. Intenta de nuevo.");
    }
    setBuscandoInicio(false);
  }

  async function buscarEquipoInicio(e) {
    e.preventDefault();
    const textoNormalizado = busquedaInicio.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const paisDetectado = PAISES_ES_A_EN[textoNormalizado];

    if (paisDetectado) {
      setPaisDetectadoInicio(paisDetectado);
      setEquipoInicio(null);
      setFixturesInicio([]);
      return;
    }
    setPaisDetectadoInicio(null);

    if (busquedaInicio.trim().length < 3) return;
    await buscarEquipoPorNombre(busquedaInicio);
  }

  // ===== Estudio Climático Personalizado =====
  const [estudioClimaticoAbierto, setEstudioClimaticoAbierto] = useState(false);
  const [ajustesClima, setAjustesClima] = useState(null);
  const [modoGlobalClima, setModoGlobalClima] = useState(false);
  const [deltasGlobalesClima, setDeltasGlobalesClima] = useState({ local: {}, visitante: {} });
  const [confirmarGlobalAbierto, setConfirmarGlobalAbierto] = useState(false);
  const [indicadorClimaAbierto, setIndicadorClimaAbierto] = useState(false);
  const [guardandoClima, setGuardandoClima] = useState(false);
  const [guardadoClima, setGuardadoClima] = useState(false);

  async function guardarEstudioClimatico() {
    if (!sesion) { abrirLogin(); return; }
    setGuardandoClima(true);
    const { error } = await supabase.from("predicciones").insert({
      user_id: sesion.user.id,
      equipo_local: equipoLocal?.team?.name || "",
      equipo_visitante: equipoVisitante?.team?.name || "",
      ajuste_climatico: {
        activo: climaAjuste.activo,
        equipos: ajustesClima,
        factorLocal: climaAjuste.factorLocal,
        factorVisitante: climaAjuste.factorVisitante,
      },
    });
    setGuardandoClima(false);
    if (error) {
      mostrarToast("No se pudo guardar tu Estudio Climático. Intenta de nuevo.");
    } else {
      setGuardadoClima(true);
      setTimeout(() => setGuardadoClima(false), 2500);
    }
  }

  const climaOficialNorm = normalizarClima(climaData);

  useEffect(() => {
    if (!climaOficialNorm) { setAjustesClima(null); return; }
    const nuevo = { local: {}, visitante: {} };
    ["local", "visitante"].forEach((rol) => {
      ["viento", "lluvia", "temperatura", "humedad"].forEach((v) => {
        const delta = modoGlobalClima ? deltasGlobalesClima?.[rol]?.[v] : undefined;
        if (delta !== undefined && delta !== null) {
          nuevo[rol][v] = { activo: true, valorUsuario: Math.max(0, Math.min(10, climaOficialNorm[v] + delta)) };
        } else {
          nuevo[rol][v] = { activo: false, valorUsuario: climaOficialNorm[v] };
        }
      });
    });
    setAjustesClima(nuevo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [climaData, equipoLocal?.team?.id, equipoVisitante?.team?.id]);

  function actualizarAjusteClima(rol, variable, cambios) {
    setAjustesClima((prev) => {
      if (!prev) return prev;
      return { ...prev, [rol]: { ...prev[rol], [variable]: { ...prev[rol][variable], ...cambios } } };
    });
  }

  function activarModoGlobal() {
    // Convertimos los ajustes activos actuales en "diferencias" respecto al oficial de este partido
    const nuevosDeltas = { local: {}, visitante: {} };
    ["local", "visitante"].forEach((rol) => {
      ["viento", "lluvia", "temperatura", "humedad"].forEach((v) => {
        const a = ajustesClima?.[rol]?.[v];
        if (a?.activo && climaOficialNorm) {
          nuevosDeltas[rol][v] = a.valorUsuario - climaOficialNorm[v];
        }
      });
    });
    setDeltasGlobalesClima(nuevosDeltas);
    setModoGlobalClima(true);
    setConfirmarGlobalAbierto(false);
  }

  // Sensibilidad de cada mercado a cada variable climática — es nuestra propia estimación,
  // igual que el resto de esta fórmula del Estudio Climático, no un dato validado científicamente.
  // 1.0 = misma sensibilidad que goles (el mercado que ya usábamos como base). Negativo = se mueve
  // en sentido contrario a como se mueven los goles con esa variable.
  const SENSIBILIDAD_CLIMA = {
    goles: { viento: 1.0, lluvia: 1.0, temperatura: 1.0, humedad: 1.0 },
    corners: { viento: -0.8, lluvia: -0.6, temperatura: 0.3, humedad: 0.2 },
    amarillas: { viento: 0.2, lluvia: 0.9, temperatura: 0.4, humedad: 0.3 },
    faltas: { viento: 0.2, lluvia: 0.9, temperatura: 0.4, humedad: 0.3 },
  };

  function calcularFactorEquipoClima(rol, mercado = "goles") {
    if (!ajustesClima || !climaOficialNorm) return 1;
    let sumaDeltas = 0;
    const sensibilidad = SENSIBILIDAD_CLIMA[mercado] || SENSIBILIDAD_CLIMA.goles;
    ["viento", "lluvia", "temperatura", "humedad"].forEach((v) => {
      const a = ajustesClima[rol]?.[v];
      if (a?.activo) sumaDeltas += (a.valorUsuario - climaOficialNorm[v]) * sensibilidad[v];
    });
    return Math.max(0.7, Math.min(1.3, 1 + sumaDeltas * 0.015));
  }

  const hayAjusteClimaActivo =
    ajustesClima &&
    (["local", "visitante"].some((rol) => ["viento", "lluvia", "temperatura", "humedad"].some((v) => ajustesClima[rol]?.[v]?.activo)));

  const climaAjuste = hayAjusteClimaActivo
    ? {
        activo: true,
        factorLocal: calcularFactorEquipoClima("local"),
        factorVisitante: calcularFactorEquipoClima("visitante"),
        factorLocalPorMercado: {
          goles: calcularFactorEquipoClima("local", "goles"),
          corners: calcularFactorEquipoClima("local", "corners"),
          amarillas: calcularFactorEquipoClima("local", "amarillas"),
          faltas: calcularFactorEquipoClima("local", "faltas"),
        },
        factorVisitantePorMercado: {
          goles: calcularFactorEquipoClima("visitante", "goles"),
          corners: calcularFactorEquipoClima("visitante", "corners"),
          amarillas: calcularFactorEquipoClima("visitante", "amarillas"),
          faltas: calcularFactorEquipoClima("visitante", "faltas"),
        },
      }
    : {
        activo: false, factorLocal: 1, factorVisitante: 1,
        factorLocalPorMercado: { goles: 1, corners: 1, amarillas: 1, faltas: 1 },
        factorVisitantePorMercado: { goles: 1, corners: 1, amarillas: 1, faltas: 1 },
      };

  const acentoMarca = modoOscuro ? DORADO : "#1F7A46";

  // Mismo cálculo exacto que usa el semáforo real, para que la ventana del
  // Estudio Climático muestre números consistentes con lo que ves en Estudio.
  let lambdaGolesLocalReal = null;
  let lambdaGolesVisitanteReal = null;
  if (equipoLocal?.team && equipoVisitante?.team) {
    const fuentesEqLocal = construirFuentesEquipo(fixturesLocal, equipoLocal.team.id, statsMap, competicionActual);
    const fuentesEqVisitante = construirFuentesEquipo(fixturesVisitante, equipoVisitante.team.id, statsMap, competicionActual);
    const partidosH2H = h2h?.partidos || [];
    const h2hGolesLocal = calcularGolesNumerico(partidosH2H, equipoLocal.team.id);
    const h2hGolesVisitante = calcularGolesNumerico(partidosH2H, equipoVisitante.team.id);
    const motorGolesLocal = {
      actual: fuentesEqLocal.local.goles, contraria: fuentesEqLocal.visitante.goles,
      liga: fuentesEqLocal.liga.goles, noLiga: fuentesEqLocal.noLiga.goles,
      temporada: fuentesEqLocal.temporada.goles, forma: fuentesEqLocal.forma.goles, h2h: h2hGolesLocal,
    };
    const motorGolesVisitante = {
      actual: fuentesEqVisitante.visitante.goles, contraria: fuentesEqVisitante.local.goles,
      liga: fuentesEqVisitante.liga.goles, noLiga: fuentesEqVisitante.noLiga.goles,
      temporada: fuentesEqVisitante.temporada.goles, forma: fuentesEqVisitante.forma.goles, h2h: h2hGolesVisitante,
    };
    lambdaGolesLocalReal = calcularValorEsperado(motorGolesLocal, esPartidoLiga);
    lambdaGolesVisitanteReal = calcularValorEsperado(motorGolesVisitante, esPartidoLiga);
  }

  // Mientras todavía no sabemos si el usuario es admin (o no), no mostramos nada
  // de mantenimiento todavía, para no hacerle un flash de esa pantalla a un admin
  // que sí tiene acceso — apenas termina de revisar, ahí sí se decide.
  if (configApp?.mantenimiento && !cargandoChequeoAdmin && !esAdmin) {
    return (
      <>
        <PantallaMantenimiento mensaje={configApp.mensaje_mantenimiento} onIniciarSesion={abrirLogin} />
        {authModalAbierto && (
          <AuthModal
            tema={tema}
            acentoMarca={acentoMarca}
            modoInicial={authModalModo}
            onCerrar={() => setAuthModalAbierto(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2e6b3e" />
        {/* Para que funcione como app instalada en iPhone (Safari 16.4+) */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="JMCS" />
        <link rel="apple-touch-icon" href="/logo.png" />
      </Head>
      <div
      style={{ background: tema.fondo, color: tema.texto, minHeight: "100vh" }}
      onTouchStart={(e) => {
        setToqueSwipeX(e.touches[0].clientX);
        setToqueSwipeY(e.touches[0].clientY);
      }}
      onTouchEnd={(e) => {
        if (toqueSwipeX === null) return;
        const deltaX = e.changedTouches[0].clientX - toqueSwipeX;
        const deltaY = toqueSwipeY === null ? 0 : e.changedTouches[0].clientY - toqueSwipeY;
        const ORDEN_PESTANAS = ["inicio", "estudio", "favoritos"];
        const indiceActual = ORDEN_PESTANAS.indexOf(vistaActual);
        const hayModalAbierto = estudioClimaticoAbierto || authModalAbierto || favoritosPanelAbierto || chatAbierto;
        // Solo cuenta como cambio de pestaña si el movimiento horizontal es claramente mayor
        // al vertical (un swipe de verdad), no un scroll hacia abajo con el dedo levemente
        // de costado — eso antes cambiaba de pestaña por error.
        const esSwipeHorizontal = Math.abs(deltaX) > 90 && Math.abs(deltaX) > Math.abs(deltaY) * 2;
        if (!hayModalAbierto && indiceActual !== -1 && esSwipeHorizontal) {
          if (deltaX < 0 && indiceActual < ORDEN_PESTANAS.length - 1) setVistaActual(ORDEN_PESTANAS[indiceActual + 1]);
          else if (deltaX > 0 && indiceActual > 0) setVistaActual(ORDEN_PESTANAS[indiceActual - 1]);
        }
        setToqueSwipeX(null);
        setToqueSwipeY(null);
      }}
    >
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

        * { box-sizing: border-box; }

        html, body {
          margin: 0;
          padding: 0;
          background: ${tema.fondo};
          font-family: 'IBM Plex Sans', Arial, sans-serif;
          overscroll-behavior-y: contain;
        }

        @media (max-width: 767px) {
          body { padding-bottom: 64px; }
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

        @keyframes jmcsToastEntrar {
          from { transform: translateX(-120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }

        @keyframes jmcsToastSalir {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(-120%); opacity: 0; }
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

        @media (max-width: 767px) {
          .jmcs-chat-burbuja {
            width: 56px;
            bottom: 76px;
            right: 14px;
          }
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

        .jmcs-marcador-sticky {
          position: fixed;
          top: 62px;
          left: 50%;
          transform: translateX(-50%);
          width: min(94vw, 640px);
          z-index: 40;
        }

        .jmcs-solo-pc { display: none; }
        @media (min-width: 1024px) {
          .jmcs-solo-pc { display: block; }
        }

        .jmcs-nav-pc { display: none; }
        @media (min-width: 768px) {
          .jmcs-nav-pc { display: flex; }
        }

        .jmcs-nav-movil {
          display: flex;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          justify-content: space-around;
          align-items: center;
          background: ${tema.panel};
          border-top: 1px solid ${tema.borde};
          padding: 6px 0;
          padding-bottom: calc(6px + env(safe-area-inset-bottom));
          z-index: 100;
        }
        @media (min-width: 768px) {
          .jmcs-nav-movil { display: none; }
        }

        .jmcs-nav-movil-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          background: transparent;
          border: none;
          font-size: 9px;
          cursor: pointer;
          padding: 4px 6px;
        }

        @media (max-width: 767px) {
          .jmcs-menu-desplegable {
            position: fixed !important;
            top: auto !important;
            bottom: 70px !important;
            left: 12px !important;
            right: 12px !important;
            width: auto !important;
          }
        }

        .jmcs-inicio-grid {
          display: block;
        }
        .jmcs-inicio-calendario-col {
          margin-bottom: 24px;
        }

        @media (min-width: 1024px) {
          .jmcs-inicio-grid {
            display: grid;
            grid-template-columns: 1fr 340px;
            gap: 24px;
            align-items: start;
          }
          .jmcs-inicio-calendario-col {
            position: sticky;
            top: 90px;
            margin-bottom: 0;
          }
          /* En PC el calendario ya va desplegado a la derecha, sin necesidad de tocar el botón */
          .jmcs-calendario-toggle-btn {
            display: none !important;
          }
          .jmcs-calendario-body {
            display: block !important;
          }
        }

        .jmcs-partidos-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }

        @media (min-width: 600px) {
          .jmcs-partidos-grid {
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
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

        @media (max-width: 767px) {
          .jmcs-chat-panel {
            bottom: 138px;
            right: 12px;
          }
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
          <div ref={menuRef} style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
            <button
              onClick={() => { setMenuAbierto(!menuAbierto); setIdiomaAbierto(false); }}
              aria-label="Menú"
              className="jmcs-nav-pc"
              style={{
                fontSize: 20, background: "transparent", border: `1px solid ${tema.borde}`,
                borderRadius: 6, padding: "6px 10px", cursor: "pointer", color: tema.texto,
              }}
            >
              <Icono tipo="menu" size={18} />
            </button>

            {sesion ? (
              <>
                <div
                  onClick={() => setVistaActual("perfil")}
                  style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
                  title="Editar perfil"
                >
                  <img
                    src={perfil?.avatar_url || "/logo.png"}
                    alt=""
                    width={26}
                    height={26}
                    style={{ borderRadius: "50%", objectFit: "cover", border: `1px solid ${tema.borde}` }}
                  />
                  <span style={{ fontSize: 12, color: tema.textoSuave, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {perfil?.username || sesion.user.email}
                  </span>
                </div>
                <button
                  onClick={cerrarSesion}
                  style={{
                    padding: "8px 12px", fontSize: 12, background: "transparent",
                    color: tema.texto, border: `1px solid ${tema.borde}`, borderRadius: 6, cursor: "pointer",
                  }}
                >
                  {t("cerrarSesion")}
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
                  {t("registrarse")}
                </button>
                <button
                  onClick={abrirLogin}
                  style={{
                    padding: "8px 12px", fontSize: 12, background: acentoMarca,
                    color: modoOscuro ? "#1B1200" : "#fff", border: "none", borderRadius: 6, cursor: "pointer",
                  }}
                >
                  {t("iniciarSesion")}
                </button>
              </>
            )}

            {menuAbierto && (
              <div
                className="jmcs-menu-desplegable"
                style={{
                  position: "absolute", top: "115%", left: 0, background: tema.panel,
                  border: `1px solid ${tema.borde}`, borderRadius: 6, minWidth: 200, zIndex: 120,
                  boxShadow: "0 6px 16px rgba(0,0,0,0.25)", overflow: "hidden",
                }}
              >
                {[
                  { clave: "inicio", etiqueta: t("menuInicio") },
                  { clave: "perfil", etiqueta: "Editar perfil" },
                  { clave: "misEstudios", etiqueta: t("menuMisEstudios") },
                  { clave: "favoritos", etiqueta: t("menuFavoritos") },
                  { clave: "historial", etiqueta: t("menuHistorial") },
                  { clave: "ajustes", etiqueta: t("menuAjustes") },
                  ...(esAdmin ? [{ clave: "admin", etiqueta: "Panel de administrador" }] : []),
                ].map((item) => (
                  <div
                    key={item.clave}
                    onClick={
                      item.clave === "inicio"
                        ? () => { setMenuAbierto(false); setVistaActual("inicio"); }
                        : item.clave === "admin"
                        ? () => { setMenuAbierto(false); setVistaActual("admin"); }
                        : item.clave === "perfil"
                        ? () => (sesion ? (() => { setMenuAbierto(false); setVistaActual("perfil"); })() : abrirLogin())
                        : () => accederOPedirCuenta(item.clave)
                    }
                    style={{ padding: "10px 14px", fontSize: 13, cursor: "pointer", borderBottom: `1px solid ${tema.borde}` }}
                  >
                    {item.etiqueta}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Zona centro: logo + título — clic lleva a Inicio */}
          <div
            onClick={() => setVistaActual("inicio")}
            style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
            title="Ir a Inicio"
          >
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
              <BanderaPais pais={idioma === "es" ? "Spain" : "United-States"} size={20} />
            </button>

            {idiomaAbierto && (
              <div
                style={{
                  position: "absolute", top: "115%", right: 0, background: tema.panel,
                  border: `1px solid ${tema.borde}`, borderRadius: 6, zIndex: 20,
                  boxShadow: "0 6px 16px rgba(0,0,0,0.25)", overflow: "hidden",
                }}
              >
                <div onClick={() => { setIdioma("es"); setIdiomaAbierto(false); }} style={{ padding: "8px 14px", cursor: "pointer" }}><BanderaPais pais="Spain" size={20} /></div>
                <div onClick={() => { setIdioma("en"); setIdiomaAbierto(false); }} style={{ padding: "8px 14px", cursor: "pointer" }}><BanderaPais pais="United-States" size={20} /></div>
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
              <Icono tipo={modoOscuro ? "sol" : "luna"} size={16} />
            </button>
          </div>
        </div>

        {notaProximamente && (
          <p style={{ textAlign: "center", color: acentoMarca, fontSize: 12, margin: "4px 0 0" }}>
            <Icono tipo="candado" size={13} /> Esta función estará disponible pronto.
          </p>
        )}

        {vistaActual === "estudio" && (
          <p style={{ textAlign: "center", color: acentoMarca, fontSize: 12, margin: "10px 0 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {mensajeEstudio}
          </p>
        )}

        <div className="jmcs-nav-pc" style={{ gap: 8, justifyContent: "center", marginTop: 14 }}>
          {[
            { id: "inicio", icono: "hogar", etiqueta: t("inicio") },
            { id: "estudio", icono: "barras", etiqueta: t("estudio") },
            { id: "favoritos", icono: "estrella", etiqueta: t("favoritos") },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                if ((tab.id === "estudio" || tab.id === "favoritos") && !sesion) abrirLogin();
                else setVistaActual(tab.id);
              }}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 18px", fontSize: 13, borderRadius: 20, cursor: "pointer",
                background: vistaActual === tab.id ? acentoMarca : "transparent",
                color: vistaActual === tab.id ? "#fff" : tema.texto,
                border: `1px solid ${vistaActual === tab.id ? acentoMarca : tema.borde}`,
                fontWeight: vistaActual === tab.id ? "bold" : "normal",
              }}
            >
              <Icono tipo={tab.icono} size={14} />
              {tab.etiqueta}
            </button>
          ))}
        </div>

        <MigasDePan
          vistaActual={vistaActual}
          vistaAnterior={vistaAnterior}
          equipoPerfil={equipoPerfil}
          tema={tema}
          acentoMarca={acentoMarca}
          onIrA={(id) => setVistaActual(id)}
        />
      </div>

      {vistaActual === "inicio" && (
        <div
          style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box", margin: "20px auto", padding: "0 24px" }}
          onTouchStart={(e) => {
            if (window.scrollY === 0) setToqueJalarY(e.touches[0].clientY);
          }}
          onTouchMove={(e) => {
            if (toqueJalarY === null) return;
            const delta = e.touches[0].clientY - toqueJalarY;
            if (delta > 10) {
              e.preventDefault();
              setJalando(true);
              setJaladoSuficiente(delta > 80);
            }
          }}
          onTouchEnd={() => {
            if (jaladoSuficiente) setRefrescarInicioKey((k) => k + 1);
            setJalando(false);
            setJaladoSuficiente(false);
            setToqueJalarY(null);
          }}
        >
          <TutorialFlotante
            id="inicio"
            titulo={traducir("tutInicioTitulo")}
            texto={traducir("tutInicioTexto")}
            tema={tema}
            acentoMarca={acentoMarca}
            tutorialesOcultos={tutorialesOcultos}
            onOcultarPermanente={ocultarTutorialPermanente}
          />

          {jalando && (
            <p style={{ textAlign: "center", fontSize: 12, color: acentoMarca, marginBottom: 8 }}>
              {jaladoSuficiente ? <><Icono tipo="refrescar" size={13} /> Suelta para actualizar</> : "↓ Jala para actualizar"}
            </p>
          )}
          <div ref={dropdownRef} className="jmcs-datos-sticky" style={{ position: "relative", maxWidth: 800, background: tema.fondo, paddingTop: 4, paddingBottom: 4 }}>
            <form
              onSubmit={buscarEquipoInicio}
              style={{ display: "flex", gap: 8, marginBottom: dropdownAbierto ? 0 : 20 }}
            >
              <input
                type="text"
                value={busquedaInicio}
                onChange={(e) => setBusquedaInicio(e.target.value)}
                onFocus={() => { if (resultadosVivos.length > 0 || paisVivo) setDropdownAbierto(true); }}
                placeholder={t("buscarEquipoPlaceholder")}
                autoComplete="off"
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

            {dropdownAbierto && (paisVivo || resultadosVivos.length > 0 || buscandoVivo) && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 90, marginTop: 4, background: tema.panel,
                border: `1px solid ${tema.borde}`, borderRadius: 6, zIndex: 50, boxShadow: "0 6px 16px rgba(0,0,0,0.25)",
                maxHeight: 320, overflowY: "auto",
              }}>
                {buscandoVivo && <p style={{ padding: 12, fontSize: 12, color: tema.textoSuave, margin: 0 }}>Buscando...</p>}

                {paisVivo && (
                  <div
                    onClick={elegirPaisVivo}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", cursor: "pointer", borderBottom: `1px solid ${tema.borde}`, background: colorTenue(acentoMarca) }}
                  >
                    <BanderaPais pais={paisVivo} size={22} />
                    <strong style={{ fontSize: 13 }}>{paisVivo}</strong>
                    <span style={{ fontSize: 11, color: tema.textoSuave, marginLeft: "auto" }}>País →</span>
                  </div>
                )}

                {resultadosVivos.map((equipo) => (
                  <div
                    key={equipo.team.id}
                    onClick={() => elegirResultadoVivo(equipo)}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", cursor: "pointer", borderBottom: `1px solid ${tema.borde}` }}
                  >
                    <img src={corregirEscudo(equipo.team.logo)} alt="" width={22} height={22} onError={manejarErrorEscudo} />
                    <span style={{ fontSize: 13 }}>{equipo.team.name}</span>
                    {equipo.team.country && <span style={{ fontSize: 11, color: tema.textoSuave, marginLeft: "auto" }}>{equipo.team.country}</span>}
                  </div>
                ))}

                {!buscandoVivo && !paisVivo && resultadosVivos.length === 0 && (
                  <p style={{ padding: 12, fontSize: 12, color: tema.textoSuave, margin: 0 }}>Sin resultados.</p>
                )}
              </div>
            )}
          </div>

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
            onAbrirPerfil={abrirPerfilEquipo}
            refrescarKey={refrescarInicioKey}
            paisDetectado={paisDetectadoInicio}
            onBuscarEquipoPorNombre={buscarEquipoPorNombre}
            mostrarToast={mostrarToast}
            modoOscuro={modoOscuro}
          />
        </div>
      )}

      {vistaActual === "favoritos" && (
        <div style={{ maxWidth: 900, margin: "20px auto", padding: "0 12px" }}>
          <TutorialFlotante
            id="favoritos"
            titulo={traducir("tutFavoritosTitulo")}
            texto={traducir("tutFavoritosTexto")}
            tema={tema}
            acentoMarca={acentoMarca}
            tutorialesOcultos={tutorialesOcultos}
            onOcultarPermanente={ocultarTutorialPermanente}
          />
          {sesion ? (
            <PanelFavoritosPagina sesion={sesion} tema={tema} acentoMarca={acentoMarca} onAbrirPerfil={abrirPerfilEquipo} mostrarToast={mostrarToast} />
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

      {vistaActual === "equipo" && (
        <div style={{ margin: "20px auto" }}>
          <VistaEquipoCompleto
            equipo={equipoPerfil}
            tema={tema}
            sesion={sesion}
            onPedirLogin={abrirLogin}
            onVolver={() => setVistaActual(vistaAnterior)}
            mostrarToast={mostrarToast}
          />
        </div>
      )}

      {vistaActual === "historial" && (
        <div style={{ margin: "20px auto" }}>
          <VistaHistorial sesion={sesion} tema={tema} acentoMarca={acentoMarca} onPedirLogin={abrirLogin} mostrarToast={mostrarToast} />
        </div>
      )}

      {vistaActual === "perfil" && sesion && (
        <div style={{ margin: "20px auto" }}>
          <VistaPerfil sesion={sesion} perfil={perfil} onPerfilActualizado={setPerfil} tema={tema} acentoMarca={acentoMarca} />
        </div>
      )}

      {vistaActual === "ajustes" && sesion && (
        <div style={{ margin: "20px auto" }}>
          <PantallaAjustes sesion={sesion} perfil={perfil} onPerfilActualizado={setPerfil} tema={tema} acentoMarca={acentoMarca} mostrarToast={mostrarToast} />
        </div>
      )}

      {vistaActual === "admin" && esAdmin && (
        <div style={{ margin: "20px auto" }}>
          <VistaAdmin sesion={sesion} esAdminPrincipal={esAdminPrincipal} tema={tema} acentoMarca={acentoMarca} mostrarToast={mostrarToast} />
        </div>
      )}

      {vistaActual === "estudio" && (
      <div className="jmcs-grid" style={{ maxWidth: 2400, margin: "0 auto" }}>
        <div className="jmcs-calendario">
          <PanelCalendario tema={tema} onSeleccionarPartido={seleccionarPartidoDelCalendario} acentoMarca={acentoMarca} onAbrirPerfil={abrirPerfilEquipo} mostrarToast={mostrarToast} />
        </div>

        <div className="jmcs-ala-local">
          <PanelEquipoLateral equipo={equipoLocal} stats={statsGoLocal} posesion={posesionLocal} fixtures={fixturesLocal} acento={colorMarcaLocal} tema={tema} sesion={sesion} onPedirLogin={abrirLogin} onAbrirPerfil={abrirPerfilEquipo} mostrarToast={mostrarToast} />
        </div>

        <div className="jmcs-centro">
          <TutorialFlotante
            id="estudio"
            titulo={traducir("tutEstudioTitulo")}
            texto={traducir("tutEstudioTexto")}
            tema={tema}
            acentoMarca={acentoMarca}
            tutorialesOcultos={tutorialesOcultos}
            onOcultarPermanente={ocultarTutorialPermanente}
          />
          <div>
            {equipoLocal?.team && equipoVisitante?.team && (
              <>
                <EstadisticasPartidoReal
                  fixtureId={partidoCalendario?.fixture?.id}
                  nombreLocal={equipoLocal.team.name}
                  nombreVisitante={equipoVisitante.team.name}
                  tema={tema}
                  acentoMarca={acentoMarca}
                />
                <AlineacionesPartido
                  fixtureId={partidoCalendario?.fixture?.id}
                  colorMarcaLocal={colorMarcaLocal}
                  colorMarcaVisitante={colorMarcaVisitante}
                  tema={tema}
                  acentoMarca={acentoMarca}
                />
                <MarcadorEnVivo
                  fixtureId={partidoCalendario?.fixture?.id}
                  equipoLocal={equipoLocal}
                  equipoVisitante={equipoVisitante}
                  tema={tema}
                  acentoMarca={acentoMarca}
                  sesion={sesion}
                  onPedirLogin={abrirLogin}
                  mostrarToast={mostrarToast}
                />
              </>
            )}

            {modoGlobalClima && (
              <div style={{ position: "relative", display: "inline-block", marginBottom: 10 }}>
                <button
                  onClick={() => setIndicadorClimaAbierto(!indicadorClimaAbierto)}
                  title="Estudio personalizado activo"
                  style={{
                    width: 26, height: 26, borderRadius: "50%", background: "#e05555", color: "#fff",
                    border: "none", fontWeight: "bold", fontSize: 14, cursor: "pointer",
                  }}
                >
                  <Icono tipo="exclamacion" size={13} color="#fff" />
                </button>
                {indicadorClimaAbierto && (
                  <div style={{
                    position: "absolute", top: "115%", left: 0, background: "rgba(224,85,85,0.9)", color: "#fff",
                    padding: "8px 12px", borderRadius: 6, fontSize: 12, whiteSpace: "nowrap", zIndex: 30,
                  }}>
                    Estudio personalizado activo
                  </div>
                )}
              </div>
            )}

            <DatosGeneralesEncuentro
              partidoCalendario={partidoCalendario}
              climaData={climaData}
              cargandoClima={cargandoClima}
              tema={tema}
              acentoMarca={acentoMarca}
              onAbrirEstudioClimatico={() => (sesion ? setEstudioClimaticoAbierto(true) : abrirRegistro())}
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
            onTouchStart={(e) => {
              setToqueInicioX(e.touches[0].clientX);
              setToqueInicioY(e.touches[0].clientY);
            }}
            onTouchEnd={(e) => {
              if (toqueInicioX === null) return;
              const deltaX = e.changedTouches[0].clientX - toqueInicioX;
              const deltaY = toqueInicioY === null ? 0 : e.changedTouches[0].clientY - toqueInicioY;
              const UMBRAL = 60;
              const esSwipeHorizontal = Math.abs(deltaX) > UMBRAL && Math.abs(deltaX) > Math.abs(deltaY) * 2;
              if (esSwipeHorizontal && deltaX < 0 && tarjetaActivaMovil === "local") {
                setTarjetaActivaMovil("visitante");
              } else if (esSwipeHorizontal && deltaX > 0 && tarjetaActivaMovil === "visitante") {
                setTarjetaActivaMovil("local");
              }
              setToqueInicioX(null);
              setToqueInicioY(null);
            }}
          >
            <div className="jmcs-carrusel-item" data-activo={tarjetaActivaMovil === "local" ? "true" : "false"} style={{ flex: 1, minWidth: 320 }}>
              <BuscadorEquipo
                etiqueta={t("local")}
                tema={tema}
                statsMap={statsMap}
                equipoForzado={equipoForzadoLocal}
                colorMarca={colorMarcaLocal}
                sesion={sesion}
                onPedirLogin={abrirLogin}
                onAbrirPerfil={abrirPerfilEquipo}
                mostrarToast={mostrarToast}
                competicionActual={competicionActual}
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
                etiqueta={t("visitante")}
                tema={tema}
                statsMap={statsMap}
                equipoForzado={equipoForzadoVisitante}
                colorMarca={colorMarcaVisitante}
                sesion={sesion}
                onPedirLogin={abrirLogin}
                onAbrirPerfil={abrirPerfilEquipo}
                mostrarToast={mostrarToast}
                competicionActual={competicionActual}
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
            <Icono tipo="flecha" size={12} /> Desliza para ver {tarjetaActivaMovil === "local" ? "el Visitante" : "el Local"}
          </p>

          <div className="jmcs-espejo-desktop" style={{ marginTop: 20 }}>
            <SeccionEspejo
              equipoLocal={equipoLocal}
              equipoVisitante={equipoVisitante}
              fixturesLocal={fixturesLocal}
              fixturesVisitante={fixturesVisitante}
              statsMap={statsMap}
              tema={tema}
              competicionActual={competicionActual}
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
                : <><Icono tipo="barras" size={13} /> {`Cargar datos puntuales (córners, tarjetas, faltas) — ${equipoLocal.team.name} y ${equipoVisitante.team.name}`}</>}
            </button>
          )}

          {datosPuntualesListos && (
            <p style={{ textAlign: "center", marginTop: 20, color: "#2e9e4f", fontWeight: "bold" }}>
              <Icono tipo="check" size={14} color="#2e9e4f" /> Datos puntuales cargados para este encuentro
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
            sesion={sesion}
            onPedirLogin={abrirLogin}
            mercadosPreferidos={perfil?.mercados_preferidos}
            mostrarToast={mostrarToast}
            competicionActual={competicionActual}
          />
        </div>

        <div className="jmcs-ala-visitante">
          <PanelEquipoLateral equipo={equipoVisitante} stats={statsGoVisitante} posesion={posesionVisitante} fixtures={fixturesVisitante} acento={colorMarcaVisitante} tema={tema} sesion={sesion} onPedirLogin={abrirLogin} onAbrirPerfil={abrirPerfilEquipo} mostrarToast={mostrarToast} />
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

      {vistaActual === "inicio" && equipoInicio?.team && (
        <>
          <div className="jmcs-chat-panel" style={{ background: tema.panel, display: chatAbierto ? "block" : "none" }}>
            <ChatIA
              tema={tema}
              acento={acentoMarca}
              onCerrar={() => setChatAbierto(false)}
              tituloOverride={`IA sobre ${equipoInicio.team.name}`}
              sugerenciasOverride={`Ej: "¿Cómo ha venido rindiendo ${equipoInicio.team.name}?", "¿Es buen momento para apostarle?"`}
              contextoOverride={(() => {
                const s = calcularEstadisticasGoles(fixturesInicio, equipoInicio.team.id);
                if (!s) return `Equipo: ${equipoInicio.team.name}. Sin datos suficientes todavía.`;
                return `Equipo: ${equipoInicio.team.name}\nÚltimos ${s.total} partidos: Récord ${s.victorias}V-${s.empates}E-${s.derrotas}D, promedio goles a favor ${s.promedioGolesFavor}, en contra ${s.promedioGolesContra}, % Over 2.5: ${s.over25Pct}%, % BTTS: ${s.bttsPct}%`;
              })()}
            />
          </div>
          <button className="jmcs-chat-burbuja" onClick={() => setChatAbierto(!chatAbierto)} aria-label="Chat IA">
            <img src="/chat-icon.png" alt="Chat" />
          </button>
        </>
      )}

      {vistaActual === "favoritos" && sesion && (
        <>
          <div className="jmcs-chat-panel" style={{ background: tema.panel, display: chatAbierto ? "block" : "none" }}>
            <ChatIA
              tema={tema}
              acento={acentoMarca}
              onCerrar={() => setChatAbierto(false)}
              tituloOverride="IA sobre tus favoritos"
              sugerenciasOverride='Ej: "¿Cuál de mis favoritos rinde mejor ahora?", "¿A cuál le apostarías esta semana?"'
              contextoOverride={contextoFavoritosIA || "El usuario todavía no tiene equipos favoritos guardados, o sus estadísticas se están cargando."}
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
          mostrarToast={mostrarToast}
        />
      )}

      <ContenedorToasts toasts={toasts} />

      <div className="jmcs-nav-movil">
        {[
          { id: "inicio", icono: "hogar", etiqueta: t("inicio") },
          { id: "estudio", icono: "barras", etiqueta: t("estudio") },
          { id: "favoritos", icono: "estrella", etiqueta: t("favoritos") },
          { id: "historial", icono: "grafico", etiqueta: "Historial" },
        ].map((item) => (
          <button
            key={item.id}
            className="jmcs-nav-movil-item"
            onClick={() => (item.id === "inicio" ? setVistaActual("inicio") : accederOPedirCuenta(item.id))}
            style={{ color: vistaActual === item.id ? acentoMarca : tema.textoSuave, fontWeight: vistaActual === item.id ? "bold" : "normal" }}
          >
            <Icono tipo={item.icono} size={18} />
            {item.etiqueta}
          </button>
        ))}
        <button
          ref={masBtnRef}
          className="jmcs-nav-movil-item"
          onClick={() => setMenuAbierto(!menuAbierto)}
          style={{ color: tema.textoSuave }}
        >
          <Icono tipo="menu" size={18} />
          Más
        </button>
      </div>

      {estudioClimaticoAbierto && ajustesClima && climaOficialNorm && equipoLocal?.team && equipoVisitante?.team && (
        <ModalEstudioClimatico
          equipoLocal={equipoLocal}
          equipoVisitante={equipoVisitante}
          climaOficial={climaOficialNorm}
          ajustesClima={ajustesClima}
          onCambiarAjuste={actualizarAjusteClima}
          modoGlobalClima={modoGlobalClima}
          onPedirActivarGlobal={() => setConfirmarGlobalAbierto(true)}
          onDesactivarGlobal={() => { setModoGlobalClima(false); setDeltasGlobalesClima({ local: {}, visitante: {} }); }}
          confirmarGlobalAbierto={confirmarGlobalAbierto}
          onConfirmarGlobal={activarModoGlobal}
          onCancelarConfirmarGlobal={() => setConfirmarGlobalAbierto(false)}
          lambdaGolesLocalReal={lambdaGolesLocalReal}
          lambdaGolesVisitanteReal={lambdaGolesVisitanteReal}
          factorLocal={climaAjuste.factorLocal}
          factorVisitante={climaAjuste.factorVisitante}
          onRestaurar={() => {
            setAjustesClima((prev) => {
              const nuevo = { local: {}, visitante: {} };
              ["local", "visitante"].forEach((rol) => {
                ["viento", "lluvia", "temperatura", "humedad"].forEach((v) => {
                  nuevo[rol][v] = { activo: false, valorUsuario: climaOficialNorm[v] };
                });
              });
              return nuevo;
            });
          }}
          onGuardar={guardarEstudioClimatico}
          guardando={guardandoClima}
          guardado={guardadoClima}
          tema={tema}
          acentoMarca={acentoMarca}
          colorMarcaLocal={colorMarcaLocal}
          colorMarcaVisitante={colorMarcaVisitante}
          onCerrar={() => setEstudioClimaticoAbierto(false)}
          tutorialesOcultos={tutorialesOcultos}
          onOcultarPermanente={ocultarTutorialPermanente}
        />
      )}
    </div>
    </>
  );
}

// ============================================================
// TRAMPA DE ERRORES TEMPORAL — para diagnosticar el bug de las
// notificaciones sin depender de la consola del navegador. En vez
// de la pantalla negra genérica de Next.js, muestra el mensaje real
// del error, para poder mandarlo por captura. Se puede sacar más
// adelante una vez resuelto el problema.
class TrampaDeErrores extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    this.setState({ info });
    // Reportamos el error solo, para que quede en el panel de admin y les llegue
    // el aviso push — si esto falla, no hacemos nada más, ya bastante tiene el
    // usuario con la pantalla rota como para que le salga otro error encima.
    try {
      supabase.auth.getSession().then(({ data }) => {
        fetch("/api/registrar-error", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mensaje: String(error?.message || error),
            stack: error?.stack || "",
            componentStack: info?.componentStack || "",
            ruta: typeof window !== "undefined" ? window.location.pathname : "",
            userId: data?.session?.user?.id || null,
          }),
        }).catch(() => {});
      });
    } catch {
      // silencioso a propósito
    }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 20, fontFamily: "monospace", background: "#fff", color: "#b00", minHeight: "100vh" }}>
          <h2 style={{ color: "#b00" }}>Se rompió algo — mandale captura de esto a tu socio:</h2>
          <p style={{ fontWeight: "bold", fontSize: 15 }}>{String(this.state.error?.message || this.state.error)}</p>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, color: "#333", background: "#f5f5f5", padding: 10, borderRadius: 6 }}>
            {this.state.error?.stack}
          </pre>
          {this.state.info?.componentStack && (
            <>
              <p style={{ fontWeight: "bold", marginTop: 16 }}>Dónde pasó:</p>
              <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, color: "#333", background: "#f5f5f5", padding: 10, borderRadius: 6 }}>
                {this.state.info.componentStack}
              </pre>
            </>
          )}
          <button
            onClick={() => window.location.href = "/"}
            style={{ marginTop: 16, padding: "10px 16px", background: "#2e6b3e", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}
          >
            Volver a Inicio
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function HomeConTrampaDeErrores() {
  return (
    <TrampaDeErrores>
      <Home />
    </TrampaDeErrores>
  );
}

