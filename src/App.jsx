import { useState, useEffect } from 'react';

// ============ CACHE LOCALSTORAGE ============
// Persiste el briefing entre sesiones: si cierras la PWA y vuelves a abrir,
// recuperas el último briefing generado de cada botón.
// SIN TTL: la última generación de cada uno (Internacional, Opinión, Noticias)
// queda guardada hasta que regeneres ese botón o pulses "limpiar".

const CACHE_KEY = 'mal-news-briefing-v1';
const PRESSREADER_KEY = 'mal-news-pressreader-enabled';

// ============ MIS SUSCRIPCIONES DIRECTAS ============
// Medios con acceso directo del usuario (suscripción propia).
// Aparecen con badge verde "✓ ACCESO" en lugar de "🔒 PAGO" o "📚 PRESSREADER".
// Prioridad de badges:  ACCESO  >  PRESSREADER  >  PAGO
const USER_SUBSCRIPTIONS = new Set([
  'El País', 'elpais.com',
  'El Mundo', 'elmundo.es',
  'ABC', 'abc.es',
  'El Español', 'elespanol.com',
  'El Confidencial', 'elconfidencial.com',
]);

function isUserSubscribed(sourceName) {
  if (!sourceName) return false;
  return USER_SUBSCRIPTIONS.has(sourceName) || USER_SUBSCRIPTIONS.has(String(sourceName).toLowerCase());
}

// ============ PRESSREADER · Acceso del usuario ============
// El usuario puede activar este toggle si tiene PressReader (vía biblioteca o
// suscripción €9.99/mes). Cuando está activo, los medios disponibles en
// PressReader se marcan con 📚 verde en lugar de 🔒 rojo PAGO.
function loadPressReaderEnabled() {
  try {
    return localStorage.getItem(PRESSREADER_KEY) === 'true';
  } catch (_) { return false; }
}

function savePressReaderEnabled(enabled) {
  try {
    localStorage.setItem(PRESSREADER_KEY, enabled ? 'true' : 'false');
  } catch (_) { /* no-op */ }
}

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

// ============ HISTÓRICO DE CAMBIOS (CHANGELOG) ============
// Panel buscable dentro de la PWA. Para añadir un cambio nuevo, agrega un objeto
// al principio del array (los más recientes arriba). Campos: fecha, área, texto.
const CHANGELOG = [
  { fecha: '2026-06', area: 'Noticias · Vozpópuli', texto: 'Arreglado el feed de noticias de Vozpópuli: la query con exclusión por subruta (-site:.../opinion) rompía Google News y devolvía cero. Simplificada a site:vozpopuli.com limpio.' },
  { fecha: '2026-06', area: 'UI · Contadores', texto: 'Corregidos los contadores de los botones: Opinión España (hasta 36) y Noticias España (hasta 28), que estaban desactualizados (22 y 25).' },
  { fecha: '2026-06', area: 'Opinión · La Vanguardia', texto: 'Restaurado el mínimo 2 de La Vanguardia, que se había descolgado.' },
  { fecha: '2026-06', area: 'Fechas', texto: 'Reforzado el fix del bug de día pasado: regla de fecha absoluta en RSS y en búsquedas web internacionales para no traer piezas del día actual cuando se pide una fecha anterior.' },
  { fecha: '2026-06', area: 'Noticias · Deportes', texto: 'Filtro anti-deportes reforzado en las 3 secciones, incluyendo casos límite (economía de clubes, declaraciones, arbitrajes) y opinión deportiva.' },
  { fecha: '2026-06', area: 'Noticias · Análisis', texto: 'Añadido "Apunte del editor": análisis breve de los 2-3 temas clave del día, tono ecuánime. Y excepción de análisis como 4ª pieza de un tema.' },
  { fecha: '2026-06', area: 'Opinión · Caps', texto: 'Caps por medio ajustados: Vozpópuli 5-6, El Mundo 4-5, The Objective 3-4, El País 3, elDiario.es 3-4, Libertad Digital 3-4. Tope total subido a 36.' },
  { fecha: '2026-06', area: 'Opinión · Izquierda', texto: 'Añadidos medios de izquierda gratuitos: El Salto (alternativa/social) y CTXT (análisis). elDiario.es reforzado.' },
  { fecha: '2026-06', area: 'Opinión · La Vanguardia', texto: 'Añadida La Vanguardia con columnistas Enric Juliana y Pilar Rahola.' },
  { fecha: '2026-06', area: 'Noticias · Bloques', texto: 'Sistema de bloques de sesgo en noticias España: izquierda 5, centro 10 (Vozpópuli ≥5), derecha 4, Baleares 3, económico 4. Regla de 1 izq + 1 centro + 1 der por tema repetido (máx 3 piezas/tema).' },
  { fecha: '2026-06', area: 'Noticias · Medios', texto: 'ABC y El Español retirados de noticias España. El Economista (ES) añadido al bloque económico.' },
  { fecha: '2026-06', area: 'Histórico', texto: 'Añadido el registro de piezas en localStorage: media de tus últimos briefings por sección, mostrada bajo cada cabecera.' },
  { fecha: '2026-06', area: 'Salida', texto: 'Conteo por medio en la salida de cada sección (📊 Distribución por medio).' },
  { fecha: '2026-06', area: 'Internacional · Opinión', texto: 'Añadida opinión real a regiones que estaban vacías: EUobserver/Voxeurop (UE), Al Jazeera/Al-Monitor (OM), Kyiv Independent (Este), Daily Maverick (África). WSJ y think tanks económicos (Bruegel, PIIE, VoxEU). Project Syndicate mín 2.' },
  { fecha: '2026-06', area: 'Internacional · Cobertura', texto: 'Cobertura regional ampliada: Asia 20 feeds, LATAM 12, Europa Este creado (9), Oriente Medio 6, Económico Global. Politico Europe en noticias UE. Epoch Times añadido. Caixin eliminado.' },
];
// ============ FIN CHANGELOG ============


// ============ HISTÓRICO DE PIEZAS (localStorage) ============
// Registra cada briefing generado (fecha, sección, nº de piezas) y calcula la media.
// Vive solo en este navegador. Guarda los últimos 60 registros por sección.
const HISTORY_KEY = 'mal-news-history-v1';
const HISTORY_MAX = 60;

