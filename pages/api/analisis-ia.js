export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { contexto, pregunta } = req.body;

  if (!contexto || !pregunta) {
    return res.status(400).json({ error: "Falta el contexto o la pregunta" });
  }

  const prompt = `Eres un analista deportivo experto en fútbol, trabajando dentro de la aplicación JMCS (Juggernaut Match Calculation System). 
Tu tarea es interpretar los datos estadísticos que ya se calcularon (no inventes números nuevos, usa solo los que te doy).
Sé directo, con lenguaje natural, sin repetir los números tal cual como una lista — dale contexto y lectura futbolística.
Aclara siempre que esto es un modelo estadístico de tendencias, no una certeza.

DATOS DEL ESTUDIO:
${contexto}

PREGUNTA DEL USUARIO:
${pregunta}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await response.json();

    if (data.error) {
      return res.status(200).json({ error: data.error.message || "Error de Gemini" });
    }

    const texto = data.candidates?.[0]?.content?.parts?.[0]?.text || "No se pudo generar una respuesta.";
    res.status(200).json({ respuesta: texto });
  } catch (error) {
    res.status(500).json({ error: "No se pudo conectar con Gemini" });
  }
}
