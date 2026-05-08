import { useState, useEffect } from 'react';

const RECIPIENT = 'tonipons91@gmail.com';
const COOLDOWN_MS = 150 * 1000; // 150 segundos entre llamadas para no saturar Tier 1 de Anthropic

const BRAND = {
  // Fondo Sage muted (verde apagado, paleta tierra)
  limeLight: '#D5DBC1',  // Sage claro
  limeDark: '#B7C49E',   // Sage medio
  // Azul marino Tailwind (blue-900) para textos y logo
  navy: '#1E3A8A',
  navyDeep: '#172554',   // blue-950 (aún más oscuro para acentos)
  // Terracota para la fecha (alternativas comentadas para fácil swap)
  orange: '#C2693C',     // Terracota (recomendada con sage)
  // orange: '#E2725B',  // Terracota clásica más cálida
  // orange: '#A0522D',  // Sienna (más marrón)
  // orange: '#FF8C42',  // Mandarina vibrante
  // orange: '#CC5500',  // Naranja quemado
  // Fondo de tarjetas crema claro
  card: '#FAF8F2',
  cardSubtle: 'rgba(255,255,255,0.92)',
  ink: '#1E3A8A',        // azul marino para texto principal
  inkSoft: 'rgba(30,58,138,0.72)',
  // Lean badges
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
    <svg viewBox="0 0 400 200" width="100%" style={{ maxWidth, height: 'auto', display: 'block', margin: '0 auto', filter: 'drop-shadow(0 8px 24px rgba(30,58,138,0.25))' }} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="malBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#D5DBC1" stopOpacity="1" />
          <stop offset="100%" stopColor="#B7C49E" stopOpacity="1" />
        </linearGradient>
        <linearGradient id="malWaveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.04" />
        </linearGradient>
        <filter id="malLogoGlow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="400" height="200" rx="16" fill="url(#malBgGrad)" />
      <ellipse cx="320" cy="30" rx="180" ry="80" fill="url(#malWaveGrad)" />
      <ellipse cx="80" cy="170" rx="150" ry="60" fill="url(#malWaveGrad)" />
      <line x1="0" y1="100" x2="400" y2="100" stroke="rgba(30,58,138,0.06)" strokeWidth="1" />
      <line x1="200" y1="0" x2="200" y2="200" stroke="rgba(30,58,138,0.06)" strokeWidth="1" />
      <g transform="translate(285, 62)" filter="url(#malLogoGlow)">
        <ellipse cx="0" cy="8" rx="18" ry="10" fill="white" opacity="0.95" />
        <circle cx="18" cy="2" r="9" fill="white" opacity="0.95" />
        <polygon points="26,2 36,-1 26,5" fill="#C2693C" opacity="0.95" />
        <circle cx="21" cy="1" r="2" fill="#1E3A8A" />
        <circle cx="21.5" cy="0.5" r="0.6" fill="white" />
        <path d="M -8,2 Q -40,-20 -75,-8 Q -55,0 -20,4 Z" fill="white" opacity="0.92" />
        <path d="M -8,6 Q -45,-5 -72,10 Q -52,10 -18,8 Z" fill="rgba(255,255,255,0.75)" />
        <path d="M 10,0 Q 35,-22 68,-12 Q 50,2 22,3 Z" fill="white" opacity="0.92" />
        <path d="M 10,4 Q 38,-8 65,8 Q 46,8 20,6 Z" fill="rgba(255,255,255,0.75)" />
        <path d="M -16,12 Q -28,22 -24,30 Q -18,26 -12,18 Z" fill="white" opacity="0.85" />
        <path d="M -12,14 Q -20,28 -14,34 Q -8,28 -6,20 Z" fill="white" opacity="0.9" />
        <line x1="2" y1="18" x2="0" y2="28" stroke="rgba(194,105,60,0.85)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="6" y1="18" x2="8" y2="28" stroke="rgba(194,105,60,0.85)" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      <line x1="30" y1="148" x2="185" y2="148" stroke="rgba(30,58,138,0.4)" strokeWidth="1" />
      <text x="30" y="110" fontFamily="'Verdana', 'Geneva', sans-serif" fontSize="58" fontWeight="700" fill="#1E3A8A" letterSpacing="2" opacity="0.97">MAL</text>
      <text x="30" y="143" fontFamily="'Verdana', 'Geneva', sans-serif" fontSize="30" fontWeight="500" fill="rgba(30,58,138,0.85)" letterSpacing="10">NEWS</text>
      <text x="30" y="168" fontFamily="'Verdana', sans-serif" fontSize="11" fill="rgba(30,58,138,0.55)" letterSpacing="3" fontStyle="italic">Tu briefing diario</text>
      <rect x="0" y="190" width="400" height="10" rx="0" fill="rgba(30,58,138,0.08)" />
      <rect x="0" y="192" width="60" height="4" rx="0" fill="rgba(194,105,60,0.45)" />
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

  // Línea de byline: distinta para opinion vs news
  let byline = '';
  if (isOpinion && item.author) {
    byline = `${item.author}${item.source ? ` (${item.source}${dayOfWeek ? ` · ${dayOfWeek}` : ''})` : ''}`;
  } else {
    const parts = [item.source].filter(Boolean);
    if (item.region) parts.push(item.region);
    if (dayOfWeek) parts.push(dayOfWeek);
    byline = parts.join(' · ');
  }

  return (
    <div style={{
      background: BRAND.card,
      borderLeft: `4px solid ${sectionColor}`,
      borderRadius: '0 6px 6px 0',
      padding: '10px 14px',
      marginBottom: '5px',
      boxShadow: '0 1px 3px rgba(30,58,138,0.06)',
      animation: `fadeSlide 0.35s ease ${Math.min(index * 0.03, 0.5)}s both`,
    }}>
      {/* Línea de byline con ⭐ + autor/fuente + ✅ */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap',
        fontSize: '11px', color: BRAND.navyDeep, fontWeight: '700',
        letterSpacing: '0.02em', marginBottom: '6px',
        fontFamily: "'Verdana', 'Geneva', sans-serif",
      }}>
        <span style={{ fontSize: '13px' }}>⭐</span>
        <span style={{ flex: 1, minWidth: 0 }}>{byline}</span>
        {item.url && <span style={{ fontSize: '13px' }}>✅</span>}
        <LeanBadge lean={item.lean} />
      </div>

      {/* Título */}
      <h3 style={{
        margin: '0 0 4px',
        fontSize: isOpinion ? '14px' : '13px',
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
        fontStyle: isOpinion ? 'italic' : 'normal',
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
            leer →
          </a>
        )}
      </div>
    </div>
  );
}

