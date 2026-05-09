// Endpoint diagnóstico: prueba cada RSS y reporta qué funciona y qué no.
// Visita https://mal-news-pwa.vercel.app/api/rss-debug en el navegador.

const SPAIN_OPINION_FEEDS = [
  { source: 'ABC opinion completo', url: 'https://www.abc.es/rss/feeds/abc_opinioncompleto.xml' },
  { source: 'ABC opinion', url: 'https://www.abc.es/rss/feeds/abc_Opinion.xml' },
  { source: 'ABC opinion alt', url: 'https://www.abc.es/rss/feeds/abc_opinion.xml' },
  { source: 'Vozpópuli', url: 'https://www.vozpopuli.com/feed/' },
  { source: 'Vozpópuli opinion', url: 'https://www.vozpopuli.com/opinion/feed/' },
  { source: 'The Objective', url: 'https://theobjective.com/feed/' },
  { source: 'The Objective opinion', url: 'https://theobjective.com/comentario/feed/' },
  { source: 'El Español opinion v1', url: 'https://www.elespanol.com/rss/opinion.xml' },
  { source: 'El Español opinion v2', url: 'https://www.elespanol.com/opinion/rss/' },
  { source: 'Libertad Digital v1', url: 'https://feeds.libertaddigital.com/c/30220/f/612428/index.rss' },
  { source: 'Libertad Digital v2', url: 'https://www.libertaddigital.com/opinion/index.rss' },
  { source: 'Libertad Digital v3', url: 'https://www.libertaddigital.com/feeds/articulos.xml' },
  { source: 'elDiario.es', url: 'https://www.eldiario.es/rss/section/opinion/' },
  { source: 'elDiario.es alt', url: 'https://www.eldiario.es/rss/' },
  { source: 'El País opinion', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/opinion/portada' },
  { source: 'La Gaceta', url: 'https://gaceta.es/feed/' },
  { source: 'La Gaceta opinion', url: 'https://gaceta.es/opinion/feed/' },
  { source: 'El Debate', url: 'https://www.eldebate.com/feed/' },
  { source: 'El Debate opinion', url: 'https://www.eldebate.com/opinion/feed/' },
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
