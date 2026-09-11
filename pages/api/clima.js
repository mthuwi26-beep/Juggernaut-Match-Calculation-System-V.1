// Trae el clima de una ciudad en una fecha específica, usando Open-Meteo (gratis, sin key)
import { obtenerCache, guardarCache, CACHE_3_HORAS } from "../../lib/cacheApi";

export default async function handler(req, res) {
  const { ciudad, fecha } = req.query;

  if (!ciudad || !fecha) {
    return res.status(400).json({ error: "Faltan ciudad o fecha" });
  }

  // Nota aparte: esto no gasta cuota de API-Football (Open-Meteo es gratis y sin key),
  // pero igual lo cacheamos — menos vueltas, respuesta más rápida para el usuario.
  const clave = `clima:${ciudad.trim().toLowerCase()}:${fecha}`;
  const cacheado = await obtenerCache(clave);
  if (cacheado) return res.status(200).json(cacheado);

  try {
    // Paso 1: geocodificar la ciudad a coordenadas
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ciudad)}&count=1&language=es`
    );
    const geoData = await geoRes.json();

    if (!geoData.results || geoData.results.length === 0) {
      return res.status(200).json({ error: `No se encontró la ciudad: ${ciudad}` });
    }

    const { latitude, longitude } = geoData.results[0];

    // Paso 2: pedir el pronóstico para esa fecha
    const climaRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,relative_humidity_2m_mean&timezone=auto&start_date=${fecha}&end_date=${fecha}`
    );
    const climaData = await climaRes.json();

    if (!climaData.daily || !climaData.daily.time || climaData.daily.time.length === 0) {
      return res.status(200).json({ error: "No hay pronóstico disponible para esa fecha (puede estar muy lejos en el futuro o en el pasado)" });
    }

    const resultado = {
      temperaturaMax: climaData.daily.temperature_2m_max[0],
      temperaturaMin: climaData.daily.temperature_2m_min[0],
      precipitacionMm: climaData.daily.precipitation_sum[0],
      vientoMaxKmh: climaData.daily.wind_speed_10m_max[0],
      humedadPct: climaData.daily.relative_humidity_2m_mean ? climaData.daily.relative_humidity_2m_mean[0] : null,
    };

    await guardarCache(clave, resultado, CACHE_3_HORAS);
    res.status(200).json(resultado);
  } catch (error) {
    res.status(500).json({ error: "No se pudo conectar con el servicio de clima" });
  }
}
