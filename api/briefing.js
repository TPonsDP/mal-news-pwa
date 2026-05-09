// Vercel serverless function (Node runtime)
// La API key NUNCA sale del servidor.
// Modelo: Claude Sonnet 4.6 con web_search.
// Acepta { section: 'international' | 'spain' } para dividir el trabajo en 2 llamadas
// y caber en el timeout de 60s del plan Hobby.

const COLUMNISTS_GUIDE = `COLUMNISTAS A SEGUIR (priorízalos si han publicado HOY o ayer):

ABC (verificar primero en paralalibertad.org/category/opinion/, indexa L-V desde ~10:30h y S-D desde ~12:00h. Si no aparece, usar URL de autor directa):
- John Müller — lunes → abc.es/autor/john-muller-4283/
- Juan Soto Ivars — martes y domingos → abc.es/autor/juan-soto-ivars-7455/
- Rebeca Argudo — variable → abc.es/autor/rebeca-argudo-5867/
- Ignacio Camacho — L-V

VOZPÓPULI (búsqueda web vozpopuli.com "[columnista]" [fecha], accesible desde primera hora):
- Jesús Cacho — habitual
- Gorka Maneiro — habitual
- Agustín Valladolid — jueves
- Manuel Marín — director, lunes
- Isaac Blasco — subdirector, irregular
- Rubén Manso — economía, semanal/quincenal, inspector Banco España → vozpopuli.com/redaccion/ruben-manso
- Víctor Lenore — cultura, jefe sección Cultura → vozpopuli.com/redaccion/victor-lenore
- Pablo Cambronero — variable, ex Ciudadanos → vozpopuli.com/redaccion/pablo-cambronero

THE OBJECTIVE (búsqueda web theobjective.com "[columnista]" [fecha]):
- Guadalupe Sánchez
- Antonio Caño
- Manuel Arias Maldonado
- Álvaro Nieto
- Javier Benegas
- Ketty Garat (análisis)
- Jorge San Miguel (variable, 1-2/semana)
- Pablo de Lora → theobjective.com/autor/pablo-de-lora/
- Manuel Fernández Ordóñez (Doctor Física Nuclear, energía/tecnología)
- Victoria Carvajal — sábados, economía, ex-El País
- Maite Rico — varios días, "Sujétame el vermú" martes, directora adjunta
- Pablo Cambronero → theobjective.com/autor/pablo-cambronero/

EL ESPAÑOL (búsqueda web):
- Cristian Campos
- Pedro J. Ramírez — domingos
- Bernard-Henri Lévy (en pausa desde 15/02/2026)
- Lorena G. Maldonado — domingos/lunes + miércoles ocasional
- Lorenzo Bernaldo de Quirós — domingos, economía liberal
- José Ramón Pin Arboledas — variable, IESE, RRHH/management/economía → elespanol.com/autor/jose-ramon-pin-arboledas/

LIBERTAD DIGITAL:
- Federico Jiménez Losantos — domingos (su columna escrita)

EL DIARIO:
- Ignacio Escolar — habitual

EL PAÍS (de pago, usar almendron.com como agregador):
- Estefanía Molina — jueves → almendron.com/tribuna/autor/estefania-molina/
- Pablo de Lora
- Juan Luis Cebrián

LA GACETA DE LA IBEROSFERA:
- Carmen Álvarez Vela → gaceta.es/opinion/

EL DEBATE (búsqueda web eldebate.com/opinion/):
- Luis Ventoso
- Mayte Alcaraz
- Gabriel Albiac
- Ramón Pérez-Maura
- Bieito Rubido (director)
- Juan Carlos Girauta
- Antonio R. Naranjo
- Enrique García-Máiquez

ESTRATEGIA DE BÚSQUEDA POR COLUMNISTA:
1. Para cada columnista que toque ese día de la semana, hacer una búsqueda específica con su nombre + fecha.
2. Si la URL del autor está disponible (listada arriba), usarla como verificación directa antes de hacer búsqueda general.
3. Para ABC: paralalibertad.org/category/opinion/ es agregador útil (más rápido que abc.es directo).
4. Para El País: usar almendron.com como puerta de entrada (su contenido tiene paywall).`;

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
D1. Devuelve ÚNICAMENTE JSON válido sin markdown, sin bloques de código, sin texto explicativo antes o después. NO escribas frases tipo "Aquí está el briefing:" antes ni "Espero que sea útil" después. Tu respuesta debe empezar con { y terminar con }, NADA MÁS.
D2. Si tu respuesta supera 12000 tokens, recórtala devolviendo menos piezas (preferible menos piezas completas que más cortadas). NUNCA dejes JSON sin cerrar.`;

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
    user: (today, todayFull, requestTime, allowedDates) => {
      const dateList = (allowedDates && allowedDates.length === 2)
        ? `\n\nFECHAS ACEPTADAS (ÚNICAS DOS, sin excepción):\n- ${allowedDates[0]} (fecha de referencia)\n- ${allowedDates[1]} (día anterior)\n\nCualquier columna con publishedDate distinto a estas dos fechas se RECHAZA. Sin excepción. Sin "casi". Sin "del fin de semana".`
        : '';
      return `FECHA DE REFERENCIA: ${todayFull || today}
