export default async function handler(req, res) {
  const { ciudad, fecha } = req.query;

  if (!ciudad || !fecha) {
    return res.status(400).json({ error: "Falta la ciudad o la fecha" });
  }

  try {
    // 1. Geocodificar la ciudad (gratis, sin key)
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ciudad)}&count=1&language=es`
    );
    const geoData = await geoRes.json();

    if (!geoData.results || geoData.results.length === 0) {
      return res.status(200).json({ error: `No se encontró la ciudad "${ciudad}"` });
    }

    const { latitude, longitude, name } = geoData.results[0];

    // 2. Pedir el pronóstico para esa fecha (gratis, sin key)
    const climaRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max&timezone=auto&start_date=${fecha}&end_date=${fecha}`
    );
    const climaData = await climaRes.json();

    if (!climaData.daily || !climaData.daily.time || climaData.daily.time.length === 0) {
      return res.status(200).json({ error: "No hay pronóstico disponible para esa fecha (puede estar muy lejana)" });
    }

    res.status(200).json({
      ciudad: name,
      temperaturaMax: climaData.daily.temperature_2m_max[0],
      temperaturaMin: climaData.daily.temperature_2m_min[0],
      precipitacionMm: climaData.daily.precipitation_sum[0],
      vientoMaxKmh: climaData.daily.windspeed_10m_max[0],
    });
  } catch (error) {
    res.status(500).json({ error: "No se pudo obtener el clima" });
  }
}
