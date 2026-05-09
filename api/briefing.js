// Vercel serverless function (Node runtime)
// La API key NUNCA sale del servidor.
// Modelo: Claude Sonnet 4.6 con web_search (internacional, spainNews) o RSS pre-fetch (spainOpinion).

// ============ MÓDULO RSS PARA OPINIÓN ESPAÑA ============
// Para evitar limitaciones de web_search en Tier 1 (timeouts, indexación pobre),
// pre-fetcheamos los RSS de los 9 medios y pasamos la lista al modelo.

const SPAIN_OPINION_FEEDS = [
  // ============ FEEDS RSS DIRECTOS CONFIRMADOS ============
  { source: 'ABC', url: 'https://www.abc.es/rss/feeds/abc_opinioncompleto.xml' },
  { source: 'The Objective', url: 'https://theobjective.com/feed/' },
  { source: 'El País', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/opinion/portada' },
  { source: 'La Gaceta', url: 'https://gaceta.es/opinion/feed/' },

  // ============ GOOGLE NEWS RSS (fallback universal) ============
  // Google News tiene RSS para cualquier medio. Lo usamos para los que no exponen RSS propio
  // o lo tienen roto. Las fechas vienen siempre en RSS estándar parseable.
  { source: 'Vozpópuli', url: 'https://news.google.com/rss/search?q=site:vozpopuli.com+opinion+OR+columna&hl=es-ES&gl=ES&ceid=ES:es' },
  { source: 'El Español', url: 'https://news.google.com/rss/search?q=site:elespanol.com/opinion&hl=es-ES&gl=ES&ceid=ES:es' },
  { source: 'Libertad Digital', url: 'https://news.google.com/rss/search?q=site:libertaddigital.com+opinion&hl=es-ES&gl=ES&ceid=ES:es' },
  { source: 'El Debate', url: 'https://news.google.com/rss/search?q=site:eldebate.com/opinion&hl=es-ES&gl=ES&ceid=ES:es' },
  { source: 'elDiario.es', url: 'https://news.google.com/rss/search?q=site:eldiario.es/opinion&hl=es-ES&gl=ES&ceid=ES:es' },
];

async function fetchOneFeed(feed, timeoutMs = 8000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(feed.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
      },
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const xml = await res.text();
    return parseFeedItems(xml, feed.source);
  } catch (_err) {
    return []; // Resilient: si un feed falla, los demás siguen
  }
}

function parseFeedItems(xml, source) {
  const items = [];
  // RSS 2.0: <item>, Atom: <entry>
  const itemMatches = xml.match(/<item[^>]*>[\s\S]*?<\/item>/gi)
    || xml.match(/<entry[^>]*>[\s\S]*?<\/entry>/gi)
    || [];
  for (const itemXml of itemMatches) {
    const title = extractTagContent(itemXml, 'title');
    let link = extractTagContent(itemXml, 'link');
    if (!link) {
      const linkAttrMatch = itemXml.match(/<link[^>]+href="([^"]+)"/i);
      if (linkAttrMatch) link = linkAttrMatch[1];
    }
    const pubDate = extractTagContent(itemXml, 'pubDate')
      || extractTagContent(itemXml, 'published')
      || extractTagContent(itemXml, 'updated')
      || extractTagContent(itemXml, 'dc:date');
    const description = extractTagContent(itemXml, 'description')
      || extractTagContent(itemXml, 'summary')
      || extractTagContent(itemXml, 'content:encoded')
      || '';
    let author = extractTagContent(itemXml, 'dc:creator')
      || extractTagContent(itemXml, 'author');
    if (author && /<name>/i.test(author)) {
      author = extractTagContent(author, 'name');
    }
    if (title && link) {
      items.push({
        source,
        title: cleanText(title),
        url: cleanText(link),
        author: cleanText(author || ''),
        pubDate: cleanText(pubDate || ''),
        publishedDate: rfcToISODate(pubDate),
        description: cleanText(description).slice(0, 300),
      });
    }
  }
  return items;
}

function extractTagContent(xml, tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, 'i');
  const m = xml.match(re);
  return m ? m[1] : '';
}

function cleanText(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function rfcToISODate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(cleanText(dateStr));
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  } catch (_) { return ''; }
}

