// Test específico: probar Bing News y variantes de Google News como alternativa
// para Vozpópuli (que bloquea RSS directo).

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const CANDIDATES = [
    {
      label: 'Google News (actual)',
      url: 'https://news.google.com/rss/search?q=site:vozpopuli.com+opinion+OR+columna&hl=es-ES&gl=ES&ceid=ES:es',
    },
    {
      label: 'Google News (path /opinion)',
      url: 'https://news.google.com/rss/search?q=site:vozpopuli.com/opinion&hl=es-ES&gl=ES&ceid=ES:es',
    },
    {
      label: 'Google News (when:1d filtro 24h)',
      url: 'https://news.google.com/rss/search?q=site:vozpopuli.com/opinion+when:1d&hl=es-ES&gl=ES&ceid=ES:es',
    },
    {
      label: 'Bing News (site:opinion)',
      url: 'https://www.bing.com/news/search?q=site%3Avozpopuli.com+opinion&format=rss&setlang=es-ES',
    },
    {
      label: 'Bing News (site general)',
      url: 'https://www.bing.com/news/search?q=site%3Avozpopuli.com&format=rss&setlang=es-ES',
    },
    {
      label: 'Bing News (Vozpopuli como término)',
      url: 'https://www.bing.com/news/search?q=Vozpopuli+opinion+columna&format=rss&setlang=es-ES',
    },
  ];

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
    'Accept-Language': 'es-ES,es;q=0.9',
  };

  const results = await Promise.all(CANDIDATES.map(async (cand) => {
    try {
      const r = await fetch(cand.url, { headers, redirect: 'follow' });
      const text = await r.text();
      const isXml = text.trim().startsWith('<?xml') || text.includes('<rss') || text.includes('<feed');
      const looksLikeRss = isXml && (text.includes('<item') || text.includes('<entry'));

      let info = {
        status: r.status,
        contentType: r.headers.get('content-type') || '',
        bodyLength: text.length,
        looksLikeRss,
      };

      if (looksLikeRss) {
        const itemMatches = text.match(/<item[^>]*>[\s\S]*?<\/item>/gi) || text.match(/<entry[^>]*>[\s\S]*?<\/entry>/gi) || [];
        info.itemCount = itemMatches.length;
        info.sampleTitles = itemMatches.slice(0, 5).map(itemXml => {
          const titleMatch = itemXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
          const dateMatch = itemXml.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);
          const clean = (s) => (s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').trim();
          return {
            title: clean(titleMatch?.[1]).slice(0, 80),
            date: clean(dateMatch?.[1]).slice(0, 30),
          };
        });
      } else {
        info.bodyPreview = text.slice(0, 200);
      }

      return { label: cand.label, url: cand.url, ...info };
    } catch (err) {
      return { label: cand.label, url: cand.url, error: String(err.message).slice(0, 200) };
    }
  }));

  res.status(200).json({
    medium: 'Vozpópuli (diagnóstico agregadores externos)',
    timestamp: new Date().toISOString(),
    summary: {
      tested: results.length,
      validRss: results.filter(r => r.looksLikeRss).length,
      byProvider: {
        googleNews: results.filter(r => r.label.includes('Google') && r.looksLikeRss && r.itemCount > 0).length,
        bingNews: results.filter(r => r.label.includes('Bing') && r.looksLikeRss && r.itemCount > 0).length,
      },
    },
    results,
  });
}
