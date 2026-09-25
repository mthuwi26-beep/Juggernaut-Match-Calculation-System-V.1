// Competiciones "top", de más a menos importante — decide el orden natural
// de Inicio (estas primero, el resto por país después), arma los botones
// del filtro rápido de arriba, y lo usa también el endpoint que busca el
// próximo partido de una competición sin nada programado hoy.
//
// Se reconoce por nombre de la liga (y, cuando hace falta, también por país
// — "Serie A" es a la vez Italia y Brasil, así que ahí sí hace falta el
// país para no confundirlas), porque no hay forma de verificar con certeza
// los IDs numéricos exactos que usa la API para cada torneo.
//
// Este archivo es la ÚNICA fuente de verdad para esto en el lado web — antes
// vivía duplicado dentro de pages/index.js.
export const COMPETICIONES_TOP = [
  { etiqueta: "Mundial", nivel: 1, coincide: (n) => n.includes("world cup") && !n.includes("qualif") },
  { etiqueta: "Champions League", nivel: 1, coincide: (n) => n.includes("champions league") },
  { etiqueta: "Copa Libertadores", nivel: 1, coincide: (n) => n.includes("libertadores") },
  { etiqueta: "Premier League", nivel: 2, coincide: (n, p) => n.includes("premier league") && p === "england" },
  { etiqueta: "La Liga", nivel: 2, coincide: (n, p) => n === "la liga" && p === "spain" },
  { etiqueta: "Serie A", nivel: 2, coincide: (n, p) => n === "serie a" && p === "italy" },
  { etiqueta: "Bundesliga", nivel: 2, coincide: (n, p) => n.includes("bundesliga") && p === "germany" && !n.includes("2.") },
  { etiqueta: "Ligue 1", nivel: 2, coincide: (n, p) => n === "ligue 1" && p === "france" },
  { etiqueta: "Brasileirão", nivel: 2, coincide: (n, p) => n === "serie a" && p === "brazil" },
  { etiqueta: "Europa League", nivel: 3, coincide: (n) => n.includes("europa league") },
  { etiqueta: "Copa Sudamericana", nivel: 3, coincide: (n) => n.includes("sudamericana") },
  { etiqueta: "Liga MX", nivel: 3, coincide: (n, p) => n.includes("liga mx") && p === "mexico" },
  { etiqueta: "Primera Argentina", nivel: 3, coincide: (n, p) => (n.includes("primera división") || n.includes("liga profesional")) && p === "argentina" },
];

// A qué competición top pertenece este partido, o null si es de nivel 4
// (todo lo demás, incluida la Primera A de Colombia y cualquier liga menor).
export function competicionDe(nombreLiga, pais) {
  const n = (nombreLiga || "").trim().toLowerCase();
  const p = (pais || "").trim().toLowerCase();
  return COMPETICIONES_TOP.find((c) => c.coincide(n, p)) || null;
}
