const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// 1. High Resolution App Icon SVG (512x512) - ONLY the huge 3D Haspaho Logo on pure white background (#ffffff)
const fullIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Drop shadow for 3D logo on pure white background -->
    <filter id="logoShadow" x="-25%" y="-25%" width="150%" height="150%">
      <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#0f172a" flood-opacity="0.22"/>
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#0284c7" flood-opacity="0.16"/>
    </filter>

    <!-- Facet Gradients -->
    <linearGradient id="blueDarkFacet" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#082b49" />
      <stop offset="100%" stop-color="#0a192f" />
    </linearGradient>

    <linearGradient id="blueLightFacet" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0d5c91" />
      <stop offset="50%" stop-color="#0a7ea4" />
      <stop offset="100%" stop-color="#0b3d66" />
    </linearGradient>

    <linearGradient id="blueRightFacet" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0e4370" />
      <stop offset="100%" stop-color="#061b30" />
    </linearGradient>

    <linearGradient id="cyanFacet" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#14a0c8" />
      <stop offset="60%" stop-color="#0d527a" />
      <stop offset="100%" stop-color="#08334c" />
    </linearGradient>

    <!-- Emerald Ribbon Gradient -->
    <linearGradient id="greenRibbonGrad" x1="10%" y1="90%" x2="90%" y2="10%">
      <stop offset="0%" stop-color="#006644" />
      <stop offset="35%" stop-color="#00a86b" />
      <stop offset="70%" stop-color="#10b981" />
      <stop offset="100%" stop-color="#34d399" />
    </linearGradient>

    <!-- Ribbon Highlight -->
    <linearGradient id="greenHighlightGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#a7f3d0" />
      <stop offset="50%" stop-color="#34d399" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>
  </defs>

  <!-- Pure White Full-Bleed Background -->
  <rect x="0" y="0" width="512" height="512" fill="#ffffff"/>

  <!-- Extra-Large Centered 3D Haspaho Symbol Only (No Text) -->
  <g transform="translate(12, 16) scale(4.0)" filter="url(#logoShadow)">
    <!-- Ambient Shadow Under Logo -->
    <path d="M22,25 L44,8 L52,15 L98,25 L98,88 L76,105 L68,112 L44,105 L22,88 Z" fill="#0f172a" opacity="0.16" transform="translate(0, 4)"/>

    <!-- Left Pillar Base -->
    <polygon points="22,25 44,8 44,105 22,88" fill="url(#blueDarkFacet)"/>

    <!-- Left Pillar Chamfer -->
    <polygon points="44,8 52,15 52,112 44,105" fill="url(#blueLightFacet)"/>

    <!-- Left Tech Circuits -->
    <path d="M26,38 L38,48 L38,75 M30,55 L38,62 M28,80 L36,87" stroke="#2dd4bf" stroke-width="2" stroke-linecap="round" stroke-opacity="0.95"/>
    <circle cx="26" cy="38" r="2.5" fill="#5eead4" />
    <circle cx="30" cy="55" r="2.2" fill="#5eead4" />
    <circle cx="28" cy="80" r="2.2" fill="#5eead4" />

    <!-- Right Pillar Chamfer -->
    <polygon points="68,15 76,8 76,105 68,112" fill="url(#blueRightFacet)"/>

    <!-- Right Pillar Main Face -->
    <polygon points="76,8 98,25 98,88 76,105" fill="url(#cyanFacet)"/>

    <!-- Right Tech Circuits -->
    <path d="M94,40 L82,50 L82,82 M90,62 L82,69 M92,82 L84,89" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-opacity="0.95"/>
    <circle cx="94" cy="40" r="2.5" fill="#7dd3fc" />
    <circle cx="90" cy="62" r="2.2" fill="#7dd3fc" />
    <circle cx="92" cy="82" r="2.2" fill="#7dd3fc" />

    <!-- Central Connector -->
    <polygon points="44,52 76,52 76,70 44,70" fill="#081b33"/>

    <!-- Dynamic Emerald Green Ribbon Swoosh -->
    <path d="M20,95 C36,92 48,76 60,63 C72,50 86,36 102,28 C100,38 90,52 78,65 C64,80 48,97 20,95 Z" fill="#044e32" opacity="0.45"/>
    <path d="M22,92 C38,88 50,72 61,59 C72,46 86,32 100,24 C100,33 90,46 79,60 C66,76 50,94 22,92 Z" fill="url(#greenRibbonGrad)"/>
    <path d="M26,88 C40,84 52,68 62,56 C74,42 88,29 98,25 C92,30 80,44 70,58 C58,74 44,87 26,88 Z" fill="url(#greenHighlightGrad)" opacity="0.98"/>

    <!-- Sparkle Star on Crest -->
    <g transform="translate(98, 24)">
      <circle cx="0" cy="0" r="3" fill="#ffffff" filter="drop-shadow(0 0 3px #38bdf8)"/>
      <path d="M-6,0 L6,0 M0,-6 L0,6" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round"/>
    </g>

    <!-- Sparkle on Bow -->
    <g transform="translate(24, 91)">
      <circle cx="0" cy="0" r="2.2" fill="#ffffff" filter="drop-shadow(0 0 3px #34d399)"/>
    </g>
  </g>
