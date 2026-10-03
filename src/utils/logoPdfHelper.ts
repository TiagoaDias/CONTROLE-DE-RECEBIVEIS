/**
 * Ultra-fast, zero-dependency browser SVG-to-PNG rasterizer using HTML5 Canvas.
 * Replaces unreliable html2canvas DOM captures to guarantee crystal-clear logos
 * and institutional watermarks on generated PDFs.
 */

const HASPAHO_CRYSTAL_SVG_DEFS = `
  <defs>
    <linearGradient id="hp_blue_dark" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#082b49" />
      <stop offset="100%" stop-color="#0a192f" />
    </linearGradient>
    <linearGradient id="hp_blue_light" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0d5c91" />
      <stop offset="50%" stop-color="#0a7ea4" />
      <stop offset="100%" stop-color="#0b3d66" />
    </linearGradient>
    <linearGradient id="hp_cyan_facet" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#14a0c8" />
      <stop offset="100%" stop-color="#0d527a" />
    </linearGradient>
    <linearGradient id="hp_green_ribbon" x1="10%" y1="90%" x2="90%" y2="10%">
      <stop offset="0%" stop-color="#006644" />
      <stop offset="35%" stop-color="#00a86b" />
      <stop offset="70%" stop-color="#10b981" />
      <stop offset="100%" stop-color="#34d399" />
    </linearGradient>
    <linearGradient id="hp_green_highlight" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6ee7b7" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>
  </defs>
`;

const HASPAHO_CRYSTAL_SVG_GRAPHIC = `
  <g>
    <polygon points="22,25 44,8 44,105 22,88" fill="url(#hp_blue_dark)" />
    <polygon points="44,8 52,15 52,112 44,105" fill="url(#hp_blue_light)" />
    <path d="M26,38 L38,48 L38,75 M30,55 L38,62 M28,80 L36,87" stroke="#14b8a6" stroke-width="2" stroke-linecap="round" stroke-opacity="0.9" />
    <circle cx="26" cy="38" r="2.5" fill="#2dd4bf" />
    <circle cx="30" cy="55" r="2" fill="#2dd4bf" />
    <circle cx="28" cy="80" r="2" fill="#2dd4bf" />

    <polygon points="68,15 76,8 76,105 68,112" fill="url(#hp_blue_light)" />
    <polygon points="76,8 98,25 98,88 76,105" fill="url(#hp_cyan_facet)" />
    <path d="M94,40 L82,50 L82,82 M90,62 L82,69 M92,82 L84,89" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-opacity="0.9" />
    <circle cx="94" cy="40" r="2.5" fill="#7dd3fc" />
    <circle cx="90" cy="62" r="2" fill="#7dd3fc" />
    <circle cx="92" cy="82" r="2" fill="#7dd3fc" />

    <polygon points="44,52 76,52 76,70 44,70" fill="#061b30" opacity="0.9" />

    <path d="M20,95 C36,92 48,76 60,63 C72,50 86,36 102,28 C100,38 90,52 78,65 C64,80 48,97 20,95 Z" fill="#034d35" opacity="0.5" />
    <path d="M22,92 C38,88 50,72 61,59 C72,46 86,32 100,24 C100,33 90,46 79,60 C66,76 50,94 22,92 Z" fill="url(#hp_green_ribbon)" />
    <path d="M26,88 C40,84 52,68 62,56 C74,42 88,29 98,25 C92,30 80,44 70,58 C58,74 44,87 26,88 Z" fill="url(#hp_green_highlight)" opacity="0.9" />
    <ellipse cx="61" cy="58" rx="4" ry="2" transform="rotate(-35 61 58)" fill="#ffffff" opacity="0.7" />
  </g>
`;

function svgStringToPngDataUrl(svgString: string, width: number, height: number): Promise<string> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const encoded = encodeURIComponent(svgString);
      const url = `data:image/svg+xml;charset=utf-8,${encoded}`;

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = width * 2;
          canvas.height = height * 2;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.scale(2, 2);
            ctx.drawImage(img, 0, 0, width, height);
            const png = canvas.toDataURL('image/png');
            resolve(png);
            return;
          }
        } catch (e) {
          console.warn('Canvas rasterize error:', e);
        }
        resolve('');
      };

      img.onerror = (err) => {
        console.warn('SVG img load error:', err);
        resolve('');
      };

      img.src = url;
    } catch (err) {
      console.warn('svgStringToPngDataUrl error:', err);
      resolve('');
    }
  });
}

// In-memory cache for ultra-fast instant PDF generation
let cachedWatermarkDataUrl = '';
let cachedFullHeaderDataUrl = '';
let cachedLogoDataUrl = '';

/**
 * Generates an ultra high-definition PNG Data URL of the 3D HASPAHO crystal icon
 * with subtle translucency (opacity ~0.065) to serve as an official institutional
 * watermark across A4 document pages.
 */
