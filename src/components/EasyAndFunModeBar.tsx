import React, { useState, useEffect } from 'react';
import {
  GamificationState,
  getGamificationState,
  BUSINESS_TIPS,
} from '../utils/gamification';
import {
  isSoundEnabled,
  toggleSound,
  playPopSound,
  triggerCelebrationConfetti,
} from '../utils/soundEffects';

interface EasyAndFunModeBarProps {
  onOpenAchievements: () => void;
  onOpenQuickPay?: () => void;
  onOpenNewSale?: () => void;
  onOpenQuickNudge?: () => void;
  onOpenCommandPalette?: () => void;
}

export const EasyAndFunModeBar: React.FC<EasyAndFunModeBarProps> = ({
  onOpenAchievements,
  onOpenQuickPay,
  onOpenNewSale,
  onOpenQuickNudge,
  onOpenCommandPalette,
}) => {
  const [gameState, setGameState] = useState<GamificationState>(getGamificationState());
  const [soundOn, setSoundOn] = useState<boolean>(isSoundEnabled());
  const [tipIndex, setTipIndex] = useState<number>(() => Math.floor(Math.random() * BUSINESS_TIPS.length));
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  useEffect(() => {
    const handleUpdate = () => {
      setGameState(getGamificationState());
    };
    window.addEventListener('haspaho_gamification_updated', handleUpdate);
    return () => window.removeEventListener('haspaho_gamification_updated', handleUpdate);
  }, []);

  const handleToggleSound = () => {
    const next = toggleSound();
    setSoundOn(next);
  };

  const handleNextTip = (e: React.MouseEvent) => {
    e.stopPropagation();
    playPopSound();
    setTipIndex((prev) => (prev + 1) % BUSINESS_TIPS.length);
  };

  const handleCelebrate = (e: React.MouseEvent) => {
    e.stopPropagation();
    playPopSound();
    triggerCelebrationConfetti();
  };

  return (
    <div className="w-full bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl sm:rounded-3xl border border-indigo-800/40 shadow-lg p-3 sm:p-3.5 mb-3.5 transition-all relative overflow-hidden">
      {/* Luz ambiente de fundo */}
      <div className="absolute top-0 right-1/4 w-72 h-16 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute bottom-0 left-10 w-48 h-12 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />

      {/* Linha Principal da Barra */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2.5 sm:gap-4">
        {/* Lado Esquerdo: Nível e Avatar Gamificado */}
        <div
          onClick={onOpenAchievements}
          className="flex items-center gap-2.5 cursor-pointer group select-none hover:opacity-95 transition-opacity"
          title="Clique para abrir suas Conquistas e Níveis"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 p-0.5 shadow-md flex items-center justify-center text-xl shrink-0 group-hover:scale-105 transition-transform">
            <span className="drop-shadow-xs">{gameState.levelIcon}</span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                Nível {gameState.level}
              </span>
              <span className="text-xs font-bold text-slate-100 group-hover:text-amber-300 transition-colors">
                {gameState.levelTitle}
              </span>
            </div>

            {/* Micro barra de progresso */}
            <div className="flex items-center gap-2 mt-1">
              <div className="w-24 sm:w-32 h-1.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/60">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(8, gameState.progressPercent)}%` }}
                />
              </div>
              <span className="text-[10px] font-semibold text-slate-400">
                {gameState.totalXp} XP ({gameState.progressPercent}%)
              </span>
            </div>
          </div>
        </div>

        {/* Centro: Dica Divertida / Produtiva */}
        <div className="hidden lg:flex items-center gap-2 max-w-md bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-200">
          <span className="text-amber-400 text-sm shrink-0">💡</span>
          <span className="truncate flex-1 font-medium">{BUSINESS_TIPS[tipIndex]}</span>
          <button
            type="button"
            onClick={handleNextTip}
            title="Ver outra dica divertida"
            className="text-[10px] text-amber-300 hover:text-amber-200 font-bold underline shrink-0 cursor-pointer"
          >
            Outra 🎲
          </button>
        </div>

        {/* Lado Direito: Ações Fáceis em 1-Clique & Botões */}
        <div className="flex items-center flex-wrap gap-1.5 sm:gap-2">
          {/* Busca Rápida Fácil */}
          {onOpenCommandPalette && (
            <button
              type="button"
              onClick={onOpenCommandPalette}
              title="Paleta de Comandos Fáceis (Ctrl+K)"
              className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs hover:text-white"
            >
              <span>⚡</span>
              <span className="hidden sm:inline">Busca Fácil</span>
              <kbd className="hidden md:inline-block text-[9px] bg-black/40 px-1 py-0.5 rounded text-slate-400 border border-white/10">
                Ctrl+K
              </kbd>
            </button>
          )}

          {/* Receber Parcela Rápida */}
          {onOpenQuickPay && (
            <button
              type="button"
              onClick={onOpenQuickPay}
              title="Liquidar uma parcela com 1 toque"
              className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer hover:shadow-emerald-500/25"
            >
              <span>💰</span>
              <span>Receber</span>
            </button>
          )}

          {/* Nova Venda Express */}
          {onOpenNewSale && (
            <button
              type="button"
              onClick={onOpenNewSale}
              title="Lançar uma venda parcelada rápida"
              className="px-2.5 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-bold text-xs flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
            >
              <span>➕</span>
              <span className="hidden sm:inline">Nova Venda</span>
            </button>
          )}

          {/* Troféus & Conquistas */}
          <button
            type="button"
            onClick={onOpenAchievements}
            title="Abrir Central de Conquistas"
            className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
          >
            <span>🏆</span>
            <span className="hidden sm:inline">Conquistas</span>
          </button>

          {/* Botão de Confetes para Alegria */}
          <button
            type="button"
            onClick={handleCelebrate}
            title="Comemorar com confetes na tela!"
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer text-sm"
          >
            🎉
          </button>

          {/* Toggle de Som */}
          <button
            type="button"
            onClick={handleToggleSound}
            title={soundOn ? 'Sons Divertidos Ativados' : 'Sons Silenciados'}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer text-xs"
          >
            {soundOn ? '🔊' : '🔇'}
          </button>

          {/* Toggle de Detalhes / Dica no Mobile */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            title="Ver dica e missões de hoje"
            className="lg:hidden p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer text-xs font-bold"
          >
            {isExpanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Gaveta Expansível para Mobile ou Dica */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-white/10 lg:hidden flex flex-col gap-2 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-2.5 text-xs text-slate-200">
            <span className="text-amber-400 text-base shrink-0">💡</span>
            <span className="flex-1 font-medium leading-snug">{BUSINESS_TIPS[tipIndex]}</span>
            <button
              type="button"
              onClick={handleNextTip}
              className="text-[11px] text-amber-300 font-bold underline shrink-0 cursor-pointer"
            >
              Outra 🎲
            </button>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>Missões de hoje: 3 ativas</span>
            <button
              type="button"
              onClick={onOpenAchievements}
              className="text-cyan-400 font-bold hover:underline cursor-pointer"
            >
              Ver Troféus e Missões →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
