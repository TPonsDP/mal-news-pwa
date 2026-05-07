// Vercel serverless function (Node runtime)
// La API key NUNCA sale del servidor.
// Modelo: Claude Sonnet 4.6 con web_search.
// Acepta { section: 'international' | 'spain' } para dividir el trabajo en 2 llamadas
// y caber en el timeout de 60s del plan Hobby.

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

const RULES_BASE = `REGLAS ABSOLUTAS DE FRESCURA Y CALIDAD:

A. FRESCURA (anti-genérico):
A1. Cada pieza DEBE haberse publicado en las ÚLTIMAS 48 HORAS desde la fecha indicada por el usuario. Si en web search no encuentras la fecha del artículo claramente, NO LO INCLUYAS.
A2. Cada pieza DEBE estar anclada a un evento concreto de las últimas 48h: un nombre propio (político, empresa, país), una cifra concreta (porcentaje, importe, fecha), una decisión específica (sentencia, votación, declaración), o un suceso identificable.
A3. PROHIBIDO incluir piezas tipo "análisis evergreen" — títulos vagos sobre tendencias atemporales ("El cambio del orden mundial", "Los retos de Europa", "El futuro de la IA") que podrían haberse publicado hace meses. Si el título no menciona algo concreto del día, NO lo incluyas.
A4. PREFIERE devolver MENOS piezas reales que rellenar el conteo con genéricas. Si solo encuentras 8 piezas frescas y verificables de mundo, devuelve 8 — NO inventes ni rellenes hasta 14.
A5. Cada pieza JSON DEBE incluir el campo "publishedDate" (formato ISO YYYY-MM-DD) con la fecha real de publicación tomada del artículo o sus metadatos. Si no la encuentras, descártala.

B. URLs Y FUENTES:
B1. Cada URL debe ser un permalink al artículo concreto (slug específico, normalmente con fecha en el path tipo /2026/05/...). NUNCA portadas, secciones, etiquetas o páginas de búsqueda.
B2. Prohibido Wikipedia, agregadores (Google News, Yahoo), redes sociales, foros.
B3. Verifica visualmente que el dominio coincide con la fuente declarada (no marques "BBC" en una URL del Daily Mail).
B4. Prioriza fuentes con indexación rápida: Reuters, AP, BBC, Guardian, FT, NYT, El País, ABC, RTVE.
B5. Si una URL no se verifica en web search, descártala — NO inventes URLs plausibles.

C. CLASIFICACIÓN:
C1. En MUNDO y OPINIÓN MUNDO marca cada pieza como lean: "left" o "right".
C2. ESPAÑA OPINIÓN: solo columnas firmadas, NO incluyas editoriales sin autor. Máx 3 columnistas del mismo medio, mín 5 medios distintos.
C3. MUNDO OPINIÓN: solo medios internacionales no españoles.
C4. ENERGÍA: si Brent ha tenido movimiento relevante en últimas 24h, inclúyelo obligatoriamente.

D. FORMATO:
D1. Devuelve ÚNICAMENTE JSON válido sin markdown, sin bloques de código, sin texto explicativo antes o después.`;

