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
  { source: 'Libertad Digital', url: 'https://www.libertaddigital.com/rss.xml' },
  { source: 'elDiario.es', url: 'https://www.eldiario.es/rss/' },
  { source: 'InfoLibre', url: 'https://www.infolibre.es/rss/' },
  { source: 'El Mundo', url: 'https://www.elmundo.es/rss/opinion.xml' },
  { source: 'OK Diario', url: 'https://www.okdiario.com/opinion/feed/' },
  { source: 'El Blog Salmón', url: 'https://www.elblogsalmon.com/feed' },

  // ============ GOOGLE NEWS RSS (fallback para los que no tienen autor en RSS directo o no tienen RSS) ============
  { source: 'Vozpópuli', url: 'https://news.google.com/rss/search?q=site:vozpopuli.com/opinion&hl=es-ES&gl=ES&ceid=ES:es' },
  { source: 'Vozpópuli', url: 'https://news.google.com/rss/search?q=site:vozpopuli.com/opinion+when:1d&hl=es-ES&gl=ES&ceid=ES:es' },
  { source: 'Artículo 14', url: 'https://news.google.com/rss/search?q=site:articulo14.es&hl=es-ES&gl=ES&ceid=ES:es' },
  { source: 'Agenda Pública', url: 'https://news.google.com/rss/search?q=site:agendapublica.es&hl=es-ES&gl=ES&ceid=ES:es' },
];

