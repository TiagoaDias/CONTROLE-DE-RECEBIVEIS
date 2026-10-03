import React from 'react';

interface CardMeteorProps {
  className?: string;
  variant?: 'multi' | 'cyan' | 'amber';
  showSparkles?: boolean;
}

export const CardMeteor: React.FC<CardMeteorProps> = ({
  className = '',
  variant = 'multi',
  showSparkles = true,
}) => {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none absolute inset-0 overflow-hidden z-0 ${className}`}
    >
      {/* 1. Meteoro / Estrela Cadente Principal: Cyan Elétrico com Cauda Longa e Aura */}
      {(variant === 'multi' || variant === 'cyan') && (
        <div className="absolute -top-3 right-10 pointer-events-none select-none z-0 animate-meteor-fast">
          <div className="relative flex items-center">
            {/* Halo / Aura que ilumina o interior do card ao passar */}
            <div className="absolute -inset-3 w-10 h-10 bg-cyan-400/20 rounded-full blur-md" />
            {/* Núcleo luminoso em brasa do meteoro */}
            <div className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_10px_#ffffff,0_0_18px_#38bdf8,0_0_30px_#0284c7] filter drop-shadow z-10" />
            {/* Cauda ionizada de plasma incandescente */}
            <div className="h-[2px] w-36 bg-gradient-to-r from-white via-cyan-300 to-transparent blur-[0.3px] origin-left -ml-0.5 opacity-95" />
            {/* Faíscas cintilantes soltando-se do meteoro */}
            <span className="text-[10px] text-cyan-200 absolute -top-1.5 -left-1 animate-pulse">✦</span>
            <span className="text-[7px] text-blue-200 absolute -bottom-1 left-8 opacity-75">★</span>
          </div>
        </div>
      )}

      {/* 2. Meteoro / Estrela Cadente Secundária: Dourada / Âmbar Cósmico com Faíscas */}
      {(variant === 'multi' || variant === 'amber') && (
        <div className="absolute top-4 right-4 pointer-events-none select-none z-0 animate-meteor-medium">
          <div className="relative flex items-center">
            <div className="absolute -inset-3 w-10 h-10 bg-amber-400/15 rounded-full blur-md" />
            <div className="w-2 h-2 rounded-full bg-amber-100 shadow-[0_0_8px_#ffffff,0_0_16px_#f59e0b,0_0_24px_#fef08a] filter drop-shadow z-10" />
            <div className="h-[1.5px] w-28 bg-gradient-to-r from-amber-100 via-orange-400 to-transparent blur-[0.3px] origin-left -ml-0.5 opacity-90" />
            <span className="text-[8px] text-amber-300 absolute -top-1.5 -left-1 animate-pulse">✨</span>
          </div>
        </div>
      )}

      {/* 3. Estrela Cadente Ultrarrápida em Altitude Elevada */}
      {variant === 'multi' && (
        <div className="absolute top-1/2 right-2 pointer-events-none select-none z-0 animate-meteor-slow">
          <div className="relative flex items-center">
            <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_#67e8f9] z-10" />
            <div className="h-[1px] w-44 bg-gradient-to-r from-white via-cyan-200/90 to-transparent blur-[0.2px] origin-left opacity-80" />
          </div>
        </div>
      )}

      {/* Estrelinhas cintilantes de fundo opcionais */}
      {showSparkles && (
        <>
          <span className="absolute top-2 left-6 text-[9px] text-amber-200/40 animate-star-twinkle-1">✦</span>
          <span className="absolute bottom-3 left-1/4 text-[8px] text-cyan-200/35 animate-star-twinkle-2">★</span>
          <span className="absolute top-1/2 right-12 text-[9px] text-white/30 animate-star-twinkle-3">✨</span>
        </>
      )}
    </div>
  );
};
