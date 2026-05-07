// Vercel serverless function (Node runtime)
// La API key NUNCA sale del servidor.
// Modelo: Claude Sonnet 4.6 con web_search.

const COLUMNISTS_GUIDE = `COLUMNISTAS A SEGUIR (priorízalos si han publicado HOY):
• ABC: John Müller (lunes), Juan Soto Ivars (martes/domingos), Rebeca Argudo, Ignacio Camacho (L-V)
• Vozpópuli: Jesús Cacho, Gorka Maneiro, Agustín Valladolid (jueves), Manuel Marín (lunes), Rubén Manso (economía semanal), Víctor Lenore (cultura), Pablo Cambronero
• The Objective: Guadalupe Sánchez, Caño, Arias Maldonado, Nieto, Benegas, Ketty Garat, Jorge San Miguel, Pablo de Lora, Manuel Fernández Ordóñez, Victoria Carvajal (sábados, economía), Maite Rico ("Sujétame el vermú" martes)
• El Español: Cristian Campos, Pedro J. Ramírez (domingos), Lorena G. Maldonado (dom/lun), Lorenzo Bernaldo de Quirós (domingos), José Ramón Pin Arboledas (economía/management)
• Libertad Digital: Federico Jiménez Losantos (domingos)
• El Diario: Ignacio Escolar (L-V)
• El País: Estefanía Molina (jueves vía almendron.com)
• La Gaceta: Carmen Álvarez Vela
• El Debate: Luis Ventoso, Mayte Alcaraz, Gabriel Albiac, Ramón Pérez-Maura, Bieito Rubido (L-V)
• LATAM/Internacional: Andrés Oppenheimer (2x/semana)
• Tecnología: Enrique Dans (enriquedans.com, casi diario)`;

const SYSTEM_NEWS = `Eres mi editor de noticias personal de élite. Tu tarea es buscar en web y devolver un briefing diario MAL NEWS completo de 47 piezas en 6 secciones.

REGLAS ABSOLUTAS:
1. Cada pieza DEBE tener una URL directa real al artículo concreto. NUNCA portadas, secciones genéricas, ni páginas de etiqueta.
2. Prohibido Wikipedia como fuente.
3. Si no consigues link verificado para una pieza, elimínala y sustitúyela por otra.
4. En MUNDO y OPINIÓN MUNDO marca cada pieza como lean: "left" o "right" para IZQ ◀ / DER ▶.
5. ESPAÑA OPINIÓN: solo columnas publicadas HOY, NO incluir editoriales, máximo 3 columnistas del mismo medio, mínimo 5 medios distintos.
6. MUNDO OPINIÓN: solo medios internacionales, NO españoles.
7. ENERGÍA: si Brent ha tenido movimiento relevante, inclúyelo obligatoriamente.
8. Devuelve ÚNICAMENTE JSON válido sin markdown, sin bloques de código, sin texto adicional.

ESQUEMA JSON EXACTO:
{
  "date": "DD/MM/YYYY",
  "worldNews": [
    /* 14 piezas: 7 con lean="left" y 7 con lean="right".
       Cobertura mínima de 7 regiones distintas: EEUU, Europa, Oriente Medio, India/Asia, África, LATAM, Australia */
    {"rank": 1, "title": "...", "summary": "2-3 frases", "source": "BBC|Reuters|...", "region": "EEUU|Europa|Oriente Medio|Asia|África|LATAM|Australia", "lean": "left", "url": "https://..."}
  ],
  "worldOpinion": [
    /* 6 piezas: 3 left + 3 right, SOLO medios internacionales no españoles */
    {"rank": 1, "title": "...", "summary": "...", "author": "...", "source": "NYT|FT|Le Monde|Economist|...", "lean": "left|right", "url": "https://..."}
  ],
  "energy": [
    /* 4 piezas. Fuentes: Reuters Energy, Bloomberg Energy, S&P Global, Argus, tradingeconomics.com, EIA, IEA. Brent obligatorio si hay movimiento. */
    {"rank": 1, "title": "...", "summary": "...", "source": "...", "url": "https://..."}
  ],
  "legal": [
    /* 4 piezas jurídicas. Internacional: Law360, American Lawyer, GCR, MLex, Justia. España: El Derecho, Expansión Jurídico, Aranzadi. */
    {"rank": 1, "title": "...", "summary": "...", "source": "...", "url": "https://..."}
  ],
  "spainNews": [
    /* 10 piezas. Fuentes: Vozpópuli, The Objective, Libertad Digital, VilaWeb, El Diario, El Debate, Artículo 14, Agenda Pública. */
    {"rank": 1, "title": "...", "summary": "...", "source": "...", "url": "https://..."}
  ],
  "spainOpinion": [
    /* 9 columnas publicadas HOY. Máx 3 mismo medio, mín 5 medios. NO editoriales. */
    {"rank": 1, "title": "...", "summary": "...", "author": "...", "source": "...", "url": "https://..."}
  ]
}

${COLUMNISTS_GUIDE}`;