// Datos SEMILLA: conteos por medio de los briefings ya recibidos (recopilados de los correos).
// Se siembran una sola vez en localStorage si no hay histórico previo, para que el panel 📊
// arranque con los datos de junio en vez de vacío. Cada entrada: { at, count, sources }.
const HISTORY_SEED = {
  spainNews: [
    { at: '2026-06-01T19:00:00.000Z', count: 28, sources: { 'elDiario.es': 6, 'Cinco Días': 5, 'OK Diario Baleares': 4, 'El País': 4, 'Libertad Digital': 4, 'Crónica Global': 3, 'El Español': 1, 'Economía de Mallorca': 1 } },
    { at: '2026-06-03T19:00:00.000Z', count: 21, sources: { 'elDiario.es': 4, 'Libertad Digital': 4, 'Cinco Días': 4, 'El País': 4, 'Crónica Global': 3, 'OK Diario Baleares': 2 } },
    { at: '2026-06-05T19:00:00.000Z', count: 26, sources: { 'elDiario.es': 7, 'Libertad Digital': 4, 'El Español': 4, 'Cinco Días': 3, 'OK Diario Baleares': 2, 'El País': 2, 'Crónica Global': 1, 'Economía de Mallorca': 1, 'Huffington Post': 1, 'El Nacional.cat': 1 } },
    { at: '2026-06-06T12:00:00.000Z', count: 28, sources: { 'elDiario.es': 5, 'The Objective': 5, 'Libertad Digital': 3, 'El Español': 2, 'OK Diario': 2, 'La Gaceta': 2, 'Crónica Global': 2, 'El País': 2, 'OK Diario Baleares': 2, 'El Nacional.cat': 1, 'Economía de Mallorca': 1, 'ABC': 1 } },
    { at: '2026-06-07T19:00:00.000Z', count: 26, sources: { 'El Español': 5, 'elDiario.es': 4, 'El País': 4, 'Economía de Mallorca': 3, 'Libertad Digital': 3, 'Crónica Global': 2, 'OK Diario Baleares': 2, 'Cinco Días': 2, 'El Nacional.cat': 1 } },
    { at: '2026-06-08T19:00:00.000Z', count: 30, sources: { 'Libertad Digital': 5, 'elDiario.es': 4, 'El País': 4, 'Demócrata': 4, 'The Objective': 4, 'La Gaceta': 3, 'El Español': 2, 'OK Diario': 1, 'ABC': 1, 'Crónica Global': 1, 'El Nacional.cat': 1 } },
    { at: '2026-06-09T19:00:00.000Z', count: 28, sources: { 'Vozpópuli': 6, 'elDiario.es': 5, 'El Español': 3, 'Libertad Digital': 2, 'El País': 2, 'Demócrata': 2, 'Economía de Mallorca': 2, 'elDiario.es Baleares': 2, 'Crónica Global': 1, 'Cinco Días': 1, 'Invertia': 1, 'Huffington Post': 1 } },
    { at: '2026-06-10T19:00:00.000Z', count: 27, sources: { 'Vozpópuli': 6, 'elDiario.es': 5, 'El Español': 2, 'Libertad Digital': 2, 'El País': 2, 'Demócrata': 2, 'Economía de Mallorca': 2, 'elDiario.es Baleares': 2, 'Crónica Global': 1, 'Cinco Días': 1, 'Invertia': 1, 'Huffington Post': 1 } },
    { at: '2026-06-11T19:00:00.000Z', count: 29, sources: { 'elDiario.es': 6, 'Libertad Digital': 5, 'The Objective': 5, 'El Español': 3, 'Demócrata': 2, 'Crónica Global': 2, 'El País': 2, 'OK Diario': 1, 'ABC': 1, 'El Nacional.cat': 1, 'La Gaceta': 1 } },
    { at: '2026-06-12T19:00:00.000Z', count: 30, sources: { 'elDiario.es': 5, 'Libertad Digital': 5, 'Vozpópuli': 4, 'Huffington Post': 2, 'El País': 2, 'Demócrata': 2, 'El Nacional.cat': 2, 'Cinco Días': 2, 'elDiario.es Baleares': 2, 'El Español': 1, 'Crónica Global': 1, 'OK Diario Baleares': 1, 'Economía de Mallorca': 1 } },
    { at: '2026-06-13T12:00:00.000Z', count: 29, sources: { 'Libertad Digital': 6, 'Demócrata': 5, 'The Objective': 4, 'elDiario.es': 4, 'El País': 2, 'El Español': 2, 'La Gaceta': 2, 'OK Diario': 1, 'Crónica Global': 1, 'El Nacional.cat': 1, 'ABC': 1 } },
    { at: '2026-06-14T19:00:00.000Z', count: 28, sources: { 'El País': 4, 'elDiario.es': 4, 'Libertad Digital': 4, 'The Objective': 4, 'Crónica Global': 3, 'Demócrata': 2, 'La Gaceta': 2, 'El Español': 2, 'ABC': 1, 'OK Diario': 1, 'El Nacional.cat': 1 } },
    { at: '2026-06-15T19:00:00.000Z', count: 39, sources: { 'El País': 5, 'Cinco Días': 5, 'elDiario.es': 5, 'Libertad Digital': 5, 'Demócrata': 4, 'The Objective': 3, 'Crónica Global': 3, 'Economía de Mallorca': 3, 'La Gaceta': 2, 'OK Diario Baleares': 2, 'OK Diario': 1, 'El Nacional.cat': 1 } },
    { at: '2026-06-16T19:00:00.000Z', count: 36, sources: { 'Libertad Digital': 5, 'elDiario.es': 5, 'The Objective': 5, 'El País': 4, 'Crónica Global': 4, 'Cinco Días': 3, 'La Gaceta': 3, 'OK Diario': 2, 'OK Diario Baleares': 2, 'Economía de Mallorca': 1, 'Demócrata': 1, 'El Nacional.cat': 1 } },
    { at: '2026-06-17T19:00:00.000Z', count: 32, sources: { 'El País': 5, 'The Objective': 5, 'Cinco Días': 5, 'Crónica Global': 4, 'Libertad Digital': 3, 'elDiario.es': 2, 'La Gaceta': 2, 'Demócrata': 2, 'OK Diario': 1, 'OK Diario Baleares': 1, 'Economía de Mallorca': 1, 'El Nacional.cat': 1 } },
    { at: '2026-06-18T19:00:00.000Z', count: 31, sources: { 'elDiario.es': 6, 'Libertad Digital': 4, 'Demócrata': 4, 'El País': 3, 'The Objective': 3, 'Cinco Días': 3, 'Crónica Global': 3, 'OK Diario Baleares': 2, 'OK Diario': 1, 'Economía de Mallorca': 1, 'El Nacional.cat': 1 } },
    { at: '2026-06-19T19:00:00.000Z', count: 30, sources: { 'elDiario.es': 4, 'Demócrata': 4, 'Cinco Días': 4, 'Libertad Digital': 3, 'The Objective': 2, 'El País': 2, 'Crónica Global': 2, 'La Gaceta': 2, 'OK Diario Baleares': 2, 'OK Diario': 1, 'Economía de Mallorca': 1, 'El Nacional.cat': 1 } },
    { at: '2026-06-20T12:00:00.000Z', count: 33, sources: { 'El País': 6, 'elDiario.es': 5, 'Libertad Digital': 4, 'The Objective': 3, 'La Gaceta': 3, 'Crónica Global': 2, 'Cinco Días': 2, 'Demócrata': 2, 'OK Diario': 1, 'OK Diario Baleares': 1, 'Huffington Post': 1, 'El Nacional.cat': 1, 'Economía de Mallorca': 1 } },
    { at: '2026-06-21T19:00:00.000Z', count: 30, sources: { 'El País': 5, 'The Objective': 4, 'La Gaceta': 4, 'Libertad Digital': 3, 'Crónica Global': 3, 'Cinco Días': 3, 'elDiario.es': 2, 'Demócrata': 2, 'Economía de Mallorca': 2, 'OK Diario': 1, 'El Nacional.cat': 1 } },
  ],
  spainOpinion: [
    { at: '2026-06-01T19:00:00.000Z', count: 21, sources: { 'The Objective': 4, 'El País': 3, 'La Gaceta': 3, 'Libertad Digital': 3, 'elDiario.es': 2, 'El Mundo': 2, 'OK Diario': 1, 'El Blog Salmón': 1, 'Ethic': 1, 'Letras Libres': 1 } },
    { at: '2026-06-03T19:00:00.000Z', count: 22, sources: { 'The Objective': 5, 'La Gaceta': 3, 'Libertad Digital': 3, 'elDiario.es': 2, 'El Mundo': 2, 'OK Diario': 2, 'El País': 1, 'El Debate': 1, 'Ethic': 1, 'El Blog Salmón': 1, 'Letras Libres': 1 } },
    { at: '2026-06-05T19:00:00.000Z', count: 21, sources: { 'The Objective': 4, 'La Gaceta': 3, 'Libertad Digital': 3, 'elDiario.es': 2, 'El País': 2, 'El Mundo': 2, 'OK Diario': 1, 'El Debate': 1, 'El Blog Salmón': 1, 'Ethic': 1, 'Letras Libres': 1 } },
    { at: '2026-06-06T12:00:00.000Z', count: 23, sources: { 'The Objective': 5, 'El País': 4, 'La Gaceta': 4, 'Libertad Digital': 2, 'El Mundo': 2, 'elDiario.es': 1, 'OK Diario': 1, 'El Debate': 1, 'El Blog Salmón': 1, 'Ethic': 1, 'Letras Libres': 1 } },
    { at: '2026-06-07T19:00:00.000Z', count: 18, sources: { 'The Objective': 5, 'Libertad Digital': 3, 'La Gaceta': 3, 'El Mundo': 2, 'El País': 2, 'elDiario.es': 1, 'El Debate': 1, 'OK Diario': 1 } },
    { at: '2026-06-08T19:00:00.000Z', count: 26, sources: { 'The Objective': 5, 'Vozpópuli': 4, 'La Gaceta': 3, 'Libertad Digital': 3, 'El Mundo': 2, 'elDiario.es': 2, 'El País': 2, 'El Debate': 1, 'OK Diario': 1, 'El Blog Salmón': 1, 'Ethic': 1, 'Letras Libres': 1 } },
    { at: '2026-06-09T19:00:00.000Z', count: 28, sources: { 'The Objective': 5, 'Vozpópuli': 4, 'La Gaceta': 3, 'Libertad Digital': 3, 'El País': 3, 'elDiario.es': 2, 'El Mundo': 2, 'El Debate': 1, 'OK Diario': 1, 'El Blog Salmón': 1, 'Huffington Post': 1, 'Ethic': 1, 'Letras Libres': 1 } },
    { at: '2026-06-11T19:00:00.000Z', count: 26, sources: { 'The Objective': 5, 'Vozpópuli': 4, 'El País': 3, 'La Gaceta': 3, 'El Mundo': 2, 'Libertad Digital': 2, 'elDiario.es': 1, 'OK Diario': 1, 'El Debate': 1, 'El Blog Salmón': 1, 'Ethic': 1, 'Huffington Post': 1, 'Letras Libres': 1 } },
    { at: '2026-06-12T19:00:00.000Z', count: 28, sources: { 'The Objective': 5, 'Vozpópuli': 4, 'La Gaceta': 3, 'Libertad Digital': 3, 'elDiario.es': 2, 'El Mundo': 2, 'OK Diario': 2, 'El País': 2, 'El Debate': 1, 'El Blog Salmón': 1, 'Huffington Post': 1, 'Ethic': 1, 'Letras Libres': 1 } },
    { at: '2026-06-13T12:00:00.000Z', count: 25, sources: { 'The Objective': 5, 'Vozpópuli': 4, 'OK Diario': 2, 'elDiario.es': 2, 'El País': 2, 'El Mundo': 2, 'Libertad Digital': 2, 'La Gaceta': 1, 'El Debate': 1, 'El Blog Salmón': 1, 'Ethic': 1, 'Letras Libres': 1, 'Huffington Post': 1 } },
    { at: '2026-06-14T19:00:00.000Z', count: 25, sources: { 'The Objective': 4, 'Vozpópuli': 4, 'El País': 3, 'Libertad Digital': 2, 'elDiario.es': 2, 'El Mundo': 2, 'La Gaceta': 2, 'OK Diario': 2, 'El Debate': 1, 'El Blog Salmón': 1, 'Letras Libres': 1, 'Huffington Post': 1 } },
    { at: '2026-06-15T19:00:00.000Z', count: 29, sources: { 'The Objective': 6, 'La Gaceta': 4, 'Libertad Digital': 3, 'El País': 3, 'Vozpópuli': 2, 'El Mundo': 2, 'elDiario.es': 2, 'El Debate': 1, 'La Vanguardia': 1, 'Huffington Post': 1, 'OK Diario': 1, 'Letras Libres': 1, 'Ethic': 1, 'El Blog Salmón': 1 } },
    { at: '2026-06-17T19:00:00.000Z', count: 33, sources: { 'El Mundo': 6, 'The Objective': 5, 'Vozpópuli': 4, 'El País': 3, 'La Gaceta': 3, 'elDiario.es': 2, 'Libertad Digital': 2, 'La Vanguardia': 2, 'OK Diario': 1, 'El Debate': 1, 'El Blog Salmón': 1, 'El Salto': 1, 'Ethic': 1, 'Letras Libres': 1 } },
    { at: '2026-06-18T19:00:00.000Z', count: 34, sources: { 'The Objective': 5, 'El Mundo': 5, 'Vozpópuli': 4, 'La Gaceta': 3, 'El País': 3, 'Libertad Digital': 3, 'elDiario.es': 2, 'La Vanguardia': 2, 'OK Diario': 1, 'El Salto': 1, 'Ethic': 1, 'El Blog Salmón': 1, 'Letras Libres': 1, 'Huffington Post': 1, 'El Debate': 1 } },
    { at: '2026-06-19T19:00:00.000Z', count: 40, sources: { 'The Objective': 5, 'El Mundo': 5, 'Libertad Digital': 4, 'Vozpópuli': 4, 'El País': 3, 'La Gaceta': 3, 'elDiario.es': 3, 'OK Diario': 2, 'La Vanguardia': 2, 'El Salto': 2, 'Ethic': 2, 'Letras Libres': 2, 'El Debate': 1, 'El Blog Salmón': 1, 'Huffington Post': 1 } },
    { at: '2026-06-20T12:00:00.000Z', count: 41, sources: { 'El Mundo': 6, 'The Objective': 5, 'elDiario.es': 4, 'Libertad Digital': 4, 'La Gaceta': 4, 'Vozpópuli': 4, 'El País': 3, 'OK Diario': 2, 'El Debate': 2, 'El Salto': 2, 'Letras Libres': 2, 'Ethic': 2, 'La Vanguardia': 2, 'El Blog Salmón': 1, 'Huffington Post': 1 } },
    { at: '2026-06-21T19:00:00.000Z', count: 40, sources: { 'The Objective': 6, 'El Mundo': 5, 'Libertad Digital': 5, 'elDiario.es': 4, 'Vozpópuli': 4, 'El País': 3, 'La Gaceta': 3, 'La Vanguardia': 3, 'OK Diario': 2, 'El Salto': 2, 'El Debate': 1, 'Huffington Post': 1 } },
  ],
  world: [
    { at: '2026-06-01T21:30:00.000Z', count: 30, sources: { 'Infobae': 3, 'Foreign Affairs': 3, 'Project Syndicate': 3, 'Al Jazeera': 2, 'El Espectador': 2, 'Foreign Policy': 2, 'Daily Maverick': 2, 'Confidencial': 2, 'The National': 1, 'Kyiv Independent': 1, 'Japan Times': 1, 'Global Times': 1, 'The Hindu': 1, 'Mail & Guardian': 1, 'The Guardian': 1, 'The New York Times': 1, 'The Washington Post': 1, 'UnHerd': 1, 'National Review': 1 } },
    { at: '2026-06-03T21:30:00.000Z', count: 30, sources: { 'Daily Maverick': 4, 'Infobae': 3, 'Foreign Affairs': 2, 'Foreign Policy': 2, 'Korea Herald': 2, 'National Review': 2, 'Project Syndicate': 2, 'Confidencial': 2, 'The National': 1, 'Al Jazeera': 1, 'Times of Israel': 1, 'Kyiv Independent': 1, 'Sixth Tone': 1, 'Global Times': 1, 'El Espectador': 1, 'Washington Post': 1, 'NYT': 1, 'UnHerd': 1, 'Indian Express': 1 } },
    { at: '2026-06-05T21:30:00.000Z', count: 30, sources: { 'Project Syndicate': 3, 'Al Jazeera': 3, 'The Hill': 3, 'Japan Times': 3, 'Caixin Global': 3, 'Foreign Policy': 3, 'El Espectador': 3, 'Kyiv Independent': 1, 'Infobae': 1, 'MarketWatch': 1, 'Times of Israel': 1, 'The Atlantic': 2, 'UnHerd': 1, 'National Review': 1, 'Foreign Affairs': 1 } },
    { at: '2026-06-06T18:00:00.000Z', count: 30, sources: { 'Times of Israel': 3, 'Kyiv Independent': 3, 'Project Syndicate': 3, 'Foreign Affairs': 4, 'The Bulwark': 2, 'The Guardian': 3, 'Foreign Policy': 2, 'Al Jazeera': 1, 'Quartz': 1, 'MarketWatch': 1, 'Global Times': 1, 'UnHerd': 2, 'National Review': 1, 'Daily Maverick': 1, 'NYT': 1, 'The Atlantic': 1 } },
    { at: '2026-06-07T18:30:00.000Z', count: 30, sources: { 'Reuters': 4, 'Times of Israel': 3, 'UnHerd': 3, 'Infobae': 2, 'Caixin Global': 2, 'Global Times': 2, 'The Bulwark': 2, 'Politico': 2, 'Project Syndicate': 2, 'The Atlantic': 2, 'The Guardian': 3, 'Kyiv Independent': 1, 'The National News': 1, 'MarketWatch': 1, 'NYT': 1 } },
    { at: '2026-06-08T21:30:00.000Z', count: 20, sources: { 'Al Jazeera': 3, 'Korea Herald': 3, 'Infobae': 3, 'Kyiv Independent': 3, 'Global Times': 2, 'Caixin Global': 1, 'Daily Maverick': 1, 'La Jornada': 1, 'MarketWatch': 1, 'Foreign Affairs': 1, 'The Bulwark': 1 } },
    { at: '2026-06-09T21:30:00.000Z', count: 20, sources: { 'Infobae': 5, 'Daily Maverick': 3, 'Caixin Global': 2, 'Japan Times': 2, 'Foreign Affairs': 2, 'Al Jazeera': 1, 'Times of Israel': 1, 'The Hindu': 1, 'Global Times': 1, 'Foreign Policy': 1, 'Politico': 1 } },
    { at: '2026-06-11T21:30:00.000Z', count: 20, sources: { 'Kyiv Independent': 3, 'Foreign Affairs': 3, 'Caixin Global': 3, 'South China Morning Post': 2, 'Times of Israel': 1, 'Foreign Policy': 1, 'The Hill': 1, 'The Atlantic': 1, 'Daily Maverick': 1, 'La Nación': 1, 'The National': 1, 'National Review': 1, 'Forbes': 1 } },
    { at: '2026-06-12T21:30:00.000Z', count: 21, sources: { 'Caixin Global': 3, 'MarketWatch': 2, 'Korea Herald': 2, 'Infobae': 2, 'Foreign Affairs': 2, 'The Hill': 2, 'The Atlantic': 1, 'Times of Israel': 1, 'Reuters': 1, 'The Guardian': 1, 'WSJ': 1, 'Premium Times': 1, 'Daily Maverick': 1, 'NYT': 1 } },
    { at: '2026-06-13T18:00:00.000Z', count: 20, sources: { 'Times of Israel': 4, 'Kyiv Independent': 2, 'Caixin Global': 2, 'Foreign Affairs': 2, 'The Hill': 2, 'Infobae Colombia': 2, 'Foreign Policy': 1, 'Global Times': 1, 'The Moscow Times': 1, 'Mail & Guardian': 1, 'Forbes': 1, 'Daily Maverick': 1 } },
    { at: '2026-06-14T18:00:00.000Z', count: 20, sources: { 'The Hill': 3, 'Infobae': 3, 'The Bulwark': 2, 'MarketWatch': 2, 'Global Times': 2, 'Al Jazeera': 1, 'Daily Maverick': 1, 'The Guardian': 1, 'Premium Times': 1, 'Mail & Guardian': 1, 'The Korea Times': 1, 'The Hindu': 1, 'Indian Express': 1 } },
    { at: '2026-06-15T21:30:00.000Z', count: 20, sources: { 'Times of Israel': 2, 'Infobae': 3, 'Foreign Policy': 2, 'The Guardian': 2, 'Reuters': 1, 'WSJ': 1, 'The Bulwark': 1, 'UnHerd': 1, 'SCMP': 1, 'Global Times': 1, 'Foreign Affairs': 1, 'Al Jazeera': 1, 'MarketWatch': 1, 'Mail & Guardian': 1, 'PIIE': 1 } },
    { at: '2026-06-17T21:30:00.000Z', count: 20, sources: { 'SCMP': 5, 'China Daily': 4, 'Kyiv Independent': 3, 'Premium Times': 2, 'Times of Israel': 1, 'Forbes': 1, 'MarketWatch': 1, 'La Nación': 1, 'Foreign Policy': 1, 'The Hill': 1 } },
    { at: '2026-06-19T18:30:00.000Z', count: 20, sources: { 'The Hill': 3, 'Japan Times': 3, 'Al Jazeera': 2, 'Global Times': 2, 'Foreign Policy': 2, 'Foreign Affairs': 2, 'Times of Israel': 1, 'NYT': 1, 'The Atlantic': 1, 'UnHerd': 1, 'Premium Times': 1, 'Daily Maverick': 1 } },
    { at: '2026-06-20T18:00:00.000Z', count: 20, sources: { 'Foreign Affairs': 3, 'Premium Times Nigeria': 3, 'Foreign Policy': 2, 'The Bulwark': 2, 'Al Jazeera': 1, 'The Hill': 1, 'Times of Israel': 1, 'Kyiv Independent': 1, 'The Moscow Times': 1, 'Global Times': 1, 'Project Syndicate': 1, 'The Atlantic': 1, 'UnHerd': 1, 'MarketWatch': 1 } },
    { at: '2026-06-21T18:30:00.000Z', count: 20, sources: { 'Kyiv Independent': 4, 'SCMP': 4, 'El Tiempo': 2, 'Infobae': 2, 'Al Jazeera': 1, 'Times of Israel': 1, 'Le Monde': 1, 'The Hindu': 1, 'Global Times': 1, 'Premium Times': 1, 'The Hill': 1, 'The Atlantic': 1, 'Jerusalem Post': 1 } },
  ],
};

// Siembra los datos semilla solo si no hay histórico previo (no pisa datos del usuario).
function seedHistoryOnce() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) return; // ya hay datos: no tocar
    localStorage.setItem(HISTORY_KEY, JSON.stringify(HISTORY_SEED));
  } catch (_) { /* silencioso */ }
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) { return {}; }
}

