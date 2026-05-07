# MAL NEWS — PWA

Tu briefing diario de 47 piezas, instalable como app en Android (y iOS).

## Cómo funciona

```
[Ícono en pantalla de inicio]
        ↓ tap
[PWA - React shell]
        ↓ POST /api/briefing
[Vercel Serverless Function]      ← tu API key vive aquí, nunca en el móvil
        ↓
[Anthropic Claude Sonnet 4.6 + web_search]
        ↓
[JSON con 47 piezas]
        ↓
[Renderizado en pantalla + botón email mailto:]
```

## Deploy a Vercel (5 minutos)

### 1. Consigue una API key de Anthropic

Ve a https://console.anthropic.com/ → API Keys → "Create Key". Cópiala (empieza por `sk-ant-`).

### 2. Instala Vercel CLI (si no la tienes)

```bash
npm install -g vercel
```

### 3. Deploya

Desde la raíz de este proyecto:

```bash
vercel deploy
```

La primera vez te preguntará el nombre del proyecto, scope, etc. Acepta los defaults.

### 4. Añade la API key como variable de entorno

```bash
vercel env add ANTHROPIC_API_KEY
```

Pegas la key cuando te la pida. Selecciona los tres entornos (Production, Preview, Development) cuando te pregunte.

### 5. Redeploya para que coja la variable

```bash
vercel deploy --prod
```

Te dará una URL del tipo `https://mal-news-pwa.vercel.app`. Apunta esa URL.

## Instalar en Android (1 minuto)

1. Abre la URL en **Chrome** (no en otro navegador) en tu Android.
2. Pulsa el botón dorado para verificar que el briefing se genera correctamente.
3. Menú de tres puntos arriba a la derecha → **"Instalar app"** o **"Añadir a pantalla de inicio"**.
4. Confirma. Aparece el ícono MAL NEWS en tu launcher.
5. Al pulsarlo, abre a pantalla completa, sin barra de Chrome.

## Instalar en iOS

Similar pero diferente:
1. Abre en **Safari** (no Chrome — en iOS el "Add to Home Screen" sólo funciona desde Safari).
2. Botón compartir (cuadrado con flecha hacia arriba) → **"Añadir a pantalla de inicio"**.

## Coste

- **Vercel Hobby:** gratis para uso personal.
- **Anthropic API:** pago por uso. Un briefing diario completo tiene ~50K tokens de input (con resultados de web search) + ~10K de output. Eso son aproximadamente **30-50 céntimos por briefing** con Claude Sonnet 4.6. Si lo usas a diario, cuenta 10-15€/mes.

## Desarrollo local

```bash
npm install
npm run dev
```

Para probar la función serverless localmente:

```bash
vercel dev
```

Necesitas un `.env.local` con `ANTHROPIC_API_KEY=sk-ant-...` (mira `.env.example`).

## Notas y caveats

- **Timeout 60s.** Vercel Hobby permite hasta 60s por función. Si el briefing tarda más (a veces ocurre cuando web search hace muchas búsquedas), verás un error de timeout. Soluciones:
  - Vuelve a pulsar el botón — suele ir a la segunda.
  - Vercel Pro (20$/mes) sube el límite a 300s.
  - O divide el briefing en 2 llamadas (mundo + España como funciones separadas) — fácil de añadir.

- **Cuota de web search.** Anthropic limita las búsquedas web. Para 47 piezas con verificación de URLs, una sola ejecución usa ~30-50 búsquedas. Comprueba tus límites en console.anthropic.com.

- **Email.** El botón "Abrir email" usa `mailto:` — abre tu cliente de email por defecto en el móvil con destinatario, asunto y cuerpo (texto plano formateado) ya rellenos. No envía automáticamente — tú confirmas pulsando enviar.

- **Notificación push diaria.** No incluida en esta versión. Si la quieres, hay que migrar a la versión APK (Bubblewrap) que permite Web Push o un trigger nativo.

## Estructura

```
mal-news-pwa/
├── api/
│   └── briefing.js              # serverless: llama a Anthropic con la API key
├── public/
│   ├── manifest.webmanifest     # configuración PWA
│   ├── sw.js                    # service worker (necesario para "Instalar")
│   ├── icon-192.png             # ícono Android
│   ├── icon-512.png
│   ├── icon-maskable-512.png    # ícono adaptable Android
│   ├── apple-touch-icon.png     # ícono iOS
│   ├── icon.svg                 # fuente SVG (puedes regenerar PNGs)
│   └── icon-maskable.svg
├── src/
│   ├── App.jsx                  # UI completa (no hace API calls a anthropic.com)
│   └── main.jsx
├── index.html

├── package.json
├── vite.config.js
└── vercel.json                  # maxDuration 60s para la función
```
