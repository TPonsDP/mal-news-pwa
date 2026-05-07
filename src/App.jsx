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

function NewsCard({ item, index }) {
  const labelText = item.author ? `${item.author} · ${item.source || ''}` : (item.source || '');
  const colorKey = item.author || item.source;
  const accent = getSourceColor(colorKey);

  return (
    <div style={{
      background: BRAND.cardSubtle,
      border: '1px solid rgba(30,58,138,0.12)',
      borderLeft: `4px solid ${accent}`,
      borderRadius: '8px',
      padding: '12px 14px',
      marginBottom: '8px',
      boxShadow: '0 2px 8px rgba(30,58,138,0.08)',
      animation: `fadeSlide 0.4s ease ${Math.min(index * 0.04, 0.6)}s both`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
            <LeanBadge lean={item.lean} />
            <RegionBadge region={item.region} />
          </div>
          <p style={{ margin: '0 0 5px', fontSize: '13px', fontFamily: "'Verdana', 'Geneva', sans-serif", fontWeight: '700', color: BRAND.ink, lineHeight: 1.35 }}>
            {item.title}
          </p>
          <p style={{ margin: '0 0 6px', fontSize: '11.5px', color: BRAND.inkSoft, lineHeight: 1.5, fontFamily: "'Verdana', 'Geneva', sans-serif" }}>{item.summary}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '9.5px', fontWeight: '700', letterSpacing: '0.08em',
              color: BRAND.navyDeep, textTransform: 'uppercase',
            }}>{labelText}</span>
            {item.url && (
              <a href={item.url} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: '9.5px', color: BRAND.orange, textDecoration: 'none', borderBottom: `1px dotted ${BRAND.orange}80`, fontWeight: '700' }}>
                leer →
              </a>
            )}
          </div>
        </div>
        <span style={{
          fontSize: '20px', fontWeight: '900', color: 'rgba(194,105,60,0.30)',
          fontFamily: "'Verdana', 'Geneva', sans-serif", minWidth: '26px', textAlign: 'right', lineHeight: 1,
        }}>{String(item.rank).padStart(2, '0')}</span>
      </div>
    </div>
  );
}

function Section({ title, icon, items, color, count }) {
  return (
    <div style={{ marginBottom: '26px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', borderBottom: `2px solid ${color}80`, paddingBottom: '8px' }}>
        <span style={{ fontSize: '16px' }}>{icon}</span>
        <h2 style={{ margin: 0, fontSize: '11px', fontWeight: '800', letterSpacing: '0.15em', textTransform: 'uppercase', color: BRAND.navyDeep, fontFamily: "'Verdana', 'Geneva', sans-serif", flex: 1 }}>{title}</h2>
        <span style={{ fontSize: '10px', color: BRAND.inkSoft, fontFamily: "'Verdana', 'Geneva', sans-serif", fontStyle: 'italic' }}>
          {items?.length || 0}{count ? ` / ${count}` : ''}
        </span>
      </div>
      {items?.map((item, i) => <NewsCard key={i} item={item} index={i} />)}
    </div>
  );
}

