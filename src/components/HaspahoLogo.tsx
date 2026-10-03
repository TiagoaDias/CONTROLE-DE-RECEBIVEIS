import React from 'react';

interface HaspahoLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  variant?: 'full' | 'horizontal' | 'icon' | 'badge' | 'plaque' | '3d-card';
  darkTheme?: boolean;
  className?: string;
  showSubtitle?: boolean;
  customSubtitle?: string;
  customName?: string;
}

export const HaspahoLogo: React.FC<HaspahoLogoProps> = ({
  size = 'md',
  variant = 'full',
  darkTheme = false,
  className = '',
  showSubtitle = true,
  customSubtitle,
  customName,
}) => {
  const brandName = customName || 'DESENVOLVEDOR FULL STACK';
  const rawId = React.useId();
  const idPrefix = `hl_${rawId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  const blueDarkId = `${idPrefix}_bd`;
  const blueLightId = `${idPrefix}_bl`;
  const blueRightId = `${idPrefix}_br`;
  const cyanFacetId = `${idPrefix}_cf`;
  const greenRibbonId = `${idPrefix}_gr`;
  const greenHighlightId = `${idPrefix}_gh`;

  // Dimensions based on size
  const iconDimensions = {
    xs: { w: 18, h: 20 },
    sm: { w: 32, h: 36 },
    md: { w: 48, h: 54 },
    lg: { w: 72, h: 81 },
    xl: { w: 100, h: 112 },
    '2xl': { w: 140, h: 156 },
  }[size];

  const textColor = darkTheme ? 'text-white' : 'text-[#0e2a47]';
  const subtitleColor = darkTheme ? 'text-emerald-400' : 'text-emerald-700';

  // SVG rendering the high-tech faceted 'H' with emerald green ribbon and tech circuit lines
  const renderIcon = () => (
    <svg
      width={iconDimensions.w}
      height={iconDimensions.h}
      viewBox="0 0 120 135"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        width: `${iconDimensions.w}px`,
        height: `${iconDimensions.h}px`,
        minWidth: `${iconDimensions.w}px`,
        minHeight: `${iconDimensions.h}px`,
        display: 'inline-block',
        filter: 'drop-shadow(0px 2px 4px rgba(8, 43, 73, 0.28))',
      }}
      className="shrink-0 transition-transform duration-300 hover:scale-105 select-none"
    >
      <defs>
        {/* Gradient for left facet dark */}
        <linearGradient id={blueDarkId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#082b49" />
          <stop offset="100%" stopColor="#0a192f" />
        </linearGradient>

        {/* Gradient for left facet light */}
        <linearGradient id={blueLightId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0d5c91" />
          <stop offset="50%" stopColor="#0a7ea4" />
          <stop offset="100%" stopColor="#0b3d66" />
        </linearGradient>

        {/* Gradient for right facet dark */}
        <linearGradient id={blueRightId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0e4370" />
          <stop offset="100%" stopColor="#061b30" />
        </linearGradient>

        {/* Gradient for right facet light */}
        <linearGradient id={cyanFacetId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#14a0c8" />
          <stop offset="100%" stopColor="#0d527a" />
        </linearGradient>

        {/* Glowing emerald green ribbon gradient */}
        <linearGradient id={greenRibbonId} x1="10%" y1="90%" x2="90%" y2="10%">
          <stop offset="0%" stopColor="#006644" />
          <stop offset="35%" stopColor="#00a86b" />
          <stop offset="70%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>

        {/* Ribbon upper highlight */}
        <linearGradient id={greenHighlightId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6ee7b7" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>

      <g>
        {/* Left Pillar - Facet A (Back/Base) */}
        <polygon
          points="22,25 44,8 44,105 22,88"
          fill={`url(#${blueDarkId})`}
        />

        {/* Left Pillar - Facet B (Front 3D chamfer) */}
        <polygon
          points="44,8 52,15 52,112 44,105"
          fill={`url(#${blueLightId})`}
        />

        {/* Left Tech Circuit Lines */}
        <path
          d="M26,38 L38,48 L38,75 M30,55 L38,62 M28,80 L36,87"
          stroke="#14b8a6"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeOpacity="0.75"
        />
        <circle cx="26" cy="38" r="2" fill="#2dd4bf" />
        <circle cx="30" cy="55" r="1.5" fill="#2dd4bf" />
        <circle cx="28" cy="80" r="1.5" fill="#2dd4bf" />

        {/* Right Pillar - Facet A (Front chamfer) */}
        <polygon
          points="68,15 76,8 76,105 68,112"
          fill={`url(#${blueLightId})`}
        />

        {/* Right Pillar - Facet B (Main side face) */}
        <polygon
          points="76,8 98,25 98,88 76,105"
          fill={`url(#${cyanFacetId})`}
        />

        {/* Right Tech Circuit Lines */}
        <path
          d="M94,40 L82,50 L82,82 M90,62 L82,69 M92,82 L84,89"
          stroke="#38bdf8"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeOpacity="0.8"
        />
        <circle cx="94" cy="40" r="2" fill="#7dd3fc" />
        <circle cx="90" cy="62" r="1.5" fill="#7dd3fc" />
        <circle cx="92" cy="82" r="1.5" fill="#7dd3fc" />

        {/* Central Vertical Connector Core */}
        <polygon
          points="44,52 76,52 76,70 44,70"
          fill="#061b30"
          opacity="0.9"
        />

        {/* Dynamic Curved Emerald Green Ribbon Swoosh */}
        {/* Layer 1: Under shadow for ribbon */}
        <path
          d="M20,95 C36,92 48,76 60,63 C72,50 86,36 102,28 C100,38 90,52 78,65 C64,80 48,97 20,95 Z"
          fill="#034d35"
          opacity="0.5"
        />

        {/* Layer 2: Main Emerald Wave */}
        <path
          d="M22,92 C38,88 50,72 61,59 C72,46 86,32 100,24 C100,33 90,46 79,60 C66,76 50,94 22,92 Z"
          fill={`url(#${greenRibbonId})`}
        />

        {/* Layer 3: Dynamic Top Highlight curve */}
        <path
          d="M26,88 C40,84 52,68 62,56 C74,42 88,29 98,25 C92,30 80,44 70,58 C58,74 44,87 26,88 Z"
          fill={`url(#${greenHighlightId})`}
          opacity="0.9"
        />

        {/* Inner Light Glow Spark */}
        <ellipse cx="61" cy="58" rx="3.5" ry="1.5" transform="rotate(-35 61 58)" fill="#ffffff" opacity="0.6" />
      </g>
    </svg>
  );

  if (variant === 'icon') {
    return <div className={`inline-flex items-center justify-center ${className}`}>{renderIcon()}</div>;
  }

  if (variant === 'horizontal') {
    return (
      <div className={`inline-flex items-center gap-2.5 sm:gap-3 ${className}`} data-brand-logo="true">
        {renderIcon()}
        <div className="flex flex-col text-left select-none min-w-0">
          <div className="flex flex-wrap sm:flex-nowrap items-baseline gap-1 sm:gap-1.5">
            <span className={`font-black tracking-tight text-base sm:text-lg leading-none whitespace-nowrap brand-logo-text shrink-0 ${textColor}`}>
              HASPAHO
            </span>
            <span className={`text-xs sm:text-sm font-bold tracking-normal opacity-90 whitespace-nowrap ${textColor}`}>
              {brandName}
            </span>
          </div>
          {showSubtitle && (
            <span className={`text-[8px] sm:text-[10px] font-black tracking-wider uppercase mt-0.5 whitespace-nowrap ${subtitleColor}`}>
              {customSubtitle || 'TECNOLOGIA • COBRANÇAS E RECEBÍVEIS'}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'badge') {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/5 dark:bg-white/10 border border-slate-200/60 dark:border-white/10 ${className}`} data-brand-logo="true">
        {renderIcon()}
        <div className="flex flex-col text-left">
          <span className={`font-black text-xs tracking-wider leading-none whitespace-nowrap brand-logo-text ${textColor}`}>
            HASPAHO
          </span>
          <span className={`text-[8px] font-bold uppercase tracking-widest whitespace-nowrap ${subtitleColor}`}>
            {brandName}
          </span>
        </div>
      </div>
    );
  }

  if (variant === 'plaque') {
    // Brushed metallic aluminum nameplate from user's official photo
    return (
      <div
        className={`inline-flex flex-col items-center justify-center px-6 py-2.5 rounded-lg border border-slate-300 shadow-md bg-gradient-to-b from-slate-100 via-slate-200 to-slate-300 select-none relative overflow-hidden ${className}`}
        style={{
          boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.8), 0 3px 6px rgba(0,0,0,0.12)',
        }}
        data-brand-logo="true"
      >
        {/* Subtle brushed metal horizontal lines */}
        <div
          className="absolute inset-0 opacity-25 pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.05) 1px, rgba(0,0,0,0.05) 2px)',
          }}
        />
        <div className="relative z-10 flex items-center gap-2 font-black tracking-wider text-slate-800 text-xs sm:text-sm md:text-base whitespace-nowrap">
          <span className="brand-logo-text">HASPAHO</span>
          <span className="text-slate-400">•</span>
          <span>{brandName}</span>
        </div>
        <div className="relative z-10 text-[8px] sm:text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-600 mt-0.5 whitespace-nowrap">
          {customSubtitle || 'TECNOLOGIA • COBRANÇAS E RECEBÍVEIS'}
        </div>
      </div>
    );
  }

  if (variant === '3d-card') {
    // Executive stationery card mockup from the user's official photo
    return (
      <div
        className={`relative p-5 sm:p-6 rounded-2xl bg-white shadow-2xl border border-slate-200/80 flex flex-col items-center justify-between text-center select-none transition-transform hover:-translate-y-1 duration-300 ${className}`}
        style={{
          boxShadow: '0 20px 40px -15px rgba(10,35,60,0.18), 0 0 0 1px rgba(255,255,255,0.8) inset',
        }}
        data-brand-logo="true"
      >
        <div className="w-full flex justify-between items-center text-[9px] text-slate-400 font-mono whitespace-nowrap">
          <span>haspaho.com.br</span>
          <span>(14) 99733-9863</span>
        </div>
        <div className="my-4">{renderIcon()}</div>
        <div className="flex flex-col items-center">
          <span className="font-black text-slate-900 tracking-tight text-base sm:text-lg whitespace-nowrap brand-logo-text">HASPAHO</span>
          <span className="font-bold text-slate-800 text-xs sm:text-sm whitespace-nowrap">{brandName}</span>
          <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-emerald-600 mt-1 whitespace-nowrap">
            TECNOLOGIA • COBRANÇAS E RECEBÍVEIS
          </span>
        </div>
      </div>
    );
  }

  // Default 'full' variant (Stacked Brand Presentation as seen on the main corporate poster)
  return (
    <div className={`flex flex-col items-center text-center select-none ${className}`} data-brand-logo="true">
      {renderIcon()}
      <div className="mt-2.5 flex flex-col items-center">
        <h1 className={`font-black tracking-tight text-xl sm:text-2xl leading-none whitespace-nowrap brand-logo-text ${textColor}`}>
          HASPAHO
        </h1>
        <h2 className={`font-bold tracking-wider text-sm sm:text-base leading-snug mt-0.5 whitespace-nowrap ${textColor}`}>
          {brandName}
        </h2>
        {showSubtitle && (
          <p className={`text-[10px] sm:text-[11px] font-black tracking-widest uppercase mt-1 whitespace-nowrap ${subtitleColor}`}>
            {customSubtitle || 'TECNOLOGIA • COBRANÇAS E RECEBÍVEIS'}
          </p>
        )}
      </div>
    </div>
  );
};
