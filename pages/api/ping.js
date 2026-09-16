// Ruta a propósito minúscula — solo sirve para que el navegador/app
// compruebe si de verdad hay internet, golpeando nuestro propio servidor.
// El service worker la deja pasar siempre directo a la red (ver sw.js).
export default function handler(req, res) {
  res.status(200).json({ ok: true });
}
