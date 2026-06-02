// Vercel serverless function (Node runtime)
// La API key NUNCA sale del servidor.
// Modelo: Claude Sonnet 4.6 con web_search (internacional, spainNews) o RSS pre-fetch (spainOpinion).

// ============ MÓDULO RSS PARA OPINIÓN ESPAÑA ============
// Para evitar limitaciones de web_search en Tier 2 (timeouts, indexación pobre),
// pre-fetcheamos los RSS de los 9 medios y pasamos la lista al modelo.

const SPAIN_OPINION_FEEDS = [
  // ============ FEEDS RSS DIRECTOS CONFIRMADOS ============
  // ABC eliminado por preferencia del usuario

  // The Objective - múltiples URLs (A) + autores VIP (D)
  { source: 'The Objective', url: 'https://theobjective.com/feed/', tier: 'main' },
  { source: 'The Objective', url: 'https://theobjective.com/elsubjetivo/feed/', tier: 'section' },
  { source: 'The Objective', url: 'https://theobjective.com/category/opinion/feed/', tier: 'category' },
  // VIP autores The Objective (D)
  { source: 'The Objective', url: 'https://theobjective.com/autor/juan-luis-cebrian/feed/', tier: 'vip:Cebrián' },
  { source: 'The Objective', url: 'https://theobjective.com/autor/pablo-de-lora/feed/', tier: 'vip:de Lora' },
  { source: 'The Objective', url: 'https://theobjective.com/autor/javier-benegas/feed/', tier: 'vip:Benegas' },
  { source: 'The Objective', url: 'https://theobjective.com/autor/guadalupe-sanchez/feed/', tier: 'vip:G.Sánchez' },
  { source: 'The Objective', url: 'https://theobjective.com/autor/maite-rico/feed/', tier: 'vip:M.Rico' },
  { source: 'The Objective', url: 'https://theobjective.com/autor/pablo-cambronero/feed/', tier: 'vip:Cambronero' },

  { source: 'El País', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/opinion/portada', tier: 'main' },
  { source: 'El País', url: 'https://elpais.com/autor/estefania-molina/a/rss/', tier: 'vip:E.Molina' },
  { source: 'El País', url: 'https://elpais.com/autor/diego-sebastian-garrocho-salcedo/a/rss/', tier: 'vip:Garrocho' },
  { source: 'El País', url: 'https://elpais.com/autor/lluis-bassets/a/rss/', tier: 'vip:Bassets' },
  { source: 'El País', url: 'https://elpais.com/autor/ana-iris-simon/a/rss/', tier: 'vip:A.I.Simón' },
  { source: 'El País', url: 'https://elpais.com/autor/angeles-caballero/a/rss/', tier: 'vip:Á.Caballero' },
  { source: 'El País', url: 'https://elpais.com/autor/daniel-gascon/a/rss/', tier: 'vip:D.Gascón' },

  // La Gaceta - 2 URLs (A)
  { source: 'La Gaceta', url: 'https://gaceta.es/opinion/feed/', tier: 'main' },
  { source: 'La Gaceta', url: 'https://gaceta.es/feed/', tier: 'alt' },

  { source: 'Libertad Digital', url: 'https://www.libertaddigital.com/rss.xml', tier: 'main' },
  { source: 'elDiario.es', url: 'https://www.eldiario.es/rss/', tier: 'main' },
  { source: 'El Mundo', url: 'https://www.elmundo.es/rss/opinion.xml', tier: 'main' },
  { source: 'OK Diario', url: 'https://www.okdiario.com/opinion/feed/', tier: 'main' },
  { source: 'OK Diario', url: 'https://okdiario.com/autor/graciano-palomo/feed/', tier: 'vip:G.Palomo' },
  { source: 'El Blog Salmón', url: 'https://www.elblogsalmon.com/feed', tier: 'main' },
  { source: 'El Blog Salmón', url: 'https://www.elblogsalmon.com/rss2.xml', tier: 'rss2' },
  { source: 'El Blog Salmón', url: 'https://feeds.weblogssl.com/elblogsalmon', tier: 'weblogssl' },

  // 📰 IZQUIERDA - voces alternativas (gratis)
  { source: 'Huffington Post', url: 'https://www.huffingtonpost.es/seccion/opinion/feed/', tier: 'main' },
  { source: 'Huffington Post', url: 'https://news.google.com/rss/search?q=site:huffingtonpost.es&hl=es-ES&gl=ES&ceid=ES:es', tier: 'gn-main' },
  { source: 'Huffington Post', url: 'https://news.google.com/rss/search?q=site:huffingtonpost.es/opinion&hl=es-ES&gl=ES&ceid=ES:es', tier: 'gn-fallback' },
  { source: 'Público', url: 'https://www.publico.es/opinion/rss', tier: 'main' },
  { source: 'Público', url: 'https://blogs.publico.es/feed/', tier: 'blogs' },
  { source: 'Público', url: 'https://news.google.com/rss/search?q=site:publico.es/opinion&hl=es-ES&gl=ES&ceid=ES:es', tier: 'gn-fallback' },

  // 📰 ETHIC - revista intelectual / filosofía / sociedad (gratis)
  { source: 'Ethic', url: 'https://ethic.es/feed/', tier: 'main' },
  { source: 'Ethic', url: 'https://www.ethic.es/feed/', tier: 'alt' },
  { source: 'Ethic', url: 'https://news.google.com/rss/search?q=site:ethic.es&hl=es-ES&gl=ES&ceid=ES:es', tier: 'gn-fallback' },

  // 📰 LETRAS LIBRES - revista cultural intelectual (gratis)
  { source: 'Letras Libres', url: 'https://letraslibres.com/feed/', tier: 'main' },
  { source: 'Letras Libres', url: 'https://letraslibres.com/rss/', tier: 'alt' },
  { source: 'Letras Libres', url: 'https://news.google.com/rss/search?q=site:letraslibres.com&hl=es-ES&gl=ES&ceid=ES:es', tier: 'gn-fallback' },

  // El Debate - varias URLs alternativas (A)
  { source: 'El Debate', url: 'https://www.eldebate.com/opinion/feed/', tier: 'opinion' },
  { source: 'El Debate', url: 'https://news.google.com/rss/search?q=site:eldebate.com/opinion&hl=es-ES&gl=ES&ceid=ES:es', tier: 'google-news' },

  // El Español: eliminado de opinion (queda solo en spainNews)

  // ============ GOOGLE NEWS RSS (fallback para los que no tienen autor en RSS directo) ============
  { source: 'Vozpópuli', url: 'https://news.google.com/rss/search?q=site:vozpopuli.com/opinion&hl=es-ES&gl=ES&ceid=ES:es', tier: 'main' },
  { source: 'Vozpópuli', url: 'https://news.google.com/rss/search?q=site:vozpopuli.com/opinion+when:1d&hl=es-ES&gl=ES&ceid=ES:es', tier: 'recent' },
  // VIP columnistas Vozpópuli (búsqueda por autor · garantiza que sus columnas aparezcan)
  { source: 'Vozpópuli', url: 'https://news.google.com/rss/search?q=site:vozpopuli.com+%22Gorka+Maneiro%22&hl=es-ES&gl=ES&ceid=ES:es', tier: 'vip:Maneiro' },
  { source: 'Vozpópuli', url: 'https://news.google.com/rss/search?q=site:vozpopuli.com+%22Manuel+Mar%C3%ADn%22&hl=es-ES&gl=ES&ceid=ES:es', tier: 'vip:M.Marín' },
  { source: 'Vozpópuli', url: 'https://news.google.com/rss/search?q=site:vozpopuli.com+%22Jes%C3%BAs+Cacho%22&hl=es-ES&gl=ES&ceid=ES:es', tier: 'vip:Cacho' },
  { source: 'Vozpópuli', url: 'https://news.google.com/rss/search?q=site:vozpopuli.com+%22Rub%C3%A9n+Manso%22&hl=es-ES&gl=ES&ceid=ES:es', tier: 'vip:Manso' },
  { source: 'Vozpópuli', url: 'https://news.google.com/rss/search?q=site:vozpopuli.com+%22Agust%C3%ADn+Valladolid%22&hl=es-ES&gl=ES&ceid=ES:es', tier: 'vip:Valladolid' },
  { source: 'Vozpópuli', url: 'https://news.google.com/rss/search?q=site:vozpopuli.com+%22Mart%C3%ADnez+Gorriar%C3%A1n%22&hl=es-ES&gl=ES&ceid=ES:es', tier: 'vip:Gorriarán' },
  { source: 'Vozpópuli', url: 'https://news.google.com/rss/search?q=site:vozpopuli.com+%22Pablo+Sebasti%C3%A1n%22&hl=es-ES&gl=ES&ceid=ES:es', tier: 'vip:P.Sebastián' },
  { source: 'Vozpópuli', url: 'https://news.google.com/rss/search?q=site:vozpopuli.com+%22Jos%C3%A9+Antonio+Montano%22&hl=es-ES&gl=ES&ceid=ES:es', tier: 'vip:Montano' },
  { source: 'Artículo 14', url: 'https://news.google.com/rss/search?q=site:articulo14.es&hl=es-ES&gl=ES&ceid=ES:es', tier: 'main' },
  { source: 'Agenda Pública', url: 'https://news.google.com/rss/search?q=site:agendapublica.es&hl=es-ES&gl=ES&ceid=ES:es', tier: 'main' },

  // Económico / regional con opinión incluida
  { source: 'Economía de Mallorca', url: 'https://news.google.com/rss/search?q=site:economiademallorca.com/opinion&hl=es-ES&gl=ES&ceid=ES:es', tier: 'opinion' },
  { source: 'Crónica Global', url: 'https://cronicaglobal.elespanol.com/opinion/rss', tier: 'main' },
  { source: 'Crónica Global', url: 'https://news.google.com/rss/search?q=site:cronicaglobal.elespanol.com/opinion&hl=es-ES&gl=ES&ceid=ES:es', tier: 'main' },
];

// ============ FEEDS RSS PARA NOTICIAS ESPAÑA ============
// Para noticias usamos los portadas/general de cada medio (no la sección opinion).
// Cubre eventos del día: política, economía, sociedad, sucesos.
const SPAIN_NEWS_FEEDS = [
  // RSS oficiales directos (los que tengan)
  // ABC - múltiples URLs y Google News fallback
  { source: 'ABC', url: 'https://www.abc.es/rss/feeds/abc_PortadaCompleta.xml' },
  { source: 'ABC', url: 'https://www.abc.es/rss/feeds/abcPortada.xml' },
  { source: 'ABC', url: 'https://www.abc.es/rss/feeds/abc_ultima.xml' },
  { source: 'ABC', url: 'https://www.abc.es/rss/feeds/abc_espana.xml' },
  { source: 'ABC', url: 'https://news.google.com/rss/search?q=site:abc.es&hl=es-ES&gl=ES&ceid=ES:es' },
  { source: 'El País', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada' },
  { source: 'The Objective', url: 'https://theobjective.com/feed/' },
  { source: 'La Gaceta', url: 'https://gaceta.es/feed/' },
  { source: 'Libertad Digital', url: 'https://www.libertaddigital.com/rss.xml' },
  { source: 'El Español', url: 'https://www.elespanol.com/rss' },
  // OK Diario general (no solo Baleares)
  { source: 'OK Diario', url: 'https://okdiario.com/feed/' },
  { source: 'OK Diario', url: 'https://news.google.com/rss/search?q=site:okdiario.com&hl=es-ES&gl=ES&ceid=ES:es' },
  // El Debate general (no solo Baleares)
  { source: 'El Debate', url: 'https://news.google.com/rss/search?q=site:eldebate.com&hl=es-ES&gl=ES&ceid=ES:es' },
  { source: 'elDiario.es', url: 'https://www.eldiario.es/rss/' },
  // 📰 IZQUIERDA alternativa (gratis) - mismos sesgos
  { source: 'Huffington Post', url: 'https://news.google.com/rss/search?q=site:huffingtonpost.es&hl=es-ES&gl=ES&ceid=ES:es' },
  { source: 'Público', url: 'https://news.google.com/rss/search?q=site:publico.es&hl=es-ES&gl=ES&ceid=ES:es' },
  // El Nacional.cat - catalán independentista, gratis
  { source: 'El Nacional.cat', url: 'https://www.elnacional.cat/es/rss' },
  { source: 'El Nacional.cat', url: 'https://www.elnacional.cat/ca/rss' },
  { source: 'El Nacional.cat', url: 'https://www.elnacional.cat/es/feed' },
  { source: 'El Nacional.cat', url: 'https://news.google.com/rss/search?q=site:elnacional.cat&hl=es-ES&gl=ES&ceid=ES:es' },
  { source: 'Crónica Global', url: 'https://cronicaglobal.elespanol.com/rss' },

  // Demócrata - WordPress feed + Google News fallback
  { source: 'Demócrata', url: 'https://news.google.com/rss/search?q=site:democrata.es&hl=es-ES&gl=ES&ceid=ES:es' },

  // BALEARES regional
  { source: 'OK Diario Baleares', url: 'https://okdiario.com/baleares/feed/' },
  // elDiario.es Baleares - múltiples URLs
  { source: 'elDiario.es Baleares', url: 'https://news.google.com/rss/search?q=site:eldiario.es/illes-balears&hl=es-ES&gl=ES&ceid=ES:es' },
  // El Debate Baleares
  { source: 'El Debate Baleares', url: 'https://news.google.com/rss/search?q=site:eldebate.com/baleares&hl=es-ES&gl=ES&ceid=ES:es' },
  { source: 'Economía de Mallorca', url: 'https://www.economiademallorca.com/feed/' },

  // ECONÓMICO nacional
  { source: 'Cinco Días', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/cincodias.elpais.com/portada' },
  { source: 'Cinco Días', url: 'https://cincodias.elpais.com/rss/cincodias/portada.xml' },
  { source: 'Cinco Días', url: 'https://news.google.com/rss/search?q=site:cincodias.elpais.com&hl=es-ES&gl=ES&ceid=ES:es' },

  // Google News RSS (fallback solo para medios sin RSS público fiable)
  { source: 'El Mundo', url: 'https://news.google.com/rss/search?q=site:elmundo.es&hl=es-ES&gl=ES&ceid=ES:es' },
  { source: 'Vozpópuli', url: 'https://news.google.com/rss/search?q=site:vozpopuli.com/politica+OR+site:vozpopuli.com/economia+OR+site:vozpopuli.com/espana&hl=es-ES&gl=ES&ceid=ES:es' },
  { source: 'Vozpópuli', url: 'https://news.google.com/rss/search?q=site:vozpopuli.com+-site:vozpopuli.com/opinion+when:1d&hl=es-ES&gl=ES&ceid=ES:es' },
  { source: 'Invertia', url: 'https://news.google.com/rss/search?q=site:invertia.com+OR+site:elespanol.com/invertia&hl=es-ES&gl=ES&ceid=ES:es' },
];

async function fetchOneFeed(feed, timeoutMs = 8000) {
  // Primer intento
  const r1 = await fetchOneFeedAttempt(feed, timeoutMs);
  if (r1.items.length > 0) return r1;
  // Reintento ÚNICO solo para errores de red/timeout (NO empty), mismo timeout.
  // No alargamos el timeout en el retry para no disparar el tiempo total → evita 504.
  if (r1.status === 'timeout' || r1.status === 'fetch_error') {
    const r2 = await fetchOneFeedAttempt(feed, timeoutMs);
    if (r2.items.length > 0) return r2;
  }
  return r1;
}

async function fetchOneFeedAttempt(feed, timeoutMs) {
  const result = {
    source: feed.source,
    url: feed.url,
    tier: feed.tier || 'main',
    items: [],
    status: 'ok',          // ok | http_error | timeout | fetch_error | empty | parse_error
    httpCode: null,
    errorMsg: null,
  };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(feed.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      redirect: 'follow',
    });
    clearTimeout(timer);
    result.httpCode = res.status;
    if (!res.ok) {
      result.status = 'http_error';
      result.errorMsg = `HTTP ${res.status}`;
      return result;
    }
    const xml = await res.text();
    const items = parseFeedItems(xml, feed.source);
    result.items = items;
    if (items.length === 0) {
      result.status = xml.length < 200 ? 'parse_error' : 'empty';
      result.errorMsg = items.length === 0 ? `Sin items (XML ${xml.length} chars)` : null;
    }
    return result;
  } catch (err) {
    result.status = err.name === 'AbortError' ? 'timeout' : 'fetch_error';
    result.errorMsg = err.message || 'Error desconocido';
    return result;
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
    // EXTRAER IMAGEN del feed RSS (varios formatos posibles)
    const image = extractImageFromItem(itemXml, description);
    if (title && link) {
      items.push({
        source,
        title: cleanGoogleNewsTitle(cleanText(title), source),
        url: cleanText(link),
        author: cleanText(author || ''),
        pubDate: cleanText(pubDate || ''),
        publishedDate: rfcToISODate(pubDate),
        description: cleanText(description).slice(0, 300),
        image: image || null,
      });
    }
  }
  return items;
}

// Google News añade " - Nombre del medio" al final de los títulos. Lo quitamos.
function cleanGoogleNewsTitle(title, source) {
  if (!title) return title;
  let t = title;
  // Quitar sufijo " - [cualquier cosa]" al final si parece nombre de medio (corto)
  const dashIdx = t.lastIndexOf(' - ');
  if (dashIdx > 20) {  // solo si hay título sustancial antes del guión
    const suffix = t.slice(dashIdx + 3).trim();
    // Si el sufijo es corto (nombre de medio) o coincide con la fuente, quitarlo
    const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (suffix.length <= 30 || norm(suffix).includes(norm(source))) {
      t = t.slice(0, dashIdx).trim();
    }
  }
  return t;
}

// Extrae URL de imagen del item RSS probando varios formatos
function extractImageFromItem(itemXml, description) {
  // 1. <media:content url="..." medium="image"/>
  const mediaContent = itemXml.match(/<media:content[^>]+url="([^"]+)"[^>]*medium="image"/i)
    || itemXml.match(/<media:content[^>]+url="([^"]+\.(?:jpg|jpeg|png|webp|gif)[^"]*)"/i);
  if (mediaContent && mediaContent[1]) return mediaContent[1];

  // 2. <media:thumbnail url="..."/>
  const mediaThumb = itemXml.match(/<media:thumbnail[^>]+url="([^"]+)"/i);
  if (mediaThumb && mediaThumb[1]) return mediaThumb[1];

  // 3. <enclosure url="..." type="image/..."/>
  const enclosure = itemXml.match(/<enclosure[^>]+url="([^"]+)"[^>]*type="image/i);
  if (enclosure && enclosure[1]) return enclosure[1];

  // 4. <itunes:image href="..."/>
  const itunes = itemXml.match(/<itunes:image[^>]+href="([^"]+)"/i);
  if (itunes && itunes[1]) return itunes[1];

  // 5. <image><url>...</url></image>
  const imageBlock = itemXml.match(/<image>\s*<url>([^<]+)<\/url>/i);
  if (imageBlock && imageBlock[1]) return imageBlock[1];

  // 6. Primera <img src="..."> en description
  const imgInDesc = (description || '').match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgInDesc && imgInDesc[1]) return imgInDesc[1];

  // 7. Buscar URL de imagen directa en content:encoded
  const contentEncoded = extractTagContent(itemXml, 'content:encoded');
  const imgInContent = contentEncoded.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgInContent && imgInContent[1]) return imgInContent[1];

  return null;
}