// Registra un briefing. `section`: 'world' | 'spainOpinion' | 'spainNews'. `count`: nº de piezas.
// `breakdown`: objeto opcional { 'Medio': nº, ... } con el desglose por medio de ese briefing.
function recordHistory(section, count, breakdown, topics) {
  if (!section || typeof count !== 'number' || count <= 0) return;
  try {
    const hist = loadHistory();
    const list = Array.isArray(hist[section]) ? hist[section] : [];
    const entry = { count, at: new Date().toISOString() };
    if (breakdown && typeof breakdown === 'object') entry.sources = breakdown;
    if (topics && typeof topics === 'object') entry.topics = topics;
    list.push(entry);
    // Conserva solo los últimos HISTORY_MAX
    hist[section] = list.slice(-HISTORY_MAX);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
  } catch (_) { /* silencioso */ }
}

// Devuelve estadísticas de una sección: { count, average, min, max } o null si no hay datos.
function getHistoryStats(section) {
  try {
    const hist = loadHistory();
    const list = Array.isArray(hist[section]) ? hist[section] : [];
    if (list.length === 0) return null;
    const totals = list.map(x => Number(x.count) || 0);
    const sum = totals.reduce((a, b) => a + b, 0);
    return {
      count: list.length,
      average: Math.round((sum / list.length) * 10) / 10,
      min: Math.min(...totals),
      max: Math.max(...totals),
    };
  } catch (_) { return null; }
}