export default function App() {
  // Estado por sección — cada botón gestiona su propia carga independiente
  const [intlData, setIntlData] = useState(null);
  const [intlStatus, setIntlStatus] = useState('idle'); // idle | loading | done | error
  const [intlError, setIntlError] = useState('');

  const [spainData, setSpainData] = useState(null);
  const [spainStatus, setSpainStatus] = useState('idle');
  const [spainError, setSpainError] = useState('');

  const [emailStatus, setEmailStatus] = useState('idle');

  // Cooldown global compartido entre los dos botones — evita el rate_limit_error 429 de Anthropic Tier 1
  const [nextAllowedAt, setNextAllowedAt] = useState(0);
  const [cooldownLeft, setCooldownLeft] = useState(0);

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

  const today = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const todayShort = new Date().toLocaleDateString('es-ES');

  async function fetchSection(section) {
    if (Date.now() < nextAllowedAt) return; // Salvaguarda — el botón debería estar deshabilitado en este caso

    const setData = section === 'international' ? setIntlData : setSpainData;
    const setStatus = section === 'international' ? setIntlStatus : setSpainStatus;
    const setError = section === 'international' ? setIntlError : setSpainError;

    // Activa cooldown global de 150 seg desde AHORA
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
    if (!intlData && !spainData) return;
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
      date: (intlData?.date || spainData?.date || todayShort),
      worldNews: intlData?.worldNews || [],
      worldOpinion: intlData?.worldOpinion || [],
      energy: intlData?.energy || [],
      legal: intlData?.legal || [],
      spainNews: spainData?.spainNews || [],
      spainOpinion: spainData?.spainOpinion || [],
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

  const intlSections = intlData ? [
    { title: 'Mundo', icon: '🌍', items: intlData.worldNews, color: '#7DD3FC', count: 16 },
    { title: 'Opinión Internacional', icon: '✍️', items: intlData.worldOpinion, color: '#A5F3FC', count: 6 },
    { title: 'Energía', icon: '⚡', items: intlData.energy, color: BRAND.orange, count: 2 },
    { title: 'Legal', icon: '⚖️', items: intlData.legal, color: '#CBD5E1', count: 2 },
  ] : [];

  const spainSections = spainData ? [
    { title: 'España', icon: '🇪🇸', items: spainData.spainNews, color: '#FED7AA', count: 10 },
    { title: 'Opinión España', icon: '✒️', items: spainData.spainOpinion, color: BRAND.orange, count: 9 },
  ] : [];

  const intlBtnLabel = (() => {
    if (intlStatus === 'loading') return '🔍 Buscando internacional…';
    if (isInCooldown) return `⏳ Espera ${cooldownLeft}s`;
    if (intlStatus === 'done') return '🔄 Recargar internacional';
    return '🌍 Generar internacional (26)';
  })();

  const spainBtnLabel = (() => {
    if (spainStatus === 'loading') return '🔍 Buscando España…';
    if (isInCooldown) return `⏳ Espera ${cooldownLeft}s`;
    if (spainStatus === 'done') return '🔄 Recargar España';
    return '🇪🇸 Generar España (19)';
  })();

  const hasAnyData = intlData || spainData;

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
          MUNDO · OPINIÓN INTL · ENERGÍA · LEGAL · ESPAÑA · OPINIÓN ESPAÑA
        </p>

        <div style={{ height: '1px', background: `linear-gradient(90deg, transparent 0%, ${BRAND.orange}66 50%, transparent 100%)`, margin: '0 0 24px' }} />

        {/* DOS BOTONES: internacional + España */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <button
            className="mal-cta"
            onClick={() => fetchSection('international')}
            disabled={intlStatus === 'loading' || isInCooldown}
            style={{
              border: 'none', borderRadius: '10px', padding: '14px 24px',
              fontSize: '12px', fontWeight: '700', letterSpacing: '0.08em',
              cursor: (intlStatus === 'loading' || isInCooldown) ? 'wait' : 'pointer',
              transition: 'all 0.25s ease', fontFamily: "'Verdana', 'Geneva', sans-serif",
              background: intlStatus === 'loading'
                ? `linear-gradient(90deg, ${BRAND.orange}, ${BRAND.navy}, ${BRAND.orange})`
                : `linear-gradient(135deg, ${BRAND.orange} 0%, ${BRAND.navy} 100%)`,
              backgroundSize: intlStatus === 'loading' ? '200% 100%' : '100% 100%',
              animation: intlStatus === 'loading' ? 'shimmer 2s linear infinite' : 'none',
              color: BRAND.ink, opacity: (intlStatus === 'loading' || isInCooldown) ? 0.65 : 1,
              boxShadow: '0 4px 18px rgba(194,105,60,0.40)', textTransform: 'uppercase',
            }}
          >
            {intlBtnLabel}
          </button>

          <button
            className="mal-cta"
            onClick={() => fetchSection('spain')}
            disabled={spainStatus === 'loading' || isInCooldown}
            style={{
              border: 'none', borderRadius: '10px', padding: '14px 24px',
              fontSize: '12px', fontWeight: '700', letterSpacing: '0.08em',
              cursor: (spainStatus === 'loading' || isInCooldown) ? 'wait' : 'pointer',
              transition: 'all 0.25s ease', fontFamily: "'Verdana', 'Geneva', sans-serif",
              background: spainStatus === 'loading'
                ? `linear-gradient(90deg, ${BRAND.orange}, ${BRAND.navy}, ${BRAND.orange})`
                : `linear-gradient(135deg, ${BRAND.orange} 0%, ${BRAND.navy} 100%)`,
              backgroundSize: spainStatus === 'loading' ? '200% 100%' : '100% 100%',
              animation: spainStatus === 'loading' ? 'shimmer 2s linear infinite' : 'none',
              color: BRAND.ink, opacity: (spainStatus === 'loading' || isInCooldown) ? 0.65 : 1,
              boxShadow: '0 4px 18px rgba(194,105,60,0.40)', textTransform: 'uppercase',
            }}
          >
            {spainBtnLabel}
          </button>
        </div>

        {/* Botón email aparece solo si hay al menos una sección */}
        {hasAnyData && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <button
              className="mal-cta-secondary"
              onClick={sendEmail}
              style={{
                border: `1px solid ${BRAND.navy}50`, borderRadius: '8px',
                padding: '10px 24px', fontSize: '12px', fontWeight: '700',
                letterSpacing: '0.08em', cursor: 'pointer',
                transition: 'all 0.2s ease', fontFamily: "'Verdana', 'Geneva', sans-serif",
                background: 'rgba(255,255,255,0.85)', color: BRAND.ink,
              }}
            >
              {emailStatus === 'sent' ? '✓ Email preparado' : `📧 Abrir email a ${RECIPIENT}`}
            </button>
          </div>
        )}

        {/* Mensajes de loading individuales */}
        {intlStatus === 'loading' && (
          <p style={{ textAlign: 'center', color: BRAND.orange, fontSize: '12px', animation: 'pulse 1.5s infinite', marginBottom: '8px', fontStyle: 'italic' }}>
            🌍 Volando a buscar 26 piezas internacionales…
          </p>
        )}
        {spainStatus === 'loading' && (
          <p style={{ textAlign: 'center', color: BRAND.orange, fontSize: '12px', animation: 'pulse 1.5s infinite', marginBottom: '8px', fontStyle: 'italic' }}>
            🇪🇸 Volando a buscar 19 piezas españolas…
          </p>
        )}

        {/* Mensaje de cooldown activo cuando NO hay carga en marcha */}
        {isInCooldown && intlStatus !== 'loading' && spainStatus !== 'loading' && (
          <p style={{ textAlign: 'center', color: 'rgba(30,58,138,0.65)', fontSize: '11px', marginBottom: '8px', fontStyle: 'italic' }}>
            ⏳ Esperando {cooldownLeft}s antes de poder hacer otra llamada (rate limit Anthropic Tier 1)
          </p>
        )}

        {/* Errores individuales */}
        {intlStatus === 'error' && (
          <div style={{ background: 'rgba(252,165,165,0.1)', border: '1px solid rgba(252,165,165,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '8px', color: '#FCA5A5', fontSize: '11px' }}>
            ⚠️ Internacional: {intlError}
          </div>
        )}
        {spainStatus === 'error' && (
          <div style={{ background: 'rgba(252,165,165,0.1)', border: '1px solid rgba(252,165,165,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '8px', color: '#FCA5A5', fontSize: '11px' }}>
            ⚠️ España: {spainError}
          </div>
        )}

        {emailStatus === 'sent' && (
          <div style={{ background: 'rgba(134,239,172,0.12)', border: '1px solid rgba(134,239,172,0.3)', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', color: '#86EFAC', fontSize: '12px', textAlign: 'center' }}>
            ✅ Email preparado en tu cliente con destino {RECIPIENT}. Revísalo y pulsa Enviar.
          </div>
        )}

        {hasAnyData && (
          <div style={{ textAlign: 'center', margin: '0 0 24px', padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.08)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ fontSize: '11px', color: BRAND.orange, letterSpacing: '0.15em', fontWeight: '700' }}>
              {totalPieces} / 47 PIEZAS
            </span>
            <span style={{ fontSize: '10px', color: 'rgba(30,58,138,0.55)', marginLeft: '12px', fontStyle: 'italic' }}>
              {merged.date}
            </span>
          </div>
        )}

        {/* Render de las secciones disponibles */}
        {hasAnyData && (
          <div style={{ animation: 'fadeSlide 0.5s ease both' }}>
            {[...intlSections, ...spainSections].map((s, i) => (
              <Section key={i} title={s.title} icon={s.icon} items={s.items} color={s.color} count={s.count} />
            ))}
          </div>
        )}

        {!hasAnyData && intlStatus === 'idle' && spainStatus === 'idle' && (
          <div style={{ textAlign: 'center', padding: '32px 20px 12px', color: 'rgba(30,58,138,0.75)' }}>
            <div style={{ fontSize: '44px', marginBottom: '10px', opacity: 0.55, animation: 'float 3s ease-in-out infinite' }}>🕊️</div>
            <p style={{ fontSize: '13px', margin: 0, fontFamily: "'Verdana', 'Geneva', sans-serif", fontStyle: 'italic' }}>
              Pulsa los botones dorados para generar el briefing por secciones
            </p>
            <p style={{ fontSize: '11px', margin: '8px 0 0', color: 'rgba(30,58,138,0.55)' }}>
              Internacional: 16 mundo + 6 opinión + 2 energía + 2 legal · España: 10 noticias + 9 opinión
            </p>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '44px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <p style={{ fontSize: '10px', color: 'rgba(30,58,138,0.5)', margin: 0, letterSpacing: '0.15em', fontStyle: 'italic' }}>
            MAL NEWS · {RECIPIENT}
          </p>
          <p style={{ fontSize: '9px', color: 'rgba(30,58,138,0.45)', margin: '4px 0 0', letterSpacing: '0.1em' }}>
            v2 · PWA · 47 piezas · split internacional/España
          </p>
        </div>
      </div>
    </div>
  );
}
