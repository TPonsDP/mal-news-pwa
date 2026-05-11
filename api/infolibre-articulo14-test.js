// Diagnóstico para verificar feeds RSS de InfoLibre y Artículo 14.
// Comprueba qué URLs devuelven RSS válido con items, fechas y autores.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const CANDIDATES = [
    // ========== InfoLibre ==========
    { medium: 'InfoLibre', label: 'feed general', url: 'https://www.infolibre.es/feed/' },
    { medium: 'InfoLibre', label: 'rss general', url: 'https://www.infolibre.es/rss/' },
    { medium: 'InfoLibre', label: 'opinion feed', url: 'https://www.infolibre.es/opinion/feed/' },
    { medium: 'InfoLibre', label: 'opinion rss', url: 'https://www.infolibre.es/opinion/rss/' },
    { medium: 'InfoLibre', label: 'WordPress query', url: 'https://www.infolibre.es/?feed=rss2' },
    { medium: 'InfoLibre', label: 'rss.xml', url: 'https://www.infolibre.es/rss.xml' },
    { medium: 'InfoLibre', label: 'seccion opinion feed', url: 'https://www.infolibre.es/seccion/opinion/feed/' },
    { medium: 'InfoLibre', label: 'category opinion feed', url: 'https://www.infolibre.es/category/opinion/feed/' },

    // ========== Artículo 14 ==========
    { medium: 'Artículo 14', label: 'articulo14.es feed', url: 'https://www.articulo14.es/feed/' },
    { medium: 'Artículo 14', label: 'articulo14.es sin www', url: 'https://articulo14.es/feed/' },
    { medium: 'Artículo 14', label: 'articulo14.es rss', url: 'https://www.articulo14.es/rss/' },
    { medium: 'Artículo 14', label: 'articulo14.es opinion', url: 'https://www.articulo14.es/opinion/feed/' },
    { medium: 'Artículo 14', label: 'articulo14.es ?feed=rss2', url: 'https://www.articulo14.es/?feed=rss2' },
    { medium: 'Artículo 14', label: 'articulo14.es rss.xml', url: 'https://www.articulo14.es/rss.xml' },
    { medium: 'Artículo 14', label: 'articulo14.com feed', url: 'https://www.articulo14.com/feed/' },
    { medium: 'Artículo 14', label: 'Google News fallback', url: 'https://news.google.com/rss/search?q=site:articulo14.es&hl=es-ES&gl=ES&ceid=ES:es' },

    // ========== El Mundo ==========
    { medium: 'El Mundo', label: 'opinion clásico', url: 'https://www.elmundo.es/elmundo/rss/opinion.xml' },
    { medium: 'El Mundo', label: 'opinion path RSS', url: 'https://www.elmundo.es/rss/opinion.xml' },
    { medium: 'El Mundo', label: 'opinion subpath', url: 'https://www.elmundo.es/opinion/rss.xml' },
    { medium: 'El Mundo', label: 'portada clásico', url: 'https://www.elmundo.es/elmundo/rss/portada.xml' },
    { medium: 'El Mundo', label: 'portada path RSS', url: 'https://www.elmundo.es/rss/portada.xml' },
    { medium: 'El Mundo', label: 'Google News opinion path', url: 'https://news.google.com/rss/search?q=site:elmundo.es/opinion&hl=es-ES&gl=ES&ceid=ES:es' },
    { medium: 'El Mundo', label: 'Google News when:1d', url: 'https://news.google.com/rss/search?q=site:elmundo.es/opinion+when:1d&hl=es-ES&gl=ES&ceid=ES:es' },
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
        info.sampleItems = itemMatches.slice(0, 4).map(itemXml => {
          const titleMatch = itemXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
          const dateMatch = itemXml.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)
                          || itemXml.match(/<published[^>]*>([\s\S]*?)<\/published>/i);
          const authorMatch = itemXml.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i)
                            || itemXml.match(/<author[^>]*>([\s\S]*?)<\/author>/i);
          const linkMatch = itemXml.match(/<link[^>]*>([\s\S]*?)<\/link>/i)
                          || itemXml.match(/<link[^>]+href="([^"]+)"/i);
          const clean = (s) => (s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').trim();
          return {
            title: clean(titleMatch?.[1]).slice(0, 80),
            date: clean(dateMatch?.[1]).slice(0, 30),
            author: clean(authorMatch?.[1]).slice(0, 50) || '(SIN AUTOR)',
            link: clean(linkMatch?.[1]).slice(0, 100),
          };
        });
      } else {
        info.bodyPreview = text.slice(0, 200);
      }

      return { ...cand, ...info };
    } catch (err) {
      return { ...cand, error: String(err.message).slice(0, 200) };
    }
  }));

  // Agrupar por medio
  const grouped = {};
  for (const r of results) {
    grouped[r.medium] = grouped[r.medium] || [];
    grouped[r.medium].push(r);
  }

  res.status(200).json({
    timestamp: new Date().toISOString(),
    summary: {
      tested: results.length,
      InfoLibre: {
        validRssCount: results.filter(r => r.medium === 'InfoLibre' && r.looksLikeRss && r.itemCount > 0).length,
        bestUrl: results.find(r => r.medium === 'InfoLibre' && r.looksLikeRss && r.itemCount > 0 && r.sampleItems?.[0]?.author !== '(SIN AUTOR)')?.url
              || results.find(r => r.medium === 'InfoLibre' && r.looksLikeRss && r.itemCount > 0)?.url
              || 'NINGUNA',
      },
      'Artículo 14': {
        validRssCount: results.filter(r => r.medium === 'Artículo 14' && r.looksLikeRss && r.itemCount > 0).length,
        bestUrl: results.find(r => r.medium === 'Artículo 14' && r.looksLikeRss && r.itemCount > 0 && r.sampleItems?.[0]?.author !== '(SIN AUTOR)')?.url
              || results.find(r => r.medium === 'Artículo 14' && r.looksLikeRss && r.itemCount > 0)?.url
              || 'NINGUNA',
      },
      'El Mundo': {
        validRssCount: results.filter(r => r.medium === 'El Mundo' && r.looksLikeRss && r.itemCount > 0).length,
        bestUrl: results.find(r => r.medium === 'El Mundo' && r.looksLikeRss && r.itemCount > 0 && r.sampleItems?.[0]?.author !== '(SIN AUTOR)')?.url
              || results.find(r => r.medium === 'El Mundo' && r.looksLikeRss && r.itemCount > 0)?.url
              || 'NINGUNA',
      },
    },
    grouped,
  });
}