// Agrega el conteo por medio de una sección en los últimos `days` días.
// Devuelve { briefings, days, totals: [{source, total, avg}], rango } o null.
function getSourceTotals(section, days = 30) {
  try {
    const hist = loadHistory();
    const list = Array.isArray(hist[section]) ? hist[section] : [];
    if (list.length === 0) return null;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const recent = list.filter(x => {
      const t = x.at ? new Date(x.at).getTime() : 0;
      return t >= cutoff;
    });
    if (recent.length === 0) return null;
    const acc = {};
    let withBreakdown = 0;
    for (const e of recent) {
      if (e.sources && typeof e.sources === 'object') {
        withBreakdown++;
        for (const [s, n] of Object.entries(e.sources)) {
          acc[s] = (acc[s] || 0) + (Number(n) || 0);
        }
      }
    }
    const totals = Object.entries(acc)
      .map(([source, total]) => ({
        source,
        total,
        avg: withBreakdown > 0 ? Math.round((total / withBreakdown) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.total - a.total || a.source.localeCompare(b.source));
    return { briefings: withBreakdown, days, totals };
  } catch (_) { return null; }
}

function clearHistory() {
  try { localStorage.removeItem(HISTORY_KEY); } catch (_) { /* silencioso */ }
}

// Igual que getSourceTotals pero agrupando por TEMÁTICA (campo topics de cada briefing).
function getTopicTotals(section, days = 30) {
  try {
    const hist = loadHistory();
    const list = Array.isArray(hist[section]) ? hist[section] : [];
    if (list.length === 0) return null;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const recent = list.filter(x => (x.at ? new Date(x.at).getTime() : 0) >= cutoff);
    if (recent.length === 0) return null;
    const acc = {};
    let withBreakdown = 0;
    for (const e of recent) {
      if (e.topics && typeof e.topics === 'object') {
        withBreakdown++;
        for (const [t, n] of Object.entries(e.topics)) acc[t] = (acc[t] || 0) + (Number(n) || 0);
      }
    }
    if (withBreakdown === 0) return { briefings: 0, days, totals: [], noTopicData: true };
    const totals = Object.entries(acc)
      .map(([topic, total]) => ({ source: topic, total, avg: Math.round((total / withBreakdown) * 10) / 10 }))
      .sort((a, b) => b.total - a.total || a.source.localeCompare(b.source));
    return { briefings: withBreakdown, days, totals };
  } catch (_) { return null; }
}

// Agrupa el histórico por DÍA (cuántas piezas por fecha).
function getDailyTotals(section, days = 30) {
  try {
    const hist = loadHistory();
    const list = Array.isArray(hist[section]) ? hist[section] : [];
    if (list.length === 0) return null;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const recent = list.filter(x => (x.at ? new Date(x.at).getTime() : 0) >= cutoff);
    if (recent.length === 0) return null;
    const byDay = {};
    for (const e of recent) {
      if (!e.at) continue;
      const d = new Date(e.at);
      const key = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      byDay[key] = (byDay[key] || 0) + (Number(e.count) || 0);
    }
    const totals = Object.entries(byDay)
      .map(([day, total]) => ({ source: day, total, avg: null }))
      .sort((a, b) => {
        const [da, ma] = a.source.split('/').map(Number);
        const [db, mb] = b.source.split('/').map(Number);
        return (mb - ma) || (db - da); // más reciente primero
      });
    return { briefings: recent.length, days, totals, isDaily: true };
  } catch (_) { return null; }
}

// ============ FIN CACHE LOCALSTORAGE ============

const RECIPIENT = 'tonipons91@gmail.com';
const COOLDOWN_MS = 180 * 1000; // 180 segundos entre llamadas para no saturar el rate limit de Anthropic

const BRAND = {
  // ============ PALETA: RISOGRAPH VIBRANT (marfil + 4 tintas saturadas por sección) ============
  oxford: '#1A3FE6',           // Marca principal (Azul cobalto Riso) - solo logo
  bgGray: '#F4ECD4',           // Fondo (Marfil Riso)
  bgGrayDeep: '#ECE2C4',       // Variante para gradientes sutiles del fondo
  cardWhite: '#FFFCF2',        // Tarjetas marfil claro
  shadow: '4px 4px 0 rgba(22, 20, 15, 0.18)',
  shadowLg: '6px 6px 0 rgba(22, 20, 15, 0.22)',
  // Gradientes oficiales por bucket (Riso: tinta sólida → deep, sin blend modes)
  intlGrad: 'linear-gradient(90deg, #00A896, #007F70)',       // Noticias Internacional: teal
  worldNewsGrad: 'linear-gradient(90deg, #DB2777, #9D174D)',  // Noticias Internacional: fucsia/magenta
  worldOpinionGrad: 'linear-gradient(90deg, #0FA69D, #0A7A73)', // Opinión Internacional: teal
  opinionGrad: 'linear-gradient(90deg, #D6FF00, #A8CC00)',     // Opinión España: amarillo lima flúor
  newsGrad: 'linear-gradient(90deg, #F86040, #D63E1E)',        // Noticias España: coral
  // Colores sólidos para bordes/badges (start de cada gradiente)
  intlColor: '#00A896',        // teal
  opinionColor: '#D6FF00',     // amarillo lima flúor
  newsColor: '#F86040',        // coral
  worldOpinionColor: '#0FA69D',// teal

  // ============ ALIASES PARA RETROCOMPATIBILIDAD ============
  navy: '#1A3FE6',
  navyDeep: '#0028C2',
  card: '#FFFCF2',
  cardSubtle: 'rgba(255,252,242,0.95)',
  ink: '#16140F',
  inkSoft: 'rgba(22, 20, 15, 0.65)',
  orange: '#FF6B00',           // Naranja Riso vivo (usado en decoraciones y botón HOY)
  limeLight: '#C5CBA5',        // Fondo oliva/musgo (claro suave)
  limeDark: '#B2B98D',         // Fondo oliva/musgo (claro)
  // Lean badges (IZQ/DER indicador ideológico en algunas tarjetas)
  leftBlue: '#1A3FE6',
  rightRed: '#FF2D7A',
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
          <stop offset="0%" stopColor="#1E3A5F" />
          <stop offset="45%" stopColor="#0D2340" />
          <stop offset="100%" stopColor="#04101F" />
        </radialGradient>
        {/* Anillo arcoíris */}
        <linearGradient id="malRing" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FA4E3F" />
          <stop offset="25%" stopColor="#FFCD00" />
          <stop offset="50%" stopColor="#00FA8C" />
          <stop offset="75%" stopColor="#2DD4FF" />
          <stop offset="100%" stopColor="#B14BFF" />
        </linearGradient>
        {/* Disco verde radial (fondo del logo B) */}
        <radialGradient id="malDisc" cx="35%" cy="30%" r="85%">
          <stop offset="0%" stopColor="#5EFFB0" />
          <stop offset="45%" stopColor="#00E88C" />
          <stop offset="100%" stopColor="#0AA890" />
        </radialGradient>
        {/* Picos de la M (montañas de colores) */}
        <linearGradient id="malPeakL" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1A6FE0" />
          <stop offset="100%" stopColor="#0D2340" />
        </linearGradient>
        <linearGradient id="malPeakR" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FA4E3F" />
          <stop offset="100%" stopColor="#B31500" />
        </linearGradient>
      </defs>

      {/* Fondo gris humo con esquinas redondeadas */}
      <rect x="0" y="0" width="600" height="210" fill="#5B57A8" rx="10" />

      {/* Bloque índigo con corte diagonal */}
      <path d="M 0 0 L 280 0 L 200 210 L 0 210 Z" fill="#312E81" />

      {/* Línea naranja siguiendo el corte diagonal */}
      <line x1="280" y1="0" x2="200" y2="210" stroke="#FADD00" strokeWidth="4" />

      {/* Logo B — disco verde + M de montañas de colores */}
      <g transform="translate(110, 105)">
        {/* Anillo arcoíris exterior */}
        <circle r="52" fill="none" stroke="url(#malRing)" strokeWidth="4" strokeLinecap="round" />
        {/* Disco verde radial */}
        <circle r="47" fill="url(#malDisc)" />
        {/* M de montañas: pico izquierdo azul, derecho coral, centro oscuro */}
        <g transform="scale(0.16) translate(-256, -256)">
          <polygon points="150,300 150,120 256,300" fill="url(#malPeakL)" />
          <polygon points="256,300 256,120 362,300" fill="url(#malPeakR)" />
          <polygon points="150,120 256,300 256,120" fill="#0D2340" opacity="0.9" />
        </g>
        {/* Sol/punto amarillo */}
        <circle cx="-30" cy="-26" r="7" fill="#FFCD00" />
      </g>

      {/* Zona derecha: día en serif Georgia */}
      <text x="305" y="70" fontFamily="Georgia, 'Times New Roman', serif" fontStyle="italic" fontSize="42" fill="#FFFFFF">
        {dayName}
      </text>

      {/* Día número grande naranja + mes en azul */}
      <text x="320" y="108" fontFamily="'Verdana', 'Geneva', sans-serif" fontWeight="900" fontSize="34" fill="#FA4E3F" letterSpacing="-0.02em">
        {dayNumber}
        <tspan fontSize="17" fill="#FFFFFF" fontWeight="700" dx="8">{month}</tspan>
      </text>

      {/* Año con letterspacing amplio */}
      <text x="320" y="134" fontFamily="'Verdana', sans-serif" fontWeight="700" fontSize="13" fill="#C7C4E8" letterSpacing="0.32em">{year}</text>

      {/* Separador sutil */}
      <line x1="320" y1="156" x2="575" y2="156" stroke="#FFFFFF" strokeWidth="0.5" opacity="0.3" />

      {/* Sub-etiquetas en dos líneas con color diferenciado */}
      <text x="320" y="176" fontFamily="'Verdana', sans-serif" fontStyle="italic" fontSize="11" fill="#D4D2F0" letterSpacing="0.16em">ESPAÑA · OPINIÓN</text>
      <text x="320" y="194" fontFamily="'Verdana', sans-serif" fontStyle="italic" fontSize="11" fill="#D4D2F0" letterSpacing="0.16em">MUNDO · INTERNACIONAL</text>
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
  // ============ ESPAÑA — FAVORITOS DEL USUARIO (matching gradiente Opinión) ============
  'Vozpópuli': '#65A30D',         // ⭐⭐ VERDE LIMA (favorito, matching opinion gradient start)
  'The Objective': '#FACC15',     // ⭐⭐ AMARILLO/GOLD (favorito, matching opinion gradient end)
  'Demócrata': '#0EA5E9',         // ⭐ AZUL CIELO (alternativa)

  // ============ ESPAÑA OPINIÓN ============
  'Artículo 14': '#0F766E',       // teal oscuro
  'Libertad Digital': '#1E40AF',  // azul oscuro
  'La Gaceta': '#7C2D12',         // marrón rojizo (derecha tradicional)
  'El Debate': '#9333EA',         // morado
  'Agenda Pública': '#475569',    // gris pizarra
  'El Blog Salmón': '#FB7185',    // salmón rosado (literal)
  'Economía de Mallorca': '#0891B2', // turquesa
  'Ethic': '#581C87',                // púrpura intelectual
  'Letras Libres': '#4A5568',        // gris elegante editorial

  // ============ ESPAÑA NOTICIAS (medios paywall en rojo/granate) ============
  'El País': '#D32F2F',           // rojo País
  'El Mundo': '#9B0000',           // granate El Mundo
  'ABC': '#1A365D',                // azul oscuro ABC
  'El Español': '#E11D48',         // rojo Español
  'Cinco Días': '#7F1D1D',         // granate financiero

  // ============ IZQUIERDA (gratis) ============
  'elDiario.es': '#DC2626',        // rojo eDS
  'Huffington Post': '#10B981',    // verde HuffPost
  'Público': '#EF4444',            // rojo Público

  // ============ OK DIARIO (naranja/dorado) ============
  'OK Diario': '#F59E0B',
  'OK Diario Baleares': '#F59E0B',

  // ============ REGIONALES BALEARES ============
  'elDiario.es Baleares': '#DC2626',
  'El Debate Baleares': '#9333EA',

  // ============ CATALANES ============
  'Crónica Global': '#475569',     // gris azulado (constitucionalista)
  'El Nacional.cat': '#FACC15',    // amarillo (color independentista catalán)

  // ============ ECONÓMICO ============
  'Invertia': '#0891B2',           // turquesa financiero
  'almendron': '#FB923C',

  // ============ INTERNACIONAL ============
  'NYT': '#0A0A0A', 'New York Times': '#0A0A0A',
  'WSJ': '#DA251D', 'Wall Street Journal': '#DA251D',
  'FT': '#FFF1E5', 'Financial Times': '#FFF1E5',  // beige FT
  'Guardian': '#052962', 'The Guardian': '#052962',
  'BBC': '#BB1919',
  'Reuters': '#D97706',
  'AP': '#171717', 'Associated Press': '#171717',
  'MarketWatch': '#00B043',
  'Bloomberg': '#FA6900',
  'Economist': '#E3120B', 'The Economist': '#E3120B',
  'Le Monde': '#003366',
  'Le Figaro': '#005DAA',
  'Der Spiegel': '#B91C1C',        // rojo característico Spiegel
  'La Repubblica': '#BE123C',      // rosa-rojo La Repubblica
  'The Times': '#1E3A8A',          // azul navy Times establishment
  'Hindu': '#1F3864', 'The Hindu': '#1F3864',
  'Times of Israel': '#0F4C81',
  'Haaretz': '#103D6E',
  'Politico': '#E11D48',
  'Atlantic': '#0F2D52', 'The Atlantic': '#0F2D52',
  'Washington Post': '#0E1828', 'WaPo': '#0E1828',
  // China
  'SCMP': '#B59E5F',               // dorado SCMP
  'South China Morning Post': '#B59E5F',
  'Caixin': '#C8102E',
  'Global Times': '#DC2626',
  'China Daily': '#DA251D',
  'Sixth Tone': '#27AE60',
  // Corea
  'Korea Herald': '#003876',
  'Korea Times': '#1B3B6F',
  'Korea JoongAng Daily': '#C8102E',
  'Hankyoreh': '#1976D2',
  // Singapur
  'Channel News Asia': '#E60028', 'CNA': '#E60028',
  'The Business Times': '#003F87',
  // Indonesia
  'Jakarta Post': '#0066B3',
  'Jakarta Globe': '#005EB8',
  'Tempo': '#D70026',
  // LATAM
  'Clarín': '#E2231A',
  'Infobae': '#3B82F6',
  'El Espectador': '#005D8F',
  'El Mercurio': '#0D2C54',
  'El Faro': '#831843',            // vino oscuro · Pulitzer investigativo El Salvador
  'Confidencial': '#0D9488',       // teal · Chamorro Nicaragua/exilio CR
  'Animal Político': '#BE185D',    // magenta · investigativo independiente México
  // 🇺🇸 USA conservador heterodoxo
  'The Bulwark': '#4338CA',        // indigo · nunca-trumpista intelectual
  // Otros
  'UnHerd': '#0066CC',
  'The Spectator': '#990000',
  'Kyiv Independent': '#0057B7',
  'Moscow Times': '#1F2937',
  'Daily Maverick': 'linear-gradient(135deg, #18181B 0%, #18181B 60%, #C8102E 60%, #C8102E 100%)',
  'Mail & Guardian': '#E60012',
  'Africa Report': '#9B2335',
  'Premium Times': '#003366',
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

// Devuelve el color de texto óptimo (blanco o negro) según luminancia del fondo
// Necesario para fondos amarillos/claros donde texto blanco no se lee.
function getReadableTextColor(bgHex) {
  if (!bgHex || !bgHex.startsWith('#')) return '#FFFFFF';
  const hex = bgHex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  // Fórmula luminancia relativa (W3C)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#1A1A1A' : '#FFFFFF';
}

// Calcula tiempo de lectura en minutos basado en title + summary
// Aproximación: 1000 caracteres ≈ 1 minuto de lectura cómoda
function calculateReadTime(item) {
  const isLong = item._forcedLong || item._detectedLong;
  const source = (item.source || '').toLowerCase();

  // Categorización por medio
  // Medios que publican piezas muy largas habitualmente (10-15 min normal)
  const isHeavyLongform = /\b(nyt|new york times|the atlantic|atlantic|financial times|\bft\b|economist|foreign affairs|foreign policy|new yorker|washington post|wapo|le monde)\b/i.test(source);

  // Medios con reportajes medianos cuando son LARGA (6-9 min)
  const isMediumLongform = /\b(voz|the objective|el país|el mundo|el confidencial|libertad digital|la gaceta|eldiario|p[uú]blico|huffington|\babc\b|el español|el debate|demócrata)\b/i.test(source);

  // Agencias de cable - artículos siempre breves
  const isBrief = /\b(ap|associated press|efe|europa press|reuters|yonhap|antara|xinhua)\b/i.test(source);

  // Medios de análisis económico/político (longitud media-alta)
  const isAnalysis = /\b(bloomberg|cinco días|invertia|project syndicate|el blog salm[oó]n|economía de mallorca|marketwatch|forbes|quartz|nikkei)\b/i.test(source);

  // Base en minutos según categoría + LARGA flag
  let baseMinutes;
  if (isLong) {
    if (isHeavyLongform) baseMinutes = 12;       // NYT/Atlantic/FT reportajes
    else if (isMediumLongform) baseMinutes = 7;  // Vozpópuli/TO/EP reportajes
    else baseMinutes = 6;                          // Resto LARGAS
  } else {
    if (isBrief) baseMinutes = 2;                  // Cables AP/Reuters
    else if (isAnalysis) baseMinutes = 4;          // Bloomberg/Cinco Días
    else if (isHeavyLongform) baseMinutes = 5;     // NYT no-LARGA aún es algo largo
    else baseMinutes = 3;                          // Resto normal
  }

  // Modificador por longitud del summary disponible (más rico = artículo más largo probable)
  const summaryChars = (item.summary || '').length;
  if (summaryChars > 250) baseMinutes += 2;
  else if (summaryChars > 150) baseMinutes += 1;

  // Variación estable basada en hash de la URL (siempre devuelve el mismo número para la misma pieza)
  const text = item.url || item.title || '';
  const hash = text.split('').reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0);
  const variance = (Math.abs(hash) % 3) - 1; // -1, 0, +1

  return Math.max(1, baseMinutes + variance);
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

// Agrupa items por su campo source, preservando el orden de primera aparición
// Orden de prioridad de medios en OPINIÓN ESPAÑA (los primeros aparecen arriba)
const OPINION_SOURCE_PRIORITY = [
  'Vozpópuli',
  'The Objective',
  'Artículo 14',
  'Libertad Digital',
  'La Gaceta',
  'El Debate',
  'El Mundo',
  'ABC',
  'El País',
  'elDiario.es',
  'Público',
  'Huffington Post',
  'Ethic',
  'Letras Libres',
  'Agenda Pública',
  'Crónica Global',
  'El Nacional.cat',
  'Cinco Días',
];

function groupBySource(items, priorityOrder = null) {
  if (!Array.isArray(items)) return [];
  const map = new Map();
  for (const item of items) {
    const key = item.source || '—';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  let groups = Array.from(map.entries()).map(([source, items]) => ({ source, items }));

  // Si se pasa un orden de prioridad, ordenar los bloques según él
  if (priorityOrder && priorityOrder.length > 0) {
    const rank = (src) => {
      const idx = priorityOrder.indexOf(src);
      return idx === -1 ? 999 : idx;  // los no listados van al final
    };
    groups = groups.sort((a, b) => rank(a.source) - rank(b.source));
  }
  return groups;
}

// Orden fijo de temas por sección (para que los grupos salgan siempre en el mismo orden)
const TOPIC_ORDER = {
  spainNews:    ['Economía', 'Entrevistas', 'País', 'Política', 'Tecnología', 'Cultura', 'Baleares'],
  spainOpinion: ['Centro', 'Izquierda', 'Derecha', 'El Mundo', 'Cataluña'],
  worldNews:    ['Economía', 'Geopolítica', 'Tecnología', 'Lecturas', 'Entrevistas', 'Asia', 'LATAM/Europa'],
  worldOpinion: ['Economía/IA', 'Geopolítica', 'Anglo', 'LATAM', 'Europa/Asia'],
};
// Iconos por tema
const TOPIC_ICONS = {
  'Economía': '💰', 'Entrevistas': '🎤', 'País': '🇪🇸', 'Política': '🏛️',
  'Tecnología': '🔬', 'Cultura': '🎭', 'Baleares': '🏝️', 'Geopolítica': '🌐',
  'Lecturas': '📖', 'Asia': '🌏', 'LATAM/Europa': '🌎', 'Economía/IA': '📊',
  'Anglo': '🗽', 'LATAM': '🌎', 'Europa/Asia': '🇪🇺',
  'Centro': '⚪', 'Izquierda': '🔴', 'Derecha': '🔵', 'El Mundo': '📰', 'Cataluña': '🏛️',
};

// Agrupa piezas por su campo `topic`. Si una pieza no trae topic, cae en "Otros".
// Ordena los grupos según TOPIC_ORDER[historyKey]; los temas no listados van al final.
function groupByTopic(items, historyKey) {
  if (!Array.isArray(items)) return [];
  const map = new Map();
  for (const item of items) {
    const key = (item.topic && String(item.topic).trim()) || 'Otros';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  const order = TOPIC_ORDER[historyKey] || [];
  const rank = (t) => {
    const idx = order.indexOf(t);
    return idx === -1 ? 999 : idx;
  };
  return Array.from(map.entries())
    .map(([topic, items]) => ({ topic, items }))
    .sort((a, b) => rank(a.topic) - rank(b.topic));
}

// MEDIAGROUP · Diseño C minimalista
// - Borde lateral izquierdo: COLOR DE LA SECCIÓN (Opinión/Noticias/Internacional)
// - Cabecera con fondo: COLOR DE IDENTIDAD del medio (Vozpópuli, El País, etc.)
// - Lista de noticias en formato minimalista (sin imágenes, jerarquía tipográfica)
function MediaGroup({ source, items, sectionColor, type, groupIndex }) {
  const isOpinion = type === 'opinion';
  const sourceColor = getSourceColor(source);
  // Si el color es un gradiente (linear-gradient), usar texto blanco; si no, calcular luminancia
  const isGradient = sourceColor.startsWith('linear-gradient');
  const textColor = isGradient ? '#FFFFFF' : getReadableTextColor(sourceColor);
  const pieceCount = items.length;
  const pieceLabel = isOpinion
    ? (pieceCount === 1 ? 'COLUMNA' : 'COLUMNAS')
    : (pieceCount === 1 ? 'PIEZA' : 'PIEZAS');

  return (
    <div style={{
      borderLeft: `5px solid ${sectionColor}`,
      paddingLeft: '14px',
      marginBottom: '22px',
      animation: `fadeSlide 0.35s ease ${Math.min(groupIndex * 0.05, 0.4)}s both`,
    }}>
      {/* HEADER del medio: fondo en su color de identidad + texto legible */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: sourceColor,
        color: textColor,
        padding: '5px 10px',
        marginBottom: '12px',
        marginLeft: '-2px',
        borderRadius: '3px',
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
        boxShadow: textColor === '#1A1A1A' ? 'inset 0 0 0 1px rgba(0,0,0,0.1)' : 'none',
      }}>
        <span style={{
          fontSize: '11px',
          fontWeight: '800',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
        }}>
          {source}
        </span>
        <span style={{
          fontSize: '9px',
          fontWeight: '600',
          opacity: textColor === '#1A1A1A' ? 0.7 : 0.9,
          letterSpacing: '0.05em',
        }}>
          {pieceCount} {pieceLabel}
        </span>
      </div>

      {/* LISTA de piezas del medio */}
      {items.map((item, i) => {
        const dateBadge = formatDateBadge(item.publishedDate);
        const readTime = calculateReadTime(item);
        const isLastItem = i === items.length - 1;

        return (
          <article key={i} style={{
            paddingBottom: isLastItem ? '0' : '14px',
            marginBottom: isLastItem ? '0' : '14px',
            borderBottom: isLastItem ? 'none' : '1px solid #EEE',
          }}>
            {/* Badges minimalistas inline */}
            {(item._isPaywall || item._forcedLong || item._detectedLong || dateBadge) && (
              <div style={{
                display: 'flex',
                gap: '6px',
                marginBottom: '5px',
                flexWrap: 'wrap',
                alignItems: 'center',
                fontFamily: "'Helvetica Neue', Arial, sans-serif",
              }}>
                {item._isPaywall && isUserSubscribed(item.source) ? (
                  <span style={{
                    fontSize: '9px',
                    color: '#15803D',
                    background: 'rgba(21,128,61,0.10)',
                    padding: '1px 5px',
                    borderRadius: '2px',
                    fontWeight: '700',
                  }}>
                    ✓ ACCESO
                  </span>
                ) : item._isPaywall && item._isPressReader && (typeof window !== 'undefined' && window.__pressReaderEnabled) ? (
                  <span style={{
                    fontSize: '9px',
                    color: '#0891B2',
                    background: 'rgba(8,145,178,0.10)',
                    padding: '1px 5px',
                    borderRadius: '2px',
                    fontWeight: '700',
                  }}>
                    📚 PRESSREADER
                  </span>
                ) : item._isPaywall && (
                  <span style={{
                    fontSize: '9px',
                    color: '#D43131',
                    background: 'rgba(212,49,49,0.08)',
                    padding: '1px 5px',
                    borderRadius: '2px',
                    fontWeight: '700',
                  }}>
                    🔒 PAGO
                  </span>
                )}
                {(item._forcedLong || item._detectedLong) && (
                  <span style={{
                    fontSize: '9px',
                    color: '#65A30D',
                    background: 'rgba(101,163,13,0.08)',
                    padding: '1px 5px',
                    borderRadius: '2px',
                    fontWeight: '700',
                  }}>
                    📊 LARGA
                  </span>
                )}
                {dateBadge && (
                  <span style={{
                    fontSize: '9px',
                    color: '#888',
                    letterSpacing: '0.05em',
                  }}>
                    {dateBadge}
                  </span>
                )}
                <span style={{
                  fontSize: '9px',
                  color: '#888',
                  marginLeft: 'auto',
                  letterSpacing: '0.03em',
                }}>
                  {readTime} min
                </span>
              </div>
            )}

            {/* Título */}
            {item.url ? (
              <a href={item.url} target="_blank" rel="noopener noreferrer"
                style={{ textDecoration: 'none', color: 'inherit' }}>
                <h3 style={{
                  margin: '0 0 5px',
                  fontFamily: "'Helvetica Neue', Arial, sans-serif",
                  fontSize: isOpinion ? '14.5px' : '14.5px',
                  fontWeight: '600',
                  color: '#1A1A1A',
                  lineHeight: 1.3,
                  letterSpacing: '-0.005em',
                  cursor: 'pointer',
                }}>
                  {item.title}
                </h3>
              </a>
            ) : (
              <h3 style={{
                margin: '0 0 5px',
                fontFamily: "'Helvetica Neue', Arial, sans-serif",
                fontSize: '14.5px',
                fontWeight: '600',
                color: '#1A1A1A',
                lineHeight: 1.3,
              }}>
                {item.title}
              </h3>
            )}

            {/* Resumen */}
            {item.summary && (
              <p style={{
                margin: '0',
                fontFamily: "'Helvetica Neue', Arial, sans-serif",
                fontSize: '11.5px',
                lineHeight: 1.5,
                color: '#666',
                fontStyle: isOpinion ? 'italic' : 'normal',
              }}>
                {item.summary}
              </p>
            )}

            {/* Autor (opinión) */}
            {isOpinion && item.author && (
              <p style={{
                margin: '4px 0 0',
                fontFamily: "'Helvetica Neue', Arial, sans-serif",
                fontSize: '10.5px',
                color: sourceColor,
                fontWeight: '600',
                letterSpacing: '0.02em',
              }}>
                — {item.author}
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}

// LEGACY: mantenemos NewsCard para retrocompat, aunque ya no se usa por defecto
function NewsCard({ item, index, sectionColor, type, isLead }) {
  const isOpinion = type === 'opinion';
  const sourceColor = getSourceColor(item.source);
  const dateBadge = formatDateBadge(item.publishedDate);
  const readTime = calculateReadTime(item);
  const hasImage = !!item.image;

  // Estilo LEAD: primera pieza, más grande, foto arriba
  // Estilo NORMAL: resto, compacto, foto pequeña a la derecha
  return (
    <article style={{
      background: BRAND.card,
      borderTop: isLead ? `3px solid ${sectionColor}` : 'none',
      borderLeft: isLead ? 'none' : `3px solid ${sectionColor}`,
      borderRadius: '6px',
      padding: isLead ? '0' : '10px 12px',
      marginBottom: isLead ? '14px' : '8px',
      boxShadow: BRAND.shadow,
      animation: `fadeSlide 0.35s ease ${Math.min(index * 0.03, 0.5)}s both`,
      overflow: 'hidden',
    }}>
      {/* IMAGEN LEAD arriba */}
      {isLead && hasImage && (
        <a href={item.url} target="_blank" rel="noopener noreferrer">
          <img
            src={item.image}
            alt={item.title}
            loading="lazy"
            style={{
              width: '100%',
              height: '180px',
              objectFit: 'cover',
              display: 'block',
            }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </a>
      )}

      <div style={{ padding: isLead ? '12px 14px 14px' : '0', display: 'flex', gap: '10px' }}>
        {/* IMAGEN NORMAL al lado derecho */}
        {!isLead && hasImage && (
          <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0 }}>
            <img
              src={item.image}
              alt=""
              loading="lazy"
              style={{
                width: '70px',
                height: '70px',
                objectFit: 'cover',
                borderRadius: '4px',
                display: 'block',
              }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </a>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* TOP ROW: Badges */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap',
            marginBottom: '6px',
          }}>
            {item.source && (
              <span style={{
                background: sourceColor, color: 'white',
                fontSize: '8.5px', fontWeight: '800',
                letterSpacing: '0.08em',
                padding: '2px 7px', borderRadius: '3px',
                fontFamily: "'Verdana', 'Geneva', sans-serif",
                textTransform: 'uppercase',
              }}>
                {item.source}
              </span>
            )}

            {item._isPaywall && isUserSubscribed(item.source) ? (
              <span title="Acceso directo · suscripción propia" style={{
                background: 'rgba(21,128,61,0.12)', color: '#15803D',
                border: '1px solid rgba(21,128,61,0.30)',
                fontSize: '9px', fontWeight: '700',
                padding: '2px 5px', borderRadius: '3px',
                fontFamily: "'Verdana', 'Geneva', sans-serif",
              }}>
                ✓
              </span>
            ) : item._isPaywall && item._isPressReader && (typeof window !== 'undefined' && window.__pressReaderEnabled) ? (
              <span title="Disponible en PressReader" style={{
                background: 'rgba(8,145,178,0.12)', color: '#0891B2',
                border: '1px solid rgba(8,145,178,0.30)',
                fontSize: '9px', fontWeight: '700',
                padding: '2px 5px', borderRadius: '3px',
                fontFamily: "'Verdana', 'Geneva', sans-serif",
              }}>
                📚
              </span>
            ) : item._isPaywall && (
              <span title="Requiere suscripción" style={{
                background: 'rgba(212,49,49,0.12)', color: '#D43131',
                border: '1px solid rgba(212,49,49,0.30)',
                fontSize: '9px', fontWeight: '700',
                padding: '2px 5px', borderRadius: '3px',
                fontFamily: "'Verdana', 'Geneva', sans-serif",
              }}>
                🔒
              </span>
            )}

            {(item._forcedLong || item._detectedLong) && (
              <span title="Pieza larga" style={{
                background: 'rgba(101,163,13,0.12)', color: '#65A30D',
                border: '1px solid rgba(101,163,13,0.30)',
                fontSize: '9px', fontWeight: '700',
                padding: '2px 5px', borderRadius: '3px',
                fontFamily: "'Verdana', 'Geneva', sans-serif",
              }}>
                📊 LARGA
              </span>
            )}

            {dateBadge && (
              <span style={{
                background: 'rgba(26,54,93,0.06)', color: 'rgba(26,54,93,0.65)',
                fontSize: '8.5px', fontWeight: '700',
                letterSpacing: '0.06em',
                padding: '2px 6px', borderRadius: '3px',
                fontFamily: "'Verdana', 'Geneva', sans-serif",
              }}>
                {dateBadge}
              </span>
            )}

            <span style={{
              fontSize: '8.5px', color: '#94704A',
              fontWeight: '600', letterSpacing: '0.04em',
              fontFamily: "'Verdana', 'Geneva', sans-serif",
              marginLeft: 'auto',
            }}>
              {readTime} min
            </span>

            {item.lean && (
              <LeanBadge lean={item.lean} />
            )}
          </div>

          {/* TÍTULO SERIF EDITORIAL */}
          {item.url ? (
            <a href={item.url} target="_blank" rel="noopener noreferrer"
              style={{ textDecoration: 'none', color: 'inherit' }}>
              <h3 style={{
                margin: '0 0 6px',
                fontSize: isLead ? '17px' : (isOpinion ? '14.5px' : '13.5px'),
                fontFamily: "'Georgia', 'Times New Roman', serif",
                fontWeight: '600',
                color: BRAND.navyDeep,
                lineHeight: 1.25,
                letterSpacing: '-0.005em',
                cursor: 'pointer',
              }}>
                {item.title}
              </h3>
            </a>
          ) : (
            <h3 style={{
              margin: '0 0 6px',
              fontSize: isLead ? '17px' : (isOpinion ? '14.5px' : '13.5px'),
              fontFamily: "'Georgia', 'Times New Roman', serif",
              fontWeight: '600',
              color: BRAND.navyDeep,
              lineHeight: 1.25,
            }}>
              {item.title}
            </h3>
          )}

          {/* RESUMEN SERIF EDITORIAL */}
          {item.summary && (
            <p style={{
              margin: '0 0 6px',
              fontSize: isLead ? '12.5px' : '11.5px',
              color: BRAND.inkSoft,
              lineHeight: 1.55,
              fontFamily: "'Georgia', 'Times New Roman', serif",
              fontStyle: isOpinion ? 'italic' : 'normal',
              display: '-webkit-box',
              WebkitLineClamp: isLead ? 4 : (isOpinion ? 2 : 3),
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
              {item.summary}
            </p>
          )}

          {/* FOOTER */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            gap: '8px', fontSize: '10px', color: BRAND.navyDeep,
            fontFamily: "'Georgia', 'Times New Roman', serif",
          }}>
            <span style={{ fontStyle: 'italic', fontWeight: '500', opacity: 0.75 }}>
              {isOpinion && item.author && `— ${item.author}`}
              {!isOpinion && item.region && item.region}
            </span>
            {item.url && (
              <a href={item.url} target="_blank" rel="noopener noreferrer"
                style={{
                  color: sectionColor,
                  textDecoration: 'none',
                  borderBottom: `1px dotted ${sectionColor}`,
                  fontWeight: '700',
                  fontSize: '10px',
                  whiteSpace: 'nowrap',
                  fontFamily: "'Verdana', 'Geneva', sans-serif",
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                leer →
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function Section({ title, icon, items, color, gradient, count, descriptor, type, note, meta, groupByContinent, historyKey, editorNote }) {
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

        {/* Apunte del editor: análisis de los temas clave del día */}
        {editorNote && (
          <div style={{
            marginTop: '12px',
            padding: '12px 14px',
            background: 'rgba(255,255,255,0.16)',
            border: '1px solid rgba(255,255,255,0.32)',
            borderLeft: '4px solid rgba(255,255,255,0.7)',
            borderRadius: '8px',
            fontSize: '12.5px',
            fontFamily: "'Crimson Pro', Georgia, serif",
            lineHeight: 1.5,
            color: 'white',
          }}>
            <div style={{
              fontSize: '10px', fontWeight: '800', letterSpacing: '0.12em',
              textTransform: 'uppercase', opacity: 0.85, marginBottom: '5px',
              fontFamily: "'Space Mono', monospace",
            }}>
              ✦ Apunte del editor
            </div>
            {editorNote}
          </div>
        )}

        {/* Panel CONTADOR POR REGIÓN (solo si meta tiene regionCounts) */}
        {meta?.regionCounts && Object.keys(meta.regionCounts).length > 0 && (
          <div style={{
            marginTop: '10px',
            padding: '8px 12px',
            background: 'rgba(255,255,255,0.20)',
            border: '1px solid rgba(255,255,255,0.40)',
            borderRadius: '8px',
            fontSize: '10.5px',
            fontFamily: "'Verdana', sans-serif",
            color: 'white',
            backdropFilter: 'blur(8px)',
          }}>
            <div style={{
              fontWeight: '800',
              letterSpacing: '0.06em',
              marginBottom: '6px',
              fontSize: '10.5px',
            }}>
              🌐 PIEZAS POR REGIÓN
            </div>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px 10px',
              lineHeight: 1.6,
            }}>
              {Object.entries(meta.regionCounts)
                .filter(([_, count]) => count > 0)
                .sort((a, b) => b[1] - a[1])
                .map(([region, count]) => {
                  const min = (meta.regionMin && meta.regionMin[region]) || 0;
                  const isBelow = min > 0 && count < min;
                  return (
                    <span key={region} style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 8px',
                      background: isBelow ? 'rgba(220,38,38,0.30)' : 'rgba(255,255,255,0.12)',
                      borderRadius: '4px',
                      fontWeight: '700',
                      border: isBelow ? '1px solid rgba(220,38,38,0.50)' : '1px solid transparent',
                    }}>
                      <span>{region}</span>
                      <span style={{ fontWeight: '800' }}>{count}{min > 0 ? `/${min}` : ''}</span>
                    </span>
                  );
                })}
            </div>
            {meta.regionWarnings && meta.regionWarnings.length > 0 && (
              <div style={{
                marginTop: '6px',
                fontSize: '10px',
                opacity: 0.92,
                fontStyle: 'italic',
              }}>
                ⚠️ Faltan mínimos: {meta.regionWarnings.map(w => `${w.region} (${w.current}/${w.min})`).join(' · ')}
              </div>
            )}
          </div>
        )}

        {/* Media histórica local (localStorage) */}
        {historyKey && (() => {
          const stats = getHistoryStats(historyKey);
          if (!stats || stats.count < 2) return null;
          return (
            <div style={{
              marginTop: '10px',
              padding: '6px 12px',
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '8px',
              fontSize: '11px',
              fontFamily: "'Verdana', sans-serif",
              color: 'white',
            }}>
              📈 Media de tus últimos {stats.count} briefings: <strong>{stats.average}</strong> piezas · rango {stats.min}–{stats.max}
            </div>
          );
        })()}

        {/* Panel de diagnóstico de feeds DENTRO de la cabecera — visible inmediatamente al cargar */}
        {meta?.feedDiagnostic && meta.feedDiagnostic.length > 0 && (
          <details style={{
            marginTop: '12px',
            padding: '10px 14px',
            background: 'rgba(11,32,51,0.82)',
            border: '1px solid rgba(127,255,212,0.4)',
            borderRadius: '8px',
            fontSize: '11px',
            fontFamily: "'Verdana', sans-serif",
            color: 'white',
            backdropFilter: 'blur(8px)',
          }}>
            <summary style={{
              cursor: 'pointer',
              fontWeight: '800',
              color: '#7FFFD4',
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
                      background: included === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(127,255,212,0.12)',
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
                        <strong style={{ color: '#7FFFD4', fontSize: '11px', minWidth: '105px', fontWeight: '700' }}>
                          {statusIcon} {d.source} {d.urlsCount > 1 && <em style={{ opacity: 0.6, fontSize: '9.5px', fontWeight: '600' }}>· {d.urlsCount} URLs</em>}
                        </strong>
                        <span style={{ color: 'rgba(255,255,255,0.92)', fontSize: '10px', flex: 1, textAlign: 'right' }}>
                          {d.rawCount === 0
                            ? <em style={{ color: 'rgba(127,255,212,0.75)' }}>⚠️ todas las URLs vacías ▼</em>
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
          // Render agrupado por continentes Y dentro por medio
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
              {/* Dentro de cada continente, AGRUPAR por medio */}
              {groupBySource(group.items).map((mediaGroup, mgi) => (
                <MediaGroup
                  key={`${group.continent}-${mediaGroup.source}`}
                  source={mediaGroup.source}
                  items={mediaGroup.items}
                  sectionColor={color}
                  type={type}
                  groupIndex={mgi}
                />
              ))}
            </div>
          ))
        ) : (() => {
          // OPINIÓN: siempre por MEDIO (agrupar opinión por "tema" ideológico queda raro
          // y genera un grupo "Otros" feo). El agrupado por TEMA es solo para NOTICIAS.
          // NOTICIAS: por tema si las piezas traen topic; si no (fallback), por medio.
          const withTopic = items.filter(it => it && it.topic && String(it.topic).trim()).length;
          const useTopics = type !== 'opinion' && withTopic >= Math.ceil(items.length / 2);
          if (!useTopics) {
            return groupBySource(items, type === 'opinion' ? OPINION_SOURCE_PRIORITY : null).map((mediaGroup, mgi) => (
              <MediaGroup key={mediaGroup.source} source={mediaGroup.source} items={mediaGroup.items} sectionColor={color} type={type} groupIndex={mgi} />
            ));
          }
          return groupByTopic(items, historyKey).map((topicGroup, tgi) => (
            <div key={topicGroup.topic} style={{ marginBottom: '14px' }}>
              <div style={{
                margin: '8px 4px 6px',
                padding: '6px 12px',
                background: `linear-gradient(90deg, ${color}18, transparent)`,
                borderLeft: `3px solid ${color}`,
                borderRadius: '4px',
                fontFamily: "'Verdana', 'Geneva', sans-serif",
                fontSize: '12px',
                fontWeight: '700',
                color: '#16140F',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <span style={{ fontSize: '15px' }}>{TOPIC_ICONS[topicGroup.topic] || '📄'}</span>
                <span>{topicGroup.topic}</span>
                <span style={{ opacity: 0.6, fontWeight: '500' }}>· {topicGroup.items.length}</span>
              </div>
              {groupBySource(topicGroup.items, type === 'opinion' ? OPINION_SOURCE_PRIORITY : null).map((mediaGroup, mgi) => (
                <MediaGroup
                  key={`${topicGroup.topic}-${mediaGroup.source}`}
                  source={mediaGroup.source}
                  items={mediaGroup.items}
                  sectionColor={color}
                  type={type}
                  groupIndex={mgi}
                />
              ))}
            </div>
          ));
        })()}

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

  // PressReader: si el usuario tiene acceso (vía biblioteca o suscripción)
  // hace que los medios disponibles allí se marquen con 📚 verde en vez de 🔒 PAGO
  const [pressReaderEnabled, setPressReaderEnabled] = useState(loadPressReaderEnabled());
  const [showChangelog, setShowChangelog] = useState(false);
  const [changelogQuery, setChangelogQuery] = useState('');
  const [showStats, setShowStats] = useState(false);
  const [statsSection, setStatsSection] = useState('spainOpinion');
  const [statsView, setStatsView] = useState('medio'); // 'medio' | 'tematica' | 'dia'

  // Sincronizar a window para que NewsCard/MediaGroup puedan acceder sin prop drilling
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__pressReaderEnabled = pressReaderEnabled;
    }
  }, [pressReaderEnabled]);

  const togglePressReader = () => {
    setPressReaderEnabled(prev => {
      const next = !prev;
      savePressReaderEnabled(next);
      return next;
    });
  };

  // Sembrar el histórico con los datos de junio ya recopilados (solo si está vacío)
  useEffect(() => {
    seedHistoryOnce();
  }, []);

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
      worldNews:      { setData: setIntlData,         setStatus: setIntlStatus,         setError: setIntlError },
      worldOpinion:   { setData: setIntlData,         setStatus: setIntlStatus,         setError: setIntlError },
      spainNews:      { setData: setSpainNewsData,    setStatus: setSpainNewsStatus,    setError: setSpainNewsError },
      spainOpinion:   { setData: setSpainOpinionData, setStatus: setSpainOpinionStatus, setError: setSpainOpinionError },
    };
    // worldNews/worldOpinion son sub-modos que llenan solo su parte del estado intl.
    // Al guardar hay que FUSIONAR (mantener la otra mitad ya cargada), no reemplazar.
    const isIntlSubMode = (section === 'worldNews' || section === 'worldOpinion');
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
      // ⭐ DEDUP CROSS-DAY: recolectar URLs de briefings recientes (últimos 5 días)
      // para que el backend las excluya del pool y no se repitan piezas.
      const recentUrls = (() => {
        try {
          const cache = loadBriefingCache();
          if (!cache) return [];
          const urls = new Set();
          const todayKey = todayShort;
          // Solo recolectar de DÍAS ANTERIORES, no el actual
          Object.entries(cache).forEach(([dateKey, dayBriefing]) => {
            if (dateKey === todayKey) return; // no excluyamos lo que ya tenemos hoy
            // Solo últimos 5 días
            try {
              const [d, m, y] = dateKey.split('/').map(p => parseInt(p, 10));
              const cacheDate = new Date(Date.UTC(y, m - 1, d));
              const todayDate = new Date(Date.UTC(...todayKey.split('/').map(p => parseInt(p, 10)).reverse().map((v, i) => i === 1 ? v - 1 : v)));
              const daysAgo = (todayDate - cacheDate) / (24 * 60 * 60 * 1000);
              if (daysAgo > 5 || daysAgo < 0) return;
            } catch (_) { /* siempre incluir si no parsea fecha */ }
            // Extraer URLs de las 3 secciones
            ['spainOpinion', 'spainNews', 'extraNews', 'worldOpinion', 'worldNews'].forEach(key => {
              const arr = dayBriefing?.[key];
              if (Array.isArray(arr)) {
                arr.forEach(item => {
                  if (item?.url) {
                    const normalized = item.url.split('#')[0].split('?')[0].toLowerCase().replace(/\/$/, '');
                    urls.add(normalized);
                    urls.add(item.url);
                  }
                });
              }
            });
          });
          return Array.from(urls);
        } catch (e) {
          console.warn('Error recolectando URLs recientes:', e);
          return [];
        }
      })();

      const res = await fetch('/api/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: todayShort, dateFull, requestTime, section, excludeUrls: recentUrls }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (!data.briefing) throw new Error('Respuesta sin briefing');
      if (isIntlSubMode) {
        // Fusionar: conservar la parte ya cargada (worldNews o worldOpinion) y
        // actualizar solo la que acaba de llegar. Así los dos botones se acumulan.
        setIntlData(prev => {
          const base = prev || {};
          const incoming = data.briefing || {};
          return {
            ...base,
            ...incoming,
            date: incoming.date || base.date,
            worldNews: (section === 'worldNews')
              ? (incoming.worldNews || [])
              : (base.worldNews || incoming.worldNews || []),
            worldOpinion: (section === 'worldOpinion')
              ? (incoming.worldOpinion || [])
              : (base.worldOpinion || incoming.worldOpinion || []),
          };
        });
      } else {
        setData(data.briefing);
      }
      setStatus('done');
      // Histórico local: cuenta las piezas de esta sección y registra total + desglose por medio
      try {
        const b = data.briefing;
        let arr = [];
        let histKey = section;
        if (section === 'spainNews' && Array.isArray(b.spainNews)) arr = b.spainNews;
        else if (section === 'spainOpinion' && Array.isArray(b.spainOpinion)) arr = b.spainOpinion;
        else if (section === 'worldNews') { arr = b.worldNews || []; histKey = 'world'; }
        else if (section === 'worldOpinion') { arr = b.worldOpinion || []; histKey = 'worldOpinion'; }
        else { arr = [...(b.worldNews || []), ...(b.worldOpinion || [])]; histKey = 'world'; }
        const n = arr.length;
        if (n > 0) {
          const breakdown = {};
          const topicBreakdown = {};
          for (const p of arr) {
            const s = (p && p.source) ? String(p.source).trim() : 'Sin medio';
            breakdown[s] = (breakdown[s] || 0) + 1;
            const tp = (p && p.topic) ? String(p.topic).trim() : 'Otros';
            topicBreakdown[tp] = (topicBreakdown[tp] || 0) + 1;
          }
          recordHistory(histKey, n, breakdown, topicBreakdown);
        }
      } catch (_) { /* no-op */ }
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
    const fileNames = {
      spainNews: `mal-news-espana-noticias-${safeName}.html`,
      spainOpinion: `mal-news-espana-opinion-${safeName}.html`,
      worldNews: `mal-news-internacional-noticias-${safeName}.html`,
      worldOpinion: `mal-news-internacional-opinion-${safeName}.html`,
      spain: `mal-news-espana-${safeName}.html`,
      international: `mal-news-internacional-${safeName}.html`,
    };
    const fileName = fileNames[mode] || `mal-news-${safeName}.html`;
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
        // SEMANAL: resumen de los últimos 7 días, se genera los DOMINGOS a las 21:00.
        0: { hour: 21, minute: 0, label: 'Domingo · RESUMEN SEMANAL · lo mejor de los últimos 7 días' },
        1: { hour: 21, minute: 0, label: 'Semanal · próximo domingo 21:00' },
        2: { hour: 21, minute: 0, label: 'Semanal · próximo domingo 21:00' },
        3: { hour: 21, minute: 0, label: 'Semanal · próximo domingo 21:00' },
        4: { hour: 21, minute: 0, label: 'Semanal · próximo domingo 21:00' },
        5: { hour: 21, minute: 0, label: 'Semanal · próximo domingo 21:00' },
        6: { hour: 21, minute: 0, label: 'Semanal · próximo domingo 21:00' },
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
    1: { hour: 21, minute: 0, label: 'Noche · ciclo completo del día' },
    2: { hour: 21, minute: 0, label: 'Noche · ciclo completo del día' },
    3: { hour: 21, minute: 0, label: 'Noche · ciclo completo del día' },
    4: { hour: 21, minute: 0, label: 'Día de Estefanía Molina y Agustín Valladolid' },
    5: { hour: 21, minute: 0, label: 'Cierra la semana · briefing nocturno' },
    6: { hour: 21, minute: 0, label: 'Sábado noche · análisis del cierre semanal' },
    0: { hour: 21, minute: 0, label: 'Domingo noche · FJL, Pedro J., Cebrián' },
  };

  const SCHEDULE_INTL = {
    1: { hour: 21, minute: 30, label: 'Pico US business · LATAM activo' },
    2: { hour: 21, minute: 30, label: 'Pico US business · LATAM activo' },
    3: { hour: 21, minute: 30, label: 'Pico US business · LATAM activo' },
    4: { hour: 21, minute: 30, label: 'US tarde · Europa cerrada · LATAM peak' },
    5: { hour: 21, minute: 30, label: 'Cierre semanal · setup de fin de semana US' },
    6: { hour: 22, minute: 0,  label: 'Sábado noche · US weekend cycle · LATAM activo' },
    0: { hour: 22, minute: 0,  label: 'Domingo noche · NYT Sunday Review · WSJ Weekend' },
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
      worldOpinion: { color: '#0FA69D', gradient: 'linear-gradient(90deg, #0FA69D, #0A7A73)' },
      worldNews:    { color: '#DB2777', gradient: 'linear-gradient(90deg, #DB2777, #9D174D)' },
      spainOpinion: { color: '#D6FF00', gradient: 'linear-gradient(90deg, #D6FF00, #A8CC00)' },
      spainNews:    { color: '#F86040', gradient: 'linear-gradient(90deg, #F86040, #D63E1E)' },
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
        ? `<a href="${escape(item.url)}" style="color:${color};text-decoration:none;border-bottom:2px dotted ${color};font-weight:700;font-size:11px;white-space:nowrap;font-family:'Space Mono',monospace;">leer &rarr;</a>`
        : '';
      const sourceBadge = item.source
        ? `<span style="background:${sourceColor};color:#FFFCF2;font-size:9px;font-weight:700;letter-spacing:0.08em;padding:3px 8px;border-radius:0;text-transform:uppercase;font-family:'Space Mono',monospace;">${escape(item.source)}</span>`
        : '';
      const dateBadgeHtml = dateBadge
        ? `<span style="background:#16140F;color:#FFFCF2;font-size:9px;font-weight:700;letter-spacing:0.08em;padding:3px 8px;border-radius:0;font-family:'Space Mono',monospace;">${escape(dateBadge)}</span>`
        : '';
      const readBadge = `<span style="background:transparent;border:1px solid #16140F;color:#16140F;font-size:9px;font-weight:700;letter-spacing:0.04em;padding:2px 7px;border-radius:0;font-family:'Space Mono',monospace;">${readTime} min</span>`;
      const footerText = isOpinion && item.author
        ? `<span style="font-weight:700;font-style:italic;opacity:0.85;">&mdash; ${escape(item.author)}</span>`
        : !isOpinion && item.region
        ? `<span style="font-weight:700;font-style:italic;opacity:0.85;">${escape(item.region)}</span>`
        : '<span></span>';
      return `
        <div style="background:#FFFCF2;border:2px solid #16140F;border-radius:0;padding:14px 16px;margin-bottom:14px;box-shadow:4px 4px 0 ${color};font-family:'Crimson Pro',Georgia,serif;">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
            ${sourceBadge}
            ${dateBadgeHtml}
            ${readBadge}
          </div>
          <div style="font-size:${isOpinion ? '17px' : '16px'};font-weight:700;color:#16140F;line-height:1.3;margin-bottom:5px;">${escape(item.title)}</div>
          <div style="font-size:13.5px;color:rgba(22,20,15,0.78);line-height:1.5;${summaryStyle}margin-bottom:6px;">${escape(item.summary)}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px;color:#16140F;">
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
          <div style="background:${color};color:#011142;padding:16px 20px;border:3px solid #011142;border-radius:0;box-shadow:5px 5px 0 #011142;font-family:'Space Mono',monospace;">
            <div style="font-size:15px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;">
              ${icon} ${escape(title)} &middot; ${items.length} ${itemLabel}
            </div>
            <div style="font-size:11px;opacity:0.95;margin-top:6px;font-weight:400;">${escape(descriptor)}</div>
          </div>
          <div style="padding:18px 4px 4px;">
            ${itemsHtml}
          </div>
        </div>`;
    };

    // Calcular total según modo
    let total = 0;
    let sectionsHtml = '';
    let headerTitle = 'MAL NEWS';
    let pageSubtitle = '';

    if (mode === 'spainNews') {
      total = (b.spainNews?.length || 0);
      headerTitle = 'MAL NEWS · ESPAÑA';
      pageSubtitle = 'Noticias nacionales';
      sectionsHtml =
        section('España', '🇪🇸', b.spainNews, 'spainNews', 'Eventos concretos · prensa española · publicadas últimas 48h', false);
    } else if (mode === 'spainOpinion') {
      total = (b.spainOpinion?.length || 0);
      headerTitle = 'MAL NEWS · OPINIÓN ESPAÑA';
      pageSubtitle = 'Columnas de opinión nacional';
      sectionsHtml =
        section('Opinión España', '✍️', b.spainOpinion, 'spainOpinion', 'Columnas firmadas · sin editoriales · 4+ medios · publicadas hoy o ayer', true);
    } else if (mode === 'worldNews') {
      total = (b.worldNews?.length || 0);
      headerTitle = 'MAL NEWS · INTERNACIONAL';
      pageSubtitle = 'Cobertura global';
      sectionsHtml =
        section('Mundo', '🌍', b.worldNews, 'worldNews', 'Cobertura global plural · publicadas en últimas 48h · incluye sentencias relevantes', false);
    } else if (mode === 'worldOpinion') {
      total = (b.worldOpinion?.length || 0);
      headerTitle = 'MAL NEWS · OPINIÓN INTERNACIONAL';
      pageSubtitle = 'Columnas de opinión global';
      sectionsHtml =
        section('Opinión Internacional', '✍️', b.worldOpinion, 'worldOpinion', 'Columnas firmadas · medios internacionales · 48h previas', true);
    } else if (mode === 'spain') {
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

    // Fondo de cabecera con tonalidad suave según la sección (opción A · tonos pastel)
    const HEADER_BG = {
      spainNews:     { bg: '#FBE3DC', border: '#F86040' },
      spainOpinion:  { bg: '#F2FBC4', border: '#A8CC00' },
      worldNews:     { bg: '#FBE0EE', border: '#DB2777' },
      worldOpinion:  { bg: '#D4F0EE', border: '#0FA69D' },
      spain:         { bg: '#FBE3DC', border: '#F86040' },
      international: { bg: '#FBE0EE', border: '#DB2777' },
    };
    const headerTone = HEADER_BG[mode] || { bg: '#FFFCF2', border: '#011142' };

    // ID único por modo para aislar CSS cuando se pegan varios HTMLs en el mismo email
    const wrapperId =
      mode === 'spainNews' ? 'mal-news-esp-news'
      : mode === 'spainOpinion' ? 'mal-news-esp-op'
      : mode === 'worldNews' ? 'mal-news-intl-news'
      : mode === 'worldOpinion' ? 'mal-news-intl-op'
      : mode === 'spain' ? 'mal-news-esp'
      : mode === 'international' ? 'mal-news-intl'
      : 'mal-news-all';
    const W = `#${wrapperId}`;

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${escape(headerTitle)} - ${escape(todayShort)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,600;0,700;1,400&family=Space+Mono:wght@400;700&display=swap');
  ${W} { margin:0; padding:24px; background:#F4ECD4; font-family:'Crimson Pro',Georgia,serif; color:#16140F; box-sizing:border-box; }
  ${W} * { box-sizing:border-box; }
  ${W} .container { max-width:820px; margin:0 auto; }
  ${W} .header { text-align:center; margin-bottom:28px; padding:24px; background:#FFFCF2; border:3px solid #011142; border-radius:0; box-shadow:6px 6px 0 #F86040; }
  ${W} .logo { font-family:'Space Mono',monospace; font-size:28px; font-weight:700; color:#011142; letter-spacing:2px; margin:0; text-transform:uppercase; }
  ${W} .subtitle { font-size:14px; font-style:italic; color:#F86040; margin:6px 0 0; }
  ${W} .date { font-family:'Space Mono',monospace; font-size:12px; letter-spacing:0.3em; color:#011142; text-transform:uppercase; font-weight:700; margin:10px 0 0; }
  ${W} .total { font-family:'Space Mono',monospace; font-size:11px; color:#011142; background:#FADD00; display:inline-block; padding:3px 10px; letter-spacing:0.15em; font-weight:700; margin-top:12px; }
  ${W} .footer { text-align:center; margin-top:32px; padding:18px; font-family:'Space Mono',monospace; font-size:10px; color:rgba(1,17,66,0.6); letter-spacing:0.15em; border-top:3px double #011142; }
  ${W} .next-briefing { background:#FFFCF2; border:3px solid #011142; border-radius:0; padding:20px 22px; margin:32px 0 0; box-shadow:6px 6px 0 #011142; }
  ${W} .next-briefing-label { text-align:center; font-family:'Space Mono',monospace; font-size:10px; font-weight:700; letter-spacing:0.18em; color:#011142; margin-bottom:14px; }
  ${W} .schedule-card { display:flex; gap:14px; align-items:center; padding:14px 16px; border-radius:0; margin-bottom:10px; background:#FFFCF2; }
  ${W} .spain-card { border:2px solid #011142; box-shadow:4px 4px 0 #F86040; }
  ${W} .intl-card { border:2px solid #011142; box-shadow:4px 4px 0 #DB2777; }
  ${W} .card-icon { font-size:32px; flex-shrink:0; }
  ${W} .card-body { flex:1; }
  ${W} .card-title { font-family:'Space Mono',monospace; font-size:10px; font-weight:700; letter-spacing:0.16em; color:#011142; margin-bottom:3px; }
  ${W} .spain-card .card-title { color:#F86040; }
  ${W} .intl-card .card-title { color:#DB2777; }
  ${W} .card-time { font-style:italic; font-size:18px; font-weight:700; color:#011142; margin-bottom:3px; line-height:1.2; }
  ${W} .card-reason { font-size:12px; font-style:italic; color:rgba(1,17,66,0.7); line-height:1.3; }
  ${W} .next-briefing-schedule { border-top:2px dashed #FADD00; padding-top:14px; margin-top:8px; }
  ${W} .schedule-title { font-family:'Space Mono',monospace; font-size:10px; font-weight:700; letter-spacing:0.12em; color:#011142; margin-bottom:10px; text-align:center; }
  ${W} .schedule-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  ${W} .schedule-col-title { font-family:'Space Mono',monospace; font-size:9px; font-weight:700; letter-spacing:0.14em; padding:5px 0; margin-bottom:4px; text-align:center; border-radius:0; color:#FFFCF2; }
  ${W} .spain-title { background:#F86040; color:#FFFCF2; }
  ${W} .intl-title { background:#DB2777; color:#FFFCF2; }
  ${W} .schedule-row { display:flex; justify-content:space-between; font-size:12px; color:#011142; padding:3px 6px; border-bottom:1px dashed rgba(1,17,66,0.15); }
  ${W} .schedule-row:last-child { border-bottom:none; }
  ${W} .copy-hint { background:#1A3FE6; border:3px solid #16140F; border-radius:0; padding:14px 18px; margin-bottom:20px; font-size:13px; color:#FFFCF2; text-align:center; box-shadow:4px 4px 0 #FF2D7A; }
  ${W} .copy-hint strong { color:#FFFCF2; }
  ${W} .next-brief { margin-top:36px; padding:22px 26px; background:#FFFCF2; border:3px solid #011142; border-radius:0; box-shadow:6px 6px 0 #F86040; }
  ${W} .next-brief-label { font-family:'Space Mono',monospace; font-size:9px; font-weight:700; letter-spacing:0.22em; color:#F86040; text-transform:uppercase; margin-bottom:8px; }
  ${W} .next-brief-day { font-style:italic; font-size:22px; color:#011142; font-weight:700; margin-bottom:4px; }
  ${W} .next-brief-time { font-family:'Space Mono',monospace; font-size:32px; font-weight:700; color:#F86040; letter-spacing:0.02em; margin-bottom:8px; line-height:1; }
  ${W} .next-brief-reason { font-size:13px; color:rgba(1,17,66,0.7); font-style:italic; line-height:1.5; }
  ${W} .next-brief-table { margin-top:16px; padding-top:14px; border-top:2px dashed rgba(248,96,64,0.4); font-family:'Space Mono',monospace; font-size:10px; color:rgba(1,17,66,0.65); line-height:1.7; }
  ${W} .next-brief-table strong { color:#011142; font-weight:700; letter-spacing:0.05em; }
  @media print { ${W} .copy-hint { display:none; } ${W} { background:white; } }
</style>
</head>
<body style="margin:0;padding:0;">
<div id="${wrapperId}">
  <div class="container">
    <div class="copy-hint">
      💡 <strong>Copia para email:</strong> Ctrl+A &rarr; Ctrl+C &rarr; pega en Gmail (conserva formato). O imprime con Ctrl+P para PDF.
    </div>
    <div class="header" style="background:${headerTone.bg};box-shadow:6px 6px 0 ${headerTone.border};border-color:${headerTone.border};">
      <h1 class="logo">${escape(headerTitle)}</h1>
      <p class="subtitle">${escape(pageSubtitle)}</p>
      <p class="date">${escape(todayShort)}</p>
      <p class="total">${total} PIEZAS</p>
    </div>
    ${sectionsHtml}
    ${(() => {
      // Solo mostrar bloque de próximo briefing en los modos combinados legacy
      if (mode !== 'spain' && mode !== 'international') return '';
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
          : '<strong>Horario Internacional:</strong> SEMANAL &middot; Domingos 21:00 &middot; resumen de los últimos 7 días'}
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
            <div class="schedule-row"><span>📅 SEMANAL</span><span>Domingo 21:00</span></div>
            <div class="schedule-row"><span>Resumen</span><span>últimos 7 días</span></div>
            <div class="schedule-row"><span>Generación</span><span>manual</span></div>
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
      `MAL NEWS - Briefing ${todayShort}`,
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
    worldOpinion: BRAND.worldOpinionColor, // Violeta
    worldNews:    BRAND.intlColor,         // Teal
    spainOpinion: BRAND.opinionColor,      // Rosa flúor
    spainNews:    BRAND.newsColor,         // Naranja
  };
  const SECTION_GRADIENTS = {
    worldOpinion: BRAND.worldOpinionGrad,  // violeta → violeta profundo
    worldNews:    BRAND.intlGrad,          // teal → teal profundo
    spainOpinion: BRAND.opinionGrad,       // rosa → rosa profundo
    spainNews:    BRAND.newsGrad,          // naranja → naranja profundo
  };

  const intlSections = intlData ? [
    { title: 'Mundo', icon: '🌍', items: intlData.worldNews, color: SECTION_COLORS.worldNews, gradient: SECTION_GRADIENTS.worldNews, count: 10, type: 'news',
      descriptor: 'Cobertura global por temas · economía, geopolítica, IA, lecturas · medios free',
      note: intlData._note,
      meta: intlData._meta,
      groupByContinent: false, historyKey: 'worldNews' },
    { title: 'Opinión Internacional', icon: '✍️', items: intlData.worldOpinion, color: SECTION_COLORS.worldOpinion, gradient: SECTION_GRADIENTS.worldOpinion, count: 8, type: 'opinion',
      descriptor: 'Columnas firmadas · medios internacionales free · por tema',
      note: intlData._note,
      meta: intlData._meta , historyKey: 'worldOpinion' },
  ] : [];

  const spainOpinionSections = spainOpinionData ? [
    { title: 'Opinión España', icon: '✍️', items: spainOpinionData.spainOpinion, color: SECTION_COLORS.spainOpinion, gradient: SECTION_GRADIENTS.spainOpinion, count: 25, type: 'opinion',
      descriptor: 'Columnas firmadas · sin editoriales · 4+ medios · publicadas hoy o ayer',
      note: spainOpinionData._note,
      meta: spainOpinionData._meta , historyKey: 'spainOpinion' },
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
      historyKey: 'spainNews',
      editorNote: hasNewsData ? spainNewsData.editorNote : null,
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
    return '🌍 Internacional (10+8)';
  })();

  const spainOpinionBtnLabel = (() => {
    if (spainOpinionStatus === 'loading') return 'Buscando opinión España...';
    if (isInCooldown) return `⏳ Espera ${cooldownLeft}s`;
    if (spainOpinionStatus === 'done') return `🔄 Recargar opinión España (${realSpainOpinionCount})`;
    return '✍️ Opinión España (hasta 25)';
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
              {/* Flecha izquierda · ir día atrás */}
              <button
                onClick={() => {
                  const newDate = new Date(selectedDate + 'T12:00:00');
                  newDate.setDate(newDate.getDate() - 1);
                  setSelectedDate(newDate.toISOString().slice(0, 10));
                }}
                disabled={disabled}
                title="Día anterior"
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  border: `1.5px solid ${disabled ? '#CBD5E0' : '#1A365D'}`,
                  background: 'white',
                  color: disabled ? '#CBD5E0' : '#1A365D',
                  fontSize: '20px',
                  fontWeight: '700',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 2px 6px rgba(26,54,93,0.15)',
                }}
                onMouseOver={e => !disabled && (e.currentTarget.style.background = '#1A365D', e.currentTarget.style.color = 'white')}
                onMouseOut={e => !disabled && (e.currentTarget.style.background = 'white', e.currentTarget.style.color = '#1A365D')}
              >
                ‹
              </button>

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

              {/* Flecha derecha · ir día adelante (deshabilitada si ya estamos en HOY) */}
              <button
                onClick={() => {
                  const newDate = new Date(selectedDate + 'T12:00:00');
                  newDate.setDate(newDate.getDate() + 1);
                  const newIso = newDate.toISOString().slice(0, 10);
                  if (newIso <= todayIso) setSelectedDate(newIso);
                }}
                disabled={disabled || selectedDate >= todayIso}
                title={selectedDate >= todayIso ? 'Ya estás en HOY · no puedes ir al futuro' : 'Día siguiente'}
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  border: `1.5px solid ${(disabled || selectedDate >= todayIso) ? '#CBD5E0' : '#1A365D'}`,
                  background: 'white',
                  color: (disabled || selectedDate >= todayIso) ? '#CBD5E0' : '#1A365D',
                  fontSize: '20px',
                  fontWeight: '700',
                  cursor: (disabled || selectedDate >= todayIso) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 2px 6px rgba(26,54,93,0.15)',
                }}
                onMouseOver={e => !(disabled || selectedDate >= todayIso) && (e.currentTarget.style.background = '#1A365D', e.currentTarget.style.color = 'white')}
                onMouseOut={e => !(disabled || selectedDate >= todayIso) && (e.currentTarget.style.background = 'white', e.currentTarget.style.color = '#1A365D')}
              >
                ›
              </button>

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

        {/* TOGGLE PRESSREADER · marca medios disponibles en PressReader */}
        <div style={{
          textAlign: 'center', fontSize: '10px', color: BRAND.inkSoft,
          marginBottom: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
        }}>
          <span>📚 Tengo PressReader:</span>
          <button
            onClick={togglePressReader}
            style={{
              fontSize: '10px',
              padding: '3px 10px',
              borderRadius: '12px',
              border: `1px solid ${pressReaderEnabled ? '#0891B2' : BRAND.inkSoft}`,
              background: pressReaderEnabled ? 'rgba(8,145,178,0.10)' : 'transparent',
              color: pressReaderEnabled ? '#0891B2' : BRAND.inkSoft,
              cursor: 'pointer',
              fontWeight: '700',
            }}
            title="Activa si tienes acceso a PressReader. Los paywalls disponibles ahí se marcarán con 📚 en vez de 🔒"
          >
            {pressReaderEnabled ? '✓ ACTIVADO' : 'desactivado'}
          </button>
        </div>

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
                ? `linear-gradient(90deg, #A8CC00, #EFFF7A, #A8CC00)`
                : BRAND.opinionGrad,
              backgroundSize: spainOpinionStatus === 'loading' ? '200% 100%' : '100% 100%',
              animation: spainOpinionStatus === 'loading' ? 'shimmer 2s linear infinite' : 'none',
              color: '#011142', opacity: (spainOpinionStatus === 'loading' || isInCooldown) ? 0.65 : 1,
              boxShadow: '0 6px 20px rgba(214,255,0,0.45)', textTransform: 'uppercase',
              textShadow: 'none',
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
                ? `linear-gradient(90deg, #D63E1E, #FF8A6B, #D63E1E)`
                : BRAND.newsGrad,
              backgroundSize: spainNewsStatus === 'loading' ? '200% 100%' : '100% 100%',
              animation: spainNewsStatus === 'loading' ? 'shimmer 2s linear infinite' : 'none',
              color: 'white', opacity: (spainNewsStatus === 'loading' || isInCooldown) ? 0.65 : 1,
              boxShadow: '0 6px 20px rgba(248,96,64,0.42)', textTransform: 'uppercase',
              textShadow: '0 1px 2px rgba(0,0,0,0.15)',
            }}
          >
            {spainNewsBtnLabel}
          </button>

          <button
            className="mal-cta"
            onClick={() => fetchSection('worldNews')}
            disabled={intlStatus === 'loading' || isInCooldown}
            style={{
              border: 'none', borderRadius: '12px', padding: '14px 22px',
              fontSize: '11px', fontWeight: '800', letterSpacing: '0.08em',
              cursor: (intlStatus === 'loading' || isInCooldown) ? 'wait' : 'pointer',
              transition: 'all 0.25s ease', fontFamily: "'Verdana', 'Geneva', sans-serif",
              background: intlStatus === 'loading'
                ? `linear-gradient(90deg, #9D174D, #F472B6, #9D174D)`
                : BRAND.worldNewsGrad || BRAND.intlGrad,
              backgroundSize: intlStatus === 'loading' ? '200% 100%' : '100% 100%',
              animation: intlStatus === 'loading' ? 'shimmer 2s linear infinite' : 'none',
              color: 'white', opacity: (intlStatus === 'loading' || isInCooldown) ? 0.65 : 1,
              boxShadow: '0 6px 20px rgba(219,39,119,0.42)', textTransform: 'uppercase',
              textShadow: '0 1px 2px rgba(0,0,0,0.15)',
            }}
          >
            {intlStatus === 'loading' ? 'Buscando noticias internacional...' : isInCooldown ? `⏳ Espera ${cooldownLeft}s` : '🌍 Noticias Internacional (10)'}
          </button>

          <button
            className="mal-cta"
            onClick={() => fetchSection('worldOpinion')}
            disabled={intlStatus === 'loading' || isInCooldown}
            style={{
              border: 'none', borderRadius: '12px', padding: '14px 22px',
              fontSize: '11px', fontWeight: '800', letterSpacing: '0.08em',
              cursor: (intlStatus === 'loading' || isInCooldown) ? 'wait' : 'pointer',
              transition: 'all 0.25s ease', fontFamily: "'Verdana', 'Geneva', sans-serif",
              background: intlStatus === 'loading'
                ? `linear-gradient(90deg, #0A7A73, #4FD4C8, #0A7A73)`
                : BRAND.worldOpinionGrad || BRAND.intlGrad,
              backgroundSize: intlStatus === 'loading' ? '200% 100%' : '100% 100%',
              animation: intlStatus === 'loading' ? 'shimmer 2s linear infinite' : 'none',
              color: 'white', opacity: (intlStatus === 'loading' || isInCooldown) ? 0.65 : 1,
              boxShadow: '0 6px 20px rgba(15,166,157,0.42)', textTransform: 'uppercase',
              textShadow: '0 1px 2px rgba(0,0,0,0.15)',
            }}
          >
            {intlStatus === 'loading' ? 'Buscando opinión internacional...' : isInCooldown ? `⏳ Espera ${cooldownLeft}s` : '✍️ Opinión Internacional (8)'}
          </button>
        </div>

        {/* Exportación HTML · 4 secciones SEPARADAS (Ver / Descargar cada una) */}
        {hasAnyData && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
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
            </div>
            {/* Una fila por sección: etiqueta + Ver + Descargar */}
            {(() => {
              const secciones = [
                { mode: 'spainNews',     label: '🇪🇸 Noticias España',        color: '#C2410C', data: realSpainNewsCount },
                { mode: 'spainOpinion',  label: '✍️ Opinión España',          color: '#65A30D', data: realSpainOpinionCount },
                { mode: 'worldNews',     label: '🌍 Internacional',           color: '#0F766E', data: intlData?.worldNews?.length || 0 },
                { mode: 'worldOpinion',  label: '✍️ Opinión Internacional',   color: '#0E7490', data: intlData?.worldOpinion?.length || 0 },
              ];
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '440px', margin: '0 auto' }}>
                  {secciones.map(s => {
                    const disabled = s.data === 0;
                    return (
                      <div key={s.mode} style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        opacity: disabled ? 0.4 : 1,
                      }}>
                        <span style={{
                          flex: 1, fontSize: '11px', fontWeight: '800', color: s.color,
                          letterSpacing: '0.03em', fontFamily: "'Verdana', 'Geneva', sans-serif",
                          textAlign: 'right', paddingRight: '4px',
                        }}>
                          {s.label} {s.data > 0 ? `(${s.data})` : ''}
                        </span>
                        <button
                          onClick={() => !disabled && viewHtmlSingle(s.mode)}
                          disabled={disabled}
                          style={{
                            border: `1px solid ${s.color}`, borderRadius: '8px',
                            padding: '8px 14px', fontSize: '11px', fontWeight: '700',
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s ease', fontFamily: "'Verdana', 'Geneva', sans-serif",
                            background: 'rgba(255,255,255,0.9)', color: s.color, whiteSpace: 'nowrap',
                          }}
                          title={`Ver HTML de ${s.label} en nueva pestaña`}
                        >
                          👁️ Ver
                        </button>
                        <button
                          onClick={() => !disabled && downloadHtmlSingle(s.mode)}
                          disabled={disabled}
                          style={{
                            border: `1px solid ${s.color}`, borderRadius: '8px',
                            padding: '8px 14px', fontSize: '11px', fontWeight: '700',
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s ease', fontFamily: "'Verdana', 'Geneva', sans-serif",
                            background: s.color, color: 'white', whiteSpace: 'nowrap',
                          }}
                          title={`Descargar HTML de ${s.label}`}
                        >
                          ⬇️ Bajar
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* Mensajes de loading individuales */}
        {intlStatus === 'loading' && (
          <p style={{ textAlign: 'center', color: BRAND.orange, fontSize: '12px', animation: 'pulse 1.5s infinite', marginBottom: '8px', fontStyle: 'italic' }}>
            🌍 Buscando piezas internacionales...
          </p>
        )}
        {spainOpinionStatus === 'loading' && (
          <p style={{ textAlign: 'center', color: BRAND.orange, fontSize: '12px', animation: 'pulse 1.5s infinite', marginBottom: '8px', fontStyle: 'italic' }}>
            ✍️ Buscando 25 columnas de opinión España...
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
              {totalPieces} / 75 PIEZAS
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
              <Section key={i} title={s.title} icon={s.icon} items={s.items} color={s.color} gradient={s.gradient} count={s.count} descriptor={s.descriptor} type={s.type} note={s.note} meta={s.meta} groupByContinent={s.groupByContinent} historyKey={s.historyKey} editorNote={s.editorNote} />
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
            <p style={{ fontSize: '14px', margin: '12px 0 0', color: '#011142', fontWeight: '700', letterSpacing: '0.02em', fontFamily: "'Verdana', 'Geneva', sans-serif" }}>
              Noticias España 25 · Opinión España 25 · Noticias Mundo 10 · Opinión Mundo 8
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
                      <span>📅 SEMANAL</span><span>Domingo 21:00</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#1A365D', padding: '3px 6px', borderBottom: '1px dashed rgba(26,54,93,0.06)' }}>
                      <span>Resumen</span><span>últimos 7 días</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#1A365D', padding: '3px 6px' }}>
                      <span>Generación</span><span>manual</span>
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

      {/* Botón flotante: histórico de cambios */}
      <button
        onClick={() => setShowChangelog(true)}
        style={{
          position: 'fixed', bottom: '18px', right: '18px', zIndex: 9998,
          background: '#16140F', color: '#F4ECD4', border: '2px solid #F4ECD4',
          borderRadius: '50%', width: '52px', height: '52px', fontSize: '20px',
          cursor: 'pointer', boxShadow: '3px 3px 0 rgba(0,0,0,0.3)',
          fontFamily: "'Space Mono', monospace",
        }}
        title="Histórico de cambios"
      >
        ✦
      </button>

      {/* Botón flotante: estadísticas por medio */}
      <button
        onClick={() => setShowStats(true)}
        style={{
          position: 'fixed', bottom: '80px', right: '18px', zIndex: 9998,
          background: '#16140F', color: '#F4ECD4', border: '2px solid #F4ECD4',
          borderRadius: '50%', width: '52px', height: '52px', fontSize: '20px',
          cursor: 'pointer', boxShadow: '3px 3px 0 rgba(0,0,0,0.3)',
          fontFamily: "'Space Mono', monospace",
        }}
        title="Estadísticas por medio (último mes)"
      >
        📊
      </button>

      {/* Modal: tabla de piezas por medio (último mes) */}
      {showStats && (() => {
        const SECTION_LABELS = {
          spainNews: '🇪🇸 Noticias España',
          spainOpinion: '✍️ Opinión España',
          world: '🌍 Internacional',
        };
        const stats = statsView === 'tematica' ? getTopicTotals(statsSection, 30)
                    : statsView === 'dia' ? getDailyTotals(statsSection, 30)
                    : getSourceTotals(statsSection, 30);
        const viewTitle = statsView === 'tematica' ? 'Piezas por temática'
                        : statsView === 'dia' ? 'Piezas por día'
                        : 'Piezas por medio';
        return (
          <div
            onClick={() => setShowStats(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              background: 'rgba(0,0,0,0.6)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', padding: '16px',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#F4ECD4', color: '#16140F', maxWidth: '620px',
                width: '100%', maxHeight: '85vh', overflowY: 'auto',
                border: '3px solid #16140F', borderRadius: '12px',
                boxShadow: '6px 6px 0 rgba(0,0,0,0.4)', padding: '20px',
                fontFamily: "'Crimson Pro', Georgia, serif",
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h2 style={{ margin: 0, fontFamily: "'Space Mono', monospace", fontSize: '17px', letterSpacing: '0.04em' }}>
                  📊 {viewTitle} · últimos 30 días
                </h2>
                <button
                  onClick={() => setShowStats(false)}
                  style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#16140F', lineHeight: 1 }}
                >
                  ×
                </button>
              </div>

              {/* Selector de sección */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
                {Object.entries(SECTION_LABELS).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setStatsSection(key)}
                    style={{
                      padding: '6px 10px', borderRadius: '6px', cursor: 'pointer',
                      fontSize: '12px', fontFamily: "'Verdana', sans-serif",
                      border: '2px solid #16140F',
                      background: statsSection === key ? '#16140F' : 'transparent',
                      color: statsSection === key ? '#F4ECD4' : '#16140F',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Selector de vista: por medio / temática / día */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
                {[['medio', '📰 Por medio'], ['tematica', '🏷️ Por temática'], ['dia', '📅 Por día']].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setStatsView(key)}
                    style={{
                      padding: '5px 10px', borderRadius: '6px', cursor: 'pointer',
                      fontSize: '11.5px', fontFamily: "'Verdana', sans-serif",
                      border: '2px solid #0FA69D',
                      background: statsView === key ? '#0FA69D' : 'transparent',
                      color: statsView === key ? '#FFFFFF' : '#0A5B55',
                      fontWeight: statsView === key ? '700' : '400',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {!stats || (stats.noTopicData) ? (
                <p style={{ opacity: 0.7, fontStyle: 'italic', lineHeight: 1.5 }}>
                  {stats && stats.noTopicData
                    ? 'Aún no hay datos por temática para esta sección. Se empiezan a guardar desde ahora, cada vez que generes un briefing.'
                    : 'Aún no hay datos para esta sección. Los datos se acumulan cada vez que generas un briefing — vuelve tras unos días de uso.'}
                </p>
              ) : (
                <>
                  <div style={{ fontSize: '11px', fontFamily: "'Space Mono', monospace", opacity: 0.65, marginBottom: '10px' }}>
                    {stats.isDaily
                      ? `${stats.briefings} briefings registrados · ${stats.totals.length} días`
                      : `${stats.briefings} briefings registrados · ${stats.totals.length} ${statsView === 'tematica' ? 'temas' : 'medios'}`}
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #16140F', textAlign: 'left' }}>
                        <th style={{ padding: '6px 4px', fontFamily: "'Space Mono', monospace", fontSize: '11px' }}>{statsView === 'tematica' ? 'TEMA' : statsView === 'dia' ? 'DÍA' : 'MEDIO'}</th>
                        <th style={{ padding: '6px 4px', fontFamily: "'Space Mono', monospace", fontSize: '11px', textAlign: 'right' }}>TOTAL</th>
                        <th style={{ padding: '6px 4px', fontFamily: "'Space Mono', monospace", fontSize: '11px', textAlign: 'right' }}>MEDIA/DÍA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.totals.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(22,20,15,0.12)' }}>
                          <td style={{ padding: '6px 4px' }}>{r.source}</td>
                          <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 700 }}>{r.total}</td>
                          <td style={{ padding: '6px 4px', textAlign: 'right', opacity: 0.7 }}>{r.avg === null ? '—' : r.avg}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* Modal: histórico de cambios buscable */}
      {showChangelog && (() => {
        const q = changelogQuery.trim().toLowerCase();
        const filtered = q
          ? CHANGELOG.filter(c =>
              c.texto.toLowerCase().includes(q) ||
              c.area.toLowerCase().includes(q) ||
              c.fecha.toLowerCase().includes(q))
          : CHANGELOG;
        return (
          <div
            onClick={() => setShowChangelog(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              background: 'rgba(0,0,0,0.6)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', padding: '16px',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#F4ECD4', color: '#16140F', maxWidth: '620px',
                width: '100%', maxHeight: '85vh', overflowY: 'auto',
                border: '3px solid #16140F', borderRadius: '12px',
                boxShadow: '6px 6px 0 rgba(0,0,0,0.4)', padding: '20px',
                fontFamily: "'Crimson Pro', Georgia, serif",
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h2 style={{ margin: 0, fontFamily: "'Space Mono', monospace", fontSize: '18px', letterSpacing: '0.04em' }}>
                  ✦ Histórico de cambios
                </h2>
                <button
                  onClick={() => setShowChangelog(false)}
                  style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#16140F', lineHeight: 1 }}
                >
                  ×
                </button>
              </div>
              <input
                type="text"
                value={changelogQuery}
                onChange={(e) => setChangelogQuery(e.target.value)}
                placeholder="Buscar cambios… (ej: Vozpópuli, deportes, fechas)"
                style={{
                  width: '100%', padding: '8px 12px', marginBottom: '14px',
                  border: '2px solid #16140F', borderRadius: '8px',
                  fontSize: '14px', fontFamily: "'Verdana', sans-serif",
                  boxSizing: 'border-box', background: 'white',
                }}
              />
              <div style={{ fontSize: '11px', fontFamily: "'Space Mono', monospace", opacity: 0.6, marginBottom: '8px' }}>
                {filtered.length} de {CHANGELOG.length} cambios
              </div>
              {filtered.length === 0 ? (
                <p style={{ opacity: 0.6, fontStyle: 'italic' }}>Sin resultados para "{changelogQuery}".</p>
              ) : (
                filtered.map((c, i) => (
                  <div key={i} style={{
                    padding: '10px 0', borderBottom: '1px solid rgba(22,20,15,0.15)',
                  }}>
                    <div style={{
                      fontFamily: "'Space Mono', monospace", fontSize: '10px',
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                      opacity: 0.7, marginBottom: '3px',
                    }}>
                      {c.fecha} · {c.area}
                    </div>
                    <div style={{ fontSize: '14px', lineHeight: 1.45 }}>{c.texto}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