HORA ACTUAL DE LA PETICIÓN: ${requestTime}${dateList}

Genera SOLO la sección de OPINIÓN ESPAÑA del briefing MAL NEWS.

REGLAS HARD-CAP (no son sugerencias, son OBLIGATORIAS):

1. DIVERSIDAD DE FUENTES (LO MÁS IMPORTANTE):
   - MÁXIMO 2 columnas del mismo medio. Si encuentras 5 columnas verificadas de un medio, INCLUYE SOLO 2 y descarta las otras 3.
   - MÍNIMO 4 medios distintos en el resultado final.
   - LISTA DE MEDIOS A CUBRIR (los únicos válidos para esta sección, distribuye entre estos 9):
     * ABC (abc.es)
     * Vozpópuli (vozpopuli.com)
     * The Objective (theobjective.com)
     * El Español (elespanol.com)
     * Libertad Digital (libertaddigital.com)
     * elDiario.es
     * El País (elpais.com — usar almendron.com como agregador si paywall)
     * La Gaceta de la Iberosfera (gaceta.es)
     * El Debate (eldebate.com)
   - PROHIBIDO entregar resultado con solo 2 medios. Antes prefiero 4 columnas variadas que 8 de 2 medios.
   - Consulta la guía de columnistas más abajo para nombres específicos y URLs de autor por medio.

2. FECHAS ESTRICTAS:
   - SOLO acepta publishedDate igual a una de las DOS fechas listadas arriba (fecha de referencia o día inmediatamente anterior).
   - Si encuentras una columna interesante de hace 2+ días: RECHAZAR. No pasa nada por descartarla.
   - VERIFICA cada publishedDate visitando la URL del artículo si tu búsqueda inicial no muestra fecha clara.

3. CALIDAD:
   - Solo columnas FIRMADAS. Sin editoriales sin autor. Sin "Redacción" como autor.
   - Cantidad: hasta 10 columnas, pero PREFERIBLE devolver 4-5 que cumplan reglas que rellenar a 10 violando reglas.

4. ESTRATEGIA DE BÚSQUEDA OBLIGATORIA:
   Para forzar diversidad, NO uses búsquedas genéricas tipo "opinión España hoy". USA búsquedas específicas a las PÁGINAS ÍNDICE de opinión de cada medio (estas páginas SÍ están bien indexadas porque son portadas):

   - "site:abc.es/opinion ${today}" + revisa también paralalibertad.org/category/opinion/ como agregador
   - "site:vozpopuli.com/opinion ${today}"  (su sección de opinión)
   - "site:theobjective.com/comentario ${today}"  (The Objective llama "comentario" a opinión)
   - "site:elespanol.com/opinion ${today}"
   - "site:libertaddigital.com/opinion ${today}"
   - "site:eldiario.es/opinion ${today}"
   - "site:elpais.com/opinion ${today}" (o "site:almendron.com tribuna" si paywall bloquea)
   - "site:gaceta.es/opinion ${today}"
   - "site:eldebate.com/opinion ${today}"

   Si una búsqueda concreta a una página índice no devuelve nada nuevo, PUEDES además visitar la URL directa del índice (vozpopuli.com/opinion/, theobjective.com/comentario/, etc.) para listar las columnas más recientes. Las páginas índice se actualizan al instante, no dependen de indexación lenta de SEO.

   ADEMÁS: usar la guía de columnistas más abajo para buscar nombres específicos por día. Ejemplo si es martes: "Juan Soto Ivars ABC opinión ${today}".

   Las búsquedas con site:medio.com/opinion son OBLIGATORIAS — bypaseando la baja indexación SEO de medios pequeños.

