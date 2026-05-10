// Endpoint diagnóstico: prueba cada RSS y reporta qué funciona y qué no.
// Visita https://mal-news-pwa.vercel.app/api/rss-debug en el navegador.

const SPAIN_OPINION_FEEDS = [
  // ============ VOZPÓPULI - intentos nuevos ============
  { source: 'Vozpópuli /rss', url: 'https://www.vozpopuli.com/rss/' },
  { source: 'Vozpópuli /rss.xml', url: 'https://www.vozpopuli.com/rss.xml' },
  { source: 'Vozpópuli /index.rss', url: 'https://www.vozpopuli.com/index.rss' },
  { source: 'Vozpópuli /?feed=rss2', url: 'https://www.vozpopuli.com/?feed=rss2' },
  { source: 'Vozpópuli /feeds/all.xml', url: 'https://www.vozpopuli.com/feeds/all.xml' },

  // ============ EL ESPAÑOL - intentos nuevos ============
  { source: 'El Español /rss', url: 'https://www.elespanol.com/rss' },
  { source: 'El Español /feed', url: 'https://www.elespanol.com/feed/' },
  { source: 'El Español /rss.xml', url: 'https://www.elespanol.com/rss.xml' },
  { source: 'El Español /opinion.rss', url: 'https://www.elespanol.com/opinion.rss' },
  { source: 'El Español /opinion/index.rss', url: 'https://www.elespanol.com/opinion/index.rss' },

  // ============ LIBERTAD DIGITAL - intentos nuevos ============
  { source: 'LD /rss', url: 'https://www.libertaddigital.com/rss/' },
  { source: 'LD /rss.xml', url: 'https://www.libertaddigital.com/rss.xml' },
  { source: 'LD /opinion/rss', url: 'https://www.libertaddigital.com/opinion/rss/' },
  { source: 'LD /opinion.rss', url: 'https://www.libertaddigital.com/opinion.rss' },
  { source: 'LD /comunidad/rss', url: 'https://www.libertaddigital.com/comunidad/rss/' },

  // ============ EL DEBATE - intentos nuevos ============
  { source: 'El Debate /rss', url: 'https://www.eldebate.com/rss/' },
  { source: 'El Debate /rss.xml', url: 'https://www.eldebate.com/rss.xml' },
  { source: 'El Debate /index.xml', url: 'https://www.eldebate.com/index.xml' },
  { source: 'El Debate /rss/portada', url: 'https://www.eldebate.com/rss/portada.xml' },
  { source: 'El Debate /sitemap-news', url: 'https://www.eldebate.com/sitemap-news.xml' },

  // ============ ELDIARIO.ES - intentos para encontrar feed con fechas ============
  { source: 'elDiario portada', url: 'https://www.eldiario.es/rss/portada/' },
  { source: 'elDiario opiniones', url: 'https://www.eldiario.es/opiniones/feed/' },
  { source: 'elDiario rss tema opinion', url: 'https://www.eldiario.es/rss/tema/opinion/' },
];

async function probeFeed(feed) {
  const startMs = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(feed.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
      },
      redirect: 'follow',
    });
    clearTimeout(timer);
    const ms = Date.now() - startMs;
    if (!res.ok) {
      return {
        source: feed.source,
        url: feed.url,
        status: 'FAIL',
        httpStatus: res.status,
        elapsedMs: ms,
      };
    }
    const xml = await res.text();
    const itemCount = (xml.match(/<item[^>]*>/gi) || []).length;
    const entryCount = (xml.match(/<entry[^>]*>/gi) || []).length;
    const total = itemCount + entryCount;
    // Extraer las primeras 3 fechas para ver el formato
    const dateMatches = xml.match(/<(?:pubDate|published|updated|dc:date)[^>]*>([^<]+)<\/(?:pubDate|published|updated|dc:date)>/gi) || [];
    const sampleDates = dateMatches.slice(0, 3).map(m => m.replace(/<[^>]+>/g, '').trim());
    // Extraer 1 título de muestra
    const titleMatch = xml.match(/<item[^>]*>[\s\S]*?<title[^>]*>(?:<!\[CDATA\[)?([^<\]]+)/i);
    const sampleTitle = titleMatch ? titleMatch[1].trim().slice(0, 100) : '';
    return {
      source: feed.source,
      url: feed.url,
      status: 'OK',
      httpStatus: res.status,
      elapsedMs: ms,
      itemsFound: total,
      sampleTitle,
      sampleDates,
      xmlLength: xml.length,
      isValidXml: xml.includes('<rss') || xml.includes('<feed') || xml.includes('<?xml'),
    };
  } catch (err) {
    return {
      source: feed.source,
      url: feed.url,
      status: 'ERROR',
      error: err.message || String(err),
      elapsedMs: Date.now() - startMs,
    };
  }
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  try {
    const results = await Promise.all(SPAIN_OPINION_FEEDS.map(probeFeed));
    const ok = results.filter(r => r.status === 'OK' && (r.itemsFound || 0) > 0);
    const fail = results.filter(r => r.status !== 'OK' || (r.itemsFound || 0) === 0);
    return res.status(200).json({
      summary: {
        totalFeeds: results.length,
        feedsWithItems: ok.length,
        feedsFailedOrEmpty: fail.length,
        timestamp: new Date().toISOString(),
      },
      working: ok.map(r => ({
        source: r.source,
        url: r.url,
        items: r.itemsFound,
        sampleTitle: r.sampleTitle,
        sampleDates: r.sampleDates,
      })),
      failing: fail.map(r => ({
        source: r.source,
        url: r.url,
        status: r.status,
        httpStatus: r.httpStatus,
        error: r.error,
        elapsedMs: r.elapsedMs,
      })),
    }, null, 2);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Error desconocido' });
  }
        }
