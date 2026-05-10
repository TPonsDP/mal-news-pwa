// Endpoint diagnóstico PROFUNDO: muestra el XML crudo de los feeds problemáticos
// para inspeccionar exactamente cómo estructuran sus datos.
// Visitar: https://mal-news-pwa.vercel.app/api/rss-debug-deep

// Feeds a inspeccionar:
const TARGETS = [
  {
    name: 'Vozpópuli ?feed=rss2',
    url: 'https://www.vozpopuli.com/?feed=rss2',
    issue: 'Devuelve OK 200 pero parser lee 0 items. Inspeccionar formato XML/Atom.',
  },
  {
    name: 'El Español /rss',
    url: 'https://www.elespanol.com/rss',
    issue: 'Devuelve 30 items sin fechas parseadas. Buscar tag de fecha real.',
  },
  {
    name: 'elDiario.es /rss/',
    url: 'https://www.eldiario.es/rss/',
    issue: 'Devuelve 101 items sin fechas parseadas. Buscar tag de fecha real.',
  },
];

async function inspectFeed(target) {
  const out = {
    name: target.name,
    url: target.url,
    issue: target.issue,
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(target.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
      },
      redirect: 'follow',
    });
    clearTimeout(timer);

    out.httpStatus = res.status;
    out.contentType = res.headers.get('content-type') || '';
    if (!res.ok) {
      out.error = `HTTP ${res.status}`;
      return out;
    }

    const xml = await res.text();
    out.xmlLength = xml.length;

    // Detectar formato
    out.isRSS2 = xml.includes('<rss') || xml.includes('<channel>');
    out.isAtom = xml.includes('<feed') && xml.includes('xmlns="http://www.w3.org/2005/Atom"');
    out.hasItems = (xml.match(/<item[^>]*>/gi) || []).length;
    out.hasEntries = (xml.match(/<entry[^>]*>/gi) || []).length;

    // Listar TODOS los tags únicos top-level dentro del primer item/entry
    const itemMatch = xml.match(/<(item|entry)[^>]*>([\s\S]*?)<\/\1>/i);
    if (itemMatch) {
      const itemBody = itemMatch[2];
      // Extraer nombres de tags directos
      const tagMatches = itemBody.match(/<([a-zA-Z][a-zA-Z0-9:_-]*)[\s>]/g) || [];
      const uniqueTags = [...new Set(tagMatches.map(m => m.replace(/[<\s>]/g, '')))].sort();
      out.tagsInFirstItem = uniqueTags;
      // Mostrar el primer item COMPLETO (capado a 2000 chars)
      out.firstItemRaw = itemBody.slice(0, 2000);
    } else {
      out.tagsInFirstItem = [];
      // Si no hay item, mostrar parte del XML para ver la estructura
      out.xmlHead = xml.slice(0, 1500);
    }

    // Buscar candidatos de fecha en cualquier formato
    const dateRegex = /<([a-zA-Z][a-zA-Z0-9:_-]*(?:date|time|pub|publi|updat|creat)[a-zA-Z0-9:_-]*)[^>]*>([^<]+)</gi;
    const allDates = [];
    let m;
    while ((m = dateRegex.exec(xml)) !== null && allDates.length < 5) {
      allDates.push({ tag: m[1], value: m[2].trim().slice(0, 60) });
    }
    out.dateTagsFound = allDates;

    return out;
  } catch (err) {
    out.error = err.message || String(err);
    return out;
  }
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  try {
    const results = await Promise.all(TARGETS.map(inspectFeed));
    return res.status(200).json({
      timestamp: new Date().toISOString(),
      note: 'Diagnóstico profundo: tags y formato real de cada feed problemático',
      feeds: results,
    }, null, 2);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Error desconocido' });
  }
           }
