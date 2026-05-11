// Endpoint diagnóstico para encontrar RSS funcionante de Vozpópuli.
// Prueba todas las URLs conocidas y reporta cuáles devuelven RSS válido con contenido reciente y autor.
// Acceso: https://mal-news-pwa.vercel.app/api/vozpopuli-test

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Lista exhaustiva de URLs candidatas. Probamos formatos típicos de:
  // - RSS WordPress (/feed/, /?feed=rss2)
  // - RSS clásico (/rss.xml, /rss)
  // - RSS específico de sección
  // - Otros patrones publicaciones digitales suelen exponer
  const CANDIDATES = [
    // Generales
    { url: 'https://www.vozpopuli.com/rss.xml', notes: 'RSS classic location' },
    { url: 'https://www.vozpopuli.com/rss', notes: 'RSS sin extension' },
    { url: 'https://www.vozpopuli.com/feed', notes: 'WordPress generic' },
    { url: 'https://www.vozpopuli.com/feed/', notes: 'WordPress generic con slash' },
    { url: 'https://www.vozpopuli.com/?feed=rss2', notes: 'WordPress query param' },
    { url: 'https://www.vozpopuli.com/?feed=rss', notes: 'WordPress query param v1' },
    { url: 'https://www.vozpopuli.com/feeds/all.rss', notes: 'CMS pattern' },
    { url: 'https://www.vozpopuli.com/portada.xml', notes: 'XML portada' },
    { url: 'https://www.vozpopuli.com/index.xml', notes: 'XML index' },

    // Opinión específica
    { url: 'https://www.vozpopuli.com/opinion/rss', notes: 'Opinión RSS' },
    { url: 'https://www.vozpopuli.com/opinion/feed/', notes: 'Opinión WordPress feed' },
    { url: 'https://www.vozpopuli.com/opinion.xml', notes: 'Opinión XML directo' },
    { url: 'https://www.vozpopuli.com/opinion/rss.xml', notes: 'Opinión RSS XML' },
    { url: 'https://www.vozpopuli.com/opinion/?feed=rss2', notes: 'Opinión query' },
    { url: 'https://www.vozpopuli.com/category/opinion/feed/', notes: 'Category WordPress' },
    { url: 'https://www.vozpopuli.com/seccion/opinion/rss', notes: 'Sección RSS' },

    // Sitemap (no es RSS pero útil para descubrir estructura)
    { url: 'https://www.vozpopuli.com/sitemap.xml', notes: 'Sitemap (para inspeccionar estructura)' },
    { url: 'https://www.vozpopuli.com/sitemap_index.xml', notes: 'Sitemap index' },
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

      // Si parece RSS, sacar info útil
      let info = {
        status: r.status,
        contentType: r.headers.get('content-type') || '',
        bodyLength: text.length,
        looksLikeXml: isXml,
        looksLikeRss: looksLikeRss,
      };

      if (looksLikeRss) {
        const itemMatches = text.match(/<item[^>]*>[\s\S]*?<\/item>/gi) || text.match(/<entry[^>]*>[\s\S]*?<\/entry>/gi) || [];
        info.itemCount = itemMatches.length;

        // Sacar las primeras 3 fechas, autores y titulos para verificar
        info.sampleItems = itemMatches.slice(0, 3).map(itemXml => {
          const titleMatch = itemXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
          const dateMatch = itemXml.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)
                          || itemXml.match(/<published[^>]*>([\s\S]*?)<\/published>/i)
                          || itemXml.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i);
          const authorMatch = itemXml.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i)
                            || itemXml.match(/<author[^>]*>([\s\S]*?)<\/author>/i);
          const linkMatch = itemXml.match(/<link[^>]*>([\s\S]*?)<\/link>/i)
                          || itemXml.match(/<link[^>]+href="([^"]+)"/i);
          const clean = (s) => (s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').trim().slice(0, 100);
          return {
            title: clean(titleMatch?.[1]),
            date: clean(dateMatch?.[1]),
            author: clean(authorMatch?.[1]) || '(SIN AUTOR)',
            link: clean(linkMatch?.[1]).slice(0, 100),
          };
        });

        // Tags presentes en primer item (para entender estructura)
        if (itemMatches.length > 0) {
          const tagsInFirstItem = [...itemMatches[0].matchAll(/<([a-z][a-z0-9:]*)\b/gi)]
            .map(m => m[1].toLowerCase())
            .filter(t => !['item', 'entry'].includes(t));
          info.tagsInFirstItem = [...new Set(tagsInFirstItem)].sort();
        }
      } else {
        info.bodyPreview = text.slice(0, 200);
      }

      return { url: cand.url, notes: cand.notes, ...info };
    } catch (err) {
      return { url: cand.url, notes: cand.notes, error: String(err.message).slice(0, 200) };
    }
  }));

  // Ordenar: primero los que parecen RSS válido con muchos items
  results.sort((a, b) => (b.itemCount || 0) - (a.itemCount || 0));

  res.status(200).json({
    medium: 'Vozpópuli',
    timestamp: new Date().toISOString(),
    summary: {
      tested: results.length,
      validRss: results.filter(r => r.looksLikeRss).length,
      bestCandidate: results.find(r => r.looksLikeRss && r.itemCount > 0)?.url || 'NINGUNA URL FUNCIONÓ',
    },
    results,
  });
}