function extractTagContent(xml, tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, 'i');
  const m = xml.match(re);
  return m ? m[1] : '';
}

function cleanText(s) {
  let result = String(s || '')
    // Quitar CDATA wrapper
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    // Quitar tags HTML (incluye <a href>, <img>, <p>, <br>, etc.)
    .replace(/<[^>]+>/g, ' ')
    // Entidades nombradas
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&hellip;/g, '…')
    .replace(/&laquo;/g, '«').replace(/&raquo;/g, '»')
    .replace(/&ldquo;/g, '"').replace(/&rdquo;/g, '"')
    .replace(/&lsquo;/g, "'").replace(/&rsquo;/g, "'")
    .replace(/&ndash;/g, '–').replace(/&mdash;/g, '—')
    .replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú').replace(/&ntilde;/g, 'ñ')
    .replace(/&Aacute;/g, 'Á').replace(/&Eacute;/g, 'É').replace(/&Iacute;/g, 'Í')
    .replace(/&Oacute;/g, 'Ó').replace(/&Uacute;/g, 'Ú').replace(/&Ntilde;/g, 'Ñ')
    .replace(/&uuml;/g, 'ü').replace(/&Uuml;/g, 'Ü');
  // Entidades numéricas decimales: &#8216; &#8217; etc.
  result = result.replace(/&#(\d+);/g, (_, code) => {
    try { return String.fromCharCode(parseInt(code, 10)); } catch (_) { return ''; }
  });
  // Entidades numéricas hexadecimales: &#x2019;
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
    try { return String.fromCharCode(parseInt(hex, 16)); } catch (_) { return ''; }
  });
  // URL Google News trackers que aparecen como description (Público bug)
  result = result.replace(/https?:\/\/news\.google\.com\/rss\/articles\/[A-Za-z0-9_\-=]+\.\.\.?/g, '');
  // SEGUNDO borrado de tags: Google News codifica el HTML (&lt;a&gt;), que tras
  // decodificar las entidades arriba reaparece como <a href=...> de texto visible.
  result = result.replace(/<[^>]+>/g, ' ');
  // Limpiar restos de enlaces Google News que quedaron como texto
  result = result.replace(/https?:\/\/news\.google\.com\/\S+/g, '');
  result = result.replace(/href\s*=\s*["'][^"']*["']/gi, '');
  // Espacios múltiples
  return result.replace(/\s+/g, ' ').trim();
}

function rfcToISODate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(cleanText(dateStr));
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  } catch (_) { return ''; }
}

