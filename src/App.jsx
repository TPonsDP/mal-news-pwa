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
const COOLDOWN_MS = 150 * 1000; // 150 segundos entre llamadas para no saturar Tier 1 de Anthropic

const BRAND = {
  // ============ NUEVA PALETA: Oxford Blue + Smoke Gray + 3 gradientes ============
  oxford: '#1A365D',           // Marca principal (Azul Oxford) - solo logo
  blueAccent: '#0EA5E9',       // Acento brillante (final del gradiente internacional)
  bgGray: '#F0F4F8',           // Fondo (Gris Humo)
  bgGrayDeep: '#E2E8F0',       // Variante para gradientes sutiles del fondo
  cardWhite: '#FFFFFF',        // Tarjetas blancas
  shadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
  shadowLg: '0 8px 24px rgba(0, 0, 0, 0.12)',
  // Gradientes oficiales por bucket
  intlGrad: 'linear-gradient(90deg, #1D4ED8, #0EA5E9)',
  opinionGrad: 'linear-gradient(90deg, #4D7C0F, #84CC16)',
  newsGrad: 'linear-gradient(90deg, #C2410C, #FA6900)',
  // Colores sólidos para bordes/badges (start de cada gradiente)
  intlColor: '#1D4ED8',
  opinionColor: '#4D7C0F',
  newsColor: '#C2410C',

  // ============ ALIASES PARA RETROCOMPATIBILIDAD ============
  // (todo el código existente que usa BRAND.navy, BRAND.card, etc. seguirá funcionando)
  navy: '#1A365D',
  navyDeep: '#102844',
  card: '#FFFFFF',
  cardSubtle: 'rgba(255,255,255,0.95)',
  ink: '#1A365D',
  inkSoft: 'rgba(26, 54, 93, 0.65)',
  orange: '#FA6900',           // Naranja Ciudadanos vivo (usado en decoraciones y botón HOY)
  limeLight: '#F0F4F8',        // antes sage, ahora bgGray
  limeDark: '#E2E8F0',         // antes sage dark, ahora bgGray deep
  // Lean badges (mantenidos)
  leftBlue: '#3B82F6',
  rightRed: '#EF4444',
};

const SOURCE_COLORS = {
  BBC: '#FF8B8B', Reuters: '#FFB347', Guardian: '#7DD3FC', FT: '#FBBF77', AP: '#FCA5A5',
  NYT: '#FCA5A5', 'Le Monde': '#7DD3FC', Economist: '#F87171', WSJ: '#FED7AA', Bloomberg: '#FBBF77',
  EIA: '#FCD34D', IEA: '#FCD34D', 'S&P': '#FCD34D', Argus: '#FCD34D', tradingeconomics: '#FCD34D',
  Law360: '#CBD5E1', 'American Lawyer': '#CBD5E1', GCR: '#CBD5E1', MLex: '#CBD5E1',
  Justia: '#CBD5E1', Aranzadi: '#CBD5E1', 'El Derecho': '#CBD5E1', 'Expansión Jurídico': '#CBD5E1',
  Vozpópuli: '#FDE68A', 'The Objective': '#FDE68A', 'Libertad Digital': '#FCA5A5',
  VilaWeb: '#A5F3FC', 'El Diario': '#FCA5A5', 'El Debate': '#FED7AA',
  'Artículo 14': '#FED7AA', 'Agenda Pública': '#A5F3FC',
  ABC: '#FCA5A5', Mundo: '#FECACA', 'El País': '#93C5FD', 'El Español': '#FED7AA',
  'La Gaceta': '#FECACA', almendron: '#93C5FD', enriquedans: '#A5F3FC',
  default: BRAND.orange,
};

function getSourceColor(source) {
  if (!source) return SOURCE_COLORS.default;
  for (const key in SOURCE_COLORS) {
    if (source.toLowerCase().includes(key.toLowerCase())) return SOURCE_COLORS[key];
  }
  return SOURCE_COLORS.default;
}