</svg>`;

// 2. Android Adaptive Icon Foreground SVG (432x432 viewbox with huge centered symbol in safe zone, no text)
const adaptiveForegroundSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 432 432" width="432" height="432">
  <defs>
    <filter id="fgShadow" x="-25%" y="-25%" width="150%" height="150%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#0f172a" flood-opacity="0.24"/>
      <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#0284c7" flood-opacity="0.16"/>
    </filter>

    <linearGradient id="fgBlueDark" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#082b49" />
      <stop offset="100%" stop-color="#0a192f" />
    </linearGradient>

    <linearGradient id="fgBlueLight" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0d5c91" />
      <stop offset="50%" stop-color="#0a7ea4" />
      <stop offset="100%" stop-color="#0b3d66" />
    </linearGradient>

    <linearGradient id="fgBlueRight" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0e4370" />
      <stop offset="100%" stop-color="#061b30" />
    </linearGradient>

    <linearGradient id="fgCyan" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#14a0c8" />
      <stop offset="60%" stop-color="#0d527a" />
      <stop offset="100%" stop-color="#08334c" />
    </linearGradient>

    <linearGradient id="fgGreenRibbon" x1="10%" y1="90%" x2="90%" y2="10%">
      <stop offset="0%" stop-color="#006644" />
      <stop offset="35%" stop-color="#00a86b" />
      <stop offset="70%" stop-color="#10b981" />
      <stop offset="100%" stop-color="#34d399" />
    </linearGradient>

    <linearGradient id="fgGreenHighlight" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#a7f3d0" />
      <stop offset="50%" stop-color="#34d399" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>
  </defs>

  <!-- Large Centered Symbol Only within Android Adaptive Safe Zone -->
  <g transform="translate(60.45, 63) scale(2.55)" filter="url(#fgShadow)">
    <path d="M22,25 L44,8 L52,15 L98,25 L98,88 L76,105 L68,112 L44,105 L22,88 Z" fill="#0f172a" opacity="0.16" transform="translate(0, 4)"/>
    <polygon points="22,25 44,8 44,105 22,88" fill="url(#fgBlueDark)"/>
    <polygon points="44,8 52,15 52,112 44,105" fill="url(#fgBlueLight)"/>
    <path d="M26,38 L38,48 L38,75 M30,55 L38,62 M28,80 L36,87" stroke="#2dd4bf" stroke-width="2" stroke-linecap="round" stroke-opacity="0.95"/>
    <circle cx="26" cy="38" r="2.5" fill="#5eead4" />
    <circle cx="30" cy="55" r="2.2" fill="#5eead4" />
    <circle cx="28" cy="80" r="2.2" fill="#5eead4" />
    <polygon points="68,15 76,8 76,105 68,112" fill="url(#fgBlueRight)"/>
    <polygon points="76,8 98,25 98,88 76,105" fill="url(#fgCyan)"/>
    <path d="M94,40 L82,50 L82,82 M90,62 L82,69 M92,82 L84,89" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-opacity="0.95"/>
    <circle cx="94" cy="40" r="2.5" fill="#7dd3fc" />
    <circle cx="90" cy="62" r="2.2" fill="#7dd3fc" />
    <circle cx="92" cy="82" r="2.2" fill="#7dd3fc" />
    <polygon points="44,52 76,52 76,70 44,70" fill="#081b33"/>
    <path d="M20,95 C36,92 48,76 60,63 C72,50 86,36 102,28 C100,38 90,52 78,65 C64,80 48,97 20,95 Z" fill="#044e32" opacity="0.45"/>
    <path d="M22,92 C38,88 50,72 61,59 C72,46 86,32 100,24 C100,33 90,46 79,60 C66,76 50,94 22,92 Z" fill="url(#fgGreenRibbon)"/>
    <path d="M26,88 C40,84 52,68 62,56 C74,42 88,29 98,25 C92,30 80,44 70,58 C58,74 44,87 26,88 Z" fill="url(#fgGreenHighlight)" opacity="0.98"/>
    <g transform="translate(98, 24)">
      <circle cx="0" cy="0" r="3" fill="#ffffff" filter="drop-shadow(0 0 3px #38bdf8)"/>
      <path d="M-6,0 L6,0 M0,-6 L0,6" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round"/>
    </g>
    <g transform="translate(24, 91)">
      <circle cx="0" cy="0" r="2.2" fill="#ffffff" filter="drop-shadow(0 0 3px #34d399)"/>
    </g>
  </g>
</svg>`;

