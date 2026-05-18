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

function NewsCard({ item, index, sectionColor, type }) {
  const isOpinion = type === 'opinion';
  const dayOfWeek = getDayOfWeek(item.publishedDate);

  // Variante OPINION simplificada: titulo + 2 lineas resumen + autor.medio.dia
  if (isOpinion) {
    const meta = [item.author, item.source, dayOfWeek].filter(Boolean).join(' \u00B7 ');

    return (
      <div style={{
        background: BRAND.card,
        borderLeft: `4px solid ${sectionColor}`,
        borderRadius: '0 8px 8px 0',
        padding: '12px 16px',
        marginBottom: '6px',
        boxShadow: BRAND.shadow,
        animation: `fadeSlide 0.35s ease ${Math.min(index * 0.03, 0.5)}s both`,
      }}>
        {/* Titulo (clickable si hay URL) */}
        {item.url ? (
          <a href={item.url} target="_blank" rel="noopener noreferrer"
            style={{ textDecoration: 'none', color: 'inherit' }}>
            <h3 style={{
              margin: '0 0 5px',
              fontSize: '14px',
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
            fontSize: '14px',
            fontFamily: "'Verdana', 'Geneva', sans-serif",
            fontWeight: '700', color: BRAND.navyDeep, lineHeight: 1.3,
          }}>
            {item.title}
          </h3>
        )}

        {/* Resumen recortado a 2 lineas */}
        {item.summary && (
          <p style={{
            margin: '0 0 6px', fontSize: '11.5px',
            color: BRAND.inkSoft, lineHeight: 1.45,
            fontFamily: "'Verdana', 'Geneva', sans-serif",
            fontStyle: 'italic',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {item.summary}
          </p>
        )}

        {/* autor . medio . dia + link leer */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px',
          fontSize: '10.5px', color: BRAND.navyDeep, fontWeight: '700',
          letterSpacing: '0.02em',
          fontFamily: "'Verdana', 'Geneva', sans-serif",
        }}>
          <span style={{ opacity: 0.85 }}>{meta}</span>
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
                marginLeft: '8px',
              }}
            >
              leer →
            </a>
          )}
        </div>
      </div>
    );
  }

  // Variante NEWS (original con linea de byline, lean badge, etc.)
  let byline = '';
  const parts = [item.source].filter(Boolean);
  if (item.region) parts.push(item.region);
  if (dayOfWeek) parts.push(dayOfWeek);
  byline = parts.join(' \u00B7 ');

  return (
    <div style={{
      background: BRAND.card,
      borderLeft: `4px solid ${sectionColor}`,
      borderRadius: '0 8px 8px 0',
      padding: '12px 16px',
      marginBottom: '6px',
      boxShadow: BRAND.shadow,
      animation: `fadeSlide 0.35s ease ${Math.min(index * 0.03, 0.5)}s both`,
    }}>
      {/* Linea de byline */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap',
        fontSize: '11px', color: BRAND.navyDeep, fontWeight: '700',
        letterSpacing: '0.02em', marginBottom: '6px',
        fontFamily: "'Verdana', 'Geneva', sans-serif",
      }}>
        <span style={{ flex: 1, minWidth: 0 }}>{byline}</span>
        <LeanBadge lean={item.lean} />
      </div>

      {/* Titulo */}
      <h3 style={{
        margin: '0 0 4px',
        fontSize: '13px',
        fontFamily: "'Verdana', 'Geneva', sans-serif",
        fontWeight: '700', color: BRAND.navyDeep, lineHeight: 1.3,
      }}>
        {item.title}
      </h3>

      {/* Resumen */}
      <p style={{
        margin: '0 0 6px', fontSize: '11.5px',
        color: BRAND.inkSoft, lineHeight: 1.5,
        fontFamily: "'Verdana', 'Geneva', sans-serif",
      }}>
        {item.summary}
      </p>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '9.5px', color: BRAND.inkSoft, opacity: 0.75 }}>
        {item.publishedDate && (
          <span style={{ fontFamily: "'Verdana', 'Geneva', sans-serif", fontStyle: 'italic' }}>
            {item.publishedDate}
          </span>
        )}
        {item.url && (
          <a href={item.url} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: '10px', color: sectionColor, textDecoration: 'none', borderBottom: `1px dotted ${sectionColor}80`, fontWeight: '700', marginLeft: 'auto' }}>
            leer
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
                    <div key={i} style={{
                      padding: '5px 8px',
                      marginBottom: '3px',
                      background: included === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.14)',
                      borderRadius: '5px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      gap: '8px',
                      flexWrap: 'wrap',
                      fontSize: '10.5px',
                    }}>
                      <strong style={{ color: 'white', fontSize: '11px', minWidth: '105px', fontWeight: '700' }}>
                        {statusIcon} {d.source}
                      </strong>
                      <span style={{ color: 'rgba(255,255,255,0.92)', fontSize: '10px', flex: 1, textAlign: 'right' }}>
                        {d.rawCount === 0
                          ? <em style={{ color: 'rgba(255,255,255,0.65)' }}>⚠️ feed vacío</em>
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
                    </div>
                  );
                })}
              <div style={{
                marginTop: '8px', padding: '6px 8px',
                fontSize: '9.5px', fontStyle: 'italic',
                color: 'rgba(255,255,255,0.75)',
                borderTop: '1px dashed rgba(255,255,255,0.25)',
                paddingTop: '7px',
              }}>
                ✅ ≥2 piezas · ⚠️ 1 pieza · ⚪ 0 piezas
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

  // Abre el briefing en una pestaña nueva como HTML estilizado
  // Abre DOS ventanas HTML separadas (España + Internacional) — solo abre las que tienen contenido
  function openHtmlView() {
    if (!intlData && !spainNewsData && !spainOpinionData) return;
    const merged = mergeBriefings();

    const openTab = (htmlContent) => {
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.open();
        newWindow.document.write(htmlContent);
        newWindow.document.close();
      }
    };

    const hasSpain = (merged.spainNews?.length || 0) + (merged.spainOpinion?.length || 0) > 0;
    const hasIntl = (merged.worldNews?.length || 0) + (merged.worldOpinion?.length || 0) > 0;

    if (hasSpain) openTab(buildHtml(merged, 'spain'));
    if (hasIntl) {
      // pequeño delay para evitar que el navegador bloquee el segundo popup
      setTimeout(() => openTab(buildHtml(merged, 'international')), hasSpain ? 250 : 0);
    }
  }

  // Descarga el briefing como DOS archivos .html en el dispositivo del usuario
  // 1) mal-news-espana-YYYY-MM-DD.html  → Noticias España + Opinión España
  // 2) mal-news-internacional-YYYY-MM-DD.html → Mundo + Opinión Internacional
  // Solo descarga los archivos cuyas secciones tengan al menos 1 pieza
  function downloadHtml() {
    if (!intlData && !spainNewsData && !spainOpinionData) return;
    const merged = mergeBriefings();
    const safeName = (todayShort || 'briefing').replace(/\//g, '-');

    const triggerDownload = (htmlContent, fileName) => {
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    // 1) Archivo España (si hay material)
    const hasSpain = (merged.spainNews?.length || 0) + (merged.spainOpinion?.length || 0) > 0;
    if (hasSpain) {
      const htmlSpain = buildHtml(merged, 'spain');
      triggerDownload(htmlSpain, `mal-news-espana-${safeName}.html`);
    }

    // 2) Archivo Internacional (si hay material) - retardo para evitar bloqueo del navegador
    const hasIntl = (merged.worldNews?.length || 0) + (merged.worldOpinion?.length || 0) > 0;
    if (hasIntl) {
      setTimeout(() => {
        const htmlIntl = buildHtml(merged, 'international');
        triggerDownload(htmlIntl, `mal-news-internacional-${safeName}.html`);
      }, hasSpain ? 350 : 0);
    }
  }

  function mergeBriefings() {
    return {
      date: (intlData?.date || spainOpinionData?.date || spainNewsData?.date || todayShort),
      worldNews: intlData?.worldNews || [],
      worldOpinion: intlData?.worldOpinion || [],
      spainNews: spainNewsData?.spainNews || [],
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
  // FORMATO DINÁMICO: cuándo se recomienda el próximo briefing
  // Camino 2 (sesión única) — un solo momento al día para los 3 botones
  // ===================================================
  const BRIEFING_SCHEDULE = {
    // 0 = domingo, 1 = lunes, ..., 6 = sábado
    1: { hour: 19, minute: 0,  label: 'Tarde laboral · máxima frescura' },
    2: { hour: 19, minute: 0,  label: 'Tarde laboral · máxima frescura' },
    3: { hour: 19, minute: 0,  label: 'Tarde laboral · máxima frescura' },
    4: { hour: 19, minute: 0,  label: 'Estefanía Molina y Agustín Valladolid hoy' },
    5: { hour: 19, minute: 0,  label: 'Cierra la semana laboral' },
    6: { hour: 12, minute: 0,  label: 'Mañana relajada de sábado' },
    0: { hour: 19, minute: 0,  label: 'Domingo completo · FJL, Pedro J., Cebrián' },
  };

  function calculateNextBriefing() {
    const now = new Date();
    const currentDay = now.getDay();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    const todaySchedule = BRIEFING_SCHEDULE[currentDay];
    const todayMinutes = todaySchedule.hour * 60 + todaySchedule.minute;
    const nowMinutes = currentHour * 60 + currentMinute;

    let targetDay = currentDay;
    let targetDate = new Date(now);

    // Si todavía no ha pasado la hora de hoy, recomendar hoy
    // Si ya pasó, recomendar mañana
    if (nowMinutes >= todayMinutes) {
      targetDay = (currentDay + 1) % 7;
      targetDate.setDate(targetDate.getDate() + 1);
    }

    const targetSchedule = BRIEFING_SCHEDULE[targetDay];
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
      const meta = isOpinion
        ? [item.author, item.source, getDay(item.publishedDate)].filter(Boolean).join(' &middot; ')
        : [item.source, item.region, getDay(item.publishedDate)].filter(Boolean).join(' &middot; ');
      const summaryStyle = isOpinion ? 'font-style:italic;' : '';
      const link = item.url
        ? `<div style="margin-top:6px;font-size:11px;"><a href="${escape(item.url)}" style="color:${color};text-decoration:none;border-bottom:1px dotted ${color};font-weight:700;">leer &rarr;</a></div>`
        : '';
      return `
        <div style="background:#FFFFFF;border-left:4px solid ${color};border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:8px;box-shadow:0 4px 12px rgba(0,0,0,0.08);font-family:Verdana,Geneva,sans-serif;">
          <div style="font-size:13px;font-weight:700;color:#1A365D;line-height:1.3;margin-bottom:4px;">${escape(item.title)}</div>
          <div style="font-size:11.5px;color:rgba(26,54,93,0.72);line-height:1.45;${summaryStyle}margin-bottom:5px;">${escape(item.summary)}</div>
          <div style="font-size:10.5px;color:rgba(26,54,93,0.85);font-weight:700;">${meta}</div>
          ${link}
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

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${escape(headerTitle)} - ${escape(b.date || todayShort)}</title>
<style>
  body { margin:0; padding:24px; background:#F0F4F8; font-family:Verdana,Geneva,sans-serif; color:#1A365D; }
  .container { max-width:820px; margin:0 auto; }
  .header { text-align:center; margin-bottom:28px; padding:24px; background:#FFFFFF; border-radius:14px; box-shadow:0 4px 12px rgba(0,0,0,0.08); }
  .logo { font-size:28px; font-weight:800; color:#1A365D; letter-spacing:2px; margin:0; }
  .subtitle { font-size:13px; font-style:italic; color:rgba(26,54,93,0.7); margin:6px 0 0; }
  .date { font-size:12px; letter-spacing:0.3em; color:#1A365D; opacity:0.7; text-transform:uppercase; font-weight:800; margin:10px 0 0; }
  .total { font-size:11px; color:#0EA5E9; letter-spacing:0.15em; font-weight:700; margin-top:12px; }
  .footer { text-align:center; margin-top:32px; padding:18px; font-size:10px; color:rgba(26,54,93,0.55); letter-spacing:0.15em; font-style:italic; border-top:1px solid rgba(26,54,93,0.12); }
  .next-briefing { background:linear-gradient(135deg, #FFF7ED, #FFEDD5); border:2px solid rgba(250,105,0,0.3); border-radius:14px; padding:20px 24px; margin:32px 0 0; text-align:center; box-shadow:0 4px 16px rgba(250,105,0,0.12); }
  .next-briefing-label { font-size:10px; font-weight:800; letter-spacing:0.18em; color:#C2410C; margin-bottom:8px; }
  .next-briefing-date { font-family:Georgia,serif; font-style:italic; font-size:20px; font-weight:700; color:#1A365D; margin:4px 0 6px; }
  .next-briefing-reason { font-size:11px; font-style:italic; color:rgba(26,54,93,0.7); margin-bottom:14px; }
  .next-briefing-schedule { border-top:1px dashed rgba(250,105,0,0.25); padding-top:12px; margin-top:8px; }
  .schedule-title { font-size:10px; font-weight:800; letter-spacing:0.12em; color:#1A365D; margin-bottom:8px; opacity:0.7; }
  .schedule-row { display:flex; justify-content:space-between; font-size:11px; color:#1A365D; padding:3px 16px; }
  .schedule-row em { font-style:italic; color:rgba(26,54,93,0.5); font-size:10px; }
  .copy-hint { background:#FFFFFF; border:1px solid rgba(26,54,93,0.15); border-radius:10px; padding:14px 18px; margin-bottom:20px; font-size:12px; color:#1A365D; text-align:center; box-shadow:0 4px 12px rgba(0,0,0,0.05); }
  .next-brief { margin-top:36px; padding:22px 26px; background:linear-gradient(135deg, #FFFFFF, #FAFBFC); border:1px solid rgba(250,105,0,0.25); border-left:4px solid #FA6900; border-radius:14px; box-shadow:0 8px 24px rgba(250,105,0,0.10); }
  .next-brief-label { font-size:9px; font-weight:800; letter-spacing:0.22em; color:#FA6900; text-transform:uppercase; margin-bottom:8px; }
  .next-brief-day { font-family:Georgia,serif; font-size:20px; font-style:italic; color:#1A365D; font-weight:700; margin-bottom:4px; }
  .next-brief-time { font-size:32px; font-weight:900; color:#FA6900; letter-spacing:0.02em; margin-bottom:8px; line-height:1; }
  .next-brief-reason { font-size:11px; color:rgba(26,54,93,0.7); font-style:italic; line-height:1.5; }
  .next-brief-table { margin-top:16px; padding-top:14px; border-top:1px dashed rgba(250,105,0,0.25); font-size:10px; color:rgba(26,54,93,0.65); line-height:1.7; }
  .next-brief-table strong { color:#1A365D; font-weight:700; letter-spacing:0.05em; }
  @media print { .copy-hint { display:none; } body { background:white; } }
</style>
</head>
<body>
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
      <div class="next-briefing-label">🔔 PRÓXIMO BRIEFING RECOMENDADO</div>
      <div class="next-briefing-date">${escape(nextBriefing.dayName)} ${nextBriefing.dayNumber} ${escape(nextBriefing.monthName)} · ${nextBriefing.hour}:${nextBriefing.minute}</div>
      <div class="next-briefing-reason">"${escape(nextBriefing.label)}"</div>
      <div class="next-briefing-schedule">
        <div class="schedule-title">📅 Horario semanal</div>
        <div class="schedule-row"><span>Lun-Vie</span><span>19:00 <em>tarde laboral</em></span></div>
        <div class="schedule-row"><span>Sábado</span><span>12:00 <em>mañana relajada</em></span></div>
        <div class="schedule-row"><span>Domingo</span><span>19:00 <em>fin de semana completo</em></span></div>
      </div>
    </div>
    <div class="footer">
      MAL NEWS &middot; ${escape(RECIPIENT)} &middot; v3 PWA
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
      descriptor: 'Columnas firmadas · medios internacionales · 48h previas · evento concreto' },
  ] : [];

  const spainOpinionSections = spainOpinionData ? [
    { title: 'Opinión España', icon: '✍️', items: spainOpinionData.spainOpinion, color: SECTION_COLORS.spainOpinion, gradient: SECTION_GRADIENTS.spainOpinion, count: 16, type: 'opinion',
      descriptor: 'Columnas firmadas · 3+ medios · publicadas en últimas 72h',
      note: spainOpinionData._note,
      meta: spainOpinionData._meta },
  ] : [];

  const spainNewsSections = spainNewsData ? [
    { title: 'España', icon: '🇪🇸', items: spainNewsData.spainNews, color: SECTION_COLORS.spainNews, gradient: SECTION_GRADIENTS.spainNews, count: 25, type: 'news',
      descriptor: 'Eventos concretos · prensa española · publicadas últimas 48h',
      note: spainNewsData._note,
      meta: spainNewsData._meta },
  ] : [];

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

        {/* Selector de fecha del briefing */}
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px',
          marginBottom: '14px', flexWrap: 'wrap',
          background: 'rgba(255,255,255,0.55)',
          border: `1px solid ${BRAND.navy}25`,
          borderRadius: '8px',
          padding: '10px 14px',
          boxShadow: '0 2px 8px rgba(30,58,138,0.06)',
        }}>
          <span style={{ fontSize: '11px', color: BRAND.navyDeep, fontWeight: '700', letterSpacing: '0.05em' }}>
            📅 FECHA DEL BRIEFING:
          </span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            max={todayIso}
            disabled={isInCooldown || anyLoading}
            style={{
              fontFamily: "'Verdana', 'Geneva', sans-serif",
              fontSize: '12px',
              padding: '4px 8px',
              border: `1px solid ${BRAND.navy}40`,
              borderRadius: '6px',
              color: BRAND.ink,
              background: 'white',
              cursor: 'pointer',
              fontWeight: '600',
            }}
          />
          {isPastDate && (
            <button
              onClick={() => setSelectedDate(todayIso)}
              disabled={isInCooldown || anyLoading}
              style={{
                fontFamily: "'Verdana', 'Geneva', sans-serif",
                fontSize: '10px', fontWeight: '700',
                padding: '4px 10px', borderRadius: '6px',
                border: `1px solid ${BRAND.orange}`,
                background: 'transparent', color: BRAND.orange,
                cursor: 'pointer', letterSpacing: '0.05em',
              }}
            >
              ↻ HOY
            </button>
          )}
        </div>

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
              onClick={openHtmlView}
              style={{
                border: `1px solid ${BRAND.orange}`, borderRadius: '8px',
                padding: '10px 16px', fontSize: '11px', fontWeight: '700',
                letterSpacing: '0.05em', cursor: 'pointer',
                transition: 'all 0.2s ease', fontFamily: "'Verdana', 'Geneva', sans-serif",
                background: 'rgba(255,255,255,0.85)', color: BRAND.orange,
              }}
            >
              🎨 Vista HTML
            </button>
            <button
              onClick={downloadHtml}
              style={{
                border: `1px solid ${BRAND.orange}`, borderRadius: '8px',
                padding: '10px 16px', fontSize: '11px', fontWeight: '700',
                letterSpacing: '0.05em', cursor: 'pointer',
                transition: 'all 0.2s ease', fontFamily: "'Verdana', 'Geneva', sans-serif",
                background: BRAND.orange, color: 'white',
              }}
            >
              ⬇️ Descargar HTML
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
            <p style={{ fontSize: '11px', margin: '8px 0 0', color: 'rgba(30,58,138,0.55)' }}>
              Internacional: 8 opinión + 20 mundo · Opinión España: 16 · Noticias España: 25
            </p>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '44px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
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