function MalNewsLogo({ maxWidth = 420 }) {
  return (
    <svg viewBox="0 0 400 160" width="100%" style={{ maxWidth, height: 'auto', display: 'block', margin: '0 auto', filter: 'drop-shadow(0 6px 18px rgba(26,54,93,0.20))' }} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="malIconBg" cx="38%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#5685BD" />
          <stop offset="45%" stopColor="#1A365D" />
          <stop offset="100%" stopColor="#04101F" />
        </radialGradient>
      </defs>

      {/* Círculo logo a la izquierda */}
      <g transform="translate(80, 80)">
        <circle cx="0" cy="0" r="64" fill="url(#malIconBg)" />
        {/* M letterform, escalado para r=64 */}
        <g transform="translate(0, 0) scale(0.25)">
          <g transform="translate(-256, -256)">
            <rect x="154" y="80" width="58" height="198" rx="6" fill="#60A5FA" />
            <polygon points="212,80 256,263 301,80 275,80 256,195 237,80" fill="#A3E635" />
            <rect x="301" y="80" width="58" height="198" rx="6" fill="#FB923C" />
            <text x="256" y="400" textAnchor="middle" fontFamily="Verdana, Geneva, sans-serif" fontWeight="800" fontSize="58" fill="#A3E635" letterSpacing="14">NEWS</text>
          </g>
        </g>
      </g>

      {/* Wordmark a la derecha */}
      <text x="170" y="78" fontFamily="'Verdana', 'Geneva', sans-serif" fontSize="42" fontWeight="800" fill="#1A365D" letterSpacing="3">MAL</text>
      <text x="170" y="118" fontFamily="'Verdana', 'Geneva', sans-serif" fontSize="28" fontWeight="600" fill="rgba(26,54,93,0.85)" letterSpacing="8">NEWS</text>
      <text x="170" y="142" fontFamily="'Verdana', sans-serif" fontSize="10" fill="rgba(26,54,93,0.55)" letterSpacing="3" fontStyle="italic">Tu briefing diario</text>

      {/* Línea decorativa inferior */}
      <line x1="170" y1="148" x2="380" y2="148" stroke="rgba(26,54,93,0.3)" strokeWidth="1" />
      <line x1="170" y1="148" x2="220" y2="148" stroke="#FA6900" strokeWidth="2" opacity="0.6" />
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

function RegionBadge({ region }) {
  if (!region) return null;
  return (
    <span style={{
      padding: '2px 7px', borderRadius: '10px',
      fontSize: '9px', fontWeight: '600', letterSpacing: '0.04em',
      background: 'rgba(30,58,138,0.08)', color: 'rgba(30,58,138,0.7)',
      border: '1px solid rgba(30,58,138,0.15)',
    }}>{region}</span>
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

function Section({ title, icon, items, color, gradient, count, descriptor, type, note, meta }) {
  const realCount = items?.length || 0;
  const itemLabel = type === 'opinion' ? (realCount === 1 ? 'COLUMNA' : 'COLUMNAS') : (realCount === 1 ? 'PIEZA' : 'PIEZAS');

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

  // Cooldown global compartido entre los TRES botones - evita el rate_limit_error 429 de Anthropic Tier 1
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
    const subject = `🕊️ MAL NEWS - Briefing ${todayShort}`;
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
  // Desde ahí el usuario puede Ctrl+A, Ctrl+C y pegar en Gmail (Gmail conserva formato)
  function openHtmlView() {
    if (!intlData && !spainNewsData && !spainOpinionData) return;
    const merged = mergeBriefings();
    const html = buildHtml(merged);
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.open();
      newWindow.document.write(html);
      newWindow.document.close();
    }
  }

  // Descarga el briefing como archivo .html en el dispositivo del usuario
  // El archivo es autocontenido (CSS inline) y se puede abrir, archivar, adjuntar, imprimir
  function downloadHtml() {
    if (!intlData && !spainNewsData && !spainOpinionData) return;
    const merged = mergeBriefings();
    const html = buildHtml(merged);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Nombre tipo: mal-news-2026-05-09.html
    const safeName = (todayShort || 'briefing').replace(/\//g, '-');
    a.download = `mal-news-${safeName}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function mergeBriefings() {
    return {
      date: (intlData?.date || spainOpinionData?.date || spainNewsData?.date || todayShort),
      worldNews: intlData?.worldNews || [],
      worldOpinion: intlData?.worldOpinion || [],
      legal: intlData?.legal || [],
      spainNews: spainNewsData?.spainNews || [],
      spainOpinion: spainOpinionData?.spainOpinion || [],
    };
  }

  // Construye HTML formateado y autocontenido (CSS inline para compatibilidad email)
  function buildHtml(b) {
    const escape = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    // Mapeo de colores y gradientes por sección (debe coincidir con SECTION_COLORS/SECTION_GRADIENTS de la PWA)
    const SECTION_STYLES = {
      worldOpinion: { color: '#1D4ED8', gradient: 'linear-gradient(90deg, #1D4ED8, #0EA5E9)' },
      worldNews:    { color: '#1D4ED8', gradient: 'linear-gradient(90deg, #1D4ED8, #0EA5E9)' },
      legal:        { color: '#1D4ED8', gradient: 'linear-gradient(90deg, #1D4ED8, #0EA5E9)' },
      spainOpinion: { color: '#4D7C0F', gradient: 'linear-gradient(90deg, #4D7C0F, #84CC16)' },
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

    const total = (b.worldOpinion?.length || 0) + (b.worldNews?.length || 0) + (b.legal?.length || 0)
                + (b.spainOpinion?.length || 0) + (b.spainNews?.length || 0);

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>MAL NEWS - ${escape(b.date || todayShort)}</title>
<style>
  body { margin:0; padding:24px; background:#F0F4F8; font-family:Verdana,Geneva,sans-serif; color:#1A365D; }
  .container { max-width:820px; margin:0 auto; }
  .header { text-align:center; margin-bottom:28px; padding:24px; background:#FFFFFF; border-radius:14px; box-shadow:0 4px 12px rgba(0,0,0,0.08); }
  .logo { font-size:34px; font-weight:800; color:#1A365D; letter-spacing:2px; margin:0; }
  .date { font-size:12px; letter-spacing:0.3em; color:#1A365D; opacity:0.7; text-transform:uppercase; font-weight:800; margin:8px 0 0; }
  .total { font-size:11px; color:#0EA5E9; letter-spacing:0.15em; font-weight:700; margin-top:12px; }
  .footer { text-align:center; margin-top:32px; padding:18px; font-size:10px; color:rgba(26,54,93,0.55); letter-spacing:0.15em; font-style:italic; border-top:1px solid rgba(26,54,93,0.12); }
  .copy-hint { background:#FFFFFF; border:1px solid rgba(26,54,93,0.15); border-radius:10px; padding:14px 18px; margin-bottom:20px; font-size:12px; color:#1A365D; text-align:center; box-shadow:0 4px 12px rgba(0,0,0,0.05); }
  @media print { .copy-hint { display:none; } body { background:white; } }
</style>
</head>
<body>
  <div class="container">
    <div class="copy-hint">
      💡 <strong>Copia para email:</strong> Ctrl+A &rarr; Ctrl+C &rarr; pega en Gmail (conserva formato). O imprime con Ctrl+P para PDF.
    </div>
    <div class="header">
      <h1 class="logo">MAL NEWS</h1>
      <p class="date">${escape(b.date || todayShort)}</p>
      <p class="total">${total} PIEZAS</p>
    </div>
    ${section('Opinión Internacional', '✍️', b.worldOpinion, 'worldOpinion', 'Columnas firmadas · medios internacionales · 48h previas', true)}
    ${section('Mundo', '🌍', b.worldNews, 'worldNews', 'Cobertura global plural · publicadas en últimas 48h · incluye sentencias relevantes', false)}
    ${section('Opinión España', '✍️', b.spainOpinion, 'spainOpinion', 'Columnas firmadas · sin editoriales · 4+ medios · publicadas hoy o ayer', true)}
    ${section('España', '🇪🇸', b.spainNews, 'spainNews', 'Eventos concretos · prensa española · publicadas últimas 48h', false)}
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
      section('🌍 Mundo', b.worldNews),
      section('✍️ Opinión Internacional', b.worldOpinion),
      section('🇪🇸 España', b.spainNews),
      section('✒️ Opinión España', b.spainOpinion),
      dsep,
      'MAL NEWS · Briefing automático',
      '',
    ].join('\n');
  }

  const merged = mergeBriefings();
  const totalPieces =
    (merged.worldNews?.length || 0) + (merged.worldOpinion?.length || 0) +
    (merged.legal?.length || 0) +
    (merged.spainNews?.length || 0) + (merged.spainOpinion?.length || 0);

  // ============ COLORES POR SECCIÓN (Nueva paleta Oxford + gradientes) ============
  // Mapeo por bucket: las 3 secciones internacionales comparten gradiente azul,
  // Opinión España usa morado, Noticias España usa rojo-naranja.
  const SECTION_COLORS = {
    worldOpinion: BRAND.intlColor,    // Oxford Blue
    worldNews:    BRAND.intlColor,
    legal:        BRAND.intlColor,
    spainOpinion: BRAND.opinionColor, // Morado
    spainNews:    BRAND.newsColor,    // Rojo
  };
  const SECTION_GRADIENTS = {
    worldOpinion: BRAND.intlGrad,     // azul oxford → azul brillante
    worldNews:    BRAND.intlGrad,
    legal:        BRAND.intlGrad,
    spainOpinion: BRAND.opinionGrad,  // morado oscuro → lila
    spainNews:    BRAND.newsGrad,     // rojo → naranja
  };

  const intlSections = intlData ? [
    { title: 'Opinión Internacional', icon: '✍️', items: intlData.worldOpinion, color: SECTION_COLORS.worldOpinion, gradient: SECTION_GRADIENTS.worldOpinion, count: 8, type: 'opinion',
      descriptor: 'Columnas firmadas · medios internacionales · 48h previas · evento concreto' },
    { title: 'Mundo', icon: '🌍', items: intlData.worldNews, color: SECTION_COLORS.worldNews, gradient: SECTION_GRADIENTS.worldNews, count: 20, type: 'news',
      descriptor: 'Cobertura global plural · ≥6 regiones · equilibrio IZQ/DER · incluye sentencias relevantes' },
  ] : [];

  const spainOpinionSections = spainOpinionData ? [
    { title: 'Opinión España', icon: '✍️', items: spainOpinionData.spainOpinion, color: SECTION_COLORS.spainOpinion, gradient: SECTION_GRADIENTS.spainOpinion, count: 16, type: 'opinion',
      descriptor: 'Columnas firmadas · 3+ medios · publicadas en últimas 72h',
      note: spainOpinionData._note,
      meta: spainOpinionData._meta },
  ] : [];

  const spainNewsSections = spainNewsData ? [
    { title: 'España', icon: '🇪🇸', items: spainNewsData.spainNews, color: SECTION_COLORS.spainNews, gradient: SECTION_GRADIENTS.spainNews, count: 15, type: 'news',
      descriptor: 'Eventos concretos · prensa española · publicadas últimas 48h' },
  ] : [];

  const intlBtnLabel = (() => {
    if (intlStatus === 'loading') return 'Buscando internacional...';
    if (isInCooldown) return `⏳ Espera ${cooldownLeft}s`;
    if (intlStatus === 'done') return '🔄 Recargar internacional';
    return '🌍 Generar internacional (24)';
  })();

  const spainOpinionBtnLabel = (() => {
    if (spainOpinionStatus === 'loading') return 'Buscando opinión España...';
    if (isInCooldown) return `⏳ Espera ${cooldownLeft}s`;
    if (spainOpinionStatus === 'done') return '🔄 Recargar opinión España';
    return '✍️ Opinión España (10)';
  })();

  const spainNewsBtnLabel = (() => {
    if (spainNewsStatus === 'loading') return 'Buscando noticias España...';
    if (isInCooldown) return `⏳ Espera ${cooldownLeft}s`;
    if (spainNewsStatus === 'done') return '🔄 Recargar noticias España';
    return '🇪🇸 Noticias España (15)';
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
        <div style={{ marginBottom: '18px', animation: 'fadeSlide 0.6s ease both' }}>
          <MalNewsLogo maxWidth={420} />
          <p style={{ margin: '16px 0 0', fontSize: '12px', letterSpacing: '0.3em', color: BRAND.orange, textTransform: 'uppercase', textAlign: 'center', fontWeight: '800', textShadow: '0 1px 2px rgba(30,58,138,0.15)' }}>
            {today}
          </p>
        </div>

        <p style={{ margin: '0 0 18px', fontSize: '10px', color: BRAND.orange, letterSpacing: '0.18em', textAlign: 'center', fontStyle: 'italic', opacity: 0.85 }}>
          MUNDO · OPINIÓN INTL · LEGAL · ESPAÑA · OPINIÓN ESPAÑA
        </p>

        <div style={{ height: '1px', background: `linear-gradient(90deg, transparent 0%, ${BRAND.orange}66 50%, transparent 100%)`, margin: '0 0 24px' }} />

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
            onClick={() => fetchSection('international')}
            disabled={intlStatus === 'loading' || isInCooldown}
            style={{
              border: 'none', borderRadius: '12px', padding: '14px 22px',
              fontSize: '11px', fontWeight: '800', letterSpacing: '0.08em',
              cursor: (intlStatus === 'loading' || isInCooldown) ? 'wait' : 'pointer',
              transition: 'all 0.25s ease', fontFamily: "'Verdana', 'Geneva', sans-serif",
              background: intlStatus === 'loading'
                ? `linear-gradient(90deg, #1D4ED8, #0EA5E9, #1D4ED8)`
                : BRAND.intlGrad,
              backgroundSize: intlStatus === 'loading' ? '200% 100%' : '100% 100%',
              animation: intlStatus === 'loading' ? 'shimmer 2s linear infinite' : 'none',
              color: 'white', opacity: (intlStatus === 'loading' || isInCooldown) ? 0.65 : 1,
              boxShadow: '0 6px 20px rgba(29,78,216,0.40)', textTransform: 'uppercase',
              textShadow: '0 1px 2px rgba(0,0,0,0.15)',
            }}
          >
            {intlBtnLabel}
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
                ? `linear-gradient(90deg, #4D7C0F, #84CC16, #4D7C0F)`
                : BRAND.opinionGrad,
              backgroundSize: spainOpinionStatus === 'loading' ? '200% 100%' : '100% 100%',
              animation: spainOpinionStatus === 'loading' ? 'shimmer 2s linear infinite' : 'none',
              color: 'white', opacity: (spainOpinionStatus === 'loading' || isInCooldown) ? 0.65 : 1,
              boxShadow: '0 6px 20px rgba(77,124,15,0.35)', textTransform: 'uppercase',
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
            🌍 Buscando 24 piezas internacionales...
          </p>
        )}
        {spainOpinionStatus === 'loading' && (
          <p style={{ textAlign: 'center', color: BRAND.orange, fontSize: '12px', animation: 'pulse 1.5s infinite', marginBottom: '8px', fontStyle: 'italic' }}>
            ✍️ Buscando 10 columnas de opinión España...
          </p>
        )}
        {spainNewsStatus === 'loading' && (
          <p style={{ textAlign: 'center', color: BRAND.orange, fontSize: '12px', animation: 'pulse 1.5s infinite', marginBottom: '8px', fontStyle: 'italic' }}>
            🇪🇸 Buscando 10 noticias España...
          </p>
        )}

        {/* Mensaje de cooldown activo cuando NO hay carga en marcha */}
        {isInCooldown && !anyLoading && (
          <p style={{ textAlign: 'center', color: 'rgba(30,58,138,0.65)', fontSize: '11px', marginBottom: '8px', fontStyle: 'italic' }}>
            ⏳ Esperando {cooldownLeft}s antes de poder hacer otra llamada (rate limit Anthropic Tier 1)
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
            {[...intlSections, ...spainOpinionSections, ...spainNewsSections].map((s, i) => (
              <Section key={i} title={s.title} icon={s.icon} items={s.items} color={s.color} gradient={s.gradient} count={s.count} descriptor={s.descriptor} type={s.type} note={s.note} meta={s.meta} />
            ))}
          </div>
        )}

        {!hasAnyData && intlStatus === 'idle' && spainOpinionStatus === 'idle' && spainNewsStatus === 'idle' && (
          <div style={{ textAlign: 'center', padding: '32px 20px 12px', color: 'rgba(30,58,138,0.75)' }}>
            <div style={{ fontSize: '44px', marginBottom: '10px', opacity: 0.55, animation: 'float 3s ease-in-out infinite' }}>🕊️</div>
            <p style={{ fontSize: '13px', margin: 0, fontFamily: "'Verdana', 'Geneva', sans-serif", fontStyle: 'italic' }}>
              Pulsa los botones para generar cada sección
            </p>
            <p style={{ fontSize: '11px', margin: '8px 0 0', color: 'rgba(30,58,138,0.55)' }}>
              Internacional: 8 opinión + 20 mundo · Opinión España: 16 · Noticias España: 15
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