async function fetchSpainOpinionRss(allowedISODates) {
  const allItems = await Promise.all(SPAIN_OPINION_FEEDS.map(fetchOneFeed));
  const flat = allItems.flat();
  // Deduplicar por URL
  const seen = new Set();
  const dedup = flat.filter(item => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
  // Filtrar por fechas aceptadas
  const inDate = dedup.filter(it => {
    if (!allowedISODates || allowedISODates.length === 0) return true;
    return allowedISODates.includes(it.publishedDate);
  });
  // Limitar a 60 candidatos máximo (suficiente para que el modelo elija 10)
  return inDate.slice(0, 60);
}

// ============ FIN MÓDULO RSS ============

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
    user: (today, todayFull, requestTime, allowedDates) => {
      const dateList = (allowedDates && allowedDates.length === 2)
        ? `\n\nFECHAS ACEPTADAS (ÚNICAS DOS, sin excepción):\n- ${allowedDates[0]} (fecha de referencia)\n- ${allowedDates[1]} (día anterior)\n\nCualquier pieza con publishedDate distinto a estas dos fechas se RECHAZA. Sin "casi", sin "ayer extendido".`
        : '';
      return `FECHA: ${todayFull || today} (hora petición: ${requestTime})${dateList}

INTERNACIONAL. Hasta 24 piezas en 3 secciones.

REGLAS ESTRICTAS DE FECHA:
- publishedDate DEBE estar en una de las 2 fechas aceptadas. NUNCA más antiguas.
- Si encuentras pieza interesante de hace 2+ días: rechazar.

WORLDOPINION (PRIORITARIA, hasta 6 columnas firmadas):
- Máx 2 columnas mismo medio · Mín 4 medios distintos
- Solo firmadas (autor real, no editoriales)
- Solo medios internacionales no españoles
- Mejor 4 columnas variadas que 6 de 2 medios

Medios para opinión internacional: nytimes.com, ft.com, lemonde.fr, economist.com, theatlantic.com, foreignaffairs.com, project-syndicate.org, spectator.co.uk, washingtonpost.com, theguardian.com, wsj.com.
Búsqueda recomendada: site:nytimes.com/opinion ${today}, site:ft.com/opinion ${today}, etc.

WORLDNEWS (hasta 16 noticias):
- Equilibrio IZQ/DER · ≥4 regiones distintas (EEUU, Europa, Oriente Medio, Asia, África, LATAM, Australia)
- Eventos concretos del día (no análisis evergreen)
- Mejor 10 piezas reales que 16 mediocres

LEGAL (hasta 2 piezas):
- Sentencias o decisiones concretas del día
- Internacional (Law360, MLex, GCR) o España (El Derecho, Expansión Jurídico)

OUTPUT: solo JSON, sin texto antes ni después:
{"date":"DD/MM/YYYY","worldOpinion":[...],"worldNews":[...],"legal":[...]}`;
    },
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
      return `FECHA: ${todayFull || today} (hora petición: ${requestTime})${dateList}

OPINIÓN ESPAÑA. Hasta 10 columnas firmadas, publicadas en una de las 2 fechas aceptadas.

REGLAS:
- Máx 2 columnas mismo medio · Mín 4 medios distintos
- Solo firmadas (no editoriales sin autor)
- publishedDate dentro de fechas aceptadas (rechazar otras)
- Mejor 4 columnas variadas que 8 de 2 medios

MEDIOS (los únicos): abc.es, vozpopuli.com, theobjective.com, elespanol.com, libertaddigital.com, eldiario.es, elpais.com (+ almendron.com), gaceta.es, eldebate.com

BÚSQUEDA: usa site:medio.com/opinion para 4-5 medios distintos. Visita la página índice si search falla. Consulta COLUMNISTS_GUIDE para nombres por día.

OUTPUT: solo JSON, sin texto:
{"date":"DD/MM/YYYY","spainOpinion":[{"rank":1,"title":"...","summary":"...","author":"...","source":"...","url":"...","publishedDate":"YYYY-MM-DD"}]}`;
    },
    maxUses: 6,
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
  let d = 0, b = 0, inS = false, e = false
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

  // ============ FLUJO ESPECIAL RSS PARA spainOpinion ============
  // No usa web_search. Pre-fetcha los 9 RSS, filtra por fecha, pasa la lista al modelo.
  if (section === 'spainOpinion') {
    try {
      const candidates = await fetchSpainOpinionRss(allowedISODates);

      if (!candidates || candidates.length === 0) {
        return res.status(200).json({
          briefing: {
            date: todayShort,
            spainOpinion: [],
            _note: 'No se encontraron columnas en RSS para las fechas indicadas. Posibles causas: feeds caídos, sin contenido nuevo, o error temporal.',
          },
          section,
        });
        }
      
