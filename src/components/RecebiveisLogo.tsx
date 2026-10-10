import React from 'react';

interface RecebiveisLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'icon' | 'badge';
  darkTheme?: boolean;
  className?: string;
}

export const RecebiveisLogo: React.FC<RecebiveisLogoProps> = ({
  size = 'md',
  variant = 'full',
  darkTheme = false,
  className = '',
}) => {
  const dimensions = {
    xs: { w: 26, h: 26, text: 'text-xs' },
    sm: { w: 36, h: 36, text: 'text-sm' },
    md: { w: 46, h: 46, text: 'text-base' },
    lg: { w: 60, h: 60, text: 'text-xl' },
    xl: { w: 76, h: 76, text: 'text-2xl' },
  }[size];

  const textColor = darkTheme ? 'text-white' : 'text-slate-900';
  const subtitleColor = darkTheme ? 'text-emerald-400' : 'text-emerald-600';

  return (
    <div className={`inline-flex items-center gap-3 select-none group ${className}`}>
      <div 
        className="relative flex items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-950 via-slate-900 to-indigo-900 p-2 shadow-xl shadow-blue-950/30 border border-blue-400/30 shrink-0 transform group-hover:scale-105 transition-transform duration-300"
        style={{ width: `${dimensions.w}px`, height: `${dimensions.h}px` }}
      >
        {/* Glow & Lighting Effects */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-400/25 via-cyan-500/15 to-transparent pointer-events-none" />
        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 blur-[2px] animate-pulse" />
        
        {/* Official Vector SVG Icon representing Financial Management, Growth & Security */}
        <svg
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full relative z-10 drop-shadow-md"
        >
          {/* Background subtle grid / shield outline */}
          <path d="M18 3L30 8V17C30 24 24 30 18 33C12 30 6 24 6 17V8L18 3Z" fill="url(#logoGrad)" fillOpacity="0.25" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.4" />
          
          {/* Financial Growth Bars */}
          <rect x="9" y="19" width="4" height="10" rx="1" fill="#38bdf8" />
          <rect x="15" y="13" width="4" height="16" rx="1" fill="#0ea5e9" />
          <rect x="21" y="8" width="4" height="21" rx="1" fill="#10b981" />
          
          {/* Currency / Secure Check Node */}
          <circle cx="23" cy="11" r="2.5" fill="#34d399" />
          <path d="M11 15L15 11L19 14L25 8" stroke="#38bdf8" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          
          <defs>
            <linearGradient id="logoGrad" x1="6" y1="3" x2="30" y2="33" gradientUnits="userSpaceOnUse">
              <stop stopColor="#1e3a8a" />
              <stop offset="1" stopColor="#065f46" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {variant === 'full' && (
        <div className="flex flex-col min-w-0">
          <div className={`font-black tracking-tight leading-none truncate flex items-center gap-1.5 ${dimensions.text} ${textColor}`}>
            <span>Recebíveis</span>
            <span className="text-emerald-500 font-extrabold">&</span>
            <span>Parcelas</span>
          </div>
          <div className={`text-[10px] font-bold tracking-widest uppercase mt-1 ${subtitleColor} flex items-center gap-1.5`}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            <span>Gestão & Tech Pro</span>
          </div>
        </div>
      )}

      {variant === 'badge' && (
        <div className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
          Oficial PRO
        </div>
      )}
    </div>
  );
};