// ============ FEEDS RSS PARA OPINIÓN INTERNACIONAL ============
const INTERNATIONAL_OPINION_FEEDS = [
  // 🇺🇸 EEUU
  { source: 'NYT', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Opinion.xml', tier: 'main' },
  { source: 'Washington Post', url: 'https://feeds.washingtonpost.com/rss/opinions', tier: 'main' },
  { source: 'The Atlantic', url: 'https://www.theatlantic.com/feed/all/', tier: 'main' },
  { source: 'National Review', url: 'https://www.nationalreview.com/feed/', tier: 'main' },

  // 🇺🇸 USA conservadores alternativos (nunca-trumpistas / heterodoxos)
  { source: 'The Bulwark', url: 'https://www.thebulwark.com/feed/', tier: 'main' },
  { source: 'The Bulwark', url: 'https://news.google.com/rss/search?q=site:thebulwark.com&hl=en-US&gl=US&ceid=US:en', tier: 'gn-fallback' },
  { source: 'Politico', url: 'https://rss.politico.com/politics-news.xml', tier: 'main' },
  { source: 'The Hill', url: 'https://thehill.com/rss/syndicator/19110', tier: 'opinion' },

  // 🇬🇧 UK
  { source: 'The Guardian', url: 'https://www.theguardian.com/commentisfree/rss', tier: 'opinion' },
  { source: 'The Spectator', url: 'https://www.spectator.co.uk/feed', tier: 'main' },
  { source: 'The Spectator', url: 'https://news.google.com/rss/search?q=site:spectator.co.uk+opinion&hl=en-GB&gl=GB&ceid=GB:en', tier: 'gn-fallback' },
  { source: 'UnHerd', url: 'https://unherd.com/feed/', tier: 'main' },

  // 💰 ECONÓMICO GLOBAL
  { source: 'Bloomberg', url: 'https://feeds.bloomberg.com/opinion/news.rss', tier: 'opinion' },
  { source: 'Bloomberg', url: 'https://news.google.com/rss/search?q=site:bloomberg.com+opinion&hl=en-US&gl=US&ceid=US:en', tier: 'gn-fallback' },
  { source: 'Reuters', url: 'https://www.reutersagency.com/feed/?best-topics=business-finance', tier: 'business' },
  { source: 'Reuters', url: 'https://news.google.com/rss/search?q=site:reuters.com&hl=en-US&gl=US&ceid=US:en', tier: 'gn-fallback' },
  { source: 'MarketWatch', url: 'https://feeds.marketwatch.com/marketwatch/topstories/', tier: 'main' },
  { source: 'Quartz', url: 'https://qz.com/feed', tier: 'main' },
  { source: 'Forbes', url: 'https://www.forbes.com/business/feed/', tier: 'business' },

  // 🇪🇺 EUROPA OCC.
  { source: 'Le Figaro', url: 'https://www.lefigaro.fr/rss/figaro_actualites.xml', tier: 'main' },
  { source: 'Le Monde', url: 'https://www.lemonde.fr/rss/une.xml', tier: 'main' },

  // 🇩🇪 Der Spiegel International (versión inglés, gratis, calidad alta)
  { source: 'Der Spiegel', url: 'https://news.google.com/rss/search?q=site:spiegel.de/international+(opinion+OR+commentary+OR+editorial)&hl=en-US&gl=US&ceid=US:en', tier: 'gn-opinion' },

  // 🇮🇹 La Repubblica (centro-izq italiano, mayor diario)
  { source: 'La Repubblica', url: 'https://www.repubblica.it/rss/commenti/rss2.0.xml', tier: 'opinion' },
  { source: 'La Repubblica', url: 'https://news.google.com/rss/search?q=site:repubblica.it/commenti&hl=it-IT&gl=IT&ceid=IT:it', tier: 'gn-opinion' },

  // 🇬🇧 The Times (UK conservador establishment, PressReader disponible)
  { source: 'The Times', url: 'https://news.google.com/rss/search?q=site:thetimes.co.uk/article+(comment+OR+opinion)&hl=en-GB&gl=GB&ceid=GB:en', tier: 'gn-opinion' },


  // 🌐 MULTILATERAL OPINIÓN
  { source: 'Project Syndicate', url: 'https://www.project-syndicate.org/rss', tier: 'main' },
  { source: 'Project Syndicate', url: 'https://www.project-syndicate.org/rss/columnist', tier: 'columnist' },
  { source: 'Project Syndicate', url: 'https://news.google.com/rss/search?q=site:project-syndicate.org&hl=en-US&gl=US&ceid=US:en', tier: 'gn-fallback' },
  { source: 'Foreign Policy', url: 'https://foreignpolicy.com/feed/', tier: 'main' },
  { source: 'Foreign Affairs', url: 'https://www.foreignaffairs.com/rss.xml', tier: 'main' },

  // 🌍 EUROPA ESTE
  { source: 'Kyiv Independent', url: 'https://kyivindependent.com/feed', tier: 'main' },
  { source: 'Kyiv Independent', url: 'https://kyivindependent.com/rss/', tier: 'alt' },
  { source: 'Kyiv Independent', url: 'https://news.google.com/rss/search?q=site:kyivindependent.com&hl=en-US&gl=US&ceid=US:en', tier: 'gn-fallback' },

  // 🇷🇺 RUSIA (independiente)
  { source: 'The Moscow Times', url: 'https://www.themoscowtimes.com/rss/opinion', tier: 'opinion' },
  { source: 'The Moscow Times', url: 'https://www.themoscowtimes.com/rss/news', tier: 'news' },
  { source: 'The Moscow Times', url: 'https://news.google.com/rss/search?q=site:themoscowtimes.com&hl=en-US&gl=US&ceid=US:en', tier: 'gn-fallback' },

  // 🕌 ORIENTE MEDIO
  { source: 'Haaretz', url: 'https://www.haaretz.com/srv/htz---rss-opinion', tier: 'opinion' },
  { source: 'Haaretz', url: 'https://news.google.com/rss/search?q=site:haaretz.com+opinion&hl=en-US&gl=US&ceid=US:en', tier: 'gn-fallback' },
  { source: 'Times of Israel', url: 'https://www.timesofisrael.com/feed/', tier: 'main' },
  { source: 'Times of Israel', url: 'https://news.google.com/rss/search?q=site:timesofisrael.com&hl=en-US&gl=US&ceid=US:en', tier: 'gn-fallback' },

  // 🇮🇳 INDIA
  { source: 'The Hindu', url: 'https://www.thehindu.com/opinion/feeder/default.rss', tier: 'opinion' },
  { source: 'Indian Express', url: 'https://indianexpress.com/section/opinion/feed/', tier: 'opinion' },

  // 🌏 ASIA ESTE
  { source: 'Japan Times', url: 'https://www.japantimes.co.jp/feed/', tier: 'main' },

  // 🇨🇳 CHINA
  { source: 'SCMP', url: 'https://www.scmp.com/rss/91/feed', tier: 'main' },
  { source: 'SCMP', url: 'https://news.google.com/rss/search?q=site:scmp.com&hl=en-US&gl=US&ceid=US:en', tier: 'gn-fallback' },
  { source: 'Caixin', url: 'https://www.caixinglobal.com/rss/', tier: 'main' },
  { source: 'Caixin', url: 'https://news.google.com/rss/search?q=site:caixinglobal.com&hl=en-US&gl=US&ceid=US:en', tier: 'gn-fallback' },
  { source: 'Global Times', url: 'https://www.globaltimes.cn/rss/outbrain.xml', tier: 'main' },
  { source: 'China Daily', url: 'http://www.chinadaily.com.cn/rss/world_rss.xml', tier: 'main' },
  { source: 'Sixth Tone', url: 'https://www.sixthtone.com/rss', tier: 'main' },

  // 🇰🇷 COREA DEL SUR
  { source: 'Korea Herald', url: 'https://www.koreaherald.com/common_prog/rssdispatch.php?ct=02', tier: 'main' },
  { source: 'Korea Herald', url: 'https://news.google.com/rss/search?q=site:koreaherald.com&hl=en-US&gl=US&ceid=US:en', tier: 'gn-fallback' },
  { source: 'Korea JoongAng Daily', url: 'https://koreajoongangdaily.joins.com/rss/all', tier: 'main' },
  { source: 'Hankyoreh', url: 'https://english.hani.co.kr/rss/', tier: 'main' },

  // 🇸🇬 SINGAPUR
  { source: 'Channel News Asia', url: 'https://www.channelnewsasia.com/rss', tier: 'main' },
  { source: 'Channel News Asia', url: 'https://news.google.com/rss/search?q=site:channelnewsasia.com&hl=en-US&gl=US&ceid=US:en', tier: 'gn-fallback' },
  { source: 'The Business Times', url: 'https://www.businesstimes.com.sg/rss', tier: 'main' },

  // 🌏 SUDESTE ASIÁTICO
  { source: 'Jakarta Post', url: 'https://www.thejakartapost.com/feed', tier: 'main' },
  { source: 'Jakarta Post', url: 'https://news.google.com/rss/search?q=site:thejakartapost.com&hl=en-US&gl=US&ceid=US:en', tier: 'gn-fallback' },
  { source: 'Jakarta Globe', url: 'https://jakartaglobe.id/feed/', tier: 'main' },
  { source: 'Tempo', url: 'https://en.tempo.co/rss', tier: 'main' },
  { source: 'Tempo', url: 'https://news.google.com/rss/search?q=site:en.tempo.co&hl=en-US&gl=US&ceid=US:en', tier: 'gn-fallback' },
  { source: 'Bangkok Post', url: 'https://www.bangkokpost.com/rss/data/most-recent.xml', tier: 'main' },

  // 🌍 ÁFRICA
  { source: 'Daily Maverick', url: 'https://www.dailymaverick.co.za/feed/', tier: 'main' },
  { source: 'Daily Maverick', url: 'https://news.google.com/rss/search?q=site:dailymaverick.co.za&hl=en-US&gl=US&ceid=US:en', tier: 'gn-fallback' },
  { source: 'Mail & Guardian', url: 'https://mg.co.za/feed/', tier: 'main' },
  { source: 'Premium Times', url: 'https://www.premiumtimesng.com/feed', tier: 'main' },
  { source: 'Africa Report', url: 'https://www.theafricareport.com/feed/', tier: 'main' },
  { source: 'Africa Report', url: 'https://news.google.com/rss/search?q=site:theafricareport.com&hl=en-US&gl=US&ceid=US:en', tier: 'gn-fallback' },

  // 🌎 LATAM
  { source: 'Infobae', url: 'https://www.infobae.com/feeds/rss/', tier: 'main' },
  { source: 'Infobae', url: 'https://news.google.com/rss/search?q=site:infobae.com&hl=es-419&gl=AR&ceid=AR:es-419', tier: 'gn-fallback' },
  { source: 'Clarín', url: 'https://www.clarin.com/rss/lo-ultimo/', tier: 'main' },
  { source: 'El Espectador', url: 'https://www.elespectador.com/arc/outboundfeeds/rss/category/opinion/', tier: 'opinion' },
  { source: 'El Espectador', url: 'https://www.elespectador.com/arc/outboundfeeds/rss/', tier: 'main' },
  { source: 'El Espectador', url: 'https://news.google.com/rss/search?q=site:elespectador.com&hl=es-419&gl=CO&ceid=CO:es-419', tier: 'gn-fallback' },

  // 🌎 LATAM · CENTROAMÉRICA INVESTIGATIVO
  // Confidencial (Nicaragua exilio Costa Rica · Chamorro · Pulitzer)
  { source: 'Confidencial', url: 'https://news.google.com/rss/search?q=site:confidencial.digital/opinion&hl=es-419&gl=NI&ceid=NI:es-419', tier: 'gn-opinion' },
  { source: 'Confidencial', url: 'https://confidencial.digital/opinion/feed/', tier: 'opinion' },

  // 🌎 LATAM · MÉXICO investigativo
  // Animal Político (independiente, fact-checking, investigativo)
  { source: 'Animal Político', url: 'https://news.google.com/rss/search?q=site:animalpolitico.com/analisis+OR+site:animalpolitico.com/plumaje&hl=es-419&gl=MX&ceid=MX:es-419', tier: 'gn-opinion' },

  // 🌎 LATAM · EL SALVADOR investigativo
  // El Faro (Pulitzer, primer digital LATAM)
  { source: 'El Faro', url: 'https://news.google.com/rss/search?q=site:elfaro.net/columnas+OR+site:elfaro.net/opinion&hl=es-419&gl=SV&ceid=SV:es-419', tier: 'gn-opinion' },
  { source: 'El Mercurio', url: 'https://www.emol.com/sindicacion/rss/rss_actualidad.asp', tier: 'main' },
  { source: 'El Mercurio', url: 'https://www.emol.com/sindicacion/rss.asp', tier: 'general' },
  { source: 'El Mercurio', url: 'https://news.google.com/rss/search?q=site:emol.com&hl=es-419&gl=CL&ceid=CL:es-419', tier: 'gn-fallback' },
];

async function fetchSpainOpinionRss(allowedISODates, excludeUrls) {
  // ⚠️ DEDUP CROSS-DAY DESACTIVADO PARA OPINIÓN
  // Razón: el usuario quiere ver TODAS las columnas frescas aunque algunas hayan
  // aparecido en briefings recientes (las columnas de opinión se leen aunque sean
  // del mismo columnista días seguidos).
  const result = await fetchFeedsAndFilter(SPAIN_OPINION_FEEDS, allowedISODates, 48, isOpinionRSSItem, null);
  return { candidates: result.items.slice(0, 120), diagnostic: result.diagnostic };
}

async function fetchSpainNewsRss(allowedISODates, excludeUrls) {
  // Dedup cross-day SÍ activo para noticias (evita repetir titulares ya vistos)
  const result = await fetchFeedsAndFilter(SPAIN_NEWS_FEEDS, allowedISODates, 36, null, excludeUrls);
  return { candidates: result.items.slice(0, 80), diagnostic: result.diagnostic };
}

async function fetchInternationalOpinionRss(allowedISODates, excludeUrls) {
  // ⚠️ DEDUP CROSS-DAY DESACTIVADO PARA OPINIÓN INTERNACIONAL
  // Aplica filtro anti-noticia (isOpinionRSSItemIntl) para que los feeds generales
  // de Der Spiegel / La Repubblica / The Times no metan noticias en la sección.
  const result = await fetchFeedsAndFilter(INTERNATIONAL_OPINION_FEEDS, allowedISODates, 48, isOpinionRSSItemIntl, null);
  return { candidates: result.items.slice(0, 60), diagnostic: result.diagnostic };
}

// Filtro de opinión para medios internacionales (patrones de URL/título distintos al español)
function isOpinionRSSItemIntl(item) {
  const url = String(item.url || '').toLowerCase();
  const fromUrl = String(item._fromUrl || '').toLowerCase();
  const title = String(item.title || '').trim();

  // Fuentes que son 100% opinión/análisis por naturaleza → siempre pasan
  const OPINION_ONLY_INTL = new Set([
    'Project Syndicate', 'Foreign Affairs', 'Foreign Policy',
    'The Bulwark', 'UnHerd', 'The Spectator', 'National Review',
  ]);
  if (OPINION_ONLY_INTL.has(item.source)) return true;

  // URL contiene sección de opinión (multi-idioma)
  const isOpinionPath = /\/(opinion|opinione|commenti|commento|comment|meinung|idees|idias|editorial|column|columnist|columnas|columnas-y-blogs|plumaje|analisis|análisis|analysis|perspective|viewpoint|tribune|tribuna|firmas|blogs?)\b/i.test(url)
    || /\/(opinion|commenti|comment|meinung|columnas|plumaje|analisis)\b/i.test(fromUrl);
  if (isOpinionPath) return true;

  // Si el feed era de opinión (query Google News con opinion/comment/commenti/columnas/plumaje)
  if (/opinion|comment|commenti|meinung|editorial|columnas|plumaje|analisis/i.test(fromUrl)) return true;

  // Rechaza patrones claros de noticia en inglés/italiano/alemán/español
  const NEWS_INTL = [
    /^(breaking|live|video|watch|photos?|in pictures|gallery)\b/i,
    /\b(dies|dead|killed|injured|arrested|wins|loses|defeats)\b/i,
    /^(update|report):/i,
    /\b\d+ (killed|dead|injured|wounded)\b/i,
    /^(última hora|directo|vídeo|video|en vivo|en directo)\b/i,
    /\b(detenido|detienen|asesinado|asesinan|muerto|muertos|heridos?)\b/i,
    /\b(arrestato|morto|uccis|ferit)\b/i,  // italiano noticia
    /\b(getötet|festgenommen|verletzt)\b/i,  // alemán noticia
  ];
  for (const p of NEWS_INTL) {
    if (p.test(title)) return false;
  }

  // Por defecto: si tiene autor real, lo aceptamos como posible columna
  const author = String(item.author || '').trim();
  if (author && author.length > 2 && !/^(reuters|ap|afp|bloomberg news|staff|editorial)$/i.test(author)) {
    return true;
  }
  // Sin autor y sin señal de opinión → fuera (probablemente noticia)
  return false;
}

// ============ MAPA DE REGIONES INTERNACIONAL ============
const SOURCE_TO_REGION = {
  // USA
  'New York Times': 'USA', 'NYT': 'USA', 'The New York Times': 'USA',
  'Washington Post': 'USA', 'WaPo': 'USA', 'The Washington Post': 'USA',
  'Wall Street Journal': 'USA', 'WSJ': 'USA',
  'The Atlantic': 'USA', 'Atlantic': 'USA',
  'Politico': 'USA', 'POLITICO': 'USA',
  'The Hill': 'USA', 'TheHill': 'USA',
  'The New Yorker': 'USA', 'New Yorker': 'USA',
  'MarketWatch': 'USA',
  'Forbes': 'USA',
  'Quartz': 'USA',
  'National Review': 'USA',
  'The Bulwark': 'USA', 'thebulwark.com': 'USA',  // nunca-trumpista / heterodoxo conservador
  'Vox': 'USA',
  'AP': 'USA', 'Associated Press': 'USA', 'AP News': 'USA',
  'NPR': 'USA', 'CNN': 'USA', 'NBC': 'USA', 'CBS': 'USA', 'CBS News': 'USA',
  'ABC News': 'USA',
  'Axios': 'USA', 'Semafor': 'USA',
  'Bloomberg Opinion': 'USA',
  'USA Today': 'USA',
  'Time': 'USA', 'TIME': 'USA',
  'Newsweek': 'USA',
  'Slate': 'USA',
  'The Hill': 'USA',
  'ProPublica': 'USA',

  // UK
  'The Guardian': 'UK', 'Guardian': 'UK',
  'The Spectator': 'UK', 'Spectator': 'UK',
  'UnHerd': 'UK', 'BBC': 'UK', 'BBC News': 'UK',
  'The Telegraph': 'UK', 'Telegraph': 'UK',
  'The Times': 'UK', 'Times UK': 'UK',
  'Daily Mail': 'UK', 'The Daily Mail': 'UK',
  'The Independent': 'UK', 'Independent': 'UK',
  'Sky News': 'UK',
  'Evening Standard': 'UK',
  'The Sun': 'UK',
  'Mirror': 'UK', 'The Mirror': 'UK',

  // Económico Global
  'Bloomberg': 'Económico Global', 'Bloomberg.com': 'Económico Global',
  'Reuters': 'Económico Global', 'Reuters.com': 'Económico Global',
  'Financial Times': 'Económico Global', 'FT': 'Económico Global', 'FT.com': 'Económico Global',
  'The Economist': 'Económico Global', 'Economist': 'Económico Global', 'Economist.com': 'Económico Global',
  'Nikkei Asia': 'Económico Global', 'Nikkei': 'Económico Global', 'Nikkei.com': 'Económico Global',
  'CNBC': 'Económico Global',
  'Business Insider': 'Económico Global',

  // Europa Occidental
  'Le Figaro': 'Europa Occ', 'Figaro': 'Europa Occ',
  'Le Monde': 'Europa Occ',
  'Le Point': 'Europa Occ',
  'Liberation': 'Europa Occ', 'Libération': 'Europa Occ',
  'L\'Express': 'Europa Occ',
  'France 24': 'Europa Occ', 'France24': 'Europa Occ',
  'RFI': 'Europa Occ',
  'Die Zeit': 'Europa Occ', 'Zeit': 'Europa Occ',
  'Der Spiegel': 'Europa Occ', 'Spiegel': 'Europa Occ',
  'Frankfurter Allgemeine': 'Europa Occ', 'FAZ': 'Europa Occ',
  'Süddeutsche Zeitung': 'Europa Occ', 'Sueddeutsche': 'Europa Occ',
  'Deutsche Welle': 'Europa Occ', 'DW': 'Europa Occ',
  'La Repubblica': 'Europa Occ',
  'Corriere della Sera': 'Europa Occ', 'Corriere': 'Europa Occ',
  'Il Foglio': 'Europa Occ',
  'La Stampa': 'Europa Occ',
  'Il Sole 24 Ore': 'Europa Occ',
  'NRC': 'Europa Occ',
  'De Volkskrant': 'Europa Occ',

  // Europa Este
  'Kyiv Independent': 'Europa Este',
  'Politico Europe': 'Europa Este',
  'Notes from Poland': 'Europa Este',
  'Gazeta Wyborcza': 'Europa Este',
  'Euractiv': 'Europa Este', 'EURACTIV': 'Europa Este',
  'Hungary Today': 'Europa Este',
  'Visegrad Insight': 'Europa Este',

  // Oriente Medio
  'Haaretz': 'Oriente Medio',
  'Times of Israel': 'Oriente Medio', 'The Times of Israel': 'Oriente Medio',
  'Al Jazeera': 'Oriente Medio', 'Al Jazeera English': 'Oriente Medio', 'Al-Jazeera': 'Oriente Medio',
  'Jerusalem Post': 'Oriente Medio', 'The Jerusalem Post': 'Oriente Medio',
  'Al-Monitor': 'Oriente Medio', 'Al Monitor': 'Oriente Medio',
  'Middle East Eye': 'Oriente Medio', 'MEE': 'Oriente Medio',
  'The National': 'Oriente Medio',  // UAE
  'Asharq Al-Awsat': 'Oriente Medio',
  'Daily Sabah': 'Oriente Medio',  // Turkey but often Middle East focused

  // India + Asia Este + SE Asia → Asia (combinado)
  'The Hindu': 'Asia', 'Hindu': 'Asia',
  'Indian Express': 'Asia', 'The Indian Express': 'Asia',
  'Times of India': 'Asia', 'The Times of India': 'Asia',
  'Hindustan Times': 'Asia',
  'Scroll.in': 'Asia',
  'Mint': 'Asia',
  'Japan Times': 'Asia', 'The Japan Times': 'Asia',
  'South China Morning Post': 'Asia', 'SCMP': 'Asia',
  'Korea Herald': 'Asia', 'The Korea Herald': 'Asia',
  'Korea Times': 'Asia', 'The Korea Times': 'Asia',
  'Asahi Shimbun': 'Asia', 'Asahi': 'Asia',
  'Yomiuri Shimbun': 'Asia', 'Yomiuri': 'Asia',
  'Mainichi': 'Asia',
  'Caixin': 'Asia', 'Caixin Global': 'Asia',
  'Global Times': 'Asia',
  'China Daily': 'Asia',
  'Sixth Tone': 'Asia',
  'Xinhua': 'Asia', 'Xinhua News': 'Asia',
  'People\'s Daily': 'Asia',
  'Korea JoongAng Daily': 'Asia', 'JoongAng Daily': 'Asia', 'JoongAng Ilbo': 'Asia',
  'Hankyoreh': 'Asia', 'The Hankyoreh': 'Asia',
  'Jakarta Post': 'Asia', 'The Jakarta Post': 'Asia',
  'Bangkok Post': 'Asia',
  'Philippine Daily Inquirer': 'Asia', 'Inquirer': 'Asia',
  'Channel News Asia': 'Asia', 'CNA': 'Asia',
  'The Business Times': 'Asia', 'Business Times Singapore': 'Asia',
  'TODAY': 'Asia', 'TODAYonline': 'Asia',
  'Jakarta Globe': 'Asia',
  'Tempo': 'Asia', 'Tempo English': 'Asia',
  'Tirto': 'Asia', 'Tirto.id': 'Asia',
  'Kompas': 'Asia',
  'Vietnam News': 'Asia',
  'Channel 8': 'Asia',
  'Taiwan News': 'Asia',
  'The Star': 'Asia',  // Malaysia
  'Free Malaysia Today': 'Asia',

  // LATAM
  'Clarín': 'LATAM', 'Clarin': 'LATAM',
  'La Nación': 'LATAM', 'La Nacion': 'LATAM',
  'Infobae': 'LATAM',
  'El Universal': 'LATAM',
  'El Mercurio': 'LATAM',
  'El Espectador': 'LATAM',
  'Folha de S.Paulo': 'LATAM', 'Folha': 'LATAM', 'Folha de Sao Paulo': 'LATAM',
  'O Globo': 'LATAM',
  'Estadão': 'LATAM', 'Estadao': 'LATAM', 'O Estado de S.Paulo': 'LATAM',
  'Milenio': 'LATAM',
  'La Tercera': 'LATAM',
  'La Jornada': 'LATAM',
  'Página 12': 'LATAM', 'Pagina 12': 'LATAM',
  'Excélsior': 'LATAM', 'Excelsior': 'LATAM',
  'Reforma': 'LATAM',
  'Animal Político': 'LATAM', 'Animal Politico': 'LATAM',
  'El Comercio': 'LATAM',  // Perú
  'El Tiempo': 'LATAM',  // Colombia
  'Semana': 'LATAM',
  'La República': 'LATAM',
  'La Prensa': 'LATAM',
  'El Faro': 'LATAM', 'elfaro.net': 'LATAM',  // El Salvador, Pulitzer, investigativo
  'Confidencial': 'LATAM',  // Nicaragua (exilio Costa Rica), Chamorro, investigativo

  // África
  'Daily Maverick': 'África', 'The Daily Maverick': 'África',
  'Mail & Guardian': 'África', 'Mail and Guardian': 'África',
  'Premium Times': 'África',
  'Africa Report': 'África', 'The Africa Report': 'África',
  'AllAfrica': 'África', 'allAfrica': 'África',
  'News24': 'África',
  'Vanguard': 'África',  // Nigeria
  'Daily Nation': 'África',  // Kenya
  'The Standard': 'África',  // Kenya
  'Punch': 'África',  // Nigeria
  'BusinessDay': 'África',
  'Cape Argus': 'África',

  // Rusia
  'Moscow Times': 'Rusia', 'The Moscow Times': 'Rusia',
  'Meduza': 'Rusia',
  'Novaya Gazeta': 'Rusia',
  'RBC': 'Rusia',

  // Australia
  'Sydney Morning Herald': 'Australia', 'The Sydney Morning Herald': 'Australia',
  'The Australian': 'Australia',
  'The Age': 'Australia',
  'ABC News Australia': 'Australia',  // careful: AU vs US ABC

  // Turquía
  'Hurriyet': 'Turquía', 'Hurriyet Daily News': 'Turquía',
  // Daily Sabah ya en Oriente Medio por foco regional

  // Multilateral / Análisis
  'Project Syndicate': 'Multilateral',
  'Foreign Policy': 'Multilateral',
  'Foreign Affairs': 'Multilateral',
  'AFP': 'Multilateral', 'Agence France-Presse': 'Multilateral',
  'EFE': 'Multilateral',  // Spanish agency but multilateral coverage
  'DPA': 'Multilateral',  // German agency
  'UN News': 'Multilateral', 'United Nations': 'Multilateral',
  'IMF': 'Multilateral',
  'World Bank': 'Multilateral',
  'Council on Foreign Relations': 'Multilateral', 'CFR': 'Multilateral',
  'Brookings': 'Multilateral',
  'Carnegie Endowment': 'Multilateral',
  'CSIS': 'Multilateral',
  'Chatham House': 'Multilateral',
  'European Council on Foreign Relations': 'Multilateral', 'ECFR': 'Multilateral',
  'OECD': 'Multilateral',
};

const REGION_MIN = {
  'USA': 0,          // sin mín (cap máx 6)
  'UK': 0,           // sin mín (cap máx 4)
  'Europa Occ': 2,
  'Europa Este': 1,
  'Oriente Medio': 2,
  'Asia': 5,         // India + Asia Este + China + Corea + SE Asia + Singapur + Indonesia
  'LATAM': 4,
  'África': 1,
  'Económico Global': 2,
  'Rusia': 0,        // opcional: solo si hay noticia
  'Australia': 0,
  'Turquía': 0,
  'Multilateral': 0,
};

const REGION_EMOJI = {
  'USA': '🇺🇸', 'UK': '🇬🇧',
  'Europa Occ': '🇪🇺', 'Europa Este': '🌍',
  'Oriente Medio': '🕌',
  'Asia': '🌏', 'LATAM': '🌎', 'África': '🌍',
  'Económico Global': '💰', 'Rusia': '🇷🇺',
  'Australia': '🇦🇺', 'Turquía': '🇹🇷',
  'Multilateral': '🌐', 'Otros': '⚪',
};

function classifyRegion(source) {
  if (!source) return 'Otros';
  return SOURCE_TO_REGION[source] || 'Otros';
}

// ============ MAPA DE REGIONES INTERNACIONAL (END) ============

// ============ PAYWALL SOURCES (paywall fuerte) ============
// Estas fuentes requieren suscripción para acceder al contenido completo.
// Se marcan con _isPaywall: true para que el frontend muestre 🔒
const PAYWALL_SOURCES = new Set([
  // España
  'El País', 'El Mundo', 'ABC', 'El Español', 'Cinco Días',
  // Internacional - paywall fuerte
  'New York Times', 'NYT', 'Washington Post', 'WaPo',
  'Wall Street Journal', 'WSJ',
  'The Atlantic', 'Bloomberg', 'Financial Times', 'FT',
  'The Economist', 'Foreign Affairs', 'Foreign Policy',
  'The Spectator', 'Le Monde', 'Le Figaro',
  'Haaretz', 'Japan Times', 'Clarín', 'El Mercurio', 'The New Yorker',
  'South China Morning Post', 'SCMP', 'Caixin', 'Caixin Global',
  'The Business Times', 'Business Times Singapore',
]);

function isPaywallSource(sourceName) {
  if (!sourceName) return false;
  return PAYWALL_SOURCES.has(sourceName);
}

// ============ PRESSREADER: Paywall internacionales DISPONIBLES en PressReader ============
// Estos medios tienen sus ediciones impresas disponibles en PressReader.
// Si el usuario tiene acceso (biblioteca o suscripción €9.99/mes), puede leerlos ahí.
// Se marcan con flag _isPressReader para que el frontend muestre badge 📚 alternativo.
const PRESSREADER_AVAILABLE_SOURCES = new Set([
  // 🇬🇧 UK
  'Financial Times', 'FT', 'FT.com',
  'The Economist', 'Economist',
  'The Spectator', 'Spectator',
  'The Times', 'Times UK',
  'The Telegraph', 'Telegraph',
  // 🇺🇸 USA (los que SIGUEN en PressReader)
  'Bloomberg', 'Bloomberg.com', 'Bloomberg News',
  'Newsweek',
  // 🇫🇷 Europa Occ
  'Le Monde',
  'Le Figaro',
  // 🇮🇹 Italia
  'La Repubblica',
  // 🌏 Asia
  'Japan Times', 'The Japan Times',
  'The Business Times', 'Business Times Singapore',
  'South China Morning Post', 'SCMP',
  // 🇪🇸 España (algunas ediciones)
  'El País', 'El Mundo', 'ABC', 'La Vanguardia',
  // 🌎 LATAM
  'El Mercurio',
]);

function isPressReaderAvailable(sourceName) {
  if (!sourceName) return false;
  return PRESSREADER_AVAILABLE_SOURCES.has(sourceName);
}

// ============ HELPER GLOBAL: Filtro de opinión (firmas reales) ============
// Lista BLANCA: columnistas CONFIRMADOS por el usuario (sobrescribe cualquier filtro).
// Si una pieza está firmada por uno de ellos, ES opinión sí o sí.
const KNOWN_OPINION_COLUMNISTS_GLOBAL = [
  // Vozpópuli
  'ignacia de pano', 'gorka maneiro', 'carlos martínez gorriarán', 'carlos martinez gorriaran',
  'jesús banegas', 'jesus banegas', 'josé alejandro vara', 'jose alejandro vara',
  'manuel marín', 'manuel marin', 'irene gonzález', 'irene gonzalez',
  'rubén manso', 'ruben manso', 'jesús cacho', 'jesus cacho',
  'agustín valladolid', 'agustin valladolid', 'pablo sebastián', 'pablo sebastian',
  'víctor lenore', 'victor lenore',
  // The Objective
  'juan luis cebrián', 'juan luis cebrian', 'pablo de lora', 'javier benegas',
  'guadalupe sánchez', 'guadalupe sanchez', 'maite rico', 'victoria carvajal',
  'pablo cambronero', 'manuel arias maldonado', 'antonio caño', 'antonio cano',
  'manuel fernández ordóñez', 'manuel fernandez ordonez', 'jorge san miguel',
  'ketty garat',
  // El País
  'estefanía molina', 'estefania molina', 'diego s. garrocho salcedo',
  'diego sebastián garrocho salcedo', 'diego sebastian garrocho salcedo',
  'lluís bassets', 'lluis bassets', 'ana iris simón', 'ana iris simon',
  'ángeles caballero', 'angeles caballero', 'daniel gascón', 'daniel gascon',
  'joan ridao',
  // El Mundo
  'arcadi espada', 'pedro g. cuartango', 'jorge bustos', 'francisco rosell',
  // El Español
  'cristian campos', 'pedro j. ramírez', 'pedro j. ramirez', 'pedro jota ramírez',
  'lorena g. maldonado', 'lorenzo bernaldo de quirós', 'lorenzo bernaldo de quiros',
  'josé ramón pin arboledas', 'jose ramon pin arboledas',
  // Libertad Digital
  'federico jiménez losantos', 'federico jimenez losantos',
  // El Debate
  'juan carlos girauta', 'antonio r. naranjo', 'antonio naranjo',
  // OK Diario
  'graciano palomo',
  // elDiario.es
  'ignacio escolar',
  // La Gaceta
  'josé javier esparza', 'jose javier esparza', 'hughes',
  'luis arroyo', 'lucila rodríguez-alarcón', 'lucila rodriguez-alarcon',
  // Recién añadidos
  'jose antonio montano', 'josé antonio montano',
  'esperanza aguirre',
  'alba vila',
  'esperanza ruiz',
  'iván vélez', 'ivan velez',
  'mariona gumpert',
];

// Lista NEGRA: periodistas de noticias (NO columnistas) por medio
const KNOWN_NEWS_REPORTERS_GLOBAL = {
  'The Objective': [
    'roberto alcolea', 'juan carlos téllez', 'juan carlos tellez',
    'fran serrato', 'luis manuel rafael',
    'antonio rodríguez', 'antonio rodriguez',
    'álvaro nieto', 'alvaro nieto',
    'marcos ondarra', 'jaime susanna',
  ],
  'Libertad Digital': [
    'paco cobos', 'pablo pardo',
    'miguel ángel pérez', 'miguel angel perez',
    'miguel puga', 'álvaro nieto', 'alvaro nieto',
    'carlos cuesta', 'daniel basteiro',
  ],
  'elDiario.es': [
    'javier lillo', 'elena herrera', 'pedro águeda', 'pedro agueda',
    'jose precedo', 'josé precedo', 'pedro simón', 'pedro simon',
  ],
  'Vozpópuli': [
    'alberto sanz', 'efe', 'europa press',
  ],
  'Artículo 14': [],
  'El País': ['efe', 'europa press', 'reuters'],
  'El Mundo': ['efe', 'europa press', 'reuters'],
};

// Patrones de título que casi siempre indican NOTICIA (alta confianza)
const NEWS_TITLE_PATTERNS = [
  /^el juez \w+ (imputa|investiga|cita|bloquea|absuelve|procesa|condena|acusa)/i,
  /^la (audiencia|fiscalía|policía|guardia civil) /i,
  /\binvierte \d/i,
  /\b\d+ millones (de )?euros?\b/i,
  /^el (gobierno|tribunal|congreso|senado|consejo) (aprueba|rechaza|debate|vota)/i,
  /\b(dimite|destituye|reemplaza|releva)\b/i,
  /^sumario/i,
  /^en sumario/i,
  /^boletín/i,
  /^claves del día/i,
  // Patrones noticia adicionales (reportaje/breaking)
  /^(última hora|directo|en directo|vídeo|video|fotos?|galería|en imágenes)\b/i,
  /\b(detenido|detienen|arrestado|arrestan|herido|heridos|muertos?|fallecido)\b/i,
  /^(los mossos|la ertzaintza|la policía|la guardia civil|bomberos)/i,
  /\b(gana|pierde|empata|vence|cae|sube|baja) \d/i,
  /^(resultados|clasificación|directo):/i,
  /\b(se corona|campeón|campeona|medalla|título) /i,
];

function isOpinionRSSItem(item) {
  // ⭐ MODO LENIENT para feeds/sources que SON 100% opinión:
  // estos no siempre exponen <author> en el RSS pero son opinión por naturaleza
  const OPINION_ONLY_SOURCES = new Set([
    'Artículo 14',
    'Agenda Pública',
    'El Blog Salmón',
    'Ethic',           // revista de pensamiento (ensayo/análisis firmado)
    'Letras Libres',   // revista de ensayo/crítica
  ]);
  const url = String(item.url || '');
  const fromUrl = String(item._fromUrl || '').toLowerCase(); // URL del feed origen
  const isOpinionUrlPath = /\/opinion\//i.test(url)
    || /\/editoriales?\//i.test(url)
    || /\/columna[s]?\//i.test(url)
    || /\/editorial\//i.test(url)
    || /\/elsubjetivo\//i.test(url)
    || /\/firmas\//i.test(url)
    || /\/tribuna\//i.test(url);
  // ⭐ NUEVO: detectar si vino de un FEED de opinión (caso Google News)
  // Google News usa URLs codificadas en el <link>, así que mirar item.url no basta.
  // Usamos _fromUrl (la URL del feed) para saber si el query era de opinión.
  const isFromOpinionFeed = fromUrl.includes('opinion')
    || fromUrl.includes('articulo14.es')      // Artículo 14 = 100% opinión
    || fromUrl.includes('agendapublica')       // Agenda Pública = 100% opinión
    || fromUrl.includes('elblogsalmon')        // El Blog Salmón = 100% opinión/análisis
    || fromUrl.includes('elsubjetivo')
    || fromUrl.includes('/category/opinion')
    || fromUrl.includes('googlenews+opinion')
    || /news\.google\.com.*site%3A[^&]*(?:\/opinion|articulo14|agendapublica|elblogsalmon)/i.test(fromUrl);
  const isOpinionOnlySource = OPINION_ONLY_SOURCES.has(item.source);

  // En modo lenient, aceptamos sin requerir autor (pero verificamos patrones de news en título)
  if (isOpinionOnlySource || isOpinionUrlPath || isFromOpinionFeed) {
    // Aún rechazamos editorial/sumario explícito
    const authorLow = String(item.author || '').toLowerCase().trim();
    if (authorLow.includes('redacción') || authorLow.includes('redaccion')) return false;
    if (authorLow === 'editorial' || authorLow === 'opinión' || authorLow === 'opinion') return false;
    if (authorLow.includes('sumario')) return false;
    // Rechaza patrones noticia en título
    const titleLenient = String(item.title || '').trim();
    for (const pattern of NEWS_TITLE_PATTERNS) {
      if (pattern.test(titleLenient)) return false;
    }
    return true;
  }

  // Modo estricto: requiere autor real
  if (!item.author) return false;
  const author = String(item.author).trim();
  if (!author) return false;
  const authorLow = author.toLowerCase();

  // ⭐ ALLOWLIST: si es columnista confirmado, ES opinión SIEMPRE (sobrescribe filtros)
  if (KNOWN_OPINION_COLUMNISTS_GLOBAL.includes(authorLow)) return true;

  const sourceLow = String(item.source || '').toLowerCase();
  if (authorLow === sourceLow) return false;
  if (authorLow.includes('redacción') || authorLow.includes('redaccion')) return false;
  if (authorLow === 'editorial' || authorLow === 'opinión' || authorLow === 'opinion') return false;
  if (authorLow.includes('sumario')) return false;
  if (['efe', 'europa press', 'reuters', 'ap', 'afp', 'ansa', 'dpa'].includes(authorLow)) return false;
  if (author.includes(' y ') || author.includes(', ')) return false;
  const reporters = KNOWN_NEWS_REPORTERS_GLOBAL[item.source] || [];
  if (reporters.some(r => authorLow === r)) return false;

  if (item.source === 'The Objective') {
    const u = String(item.url || '');
    const isSubjetivoOrAutor = /\/elsubjetivo\//i.test(u) || /\/autor\//i.test(u);
    if (!isSubjetivoOrAutor) return false;
  }

  const description = String(item.description || '').trim();
  if (description.length > 0) {
    const descLow = description.toLowerCase();
    if (descLow.startsWith(authorLow)) {
      const afterAuthor = description.substring(author.length).trim();
      const NEUTRAL_REPORT_VERBS = /^(analiza|examina|explica|describe|expone|relata|cuenta|narra|traza|profundiza|repasa|aborda|disecciona|desentraña|desentrana|reseña|resena|informa|detalla|recoge|reconstruye|desvela|revela|publica)/i;
      if (NEUTRAL_REPORT_VERBS.test(afterAuthor)) return false;
    }
  }

  const title = String(item.title || '').trim();
  for (const pattern of NEWS_TITLE_PATTERNS) {
    if (pattern.test(title)) return false;
  }
  return true;
}

async function fetchFeedsAndFilter(feedList, allowedISODates, maxHoursAgo, opinionFilter = null, excludeUrls = null) {
  // Fetch en batches de 25 para no saturar la red (evita timeouts masivos / 504)
  const BATCH_SIZE = 25;
  const feedResults = [];
  for (let i = 0; i < feedList.length; i += BATCH_SIZE) {
    const batch = feedList.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(feed => fetchOneFeed(feed)));
    feedResults.push(...batchResults);
  }

  // Aplanar items, manteniendo trazabilidad de la URL origen
  const flat = feedResults.flatMap(r =>
    r.items.map(item => {
      const enriched = { ...item, _fromUrl: r.url, _fromTier: r.tier };
      // Si el feed es VIP de autor (vip:Nombre) y el item no trae autor, inyectarlo
      if ((!enriched.author || !String(enriched.author).trim()) && String(r.tier || '').startsWith('vip:')) {
        const vipName = r.tier.slice(4).trim();  // "vip:Maneiro" → "Maneiro"
        if (vipName) enriched.author = vipName;
      }
      return enriched;
    })
  );

  // Deduplicar por URL final del artículo
  const seen = new Set();
  const dedup = flat.filter(item => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });

  // Filtrar por fechas aceptadas
  let inDate = dedup.filter(it => {
    if (!allowedISODates || allowedISODates.length === 0) return true;
    return allowedISODates.includes(it.publishedDate);
  });

  // Filtro adicional por timestamp si se especifica maxHoursAgo
  if (maxHoursAgo && Number.isFinite(maxHoursAgo)) {
    const cutoffMs = Date.now() - (maxHoursAgo * 60 * 60 * 1000);
    inDate = inDate.filter(it => {
      if (!it.pubDate) return true;
      try {
        const ts = new Date(it.pubDate).getTime();
        if (isNaN(ts)) return true;
        return ts >= cutoffMs;
      } catch (_) { return true; }
    });
  }

  // FILTRO OPINIÓN PRE-CAP: si se pasa opinionFilter, lo aplicamos ANTES del cap por fuente.
  // Así el cap cuenta solo opinión y obtenemos más candidatos válidos.
  let preCapPool = inDate;
  if (typeof opinionFilter === 'function') {
    preCapPool = inDate.filter(opinionFilter);
  }

  // ⭐ DEDUP CROSS-DAY: excluir URLs que ya aparecieron en briefings recientes
  let excludedByDedup = 0;
  if (excludeUrls && excludeUrls.size > 0) {
    const beforeCount = preCapPool.length;
    preCapPool = preCapPool.filter(item => {
      if (!item.url) return true;
      // Normalizar URLs: quitar parámetros tracking comunes y fragmentos
      const normalizeUrl = (u) => u.split('#')[0].split('?')[0].toLowerCase().replace(/\/$/, '');
      return !excludeUrls.has(normalizeUrl(item.url)) && !excludeUrls.has(item.url);
    });
    excludedByDedup = beforeCount - preCapPool.length;
  }

  // CAP POR FUENTE PERSONALIZADO (ampliado para opinión)
  const PER_SOURCE_CAPS = {
    'Vozpópuli': 12,
    'Artículo 14': 12,
    'The Objective': 10,
    'La Gaceta': 8,
    'Libertad Digital': 10,
    'Agenda Pública': 6,
    'elDiario.es': 8,
    'El Mundo': 8,
    'ABC': 6,
    'OK Diario': 6,
    'El Blog Salmón': 4,
    'El Nacional.cat': 6,
    'Crónica Global': 5,
    'OK Diario Baleares': 4,
    'elDiario.es Baleares': 4,
    'El Debate Baleares': 4,
    'Cinco Días': 6,
    'Economía de Mallorca': 4,
    'El País': 8,
    'El Español': 8,
    'El Debate': 6,
    'Demócrata': 6,
  };
  const DEFAULT_CAP = 4;
  const perSourceCounts = {};
  const balanced = preCapPool.filter(item => {
    const cap = PER_SOURCE_CAPS[item.source] ?? DEFAULT_CAP;
    perSourceCounts[item.source] = perSourceCounts[item.source] || 0;
    if (perSourceCounts[item.source] >= cap) return false;
    perSourceCounts[item.source]++;
    return true;
  });

  // ============ DIAGNÓSTICO AVANZADO (E) ============
  // Agrupar resultados por source y mostrar URLs individuales
  const cutoffMs = maxHoursAgo && Number.isFinite(maxHoursAgo)
    ? Date.now() - (maxHoursAgo * 60 * 60 * 1000)
    : null;

  // Agrupar feedResults por source
  const grouped = {};
  feedResults.forEach(r => {
    if (!grouped[r.source]) grouped[r.source] = [];
    grouped[r.source].push(r);
  });

  const diagnostic = Object.keys(grouped).map(source => {
    const urls = grouped[source];

    // Item-level stats agregados (suma de todas las URLs del source)
    const allItems = urls.flatMap(u => u.items);
    const uniqueItems = [];
    const seenUrls = new Set();
    for (const item of allItems) {
      if (!seenUrls.has(item.url)) {
        seenUrls.add(item.url);
        uniqueItems.push(item);
      }
    }

    const passedDate = uniqueItems.filter(it => allowedISODates.includes(it.publishedDate));
    let passedTimestamp = passedDate.length;
    if (cutoffMs !== null) {
      passedTimestamp = passedDate.filter(it => {
        if (!it.pubDate) return true;
        try {
          const ts = new Date(it.pubDate).getTime();
          if (isNaN(ts)) return true;
          return ts >= cutoffMs;
        } catch (_) { return true; }
      }).length;
    }

    const latestTs = uniqueItems.reduce((max, it) => {
      if (!it.pubDate) return max;
      try {
        const t = new Date(it.pubDate).getTime();
        return (!isNaN(t) && t > max) ? t : max;
      } catch (_) { return max; }
    }, 0);
    const hoursAgo = latestTs > 0
      ? Math.round((Date.now() - latestTs) / (60 * 60 * 1000) * 10) / 10
      : null;

    // Sugerencia automática según status de las URLs
    let suggestion = null;
    const allFailed = urls.every(u => u.status !== 'ok' || u.items.length === 0);
    const hasAuthor = urls.some(u => u.tier && u.tier.startsWith('vip:'));
    if (allFailed && !hasAuthor) {
      suggestion = '⚠️ Añadir URLs alternativas o feeds de autor específico';
    } else if (allFailed && hasAuthor) {
      suggestion = '⚠️ Feeds de autor también fallan · revisar URL del medio';
    } else if (uniqueItems.length > 0 && passedDate.length === 0) {
      suggestion = `📅 Tiene contenido pero ninguno de las fechas aceptadas (último hace ${hoursAgo}h)`;
    } else if (passedDate.length > 0 && passedTimestamp === 0) {
      suggestion = '⏰ Items dentro de fecha pero anteriores al timestamp cutoff';
    }

    // Detalle por URL (parte E)
    const urlDetails = urls.map(u => ({
      url: u.url.length > 60 ? u.url.slice(0, 57) + '...' : u.url,
      tier: u.tier,
      status: u.status,
      httpCode: u.httpCode,
      itemCount: u.items.length,
      errorMsg: u.errorMsg,
    }));

    return {
      source,
      rawCount: uniqueItems.length,
      passedDateFilter: passedDate.length,
      passedTimestampFilter: passedTimestamp,
      includedAfterCap: perSourceCounts[source] || 0,
      latestDateSeen: uniqueItems.length > 0
        ? [...new Set(uniqueItems.map(it => it.publishedDate).filter(Boolean))].sort().reverse()[0]
        : 'sin fecha',
      hoursAgo: hoursAgo,
      urlsCount: urls.length,
      urlDetails: urlDetails,
      suggestion: suggestion,
    };
  });

  return { items: balanced, diagnostic, perSourceCounts };
}

