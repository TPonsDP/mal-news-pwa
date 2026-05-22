import { useState, useEffect } from 'react';

// ============ CACHE LOCALSTORAGE ============
// Persiste el briefing entre sesiones: si cierras la PWA y vuelves a abrir,
// recuperas el último briefing generado de cada botón.
// SIN TTL: la última generación de cada uno (Internacional, Opinión, Noticias)
// queda guardada hasta que regeneres ese botón o pulses "limpiar".

const CACHE_KEY = 'mal-news-briefing-v1';

function loadBriefingCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.timestamp) return null;
    return parsed;
  } catch (_) { return null; }
}

function saveBriefingCache(payload) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      ...payload,
      timestamp: new Date().toISOString(),
    }));
  } catch (_) { /* localStorage no disponible o quota lleno: silencioso */ }
}

function clearBriefingCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch (_) { /* silencioso */ }
}

// Formatea hace cuánto se generó el briefing en texto humano
function formatCacheAge(timestamp) {
  if (!timestamp) return '';
  try {
    const ms = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(ms / 60000);
    if (minutes < 1) return 'ahora mismo';
    if (minutes < 60) return `hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `hace ${hours} h`;
    const days = Math.floor(hours / 24);
    return `hace ${days} d`;
  } catch (_) { return ''; }
}

// ============ FIN CACHE LOCALSTORAGE ============

const RECIPIENT = 'tonipons91@gmail.com';
const COOLDOWN_MS = 150 * 1000; // 150 segundos entre llamadas para no saturar Anthropic Tier 2

const BRAND = {
  // ============ PALETA: Oxford Blue + Smoke Gray + 3 gradientes (teal · lima-dorado · naranja) ============
  oxford: '#1A365D',           // Marca principal (Azul Oxford) - solo logo
  bgGray: '#F0F4F8',           // Fondo (Gris Humo)
  bgGrayDeep: '#E2E8F0',       // Variante para gradientes sutiles del fondo
  cardWhite: '#FFFFFF',        // Tarjetas blancas
  shadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
  shadowLg: '0 8px 24px rgba(0, 0, 0, 0.12)',
  // Gradientes oficiales por bucket
  intlGrad: 'linear-gradient(90deg, #0F766E, #5EEAD4)',
  opinionGrad: 'linear-gradient(90deg, #65A30D, #FACC15)',
  newsGrad: 'linear-gradient(90deg, #C2410C, #FA6900)',
  // Colores sólidos para bordes/badges (start de cada gradiente)
  intlColor: '#0F766E',
  opinionColor: '#65A30D',
  newsColor: '#C2410C',

  // ============ ALIASES PARA RETROCOMPATIBILIDAD ============
  navy: '#1A365D',
  navyDeep: '#102844',
  card: '#FFFFFF',
  cardSubtle: 'rgba(255,255,255,0.95)',
  ink: '#1A365D',
  inkSoft: 'rgba(26, 54, 93, 0.65)',
  orange: '#FA6900',           // Naranja Ciudadanos vivo (usado en decoraciones y botón HOY)
  limeLight: '#F0F4F8',        // bgGray alias usado en gradientes decorativos
  limeDark: '#E2E8F0',         // bgGrayDeep alias
  // Lean badges (IZQ/DER indicador ideológico en algunas tarjetas)
  leftBlue: '#3B82F6',
  rightRed: '#EF4444',
};

function DiagonalHeader({ dateObj }) {
  const dayNameRaw = dateObj.toLocaleDateString('es-ES', { weekday: 'long' });
  const dayName = dayNameRaw.charAt(0).toUpperCase() + dayNameRaw.slice(1);
  const dayNumber = dateObj.getDate();
  const month = dateObj.toLocaleDateString('es-ES', { month: 'long' }).toUpperCase();
  const year = dateObj.getFullYear();

  return (
    <svg viewBox="0 0 600 210" width="100%" style={{
      maxWidth: '640px',
      height: 'auto',
      display: 'block',
      margin: '0 auto',
      filter: 'drop-shadow(0 6px 20px rgba(26,54,93,0.15))',
    }} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="hdrMalBg" cx="38%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#5685BD" />
          <stop offset="45%" stopColor="#1A365D" />
          <stop offset="100%" stopColor="#04101F" />
        </radialGradient>
      </defs>

      {/* Fondo gris humo con esquinas redondeadas */}
      <rect x="0" y="0" width="600" height="210" fill="#F0F4F8" rx="10" />

      {/* Bloque azul Oxford con corte diagonal */}
      <path d="M 0 0 L 280 0 L 200 210 L 0 210 Z" fill="#1A365D" />

      {/* Línea naranja siguiendo el corte diagonal */}
      <line x1="280" y1="0" x2="200" y2="210" stroke="#FA6900" strokeWidth="4" />

      {/* Logo circular dentro del bloque azul */}
      <g transform="translate(110, 105)">
        <circle r="50" fill="url(#hdrMalBg)" stroke="#5EEAD4" strokeWidth="1.5" />
        <g transform="scale(0.21) translate(-256, -256)">
          <rect x="154" y="80" width="58" height="198" rx="6" fill="#60A5FA" />
          <polygon points="212,80 256,263 301,80 275,80 256,195 237,80" fill="#A3E635" />
          <rect x="301" y="80" width="58" height="198" rx="6" fill="#FB923C" />
          <text x="256" y="400" textAnchor="middle" fontFamily="Verdana, Geneva, sans-serif" fontWeight="800" fontSize="58" fill="#A3E635" letterSpacing="14">NEWS</text>
        </g>
      </g>

      {/* Zona derecha: día en serif Georgia */}
      <text x="305" y="70" fontFamily="Georgia, 'Times New Roman', serif" fontStyle="italic" fontSize="42" fill="#1A365D">
        {dayName}
      </text>

      {/* Día número grande naranja + mes en azul */}
      <text x="320" y="108" fontFamily="'Verdana', 'Geneva', sans-serif" fontWeight="900" fontSize="34" fill="#FA6900" letterSpacing="-0.02em">
        {dayNumber}
        <tspan fontSize="17" fill="#1A365D" fontWeight="700" dx="8">{month}</tspan>
      </text>

      {/* Año con letterspacing amplio */}
      <text x="320" y="134" fontFamily="'Verdana', sans-serif" fontWeight="700" fontSize="13" fill="#5A6B7C" letterSpacing="0.32em">{year}</text>

      {/* Separador sutil */}
      <line x1="320" y1="156" x2="575" y2="156" stroke="#1A365D" strokeWidth="0.5" opacity="0.25" />

      {/* Sub-etiquetas en dos líneas con color diferenciado */}
      <text x="320" y="176" fontFamily="'Verdana', sans-serif" fontStyle="italic" fontSize="11" fill="#5A6B7C" letterSpacing="0.16em">ESPAÑA · OPINIÓN</text>
      <text x="320" y="194" fontFamily="'Verdana', sans-serif" fontStyle="italic" fontSize="11" fill="#0F766E" letterSpacing="0.16em">MUNDO · INTERNACIONAL</text>
    </svg>
  );
}

function LeanBadge({ lean }) {
  if (!lean) return null;
  const isLeft = lean === 'left';
  const color = isLeft ? BRAND.leftBlue : BRAND.rightRed;
  const symbol = isLeft ? '◀' : '▶';
  const label = isLeft ? 'IZQ' : 'DER';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '3px',
      padding: '2px 7px', borderRadius: '10px',
      fontSize: '9px', fontWeight: '700', letterSpacing: '0.05em',
      background: `${color}18`, color, border: `1px solid ${color}40`,
    }}>
      {symbol} {label}
    </span>
  );
}

// Helper: deriva nombre del día de la semana en español desde fecha ISO
function getDayOfWeek(isoDate) {
  if (!isoDate) return '';
  try {
    const d = new Date(isoDate + 'T12:00:00');
    return d.toLocaleDateString('es-ES', { weekday: 'long' });
  } catch (_) { return ''; }
}

// ============================================================
// PALETA DE COLORES POR MEDIO — para badge de fuente en tarjetas
// ============================================================
const SOURCE_BADGE_COLORS = {
  // España opinión
  'Vozpópuli': '#E63946',
  'The Objective': '#1A1A1A',
  'El País': '#D32F2F',
  'elDiario.es': '#DC2626',
  'ABC': '#9B2335',
  'El Español': '#ED1C24',
  'InfoLibre': '#047857',
  'La Gaceta': '#991B1B',
  'Libertad Digital': '#7E22CE',
  'El Debate': '#D97706',
  'Artículo 14': '#4A5568',
  'Agenda Pública': '#0F766E',
  'almendron': '#FB923C',
  'El Blog Salmón': '#16A34A',
  // España noticias adicionales
  'El Mundo': '#C8102E',
  'OK Diario Baleares': '#F59E0B',
  'OK Diario': '#F59E0B',
  'elDiario.es Baleares': '#DC2626',
  'Economía de Mallorca': '#0F766E',
  'La Vanguardia': '#1A365D',
  'Crónica Global': '#475569',
  // Internacional
  'NYT': '#000000', 'New York Times': '#000000',
  'WSJ': '#1A1A1A', 'Wall Street Journal': '#1A1A1A',
  'FT': '#990F3D', 'Financial Times': '#990F3D',
  'Guardian': '#052962', 'The Guardian': '#052962',
  'BBC': '#BB1919',
  'Reuters': '#FF8000',
  'AP': '#000000', 'Associated Press': '#000000',
  'Bloomberg': '#FA0000',
  'Economist': '#E3120B', 'The Economist': '#E3120B',
  'Le Monde': '#003366',
  'Hindu': '#1F3864', 'The Hindu': '#1F3864',
  'Times of Israel': '#0F4C81',
  'Haaretz': '#103D6E',
  'Politico': '#E11D48',
  'Atlantic': '#0F2D52', 'The Atlantic': '#0F2D52',
  'Washington Post': '#0E1828', 'WaPo': '#0E1828',
};

function getSourceColor(source) {
  if (!source) return '#1A365D';
  // Buscar match parcial (case insensitive)
  const sourceL = source.toLowerCase();
  for (const key in SOURCE_BADGE_COLORS) {
    if (sourceL.includes(key.toLowerCase())) {
      return SOURCE_BADGE_COLORS[key];
    }
  }
  return '#1A365D'; // fallback navy
}

// Calcula tiempo de lectura en minutos basado en title + summary
// Aproximación: 1000 caracteres ≈ 1 minuto de lectura cómoda
function calculateReadTime(item) {
  const text = `${item.title || ''} ${item.summary || ''}`;
  const chars = text.length;
  const minutes = Math.max(1, Math.ceil(chars / 1000));
  return minutes;
}

// Formatea fecha como "LUN 18 MAY"
function formatDateBadge(isoDate) {
  if (!isoDate) return '';
  try {
    const d = new Date(isoDate + 'T12:00:00');
    const dayNames = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
    const monthNames = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    return `${dayNames[d.getDay()]} ${d.getDate()} ${monthNames[d.getMonth()]}`;
  } catch (_) {
    return '';
  }
}

function NewsCard({ item, index, sectionColor, type }) {
  const isOpinion = type === 'opinion';
  const sourceColor = getSourceColor(item.source);
  const dateBadge = formatDateBadge(item.publishedDate);
  const readTime = calculateReadTime(item);

  return (
    <div style={{
      background: BRAND.card,
      borderLeft: `4px solid ${sectionColor}`,
      borderRadius: '0 8px 8px 0',
      padding: '12px 14px',
      marginBottom: '6px',
      boxShadow: BRAND.shadow,
      animation: `fadeSlide 0.35s ease ${Math.min(index * 0.03, 0.5)}s both`,
    }}>
      {/* TOP ROW · Badges de medio + fecha + tiempo lectura + lean */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap',
        marginBottom: '8px',
      }}>
        {/* Badge medio (color del medio) */}
        {item.source && (
          <span style={{
            background: sourceColor,
            color: 'white',
            fontSize: '9px',
            fontWeight: '800',
            letterSpacing: '0.08em',
            padding: '3px 8px',
            borderRadius: '4px',
            fontFamily: "'Verdana', 'Geneva', sans-serif",
            textTransform: 'uppercase',
          }}>
            {item.source}
          </span>
        )}

        {/* Badge paywall 🔒 */}
        {item._isPaywall && (
          <span
            title="Requiere suscripción"
            style={{
              background: 'rgba(212, 49, 49, 0.12)',
              color: '#D43131',
              border: '1px solid rgba(212, 49, 49, 0.30)',
              fontSize: '10px',
              fontWeight: '700',
              padding: '3px 6px',
              borderRadius: '4px',
              fontFamily: "'Verdana', 'Geneva', sans-serif",
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
            }}
          >
            🔒 PAGO
          </span>
        )}

        {/* Badge LARGA si el backend marcó */}
        {(item._forcedLong || item._detectedLong) && (
          <span
            title="Pieza larga: reportaje / investigación / análisis"
            style={{
              background: 'rgba(101, 163, 13, 0.12)',
              color: '#65A30D',
              border: '1px solid rgba(101, 163, 13, 0.30)',
              fontSize: '10px',
              fontWeight: '700',
              padding: '3px 6px',
              borderRadius: '4px',
              fontFamily: "'Verdana', 'Geneva', sans-serif",
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
            }}
          >
            📊 LARGA
          </span>
        )}

        {/* Badge fecha */}
        {dateBadge && (
          <span style={{
            background: 'rgba(26,54,93,0.08)',
            color: 'rgba(26,54,93,0.75)',
            fontSize: '9px',
            fontWeight: '700',
            letterSpacing: '0.08em',
            padding: '3px 8px',
            borderRadius: '4px',
            fontFamily: "'Verdana', 'Geneva', sans-serif",
          }}>
            {dateBadge}
          </span>
        )}

        {/* Badge tiempo de lectura */}
        <span style={{
          background: 'rgba(250,105,0,0.10)',
          color: '#C2410C',
          fontSize: '9px',
          fontWeight: '700',
          letterSpacing: '0.04em',
          padding: '3px 8px',
          borderRadius: '4px',
          fontFamily: "'Verdana', 'Geneva', sans-serif",
        }}>
          {readTime} min
        </span>

        {/* Lean badge (solo si existe) - empujado a la derecha */}
        {item.lean && (
          <span style={{ marginLeft: 'auto' }}>
            <LeanBadge lean={item.lean} />
          </span>
        )}
      </div>

      {/* Título (clickable si hay URL) */}
      {item.url ? (
        <a href={item.url} target="_blank" rel="noopener noreferrer"
          style={{ textDecoration: 'none', color: 'inherit' }}>
          <h3 style={{
            margin: '0 0 5px',
            fontSize: isOpinion ? '14px' : '13px',
            fontFamily: "'Verdana', 'Geneva', sans-serif",
            fontWeight: '700', color: BRAND.navyDeep, lineHeight: 1.3,
            cursor: 'pointer',
          }}>
            {item.title}
          </h3>
        </a>
      ) : (
        <h3 style={{
          margin: '0 0 5px',
          fontSize: isOpinion ? '14px' : '13px',
          fontFamily: "'Verdana', 'Geneva', sans-serif",
          fontWeight: '700', color: BRAND.navyDeep, lineHeight: 1.3,
        }}>
          {item.title}
        </h3>
      )}

      {/* Resumen */}
      {item.summary && (
        <p style={{
          margin: '0 0 6px', fontSize: '11.5px',
          color: BRAND.inkSoft, lineHeight: 1.5,
          fontFamily: "'Verdana', 'Geneva', sans-serif",
          fontStyle: isOpinion ? 'italic' : 'normal',
          display: '-webkit-box',
          WebkitLineClamp: isOpinion ? 2 : 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {item.summary}
        </p>
      )}

      {/* Footer · autor (si opinion) + link "leer" */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: '8px', fontSize: '10.5px', color: BRAND.navyDeep,
        fontFamily: "'Verdana', 'Geneva', sans-serif",
      }}>
        <span style={{
          fontWeight: '700',
          fontStyle: 'italic',
          opacity: 0.8,
        }}>
          {isOpinion && item.author && `— ${item.author}`}
          {!isOpinion && item.region && item.region}
        </span>
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: sectionColor,
              textDecoration: 'none',
              borderBottom: `1px dotted ${sectionColor}`,
              fontWeight: '700',
              fontSize: '10.5px',
              whiteSpace: 'nowrap',
            }}
          >
            leer →
          </a>
        )}
      </div>
    </div>
  );
}

function Section({ title, icon, items, color, gradient, count, descriptor, type, note, meta, groupByContinent }) {
  const realCount = items?.length || 0;
  const itemLabel = type === 'opinion' ? (realCount === 1 ? 'COLUMNA' : 'COLUMNAS') : (realCount === 1 ? 'PIEZA' : 'PIEZAS');

  // Mapeo región → continente (para sección Mundo)
  const REGION_TO_CONTINENT = {
    'EEUU': 'América',
    'LATAM': 'América',
    'UK': 'Europa',
    'Europa Occ.': 'Europa',
    'Europa Este': 'Europa',
    'Rusia': 'Europa',
    'Oriente Medio': 'Oriente Medio',
    'India': 'Asia',
    'Asia': 'Asia',
    'Turquía': 'Asia',
    'África': 'África',
    'Australia': 'Oceanía',
  };
  const CONTINENT_ORDER = ['América', 'Europa', 'Oriente Medio', 'Asia', 'África', 'Oceanía', 'Otros'];
  const CONTINENT_ICONS = {
    'América': '🌎',
    'Europa': '🌍',
    'Oriente Medio': '🕌',
    'Asia': '🌏',
    'África': '🌍',
    'Oceanía': '🌏',
    'Otros': '🌐',
  };

  // Agrupar items por continente si procede
  const groupedItems = groupByContinent && realCount > 0
    ? CONTINENT_ORDER.reduce((acc, cont) => {
        const matching = items.filter(it => (REGION_TO_CONTINENT[it.region] || 'Otros') === cont);
        if (matching.length > 0) acc.push({ continent: cont, items: matching });
        return acc;
      }, [])
    : null;

  return (
    <div style={{ marginBottom: '20px' }}>
      {/* Bloque de cabecera de sección */}
      <div style={{
        background: gradient || color,
        color: 'white',
        padding: '14px 18px',
        borderRadius: '12px 12px 0 0',
        boxShadow: BRAND.shadow,
      }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap',
          fontFamily: "'Verdana', 'Geneva', sans-serif",
          fontSize: '15px', fontWeight: '800',
          letterSpacing: '0.05em', textTransform: 'uppercase',
        }}>
          <span style={{ fontSize: '17px' }}>{icon}</span>
          <span>{title}</span>
          <span style={{ opacity: 0.85 }}>· {realCount} {itemLabel}</span>
        </div>
        {descriptor && (
          <p style={{
            margin: '6px 0 0', fontSize: '11px', opacity: 0.92,
            fontFamily: "'Verdana', 'Geneva', sans-serif",
            lineHeight: 1.45, letterSpacing: '0.01em',
          }}>
            {descriptor}
          </p>
        )}

        {/* Panel de diagnóstico de feeds DENTRO de la cabecera — visible inmediatamente al cargar */}
        {meta?.feedDiagnostic && meta.feedDiagnostic.length > 0 && (
          <details style={{
            marginTop: '12px',
            padding: '10px 14px',
            background: 'rgba(255,255,255,0.18)',
            border: '1px solid rgba(255,255,255,0.35)',
            borderRadius: '8px',
            fontSize: '11px',
            fontFamily: "'Verdana', sans-serif",
            color: 'white',
            backdropFilter: 'blur(8px)',
          }}>
            <summary style={{
              cursor: 'pointer',
              fontWeight: '800',
              color: 'white',
              letterSpacing: '0.06em',
              fontSize: '11.5px',
              listStyle: 'none',
            }}>
              📊 Diagnóstico de feeds ({meta.feedDiagnostic.length} fuentes · {meta.feedDiagnostic.filter(d => d.includedAfterCap === 0).length} sin piezas) ▼
            </summary>
            <div style={{ marginTop: '10px' }}>
              {meta.feedDiagnostic
                .slice()
                .sort((a, b) => (b.includedAfterCap || 0) - (a.includedAfterCap || 0))
                .map((d, i) => {
                  const included = d.includedAfterCap || 0;
                  const statusIcon = included === 0 ? '⚪' : included >= 2 ? '✅' : '⚠️';
                  return (
                    <details key={i} style={{
                      padding: '6px 8px',
                      marginBottom: '4px',
                      background: included === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.14)',
                      borderRadius: '5px',
                      fontSize: '10.5px',
                    }}>
                      <summary style={{
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        gap: '8px',
                        flexWrap: 'wrap',
                        listStyle: 'none',
                      }}>
                        <strong style={{ color: 'white', fontSize: '11px', minWidth: '105px', fontWeight: '700' }}>
                          {statusIcon} {d.source} {d.urlsCount > 1 && <em style={{ opacity: 0.6, fontSize: '9.5px', fontWeight: '600' }}>· {d.urlsCount} URLs</em>}
                        </strong>
                        <span style={{ color: 'rgba(255,255,255,0.92)', fontSize: '10px', flex: 1, textAlign: 'right' }}>
                          {d.rawCount === 0
                            ? <em style={{ color: 'rgba(255,255,255,0.65)' }}>⚠️ todas las URLs vacías ▼</em>
                            : <>
                                <span style={{ fontWeight: '800' }}>{included} incluidas</span>
                                {' · '}
                                <span>{d.rawCount} en RSS</span>
                                {' · '}
                                <span>{d.passedDateFilter} en 48h</span>
                                {d.hoursAgo !== null && d.hoursAgo !== undefined && (
                                  <em style={{ opacity: 0.7, marginLeft: '4px' }}>· hace {d.hoursAgo}h</em>
                                )}
                              </>
                          }
                        </span>
                      </summary>

                      {/* SUGERENCIA AUTOMÁTICA */}
                      {d.suggestion && (
                        <div style={{
                          marginTop: '6px',
                          padding: '4px 8px',
                          background: 'rgba(252,204,21,0.15)',
                          border: '1px solid rgba(252,204,21,0.4)',
                          borderRadius: '4px',
                          color: '#FACC15',
                          fontSize: '9.5px',
                          fontWeight: '700',
                        }}>
                          {d.suggestion}
                        </div>
                      )}

                      {/* DETALLE POR URL */}
                      {d.urlDetails && d.urlDetails.length > 0 && (
                        <div style={{ marginTop: '6px' }}>
                          {d.urlDetails.map((u, j) => {
                            const statusColor =
                              u.status === 'ok' && u.itemCount > 0 ? '#4ADE80' :
                              u.status === 'empty' || u.itemCount === 0 ? '#FACC15' :
                              '#FCA5A5';
                            const statusEmoji =
                              u.status === 'ok' && u.itemCount > 0 ? '🟢' :
                              u.status === 'empty' || u.itemCount === 0 ? '🟡' :
                              '🔴';
                            return (
                              <div key={j} style={{
                                marginBottom: '3px',
                                padding: '4px 6px',
                                background: 'rgba(0,0,0,0.15)',
                                borderRadius: '3px',
                                fontSize: '9.5px',
                                lineHeight: 1.4,
                              }}>
                                <div style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'baseline',
                                  gap: '6px',
                                }}>
                                  <span style={{ color: statusColor, fontWeight: '700' }}>
                                    {statusEmoji} {u.tier}
                                  </span>
                                  <span style={{ opacity: 0.85 }}>
                                    {u.itemCount} items · {u.status}{u.httpCode && ` ${u.httpCode}`}
                                  </span>
                                </div>
                                <div style={{ opacity: 0.55, fontSize: '9px', marginTop: '2px', wordBreak: 'break-all' }}>
                                  {u.url}
                                </div>
                                {u.errorMsg && (
                                  <div style={{ opacity: 0.65, fontSize: '9px', color: '#FCA5A5', fontStyle: 'italic' }}>
                                    {u.errorMsg}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </details>
                  );
                })}
              <div style={{
                marginTop: '8px', padding: '6px 8px',
                fontSize: '9.5px', fontStyle: 'italic',
                color: 'rgba(255,255,255,0.75)',
                borderTop: '1px dashed rgba(255,255,255,0.25)',
                paddingTop: '7px',
              }}>
                ✅ ≥2 piezas · ⚠️ 1 pieza · ⚪ 0 piezas · Pulsa cada medio para ver detalle por URL · 🟢 URL ok · 🟡 vacía · 🔴 error
              </div>
            </div>
          </details>
        )}
      </div>

      {/* Items */}
      <div style={{
        background: 'rgba(255,255,255,0.4)',
        padding: '8px 8px 4px',
        borderRadius: '0 0 8px 8px',
        border: `1px solid ${color}30`,
        borderTop: 'none',
      }}>
        {realCount === 0 ? (
          <div style={{ margin: '12px', color: BRAND.inkSoft, fontSize: '11px', fontStyle: 'italic', textAlign: 'center' }}>
            <p style={{ margin: '0 0 8px' }}>Sin piezas disponibles para esta sección</p>
            {note && (
              <p style={{ margin: '6px 12px', fontSize: '10px', color: BRAND.orange, fontStyle: 'normal', textAlign: 'left', padding: '8px', background: 'rgba(250,105,0,0.08)', borderRadius: '6px' }}>
                {note}
              </p>
            )}
            {meta && (
              <p style={{ margin: '4px 12px', fontSize: '9px', color: BRAND.inkSoft, fontStyle: 'normal', textAlign: 'left' }}>
                Diagnóstico: {meta.totalCandidates ?? '?'} candidatos · {meta.mediumsAvailable ?? '?'} medios · {meta.selectedCount ?? '?'} seleccionados
              </p>
            )}
          </div>
        ) : groupedItems ? (
          // Render agrupado por continentes
          groupedItems.map((group, gi) => (
            <div key={group.continent} style={{ marginBottom: gi < groupedItems.length - 1 ? '12px' : '0' }}>
              <div style={{
                margin: '8px 4px 6px',
                padding: '6px 12px',
                background: `linear-gradient(90deg, ${color}15, transparent)`,
                borderLeft: `3px solid ${color}`,
                borderRadius: '4px',
                fontFamily: "'Verdana', 'Geneva', sans-serif",
                fontSize: '12px',
                fontWeight: '700',
                color: color,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <span style={{ fontSize: '15px' }}>{CONTINENT_ICONS[group.continent]}</span>
                <span>{group.continent}</span>
                <span style={{ opacity: 0.6, fontWeight: '500' }}>· {group.items.length}</span>
              </div>
              {group.items.map((item, i) => <NewsCard key={`${group.continent}-${i}`} item={item} index={i} sectionColor={color} type={type} />)}
            </div>
          ))
        ) : (
          items.map((item, i) => <NewsCard key={i} item={item} index={i} sectionColor={color} type={type} />)
        )}

      </div>
    </div>
  );
}

export default function App() {
  // Estado por sección - cada botón gestiona su propia carga independiente
  const [intlData, setIntlData] = useState(null);
  const [intlStatus, setIntlStatus] = useState('idle'); // idle | loading | done | error
  const [intlError, setIntlError] = useState('');

  const [spainNewsData, setSpainNewsData] = useState(null);
  const [spainNewsStatus, setSpainNewsStatus] = useState('idle');
  const [spainNewsError, setSpainNewsError] = useState('');

  const [spainOpinionData, setSpainOpinionData] = useState(null);
  const [spainOpinionStatus, setSpainOpinionStatus] = useState('idle');
  const [spainOpinionError, setSpainOpinionError] = useState('');

  const [emailStatus, setEmailStatus] = useState('idle');

  // Cooldown global compartido entre los TRES botones - evita el rate_limit_error 429 de Anthropic Tier 2
  const [nextAllowedAt, setNextAllowedAt] = useState(0);
  const [cooldownLeft, setCooldownLeft] = useState(0);

  // Fecha seleccionada (formato ISO YYYY-MM-DD para el input). Por defecto: hoy.
  const todayIso = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayIso);

  // Timestamp de la última hidratación / guardado (para mostrar "hace Xh")
  const [cacheTimestamp, setCacheTimestamp] = useState(null);

  // Hidratar desde localStorage al montar (solo una vez)
  useEffect(() => {
    const cache = loadBriefingCache();
    if (!cache) return;
    if (cache.intlData) setIntlData(cache.intlData);
    if (cache.spainOpinionData) setSpainOpinionData(cache.spainOpinionData);
    if (cache.spainNewsData) setSpainNewsData(cache.spainNewsData);
    if (cache.selectedDate) setSelectedDate(cache.selectedDate);
    if (cache.timestamp) setCacheTimestamp(cache.timestamp);
  }, []);

  // Guardar en localStorage cada vez que cambie alguna data o la fecha
  useEffect(() => {
    if (!intlData && !spainOpinionData && !spainNewsData) return; // nada que guardar
    saveBriefingCache({ intlData, spainOpinionData, spainNewsData, selectedDate });
    setCacheTimestamp(new Date().toISOString());
  }, [intlData, spainOpinionData, spainNewsData, selectedDate]);

  useEffect(() => {
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((nextAllowedAt - Date.now()) / 1000));
      setCooldownLeft(remaining);
    };
    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [nextAllowedAt]);

  const isInCooldown = cooldownLeft > 0;

  // Derivar formatos de fecha desde selectedDate
  const dateObj = new Date(selectedDate + 'T12:00:00');
  const today = dateObj.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const todayShort = dateObj.toLocaleDateString('es-ES');
  const isPastDate = selectedDate !== todayIso;

  async function fetchSection(section) {
    if (Date.now() < nextAllowedAt) return;

    const setters = {
      international:  { setData: setIntlData,         setStatus: setIntlStatus,         setError: setIntlError },
      spainNews:      { setData: setSpainNewsData,    setStatus: setSpainNewsStatus,    setError: setSpainNewsError },
      spainOpinion:   { setData: setSpainOpinionData, setStatus: setSpainOpinionStatus, setError: setSpainOpinionError },
    };
    const { setData, setStatus, setError } = setters[section] || {};
    if (!setData) return;

    setNextAllowedAt(Date.now() + COOLDOWN_MS);

    setStatus('loading');
    setError('');
    // NO limpiamos setData aquí: mantenemos las noticias antiguas visibles durante la nueva carga.
    // Se reemplazarán solo cuando lleguen las nuevas (en setData(data.briefing)).

    // Construye contexto de hora actual real (independiente de la fecha seleccionada)
    const now = new Date();
    const requestTime = now.toLocaleString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
    // dateFull = fecha de referencia con día de la semana
    const dateFull = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    try {
      const res = await fetch('/api/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: todayShort, dateFull, requestTime, section }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (!data.briefing) throw new Error('Respuesta sin briefing');
      setData(data.briefing);
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setError(err.message || 'Error desconocido');
    }
  }

  function sendEmail() {
    if (!intlData && !spainNewsData && !spainOpinionData) return;
    const merged = mergeBriefings();
    const subject = `🦊 MAL NEWS - Briefing ${todayShort}`;
    const body = buildEmailPlainText(merged);
    const mailtoUrl = `mailto:${RECIPIENT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    try {
      const a = document.createElement('a');
      a.href = mailtoUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setEmailStatus('sent');
    } catch (err) {
      setEmailStatus('error');
    }
  }

  // ============ HTML VIEW & DOWNLOAD - independientes por modo ============
  // Cada llamada crea su PROPIO blob URL único, sin colisiones entre pestañas.
  // El usuario decide cuál HTML quiere ver/descargar pulsando su botón.
  function viewHtmlSingle(mode) {
    if (!intlData && !spainNewsData && !spainOpinionData) return;
    const merged = mergeBriefings();
    const html = buildHtml(merged, mode);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    // Revocar tras 60s para que la pestaña siga cargando bien el contenido
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function downloadHtmlSingle(mode) {
    if (!intlData && !spainNewsData && !spainOpinionData) return;
    const merged = mergeBriefings();
    const html = buildHtml(merged, mode);
    const safeName = (todayShort || 'briefing').replace(/\//g, '-');
    const fileName = mode === 'spain'
      ? `mal-news-espana-${safeName}.html`
      : `mal-news-internacional-${safeName}.html`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Wrappers legacy (por si algo los referencia)
  function openHtmlView() {
    const merged = mergeBriefings();
    const hasSpain = (merged.spainNews?.length || 0) + (merged.spainOpinion?.length || 0) > 0;
    const hasIntl = (merged.worldNews?.length || 0) + (merged.worldOpinion?.length || 0) > 0;
    if (hasSpain) viewHtmlSingle('spain');
    if (hasIntl) setTimeout(() => viewHtmlSingle('international'), hasSpain ? 300 : 0);
  }

  function downloadHtml() {
    const merged = mergeBriefings();
    const hasSpain = (merged.spainNews?.length || 0) + (merged.spainOpinion?.length || 0) > 0;
    const hasIntl = (merged.worldNews?.length || 0) + (merged.worldOpinion?.length || 0) > 0;
    if (hasSpain) downloadHtmlSingle('spain');
    if (hasIntl) setTimeout(() => downloadHtmlSingle('international'), hasSpain ? 350 : 0);
  }

  function mergeBriefings() {
    const baseSpainNews = (spainNewsData && Array.isArray(spainNewsData.spainNews)) ? spainNewsData.spainNews : [];
    const extras = (spainOpinionData && Array.isArray(spainOpinionData.extraNews)) ? spainOpinionData.extraNews : [];
    const seenUrls = new Set(baseSpainNews.filter(i => i && i.url).map(i => i.url));
    const dedupedExtras = extras.filter(i => i && i.url && !seenUrls.has(i.url));
    const mergedNews = [...baseSpainNews, ...dedupedExtras];
    return {
      date: (intlData?.date || spainOpinionData?.date || spainNewsData?.date || todayShort),
      worldNews: intlData?.worldNews || [],
      worldOpinion: intlData?.worldOpinion || [],
      spainNews: mergedNews,
      spainOpinion: spainOpinionData?.spainOpinion || [],
    };
  }

  // Calcula el próximo horario recomendado de briefing según día de la semana y sección
  // section: 'spain' o 'international'
  // Devuelve { day: 'Martes 20 mayo', time: '19:00', reason: '...' }
  function getNextRecommended(section = 'spain') {
    const now = new Date();
    const today = now.getDay(); // 0=Dom, 1=Lun, ..., 6=Sáb
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    // Horarios óptimos por día de la semana y sección
    const schedules = {
      spain: {
        0: { hour: 19, minute: 0, label: 'Domingo · todos los columnistas dominicales publicados' },
        1: { hour: 19, minute: 0, label: 'Lunes · post-laboral · pico Vozpópuli' },
        2: { hour: 19, minute: 0, label: 'Martes · día completo · Maite Rico' },
        3: { hour: 19, minute: 0, label: 'Miércoles · máxima diversidad editorial' },
        4: { hour: 19, minute: 0, label: 'Jueves · día de Estefanía Molina y Agustín Valladolid' },
        5: { hour: 19, minute: 0, label: 'Viernes · cierre de semana laboral' },
        6: { hour: 12, minute: 0, label: 'Sábado · mañana relajada · Maite Rico, Victoria Carvajal' },
      },
      international: {
        0: { hour: 18, minute: 30, label: 'Domingo · NYT Sunday Review · WSJ Weekend · análisis dominical US' },
        1: { hour: 21, minute: 30, label: 'Lunes · pico US business · LATAM activo · Europa cerrada' },
        2: { hour: 21, minute: 30, label: 'Martes · pico US business · LATAM activo' },
        3: { hour: 21, minute: 30, label: 'Miércoles · pico US business · LATAM activo' },
        4: { hour: 21, minute: 30, label: 'Jueves · pico US business · LATAM activo' },
        5: { hour: 21, minute: 30, label: 'Viernes · cierre semana US · análisis del finde' },
        6: { hour: 18, minute: 0, label: 'Sábado · US Saturday news · LATAM despertando' },
      },
    };

    const schedule = schedules[section] || schedules.spain;
    const todaySchedule = schedule[today];
    const todayTargetTime = todaySchedule.hour * 60 + todaySchedule.minute;

    // Si todavía no ha pasado la hora recomendada de HOY, el próximo es HOY
    // Si ya ha pasado, el próximo es MAÑANA
    let targetDate = new Date(now);
    if (currentTime < todayTargetTime) {
      // Es hoy
    } else {
      // Mañana
      targetDate.setDate(targetDate.getDate() + 1);
    }

    const targetDay = targetDate.getDay();
    const targetSchedule = schedule[targetDay];

    // Formatear día y mes
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const isToday = targetDate.toDateString() === now.toDateString();

    return {
      day: isToday
        ? `Hoy · ${dayNames[targetDay].toLowerCase()} ${targetDate.getDate()} ${monthNames[targetDate.getMonth()]}`
        : `${dayNames[targetDay]} ${targetDate.getDate()} ${monthNames[targetDate.getMonth()]}`,
      time: `${String(targetSchedule.hour).padStart(2, '0')}:${String(targetSchedule.minute).padStart(2, '0')}`,
      reason: targetSchedule.label,
    };
  }

  // Construye HTML formateado y autocontenido (CSS inline para compatibilidad email)
  // mode: 'spain' → solo secciones España (Noticias + Opinión)
  //       'international' → solo Internacional (Mundo + Opinión Intl)
  //       'all' → briefing completo (legacy, para vista HTML combinada)
  // ===================================================
  // FORMATO DINÁMICO · 2 HORARIOS INDEPENDIENTES
  // España: optimizado para columnas firmadas españolas
  // Internacional: optimizado para pico US + LATAM
  // ===================================================
  const SCHEDULE_SPAIN = {
    1: { hour: 19, minute: 0,  label: 'Tarde laboral · máxima frescura' },
    2: { hour: 19, minute: 0,  label: 'Tarde laboral · máxima frescura' },
    3: { hour: 19, minute: 0,  label: 'Tarde laboral · máxima frescura' },
    4: { hour: 19, minute: 0,  label: 'Día de Estefanía Molina y Agustín Valladolid' },
    5: { hour: 19, minute: 0,  label: 'Cierra la semana laboral' },
    6: { hour: 12, minute: 0,  label: 'Mañana relajada de sábado' },
    0: { hour: 19, minute: 0,  label: 'Domingo completo · FJL, Pedro J., Cebrián' },
  };

  const SCHEDULE_INTL = {
    1: { hour: 21, minute: 30, label: 'Pico US business · LATAM activo' },
    2: { hour: 21, minute: 30, label: 'Pico US business · LATAM activo' },
    3: { hour: 21, minute: 30, label: 'Pico US business · LATAM activo' },
    4: { hour: 21, minute: 30, label: 'US tarde · Europa cerrada · LATAM peak' },
    5: { hour: 21, minute: 30, label: 'Cierre semanal · setup de fin de semana US' },
    6: { hour: 18, minute: 0,  label: 'US Saturday cycle · LATAM despertando' },
    0: { hour: 18, minute: 30, label: 'NYT Sunday Review · WSJ Weekend · análisis dominical' },
  };

  function calculateNextBriefingForSchedule(schedule) {
    const now = new Date();
    const currentDay = now.getDay();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    const todaySchedule = schedule[currentDay];
    const todayMinutes = todaySchedule.hour * 60 + todaySchedule.minute;
    const nowMinutes = currentHour * 60 + currentMinute;

    let targetDay = currentDay;
    let targetDate = new Date(now);

    if (nowMinutes >= todayMinutes) {
      targetDay = (currentDay + 1) % 7;
      targetDate.setDate(targetDate.getDate() + 1);
    }

    const targetSchedule = schedule[targetDay];
    const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

    return {
      dayName: dayNames[targetDay],
      dayNumber: targetDate.getDate(),
      monthName: monthNames[targetDate.getMonth()],
      hour: String(targetSchedule.hour).padStart(2, '0'),
      minute: String(targetSchedule.minute).padStart(2, '0'),
      label: targetSchedule.label,
    };
  }

  function calculateNextBriefing() {
    return {
      spain: calculateNextBriefingForSchedule(SCHEDULE_SPAIN),
      international: calculateNextBriefingForSchedule(SCHEDULE_INTL),
    };
  }

  function buildHtml(b, mode = 'all') {
    const escape = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const nextBriefing = calculateNextBriefing();

    // Mapeo de colores y gradientes por sección (debe coincidir con SECTION_COLORS/SECTION_GRADIENTS de la PWA)
    const SECTION_STYLES = {
      worldOpinion: { color: '#0F766E', gradient: 'linear-gradient(90deg, #0F766E, #5EEAD4)' },
      worldNews:    { color: '#0F766E', gradient: 'linear-gradient(90deg, #0F766E, #5EEAD4)' },
      spainOpinion: { color: '#65A30D', gradient: 'linear-gradient(90deg, #65A30D, #FACC15)' },
      spainNews:    { color: '#C2410C', gradient: 'linear-gradient(90deg, #C2410C, #FA6900)' },
    };

    const getDay = (iso) => {
      if (!iso) return '';
      try {
        return new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long' });
      } catch (_) { return ''; }
    };

    const card = (item, color, isOpinion) => {
      const sourceColor = getSourceColor(item.source);
      const dateBadge = formatDateBadge(item.publishedDate);
      const readTime = calculateReadTime(item);
      const summaryStyle = isOpinion ? 'font-style:italic;' : '';
      const link = item.url
        ? `<a href="${escape(item.url)}" style="color:${color};text-decoration:none;border-bottom:1px dotted ${color};font-weight:700;font-size:10.5px;white-space:nowrap;">leer &rarr;</a>`
        : '';
      const sourceBadge = item.source
        ? `<span style="background:${sourceColor};color:white;font-size:9px;font-weight:800;letter-spacing:0.08em;padding:3px 8px;border-radius:4px;text-transform:uppercase;">${escape(item.source)}</span>`
        : '';
      const dateBadgeHtml = dateBadge
        ? `<span style="background:rgba(26,54,93,0.08);color:rgba(26,54,93,0.75);font-size:9px;font-weight:700;letter-spacing:0.08em;padding:3px 8px;border-radius:4px;">${escape(dateBadge)}</span>`
        : '';
      const readBadge = `<span style="background:rgba(250,105,0,0.10);color:#C2410C;font-size:9px;font-weight:700;letter-spacing:0.04em;padding:3px 8px;border-radius:4px;">${readTime} min</span>`;
      const footerText = isOpinion && item.author
        ? `<span style="font-weight:700;font-style:italic;opacity:0.8;">&mdash; ${escape(item.author)}</span>`
        : !isOpinion && item.region
        ? `<span style="font-weight:700;font-style:italic;opacity:0.8;">${escape(item.region)}</span>`
        : '<span></span>';
      return `
        <div style="background:#FFFFFF;border-left:4px solid ${color};border-radius:0 8px 8px 0;padding:12px 14px;margin-bottom:8px;box-shadow:0 4px 12px rgba(0,0,0,0.08);font-family:Verdana,Geneva,sans-serif;">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
            ${sourceBadge}
            ${dateBadgeHtml}
            ${readBadge}
          </div>
          <div style="font-size:${isOpinion ? '14px' : '13px'};font-weight:700;color:#1A365D;line-height:1.3;margin-bottom:5px;">${escape(item.title)}</div>
          <div style="font-size:11.5px;color:rgba(26,54,93,0.72);line-height:1.5;${summaryStyle}margin-bottom:6px;">${escape(item.summary)}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:10.5px;color:#1A365D;">
            ${footerText}
            ${link}
          </div>
        </div>`;
    };

    const section = (title, icon, items, colorKey, descriptor, isOpinion) => {
      if (!items?.length) return '';
      const { color, gradient } = SECTION_STYLES[colorKey];
      const itemLabel = isOpinion ? (items.length === 1 ? 'COLUMNA' : 'COLUMNAS') : (items.length === 1 ? 'PIEZA' : 'PIEZAS');
      const itemsHtml = items.map(i => card(i, color, isOpinion)).join('');
      return `
        <div style="margin-bottom:28px;">
          <div style="background:${gradient};color:white;padding:16px 20px;border-radius:12px 12px 0 0;box-shadow:0 4px 12px rgba(0,0,0,0.08);font-family:Verdana,Geneva,sans-serif;">
            <div style="font-size:15px;font-weight:800;letter-spacing:0.05em;text-transform:uppercase;">
              ${icon} ${escape(title)} &middot; ${items.length} ${itemLabel}
            </div>
            <div style="font-size:11px;opacity:0.92;margin-top:6px;">${escape(descriptor)}</div>
          </div>
          <div style="background:rgba(255,255,255,0.55);padding:10px 10px 4px;border-radius:0 0 12px 12px;">
            ${itemsHtml}
          </div>
        </div>`;
    };

    // Calcular total según modo
    let total = 0;
    let sectionsHtml = '';
    let headerTitle = 'MAL NEWS';
    let pageSubtitle = '';

    if (mode === 'spain') {
      total = (b.spainNews?.length || 0) + (b.spainOpinion?.length || 0);
      headerTitle = 'MAL NEWS · ESPAÑA';
      pageSubtitle = 'Noticias y opinión nacional';
      sectionsHtml =
        section('España', '🇪🇸', b.spainNews, 'spainNews', 'Eventos concretos · prensa española · publicadas últimas 48h', false) +
        section('Opinión España', '✍️', b.spainOpinion, 'spainOpinion', 'Columnas firmadas · sin editoriales · 4+ medios · publicadas hoy o ayer', true);
    } else if (mode === 'international') {
      total = (b.worldNews?.length || 0) + (b.worldOpinion?.length || 0);
      headerTitle = 'MAL NEWS · INTERNACIONAL';
      pageSubtitle = 'Mundo y opinión global';
      sectionsHtml =
        section('Mundo', '🌍', b.worldNews, 'worldNews', 'Cobertura global plural · publicadas en últimas 48h · incluye sentencias relevantes', false) +
        section('Opinión Internacional', '✍️', b.worldOpinion, 'worldOpinion', 'Columnas firmadas · medios internacionales · 48h previas', true);
    } else {
      // mode = 'all' (briefing completo - solo para Vista HTML)
      total = (b.worldOpinion?.length || 0) + (b.worldNews?.length || 0)
            + (b.spainOpinion?.length || 0) + (b.spainNews?.length || 0);
      headerTitle = 'MAL NEWS';
      pageSubtitle = 'Briefing completo del día';
      sectionsHtml =
        section('España', '🇪🇸', b.spainNews, 'spainNews', 'Eventos concretos · prensa española · publicadas últimas 48h', false) +
        section('Opinión España', '✍️', b.spainOpinion, 'spainOpinion', 'Columnas firmadas · sin editoriales · 4+ medios · publicadas hoy o ayer', true) +
        section('Mundo', '🌍', b.worldNews, 'worldNews', 'Cobertura global plural · publicadas en últimas 48h · incluye sentencias relevantes', false) +
        section('Opinión Internacional', '✍️', b.worldOpinion, 'worldOpinion', 'Columnas firmadas · medios internacionales · 48h previas', true);
    }

    // ID único por modo para aislar CSS cuando se pegan ambos HTMLs en el mismo email
    const wrapperId = mode === 'spain' ? 'mal-news-esp' : mode === 'international' ? 'mal-news-intl' : 'mal-news-all';
    const W = `#${wrapperId}`;

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${escape(headerTitle)} - ${escape(b.date || todayShort)}</title>
<style>
  ${W} { margin:0; padding:24px; background:#F0F4F8; font-family:Verdana,Geneva,sans-serif; color:#1A365D; box-sizing:border-box; }
  ${W} .container { max-width:820px; margin:0 auto; }
  ${W} .header { text-align:center; margin-bottom:28px; padding:24px; background:#FFFFFF; border-radius:14px; box-shadow:0 4px 12px rgba(0,0,0,0.08); }
  ${W} .logo { font-size:28px; font-weight:800; color:#1A365D; letter-spacing:2px; margin:0; }
  ${W} .subtitle { font-size:13px; font-style:italic; color:rgba(26,54,93,0.7); margin:6px 0 0; }
  ${W} .date { font-size:12px; letter-spacing:0.3em; color:#1A365D; opacity:0.7; text-transform:uppercase; font-weight:800; margin:10px 0 0; }
  ${W} .total { font-size:11px; color:#0EA5E9; letter-spacing:0.15em; font-weight:700; margin-top:12px; }
  ${W} .footer { text-align:center; margin-top:32px; padding:18px; font-size:10px; color:rgba(26,54,93,0.55); letter-spacing:0.15em; font-style:italic; border-top:1px solid rgba(26,54,93,0.12); }
  ${W} .next-briefing { background:#FAFBFC; border-radius:14px; padding:20px 22px; margin:32px 0 0; box-shadow:0 4px 16px rgba(0,0,0,0.05); border:1px solid rgba(26,54,93,0.08); }
  ${W} .next-briefing-label { text-align:center; font-size:10px; font-weight:800; letter-spacing:0.18em; color:#1A365D; margin-bottom:14px; opacity:0.75; }
  ${W} .schedule-card { display:flex; gap:14px; align-items:center; padding:14px 16px; border-radius:10px; margin-bottom:10px; }
  ${W} .spain-card { background:linear-gradient(135deg, rgba(101,163,13,0.10), rgba(250,204,21,0.15)); border-left:4px solid #C2410C; }
  ${W} .intl-card { background:linear-gradient(135deg, rgba(15,118,110,0.10), rgba(94,234,212,0.15)); border-left:4px solid #0F766E; }
  ${W} .card-icon { font-size:32px; flex-shrink:0; }
  ${W} .card-body { flex:1; }
  ${W} .card-title { font-size:10px; font-weight:800; letter-spacing:0.16em; color:#1A365D; margin-bottom:3px; opacity:0.7; }
  ${W} .spain-card .card-title { color:#C2410C; opacity:1; }
  ${W} .intl-card .card-title { color:#0F766E; opacity:1; }
  ${W} .card-time { font-family:Georgia,serif; font-style:italic; font-size:17px; font-weight:700; color:#1A365D; margin-bottom:3px; line-height:1.2; }
  ${W} .card-reason { font-size:10.5px; font-style:italic; color:rgba(26,54,93,0.65); line-height:1.3; }
  ${W} .next-briefing-schedule { border-top:1px dashed rgba(26,54,93,0.12); padding-top:14px; margin-top:8px; }
  ${W} .schedule-title { font-size:10px; font-weight:800; letter-spacing:0.12em; color:#1A365D; margin-bottom:10px; opacity:0.7; text-align:center; }
  ${W} .schedule-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  ${W} .schedule-col-title { font-size:9px; font-weight:800; letter-spacing:0.14em; padding:4px 0; margin-bottom:4px; text-align:center; border-radius:4px; }
  ${W} .spain-title { background:linear-gradient(90deg, rgba(101,163,13,0.12), rgba(250,204,21,0.15)); color:#C2410C; }
  ${W} .intl-title { background:linear-gradient(90deg, rgba(15,118,110,0.12), rgba(94,234,212,0.15)); color:#0F766E; }
  ${W} .schedule-row { display:flex; justify-content:space-between; font-size:11px; color:#1A365D; padding:3px 6px; border-bottom:1px dashed rgba(26,54,93,0.06); }
  ${W} .schedule-row:last-child { border-bottom:none; }
  ${W} .copy-hint { background:#FFFFFF; border:1px solid rgba(26,54,93,0.15); border-radius:10px; padding:14px 18px; margin-bottom:20px; font-size:12px; color:#1A365D; text-align:center; box-shadow:0 4px 12px rgba(0,0,0,0.05); }
  ${W} .next-brief { margin-top:36px; padding:22px 26px; background:linear-gradient(135deg, #FFFFFF, #FAFBFC); border:1px solid rgba(250,105,0,0.25); border-left:4px solid #FA6900; border-radius:14px; box-shadow:0 8px 24px rgba(250,105,0,0.10); }
  ${W} .next-brief-label { font-size:9px; font-weight:800; letter-spacing:0.22em; color:#FA6900; text-transform:uppercase; margin-bottom:8px; }
  ${W} .next-brief-day { font-family:Georgia,serif; font-size:20px; font-style:italic; color:#1A365D; font-weight:700; margin-bottom:4px; }
  ${W} .next-brief-time { font-size:32px; font-weight:900; color:#FA6900; letter-spacing:0.02em; margin-bottom:8px; line-height:1; }
  ${W} .next-brief-reason { font-size:11px; color:rgba(26,54,93,0.7); font-style:italic; line-height:1.5; }
  ${W} .next-brief-table { margin-top:16px; padding-top:14px; border-top:1px dashed rgba(250,105,0,0.25); font-size:10px; color:rgba(26,54,93,0.65); line-height:1.7; }
  ${W} .next-brief-table strong { color:#1A365D; font-weight:700; letter-spacing:0.05em; }
  @media print { ${W} .copy-hint { display:none; } ${W} { background:white; } }
</style>
</head>
<body style="margin:0;padding:0;">
<div id="${wrapperId}">
  <div class="container">
    <div class="copy-hint">
      💡 <strong>Copia para email:</strong> Ctrl+A &rarr; Ctrl+C &rarr; pega en Gmail (conserva formato). O imprime con Ctrl+P para PDF.
    </div>
    <div class="header">
      <h1 class="logo">${escape(headerTitle)}</h1>
      <p class="subtitle">${escape(pageSubtitle)}</p>
      <p class="date">${escape(b.date || todayShort)}</p>
      <p class="total">${total} PIEZAS</p>
    </div>
    ${sectionsHtml}
    ${(() => {
      // Solo mostrar bloque de próximo briefing si el modo es spain o international
      if (mode === 'all') return '';
      const next = getNextRecommended(mode);
      const sectionLabel = mode === 'spain' ? 'ESPAÑA' : 'INTERNACIONAL';
      return `
    <div class="next-brief">
      <div class="next-brief-label">🔔 PRÓXIMO BRIEFING ${sectionLabel}</div>
      <div class="next-brief-day">${escape(next.day)}</div>
      <div class="next-brief-time">${escape(next.time)}</div>
      <div class="next-brief-reason">${escape(next.reason)}</div>
      <div class="next-brief-table">
        ${mode === 'spain'
          ? '<strong>Horario semanal España:</strong> Lun-Vie 19:00 &middot; Sábado 12:00 &middot; Domingo 19:00'
          : '<strong>Horario semanal Internacional:</strong> Lun-Vie 21:30 &middot; Sábado 18:00 &middot; Domingo 18:30'}
      </div>
    </div>`;
    })()}
    <div class="next-briefing">
      <div class="next-briefing-label">🔔 PRÓXIMOS BRIEFINGS RECOMENDADOS</div>

      <div class="schedule-card spain-card">
        <div class="card-icon">🇪🇸</div>
        <div class="card-body">
          <div class="card-title">ESPAÑA</div>
          <div class="card-time">${escape(nextBriefing.spain.dayName)} ${nextBriefing.spain.dayNumber} ${escape(nextBriefing.spain.monthName)} · ${nextBriefing.spain.hour}:${nextBriefing.spain.minute}</div>
          <div class="card-reason">"${escape(nextBriefing.spain.label)}"</div>
        </div>
      </div>

      <div class="schedule-card intl-card">
        <div class="card-icon">🌍</div>
        <div class="card-body">
          <div class="card-title">INTERNACIONAL</div>
          <div class="card-time">${escape(nextBriefing.international.dayName)} ${nextBriefing.international.dayNumber} ${escape(nextBriefing.international.monthName)} · ${nextBriefing.international.hour}:${nextBriefing.international.minute}</div>
          <div class="card-reason">"${escape(nextBriefing.international.label)}"</div>
        </div>
      </div>

      <div class="next-briefing-schedule">
        <div class="schedule-title">📅 Horario semanal</div>
        <div class="schedule-grid">
          <div class="schedule-col">
            <div class="schedule-col-title spain-title">🇪🇸 ESPAÑA</div>
            <div class="schedule-row"><span>Lun-Vie</span><span>19:00</span></div>
            <div class="schedule-row"><span>Sábado</span><span>12:00</span></div>
            <div class="schedule-row"><span>Domingo</span><span>19:00</span></div>
          </div>
          <div class="schedule-col">
            <div class="schedule-col-title intl-title">🌍 INTERNACIONAL</div>
            <div class="schedule-row"><span>Lun-Vie</span><span>21:30</span></div>
            <div class="schedule-row"><span>Sábado</span><span>18:00</span></div>
            <div class="schedule-row"><span>Domingo</span><span>18:30</span></div>
          </div>
        </div>
      </div>
    </div>
    <div class="footer">
      MAL NEWS &middot; ${escape(RECIPIENT)} &middot; v3 PWA
    </div>
  </div>
</div>
</body>
</html>`;
  }

  function buildEmailPlainText(b) {
    const leanLabel = (lean) => lean === 'left' ? '[IZQ ◀]' : lean === 'right' ? '[DER ▶]' : '';
    const sep = '-'.repeat(50);
    const dsep = '='.repeat(50);

    const section = (title, items) => {
      if (!items?.length) return '';
      const rows = items.map(i => {
        const tags = [leanLabel(i.lean), i.region ? `[${i.region}]` : ''].filter(Boolean).join(' ');
        const byline = i.author ? `${i.author} · ${i.source || ''}` : (i.source || '');
        const lines = [
          `${i.rank}. ${tags ? tags + ' ' : ''}${i.title}`,
          `   ${i.summary || ''}`,
          `   ${byline}`,
        ];
        if (i.url) lines.push(`   ${i.url}`);
        return lines.join('\n');
      }).join('\n\n');
      return `\n${title.toUpperCase()} (${items.length})\n${sep}\n\n${rows}\n`;
    };

    return [
      `MAL NEWS - Briefing ${b.date || todayShort}`,
      `Tu briefing diario · ${totalPieces} piezas`,
      dsep,
      section('🇪🇸 España', b.spainNews),
      section('✒️ Opinión España', b.spainOpinion),
      section('🌍 Mundo', b.worldNews),
      section('✍️ Opinión Internacional', b.worldOpinion),
      dsep,
      'MAL NEWS · Briefing automático',
      '',
    ].join('\n');
  }

  const merged = mergeBriefings();
  const totalPieces =
    (merged.worldNews?.length || 0) + (merged.worldOpinion?.length || 0) +
    (merged.spainNews?.length || 0) + (merged.spainOpinion?.length || 0);

  // ============ COLORES POR SECCIÓN (paleta actual: teal + lima-dorado + naranja) ============
  const SECTION_COLORS = {
    worldOpinion: BRAND.intlColor,    // Teal
    worldNews:    BRAND.intlColor,
    spainOpinion: BRAND.opinionColor, // Lima
    spainNews:    BRAND.newsColor,    // Naranja
  };
  const SECTION_GRADIENTS = {
    worldOpinion: BRAND.intlGrad,     // teal oscuro → mint
    worldNews:    BRAND.intlGrad,
    spainOpinion: BRAND.opinionGrad,  // lima oscuro → dorado
    spainNews:    BRAND.newsGrad,     // rojo → naranja
  };

  const intlSections = intlData ? [
    { title: 'Mundo', icon: '🌍', items: intlData.worldNews, color: SECTION_COLORS.worldNews, gradient: SECTION_GRADIENTS.worldNews, count: 20, type: 'news',
      descriptor: 'Cobertura global plural · ≥6 regiones · equilibrio IZQ/DER · incluye sentencias relevantes', groupByContinent: true },
    { title: 'Opinión Internacional', icon: '✍️', items: intlData.worldOpinion, color: SECTION_COLORS.worldOpinion, gradient: SECTION_GRADIENTS.worldOpinion, count: 8, type: 'opinion',
      descriptor: 'Columnas firmadas · medios internacionales · 48h previas · evento concreto',
      note: intlData._note,
      meta: intlData._meta },
  ] : [];

  const spainOpinionSections = spainOpinionData ? [
    { title: 'Opinión España', icon: '✍️', items: spainOpinionData.spainOpinion, color: SECTION_COLORS.spainOpinion, gradient: SECTION_GRADIENTS.spainOpinion, count: 16, type: 'opinion',
      descriptor: 'Columnas firmadas · sin editoriales · 4+ medios · publicadas hoy o ayer',
      note: spainOpinionData._note,
      meta: spainOpinionData._meta },
  ] : [];

  // Items extras reclasificados desde Opinión a Noticias (defensivo)
  const opinionExtraItems = (spainOpinionData && Array.isArray(spainOpinionData.extraNews))
    ? spainOpinionData.extraNews
    : [];

  const spainNewsSections = (() => {
    const hasNewsData = spainNewsData && Array.isArray(spainNewsData.spainNews);
    const hasExtras = opinionExtraItems.length > 0;
    if (!hasNewsData && !hasExtras) return [];
    const base = hasNewsData ? spainNewsData.spainNews : [];
    const seenUrls = new Set(base.filter(i => i && i.url).map(i => i.url));
    const extras = opinionExtraItems.filter(i => i && i.url && !seenUrls.has(i.url));
    const allItems = [...base, ...extras];
    return [{
      title: 'España',
      icon: '🇪🇸',
      items: allItems,
      color: SECTION_COLORS.spainNews,
      gradient: SECTION_GRADIENTS.spainNews,
      count: 25,
      type: 'news',
      descriptor: extras.length > 0
        ? `Eventos concretos · prensa española · 48h · +${extras.length} reclasificadas de opinión`
        : 'Eventos concretos · prensa española · publicadas últimas 48h',
      note: hasNewsData ? spainNewsData._note : null,
      meta: hasNewsData ? spainNewsData._meta : null,
    }];
  })();

  // Contadores reales devueltos por el API tras cada fetch
  const realIntlCount = intlData ? ((intlData.worldNews?.length || 0) + (intlData.worldOpinion?.length || 0)) : 0;
  const realSpainOpinionCount = spainOpinionData?.spainOpinion?.length || 0;
  const realSpainNewsCount = spainNewsData?.spainNews?.length || 0;

  const intlBtnLabel = (() => {
    if (intlStatus === 'loading') return 'Buscando internacional...';
    if (isInCooldown) return `⏳ Espera ${cooldownLeft}s`;
    if (intlStatus === 'done') return `🔄 Recargar internacional (${realIntlCount})`;
    return '🌍 Internacional (hasta 28)';
  })();

  const spainOpinionBtnLabel = (() => {
    if (spainOpinionStatus === 'loading') return 'Buscando opinión España...';
    if (isInCooldown) return `⏳ Espera ${cooldownLeft}s`;
    if (spainOpinionStatus === 'done') return `🔄 Recargar opinión España (${realSpainOpinionCount})`;
    return '✍️ Opinión España (hasta 16)';
  })();

  const spainNewsBtnLabel = (() => {
    if (spainNewsStatus === 'loading') return 'Buscando noticias España...';
    if (isInCooldown) return `⏳ Espera ${cooldownLeft}s`;
    if (spainNewsStatus === 'done') return `🔄 Recargar noticias España (${realSpainNewsCount})`;
    return '🇪🇸 Noticias España (hasta 25)';
  })();

  const hasAnyData = intlData || spainNewsData || spainOpinionData;
  const anyLoading = intlStatus === 'loading' || spainNewsStatus === 'loading' || spainOpinionStatus === 'loading';

  return (
    <div style={{
      minHeight: '100vh',
      background: `linear-gradient(135deg, ${BRAND.limeLight} 0%, ${BRAND.limeDark} 100%)`,
      backgroundAttachment: 'fixed',
      color: BRAND.ink,
      fontFamily: "'Verdana', 'Geneva', sans-serif",
      padding: '20px 16px',
      paddingTop: 'max(20px, env(safe-area-inset-top))',
      paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
      position: 'relative',
    }}>
      <style>{`
        @keyframes fadeSlide { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-4px); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .mal-cta:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(194,105,60,0.45) !important; }
        .mal-cta-secondary:hover:not(:disabled) { background: rgba(255,255,255,0.14) !important; border-color: ${BRAND.orange} !important; color: ${BRAND.orange} !important; }
      `}</style>

      <div style={{
        position: 'fixed', top: 0, right: 0, width: '60%', height: '40%',
        background: 'radial-gradient(ellipse at top right, rgba(194,105,60,0.12) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '780px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px', animation: 'fadeSlide 0.6s ease both' }}>
          <DiagonalHeader dateObj={dateObj} />
        </div>

        {/* Selector de fecha del briefing - R3 Diseño · círculo calendario + card */}
        {(() => {
          const d = new Date(selectedDate + 'T12:00:00');
          const dayNum = d.getDate();
          const monthShort = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'][d.getMonth()];
          const fullDateStr = d.toLocaleDateString('es-ES', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
          });
          const disabled = isInCooldown || anyLoading;

          return (
            <div style={{
              display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '14px',
              marginBottom: '14px', flexWrap: 'wrap',
            }}>
              {/* Círculo con día y mes - clickable (abre date picker nativo) */}
              <label style={{
                position: 'relative',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.6 : 1,
              }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #1A365D, #0A4D3A)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  boxShadow: '0 6px 20px rgba(26,54,93,0.3)',
                  position: 'relative',
                  transition: 'transform 0.15s ease',
                }}>
                  {/* Tira amarilla decorativa estilo "page binding" */}
                  <div style={{
                    position: 'absolute',
                    top: '9px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '26px',
                    height: '3px',
                    background: '#FACC15',
                    borderRadius: '2px',
                  }} />
                  <div style={{
                    fontFamily: 'Georgia, serif',
                    fontStyle: 'italic',
                    fontSize: '24px',
                    fontWeight: '800',
                    lineHeight: 1,
                    marginTop: '7px',
                  }}>
                    {dayNum}
                  </div>
                  <div style={{
                    fontSize: '8.5px',
                    fontWeight: '800',
                    letterSpacing: '0.14em',
                    opacity: 0.9,
                    marginTop: '3px',
                  }}>
                    {monthShort}
                  </div>
                </div>
                {/* Input invisible que cubre el círculo - abre el date picker nativo al pulsar */}
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  max={todayIso}
                  disabled={disabled}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    border: 'none',
                    background: 'transparent',
                  }}
                />
              </label>

              {/* Card a la derecha con la fecha completa - también clickable */}
              <label style={{
                cursor: disabled ? 'not-allowed' : 'pointer',
                position: 'relative',
              }}>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  background: 'white',
                  padding: '12px 20px',
                  borderRadius: '14px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
                  borderLeft: '4px solid #0A4D3A',
                  opacity: disabled ? 0.6 : 1,
                }}>
                  <div style={{
                    fontSize: '9px',
                    fontWeight: '800',
                    letterSpacing: '0.16em',
                    color: '#0A4D3A',
                    marginBottom: '3px',
                  }}>
                    📅 BRIEFING DEL
                  </div>
                  <div style={{
                    fontFamily: 'Georgia, serif',
                    fontStyle: 'italic',
                    fontSize: '16px',
                    fontWeight: '700',
                    color: '#1A365D',
                    lineHeight: 1.2,
                  }}>
                    {fullDateStr}
                  </div>
                </div>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  max={todayIso}
                  disabled={disabled}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    border: 'none',
                    background: 'transparent',
                  }}
                />
              </label>

              {/* Botón volver a hoy - solo si fecha pasada */}
              {isPastDate && (
                <button
                  onClick={() => setSelectedDate(todayIso)}
                  disabled={disabled}
                  style={{
                    fontFamily: "'Verdana', 'Geneva', sans-serif",
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '8px 14px',
                    borderRadius: '10px',
                    border: `2px solid ${BRAND.orange}`,
                    background: 'white',
                    color: BRAND.orange,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    letterSpacing: '0.08em',
                    boxShadow: '0 2px 8px rgba(250,105,0,0.15)',
                  }}
                >
                  ↻ HOY
                </button>
              )}
            </div>
          );
        })()}

        {isPastDate && (
          <p style={{ textAlign: 'center', color: BRAND.inkSoft, fontSize: '10px', marginBottom: '10px', fontStyle: 'italic' }}>
            Briefing histórico - fechas antiguas pueden tener menos piezas y URLs rotas
          </p>
        )}

        {/* Indicador de cache: cuándo se generó la última versión */}
        {cacheTimestamp && (intlData || spainOpinionData || spainNewsData) && (
          <div style={{
            textAlign: 'center', fontSize: '10px', color: BRAND.inkSoft,
            marginBottom: '12px', fontStyle: 'italic',
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px',
          }}>
            <span>💾 Briefing guardado {formatCacheAge(cacheTimestamp)}</span>
            <button
              onClick={() => {
                clearBriefingCache();
                setIntlData(null);
                setSpainOpinionData(null);
                setSpainNewsData(null);
                setCacheTimestamp(null);
              }}
              style={{
                fontSize: '9px', padding: '2px 8px', borderRadius: '4px',
                border: `1px solid ${BRAND.inkSoft}`, background: 'transparent',
                color: BRAND.inkSoft, cursor: 'pointer', fontStyle: 'normal',
              }}
            >
              limpiar
            </button>
          </div>
        )}

        {/* TRES BOTONES: cada uno con su gradiente identitario y texto blanco */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <button
            className="mal-cta"
            onClick={() => fetchSection('spainOpinion')}
            disabled={spainOpinionStatus === 'loading' || isInCooldown}
            style={{
              border: 'none', borderRadius: '12px', padding: '14px 22px',
              fontSize: '11px', fontWeight: '800', letterSpacing: '0.08em',
              cursor: (spainOpinionStatus === 'loading' || isInCooldown) ? 'wait' : 'pointer',
              transition: 'all 0.25s ease', fontFamily: "'Verdana', 'Geneva', sans-serif",
              background: spainOpinionStatus === 'loading'
                ? `linear-gradient(90deg, #65A30D, #FACC15, #65A30D)`
                : BRAND.opinionGrad,
              backgroundSize: spainOpinionStatus === 'loading' ? '200% 100%' : '100% 100%',
              animation: spainOpinionStatus === 'loading' ? 'shimmer 2s linear infinite' : 'none',
              color: 'white', opacity: (spainOpinionStatus === 'loading' || isInCooldown) ? 0.65 : 1,
              boxShadow: '0 6px 20px rgba(101,163,13,0.40)', textTransform: 'uppercase',
              textShadow: '0 1px 2px rgba(0,0,0,0.15)',
            }}
          >
            {spainOpinionBtnLabel}
          </button>

          <button
            className="mal-cta"
            onClick={() => fetchSection('spainNews')}
            disabled={spainNewsStatus === 'loading' || isInCooldown}
            style={{
              border: 'none', borderRadius: '12px', padding: '14px 22px',
              fontSize: '11px', fontWeight: '800', letterSpacing: '0.08em',
              cursor: (spainNewsStatus === 'loading' || isInCooldown) ? 'wait' : 'pointer',
              transition: 'all 0.25s ease', fontFamily: "'Verdana', 'Geneva', sans-serif",
              background: spainNewsStatus === 'loading'
                ? `linear-gradient(90deg, #C2410C, #FA6900, #C2410C)`
                : BRAND.newsGrad,
              backgroundSize: spainNewsStatus === 'loading' ? '200% 100%' : '100% 100%',
              animation: spainNewsStatus === 'loading' ? 'shimmer 2s linear infinite' : 'none',
              color: 'white', opacity: (spainNewsStatus === 'loading' || isInCooldown) ? 0.65 : 1,
              boxShadow: '0 6px 20px rgba(250,105,0,0.40)', textTransform: 'uppercase',
              textShadow: '0 1px 2px rgba(0,0,0,0.15)',
            }}
          >
            {spainNewsBtnLabel}
          </button>

          <button
            className="mal-cta"
            onClick={() => fetchSection('international')}
            disabled={intlStatus === 'loading' || isInCooldown}
            style={{
              border: 'none', borderRadius: '12px', padding: '14px 22px',
              fontSize: '11px', fontWeight: '800', letterSpacing: '0.08em',
              cursor: (intlStatus === 'loading' || isInCooldown) ? 'wait' : 'pointer',
              transition: 'all 0.25s ease', fontFamily: "'Verdana', 'Geneva', sans-serif",
              background: intlStatus === 'loading'
                ? `linear-gradient(90deg, #0F766E, #5EEAD4, #0F766E)`
                : BRAND.intlGrad,
              backgroundSize: intlStatus === 'loading' ? '200% 100%' : '100% 100%',
              animation: intlStatus === 'loading' ? 'shimmer 2s linear infinite' : 'none',
              color: 'white', opacity: (intlStatus === 'loading' || isInCooldown) ? 0.65 : 1,
              boxShadow: '0 6px 20px rgba(15,118,110,0.40)', textTransform: 'uppercase',
              textShadow: '0 1px 2px rgba(0,0,0,0.15)',
            }}
          >
            {intlBtnLabel}
          </button>
        </div>

        {/* Botones de exportación: email texto plano + vista HTML formateada + descargar HTML */}
        {hasAnyData && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <button
              className="mal-cta-secondary"
              onClick={sendEmail}
              style={{
                border: `1px solid ${BRAND.navy}50`, borderRadius: '8px',
                padding: '10px 16px', fontSize: '11px', fontWeight: '700',
                letterSpacing: '0.05em', cursor: 'pointer',
                transition: 'all 0.2s ease', fontFamily: "'Verdana', 'Geneva', sans-serif",
                background: 'rgba(255,255,255,0.85)', color: BRAND.ink,
              }}
            >
              {emailStatus === 'sent' ? '✓ Email preparado' : `📧 Email plano`}
            </button>
            <button
              onClick={() => viewHtmlSingle('spain')}
              style={{
                border: `1px solid ${BRAND.orange}`, borderRadius: '8px',
                padding: '10px 14px', fontSize: '11px', fontWeight: '700',
                letterSpacing: '0.04em', cursor: 'pointer',
                transition: 'all 0.2s ease', fontFamily: "'Verdana', 'Geneva', sans-serif",
                background: 'rgba(255,255,255,0.85)', color: BRAND.orange,
              }}
              title="Abrir HTML España en nueva pestaña"
            >
              🇪🇸 Ver España
            </button>
            <button
              onClick={() => viewHtmlSingle('international')}
              style={{
                border: `1px solid #0F766E`, borderRadius: '8px',
                padding: '10px 14px', fontSize: '11px', fontWeight: '700',
                letterSpacing: '0.04em', cursor: 'pointer',
                transition: 'all 0.2s ease', fontFamily: "'Verdana', 'Geneva', sans-serif",
                background: 'rgba(255,255,255,0.85)', color: '#0F766E',
              }}
              title="Abrir HTML Internacional en nueva pestaña"
            >
              🌍 Ver Internacional
            </button>
            <button
              onClick={() => downloadHtmlSingle('spain')}
              style={{
                border: `1px solid ${BRAND.orange}`, borderRadius: '8px',
                padding: '10px 14px', fontSize: '11px', fontWeight: '700',
                letterSpacing: '0.04em', cursor: 'pointer',
                transition: 'all 0.2s ease', fontFamily: "'Verdana', 'Geneva', sans-serif",
                background: BRAND.orange, color: 'white',
              }}
              title="Descargar HTML España"
            >
              ⬇️ España
            </button>
            <button
              onClick={() => downloadHtmlSingle('international')}
              style={{
                border: `1px solid #0F766E`, borderRadius: '8px',
                padding: '10px 14px', fontSize: '11px', fontWeight: '700',
                letterSpacing: '0.04em', cursor: 'pointer',
                transition: 'all 0.2s ease', fontFamily: "'Verdana', 'Geneva', sans-serif",
                background: '#0F766E', color: 'white',
              }}
              title="Descargar HTML Internacional"
            >
              ⬇️ Internacional
            </button>
          </div>
        )}

        {/* Mensajes de loading individuales */}
        {intlStatus === 'loading' && (
          <p style={{ textAlign: 'center', color: BRAND.orange, fontSize: '12px', animation: 'pulse 1.5s infinite', marginBottom: '8px', fontStyle: 'italic' }}>
            🌍 Buscando 28 piezas internacionales...
          </p>
        )}
        {spainOpinionStatus === 'loading' && (
          <p style={{ textAlign: 'center', color: BRAND.orange, fontSize: '12px', animation: 'pulse 1.5s infinite', marginBottom: '8px', fontStyle: 'italic' }}>
            ✍️ Buscando 16 columnas de opinión España...
          </p>
        )}
        {spainNewsStatus === 'loading' && (
          <p style={{ textAlign: 'center', color: BRAND.orange, fontSize: '12px', animation: 'pulse 1.5s infinite', marginBottom: '8px', fontStyle: 'italic' }}>
            🇪🇸 Buscando 25 noticias España...
          </p>
        )}

        {/* Mensaje de cooldown activo cuando NO hay carga en marcha */}
        {isInCooldown && !anyLoading && (
          <p style={{ textAlign: 'center', color: 'rgba(30,58,138,0.65)', fontSize: '11px', marginBottom: '8px', fontStyle: 'italic' }}>
            ⏳ Esperando {cooldownLeft}s antes de poder hacer otra llamada (rate limit Anthropic Tier 2)
          </p>
        )}

        {/* Errores individuales */}
        {intlStatus === 'error' && (
          <div style={{ background: 'rgba(252,165,165,0.1)', border: '1px solid rgba(252,165,165,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '8px', color: '#dc2626', fontSize: '11px' }}>
            ⚠️ Internacional: {intlError}
          </div>
        )}
        {spainOpinionStatus === 'error' && (
          <div style={{ background: 'rgba(252,165,165,0.1)', border: '1px solid rgba(252,165,165,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '8px', color: '#dc2626', fontSize: '11px' }}>
            ⚠️ Opinión España: {spainOpinionError}
          </div>
        )}
        {spainNewsStatus === 'error' && (
          <div style={{ background: 'rgba(252,165,165,0.1)', border: '1px solid rgba(252,165,165,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '8px', color: '#dc2626', fontSize: '11px' }}>
            ⚠️ Noticias España: {spainNewsError}
          </div>
        )}

        {emailStatus === 'sent' && (
          <div style={{ background: 'rgba(134,239,172,0.12)', border: '1px solid rgba(134,239,172,0.3)', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', color: '#15803D', fontSize: '12px', textAlign: 'center' }}>
            ✅ Email preparado en tu cliente con destino {RECIPIENT}. Revísalo y pulsa Enviar.
          </div>
        )}

        {hasAnyData && (
          <div style={{ textAlign: 'center', margin: '0 0 24px', padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.08)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ fontSize: '11px', color: BRAND.orange, letterSpacing: '0.15em', fontWeight: '700' }}>
              {totalPieces} / 44 PIEZAS
            </span>
            <span style={{ fontSize: '10px', color: 'rgba(30,58,138,0.55)', marginLeft: '12px', fontStyle: 'italic' }}>
              {merged.date}
            </span>
          </div>
        )}

        {/* Render de las secciones disponibles - orden: internacional, opinión España, noticias España */}
        {hasAnyData && (
          <div style={{ animation: 'fadeSlide 0.5s ease both' }}>
            {[...spainNewsSections, ...spainOpinionSections, ...intlSections].map((s, i) => (
              <Section key={i} title={s.title} icon={s.icon} items={s.items} color={s.color} gradient={s.gradient} count={s.count} descriptor={s.descriptor} type={s.type} note={s.note} meta={s.meta} groupByContinent={s.groupByContinent} />
            ))}
          </div>
        )}

        {!hasAnyData && intlStatus === 'idle' && spainOpinionStatus === 'idle' && spainNewsStatus === 'idle' && (
          <div style={{ textAlign: 'center', padding: '32px 20px 12px', color: 'rgba(30,58,138,0.75)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', animation: 'float 4s ease-in-out infinite' }}>
              <svg width="130" height="130" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
                <g transform="translate(150,150)">
                  {/* ZORRO ORIGAMI MINIMAL — 10 facetas plegadas */}

                  {/* Mitad izquierda - tonos cálidos */}
                  <polygon points="0,-90 -75,-30 -50,0" fill="#FB923C"/>
                  <polygon points="-75,-30 -50,0 -65,40" fill="#DC2626"/>
                  <polygon points="-50,0 -65,40 -25,55" fill="#EC4899"/>
                  <polygon points="-25,55 0,80 -65,40" fill="#7E22CE"/>

                  {/* Mitad derecha - tonos fríos */}
                  <polygon points="0,-90 75,-30 50,0" fill="#FACC15"/>
                  <polygon points="75,-30 50,0 65,40" fill="#06B6D4"/>
                  <polygon points="50,0 65,40 25,55" fill="#3B82F6"/>
                  <polygon points="25,55 0,80 65,40" fill="#0F766E"/>

                  {/* Centro: plano blanco sutil */}
                  <polygon points="0,-90 -50,0 0,80 50,0" fill="#FAFAFA" opacity="0.85"/>

                  {/* Contorno completo del origami */}
                  <polyline points="0,-90 -75,-30 -50,0 -65,40 -25,55 0,80 25,55 65,40 50,0 75,-30 0,-90"
                            fill="none" stroke="#1A365D" strokeWidth="2.5" strokeLinejoin="round"/>

                  {/* Líneas de pliegue interiores */}
                  <line x1="0" y1="-90" x2="-50" y2="0" stroke="#1A365D" strokeWidth="1" opacity="0.6"/>
                  <line x1="0" y1="-90" x2="50" y2="0" stroke="#1A365D" strokeWidth="1" opacity="0.6"/>
                  <line x1="-50" y1="0" x2="0" y2="80" stroke="#1A365D" strokeWidth="1" opacity="0.6"/>
                  <line x1="50" y1="0" x2="0" y2="80" stroke="#1A365D" strokeWidth="1" opacity="0.6"/>
                  <line x1="-75" y1="-30" x2="-65" y2="40" stroke="#1A365D" strokeWidth="1" opacity="0.6"/>
                  <line x1="75" y1="-30" x2="65" y2="40" stroke="#1A365D" strokeWidth="1" opacity="0.6"/>

                  {/* Orejas como pliegues triangulares pequeños */}
                  <polygon points="-40,-60 -65,-105 -20,-75" fill="#7E22CE" stroke="#1A365D" strokeWidth="1.5"/>
                  <polygon points="40,-60 65,-105 20,-75" fill="#0F766E" stroke="#1A365D" strokeWidth="1.5"/>

                  {/* Ojos diminutos: solo 2 puntos */}
                  <circle cx="-15" cy="-15" r="3.5" fill="#1A365D"/>
                  <circle cx="15" cy="-15" r="3.5" fill="#1A365D"/>

                  {/* Nariz: triangulito */}
                  <polygon points="-5,15 5,15 0,25" fill="#1A365D"/>
                </g>
              </svg>
            </div>
            <p style={{ fontSize: '13px', margin: 0, fontFamily: "'Verdana', 'Geneva', sans-serif", fontStyle: 'italic' }}>
              Pulsa los botones para generar cada sección
            </p>
            <p style={{ fontSize: '14px', margin: '12px 0 0', color: '#65A30D', fontWeight: '700', letterSpacing: '0.02em', fontFamily: "'Verdana', 'Geneva', sans-serif" }}>
              Internacional: 8 opinión + 20 mundo · Opinión España: 16 · Noticias España: 25
            </p>
          </div>
        )}

        {/* Bloque "próximos briefings recomendados" — 2 horarios separados con colores de sección */}
        {(() => {
          const next = calculateNextBriefing();
          return (
            <div style={{
              marginTop: '32px',
              padding: '20px 22px',
              background: '#FAFBFC',
              border: '1px solid rgba(26,54,93,0.08)',
              borderRadius: '14px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.05)',
              fontFamily: "'Verdana', 'Geneva', sans-serif",
            }}>
              <div style={{
                textAlign: 'center',
                fontSize: '10px',
                fontWeight: '800',
                letterSpacing: '0.18em',
                color: '#1A365D',
                opacity: 0.75,
                marginBottom: '14px',
              }}>
                🔔 PRÓXIMOS BRIEFINGS RECOMENDADOS
              </div>

              {/* Card ESPAÑA · gradiente lima-dorado + naranja */}
              <div style={{
                display: 'flex',
                gap: '14px',
                alignItems: 'center',
                padding: '14px 16px',
                borderRadius: '10px',
                marginBottom: '10px',
                background: 'linear-gradient(135deg, rgba(101,163,13,0.10), rgba(250,204,21,0.15))',
                borderLeft: `4px solid ${BRAND.newsColor}`,
              }}>
                <div style={{ fontSize: '32px', flexShrink: 0 }}>🇪🇸</div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: '10px',
                    fontWeight: '800',
                    letterSpacing: '0.16em',
                    color: BRAND.newsColor,
                    marginBottom: '3px',
                  }}>
                    ESPAÑA
                  </div>
                  <div style={{
                    fontFamily: 'Georgia, serif',
                    fontStyle: 'italic',
                    fontSize: '17px',
                    fontWeight: '700',
                    color: '#1A365D',
                    marginBottom: '3px',
                    lineHeight: 1.2,
                  }}>
                    {next.spain.dayName} {next.spain.dayNumber} {next.spain.monthName} · {next.spain.hour}:{next.spain.minute}
                  </div>
                  <div style={{
                    fontSize: '10.5px',
                    fontStyle: 'italic',
                    color: 'rgba(26,54,93,0.65)',
                    lineHeight: 1.3,
                  }}>
                    "{next.spain.label}"
                  </div>
                </div>
              </div>

              {/* Card INTERNACIONAL · gradiente teal */}
              <div style={{
                display: 'flex',
                gap: '14px',
                alignItems: 'center',
                padding: '14px 16px',
                borderRadius: '10px',
                marginBottom: '14px',
                background: 'linear-gradient(135deg, rgba(15,118,110,0.10), rgba(94,234,212,0.15))',
                borderLeft: `4px solid ${BRAND.intlColor}`,
              }}>
                <div style={{ fontSize: '32px', flexShrink: 0 }}>🌍</div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: '10px',
                    fontWeight: '800',
                    letterSpacing: '0.16em',
                    color: BRAND.intlColor,
                    marginBottom: '3px',
                  }}>
                    INTERNACIONAL
                  </div>
                  <div style={{
                    fontFamily: 'Georgia, serif',
                    fontStyle: 'italic',
                    fontSize: '17px',
                    fontWeight: '700',
                    color: '#1A365D',
                    marginBottom: '3px',
                    lineHeight: 1.2,
                  }}>
                    {next.international.dayName} {next.international.dayNumber} {next.international.monthName} · {next.international.hour}:{next.international.minute}
                  </div>
                  <div style={{
                    fontSize: '10.5px',
                    fontStyle: 'italic',
                    color: 'rgba(26,54,93,0.65)',
                    lineHeight: 1.3,
                  }}>
                    "{next.international.label}"
                  </div>
                </div>
              </div>

              {/* Horario semanal · 2 columnas */}
              <div style={{
                borderTop: '1px dashed rgba(26,54,93,0.12)',
                paddingTop: '14px',
                marginTop: '4px',
              }}>
                <div style={{
                  textAlign: 'center',
                  fontSize: '10px',
                  fontWeight: '800',
                  letterSpacing: '0.12em',
                  color: '#1A365D',
                  opacity: 0.7,
                  marginBottom: '10px',
                }}>
                  📅 HORARIO SEMANAL
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <div style={{
                      fontSize: '9px',
                      fontWeight: '800',
                      letterSpacing: '0.14em',
                      padding: '4px 0',
                      marginBottom: '4px',
                      textAlign: 'center',
                      borderRadius: '4px',
                      background: 'linear-gradient(90deg, rgba(101,163,13,0.12), rgba(250,204,21,0.15))',
                      color: BRAND.newsColor,
                    }}>
                      🇪🇸 ESPAÑA
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#1A365D', padding: '3px 6px', borderBottom: '1px dashed rgba(26,54,93,0.06)' }}>
                      <span>Lun-Vie</span><span>19:00</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#1A365D', padding: '3px 6px', borderBottom: '1px dashed rgba(26,54,93,0.06)' }}>
                      <span>Sábado</span><span>12:00</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#1A365D', padding: '3px 6px' }}>
                      <span>Domingo</span><span>19:00</span>
                    </div>
                  </div>
                  <div>
                    <div style={{
                      fontSize: '9px',
                      fontWeight: '800',
                      letterSpacing: '0.14em',
                      padding: '4px 0',
                      marginBottom: '4px',
                      textAlign: 'center',
                      borderRadius: '4px',
                      background: 'linear-gradient(90deg, rgba(15,118,110,0.12), rgba(94,234,212,0.15))',
                      color: BRAND.intlColor,
                    }}>
                      🌍 INTERNACIONAL
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#1A365D', padding: '3px 6px', borderBottom: '1px dashed rgba(26,54,93,0.06)' }}>
                      <span>Lun-Vie</span><span>21:30</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#1A365D', padding: '3px 6px', borderBottom: '1px dashed rgba(26,54,93,0.06)' }}>
                      <span>Sábado</span><span>18:00</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#1A365D', padding: '3px 6px' }}>
                      <span>Domingo</span><span>18:30</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        <div style={{ textAlign: 'center', marginTop: '32px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <p style={{ fontSize: '10px', color: 'rgba(30,58,138,0.5)', margin: 0, letterSpacing: '0.15em', fontStyle: 'italic' }}>
            MAL NEWS · {RECIPIENT}
          </p>
          <p style={{ fontSize: '9px', color: 'rgba(30,58,138,0.45)', margin: '4px 0 0', letterSpacing: '0.1em' }}>
            v3 · PWA · 44 piezas · split intl / opinión España / noticias España
          </p>
        </div>
      </div>
    </div>
  );
}