// ============ FEEDS RSS PARA NOTICIAS ESPAÑA ============
// Para noticias usamos los portadas/general de cada medio (no la sección opinion).
// Cubre eventos del día: política, economía, sociedad, sucesos.
const SPAIN_NEWS_FEEDS = [
  // RSS oficiales directos (los que tengan)
  { source: 'ABC', url: 'https://www.abc.es/rss/feeds/abc_PortadaCompleta.xml' },
  { source: 'El País', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada' },
  { source: 'The Objective', url: 'https://theobjective.com/feed/' },
  { source: 'La Gaceta', url: 'https://gaceta.es/feed/' },
  { source: 'Libertad Digital', url: 'https://www.libertaddigital.com/rss.xml' },
  { source: 'El Español', url: 'https://www.elespanol.com/rss' },
  { source: 'elDiario.es', url: 'https://www.eldiario.es/rss/' },
  { source: 'InfoLibre', url: 'https://www.infolibre.es/rss/' },
  { source: 'La Vanguardia', url: 'https://www.lavanguardia.com/mvc/feed/rss/home' },

  // BALEARES regional
  { source: 'OK Diario Baleares', url: 'https://okdiario.com/baleares/feed/' },
  { source: 'elDiario.es Baleares', url: 'https://www.eldiario.es/illes-balears/rss/' },

  // Google News RSS (fallback solo para medios sin RSS público fiable)
  { source: 'El Mundo', url: 'https://news.google.com/rss/search?q=site:elmundo.es&hl=es-ES&gl=ES&ceid=ES:es' },
  { source: 'Vozpópuli', url: 'https://news.google.com/rss/search?q=site:vozpopuli.com&hl=es-ES&gl=ES&ceid=ES:es' },
  { source: 'Vozpópuli', url: 'https://news.google.com/rss/search?q=site:vozpopuli.com+when:1d&hl=es-ES&gl=ES&ceid=ES:es' },
  { source: 'Invertia', url: 'https://news.google.com/rss/search?q=site:invertia.com+OR+site:elespanol.com/invertia&hl=es-ES&gl=ES&ceid=ES:es' },
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
  return fetchFeedsAndFilter(SPAIN_OPINION_FEEDS, allowedISODates);
}

async function fetchSpainNewsRss(allowedISODates) {
  return fetchFeedsAndFilter(SPAIN_NEWS_FEEDS, allowedISODates);
}

async function fetchFeedsAndFilter(feedList, allowedISODates) {
  // Para cada feed, fetchear y registrar diagnóstico
  const feedResults = await Promise.all(feedList.map(async (feed) => {
    const items = await fetchOneFeed(feed);
    return { source: feed.source, count: items.length, items };
  }));
  const flat = feedResults.flatMap(r => r.items);

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

  // CAP POR FUENTE PERSONALIZADO: más cuota para medios preferidos.
  // The Objective, El Español y Vozpópuli tienen prioridad — más candidatos
  // para que el modelo tenga muchas opciones de donde escoger.
  const PER_SOURCE_CAPS = {
    'Vozpópuli': 8,
    'Artículo 14': 8,
    'The Objective': 6,
    'InfoLibre': 6,
    'La Gaceta': 6,
    'Libertad Digital': 6,
    'Agenda Pública': 6,
    'elDiario.es': 6,
    'El Mundo': 6,
    'ABC': 6,
    'OK Diario': 6,
    'El Blog Salmón': 4,
    'La Vanguardia': 6,
    'OK Diario Baleares': 4,
    'elDiario.es Baleares': 4,
    'El País': 4,
    'El Español': 8,
  };
  const DEFAULT_CAP = 4;
  const perSourceCounts = {};
  const balanced = inDate.filter(item => {
    const cap = PER_SOURCE_CAPS[item.source] ?? DEFAULT_CAP;
    perSourceCounts[item.source] = perSourceCounts[item.source] || 0;
    if (perSourceCounts[item.source] >= cap) return false;
    perSourceCounts[item.source]++;
    return true;
  });

  // Diagnóstico: para los feeds que NO aportaron candidatos, decir si fallaron o si tenían fechas viejas
  const diagnostic = feedResults.map(r => {
    const passedDate = r.items.filter(it => allowedISODates.includes(it.publishedDate)).length;
    const latestDate = r.items.length > 0
      ? [...new Set(r.items.map(it => it.publishedDate).filter(Boolean))].sort().reverse()[0]
      : null;
    return {
      source: r.source,
      rawCount: r.count,
      passedDateFilter: passedDate,
      includedAfterCap: perSourceCounts[r.source] || 0,
      latestDateSeen: latestDate || 'sin fecha',
    };
  });

  return {
    candidates: balanced.slice(0, 80),
    diagnostic,
  };
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
    label: 'Internacional + Energía',
    system: `Eres mi editor de noticias personal de élite. Tu tarea es buscar en web noticias de las ÚLTIMAS 48H y devolver un briefing parcial MAL NEWS de hasta 28 piezas en 2 secciones internacionales. Las COLUMNAS DE OPINIÓN son la parte más valiosa del briefing — préstales atención prioritaria. Es preferible devolver menos piezas frescas y verificadas que rellenar con análisis genérico.

${RULES_BASE}

ESQUEMA JSON EXACTO (devuelve SOLO estas 2 claves, NO incluyas energy, spainNews, spainOpinion ni legal):
{
  "date": "DD/MM/YYYY",
  "worldOpinion": [
    /* HASTA 8 piezas — PRIORITARIAS. Columnas firmadas publicadas en últimas 48h con un evento concreto detrás (no análisis evergreen). Solo medios internacionales no españoles. Distribuye entre IZQ y DER. */
    {"rank": 1, "title": "...", "summary": "...", "author": "...", "source": "NYT|FT|Le Monde|Economist|...", "lean": "left|right", "url": "https://...", "publishedDate": "2026-05-07"}
  ],
  "worldNews": [
    /* HASTA 20 piezas, pero menos si no hay tantas frescas. Equilibrio left/right.
       Cobertura: EEUU, UK, Europa Occ., Europa Este, Oriente Medio, India, Asia, África, LATAM, Australia, Rusia, Turquía.
       INCLUYE PIEZAS JURÍDICAS RELEVANTES cuando haya: sentencias internacionales del día (Tribunal Penal Internacional, CIJ, TJUE, Supreme Court USA, etc.), decisiones regulatorias (CE, FTC, antitrust), o cambios jurisprudenciales significativos. Marca region como la del tribunal o país de la sentencia. */
    {"rank": 1, "title": "...", "summary": "2-3 frases con dato/nombre/cifra concreta", "source": "BBC|Reuters|...", "region": "EEUU|UK|Europa Occ.|Europa Este|Oriente Medio|India|Asia|África|LATAM|Australia|Rusia|Turquía", "lean": "left", "url": "https://...", "publishedDate": "2026-05-07"}
  ]
}

${COLUMNISTS_GUIDE}`,
    user: (today, todayFull, requestTime, allowedDates) => {
      const dateList = (allowedDates && allowedDates.length === 3)
        ? `\n\nFECHAS ACEPTADAS (ÚNICAS TRES, sin excepción):\n- ${allowedDates[0]} (fecha de referencia)\n- ${allowedDates[1]} (día anterior)\n- ${allowedDates[2]} (hace 2 días)\n\nCualquier pieza con publishedDate distinto a estas tres fechas se RECHAZA. Sin "casi", sin "ayer extendido".`
        : '';
      return `FECHA: ${todayFull || today} (hora petición: ${requestTime})${dateList}

INTERNACIONAL. Hasta 28 piezas en 2 secciones, distribuidas por regiones para cobertura global plural.

REGLAS ESTRICTAS DE FECHA:
- publishedDate DEBE estar en una de las 3 fechas aceptadas. NUNCA más antiguas.
- Si encuentras pieza interesante de hace 2+ días: rechazar.

WORLDOPINION (PRIORITARIA, hasta 8 columnas firmadas):
- HARD CAPS: Máx 3 columnas USA · Máx 2 columnas UK · Máx 2 columnas mismo medio
- MÍNIMO 2 columnas de fuera del eje anglo (USA/UK): de Europa, LATAM, India, Asia, OM, África o Rusia
- Mín 5 medios distintos · ≥3 regiones distintas
- Solo firmadas (autor real, no editoriales)
- Solo medios internacionales no españoles
- Distribuye entre izquierda, centro y derecha
- Si una región no tiene columna fresca firmada, DÉJALA SIN cubrir (NO sustituyas con anglo extra)

WORLDNEWS (hasta 20 noticias):
- HARD CAPS: Máx 6 piezas USA · Máx 4 piezas UK · Máx 3 piezas mismo medio
- MÍNIMOS GARANTIZADOS por región (si hay material fresco del día):
  · 🇪🇺 Europa Occidental (FR/DE/IT): MÍNIMO 2
  · 🌍 Europa Este (Ucrania/Polonia): MÍNIMO 1
  · 🕌 Oriente Medio (Israel/Mundo árabe): MÍNIMO 2
  · 🇮🇳🌏 Asia (India + Asia Este/SE): MÍNIMO 2
  · 🌎 LATAM (Argentina/México/Brasil/Colombia): MÍNIMO 2
  · 🌍 África (Sudáfrica): MÍNIMO 1
  · 🇷🇺 Rusia: MÍNIMO 1
  · 🇦🇺 Australia / 🇹🇷 Turquía: opcionales, priorizar si hay material relevante
- Total mínimos: ~11 piezas garantizadas globalmente, 9 piezas flexibles
- Si una región NO tiene material fresco real, deja el slot vacío (PROHIBIDO rellenar con USA/UK extras o inventar piezas)
- Equilibrio IZQ/DER
- Eventos concretos del día (no análisis evergreen)
- Mejor 16 piezas reales y distribuidas que 20 todas anglo
- LEGAL EMBEBIDO: si hay sentencias internacionales relevantes del día (TJUE, CIJ, TPI, Supreme Court USA, antitrust CE/FTC, etc.), inclúyelas como pieza más en worldNews con la región del tribunal. Busca en: site:law360.com, site:mlex.com, site:reuters.com/legal, site:bloomberg.com/law

⭐ MEDIOS PRIORIZADOS POR REGIÓN (28 medios con cobertura global plural):

🇺🇸 EEUU (5):
- nytimes.com (centro-izq) · washingtonpost.com (centro-izq) · theatlantic.com (centro-izq)
- wsj.com (centro-der financiero) · nationalreview.com (derecha intelectual)

🇬🇧 UK (3):
- ft.com (centro financiero) · economist.com (centro liberal) · theguardian.com (izquierda)

🇪🇺 EUROPA OCCIDENTAL (3):
- lefigaro.fr (centro-der) · lemonde.fr (centro-izq) · faz.net (centro-der alemán)

🌍 EUROPA ESTE (2):
- kyivindependent.com (pro-occidental, guerra Ucrania) · wyborcza.pl (centro-izq polaco)

🇮🇱 ISRAEL (1):
- haaretz.com (izquierda)

🇮🇳 INDIA (1):
- thehindu.com (centro-izq intelectual)

🌏 ASIA ESTE/SE (3):
- asia.nikkei.com (financiero Japón) · scmp.com (Hong Kong) · straitstimes.com (Singapur centrista)

🌎 LATAM (4):
- clarin.com (Argentina centro-der) · jornada.com.mx (México izquierda)
- folha.uol.com.br (Brasil centro) · elespectador.com (Colombia centro-izq)

🇷🇺 RUSIA (1):
- themoscowtimes.com (independiente en exilio)

🌐 MULTILATERAL (1):
- project-syndicate.org (columnistas globales)

🌍 ÁFRICA (1):
- dailymaverick.co.za (Sudáfrica investigativo)

🕌 MUNDO ÁRABE (1):
- thenationalnews.com (Emiratos establishment Golfo)

🇦🇺 AUSTRALIA (1):
- theaustralian.com.au (centro-der, Murdoch)

🇹🇷 TURQUÍA (1):
- hurriyetdailynews.com (centrista, semi-establishment)

Búsqueda recomendada: site:[dominio]/opinion ${today} para columnas firmadas, site:[dominio] ${today} para noticia general.

OUTPUT: solo JSON, sin texto antes ni después:
{"date":"DD/MM/YYYY","worldOpinion":[...],"worldNews":[...]}`;
    },
    maxUses: 20,
  },
  spainNews: {
    label: 'Noticias España',
    system: `Eres mi editor de noticias personal de élite. Tu tarea es buscar en web noticias de España publicadas en las ÚLTIMAS 48H y devolver hasta 15 piezas con eventos concretos del día.

${RULES_BASE}

ESQUEMA JSON EXACTO (devuelve SOLO esta clave, NO incluyas opinión ni nada más):
{
  "date": "DD/MM/YYYY",
  "spainNews": [
    /* HASTA 15 piezas con evento concreto del día (votación, declaración, sentencia, dato económico, suceso).
       Fuentes: Vozpópuli, The Objective, Libertad Digital, VilaWeb, El Diario, El Debate, Artículo 14, Agenda Pública, El Confidencial, ABC, El País, El Mundo, La Razón. */
    {"rank": 1, "title": "...", "summary": "...", "source": "...", "url": "...", "publishedDate": "2026-05-07"}
  ]
}`,
    user: (today, todayFull, requestTime) => `FECHA DE REFERENCIA: ${todayFull || today}
HORA ACTUAL DE LA PETICIÓN: ${requestTime}

Genera SOLO la parte de NOTICIAS de España (sin opinión) del briefing MAL NEWS con piezas publicadas EN la fecha de referencia (priorizando) o el día anterior:
- HASTA 15 noticias España con eventos concretos (votaciones, sentencias, datos económicos, declaraciones políticas, sucesos)

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
      const dateList = (allowedDates && allowedDates.length === 3)
        ? `\n\nFECHAS ACEPTADAS (ÚNICAS TRES, sin excepción):\n- ${allowedDates[0]} (fecha de referencia)\n- ${allowedDates[1]} (día anterior)\n- ${allowedDates[2]} (hace 2 días)\n\nCualquier columna con publishedDate distinto a estas tres fechas se RECHAZA. Sin excepción. Sin "casi". Sin "del fin de semana".`
        : '';
      return `FECHA: ${todayFull || today} (hora petición: ${requestTime})${dateList}

OPINIÓN ESPAÑA. Hasta 10 columnas firmadas, publicadas en una de las 3 fechas aceptadas.

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

  // Calcular las TRES fechas ISO aceptadas (hoy, ayer, anteayer) respecto a la fecha de referencia.
  // 3 días es mejor que 2 para weekends/festivos cuando hay menos contenido fresco.
  const allowedISODates = (() => {
    try {
      const parts = todayShort.split('/').map(p => parseInt(p, 10));
      const [d, m, y] = parts;
      const ref = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      const yest = new Date(ref.getTime() - 24 * 60 * 60 * 1000);
      const beforeYest = new Date(ref.getTime() - 48 * 60 * 60 * 1000);
      const iso = (dt) => dt.toISOString().slice(0, 10);
      return [iso(ref), iso(yest), iso(beforeYest)];
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
    let currentStep = 'init';
    try {
      currentStep = 'fetch-rss';
      const { candidates, diagnostic } = await fetchSpainOpinionRss(allowedISODates);

      if (!candidates || candidates.length === 0) {
        // Diagnóstico detallado: qué devolvió cada feed
        const detail = diagnostic.map(d =>
          `${d.source}: ${d.rawCount} items, ${d.passedDateFilter} en fecha (última: ${d.latestDateSeen})`
        ).join(' | ');
        return res.status(200).json({
          briefing: {
            date: todayShort,
            spainOpinion: [],
            _note: `Sin candidatos. Fechas permitidas: ${allowedISODates.join(', ')}. Detalle por feed: ${detail}`,
            _meta: { allowedDates: allowedISODates, feedDiagnostic: diagnostic },
          },
          section,
        });
      }

      currentStep = 'build-prompt';
      const candidatesText = candidates.map((c, i) =>
        `[${i + 1}] ${c.source} | ${c.publishedDate || 'fecha?'} | ${c.author || 'sin autor'} | ${c.title}\n   URL: ${c.url}\n   Resumen: ${c.description.slice(0, 200)}`
      ).join('\n\n');

      const userPrompt = `FECHA: ${todayFull || todayShort}

Tienes a continuación una lista de ${candidates.length} piezas de medios españoles (mayoritariamente opinión, algunas noticias o análisis), ya filtradas por fecha (publicadas en una de las 3 fechas aceptadas: ${allowedISODates.join(' o ')}).

⚠️ PROHIBIDO ABSOLUTAMENTE devolver un array spainOpinion vacío. Si tienes dudas, INCLUYE. Mejor pasarse de inclusivo que de restrictivo.

⭐ MEDIOS PREFERIDOS DEL USUARIO (orden de prioridad, prioriza los primeros):
1. Vozpópuli ⭐
2. Artículo 14 ⭐
3. The Objective
4. InfoLibre
5. La Gaceta
6. Libertad Digital
7. elDiario.es
Si hay candidatas válidas de estos medios, INCLÚYELAS en este orden de preferencia hasta el cap de cada uno.

REGLAS DE SELECCIÓN (en orden de prioridad):
1. PROHIBIDO array vacío. Si hay piezas con autor, selecciona mínimo 3-4. Si las piezas no tienen autor pero la URL contiene "/opinion/" "/comentario/" "/tribuna/" "/blog/" "/elsubjetivo/" o similar, también CUENTAN como columna válida. EXCEPCIÓN: items con source "Agenda Pública" o "Artículo 14" pueden incluirse aunque no aparezca autor (Google News no expone el autor, pero los artículos originales son análisis firmados de calidad).
2. HARD CAPS INVIOLABLES por medio (NO se pueden superar):
   - Vozpópuli: MÁX 4 columnas (MÍNIMO 2 obligatorias si hay candidatos) ⭐
   - Artículo 14: MÁX 4 columnas ⭐
   - The Objective: MÁX 3 columnas
   - InfoLibre: MÁX 3 columnas (MÍNIMO 2 obligatorias si hay ≥2 candidatos)
   - La Gaceta: MÁX 3 columnas
   - Libertad Digital: MÁX 3 columnas
   - Agenda Pública: MÁX 2 columnas (MÍNIMO 1 obligatorio si hay candidatos)
   - elDiario.es: MÁX 3 columnas (MÍNIMO 2 obligatorias si hay ≥2 candidatos)
   - El País: MÁX 2 columnas (MÍNIMO 1 obligatorio si hay candidatos)
   - El Mundo: MÁX 2 columnas
   - ABC: MÁX 2 columnas
   - OK Diario: MÁX 2 columnas
   - El Blog Salmón: MÁX 2 columnas (análisis económico divulgativo)
2.bis MÍNIMOS OBLIGATORIOS:
- Si en CANDIDATAS aparece al menos 2 items con source "Vozpópuli", DEBES incluir mínimo 2 columnas suyas.
- Si aparece al menos 2 items con source "elDiario.es", DEBES incluir mínimo 2 columnas de elDiario.es.
- Si aparece al menos 2 items con source "InfoLibre", DEBES incluir mínimo 2 columnas de InfoLibre.
- Si aparece al menos 1 item con source "Agenda Pública" o "El País", DEBES incluir mínimo 1 columna de cada uno.
No es opcional. Estos medios tienen presencia garantizada cuando haya material.
3. Selecciona HASTA 16 columnas en total.
4. MÍNIMO 4 medios distintos en el resultado.
5. PREFIERE: piezas con autor real (descartar solo "Redacción anónima" o "Editorial sin firma").
6. Prioriza diversidad ideológica/temática entre medios.

EJEMPLO DE DISTRIBUCIÓN IDEAL si hay corpus suficiente:
- Vozpópuli: 4 (preferido #1, tope)
- Artículo 14: 3 (preferido #2)
- The Objective: 2 (preferido #3)
- InfoLibre: 2 (preferido #4, mínimo 1)
- La Gaceta: 2 (preferido #5)
- Libertad Digital: 2 (preferido #6)
- elDiario.es: 1 (preferido #7, mínimo 1)
- Agenda Pública: 1 (mínimo)
- El País: 1 (mínimo)
- Total: 18 → ajusta a 16 según calidad

Si un medio preferido no tiene candidatas, completa con los siguientes en orden de preferencia (después la lista de 7 preferidos, viene El Mundo, ABC y El País).

Para cada columna seleccionada, escribe un "summary" propio de 2 frases (no copies el resumen del feed, redáctalo tú).

CANDIDATAS:
${candidatesText}

OUTPUT: SOLO JSON válido, sin markdown, sin texto antes ni después. RECUERDA: NO ARRAY VACÍO, PREFERIDOS PRIMERO.
{"date":"${todayShort}","spainOpinion":[{"rank":1,"title":"...","summary":"...","author":"...","source":"...","url":"...","publishedDate":"YYYY-MM-DD"}]}`;

      currentStep = 'call-anthropic';
      const upstream = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 8500,
          messages: [{ role: 'user', content: userPrompt }],
          // SIN tools: el modelo ya tiene la lista, solo filtra y selecciona
        }),
      });

      if (!upstream.ok) {
        const errText = await upstream.text();
        return res.status(upstream.status).json({
          error: `Anthropic API error (${upstream.status}): ${errText.slice(0, 500)}`,
          step: 'anthropic-response',
          candidatesFound: candidates.length,
        });
      }

      currentStep = 'parse-response';
      const data = await upstream.json();
      if (data.error) {
        return res.status(500).json({
          error: data.error.message || 'Error de la API',
          step: 'anthropic-data',
          candidatesFound: candidates.length,
        });
      }

      currentStep = 'extract-json';
      const text = (data.content || [])
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('');

      const briefing = extractJson(text);
      // Añadir info diagnóstica útil
      if (briefing && typeof briefing === 'object') {
        const selectedCount = (briefing.spainOpinion || []).length;
        const sourceCounts = candidates.reduce((acc, c) => {
          acc[c.source] = (acc[c.source] || 0) + 1;
          return acc;
        }, {});
        briefing._meta = {
          totalCandidates: candidates.length,
          selectedCount,
          mediumsAvailable: [...new Set(candidates.map(c => c.source))].length,
          candidatesPerSource: sourceCounts,
        };
        // Si el modelo IGNORÓ la regla "NUNCA vacío", añadir diagnóstico crítico
        if (selectedCount === 0 && candidates.length > 0) {
          briefing._note = `⚠️ El modelo recibió ${candidates.length} candidatos de ${briefing._meta.mediumsAvailable} medios pero seleccionó 0. Posible filtro excesivo. Detalle: ${JSON.stringify(sourceCounts)}`;
        }
      } else {
        // El modelo no devolvió JSON válido — devolvemos diagnóstico
        return res.status(500).json({
          error: 'El modelo no devolvió JSON parseable',
          step: 'extract-json',
          candidatesFound: candidates.length,
          rawTextSample: text.slice(0, 300),
        });
      }
      return res.status(200).json({ briefing, section });
    } catch (err) {
      return res.status(500).json({
        error: `Error en paso "${currentStep}": ${err.message || 'desconocido'}`,
        step: currentStep,
      });
    }
  }
  // ============ FIN FLUJO RSS spainOpinion ============

  // ============ FLUJO ESPECIAL RSS PARA spainNews ============
  // Igual que spainOpinion: pre-fetch RSS de portadas + Google News, sin web_search.
  if (section === 'spainNews') {
    try {
      const { candidates, diagnostic } = await fetchSpainNewsRss(allowedISODates);

      if (!candidates || candidates.length === 0) {
        const detail = diagnostic.map(d =>
          `${d.source}: ${d.rawCount} items, ${d.passedDateFilter} en fecha (última: ${d.latestDateSeen})`
        ).join(' | ');
        return res.status(200).json({
          briefing: {
            date: todayShort,
            spainNews: [],
            _note: `Sin candidatos. Fechas permitidas: ${allowedISODates.join(', ')}. Detalle por feed: ${detail}`,
            _meta: { allowedDates: allowedISODates, feedDiagnostic: diagnostic },
          },
          section,
        });
      }

      const candidatesText = candidates.map((c, i) =>
        `[${i + 1}] ${c.source} | ${c.publishedDate || 'fecha?'} | ${c.title}\n   URL: ${c.url}\n   Resumen: ${c.description.slice(0, 200)}`
      ).join('\n\n');

      const userPrompt = `FECHA: ${todayFull || todayShort}

Tienes a continuación una lista de ${candidates.length} noticias de medios españoles, ya filtradas por fecha (publicadas en una de las 3 fechas aceptadas: ${allowedISODates.join(' o ')}).

REGLAS DE SELECCIÓN (en orden de prioridad):
1. CRÍTICO: NUNCA devuelvas array vacío si hay al menos UNA noticia relevante en la lista. Mejor 3 noticias que 0.
2. Selecciona HASTA 15 noticias (puedes devolver menos si la lista es corta).
3. PRIORIZA eventos concretos del día: votaciones, sentencias, declaraciones políticas, datos económicos, sucesos, decisiones gubernamentales, anuncios oficiales, hechos relevantes.
4. DESCARTA: análisis genéricos, columnas de opinión, contenido evergreen sin actualidad.
5. IDEAL si hay corpus suficiente: MÁX 3 noticias mismo medio, MÍN 5 medios distintos.
6. ACEPTABLE si corpus limitado: hasta 3 noticias mismo medio, mín 3 medios distintos.
7. PLURALIDAD: prioriza incluir al menos 1 noticia de El País o elDiario.es o InfoLibre (voces izquierda), y al menos 1 de La Vanguardia (perspectiva catalana) si hay material relevante.
7.bis BALEARES OBLIGATORIO: si en CANDIDATAS aparece al menos 1 item con source "OK Diario Baleares" o "elDiario.es Baleares", DEBES incluir 1 noticia de Baleares. No es opcional cuando hay material.
8. Equilibrio temático: política, economía, sociedad, sucesos.
9. Mejor pocas noticias relevantes que ninguna por intentar cumplir reglas estrictas.

Para cada noticia seleccionada, escribe un "summary" propio de 2 frases (no copies el resumen del feed, redáctalo tú con voz neutral periodística que cuente el QUÉ y el CONTEXTO).

CANDIDATAS:
${candidatesText}

OUTPUT: SOLO JSON válido, sin markdown, sin texto antes ni después:
{"date":"${todayShort}","spainNews":[{"rank":1,"title":"...","summary":"...","source":"...","url":"...","publishedDate":"YYYY-MM-DD"}]}`;

      const upstream = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 4000,
          messages: [{ role: 'user', content: userPrompt }],
          // SIN tools: el modelo ya tiene la lista, solo filtra y selecciona
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
      if (briefing && typeof briefing === 'object') {
        briefing._meta = {
          totalCandidates: candidates.length,
          selectedCount: (briefing.spainNews || []).length,
          mediumsAvailable: [...new Set(candidates.map(c => c.source))].length,
        };
      }
      return res.status(200).json({ briefing, section });
    } catch (err) {
      return res.status(500).json({
        error: `Error en flujo RSS spainNews: ${err.message || 'desconocido'}`,
      });
    }
  }
  // ============ FIN FLUJO RSS spainNews ============

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