function Section({ title, icon, items, color, count, descriptor, type }) {
  const realCount = items?.length || 0;
  const itemLabel = type === 'opinion' ? (realCount === 1 ? 'COLUMNA' : 'COLUMNAS') : (realCount === 1 ? 'PIEZA' : 'PIEZAS');

  return (
    <div style={{ marginBottom: '20px' }}>
      {/* Bloque de cabecera de sección */}
      <div style={{
        background: color,
        color: 'white',
        padding: '14px 18px',
        borderRadius: '8px 8px 0 0',
        boxShadow: '0 2px 8px rgba(30,58,138,0.15)',
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
          <p style={{ margin: '12px', color: BRAND.inkSoft, fontSize: '11px', fontStyle: 'italic', textAlign: 'center' }}>
            Sin piezas disponibles para esta sección
          </p>
        ) : (
          items.map((item, i) => <NewsCard key={i} item={item} index={i} sectionColor={color} type={type} />)
        )}
      </div>
    </div>
  );
}

export default function App() {
  // Estado por sección — cada botón gestiona su propia carga independiente
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

  // Cooldown global compartido entre los TRES botones — evita el rate_limit_error 429 de Anthropic Tier 1
  const [nextAllowedAt, setNextAllowedAt] = useState(0);
  const [cooldownLeft, setCooldownLeft] = useState(0);

  // Fecha seleccionada (formato ISO YYYY-MM-DD para el input). Por defecto: hoy.
  const todayIso = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayIso);

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
    setData(null);

    try {
      const res = await fetch('/api/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: todayShort, section }),
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
    const subject = `🕊️ MAL NEWS — Briefing ${todayShort}`;
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

  function buildEmailPlainText(b) {
    const leanLabel = (lean) => lean === 'left' ? '[IZQ ◀]' : lean === 'right' ? '[DER ▶]' : '';
    const sep = '─'.repeat(50);
    const dsep = '═'.repeat(50);

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
      `MAL NEWS — Briefing ${b.date || todayShort}`,
      `Tu briefing diario · ${totalPieces} piezas`,
      dsep,
      section('🌍 Mundo', b.worldNews),
      section('✍️ Opinión Internacional', b.worldOpinion),
      section('⚡ Energía', b.energy),
      section('⚖️ Legal', b.legal),
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
    (merged.energy?.length || 0) + (merged.legal?.length || 0) +
    (merged.spainNews?.length || 0) + (merged.spainOpinion?.length || 0);

  // Colores por sección — Paleta C (Vibrante saturada) ACTIVA
  // Si quieres cambiar, descomenta una de las paletas alternativas abajo y comenta esta
  const SECTION_COLORS = {
    worldOpinion: '#1D4ED8',  // Royal blue
    worldNews:    '#047857',  // Emerald
    legal:        '#334155',  // Charcoal
    spainOpinion: '#BE185D',  // Rose dark
    spainNews:    '#9A3412',  // Orange dark
  };
  // Paleta A — Magazine editorial (default original):
  // const SECTION_COLORS = { worldOpinion: '#3730A3', worldNews: '#0F766E', legal: '#475569', spainOpinion: '#9F1239', spainNews: '#C2410C' };
  // Paleta B — Vintage sobria:
  // const SECTION_COLORS = { worldOpinion: '#172554', worldNews: '#14532D', legal: '#44403C', spainOpinion: '#7F1D1D', spainNews: '#9A3412' };

  const intlSections = intlData ? [
    { title: 'Opinión Internacional', icon: '✍️', items: intlData.worldOpinion, color: SECTION_COLORS.worldOpinion, count: 6, type: 'opinion',
      descriptor: 'Columnas firmadas · medios internacionales · 48h previas · evento concreto' },
    { title: 'Mundo', icon: '🌍', items: intlData.worldNews, color: SECTION_COLORS.worldNews, count: 16, type: 'news',
      descriptor: '≥4 regiones · equilibrio IZQ/DER · publicadas en últimas 48h' },
    { title: 'Legal', icon: '⚖️', items: intlData.legal, color: SECTION_COLORS.legal, count: 2, type: 'news',
      descriptor: 'Sentencias y decisiones del día · internacional + España' },
  ] : [];

  const spainOpinionSections = spainOpinionData ? [
    { title: 'Opinión España', icon: '✍️', items: spainOpinionData.spainOpinion, color: SECTION_COLORS.spainOpinion, count: 10, type: 'opinion',
      descriptor: 'Columnas firmadas · sin editoriales · 5+ medios · publicadas hoy o ayer' },
  ] : [];

  const spainNewsSections = spainNewsData ? [
    { title: 'España', icon: '🇪🇸', items: spainNewsData.spainNews, color: SECTION_COLORS.spainNews, count: 10, type: 'news',
      descriptor: 'Eventos concretos · prensa española · publicadas últimas 48h' },
  ] : [];

  const intlBtnLabel = (() => {
    if (intlStatus === 'loading') return '🔍 Buscando internacional…';
    if (isInCooldown) return `⏳ Espera ${cooldownLeft}s`;
    if (intlStatus === 'done') return '🔄 Recargar internacional';
    return '🌍 Generar internacional (24)';
  })();

  const spainOpinionBtnLabel = (() => {
    if (spainOpinionStatus === 'loading') return '🔍 Buscando opinión España…';
    if (isInCooldown) return `⏳ Espera ${cooldownLeft}s`;
    if (spainOpinionStatus === 'done') return '🔄 Recargar opinión España';
    return '✍️ Opinión España (10)';
  })();

  const spainNewsBtnLabel = (() => {
    if (spainNewsStatus === 'loading') return '🔍 Buscando notici
