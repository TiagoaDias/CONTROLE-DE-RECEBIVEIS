import React from 'react';

interface CosmicMoonRocketProps {
  variant?: 'banner' | 'compact' | 'ambient';
  className?: string;
  showText?: boolean;
}

export const CosmicMoonRocket: React.FC<CosmicMoonRocketProps> = ({
  variant = 'compact',
  className = '',
  showText = true,
}) => {
  if (variant === 'ambient') {
    return (
      <div className={`pointer-events-none select-none overflow-hidden absolute inset-0 z-0 ${className}`}>
        {/* Estrelinhas cintilantes espalhadas */}
        <span className="absolute top-2 left-6 text-[10px] text-amber-200/60 animate-star-twinkle-1">✦</span>
        <span className="absolute top-6 left-1/4 text-[8px] text-blue-200/50 animate-star-twinkle-2">★</span>
        <span className="absolute top-3 right-20 text-[11px] text-amber-100/70 animate-star-twinkle-3">✨</span>
        <span className="absolute bottom-5 left-12 text-[7px] text-cyan-200/50 animate-star-twinkle-1">✦</span>
        <span className="absolute bottom-4 right-1/3 text-[9px] text-white/40 animate-star-twinkle-2">★</span>
        <span className="absolute top-1/2 right-10 text-[10px] text-amber-200/60 animate-star-twinkle-3">✨</span>

        {/* Lua Luminosa no Canto */}
        <div className="absolute top-2 right-3 flex items-center justify-center opacity-85">
          <div className="relative">
            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-300 via-yellow-100 to-amber-200 animate-moon-celestial shadow-[0_0_12px_rgba(253,224,71,0.6)] flex items-center justify-center text-[12px]">
              🌙
            </div>
          </div>
        </div>

        {/* Foguetinho voando em direção à lua */}
        <div className="absolute bottom-3 right-14 animate-rocket-to-moon">
          <div className="relative flex items-center text-sm">
            <span className="text-[13px] drop-shadow-[0_0_6px_rgba(255,255,255,0.7)]">🚀</span>
            {/* Rastro sutil de propulsão */}
            <span className="absolute -bottom-1 -left-2 w-3 h-0.5 bg-gradient-to-r from-transparent via-amber-400/60 to-red-400/80 rounded-full blur-[0.5px] transform rotate-45 pointer-events-none" />
          </div>
        </div>

        {/* Meteoro / Estrela Cadente 1 (Cyan & Branco com Cauda Longa de Plasma) */}
        <div className="absolute top-2 right-10 pointer-events-none select-none z-0 animate-card-meteor-1">
          <div className="relative flex items-center">
            {/* Núcleo luminoso do meteoro */}
            <div className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_12px_#38bdf8,0_0_24px_#ffffff] filter drop-shadow" />
            {/* Cauda ionizada de plasma do meteoro */}
            <div className="h-[2px] w-36 bg-gradient-to-r from-white via-cyan-300 to-transparent blur-[0.4px] origin-left -ml-0.5 opacity-90" />
            {/* Faísca cintilante */}
            <span className="text-[9px] text-cyan-200 absolute -top-1 -left-1 animate-pulse">✦</span>
          </div>
        </div>

        {/* Meteoro / Estrela Cadente 2 (Dourado Cósmico com Faíscas) */}
        <div className="absolute top-1/3 right-4 pointer-events-none select-none z-0 animate-card-meteor-2">
          <div className="relative flex items-center">
            <div className="w-2 h-2 rounded-full bg-amber-100 shadow-[0_0_10px_#f59e0b,0_0_20px_#fef08a] filter drop-shadow" />
            <div className="h-[1.5px] w-28 bg-gradient-to-r from-amber-200 via-orange-400 to-transparent blur-[0.4px] origin-left -ml-0.5 opacity-85" />
            <span className="text-[8px] text-amber-300 absolute -top-1.5 -left-1 animate-pulse">✨</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-gradient-to-r from-[#071328] via-[#0b1e42] to-[#08152e] border border-cyan-500/30 px-3 py-1.5 flex items-center justify-between text-white shadow-md ${className}`}
    >
      {/* Céu estrelado no fundo */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <span className="absolute top-1 left-4 text-[9px] text-amber-200/70 animate-star-twinkle-1">✦</span>
        <span className="absolute top-3 left-1/3 text-[8px] text-cyan-200/60 animate-star-twinkle-2">★</span>
        <span className="absolute bottom-1.5 left-2/3 text-[10px] text-amber-100/80 animate-star-twinkle-3">✨</span>
        <span className="absolute top-1.5 right-14 text-[8px] text-white/70 animate-star-twinkle-1">✦</span>
      </div>

      {/* Conteúdo textual / informativo */}
      <div className="flex items-center gap-2 relative z-1">
        <span className="text-xs">✨</span>
        {showText && (
          <span className="text-[11px] font-bold text-slate-200 tracking-tight">
            Metas & Devedores <span className="text-amber-300 font-extrabold">Rumo à Lua</span>
          </span>
        )}
      </div>

      {/* Cena da Lua e Foguetinho voando para a Lua */}
      <div className="relative z-1 flex items-center gap-3">
        {/* Rastro e Foguetinho animado voando em direção à lua */}
        <div className="relative flex items-center animate-rocket-to-moon">
          <span className="text-base sm:text-lg select-none drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] filter">
            🚀
          </span>
          <span className="absolute -bottom-1 -left-2.5 w-4 h-1 bg-gradient-to-r from-transparent via-amber-400 to-red-500 rounded-full blur-[0.6px] transform rotate-35 pointer-events-none" />
        </div>

        {/* Lua Cheia / Crescente Iluminada com Brilho Cósmico */}
        <div className="relative select-none flex items-center justify-center">
          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-400 via-amber-200 to-yellow-100 animate-moon-celestial shadow-[0_0_12px_rgba(250,204,21,0.85)] flex items-center justify-center text-[12px] text-amber-950 font-black">
            🌙
          </div>
          {/* Anéis de brilho cósmico */}
          <div className="absolute -inset-1 rounded-full bg-amber-400/20 blur-[3px] pointer-events-none" />
        </div>
      </div>
    </div>
  );
};
