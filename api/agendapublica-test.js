// Diagnóstico para verificar feeds RSS de Agenda Pública.
// Acceso: https://mal-news-pwa.vercel.app/api/agendapublica-test

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const CANDIDATES = [
    // ============ Agenda Pública - WordPress patterns ============
    { label: 'feed con www', url: 'https://www.agendapublica.es/feed/' },
    { label: 'feed sin www', url: 'https://agendapublica.es/feed/' },
    { label: 'rss', url: 'https://www.agendapublica.es/rss/' },
    { label: 'rss.xml', url: 'https://www.agendapublica.es/rss.xml' },
    { label: 'WordPress ?feed=rss2', url: 'https://www.agendapublica.es/?feed=rss2' },

    // ============ Subdominios alternativos ============
    { label: 'elperiodico subdomain', url: 'https://agendapublica.elperiodico.com/feed/' },
    { label: 'elperiodico path', url: 'https://www.elperiodico.com/es/agenda-publica/rss' },

    // ============ Atom feeds ============
    { label: 'atom.xml', url: 'https://www.agendapublica.es/atom.xml' },
    { label: 'atom', url: 'https://www.agendapublica.es/atom/' },

    // ============ Google News fallback ============
    {
      label: 'Google News (.es)',
      url: 'https://news.google.com/rss/search?q=site:agendapublica.es&hl=es-ES&gl=ES&ceid=ES:es',
    },
    {
      label: 'Google News (.com)',
      url: 'https://news.google.com/rss/search?q=site:agendapublica.com&hl=es-ES&gl=ES&ceid=ES:es',
    },
    {
      label: 'Google News (when:1d)',
      url: 'https://news.google.com/rss/search?q=site:agendapublica.es+when:1d&hl=es-ES&gl=ES&ceid=ES:es',
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
        const itemMatches = text.match(/<item[^>]*>[\s\S]*?<\/item>/gi)
                          || text.match(/<entry[^>]*>[\s\S]*?<\/entry>/gi) || [];
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

  // Mejor URL: con autor real y items
  const bestWithAuthor = results.find(r => r.looksLikeRss && r.itemCount > 0 && r.sampleItems?.[0]?.author !== '(SIN AUTOR)');
  const bestAny = results.find(r => r.looksLikeRss && r.itemCount > 0);

  res.status(200).json({
    medium: 'Agenda Pública',
    timestamp: new Date().toISOString(),
    summary: {
      tested: results.length,
      validRssCount: results.filter(r => r.looksLikeRss && r.itemCount > 0).length,
      bestUrlWithAuthor: bestWithAuthor?.url || 'NINGUNA con autor',
      bestUrlAny: bestAny?.url || 'NINGUNA',
    },
    results,
  });
}