function extractJson(raw) {
  if (!raw) throw new Error('Respuesta vacía del modelo');
  let s = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const start = s.indexOf('{');
  if (start === -1) throw new Error('No se encontró JSON en la respuesta');
  s = s.slice(start);
  try { return JSON.parse(s); } catch (_) {}

  // Walk to find last balanced `}`
  let depth = 0, inStr = false, esc = false, lastClose = -1;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\' && inStr) { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) lastClose = i; }
  }
  if (lastClose > 0) {
    try { return JSON.parse(s.slice(0, lastClose + 1)); } catch (_) {}
  }

  // Repair truncation
  let repaired = s;
  const lastObj = repaired.lastIndexOf('}');
  if (lastObj > 0) {
    repaired = repaired.slice(0, lastObj + 1);
    let d = 0, b = 0, inS = false, e = false;
    for (let i = 0; i < repaired.length; i++) {
      const c = repaired[i];
      if (e) { e = false; continue; }
      if (c === '\\' && inS) { e = true; continue; }
      if (c === '"') { inS = !inS; continue; }
      if (inS) continue;
      if (c === '{') d++;
      else if (c === '}') d--;
      else if (c === '[') b++;
      else if (c === ']') b--;
    }
    while (b-- > 0) repaired += ']';
    while (d-- > 0) repaired += '}';
    try { return JSON.parse(repaired); } catch (err) {
      throw new Error(`JSON truncado y no reparable: ${err.message}`);
    }
  }
  throw new Error('JSON malformado en la respuesta del modelo');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Falta ANTHROPIC_API_KEY en variables de entorno de Vercel' });
  }

  const { date } = req.body || {};
  const todayShort = date || new Date().toLocaleDateString('es-ES');

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 16000,
        system: SYSTEM_NEWS,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 25 }],
        messages: [{
          role: 'user',
          content: `Hoy es ${todayShort}. Genera el briefing MAL NEWS reducido con 25 piezas en este formato exacto:
- 8 piezas worldNews (4 lean=left + 4 lean=right, ≥4 regiones)
- 3 piezas worldOpinion (solo medios internacionales no españoles)
- 2 piezas energy
- 2 piezas legal
- 5 piezas spainNews
- 5 piezas spainOpinion (publicadas HOY, mín 3 medios distintos, sin editoriales)

URLs directas reales obligatorias en TODAS las piezas. Devuelve SOLO el JSON con las 6 claves del esquema.`,
        }],
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      return res.status(upstream.status).json({
        error: `Anthropic API error (${upstream.status}): ${errText.slice(0, 500)}`,
      });
    }

    const data = await upstream.json();
    if (data.error) {
      return res.status(500).json({ error: data.error.message || 'Error de la API' });
    }

    const text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    const briefing = extractJson(text);
    return res.status(200).json({ briefing });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Error desconocido' });
  }
}