// ============ FIN MÓDULO RSS ============

const COLUMNISTS_GUIDE = `COLUMNISTAS A SEGUIR (priorízalos si han publicado HOY o ayer):

VOZPÓPULI (búsqueda web vozpopuli.com "[columnista]" [fecha], accesible desde primera hora):
- Ignacia de Pano — martes
- Gorka Maneiro — habitual (2-3 veces por semana, especialmente L-V)
- Carlos Martínez Gorriarán — semanal (variable, ex-UPyD)
- Jesús Banegas — quincenal/mensual (economía)
- José Alejandro Vara — variable (sin día fijo)
- Manuel Marín — lunes (director, columna semanal)
- Irene González — variable
- Rubén Manso — semanal/quincenal (economía), inspector Banco España → vozpopuli.com/redaccion/ruben-manso
- Jesús Cacho — domingo (columna semanal habitual, ocasionalmente otros días)
- Agustín Valladolid — jueves (columna semanal)
- Pablo Sebastián — variable (veterano, habitual sin día fijo)
- Víctor Lenore — cultura, variable
- José Antonio Montano — variable (literatura/cultura/política)
- Esperanza Ruiz — variable (también publica en La Gaceta)
- Mariona Gumpert — variable

THE OBJECTIVE (búsqueda web theobjective.com "[columnista]" [fecha]):
- Guadalupe Sánchez
- Antonio Caño
- Manuel Arias Maldonado
- Álvaro Nieto
- Javier Benegas — viernes
- Ketty Garat (análisis político)
- Iván Vélez (filosofía/cultura, variable)
- Esperanza Aguirre (ex-política, columnas ocasionales)
- Jorge San Miguel (variable, 1-2/semana)
- Pablo de Lora — sábados → theobjective.com/autor/pablo-de-lora/
- Manuel Fernández Ordóñez (Doctor Física Nuclear, energía/tecnología)
- Victoria Carvajal — sábados, economía, ex-El País
- Maite Rico — varios días, "Sujétame el vermú" martes, directora adjunta
- Pablo Cambronero → theobjective.com/autor/pablo-cambronero/
- Juan Luis Cebrián



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
- Estefanía Molina — jueves (columna "Café Pendiente") → almendron.com/tribuna/autor/estefania-molina/
- Diego S. Garrocho Salcedo — variable (filósofo, columnas temáticas) → elpais.com/autor/diego-sebastian-garrocho-salcedo/
- Lluís Bassets — habitual (2-3 veces semana, internacional) → elpais.com/autor/lluis-bassets/
- Ana Iris Simón — esporádica (escritora, columnas largas) → elpais.com/autor/ana-iris-simon/
- Ángeles Caballero — lunes (columna semanal) → elpais.com/autor/angeles-caballero/
- Daniel Gascón — viernes (columnista habitual semanal) → elpais.com/autor/daniel-gascon/

LA GACETA DE LA IBEROSFERA:
- Iván Vélez (filosofía/cultura, variable)
- Alba Vila (variable)
- Esperanza Ruiz (variable)
- Hughes (variable)
- José Javier Esparza (variable)
- gaceta.es/opinion/

EL DEBATE (búsqueda web eldebate.com/opinion/):
- Francisco Rosell (director, variable)
- Juan Carlos Girauta
- Antonio R. Naranjo

ESTRATEGIA DE BÚSQUEDA POR COLUMNISTA:
1. Para cada columnista que toque ese día de la semana, hacer una búsqueda específica con su nombre + fecha.
2. Si la URL del autor está disponible (listada arriba), usarla como verificación directa antes de hacer búsqueda general.
3. Para El País: usar almendron.com como puerta de entrada (su contenido tiene paywall).`;

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