const SECTIONS = {
  international: {
    label: 'Internacional + Energía + Legal',
    system: `Eres mi editor de noticias personal de élite. Tu tarea es buscar en web noticias de las ÚLTIMAS 48H y devolver un briefing parcial MAL NEWS de hasta 26 piezas en 4 secciones internacionales. Es preferible devolver menos piezas frescas y verificadas que rellenar con análisis genérico.

${RULES_BASE}

ESQUEMA JSON EXACTO (devuelve SOLO estas 4 claves, NO incluyas spainNews ni spainOpinion):
{
  "date": "DD/MM/YYYY",
  "worldNews": [
    /* HASTA 16 piezas, pero menos si no hay tantas frescas. Equilibrio left/right.
       Cobertura: EEUU, Europa, Oriente Medio, India/Asia, África, LATAM, Australia */
    {"rank": 1, "title": "...", "summary": "2-3 frases con dato/nombre/cifra concreta", "source": "BBC|Reuters|...", "region": "EEUU|Europa|Oriente Medio|Asia|África|LATAM|Australia", "lean": "left", "url": "https://...", "publishedDate": "2026-05-07"}
  ],
  "worldOpinion": [
    /* HASTA 6 piezas, columnas firmadas publicadas en últimas 48h con un evento concreto detrás (no análisis evergreen). Solo medios internacionales no españoles. */
    {"rank": 1, "title": "...", "summary": "...", "author": "...", "source": "NYT|FT|Le Monde|Economist|...", "lean": "left|right", "url": "https://...", "publishedDate": "2026-05-07"}
  ],
  "energy": [
    /* HASTA 2 piezas. Fuentes: Reuters Energy, Bloomberg Energy, S&P Global, Argus, tradingeconomics.com, EIA, IEA. Brent obligatorio si hay movimiento. */
    {"rank": 1, "title": "...", "summary": "...", "source": "...", "url": "...", "publishedDate": "2026-05-07"}
  ],
  "legal": [
    /* HASTA 2 piezas jurídicas con sentencia, decisión o caso concreto del día. Internacional: Law360, American Lawyer, GCR, MLex, Justia. España: El Derecho, Expansión Jurídico, Aranzadi. */
    {"rank": 1, "title": "...", "summary": "...", "source": "...", "url": "...", "publishedDate": "2026-05-07"}
  ]
}

${COLUMNISTS_GUIDE}`,
    user: (today) => `Hoy es ${today}. Genera SOLO la parte internacional del briefing MAL NEWS con piezas publicadas en las últimas 48 horas:
- HASTA 16 noticias mundo (equilibrio IZQ/DER, ≥4 regiones distintas)
- HASTA 6 opinión mundo firmada con evento concreto detrás (no análisis evergreen)
- HASTA 2 energía (Brent obligatorio si hay movimiento hoy)
- HASTA 2 legal (sentencias/decisiones del día, internacional o España)

CRÍTICO: Si solo encuentras 8 piezas reales y frescas de mundo, devuelve 8 — NO rellenes hasta 16 con genéricas. Mejor 18 piezas reales que 26 mediocres.

Cada pieza debe llevar campo "publishedDate" con la fecha real del artículo. URLs permalink directos. Devuelve SOLO JSON con las 4 claves: worldNews, worldOpinion, energy, legal (más date).`,
    maxUses: 10,
  },
  spain: {
    label: 'España + Opinión España',
    system: `Eres mi editor de noticias personal de élite. Tu tarea es buscar en web noticias de las ÚLTIMAS 48H y devolver un briefing parcial MAL NEWS de hasta 19 piezas en 2 secciones españolas. Es preferible devolver menos piezas frescas y verificadas que rellenar con análisis genérico o columnas viejas.

${RULES_BASE}

ESQUEMA JSON EXACTO (devuelve SOLO estas 2 claves, NO incluyas worldNews, worldOpinion, energy ni legal):
{
  "date": "DD/MM/YYYY",
  "spainNews": [
    /* HASTA 10 piezas con evento concreto del día (votación, declaración, sentencia, dato económico, suceso).
       Fuentes: Vozpópuli, The Objective, Libertad Digital, VilaWeb, El Diario, El Debate, Artículo 14, Agenda Pública. */
    {"rank": 1, "title": "...", "summary": "...", "source": "...", "url": "...", "publishedDate": "2026-05-07"}
  ],
  "spainOpinion": [
    /* HASTA 9 columnas FIRMADAS publicadas HOY (no ayer, no editoriales). Máx 3 mismo medio, mín 5 medios. */
    {"rank": 1, "title": "...", "summary": "...", "author": "...", "source": "...", "url": "...", "publishedDate": "2026-05-07"}
  ]
}

${COLUMNISTS_GUIDE}`,
    user: (today) => `Hoy es ${today}. Genera SOLO la parte de España del briefing MAL NEWS con piezas de las últimas 48 horas:
- HASTA 10 noticias España (evento concreto del día)
- HASTA 9 columnas opinión firmadas publicadas HOY (sin editoriales, máx 3 mismo medio, mín 5 medios)

CRÍTICO: Si solo encuentras 5 columnas firmadas publicadas hoy, devuelve 5 — NO rellenes hasta 9 incluyendo columnas de ayer o editoriales sin firma.

Cada pieza debe llevar campo "publishedDate". URLs permalink directos. Devuelve SOLO JSON con las 2 claves: spainNews, spainOpinion (más date).`,
    maxUses: 10,
  },
};

function extractJson(raw) {
  if (!raw) throw new Error('Respuesta vacía del modelo');
  let s = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const start = s.indexOf('{');
  if (start === -1) throw new Error('No se encontró JSON en la respuesta');
  s = s.slice(start);
  try { return JSON.parse(s); } catch (_) {}

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

  const { date, section } = req.body || {};
  const todayShort = date || new Date().toLocaleDateString('es-ES');

  if (!section || !SECTIONS[section]) {
    return res.status(400).json({
      error: `Parámetro 'section' requerido. Valores válidos: ${Object.keys(SECTIONS).join(', ')}`,
    });
  }

  const cfg = SECTIONS[section];

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
        max_tokens: 12000,
        system: cfg.system,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: cfg.maxUses }],
        messages: [{
          role: 'user',
          content: cfg.user(todayShort),
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
    return res.status(200).json({ briefing, section });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Error desconocido' });
  }
}
