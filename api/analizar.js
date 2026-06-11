const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

// Función para extraer texto de PDF en base64
async function extractTextFromPDF(pdfBase64) {
  try {
    // Convertir base64 a Buffer
    const pdfBuffer = Buffer.from(pdfBase64, "base64");

    // Usar Claude para analizar el PDF
    const response = await client.messages.create({
      model: "claude-haiku-4-20250122",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdfBase64,
              },
            },
            {
              type: "text",
              text: `Analiza esta ficha IVYD (Análisis de Información de Viabilidad y Desempeño) de FOSIS Emprendamos Avanzado 2026.

CRITERIOS DE ADMISIBILIDAD:
- D.1: Debe ser INDEPENDIENTE PRECARIO (ventas ≤ $431.200) O INDEPENDIENTE (ventas > $431.200)
- E.1: Debe responder SÍ a "¿Tiene negocio?"
- F.1: Ventas deben ser > $350.000

VALIDACIONES CRÍTICAS:
- Código proyecto debe ser: 13-457404-00045-26
- RUT institución debe ser: 76084913-8
- Si D.1 = PRECARIO → ingresos ≤ $431.200
- Si D.1 = INDEPENDIENTE → ingresos > $431.200
- Sección N debe estar presente y completada
- Estados válidos: ADMISIBLE, NO_ADMISIBLE, NO_UBICABLE, RENUNCIA

EXTRAE Y VALIDA:
1. Código proyecto (debe coincidir con 13-457404-00045-26)
2. RUT institución (debe coincidir con 76084913-8)
3. Nombre del beneficiario
4. RUT del beneficiario
5. Criterio D.1 (tipo de independiente)
6. Criterio E.1 (tiene negocio SÍ/NO)
7. Ingresos/ventas mensuales
8. Criterio F.1 (ventas > $350.000)
9. Presencia de Sección N
10. Estado de admisibilidad final

RESPONDE EN JSON STRICT:
{
  "codigoProyectoValido": boolean,
  "rutInstitucionValido": boolean,
  "nombre": "string",
  "rut": "string",
  "criterios_validados": {
    "D1": "CUMPLE" | "NO_CUMPLE" | "NO_ENCONTRADO",
    "E1": "CUMPLE" | "NO_CUMPLE" | "NO_ENCONTRADO",
    "F1": "CUMPLE" | "NO_CUMPLE" | "NO_ENCONTRADO"
  },
  "ventas": "número o string con monto",
  "seccionNPresente": boolean,
  "estado_admisibilidad": "ADMISIBLE" | "NO_ADMISIBLE" | "NO_UBICABLE" | "RENUNCIA" | "PENDIENTE",
  "observaciones": "string con hallazgos principales",
  "errores": ["array de errores encontrados"],
  "advertencias": ["array de advertencias"]
}`,
            },
          ],
        },
      ],
    });

    // Extraer el contenido de texto
    const textContent = response.content.find((block) => block.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from Claude");
    }

    // Parsear JSON limpio
    let jsonText = textContent.text;
    // Remover markdown code blocks si existen
    jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    const analysisResult = JSON.parse(jsonText.trim());

    return analysisResult;
  } catch (error) {
    console.error("Error analyzing PDF:", error);
    throw error;
  }
}

// Handler de Vercel
module.exports = async (req, res) => {
  // *** CONFIGURAR CORS HEADERS ***
  res.setHeader("Access-Control-Allow-Origin", "*"); // Permite TODOS los orígenes
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );
  res.setHeader("Access-Control-Max-Age", "86400"); // 24 horas

  // Manejar preflight requests (OPTIONS)
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  // Solo aceptar POST
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed. Use POST." });
    return;
  }

  try {
    const { pdf_base64 } = req.body;

    if (!pdf_base64) {
      res.status(400).json({ error: "pdf_base64 is required" });
      return;
    }

    // Validar que sea base64 válido
    if (!/^[A-Za-z0-9+/=]+$/.test(pdf_base64)) {
      res.status(400).json({ error: "Invalid base64 string" });
      return;
    }

    // Analizar PDF con Claude
    const analysisResult = await extractTextFromPDF(pdf_base64);

    // Retornar resultado exitoso
    res.status(200).json({
      status: "success",
      ...analysisResult,
    });
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({
      status: "error",
      error: error.message || "Internal server error",
      message:
        "Error al analizar el PDF. Verifica que sea un archivo IVYD válido.",
    });
  }
};