ESQUEMA JSON EXACTO (devuelve SOLO estas 2 claves, NO incluyas spainNews ni spainOpinion):
{
  "date": "DD/MM/YYYY",
  "worldOpinion": [
    /* HASTA 10 piezas — PRIORITARIAS. Columnas firmadas publicadas en últimas 48h con un evento concreto detrás (no análisis evergreen). Solo medios internacionales no españoles. Distribuye entre IZQ y DER y respeta los mínimos regionales. */
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
      const dateList = (allowedDates && allowedDates.length === 2)
        ? `\n\nFECHAS ACEPTADAS (ÚNICAS DOS, sin excepción):\n- ${allowedDates[0]} (fecha de referencia / HOY)\n- ${allowedDates[1]} (día anterior)\n\nCualquier pieza con publishedDate distinto a estas dos fechas se RECHAZA. Sin "casi", sin "del fin de semana", sin "anteayer". Ventana máxima: 48h.\n\nPRIORIDAD DE FRESCURA EN OPINIÓN: dentro de las 48h, prefiere columnas de las últimas 24-36h. Las piezas de ayer son aceptables pero las de HOY siempre superiores.`
        : '';
      return `FECHA: ${todayFull || today} (hora petición: ${requestTime})${dateList}

INTERNACIONAL. Hasta 28 piezas en 2 secciones, distribuidas por regiones para cobertura global plural.

REGLAS ESTRICTAS DE FECHA:
- publishedDate DEBE estar en una de las 2 fechas aceptadas (HOY o ayer). NUNCA más antiguas.
- VENTANA: últimas 48h. Acepta piezas de HOY y ayer indistintamente.
- Si una pieza es de hace 2+ días: rechazar.
- Prioriza relevancia y calidad sobre minutos extra de frescura.

WORLDOPINION (PRIORITARIA, hasta 10 columnas firmadas):

⭐⭐⭐ MÍNIMOS OBLIGATORIOS REGIONALES ⭐⭐⭐
- 🏛️ Project Syndicate: MÍNIMO 2 columnas (análisis económico/político de élite académica · gratis · Stiglitz, Krugman, Roubini, Larry Summers, Yanis Varoufakis, etc.)
- 🌎 LATAM: MÍNIMO 2 columnas (de El Faro, Confidencial, Animal Político, Infobae, El Espectador, Clarín, El Mercurio)
- 🇪🇺 Europa Occidental: MÍNIMO 2 columnas (de Le Monde, Le Figaro u otros europeos cuando los haya)
- 🌏 Asia: MÍNIMO 2 columnas (de SCMP, Caixin, Hankyoreh, Korea Herald, JoongAng, Japan Times, CNA, Tempo, Jakarta Post, Bangkok Post, The Hindu, Indian Express)
- TOTAL mínimos garantizados: 8 columnas
- 2 columnas restantes FLEXIBLES: USA, UK, OM, África, Rusia según actualidad

HARD CAPS:
- Máx 3 columnas USA · Máx 2 columnas UK · Máx 2 columnas mismo medio
- Mín 6 medios distintos · ≥4 regiones distintas
- Solo firmadas (autor real, no editoriales institucionales)
- Solo medios internacionales no españoles
- Distribuye entre izquierda, centro y derecha
- Si una región no tiene columna fresca firmada, DÉJALA SIN cubrir (NO sustituyas con anglo extra)

CHECKLIST OBLIGATORIO antes de generar worldOpinion:
□ ¿Tengo ≥2 columnas de Project Syndicate?
□ ¿Tengo ≥2 columnas LATAM?
□ ¿Tengo ≥2 columnas Europa Occ?
□ ¿Tengo ≥2 columnas Asia?
□ ¿USA está limitado a máx 3?
□ ¿Tengo ≥6 medios distintos?
Si alguno falla, REJECT y ajusta.

WORLDNEWS (hasta 20 piezas: noticias + reportajes + análisis):
- 🎯 OBJETIVO: equilibrio entre PIEZAS CORTAS (noticias breaking) y PIEZAS LARGAS (reportajes, investigaciones, análisis profundos, perfiles, dossiers).

⭐⭐⭐ PRIORIDAD FUENTES GRATIS sobre paywall (CRÍTICO) ⭐⭐⭐
- 🔓 GRATIS internacional: Politico, The Hill, Project Syndicate, Reuters, MarketWatch, Quartz, The Guardian, UnHerd, Kyiv Independent, Moscow Times, Times of Israel, The Hindu, Indian Express, Jakarta Post, Bangkok Post, Premium Times, El Espectador, Infobae, Mail&Guardian, National Review, Global Times, China Daily, Sixth Tone, Korea Herald, Korea Times, Hankyoreh, Channel News Asia, TODAYonline, Jakarta Globe, Tempo
- 🔒 PAYWALL: NYT, WaPo, WSJ, The Atlantic, Bloomberg, FT, The Economist, Foreign Affairs, Foreign Policy, The Spectator, Le Monde, Le Figaro, Haaretz, Japan Times, Clarín, El Mercurio, New Yorker, SCMP, Caixin, The Business Times Singapore
- Si el mismo tema está en una fuente gratis y una de pago, ELIGE LA GRATIS.
- Solo usa pago si cubre un ángulo único no disponible en gratis ese día.
- Las de pago aparecen marcadas con 🔒 cuando son necesarias.

⭐⭐⭐ TEMAS A EXCLUIR OBLIGATORIAMENTE ⭐⭐⭐
NUNCA incluyas:
- 🚫 SUCESOS: asesinatos individuales, accidentes, violaciones, homicidios, atracos, incendios sin contexto político (SALVO impacto sistémico claro tipo violencia policial estructural, mafia, crimen de Estado, atentados terroristas con repercusión geopolítica).
- 🚫 DEPORTES: fútbol, ligas, fichajes, Champions, Eurocopa, NBA, NFL, F1, tenis, atletismo. NO se incluye nunca.
- 🚫 CELEBRITIES/FARÁNDULA: prensa rosa, divorcios famosos, premios Grammy, Oscars sin relevancia política, gala/alfombra roja.
- 🚫 Catástrofes naturales puras sin matiz político/humanitario importante.
SÍ incluye: política internacional, economía global, conflictos geopolíticos, diplomacia, instituciones multilaterales, ciencia/tecnología con impacto político, cultura/sociedad con relevancia estructural.

⭐⭐ REGLA ANTI-REDUNDANCIA TEMÁTICA INTERNACIONAL ⭐⭐
Para un mismo evento o tema global (ej: "Trump aranceles", "guerra Ucrania", "elecciones México", "Israel Gaza"):
- MÁXIMO 3 piezas del mismo tema, vengan del medio que vengan.
- Si hay 5+ medios cubriendo lo mismo, elige las 3 que aporten ÁNGULO DIFERENTE:
  · 1 ángulo USA (NYT/WaPo/Bloomberg/Politico)
  · 1 ángulo regional afectado (Le Monde si tema europeo, SCMP si China, Haaretz si Israel)
  · 1 análisis (Foreign Affairs / Project Syndicate / Atlantic / Economist)
- Prefiere DIVERSIDAD TEMÁTICA sobre repetición: mejor 20 temas distintos con 1 pieza cada uno que 6 temas con 3 piezas cada uno.
- Esto es especialmente crítico para Trump/USA donde 10 medios escriben sobre lo mismo: limita a 3 con ángulos distintos.

⭐⭐⭐ REGLA INELUDIBLE — MÍNIMO 5 PIEZAS LARGAS POR BRIEFING ⭐⭐⭐
Si después de seleccionar las 20 piezas tienes menos de 5 LARGAS, RECHAZA noticias breves redundantes y BUSCA EXPLÍCITAMENTE más reportajes/análisis con queries específicas. No se admite excusa "no había material": NYT, WaPo, Atlantic, FT, Bloomberg, The Economist, Foreign Affairs publican análisis profundo a diario.

ESTRATEGIA DE BÚSQUEDA DE PIEZAS LARGAS (ejecuta estas búsquedas adicionales para garantizar mínimo 5):
- site:nytimes.com investigation OR "long read" 2026
- site:washingtonpost.com investigation OR feature 2026
- site:theatlantic.com essay OR feature 2026
- site:newyorker.com 2026
- site:bloomberg.com "big take" OR features 2026
- site:ft.com "the big read" OR investigation 2026
- site:economist.com "essay" OR "briefing" 2026
- site:foreignaffairs.com 2026
- site:foreignpolicy.com 2026
- site:theguardian.com "long read" 2026
- site:project-syndicate.org 2026
- site:scmp.com 2026 (China perspectiva HK)
- site:caixinglobal.com 2026 (China negocios)
- site:globaltimes.cn 2026 (China narrativa oficial)
- site:chinadaily.com.cn 2026 (China voz oficial)
- site:sixthtone.com 2026 (China cultura/sociedad)
- site:koreaherald.com 2026 (Corea del Sur política)
- site:koreajoongangdaily.joins.com 2026 (Corea del Sur económico)
- site:english.hani.co.kr 2026 (Corea del Sur izquierda)
- site:channelnewsasia.com 2026 (Singapur regional asiático)
- site:businesstimes.com.sg 2026 (Singapur económico)
- site:jakartaglobe.id 2026 (Indonesia)
- site:en.tempo.co 2026 (Indonesia investigativo)

PIEZAS LARGAS RECONOCIBLES POR:
- Título largo y descriptivo (no titular telegráfico de agencia)
- Autor periodista firmado (no "AP" / "Reuters" / "AFP")
- Keywords inglesas en título o sección: "investigation", "deep dive", "the inside story", "long read", "feature", "essay", "explained", "what happened", "behind the scenes", "profile of", "the big read", "the big take", "briefing", "anatomy of"

CHECKLIST ANTES DE DEVOLVER JSON FINAL:
□ Cuenta cuántas de mis 20 piezas son LARGAS (reportaje/análisis/investigación/perfil/crónica)
□ Si <5, busco más con las queries de arriba y reemplazo breves repetitivas
□ Las LARGAS aportan profundidad y tiempo de lectura >3 min

- HARD CAPS: Máx 6 piezas USA · Máx 4 piezas UK · Máx 3 piezas mismo medio
⭐⭐⭐ MÍNIMOS REGIONALES — REGLA INVIOLABLE ⭐⭐⭐
ANTES de seleccionar las 20 piezas internacionales, OBLIGATORIAMENTE asegúrate de cubrir:
  · 🇪🇺 Europa Occidental (FR/DE/IT): MÍNIMO 2 piezas
  · 🌍 Europa Este (Ucrania/Polonia): MÍNIMO 1 pieza
  · 🕌 Oriente Medio (Israel/Mundo árabe/Irán): MÍNIMO 2 piezas
  · 🌏 ASIA (India + China + Japón + Corea + SE Asia): MÍNIMO 5 piezas ⭐⭐ INELUDIBLE
    - China: SCMP, Caixin, Global Times, China Daily, Sixth Tone
    - Japón: Japan Times, Asahi, Yomiuri, Nikkei Asia
    - Corea del Sur: Korea Herald, Korea Times, Korea JoongAng Daily, Hankyoreh
    - India: The Hindu, Indian Express, Times of India, Hindustan Times, Scroll.in
    - Singapur: Channel News Asia (CNA), The Business Times, TODAYonline
    - Indonesia: Jakarta Post, Jakarta Globe, Tempo, Kompas, Tirto
    - SE Asia general: Bangkok Post (Tailandia), Philippine Daily Inquirer
  · 🌎 LATAM (Argentina/México/Brasil/Colombia/Chile): MÍNIMO 4 piezas ⭐⭐ INELUDIBLE
    - Clarín, La Nación, Infobae (Argentina)
    - Folha, O Globo, Estadão (Brasil)
    - El Universal, Milenio, Reforma (México)
    - El Espectador, El Tiempo, Semana (Colombia)
    - El Mercurio, La Tercera (Chile)
    - El Faro (El Salvador, Pulitzer, investigativo)
    - Confidencial (Nicaragua/Costa Rica, Chamorro, investigativo)
  · 🌍 África (Sudáfrica/Nigeria/Kenia/Egipto): MÍNIMO 1 pieza
    - Daily Maverick, Mail & Guardian, News24 (Sudáfrica)
    - Premium Times, Vanguard, Punch (Nigeria)
    - The Africa Report, AllAfrica (panafricanos)
  · 💰 Económico global (Bloomberg/Reuters/FT/Forbes/MarketWatch/Economist): MÍNIMO 2 piezas
  · 🇷🇺 Rusia: opcional, solo si hay noticia relevante (Moscow Times, Meduza)
  · 🇦🇺 Australia / 🇹🇷 Turquía: opcionales

🚫 NO empieces a generar el JSON hasta haber MENTALMENTE confirmado que vas a cubrir cada región MÍN.
🚫 USA y UK están limitados a CAP MÁX (no MIN), no abuses de ellos. Si te falta espacio para LATAM/Asia/África, RECORTA USA/UK.

⭐⭐⭐ PRESUPUESTO OBLIGATORIO DE BÚSQUEDAS (tienes 10 búsquedas disponibles) ⭐⭐⭐
RESERVA EXPLÍCITAMENTE las siguientes búsquedas ANTES de hacer ninguna otra:

  BLOQUE 1 · PROTEGIDO (reservado, no negociable): 3 búsquedas
  1. site:dailymaverick.co.za OR site:premiumtimesng.com OR site:mg.co.za 2026
     → garantiza min 1 ÁFRICA (sin esta búsqueda, África queda en cero)
  2. site:clarin.com OR site:infobae.com OR site:lanacion.com.ar 2026
     → garantiza piezas Argentina LATAM
  3. site:folha.uol.com.br OR site:oglobo.globo.com OR site:elmercurio.com OR site:eltiempo.com OR site:elfaro.net OR site:confidencial.digital 2026
     → garantiza piezas Brasil/Chile/Colombia LATAM

  BLOQUE 2 · OBLIGATORIO (no opcional): 3 búsquedas
  4. site:scmp.com OR site:caixinglobal.com OR site:globaltimes.cn 2026  (China)
  5. site:koreaherald.com OR site:hankyoreh.com OR site:japantimes.co.jp OR site:thehindu.com OR site:indianexpress.com 2026  (Asia este+India)
  6. site:haaretz.com OR site:timesofisrael.com OR site:aljazeera.com 2026  (Oriente Medio)

  BLOQUE 3 · FLEXIBLE (4 búsquedas restantes): USA, UK, Europa Occ, Económico Global, Ucrania
  Distribúyelas según la actualidad del día.

  💡 SUGERENCIAS para columnas USA conservadoras heterodoxas:
  - The Bulwark (nunca-trumpista, intelectual)
  - National Review (conservadurismo tradicional)
  Estos aportan voces críticas con Trump desde la derecha, no solo desde la izquierda.

  💡 SUGERENCIAS para LATAM investigativo de calidad:
  - El Faro (El Salvador, Pulitzer, investigativo Bukele/maras)
  - Confidencial (Nicaragua exilio CR, Chamorro, investigativo Ortega)
  - Animal Político (México, fact-checking, investigativo)

🔴 PROHIBIDO empezar por USA y "ya veremos si llegamos a África". Ejecuta los BLOQUES 1 y 2 PRIMERO.
🔴 Si tras BLOQUE 1+2 (6 búsquedas usadas) ves que has cumplido los mínimos, puedes usar las 4 restantes para profundizar.

CHECKLIST OBLIGATORIO antes de generar (verifica DESPUÉS de las búsquedas):
□ ¿Tengo ≥1 pieza ÁFRICA? Si no, REJECT y vuelve a buscar
□ ¿Tengo ≥4 piezas LATAM? Si no, REJECT y vuelve a buscar
□ ¿Tengo ≥5 piezas Asia? Si no, REJECT y vuelve a buscar
□ ¿Tengo ≥2 piezas Oriente Medio? Si no, REJECT y vuelve a buscar
□ ¿He cubierto Le Monde/Le Figaro/Der Spiegel? (Europa Occ ≥2)
□ ¿He cubierto Kyiv Independent? (Europa Este ≥1)

Si la respuesta a alguna es NO, EJECUTA búsquedas adicionales antes de continuar.

Total mínimos: ~17 piezas garantizadas globalmente, 3 piezas flexibles para USA/UK.
- Si una región NO tiene material fresco real, deja el slot vacío (PROHIBIDO rellenar con USA/UK extras o inventar piezas)
- Equilibrio IZQ/DER
- Mezcla eventos concretos del día CON piezas largas de fondo
- Mejor 16 piezas reales (incluyendo 5+ reportajes profundos) que 20 todas breves o todas anglo
- LEGAL EMBEBIDO: si hay sentencias internacionales relevantes del día (TJUE, CIJ, TPI, Supreme Court USA, antitrust CE/FTC, etc.), inclúyelas como pieza más en worldNews con la región del tribunal. Busca en: site:law360.com, site:mlex.com, site:reuters.com/legal, site:bloomberg.com/law

CAMPO ADICIONAL EN CADA PIEZA: añade un campo opcional "pieceType" con valor "long" o "short" para que el sistema pueda contar las largas. Ejemplo: {"rank":7,"title":"...","pieceType":"long",...}

⭐ MEDIOS PRIORIZADOS POR REGIÓN (50+ medios con cobertura global plural):

🇺🇸 EEUU (6):
- nytimes.com (centro-izq) · washingtonpost.com (centro-izq) · theatlantic.com (centro-izq intelectual)
- wsj.com (centro-der financiero) · nationalreview.com (derecha intelectual) · politico.com (centro)

🇬🇧 UK (5):
- ft.com (centro financiero) · economist.com (centro liberal) · theguardian.com (izquierda)
- spectator.co.uk (derecha tradicional) · unherd.com (heterodoxo)

💰 ECONÓMICO GLOBAL (5):
- bloomberg.com / bloomberg.com/opinion (centro financiero, EEUU)
- reuters.com (centro factual)
- forbes.com (centro-der business)
- marketwatch.com (mercados EEUU)
- qz.com / quartz.com (centro tech/business)

🇪🇺 EUROPA OCCIDENTAL (3):
- lefigaro.fr (centro-der) · lemonde.fr (centro-izq) · faz.net (centro-der alemán)

🌍 EUROPA ESTE (2):
- kyivindependent.com (pro-occidental, guerra Ucrania) · wyborcza.pl (centro-izq polaco)

🕌 ORIENTE MEDIO (3):
- haaretz.com (Israel izquierda) · timesofisrael.com (Israel centro) · thenationalnews.com (Emiratos establishment Golfo)

🇮🇳 INDIA (3):
- thehindu.com (centro-izq intelectual) · indianexpress.com (centro) · timesofindia.com (popular)

🌏 ASIA ESTE (4):
- asia.nikkei.com (Japón financiero) · scmp.com (Hong Kong) · japantimes.co.jp (Japón centrista) · koreaherald.com (Corea Sur centro)

🌏 SUDESTE ASIÁTICO (4):
- straitstimes.com (Singapur centrista) · thejakartapost.com (Indonesia centro) · bangkokpost.com (Tailandia centro) · manilatimes.net (Filipinas)

🌎 LATAM POLÍTICO (7):
- clarin.com (Argentina centro-der) · lanacion.com.ar (Argentina centro-der)
- jornada.com.mx (México izquierda) · folha.uol.com.br (Brasil centro)
- oglobo.globo.com (Brasil centro-der) · elespectador.com (Colombia centro-izq)
- emol.com / elmercurio.com (Chile centro-der, decano de la prensa chilena)

🌎 LATAM ECONÓMICO (2):
- infobae.com (panregional) · valor.globo.com (Brasil financiero)

🇷🇺 RUSIA (1):
- themoscowtimes.com (independiente en exilio)

🌐 MULTILATERAL OPINIÓN (3):
- project-syndicate.org (Stiglitz, Krugman, Rajan, Acemoglu)
- foreignpolicy.com · foreignaffairs.com

🌍 ÁFRICA (5):
- dailymaverick.co.za (Sudáfrica investigativo)
- mg.co.za / Mail & Guardian (Sudáfrica centro-izq)
- premiumtimesng.com (Nigeria centro)
- theafricareport.com (panafricano francés/inglés)
- theeastafrican.co.ke (Kenia/Tanzania)

🇦🇺 AUSTRALIA (1):
- theaustralian.com.au (centro-der, Murdoch)

🇹🇷 TURQUÍA (1):
- hurriyetdailynews.com (centrista, semi-establishment)

Búsqueda recomendada: site:[dominio]/opinion ${today} para columnas firmadas, site:[dominio] ${today} para noticia general.

OUTPUT: solo JSON, sin texto antes ni después:
{"date":"DD/MM/YYYY","worldOpinion":[...],"worldNews":[...]}`;
    },
    maxUses: 10,
  },
  // spainNews y spainOpinion usan flujo Plan B (RSS pre-fetch + prompts inline)
  // No necesitan system/user aquí, solo label para validación de section válida
  spainNews: { label: 'Noticias España' },
  spainOpinion: { label: 'Opinión España' },
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

  // Intento 3: JSON truncado (cortado a la mitad) - reparación inteligente
  // Estrategia: localizar el último objeto válido dentro de cada array, recortar arrays
  // a su último elemento completo, y cerrar estructuras pendientes.
  let repaired = s;
  if (firstBalanced > 0) {
    repaired = s.slice(0, firstBalanced + 1);
  }

  // Intentar truncar arrays incompletos a su última coma válida
  // Buscamos patrones tipo `[{ ... },{ ... },{ <truncado>`
  // Algoritmo: recorrer desde el final, encontrar el último `},` o `}]` válido,
  // y truncar después de él para cerrar el array correctamente.
  function trimToLastCompleteObject(jsonStr) {
    let d = 0, b = 0, inS = false, e = false;
    let lastValidArrayPos = -1;
    let inArrayStack = [];

    for (let i = 0; i < jsonStr.length; i++) {
      const c = jsonStr[i];
      if (e) { e = false; continue; }
      if (c === '\\' && inS) { e = true; continue; }
      if (c === '"') { inS = !inS; continue; }
      if (inS) continue;

      if (c === '{') d++;
      else if (c === '}') {
        d--;
        // Si estamos dentro de un array y se acaba de cerrar un objeto bien formado
        if (b > 0 && d === inArrayStack[inArrayStack.length - 1]) {
          lastValidArrayPos = i; // posición del } que cierra el objeto en el array
        }
      }
      else if (c === '[') {
        b++;
        inArrayStack.push(d);
      }
      else if (c === ']') {
        b--;
        inArrayStack.pop();
      }
    }

    // Si quedó un array abierto con objetos válidos antes del truncamiento
    if (b > 0 && lastValidArrayPos > 0) {
      return jsonStr.slice(0, lastValidArrayPos + 1);
    }
    return jsonStr;
  }

  repaired = trimToLastCompleteObject(repaired);

  // Cerrar todas las estructuras pendientes
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
  try {
    const result = JSON.parse(repaired);
    // Marcar como recuperado parcialmente
    if (result && typeof result === 'object') {
      result._recoveredFromTruncation = true;
    }
    return result;
  } catch (err) {
    throw new Error(`JSON truncado y no reparable: ${err.message}`);
  }
}

