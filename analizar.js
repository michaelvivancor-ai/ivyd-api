import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { pdf_base64 } = req.body;

    if (!pdf_base64) {
      return res.status(400).json({ error: "pdf_base64 is required" });
    }

    const systemPrompt = `Eres un experto en validación de fichas IVYD (Instrumento de Verificación y Diagnóstico) del programa FOSIS Emprendamos Avanzado 2026 - Centro Norte.

Tu tarea es analizar un PDF de una ficha IVYD y validar TODOS los criterios de admisibilidad según las reglas PRECISAS.

DATOS INVARIABLES:
- Código Proyecto: 13-457404-00045-26
- RUT Institución: 76084913-8
- Nombre Institución: MPB CONSULTORIAS Y ASESORIAS LTDA

CRITERIOS DE ADMISIBILIDAD (DEBEN CUMPLIRSE TODOS):
1. D.1 (Situación Ocupacional): DEBE ser "INDEPENDIENTE PRECARIO" (≤$431.200) O "INDEPENDIENTE" (>$431.200)
2. E.1 (Negocio): DEBE responder "SÍ"
3. F.1 (Ventas): DEBE ser "MÁS DE $350.000"
4. Sección N: DEBE estar presente (opinión técnica)

VALIDACIONES CRÍTICAS:
- D.1 vs I.13: Si D.1=PRECARIO → I.13 ≤ $431.200; Si D.1=INDEPENDIENTE → I.13 > $431.200
- Matemáticas: I.12 = I.10 - I.11; I.15 = I.13 + I.14
- G.3: Si NO cumple criterios → G.3=NO, NO continúa con Sección 3

RETORNA JSON EXACTAMENTE ASÍ (sin preamble):
{
  "codigoProyectoValido": boolean,
  "rutInstitucionValido": boolean,
  "institucionValida": boolean,
  "criterioD1": {
    "valor": string o null,
    "esAdmisible": boolean,
    "observacion": string
  },
  "criterioE1": {
    "valor": string o null,
    "esAdmisible": boolean,
    "observacion": string
  },
  "criterioF1": {
    "valor": string o null,
    "esAdmisible": boolean,
    "observacion": string
  },
  "validacionI13": {
    "valor": number o null,
    "consistenteConD1": boolean,
    "observacion": string
  },
  "validacionesMatematicas": {
    "i12Correcta": boolean o null,
    "i15Correcta": boolean o null,
    "observacion": string
  },
  "seccionNPresente": boolean,
  "estadoBeneficiario": "ADMISIBLE" | "NO_ADMISIBLE" | "NO_UBICABLE" | "RENUNCIA" | "INDETERMINADO",
  "errores": [string],
  "advertencias": [string],
  "resumen": string
}`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20250101",
      max_tokens: 1500,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdf_base64,
              },
            },
            {
              type: "text",
              text: "Analiza esta ficha IVYD y valida todos los criterios. Retorna SOLO JSON, sin preamble.",
            },
          ],
        },
      ],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Intenta parsear JSON
    let jsonResponse;
    try {
      jsonResponse = JSON.parse(responseText);
    } catch (e) {
      // Si falla el parse, intenta extraer JSON del texto
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonResponse = JSON.parse(jsonMatch[0]);
      } else {
        return res.status(500).json({
          error: "Could not parse Claude response",
          rawResponse: responseText,
        });
      }
    }

    return res.status(200).json(jsonResponse);
  } catch (error) {
    console.error("Error analyzing PDF:", error);
    return res.status(500).json({
      error: error.message || "Internal server error",
    });
  }
}