function buildSplashSvg(width, height) {
  const minDim = Math.min(width, height);
  const targetLogoSize = minDim * 0.58;
  const scale = targetLogoSize / 104;
  const tx = width / 2 - 61 * scale;
  const ty = height / 2 - 60 * scale;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <defs>
      <filter id="spShadow" x="-25%" y="-25%" width="150%" height="150%">
        <feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#0f172a" flood-opacity="0.20"/>
      </filter>
      <linearGradient id="spBlueDark" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#082b49" />
        <stop offset="100%" stop-color="#0a192f" />
      </linearGradient>
      <linearGradient id="spBlueLight" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0d5c91" />
        <stop offset="50%" stop-color="#0a7ea4" />
        <stop offset="100%" stop-color="#0b3d66" />
      </linearGradient>
      <linearGradient id="spBlueRight" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0e4370" />
        <stop offset="100%" stop-color="#061b30" />
      </linearGradient>
      <linearGradient id="spCyan" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#14a0c8" />
        <stop offset="60%" stop-color="#0d527a" />
        <stop offset="100%" stop-color="#08334c" />
      </linearGradient>
      <linearGradient id="spGreenRibbon" x1="10%" y1="90%" x2="90%" y2="10%">
        <stop offset="0%" stop-color="#006644" />
        <stop offset="35%" stop-color="#00a86b" />
        <stop offset="70%" stop-color="#10b981" />
        <stop offset="100%" stop-color="#34d399" />
      </linearGradient>
      <linearGradient id="spGreenHighlight" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#a7f3d0" />
        <stop offset="50%" stop-color="#34d399" />
        <stop offset="100%" stop-color="#059669" />
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>
    <g transform="translate(${tx.toFixed(2)}, ${ty.toFixed(2)}) scale(${scale.toFixed(3)})" filter="url(#spShadow)">
      <path d="M22,25 L44,8 L52,15 L98,25 L98,88 L76,105 L68,112 L44,105 L22,88 Z" fill="#0f172a" opacity="0.14" transform="translate(0, 4)"/>
      <polygon points="22,25 44,8 44,105 22,88" fill="url(#spBlueDark)"/>
      <polygon points="44,8 52,15 52,112 44,105" fill="url(#spBlueLight)"/>
      <path d="M26,38 L38,48 L38,75 M30,55 L38,62 M28,80 L36,87" stroke="#2dd4bf" stroke-width="2" stroke-linecap="round" stroke-opacity="0.95"/>
      <circle cx="26" cy="38" r="2.5" fill="#5eead4" />
      <circle cx="30" cy="55" r="2.2" fill="#5eead4" />
      <circle cx="28" cy="80" r="2.2" fill="#5eead4" />
      <polygon points="68,15 76,8 76,105 68,112" fill="url(#spBlueRight)"/>
      <polygon points="76,8 98,25 98,88 76,105" fill="url(#spCyan)"/>
      <path d="M94,40 L82,50 L82,82 M90,62 L82,69 M92,82 L84,89" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-opacity="0.95"/>
      <circle cx="94" cy="40" r="2.5" fill="#7dd3fc" />
      <circle cx="90" cy="62" r="2.2" fill="#7dd3fc" />
      <circle cx="92" cy="82" r="2.2" fill="#7dd3fc" />
      <polygon points="44,52 76,52 76,70 44,70" fill="#081b33"/>
      <path d="M20,95 C36,92 48,76 60,63 C72,50 86,36 102,28 C100,38 90,52 78,65 C64,80 48,97 20,95 Z" fill="#044e32" opacity="0.45"/>
      <path d="M22,92 C38,88 50,72 61,59 C72,46 86,32 100,24 C100,33 90,46 79,60 C66,76 50,94 22,92 Z" fill="url(#spGreenRibbon)"/>
      <path d="M26,88 C40,84 52,68 62,56 C74,42 88,29 98,25 C92,30 80,44 70,58 C58,74 44,87 26,88 Z" fill="url(#spGreenHighlight)" opacity="0.98"/>
      <g transform="translate(98, 24)">
        <circle cx="0" cy="0" r="3" fill="#ffffff" filter="drop-shadow(0 0 3px #38bdf8)"/>
        <path d="M-6,0 L6,0 M0,-6 L0,6" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round"/>
      </g>
      <g transform="translate(24, 91)">
        <circle cx="0" cy="0" r="2.2" fill="#ffffff" filter="drop-shadow(0 0 3px #34d399)"/>
      </g>
    </g>
  </svg>`;
}

async function main() {
  console.log('Writing public/icon.svg...');
  fs.writeFileSync(path.join(__dirname, '../public/icon.svg'), fullIconSvg);

  const fullIconBuf = Buffer.from(fullIconSvg);
  const fgBuf = Buffer.from(adaptiveForegroundSvg);

  // 1. Web / PWA Assets
  console.log('Generating public/icon-512.png...');
  await sharp(fullIconBuf).resize(512, 512).png().toFile(path.join(__dirname, '../public/icon-512.png'));

  console.log('Generating public/icon-192.png...');
  await sharp(fullIconBuf).resize(192, 192).png().toFile(path.join(__dirname, '../public/icon-192.png'));

  console.log('Generating public/favicon.png...');
  await sharp(fullIconBuf).resize(64, 64).png().toFile(path.join(__dirname, '../public/favicon.png'));

  // 2. Android Mipmaps
  const mipmaps = [
    { dir: 'mipmap-mdpi', size: 48, fgSize: 108 },
    { dir: 'mipmap-hdpi', size: 72, fgSize: 162 },
    { dir: 'mipmap-xhdpi', size: 96, fgSize: 216 },
    { dir: 'mipmap-xxhdpi', size: 144, fgSize: 324 },
    { dir: 'mipmap-xxxhdpi', size: 192, fgSize: 432 },
  ];

  for (const m of mipmaps) {
    const targetDir = path.join(__dirname, '../android/app/src/main/res', m.dir);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    await sharp(fullIconBuf)
      .resize(m.size, m.size)
      .png()
      .toFile(path.join(targetDir, 'ic_launcher.png'));

    await sharp(fullIconBuf)
      .resize(m.size, m.size)
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_round.png'));

    await sharp(fgBuf)
      .resize(m.fgSize, m.fgSize)
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_foreground.png'));

    console.log(`Generated Android ${m.dir} icons (size ${m.size}px, fg ${m.fgSize}px)`);
  }

  // 3. Android Splash Screens (Pure white background + large logo only)
  const splashConfigs = [
    { dir: 'drawable', w: 480, h: 800 },
    { dir: 'drawable-port-mdpi', w: 320, h: 480 },
    { dir: 'drawable-port-hdpi', w: 480, h: 800 },
    { dir: 'drawable-port-xhdpi', w: 720, h: 1280 },
    { dir: 'drawable-port-xxhdpi', w: 960, h: 1600 },
    { dir: 'drawable-port-xxxhdpi', w: 1280, h: 1920 },
    { dir: 'drawable-land-mdpi', w: 480, h: 320 },
    { dir: 'drawable-land-hdpi', w: 800, h: 480 },
    { dir: 'drawable-land-xhdpi', w: 1280, h: 720 },
    { dir: 'drawable-land-xxhdpi', w: 1600, h: 960 },
    { dir: 'drawable-land-xxxhdpi', w: 1920, h: 1280 },
  ];

  for (const sp of splashConfigs) {
    const targetDir = path.join(__dirname, '../android/app/src/main/res', sp.dir);
    if (fs.existsSync(targetDir)) {
      const spSvg = Buffer.from(buildSplashSvg(sp.w, sp.h));
      await sharp(spSvg)
        .resize(sp.w, sp.h)
        .png()
        .toFile(path.join(targetDir, 'splash.png'));
      console.log(`Generated white splash screen in ${sp.dir} (${sp.w}x${sp.h})`);
    }
  }

  console.log('All Haspaho icons and white splash screens successfully generated!');
}

main().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
