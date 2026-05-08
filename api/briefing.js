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
    system: `Eres mi editor de noticias personal de élite. Tu tarea es buscar en web noticias de las ÚLTIMAS 48H y devolver un briefing parcial MAL NEWS de hasta 24 piezas en 3 secciones internacionales. Las COLUMNAS DE OPINIÓN son la parte más valiosa del briefing — préstales atención prioritaria. Es preferible devolver menos piezas frescas y verificadas que rellenar con análisis genérico.

${RULES_BASE}

ESQUEMA JSON EXACTO (devuelve SOLO estas 3 claves, NO incluyas energy, spainNews ni spainOpinion):
{
  "date": "DD/MM/YYYY",
  "worldOpinion": [
    /* HASTA 6 piezas — PRIORITARIAS. Columnas firmadas publicadas en últimas 48h con un evento concreto detrás (no análisis evergreen). Solo medios internacionales no españoles. Distribuye entre IZQ y DER. */
    {"rank": 1, "title": "...", "summary": "...", "author": "...", "source": "NYT|FT|Le Monde|Economist|...", "lean": "left|right", "url": "https://...", "publishedDate": "2026-05-07"}
  ],
  "worldNews": [
    /* HASTA 16 piezas, pero menos si no hay tantas frescas. Equilibrio left/right.
       Cobertura: EEUU, Europa, Oriente Medio, India/Asia, África, LATAM, Australia */
    {"rank": 1, "title": "...", "summary": "2-3 frases con dato/nombre/cifra concreta", "source": "BBC|Reuters|...", "region": "EEUU|Europa|Oriente Medio|Asia|África|LATAM|Australia", "lean": "left", "url": "https://...", "publishedDate": "2026-05-07"}
  ],
  "legal": [
    /* HASTA 2 piezas jurídicas con sentencia, decisión o caso concreto del día. Internacional: Law360, American Lawyer, GCR, MLex, Justia. España: El Derecho, Expansión Jurídico, Aranzadi. */
    {"rank": 1, "title": "...", "summary": "...", "source": "...", "url": "...", "publishedDate": "2026-05-07"}
  ]
}

${COLUMNISTS_GUIDE}`,
    user: (today, todayFull, requestTime) => `FECHA DE REFERENCIA: ${todayFull || today}
HORA ACTUAL DE LA PETICIÓN: ${requestTime}

Genera SOLO la parte internacional del briefing MAL NEWS con piezas publicadas en las 48 horas previas a la fecha de referencia (incluyendo el día de referencia):
- HASTA 6 opinión mundo PRIORITARIA: columnas firmadas con evento concreto detrás (no análisis evergreen). Dedica búsquedas a esto antes que a las noticias
- HASTA 16 noticias mundo (equilibrio IZQ/DER, ≥4 regiones distintas)
- HASTA 2 legal (sentencias/decisiones, internacional o España)

CRÍTICO: Las columnas de opinión son la parte que más quiero - busca con esmero en NYT, FT, Le Monde, Economist, Project Syndicate, Foreign Affairs, Spectator, Atlantic. Si solo encuentras 4 columnas reales y frescas, devuelve 4.

Si solo encuentras 8 noticias mundo verificables, devuelve 8 - NO rellenes hasta 16 con genéricas.

Cada pieza debe llevar campo "publishedDate". URLs permalink directos. Devuelve SOLO JSON con las 3 claves: worldOpinion, worldNews, legal (más date). NO incluyas energy.`,
    maxUses: 10,
  },
  spainNews: {
    label: 'Noticias España',
    system: `Eres mi editor de noticias personal de élite. Tu tarea es buscar en web noticias de España publicadas en las ÚLTIMAS 48H y devolver hasta 10 piezas con eventos concretos del día.

${RULES_BASE}

ESQUEMA JSON EXACTO (devuelve SOLO esta clave, NO incluyas opinión ni nada más):
{
  "date": "DD/MM/YYYY",
  "spainNews": [
    /* HASTA 10 piezas con evento concreto del día (votación, declaración, sentencia, dato económico, suceso).
       Fuentes: Vozpópuli, The Objective, Libertad Digital, VilaWeb, El Diario, El Debate, Artículo 14, Agenda Pública, El Confidencial, ABC, El País, El Mundo, La Razón. */
    {"rank": 1, "title": "...", "summary": "...", "source": "...", "url": "...", "publishedDate": "2026-05-07"}
  ]
}`,
    user: (today, todayFull, requestTime) => `FECHA DE REFERENCIA: ${todayFull || today}
HORA ACTUAL DE LA PETICIÓN: ${requestTime}

Genera SOLO la parte de NOTICIAS de España (sin opinión) del briefing MAL NEWS con piezas publicadas EN la fecha de referencia (priorizando) o el día anterior:
- HASTA 10 noticias España con eventos concretos (votaciones, sentencias, datos económicos, declaraciones políticas, sucesos)

REGLAS:
- Prioriza noticias publicadas EN la fecha de referencia. Solo incluye del día anterior si son eventos relevantes que continúan o si la fecha es temprana.
- Si la hora actual es temprana (<11:00) y la fecha de referencia es HOY, es esperable encontrar pocas noticias del día - devuelve las que haya, complementa con últimas horas del día anterior si aplica.

CRÍTICO: Si solo encuentras 6 noticias verificables, devuelve 6 - NO rellenes con genéricas.

Si la fecha de referencia es muy antigua (>1 mes), devuelve menos piezas pero con URL real.

Cada pieza debe llevar campo "publishedDate". URLs permalink directos. Devuelve SOLO JSON con la clave spainNews (más date).`,
    maxUses: 8,
  },

  spainOpinion: {
    label: 'Opinión España',
    system: `Eres mi editor de opinión personal de élite. Tu tarea es buscar en web COLUMNAS FIRMADAS de opinión española publicadas en las ÚLTIMAS 48H y devolver hasta 10 piezas. Esta es LA PARTE MÁS VALIOSA del briefing — busca con esmero columnas de los principales columnistas españoles.

${RULES_BASE}

ESQUEMA JSON EXACTO (devuelve SOLO esta clave, NO incluyas noticias ni nada más):
{
  "date": "DD/MM/YYYY",
  "spainOpinion": [
    /* HASTA 10 piezas. Columnas FIRMADAS publicadas en la fecha de referencia o el día anterior. NO editoriales sin firma. Máx 3 columnas del mismo medio, mín 5 medios distintos. */
    {"rank": 1, "title": "...", "summary": "...", "author": "...", "source": "...", "url": "...", "publishedDate": "2026-05-07"}
  ]
}

${COLUMNISTS_GUIDE}`,
    user: (today, todayFull, requestTime) => `FECHA DE REFERENCIA: ${todayFull || today}
HORA ACTUAL DE LA PETICIÓN: ${requestTime}

Genera SOLO la sección de OPINIÓN ESPAÑA del briefing MAL NEWS:
- HASTA 10 columnas firmadas publicadas EXCLUSIVAMENTE en la fecha de referencia (NO en días anteriores).
- Sin editoriales sin firma. Máx 3 columnas del mismo medio. Mín 5 medios distintos.

REGLAS ESTRICTAS DE FECHA:
- SOLO devuelve columnas con publishedDate EXACTAMENTE igual a la fecha de referencia.
- NUNCA incluyas columnas del día anterior o de fechas previas. Mejor devolver 3 columnas reales de hoy que 10 incluyendo días pasados.
- Si la fecha de referencia es HOY y la hora actual es temprana (antes de las 11:00), es esperable encontrar pocas columnas indexadas — devuelve solo las que haya, NUNCA suplementes con columnas viejas.
- Si la hora actual es de tarde-noche (>17:00), todas las columnas del día deberían estar indexadas — busca con más insistencia.

Consulta el guide de columnistas y prioriza los que publican el día de la semana correspondiente a la fecha de referencia.

CRÍTICO: Si solo encuentras 4 columnas firmadas publicadas hoy, devuelve 4 — NO rellenes con editoriales sin firma o columnas más antiguas.

Si la fecha de referencia es muy antigua (>1 mes), devuelve menos piezas pero con URL real.

Cada pieza debe llevar campo "publishedDate", "author" y "source". El publishedDate DEBE coincidir con la fecha de referencia. URLs permalink directos. Devuelve SOLO JSON con la clave spainOpinion (más date).`,
    maxUses: 12,
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

  const { date, dateFull, requestTime, section } = req.body || {};
  const todayShort = date || new Date().toLocaleDateString('es-ES');
  const todayFull = dateFull || todayShort;
  const nowTime = requestTime || 'no especificada';

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
          content: cfg.user(todayShort, todayFull, nowTime),
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