// ============ RESÚMENES IA (Enfoque B: leer artículo + Haiku) ============
// Descarga el texto principal de un artículo para poder resumirlo.
async function fetchArticleText(url, timeoutMs = 6000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-ES,es;q=0.9',
      },
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) return '';
    const html = await res.text();
    // Extraer contenido de párrafos <p>
    const paras = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map(m => cleanText(m[1]))
      .filter(t => t.length > 40);  // descartar párrafos cortos (menús, pies)
    const text = paras.join(' ');
    return text.slice(0, 2500);  // primeros ~2500 chars (suficiente para resumir)
  } catch (_) {
    return '';
  }
}

// Genera resúmenes (1-2 frases) para varios artículos en UNA llamada a Haiku.
async function generateSummaries(articles, apiKey) {
  // articles: [{ idx, title, source, author, text }]
  if (!articles.length) return {};
  const list = articles.map(a =>
    `[${a.idx}] Medio: ${a.source}${a.author ? ' · Autor: ' + a.author : ''}\nTitular: ${a.title}\nTexto: ${a.text.slice(0, 1800)}`
  ).join('\n\n---\n\n');

  const prompt = `Eres un editor de prensa. Para cada columna de opinión numerada, escribe un resumen de 1-2 frases (máximo 220 caracteres) que capture la TESIS del autor y el tema concreto. No empieces con "El autor" ni "La columna". Ve directo al contenido. Devuelve SOLO un objeto JSON válido {"resúmenes": {"0": "...", "1": "..."}} sin texto adicional ni markdown.

COLUMNAS:
${list}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    clearTimeout(timer);
    if (!resp.ok) return {};
    const data = await resp.json();
    const text = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return parsed['resúmenes'] || parsed['resumenes'] || {};
  } catch (_) {
    return {};
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

  const { date, dateFull, requestTime, section, excludeUrls } = req.body || {};
  // excludeUrls: array de URLs (de briefings recientes) que el modelo debe IGNORAR
  // para evitar repetir piezas día tras día.
  const excludeUrlsSet = new Set(Array.isArray(excludeUrls) ? excludeUrls : []);
  const todayShort = date || new Date().toLocaleDateString('es-ES');
  const todayFull = dateFull || todayShort;
  const nowTime = requestTime || 'no especificada';

  // Calcular las TRES fechas ISO aceptadas (ayer, hoy, mañana UTC).
  // Incluimos "mañana" para cubrir bordes de timezone: piezas publicadas 00-02h Madrid
  // tienen pubDate UTC del día siguiente, y serían rechazadas incorrectamente.
  const allowedISODates = (() => {
    try {
      const parts = todayShort.split('/').map(p => parseInt(p, 10));
      const [d, m, y] = parts;
      const ref = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      const yest = new Date(ref.getTime() - 24 * 60 * 60 * 1000);
      const iso = (dt) => dt.toISOString().slice(0, 10);

      // ¿La fecha seleccionada es HOY (o futuro) respecto al servidor?
      const nowIso = new Date().toISOString().slice(0, 10);
      const refIso = iso(ref);
      const isToday = refIso >= nowIso;

      if (isToday) {
        // HOY: incluimos mañana por casos de zona horaria (artículos nocturnos en UTC+1)
        const tomorrow = new Date(ref.getTime() + 24 * 60 * 60 * 1000);
        return [refIso, iso(yest), iso(tomorrow)];
      }
      // FECHA PASADA: solo el día seleccionado + el anterior (NUNCA el día siguiente)
      return [refIso, iso(yest)];
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
      const { candidates, diagnostic } = await fetchSpainOpinionRss(allowedISODates, excludeUrlsSet);

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

      // Lista de periodistas conocidos (de noticias, NO columnistas) por medio.
      // Si una pieza está firmada por uno de ellos, NO es columna de opinión.
      const KNOWN_NEWS_REPORTERS = {
        'The Objective': ['roberto alcolea', 'juan carlos téllez', 'juan carlos tellez', 'fran serrato', 'luis manuel rafael', 'antonio rodríguez', 'antonio rodriguez'],
        'Libertad Digital': ['paco cobos', 'pablo pardo', 'miguel ángel pérez', 'miguel angel perez', 'miguel puga'],
        'elDiario.es': ['javier lillo', 'elena herrera', 'pedro águeda', 'pedro agueda'],
      };

      // Pre-filtro de opinión: marcar candidatos como ✅ COLUMNA o ❌ NOTICIA/EDITORIAL
      // para que el modelo los distinga visualmente.
      const isOpinionPiece = (c) => {
        const author = String(c.author || '').trim();
        if (!author) return false;
        const aLow = author.toLowerCase();
        const sLow = String(c.source || '').toLowerCase();
        if (aLow === sLow) return false;
        if (aLow.includes('redacción') || aLow.includes('redaccion')) return false;
        if (aLow === 'editorial' || aLow === 'opinión' || aLow === 'opinion') return false;
        if (aLow.includes('sumario')) return false;
        // Multi-autores = noticia (Y, comas)
        if (author.includes(' y ') || author.includes(', ')) return false;
        // Periodista conocido de noticias del medio
        const reporters = KNOWN_NEWS_REPORTERS[c.source] || [];
        if (reporters.some(r => aLow === r)) return false;
        const title = String(c.title || '').toLowerCase();
        if (title.startsWith('sumario') || title.startsWith('en sumario') || title.startsWith('boletín')) return false;
        if (title.includes('claves del día')) return false;
        return true;
      };

      const candidatesText = candidates.map((c, i) => {
        const tag = isOpinionPiece(c) ? '✅ COLUMNA' : '❌ NOTICIA/EDITORIAL — NO USAR EN OPINIÓN';
        return `[${i + 1}] ${tag} | ${c.source} | ${c.publishedDate || 'fecha?'} | ${c.author || 'sin autor'} | ${c.title}\n   URL: ${c.url}\n   Resumen: ${c.description.slice(0, 200)}`;
      }).join('\n\n');

      const userPrompt = `FECHA: ${todayFull || todayShort}

Tienes a continuación una lista de ${candidates.length} piezas de medios españoles (mayoritariamente opinión, algunas noticias o análisis), ya filtradas por fecha (publicadas en una de las 2 fechas aceptadas: ${allowedISODates.join(' o ')}) y por timestamp (últimas 36h).

⚠️ MARCADO AUTOMÁTICO DE PIEZAS:
- ✅ COLUMNA = pieza con autor humano real → CANDIDATA VÁLIDA
- ❌ NOTICIA/EDITORIAL = sin autor real, autor = nombre del medio, "Sumario", "Editorial", etc → NO INCLUIR EN OPINIÓN

REGLA INELUDIBLE: Las piezas marcadas con ❌ son NOTICIAS o EDITORIALES institucionales. NUNCA las incluyas en spainOpinion. Solo las piezas marcadas con ✅ pueden formar parte del briefing de opinión. Si tras filtrar quedan menos de 20 columnas válidas, devuelve menos pero TODAS deben ser ✅.

✅ PERMITIDO devolver MENOS columnas si no hay material fresco suficiente. Mejor 10-12 columnas de calidad fresca que 20 mediocres o de hace 36+ horas. Objetivo ideal: 20 columnas.

⭐⭐⭐ COLUMNISTAS PRIORITARIOS A SEGUIR ⭐⭐⭐
Si en CANDIDATAS aparece una columna firmada por uno de estos autores, DEBES INCLUIRLA (siempre respetando los hard caps por medio). Son los referentes que el usuario quiere ver en su briefing diario:

VOZPÓPULI ⭐:
- Ignacia de Pano (martes), Gorka Maneiro, Carlos Martínez Gorriarán, Jesús Banegas, José Alejandro Vara, Manuel Marín (lunes, director), Irene González, Rubén Manso, Jesús Cacho (domingo), Agustín Valladolid (jueves), Pablo Sebastián, Víctor Lenore, José Antonio Montano, Esperanza Ruiz, Mariona Gumpert

THE OBJECTIVE ⭐:
- Guadalupe Sánchez, Antonio Caño, Manuel Arias Maldonado, Álvaro Nieto, Javier Benegas (viernes), Ketty Garat, Iván Vélez, Esperanza Aguirre, Jorge San Miguel, Pablo de Lora (sábados), Manuel Fernández Ordóñez, Victoria Carvajal (sábados), Maite Rico (martes "Sujétame el vermú"), Pablo Cambronero, Juan Luis Cebrián

EL ESPAÑOL:
- Cristian Campos, Pedro J. Ramírez (domingos), Lorena G. Maldonado, Lorenzo Bernaldo de Quirós (domingos), José Ramón Pin Arboledas

LIBERTAD DIGITAL:
- Federico Jiménez Losantos (domingos, columna escrita)

EL DIARIO:
- Ignacio Escolar

EL PAÍS:
- Estefanía Molina (jueves), Diego S. Garrocho Salcedo, Lluís Bassets, Ana Iris Simón, Ángeles Caballero, Daniel Gascón

EL MUNDO:
- Arcadi Espada, Pedro G. Cuartango, Jorge Bustos

EL DEBATE:
- Francisco Rosell (director), Juan Carlos Girauta, Antonio R. Naranjo

LA GACETA:
- Iván Vélez, Alba Vila, Esperanza Ruiz, Hughes, José Javier Esparza

OK DIARIO:
- Graciano Palomo

REGLA IMPORTANTE: si una pieza tiene como author/firma uno de estos nombres, esa columna VA dentro del briefing (respetando los caps por medio). Si la pieza tiene otro autor del mismo medio, la juzgas por su calidad y relevancia.

⭐ MEDIOS PREFERIDOS DEL USUARIO (orden de prioridad, prioriza los primeros):
1. Vozpópuli ⭐
2. Artículo 14 ⭐
3. The Objective
4. Huffington Post (izquierda, gratis)
5. Público (izquierda, gratis)
6. La Gaceta
7. Libertad Digital
8. elDiario.es
Si hay candidatas válidas de estos medios, INCLÚYELAS en este orden de preferencia hasta el cap de cada uno.

REGLAS DE SELECCIÓN (en orden de prioridad):
1. Selecciona piezas con autor real cuando sea posible. Si las piezas no tienen autor pero la URL contiene "/opinion/" "/comentario/" "/tribuna/" "/blog/" "/elsubjetivo/" o similar, también CUENTAN como columna válida. EXCEPCIÓN: items con source "Agenda Pública" o "Artículo 14" pueden incluirse aunque no aparezca autor (Google News no expone el autor, pero los artículos originales son análisis firmados de calidad).
2. HARD CAPS INVIOLABLES por medio (NO se pueden superar):
   - Vozpópuli: MÁX 5 columnas ⭐⭐⭐ MÍN 4 OBLIGATORIO si hay ≥5 candidatos en RSS (ver diagnóstico)
     · Vozpópuli es el medio #1 del usuario · si el diagnóstico muestra ≥5 piezas en 48h, ES OBLIGATORIO incluir ≥4 columnas
     · ACEPTA piezas SIN campo author si la URL contiene "/opinion/" o "/firmas/" o "/tribuna/" o "/blog/"
     · Si Google News RSS devuelve URL redirect tipo news.google.com/articles/, ASUME que es columna de opinión (el feed solo trae /opinion/)
   - Artículo 14: MÁX 4 columnas ⭐
   - The Objective: MÁX 5 columnas ⭐⭐⭐ (MÍN 2)
   - Huffington Post: MÁX 2 columnas (izquierda alternativa, gratis)
   - Público: MÁX 2 columnas (izquierda alternativa, gratis)
   - La Gaceta: MÁX 3 columnas
   - Libertad Digital: MÁX 3 columnas
   - Agenda Pública: MÁX 2 columnas
   - elDiario.es: MÁX 2 columnas
   - El País: MÁX 3 columnas
   - El Mundo: MÁX 2 columnas
   - OK Diario: MÁX 2 columnas
   - El Debate: MÁX 2 columnas
   - El Blog Salmón: MÁX 2 columnas (análisis económico divulgativo · MÍN 1)
   - Economía de Mallorca: MÁX 2 columnas (regional Baleares · análisis local)
   - Crónica Global: MÁX 2 columnas (Cataluña · análisis catalán)
   - Ethic: MÁX 2 columnas (revista intelectual · filosofía/sociedad/ética)
   - Letras Libres: MÁX 2 columnas (revista cultural intelectual · ensayo político-cultural)
2.bis MÍNIMOS OBLIGATORIOS (condicionales — solo aplican si hay material en CANDIDATAS):
- Si en CANDIDATAS aparece ≥3 items de "Vozpópuli", DEBES incluir mínimo 3 columnas suyas (cap MÁX 5). ⭐⭐ INELUDIBLE
- Si aparece ≥2 items de "Artículo 14", DEBES incluir mínimo 2 columnas suyas. ⭐
- Si aparece ≥2 items de "The Objective", DEBES incluir mínimo 2 columnas suyas (cap MÁX 5). ⭐⭐⭐ INELUDIBLE
- Si aparece ≥1 item de "elDiario.es", DEBES incluir mínimo 1 columna suya.
- Si aparece ≥1 item de "Huffington Post", DEBES incluir mínimo 1 columna suya (izquierda).
- Si aparece ≥1 item de "Público", DEBES incluir mínimo 1 columna suya (izquierda).
- Si aparece ≥2 items de "Libertad Digital", DEBES incluir mínimo 2 columnas suyas.
- Si aparece ≥1 item de "La Gaceta", DEBES incluir mínimo 1.
- Si aparece ≥1 item de "Agenda Pública" o "El País", DEBES incluir mínimo 1 de cada uno.
- Si aparece ≥1 item de "El Mundo", DEBES incluir mínimo 1.
- Si aparece ≥1 item de "OK Diario", DEBES incluir mínimo 1.
- Si aparece ≥1 item de "El Debate", DEBES incluir mínimo 1.
- Si aparece ≥1 item de "El Blog Salmón", DEBES incluir mínimo 1.
- Si aparece ≥1 item de "Economía de Mallorca", DEBES incluir mínimo 1 (foco Baleares).
- Si aparece ≥1 item de "Ethic", DEBES incluir mínimo 1 (análisis intelectual/ético).
- Si aparece ≥1 item de "Letras Libres", DEBES incluir mínimo 1 (ensayo cultural/político).
- Si aparece ≥1 item de "Crónica Global", DEBES incluir mínimo 1 (perspectiva catalana).

CHEQUEO PRE-RESPUESTA OBLIGATORIO:
Antes de devolver el JSON, RECUENTA cuántas columnas hay de cada medio prioritario.

⭐ VERIFICACIÓN VOZPÓPULI (CRÍTICA):
   - Si hubo ≥5 candidatos Vozpópuli en la lista RSS → DEBE haber ≥4 columnas Vozpópuli en el output
   - Si hubo 3-4 candidatos Vozpópuli → DEBE haber ≥3 columnas Vozpópuli en el output
   - Si hubo 1-2 candidatos Vozpópuli → DEBE haber ese número de columnas Vozpópuli
   - SI VIOLAS ESTA REGLA, REHAZ EL OUTPUT desde cero

Si The Objective < 3 y había ≥3 candidatos de The Objective en la lista → REHAZ la selección.
Este chequeo NO ES OPCIONAL.

REGLA CLAVE: estos mínimos SOLO aplican si hay candidatos suficientes en los RSS. Si Vozpópuli ese día solo tiene 1 columna (o ninguna) en CANDIDATAS, no fuerzas un mínimo de 2.

ESTAS PREFERENCIAS DEL USUARIO TIENEN PRIORIDAD sobre tu criterio editorial de "qué es más relevante". Si una columna de Vozpópuli existe y es válida, va dentro, aunque encuentres otras 3 que te parezcan más interesantes. El usuario quiere SUS medios, no los que tú prefieras.
3. Selecciona HASTA 20 columnas en total — pero menos si no hay material fresco suficiente.
4. MÍNIMO 3 medios distintos en el resultado (si hay material para ello).
5. PREFIERE: piezas con autor real (descartar solo "Redacción anónima" o "Editorial sin firma").
6. Prioriza diversidad ideológica/temática entre medios.

EJEMPLO DE DISTRIBUCIÓN IDEAL si hay corpus suficiente:
- Vozpópuli: 4 (preferido #1, tope)
- Artículo 14: 3 (preferido #2)
- The Objective: 2 (preferido #3)
- Huffington Post: 1 (izquierda, mínimo 1)
- Público: 1 (izquierda, mínimo 1)
- La Gaceta: 2 (preferido #6)
- Libertad Digital: 2 (preferido #7)
- elDiario.es: 1 (preferido #8, mínimo 1)
- Agenda Pública: 1 (mínimo)
- El País: 1 (mínimo)
- El Mundo: 1 (mínimo)
- Total: 19 → ajusta a 20 según calidad (objetivo)

Si un medio preferido no tiene candidatas, completa con los siguientes en orden de preferencia.

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
          max_tokens: 12000,
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
        // Lista de periodistas conocidos (noticias, NO columnistas) por medio
        const KNOWN_NEWS_REPORTERS_POST = {
          'The Objective': ['roberto alcolea', 'juan carlos téllez', 'juan carlos tellez', 'fran serrato', 'luis manuel rafael', 'antonio rodríguez', 'antonio rodriguez'],
          'Libertad Digital': ['paco cobos', 'pablo pardo', 'miguel ángel pérez', 'miguel angel perez', 'miguel puga'],
          'elDiario.es': ['javier lillo', 'elena herrera', 'pedro águeda', 'pedro agueda'],
          };

        // ============ FILTRO OPINIÓN ESTRICTO ============
        // Detecta si una pieza es realmente columna firmada (no noticia/editorial/sumario)
        const isOpinionLike = (item) => {
          const url = String(item.url || '').toLowerCase();
          const fromUrl = String(item._fromUrl || '').toLowerCase();
          const sourceLow = String(item.source || '').toLowerCase();
          const title = String(item.title || '').trim().toLowerCase();

          // Rechazos por título (noticia/sumario) — aplican siempre
          if (title.startsWith('sumario')) return false;
          if (title.startsWith('en sumario')) return false;
          if (title.startsWith('boletín')) return false;
          if (title.includes('claves del día')) return false;

          // ⭐ ACEPTACIÓN POR URL/FEED DE OPINIÓN (aunque NO haya autor):
          // Google News RSS no expone <author>, pero si la URL o el feed es de
          // sección opinión/columnas, ES una columna. Cubre Vozpópuli y similares.
          const opinionPathRe = /\/(opinion|opinión|columnas|firmas|tribuna|blogs?)\b/i;
          if (opinionPathRe.test(url) || opinionPathRe.test(fromUrl)) return true;
          // Feeds VIP de autor (vip:Maneiro, etc.) → siempre opinión
          if (String(item._fromTier || '').startsWith('vip:')) return true;

          // A partir de aquí, modo estricto: requiere autor real
          if (!item.author) return false;
          const author = String(item.author).trim();
          if (!author) return false;
          const authorLow = author.toLowerCase();
          if (authorLow === sourceLow) return false;                  // "THE OBJECTIVE" como autor
          if (authorLow.includes('redacción') || authorLow.includes('redaccion')) return false;
          if (authorLow === 'editorial' || authorLow === 'opinión' || authorLow === 'opinion') return false;
          if (authorLow.includes('sumario')) return false;
          // Multi-autores = noticia
          if (author.includes(' y ') || author.includes(', ')) return false;
          // Periodista conocido de noticias
          const reporters = KNOWN_NEWS_REPORTERS_POST[item.source] || [];
          if (reporters.some(r => authorLow === r)) return false;

          return true;
        };

        // ============ LIMPIEZA SELECCIÓN MODELO ============
        // Si el modelo metió noticias/editoriales en spainOpinion, las quitamos
        // y las RECLASIFICAMOS como extraNews para añadirlas a Noticias España
        const originalItems = briefing.spainOpinion || [];
        const cleanedItems = originalItems.filter(isOpinionLike);
        const removedItems = originalItems.filter(i => !isOpinionLike(i));
        const cleanupLog = removedItems.map(i => `↪${i.source}: ${i.author || 'sin autor'} - ${String(i.title || '').slice(0, 60)}`);

        // Convertir noticias coladas en formato newsItem
        const extraNewsFromOpinion = removedItems.map(i => ({
          title: i.title,
          summary: i.summary,
          source: i.source,
          url: i.url,
          publishedDate: i.publishedDate,
          author: i.author,
          region: 'España',
          lean: i.lean || null,
          _reclassified: true,  // flag para el frontend
        }));

        briefing.spainOpinion = cleanedItems;
        briefing.extraNews = extraNewsFromOpinion;

        // Marcar con _isPaywall las piezas de fuentes paywall (para que el frontend muestre 🔒)
        // Marcar con _isPressReader las piezas disponibles en PressReader (para badge 📚)
        const markPaywall = (arr) => {
          if (!Array.isArray(arr)) return;
          arr.forEach(item => {
            if (item && isPaywallSource(item.source)) {
              item._isPaywall = true;
            }
            if (item && isPressReaderAvailable(item.source)) {
              item._isPressReader = true;
            }
          });
        };
        markPaywall(briefing.spainOpinion);
        markPaywall(briefing.extraNews);

        // Enriquecer piezas con imagen desde candidatos (matching por URL)
        const candidatesByUrl = new Map();
        candidates.forEach(c => {
          if (c.url) candidatesByUrl.set(c.url, c);
        });
        const enrichImages = (arr) => {
          if (!Array.isArray(arr)) return;
          arr.forEach(item => {
            if (item && item.url && !item.image) {
              const cand = candidatesByUrl.get(item.url);
              if (cand && cand.image) item.image = cand.image;
            }
          });
        };
        enrichImages(briefing.spainOpinion);
        enrichImages(briefing.extraNews);

        // ============ ENFORCEMENT POST-MODELO ============
        // Si el modelo no cumple los mínimos obligatorios, FORZAR añadiendo del pool de candidatos
        // SOLO se fuerzan piezas que pasen isOpinionLike (autor real, no sumarios, no editoriales)
        const REQUIRED_MIN = {
          'Vozpópuli': 4,
          'Artículo 14': 2,
          'The Objective': 2,
          'elDiario.es': 1,
          'Huffington Post': 1,
          'Público': 1,
          'La Gaceta': 1,
          'Libertad Digital': 2,
          'Agenda Pública': 1,
          'El País': 1,
          'El Mundo': 1,
          'OK Diario': 1,
          'El Debate': 1,
          'El Blog Salmón': 1,
          'Economía de Mallorca': 1,
          'Crónica Global': 1,
          'Ethic': 1,
          'Letras Libres': 1,
        };

        let items = briefing.spainOpinion || [];
        const enforcementLog = [];
        const skippedNonOpinion = [];

        const countPerSource = (arr) => arr.reduce((acc, x) => {
          acc[x.source] = (acc[x.source] || 0) + 1;
          return acc;
        }, {});

        for (const [source, minRequired] of Object.entries(REQUIRED_MIN)) {
          // Solo candidatos de este source QUE SEAN OPINIÓN (con autor real)
          const allFromSource = candidates.filter(c => c.source === source);
          const opinionFromSource = allFromSource.filter(isOpinionLike);

          const rejected = allFromSource.length - opinionFromSource.length;
          if (rejected > 0) {
            skippedNonOpinion.push(`${source}: ${rejected} no-opinión filtradas`);
          }

          if (opinionFromSource.length === 0) continue;

          const currentCounts = countPerSource(items);
          const current = currentCounts[source] || 0;
          const effectiveMin = Math.min(minRequired, opinionFromSource.length);

          if (current < effectiveMin) {
            const usedUrls = new Set(items.map(i => i.url));
            const usedTitles = new Set(items.map(i => i.title));
            let available = opinionFromSource.filter(c =>
              !usedUrls.has(c.url) && !usedTitles.has(c.title)
            );

            // Preferir feeds VIP de autor sobre feed general
            available = available.sort((a, b) => {
              const aVip = String(a._fromTier || '').startsWith('vip:') ? 0 : 1;
              const bVip = String(b._fromTier || '').startsWith('vip:') ? 0 : 1;
              if (aVip !== bVip) return aVip - bVip;
              // Después, secciones de opinión sobre feed general
              const aOpinion = (a._fromTier === 'section' || a._fromTier === 'category' || a._fromTier === 'opinion') ? 0 : 1;
              const bOpinion = (b._fromTier === 'section' || b._fromTier === 'category' || b._fromTier === 'opinion') ? 0 : 1;
              return aOpinion - bOpinion;
            });

            const needed = effectiveMin - current;
            const toAdd = available.slice(0, needed);

            toAdd.forEach(c => {
              // La descripción ya viene limpia de parseFeedItems. Si tras limpiar
              // queda vacía o demasiado corta (típico de Google News), usar mensaje claro.
              const cleanDesc = String(c.description || '').trim();
              const goodDesc = cleanDesc.length >= 40 && !/^https?:/i.test(cleanDesc);
              items.push({
                title: c.title,
                summary: goodDesc ? cleanDesc.slice(0, 220) : `Columna de opinión${c.author ? ' de ' + c.author : ''} en ${c.source}. Pulsa para leer el texto completo.`,
                author: c.author,
                source: c.source,
                url: c.url,
                publishedDate: c.publishedDate,
                lean: null,
                _forced: true,
              });
              enforcementLog.push(`+${c.source} [${c._fromTier || 'main'}]: ${c.author} - ${c.title.slice(0, 50)}`);
            });
          }
        }

        briefing.spainOpinion = items;
        // ============ FIN ENFORCEMENT ============

        // ============ RESÚMENES IA (Enfoque B) para columnas forzadas/sin resumen ============
        // Las columnas forzadas (y las que tienen resumen pobre) se enriquecen leyendo
        // el artículo y resumiéndolo con Haiku. Coste ~$0.01/briefing.
        try {
          const needsSummary = items.filter(it =>
            it._forced || !it.summary || it.summary.length < 40 || /pulsa para leer/i.test(it.summary)
          ).slice(0, 8);  // máx 8 para acotar tiempo/coste

          if (needsSummary.length > 0) {
            // Descargar textos en paralelo (timeout corto)
            const withText = await Promise.all(needsSummary.map(async (it, i) => {
              const text = await fetchArticleText(it.url, 6000);
              return { idx: i, ref: it, title: it.title, source: it.source, author: it.author, text };
            }));
            const valid = withText.filter(a => a.text && a.text.length > 100);
            if (valid.length > 0) {
              const summaries = await generateSummaries(valid, apiKey);
              valid.forEach(a => {
                const s = summaries[String(a.idx)];
                if (s && s.trim().length > 20) {
                  a.ref.summary = s.trim().slice(0, 240);
                  a.ref._aiSummary = true;
                }
              });
            }
          }
        } catch (_) { /* si falla el resumen IA, mantenemos el placeholder */ }
        // ============ FIN RESÚMENES IA ============


        const selectedCount = items.length;
        const sourceCounts = candidates.reduce((acc, c) => {
          acc[c.source] = (acc[c.source] || 0) + 1;
          return acc;
        }, {});
        briefing._meta = {
          totalCandidates: candidates.length,
          selectedCount,
          mediumsAvailable: [...new Set(candidates.map(c => c.source))].length,
          candidatesPerSource: sourceCounts,
          allowedDates: allowedISODates,
          feedDiagnostic: diagnostic,
          enforcementLog: enforcementLog,
          enforcedCount: enforcementLog.length,
          skippedNonOpinion: skippedNonOpinion,
          cleanupLog: cleanupLog,
          cleanupCount: cleanupLog.length,
        };
        // Si el modelo IGNORÓ la regla "NUNCA vacío", añadir diagnóstico crítico
        const notes = [];
        if (selectedCount === 0 && candidates.length > 0) {
          notes.push(`⚠️ El modelo recibió ${candidates.length} candidatos de ${briefing._meta.mediumsAvailable} medios pero seleccionó 0. Posible filtro excesivo.`);
        }
        if (cleanupLog.length > 0) {
          notes.push(`↪️ Reclasificadas: ${cleanupLog.length} pieza(s) movidas de Opinión a Noticias por no ser columnas firmadas: ${cleanupLog.slice(0, 5).join(' | ')}${cleanupLog.length > 5 ? '...' : ''}`);
        }
        if (enforcementLog.length > 0) {
          notes.push(`🔧 Se forzaron ${enforcementLog.length} columna(s) por cuotas mínimas: ${enforcementLog.slice(0, 5).join(' | ')}${enforcementLog.length > 5 ? '...' : ''}`);
        }
        if (notes.length > 0) briefing._note = notes.join(' || ');
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
      const { candidates, diagnostic } = await fetchSpainNewsRss(allowedISODates, excludeUrlsSet);

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

      // Detectar piezas largas (reportajes/investigaciones/análisis)
      const LONG_KEYWORDS = [
        'reportaje', 'investigación', 'investigacion', 'análisis', 'analisis',
        'crónica', 'cronica', 'perfil', 'dossier', 'claves', 'qué hay detrás',
        'que hay detras', 'por qué', 'por que', 'la historia', 'el caso',
        'cómo', 'como',
      ];
      // Patrones de URL típicos de piezas largas (más fiables que length del RSS)
      const LONG_URL_PATTERNS = [
        /\/reportaje[s]?\//i,
        /\/investigaci[oó]n[es]?\//i,
        /\/an[aá]lisis\//i,
        /\/cr[oó]nica[s]?\//i,
        /\/perfil[es]?\//i,
        /\/dossier[es]?\//i,
        /\/historia[s]?\//i,
        /\/entrevista[s]?\//i,
        /\/elsubjetivo\//i,       // The Objective sección reportajes
        /\/desentra[ñn]a\//i,     // patrón desentraña URL
        /\/long[\-_]?read/i,
        /\/feature[s]?\//i,
        /\/in[\-_]depth\//i,
      ];
      const isLongFormPiece = (c) => {
        // URL pattern = señal más fiable
        const url = String(c.url || '');
        for (const pattern of LONG_URL_PATTERNS) {
          if (pattern.test(url)) return true;
        }
        const descLen = String(c.description || '').length;
        const titleLen = String(c.title || '').length;
        const author = String(c.author || '').trim();
        // Multi-autores casi siempre indica investigación
        if (author.includes(' y ') || author.includes(', ')) return true;
        // Descripción larga = pieza desarrollada (umbral bajado a 250)
        if (descLen > 250) return true;
        // Título muy largo y descriptivo
        if (titleLen > 80) return true;
        // Keywords típicas de pieza larga en título
        const titleLow = String(c.title || '').toLowerCase();
        if (LONG_KEYWORDS.some(k => titleLow.includes(k))) return true;
        return false;
      };

      const candidatesText = candidates.map((c, i) => {
        const tag = isLongFormPiece(c) ? '📊 LARGA' : '📰 BREVE';
        const desc = String(c.description || '').slice(0, 300);
        const authorStr = c.author ? ` | autor: ${c.author}` : '';
        return `[${i + 1}] ${tag} | ${c.source} | ${c.publishedDate || 'fecha?'}${authorStr} | ${c.title}\n   URL: ${c.url}\n   Resumen (${(c.description || '').length} chars): ${desc}`;
      }).join('\n\n');

      const longCount = candidates.filter(isLongFormPiece).length;

      const userPrompt = `FECHA: ${todayFull || todayShort}

Tienes a continuación una lista de ${candidates.length} piezas de medios españoles, de las cuales ${longCount} están marcadas como 📊 LARGA (reportajes/investigaciones/análisis) y el resto como 📰 BREVE (noticias del día).

🎯 OBJETIVO: armar un briefing equilibrado de NOTICIAS BREVES + PIEZAS LARGAS. Ambos formatos son valiosos.

⭐ REGLA INELUDIBLE DE PIEZAS LARGAS:
${longCount >= 5
  ? `- En la lista hay ${longCount} piezas marcadas con 📊 LARGA. DEBES incluir MÍNIMO 5 de ellas en tu selección.`
  : longCount >= 3
  ? `- En la lista hay ${longCount} piezas marcadas con 📊 LARGA. DEBES incluir MÍNIMO ${longCount} (todas ellas si la calidad lo permite).`
  : `- En la lista solo hay ${longCount} piezas marcadas con 📊 LARGA. Inclúyelas TODAS si son relevantes y frescas.`
}
- Las piezas 📊 LARGA son: reportajes de investigación (varios firmantes), análisis en profundidad, crónicas, perfiles, dossiers. Tu briefing es más rico si las incluyes.

REGLAS DE SELECCIÓN:
0. ⭐ PRIORIDAD FUENTES GRATIS sobre paywall (CRÍTICO):
   - 🔓 GRATIS: Vozpópuli, Artículo 14, OK Diario, Libertad Digital, La Gaceta, El Debate, Demócrata, Agenda Pública, El Blog Salmón, Crónica Global, The Objective, elDiario.es
   - 🔒 PAYWALL: El País, El Mundo, ABC, El Español, Cinco Días
   - Si el mismo evento/tema está cubierto por una gratis y una de pago, ELIGE LA GRATIS.
   - Solo selecciona una de pago si cubre un tema/ángulo único que ninguna gratis trata ese día.
   - Esto NO elimina las de pago: aparecen marcadas con 🔒 si son necesarias.
1. Devuelve las piezas que haya. Si solo hay 8 frescas y relevantes, devuelve 8. No fuerces el cupo.
2. Selecciona HASTA 25 piezas (puedes devolver menos si la lista es corta).
3. PRIORIZA eventos concretos del día: votaciones, sentencias, declaraciones políticas, datos económicos, leyes aprobadas, decisiones judiciales con relevancia institucional.
4. DESCARTA OBLIGATORIAMENTE:
   - 🚫 SUCESOS: asesinatos, accidentes, violaciones, homicidios, atracos, incendios sin contexto político (SALVO si tienen impacto político/sistémico claro tipo violencia policial, mafia conocida, crimen de Estado).
   - 🚫 DEPORTES: fútbol, ligas, fichajes, resultados, Eurocopa, baloncesto, F1, tenis. NO se incluye nunca.
   - 🚫 CELEBRITIES/FARÁNDULA: prensa rosa, divorcios famosos, GH, Eurovisión, gala/alfombra roja, OT, MasterChef.
   - 🚫 Columnas firmadas de opinión solitaria, evergreen sin actualidad, editoriales institucionales.
   - 🚫 Catástrofes naturales sin matiz político importante.
5. IDEAL si hay corpus suficiente: MÁX 4 piezas mismo medio, MÍN 7 medios distintos.
6. ACEPTABLE si corpus limitado: hasta 4 piezas mismo medio, mín 4 medios distintos.
7. MEDIOS PRIORITARIOS — MÍNIMOS OBLIGATORIOS (condicionales si hay material en CANDIDATAS):
   GENERALISTAS NÚCLEO (mín 2-4 cada uno si hay material):
   · Vozpópuli ⭐⭐: MÍN 4 (MÁX 6) — fuente principal
   · El País: MÍN 2 (paywall, ángulo centro-izquierda)
   · elDiario.es: MÍN 2 (izquierda, gratis)
   · Libertad Digital: MÍN 2 (derecha clásica)
   · The Objective ⭐: MÍN 3 (análisis centro, MÁX 4)

   COMPLEMENTARIOS (mín 1 cada uno si hay ≥1 item):
   · ABC, La Gaceta, OK Diario, El Debate, Huffington Post, Público, Crónica Global, El Nacional.cat: MÍN 1

   ⭐ ECONÓMICO OBLIGATORIO: Invertia + Economía de Mallorca + Cinco Días cuentan como bloque económico.
     Si entre los tres aparecen ≥3 items, DEBES incluir mínimo 3 piezas económicas.
     Si hay menos material, inclúyelo todo.

   ⭐ REGIONALES BALEARES OBLIGATORIO: si aparece ≥2 items totales entre "OK Diario Baleares",
     "elDiario.es Baleares" y "El Debate Baleares", DEBES incluir mínimo 2 piezas baleares
     (hasta 3 máximo). Si solo hay 1, incluir esa 1.

   ⭐⭐ DEMÓCRATA INELUDIBLE: si aparece ≥2 items de "Demócrata", DEBES incluir mínimo 2 piezas suyas.
       Si solo hay 1, incluir esa 1.

   Suma de mínimos posibles: ~25 piezas obligatorias.
   El modelo debe respetar los mínimos OBLIGATORIOS (⭐⭐) y luego priorizar lo demás según relevancia.

8. Equilibrio temático: política, economía, sociedad, justicia/corrupción de relevancia política, internacional con foco España, cultura/ciencia/tecnología.

⭐⭐ REGLA ANTI-REDUNDANCIA TEMÁTICA ⭐⭐
Para un mismo evento o tema (ej: "Sánchez recula con el IVA", "sentencia caso Ábalos", "trama Acciona-Sumar"):
- MÁXIMO 3 piezas del mismo tema, vengan del medio que vengan.
- Si hay 5+ medios cubriendo lo mismo, elige las 3 que aporten ÁNGULO DIFERENTE:
  · 1 de izquierda (El País / elDiario.es / HuffPost / Público)
  · 1 de derecha (Vozpópuli / Libertad Digital / OK Diario / La Gaceta)
  · 1 análisis/centro (The Objective / Demócrata / Letras Libres)
- Si las 3 cubren exactamente lo mismo sin ángulo distinto, REDUCE a 2 o 1 y libera espacio para otro tema diferente.
- Prefiere DIVERSIDAD TEMÁTICA sobre repetición: mejor 25 temas distintos que 8 temas con 3 piezas cada uno.

CHEQUEO PRE-RESPUESTA:
- Antes del JSON, mentalmente agrupa las 25 piezas por TEMA.
- Si algún tema tiene más de 3 piezas → recorta a 3 con ángulos diversos.
- Si tras recortar quedas en menos de 25, busca temas distintos no cubiertos.
9. Mejor pocas piezas relevantes y frescas que muchas mediocres o forzadas.

CHEQUEO PRE-RESPUESTA OBLIGATORIO:
Antes de devolver el JSON, RECUENTA cuántas noticias hay de cada medio prioritario y verifica los mínimos:
- ¿Tienes 4 de Vozpópuli si aparecían ≥4? (⭐⭐ INELUDIBLE)
- ¿Tienes 3 de The Objective si aparecían ≥3? (⭐⭐ INELUDIBLE)
- ¿Tienes 2 de El País, elDiario.es, LD si aparecían?
- ¿Tienes 2 de Demócrata si aparecían ≥2? (⭐⭐ INELUDIBLE)
- ¿Tienes 3 económicas (Invertia + Eco Mallorca + Cinco Días) si aparecían ≥3? (⭐ OBLIGATORIO)
- ¿Tienes 2 baleares (OK Bal + eDS Bal + El Debate Bal) si aparecía material?
Si faltan mínimos y hay items disponibles en CANDIDATAS, reemplaza piezas "rellenas" por las que faltan.

Para cada pieza seleccionada, escribe un "summary" propio de 1-2 frases CORTAS (máx 200 caracteres). No copies el resumen del feed, redáctalo tú con voz neutral periodística que cuente el QUÉ y el CONTEXTO. NO te excedas para no truncar el JSON.

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
          max_tokens: 16000,
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
        // ⭐ ENFORCEMENT POST-MODELO: forzar piezas largas si el modelo no las incluyó
        const targetLong = Math.min(longCount, 5); // máximo 5 piezas largas obligatorias
        const selectedNews = Array.isArray(briefing.spainNews) ? briefing.spainNews : [];
        const selectedUrls = new Set(selectedNews.map(n => n.url).filter(Boolean));

        // Cuántas piezas largas tiene la selección
        const longCandidatesAll = candidates.filter(isLongFormPiece);
        const longSelected = selectedNews.filter(n => {
          const candidateMatch = candidates.find(c => c.url === n.url);
          return candidateMatch && isLongFormPiece(candidateMatch);
        }).length;

        const enforcementLog = [];
        if (longSelected < targetLong) {
          const missing = targetLong - longSelected;
          // Buscar piezas largas del pool que NO estén ya seleccionadas
          const longToAdd = longCandidatesAll
            .filter(c => !selectedUrls.has(c.url))
            .slice(0, missing);

          for (const longItem of longToAdd) {
            briefing.spainNews.push({
              rank: briefing.spainNews.length + 1,
              title: longItem.title,
              summary: (longItem.description || '').slice(0, 250) + (longItem.description && longItem.description.length > 250 ? '...' : ''),
              source: longItem.source,
              url: longItem.url,
              publishedDate: longItem.publishedDate,
              image: longItem.image || null,
              _forcedLong: true,
            });
            selectedUrls.add(longItem.url);
            enforcementLog.push(`📊 ${longItem.source}: ${longItem.title.slice(0, 60)}...`);
          }
        }

        // ⭐ ENFORCEMENT MÍNIMOS POR MEDIO: si el modelo no respeta los mínimos, forzar
        const REQUIRED_MIN_NEWS = {
          'Vozpópuli': 4,
          'El País': 2,
          'elDiario.es': 2,
          'Libertad Digital': 2,
          'The Objective': 3,
          'ABC': 1,
          'La Gaceta': 1,
          'OK Diario': 1,
          'El Debate': 1,
          'Huffington Post': 1,
          'Público': 1,
          'Crónica Global': 1,
          'El Nacional.cat': 1,
          'Demócrata': 2,
        };
        // Cuotas máx para no pasarse al forzar
        const MAX_CAP_NEWS = {
          'Vozpópuli': 6, 'El País': 3, 'elDiario.es': 3,
          'Libertad Digital': 3, 'The Objective': 4,
          'ABC': 2, 'La Gaceta': 2, 'OK Diario': 2, 'El Debate': 2,
          'Huffington Post': 2, 'Público': 2,
          'Crónica Global': 2, 'El Nacional.cat': 2,
          'Demócrata': 3,
        };

        const countNewsPerSource = () => (briefing.spainNews || []).reduce((acc, x) => {
          acc[x.source] = (acc[x.source] || 0) + 1;
          return acc;
        }, {});

        for (const [source, requiredMin] of Object.entries(REQUIRED_MIN_NEWS)) {
          const currentCounts = countNewsPerSource();
          const current = currentCounts[source] || 0;
          // Solo forzar si hay candidatos disponibles de ese medio
          const availableFromSource = candidates.filter(c =>
            c.source === source && !selectedUrls.has(c.url)
          );
          if (availableFromSource.length === 0) continue;
          if (current >= requiredMin) continue;
          const missing = requiredMin - current;
          const toAdd = availableFromSource.slice(0, missing);
          for (const item of toAdd) {
            briefing.spainNews.push({
              rank: briefing.spainNews.length + 1,
              title: item.title,
              summary: (item.description || '').slice(0, 250) + (item.description && item.description.length > 250 ? '...' : ''),
              source: item.source,
              url: item.url,
              publishedDate: item.publishedDate,
              image: item.image || null,
              _forcedMin: true,
            });
            selectedUrls.add(item.url);
            enforcementLog.push(`📰 ${item.source}: ${item.title.slice(0, 60)}...`);
          }
        }

        // ⭐ ENFORCEMENT ECONÓMICO: Invertia + Economía de Mallorca + Cinco Días → mínimo 3 combinados
        const economicoSources = ['Invertia', 'Economía de Mallorca', 'Cinco Días'];
        const currentCountsEcon = countNewsPerSource();
        const economicoCurrent = economicoSources.reduce((sum, s) => sum + (currentCountsEcon[s] || 0), 0);
        const economicoTargetMin = 3;
        if (economicoCurrent < economicoTargetMin) {
          const missingEcon = economicoTargetMin - economicoCurrent;
          const availableEcon = candidates.filter(c =>
            economicoSources.includes(c.source) && !selectedUrls.has(c.url)
          );
          const toAddEcon = availableEcon.slice(0, missingEcon);
          for (const item of toAddEcon) {
            briefing.spainNews.push({
              rank: briefing.spainNews.length + 1,
              title: item.title,
              summary: (item.description || '').slice(0, 250) + (item.description && item.description.length > 250 ? '...' : ''),
              source: item.source,
              url: item.url,
              publishedDate: item.publishedDate,
              image: item.image || null,
              _forcedMin: true,
              _economicoPriority: true,
            });
            selectedUrls.add(item.url);
            enforcementLog.push(`💰 ${item.source}: ${item.title.slice(0, 60)}...`);
          }
        }

        // ⭐ ENFORCEMENT BALEARES: OK Diario Baleares + elDiario.es Baleares + El Debate Baleares → mínimo 2 (máx 3)
        const baleariesSources = ['OK Diario Baleares', 'elDiario.es Baleares', 'El Debate Baleares'];
        const currentCounts2 = countNewsPerSource();
        const baleariesCurrent = baleariesSources.reduce((sum, s) => sum + (currentCounts2[s] || 0), 0);
        const baleariesTargetMin = 2;
        if (baleariesCurrent < baleariesTargetMin) {
          const missingBaleares = baleariesTargetMin - baleariesCurrent;
          const availableBalearies = candidates.filter(c =>
            baleariesSources.includes(c.source) && !selectedUrls.has(c.url)
          );
          const toAddBaleares = availableBalearies.slice(0, missingBaleares);
          for (const item of toAddBaleares) {
            briefing.spainNews.push({
              rank: briefing.spainNews.length + 1,
              title: item.title,
              summary: (item.description || '').slice(0, 250) + (item.description && item.description.length > 250 ? '...' : ''),
              source: item.source,
              url: item.url,
              publishedDate: item.publishedDate,
              image: item.image || null,
              _forcedMin: true,
              _baleariesPriority: true,
            });
            selectedUrls.add(item.url);
            enforcementLog.push(`🏝️ ${item.source}: ${item.title.slice(0, 60)}...`);
          }
        }

        // Marcar con _isPaywall las piezas de fuentes paywall
        // Marcar con _isPressReader las piezas disponibles en PressReader
        // Marcar con _detectedLong las piezas que son largas (incluyendo las que el modelo seleccionó)
        // Enriquecer con imagen desde candidatos
        if (Array.isArray(briefing.spainNews)) {
          briefing.spainNews.forEach(item => {
            if (item && isPaywallSource(item.source)) {
              item._isPaywall = true;
            }
            if (item && isPressReaderAvailable(item.source)) {
              item._isPressReader = true;
            }
            // Marcar como larga si no estaba ya marcada por enforcement
            if (item && !item._forcedLong) {
              const candidateMatch = candidates.find(c => c.url === item.url);
              if (candidateMatch && isLongFormPiece(candidateMatch)) {
                item._detectedLong = true;
              }
            }
            // Adjuntar imagen del candidato si no tiene
            if (item && item.url && !item.image) {
              const cand = candidates.find(c => c.url === item.url);
              if (cand && cand.image) item.image = cand.image;
            }
          });
        }

        const paywallCount = (briefing.spainNews || []).filter(n => n._isPaywall).length;
        const freeCount = (briefing.spainNews || []).length - paywallCount;

        briefing._meta = {
          totalCandidates: candidates.length,
          selectedCount: (briefing.spainNews || []).length,
          longCandidatesCount: longCount,
          longSelectedAfterEnforcement: (briefing.spainNews || []).filter(n => {
            const candidateMatch = candidates.find(c => c.url === n.url);
            return candidateMatch && isLongFormPiece(candidateMatch);
          }).length,
          mediumsAvailable: [...new Set(candidates.map(c => c.source))].length,
          paywallCount,
          freeCount,
          allowedDates: allowedISODates,
          feedDiagnostic: diagnostic,
          enforcementLog,
        };

        const notes = [];
        if (enforcementLog.length > 0) {
          notes.push(`Se añadieron ${enforcementLog.length} piezas largas que el modelo había omitido (enforcement automático).`);
        }
        notes.push(`📊 ${freeCount} gratis · 🔒 ${paywallCount} paywall`);
        briefing._note = notes.join(' · ');
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
    // ============ PRE-FETCH RSS OPINIÓN INTERNACIONAL ============
    let intlOpinionCandidates = [];
    let intlOpinionDiagnostic = [];
    if (section === 'international') {
      try {
        const intlResult = await fetchInternationalOpinionRss(allowedISODates, excludeUrlsSet);
        intlOpinionCandidates = intlResult.candidates || [];
        intlOpinionDiagnostic = intlResult.diagnostic || [];
      } catch (e) {
        // Si falla el pre-fetch, seguimos solo con web_search
        intlOpinionDiagnostic = [{ source: 'PRE-FETCH ERROR', errorMsg: e.message }];
      }
    }

    const candidatesText = (section === 'international' && intlOpinionCandidates.length > 0)
      ? `\n\n📰 CANDIDATAS DE OPINIÓN INTERNACIONAL PRE-RECOLECTADAS (RSS directos, últimas 48h):\n${
          intlOpinionCandidates.map((c, i) =>
            `[${i + 1}] ${c.source} | ${c.publishedDate || 'fecha?'} | ${c.author || 'sin autor'} | ${c.title}\n   URL: ${c.url}\n   Resumen: ${(c.description || '').slice(0, 200)}`
          ).join('\n\n')
        }\n\n⭐ IMPORTANTE: Estas ${intlOpinionCandidates.length} candidatas son material PRE-VERIFICADO de medios internacionales. ÚSALAS PRIORITARIAMENTE para llenar worldOpinion (mínimo 5-6 deben venir de esta lista). Si una candidata es buena, INCLÚYELA con su URL exacta. Combina con web_search SOLO para cobertura adicional (LATAM, Asia, África, OM, otras zonas no representadas arriba).`
      : '';

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
          content: cfg.user(todayShort, todayFull, nowTime, allowedISODates) + candidatesText,
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
    if (briefing && typeof briefing === 'object' && section === 'international') {
      // Detectar piezas largas en worldNews
      const LONG_KEYWORDS_INTL = [
        'investigation', 'deep dive', 'inside story', 'long read', 'feature',
        'essay', 'explained', 'what happened', 'behind the scenes', 'profile of',
        'the big read', 'the big take', 'briefing', 'anatomy of', 'how',
        'why', 'analysis', 'reportage',
      ];
      const isLongFormIntl = (piece) => {
        if (piece.pieceType === 'long') return true;
        const titleLow = String(piece.title || '').toLowerCase();
        const summaryLen = String(piece.summary || '').length;
        if (LONG_KEYWORDS_INTL.some(k => titleLow.includes(k))) return true;
        if (String(piece.title || '').length > 90) return true;
        if (summaryLen > 250) return true;
        return false;
      };

      // ⭐ MARCADO PRESSREADER: marcar piezas cuyo medio está en PressReader
      // El frontend mostrará badge 📚 cuando el usuario tenga PressReader activado.
      let pressReaderMarkedCount = 0;
      if (Array.isArray(briefing.worldNews)) {
        briefing.worldNews.forEach(p => {
          if (p && isPressReaderAvailable(p.source)) {
            p._isPressReader = true;
            pressReaderMarkedCount++;
          }
        });
      }
      if (Array.isArray(briefing.worldOpinion)) {
        briefing.worldOpinion.forEach(p => {
          if (p && isPressReaderAvailable(p.source)) {
            p._isPressReader = true;
            pressReaderMarkedCount++;
          }
        });
      }

      const worldNewsArr = Array.isArray(briefing.worldNews) ? briefing.worldNews : [];
      const worldOpinionArr = Array.isArray(briefing.worldOpinion) ? briefing.worldOpinion : [];
      const longInWorldNews = worldNewsArr.filter(isLongFormIntl);
      const longCount = longInWorldNews.length;
      const targetLongIntl = 5;

      // Marcar las piezas detectadas como largas
      worldNewsArr.forEach(piece => {
        if (isLongFormIntl(piece)) {
          piece._detectedLong = true;
        }
      });

      // Marcar piezas paywall (worldNews + worldOpinion)
      [worldNewsArr, worldOpinionArr].forEach(arr => {
        arr.forEach(item => {
          if (item && isPaywallSource(item.source)) {
            item._isPaywall = true;
          }
        });
      });

      const paywallNews = worldNewsArr.filter(p => p._isPaywall).length;
      const paywallOp = worldOpinionArr.filter(p => p._isPaywall).length;
      const freeNews = worldNewsArr.length - paywallNews;
      const freeOp = worldOpinionArr.length - paywallOp;

      const longWarning = longCount < targetLongIntl
        ? `⚠️ Solo ${longCount}/${targetLongIntl} piezas largas detectadas en worldNews. El modelo debería incluir más reportajes/análisis (NYT investigations, Atlantic features, FT big reads, etc.).`
        : null;

      // ⭐ CLASIFICACIÓN POR REGIÓN + conteo
      const regionCounts = {};
      worldNewsArr.forEach(piece => {
        const region = classifyRegion(piece.source);
        piece._region = region;
        regionCounts[region] = (regionCounts[region] || 0) + 1;
      });

      // Detectar regiones donde faltan mínimos
      const regionWarnings = Object.entries(REGION_MIN)
        .filter(([region, min]) => min > 0 && (regionCounts[region] || 0) < min)
        .map(([region, min]) => ({
          region,
          current: regionCounts[region] || 0,
          min,
          emoji: REGION_EMOJI[region] || '⚪',
        }));

      // Generar string visual del contador por región
      const regionOrder = [
        'USA', 'UK', 'Europa Occ', 'Europa Este', 'Oriente Medio',
        'Asia', 'LATAM', 'África',
        'Económico Global', 'Rusia', 'Australia', 'Turquía', 'Multilateral', 'Otros',
      ];
      const regionCounterString = regionOrder
        .filter(r => (regionCounts[r] || 0) > 0)
        .map(r => `${REGION_EMOJI[r] || '⚪'} ${r}: ${regionCounts[r]}`)
        .join(' · ');

      const regionWarningString = regionWarnings.length > 0
        ? `⚠️ Faltan mínimos en: ${regionWarnings.map(w => `${w.emoji} ${w.region} (${w.current}/${w.min})`).join(', ')}`
        : null;

      // Detectar fuentes en "Otros" para diagnóstico (medios no mapeados)
      const otrosSources = worldNewsArr
        .filter(p => p._region === 'Otros')
        .map(p => p.source)
        .reduce((acc, src) => {
          acc[src] = (acc[src] || 0) + 1;
          return acc;
        }, {});
      const otrosSourcesList = Object.entries(otrosSources)
        .map(([src, count]) => `${src} (${count})`)
        .join(', ');

      briefing._meta = {
        ...briefing._meta,
        intlOpinionCandidatesCount: intlOpinionCandidates.length,
        feedDiagnostic: intlOpinionDiagnostic,
        allowedDates: allowedISODates,
        worldNewsLongCount: longCount,
        worldNewsLongTarget: targetLongIntl,
        worldNewsLongTitles: longInWorldNews.map(p => `${p.source}: ${p.title}`),
        paywallCounts: { news: paywallNews, opinion: paywallOp },
        freeCounts: { news: freeNews, opinion: freeOp },
        longWarning,
        regionCounts,
        regionMin: REGION_MIN,
        regionWarnings,
        regionCounterString,
        otrosSourcesList,
        otrosSources,
      };

      const intlNotes = [];
      if (regionCounterString) intlNotes.push(regionCounterString);
      if (regionWarningString) intlNotes.push(regionWarningString);
      if (longWarning) intlNotes.push(longWarning);
      intlNotes.push(`Noticias: 📊 ${freeNews} gratis · 🔒 ${paywallNews} paywall`);
      intlNotes.push(`Opinión: 📊 ${freeOp} gratis · 🔒 ${paywallOp} paywall`);
      briefing._note = (briefing._note ? briefing._note + ' · ' : '') + intlNotes.join(' · ');
    }
    return res.status(200).json({ briefing, section });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Error desconocido' });
  }
}