export async function generateHaspahoWatermarkDataUrl(): Promise<string> {
  if (cachedWatermarkDataUrl) return cachedWatermarkDataUrl;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="380" height="425" viewBox="0 0 120 135" fill="none">
      ${HASPAHO_CRYSTAL_SVG_DEFS}
      <g opacity="0.075">
        ${HASPAHO_CRYSTAL_SVG_GRAPHIC}
      </g>
    </svg>
  `.trim();

  const dataUrl = await svgStringToPngDataUrl(svg, 380, 425);
  if (dataUrl) cachedWatermarkDataUrl = dataUrl;
  return dataUrl;
}

/**
 * Generates a high-definition PNG Data URL of the complete HASPAHO Header Card
 * featuring the 3D crystal 'H' icon, brand typography, and the prominent
 * "VERIFICADO • SALVO NO SISTEMA" badge exactly as displayed in the UI screenshot.
 */
export async function generateHaspahoFullHeaderPngDataUrl(): Promise<string> {
  if (cachedFullHeaderDataUrl) return cachedFullHeaderDataUrl;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="560" height="152" viewBox="0 0 560 152" fill="none">
      ${HASPAHO_CRYSTAL_SVG_DEFS}
      
      <!-- Card Container Box -->
      <rect x="2" y="2" width="556" height="148" rx="16" fill="#ffffff" stroke="#a7f3d0" stroke-width="2" />
      
      <!-- 3D Crystal Logo Icon -->
      <g transform="translate(18, 14) scale(0.64)">
        ${HASPAHO_CRYSTAL_SVG_GRAPHIC}
      </g>
      
      <!-- Brand Typography -->
      <text x="110" y="44" fill="#0a2540" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="27" letter-spacing="-0.5">HASPAHO</text>
      <text x="110" y="65" fill="#1e293b" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="14" letter-spacing="0.2">DESENVOLVEDOR FULL STACK</text>
      <text x="110" y="82" fill="#059669" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="10" letter-spacing="1">TECNOLOGIA • COBRANÇAS E RECEBÍVEIS</text>
      
      <!-- Verified Pill Badge -->
      <g transform="translate(18, 98)">
        <rect x="0" y="0" width="524" height="36" rx="18" fill="#ecfdf5" stroke="#10b981" stroke-width="2" />
        
        <!-- Rosette Checkmark Icon -->
        <g transform="translate(16, 7)">
          <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" stroke="#059669" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="#ecfdf5" />
          <path d="M8.5 12.3L10.8 14.6L15.5 9.8" stroke="#059669" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        
        <text x="262" y="23" text-anchor="middle" fill="#064e3b" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="12.5" letter-spacing="0.8">VERIFICADO • SALVO NO SISTEMA</text>
        <circle cx="504" cy="18" r="4.5" fill="#10b981" />
      </g>
    </svg>
  `.trim();

  const dataUrl = await svgStringToPngDataUrl(svg, 560, 152);
  if (dataUrl) cachedFullHeaderDataUrl = dataUrl;
  return dataUrl;
}

/**
 * Generates a high-definition PNG Data URL of the official HASPAHO Logo (Stacked / Full variant)
 * featuring the 3D crystal 'H' icon, brand name, and taglines.
 */
export async function generateHaspahoLogoPngDataUrl(): Promise<string> {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="340" height="240" viewBox="0 0 340 240" fill="none">
      ${HASPAHO_CRYSTAL_SVG_DEFS}
      <rect width="340" height="240" rx="12" fill="#ffffff" />
      <g transform="translate(130, 16) scale(0.68)">
        ${HASPAHO_CRYSTAL_SVG_GRAPHIC}
      </g>
      <text x="170" y="142" text-anchor="middle" fill="#0e2a47" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="25" letter-spacing="-0.5">HASPAHO</text>
      <text x="170" y="168" text-anchor="middle" fill="#0e2a47" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="700" font-size="14" letter-spacing="0.4">DESENVOLVEDOR FULL STACK</text>
      <text x="170" y="190" text-anchor="middle" fill="#047857" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="10" letter-spacing="1">TECNOLOGIA • COBRANÇAS E RECEBÍVEIS</text>
    </svg>
  `.trim();

  const dataUrl = await svgStringToPngDataUrl(svg, 340, 240);
  if (dataUrl) cachedLogoDataUrl = dataUrl;
  return dataUrl;
}

/**
 * Generates a high-definition PNG Data URL of the official HASPAHO Logo (Horizontal variant)
 * suitable for document headers.
 */
export async function generateHaspahoHorizontalLogoPngDataUrl(): Promise<string> {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="460" height="90" viewBox="0 0 460 90" fill="none">
      ${HASPAHO_CRYSTAL_SVG_DEFS}
      <rect width="460" height="90" rx="10" fill="#ffffff" />
      <g transform="translate(16, 12) scale(0.5)">
        ${HASPAHO_CRYSTAL_SVG_GRAPHIC}
      </g>
      <text x="88" y="42" fill="#0e2a47" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="22" letter-spacing="-0.5">HASPAHO</text>
      <text x="200" y="42" fill="#0e2a47" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="700" font-size="14">DESENVOLVEDOR FULL STACK</text>
      <text x="88" y="66" fill="#047857" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="9.5" letter-spacing="1">TECNOLOGIA • COBRANÇAS E RECEBÍVEIS</text>
    </svg>
  `.trim();

  return await svgStringToPngDataUrl(svg, 460, 90);
}