5. CONTEXTO TEMPORAL:
   - Si la hora actual es <11:00 y fecha es HOY, esperable más resultados de día anterior (gente todavía no ha publicado hoy).
   - Si hora >17:00 y fecha es HOY, casi todas las columnas del día deberían estar indexadas.
   - Sábados y domingos hay menos opinión que entre semana - ACEPTABLE devolver pocas (4-6 columnas) en lugar de forzar a 10.

OUTPUT: SOLO JSON válido (sin markdown, sin texto antes ni después). Esquema:
{
  "date": "DD/MM/YYYY",
  "spainOpinion": [
    {"rank": 1, "title": "...", "summary": "...", "author": "...", "source": "...", "url": "...", "publishedDate": "YYYY-MM-DD"}
  ]
}

CHECK FINAL antes de devolver:
- ¿Hay 4+ medios distintos? ✓
- ¿Ningún medio aparece más de 2 veces? ✓
- ¿Todas las publishedDate están en la lista de fechas aceptadas? ✓
Si algún check falla, REGENERA quitando piezas que rompan la regla, aunque devuelvas menos cantidad.`;
    },
    maxUses: 8,
  },
};

function extractJson(raw) {
  if (!raw) throw new Error('Respuesta vacía del modelo');
  let s = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const start = s.indexOf('{');
  if (start === -1) throw new Error('No se encontró JSON en la respuesta');
  s = s.slice(start);

  // Intento 1: parsear todo (a veces funciona)
  try { return JSON.parse(s); } catch (_) {}

  // Intento 2: buscar PRIMER cierre balanceado y parsear hasta ahí
  // (esto evita coger texto explicativo que viene tras el JSON)
  let depth = 0, inStr = false, esc = false, firstBalanced = -1;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\' && inStr) { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) { firstBalanced = i; break; }
    }
  }
  if (firstBalanced > 0) {
    try { return JSON.parse(s.slice(0, firstBalanced + 1)); } catch (_) {}
  }

  // Intento 3: JSON truncado (cortado a la mitad) - intentar reparar cerrando estructuras abiertas
  let repaired = s;
  // Si hay un texto trailing tras un } válido, recortar ahí
  if (firstBalanced > 0) {
    repaired = s.slice(0, firstBalanced + 1);
  }
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
  if (inS) repaired += '"';
  while (b-- > 0) repaired += ']';
  while (d-- > 0) repaired += '}';
  try { return JSON.parse(repaired); } catch (err) {
    throw new Error(`JSON truncado y no reparable: ${err.message}`);
  }
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

  // Calcular las DOS fechas ISO aceptadas (hoy y ayer respecto a la fecha de referencia)
  // Esto permite reglas estrictas de aceptación en el prompt.
  const allowedISODates = (() => {
    try {
      const parts = todayShort.split('/').map(p => parseInt(p, 10));
      // formato es-ES: D/M/YYYY o DD/MM/YYYY
      const [d, m, y] = parts;
      const ref = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      const yest = new Date(ref.getTime() - 24 * 60 * 60 * 1000);
      const iso = (dt) => dt.toISOString().slice(0, 10);
      return [iso(ref), iso(yest)];
    } catch (_) {
      return [];
    }
  })();

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
          content: cfg.user(todayShort, todayFull, nowTime, allowedISODates),
        }],
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      return res.status(upstream
