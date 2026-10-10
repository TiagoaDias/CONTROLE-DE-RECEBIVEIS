import React, { useState, useEffect } from 'react';
import {
  GamificationState,
  getGamificationState,
  completeDailyQuest,
  BUSINESS_TIPS,
  LEVEL_TIERS,
} from '../utils/gamification';
import {
  isSoundEnabled,
  toggleSound,
  playPopSound,
  triggerCelebrationConfetti,
} from '../utils/soundEffects';

interface AchievementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToTab?: (tab: any) => void;
  onOpenQuickPay?: () => void;
}

export const AchievementsModal: React.FC<AchievementsModalProps> = ({
  isOpen,
  onClose,
  onOpenQuickPay,
}) => {
  const [gameState, setGameState] = useState<GamificationState>(getGamificationState());
  const [soundOn, setSoundOn] = useState<boolean>(isSoundEnabled());
  const [tipIndex, setTipIndex] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      setGameState(getGamificationState());
      setSoundOn(isSoundEnabled());
    }
  }, [isOpen]);

  useEffect(() => {
    const handleUpdate = () => {
      setGameState(getGamificationState());
    };
    window.addEventListener('haspaho_gamification_updated', handleUpdate);
    return () => window.removeEventListener('haspaho_gamification_updated', handleUpdate);
  }, []);

  if (!isOpen) return null;

  const handleToggleSound = () => {
    const next = toggleSound();
    setSoundOn(next);
  };

  const handleCelebrate = () => {
    playPopSound();
    triggerCelebrationConfetti();
  };

  const handleNextTip = () => {
    playPopSound();
    setTipIndex((prev) => (prev + 1) % BUSINESS_TIPS.length);
  };

  const unlockedCount = gameState.achievements.filter((a) => a.unlocked).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header com Gradiente Divertido */}
        <div className="relative bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-5 sm:p-6 text-white overflow-hidden">
          {/* Efeito sutil de brilho no fundo */}
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-emerald-400/20 rounded-full blur-xl pointer-events-none" />

          <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-3xl shadow-inner animate-bounce">
                {gameState.levelIcon}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider bg-white/25 px-2.5 py-0.5 rounded-full text-white">
                    Nível {gameState.level}
                  </span>
                  <span className="text-xs text-emerald-100 font-semibold">
                    {gameState.streaks} dias de foco consecutivo 🔥
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
                  {gameState.levelTitle}
                </h2>
                <p className="text-xs text-teal-100 mt-0.5">
                  {gameState.totalXp} XP Acumulados · Gamificação Ativa
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Botão de Som FX */}
              <button
                type="button"
                onClick={handleToggleSound}
                title={soundOn ? 'Sons de Sucesso Ativados' : 'Sons Silenciados'}
                className="p-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer text-sm"
              >
                {soundOn ? '🔊' : '🔇'}
              </button>

              {/* Botão de Fechar */}
              <button
                type="button"
                onClick={onClose}
                className="p-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Barra de Progresso de XP */}
          <div className="mt-4 bg-black/20 p-3 rounded-2xl border border-white/15">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-100 mb-1.5">
              <span>Progresso para o Nível {gameState.level + 1}</span>
              <span>{gameState.progressPercent}%</span>
            </div>
            <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden p-0.5">
              <div
                className="h-full bg-gradient-to-r from-amber-300 to-emerald-300 rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${Math.max(6, gameState.progressPercent)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-teal-100/90 mt-1.5">
              <span>{gameState.totalXp} XP atuais</span>
              <span>Faltam {Math.max(0, gameState.xpForNextLevel - gameState.totalXp)} XP</span>
            </div>
          </div>
        </div>

        {/* Corpo do Modal com Scroll */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          {/* Dica Divertida do Momento */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-2xl p-3.5 flex items-start gap-3 shadow-2xs">
            <span className="text-2xl shrink-0">💡</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black uppercase text-amber-800 tracking-wider">
                  Dica Rápida do Dia
                </span>
                <button
                  type="button"
                  onClick={handleNextTip}
                  className="text-[11px] font-bold text-amber-700 hover:text-amber-900 underline cursor-pointer"
                >
                  Outra Dica 🎲
                </button>
              </div>
              <p className="text-xs sm:text-sm text-amber-950 font-medium mt-1 leading-snug">
                {BUSINESS_TIPS[tipIndex]}
              </p>
            </div>
          </div>

          {/* Missões Diárias (Quests) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎯</span>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                  Missões Diárias Fáceis
                </h3>
              </div>
              <span className="text-xs font-bold text-slate-500">
                {gameState.dailyQuests.filter((q) => q.completed).length}/{gameState.dailyQuests.length} concluídas
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {gameState.dailyQuests.map((quest) => (
                <div
                  key={quest.id}
                  onClick={() => {
                    if (!quest.completed) {
                      completeDailyQuest(quest.id);
                    }
                  }}
                  className={`p-3 rounded-2xl border transition-all text-left relative overflow-hidden cursor-pointer ${
                    quest.completed
                      ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                      : 'bg-white border-slate-200 hover:border-emerald-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xl">{quest.icon}</span>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        quest.completed
                          ? 'bg-emerald-200 text-emerald-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      +{quest.xpReward} XP
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 leading-tight">
                    {quest.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug line-clamp-2">
                    {quest.description}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold">
                    {quest.completed ? (
                      <span className="text-emerald-700 flex items-center gap-1">
                        ✓ Concluída!
                      </span>
                    ) : (
                      <span className="text-slate-600 group-hover:text-emerald-600">
                        Clique para validar
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Troféus e Conquistas Desbloqueáveis */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🏆</span>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                  Troféus & Medalhas do Gestor ({unlockedCount}/{gameState.achievements.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCelebrate}
                className="text-xs font-bold text-cyan-600 hover:text-cyan-800 flex items-center gap-1 cursor-pointer"
              >
                🎉 Soltar Confetes
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {gameState.achievements.map((ach) => (
                <div
                  key={ach.id}
                  className={`p-3.5 rounded-2xl border flex items-start gap-3 transition-all ${
                    ach.unlocked
                      ? 'bg-white border-amber-300 shadow-sm ring-1 ring-amber-300/40'
                      : 'bg-slate-100/70 border-slate-200/80 opacity-75'
                  }`}
                >
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-2xs ${
                      ach.unlocked
                        ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-white'
                        : 'bg-slate-200 text-slate-400'
                    }`}
                  >
                    {ach.unlocked ? ach.icon : '🔒'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-xs font-bold text-slate-900 truncate">
                        {ach.title}
                      </h4>
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200">
                        +{ach.xpReward} XP
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      {ach.description}
                    </p>
                    <div className="mt-1.5 text-[10px] font-bold">
                      {ach.unlocked ? (
                        <span className="text-emerald-600">★ Conquistado!</span>
                      ) : (
                        <span className="text-slate-400">Bloqueado · Realize a ação</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Lista de Níveis */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider mb-2.5">
              Escala de Níveis do ERP
            </h4>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              {LEVEL_TIERS.map((tier) => (
                <div
                  key={tier.level}
                  className={`shrink-0 p-2.5 rounded-xl border text-center min-w-[100px] ${
                    tier.level === gameState.level
                      ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-400/30'
                      : tier.level < gameState.level
                      ? 'bg-slate-50 border-slate-200 text-slate-500'
                      : 'bg-slate-50/50 border-slate-200/50 opacity-50'
                  }`}
                >
                  <div className="text-xl">{tier.icon}</div>
                  <div className="text-[10px] font-bold text-slate-900 mt-1">
                    Nv. {tier.level}
                  </div>
                  <div className="text-[9px] text-slate-500 truncate max-w-[90px]">
                    {tier.title}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Rodapé com Ações Fáceis */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Cada ação realizada no ERP gera XP e acelera suas metas! 🚀
          </div>
          <div className="flex items-center gap-2">
            {onOpenQuickPay && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenQuickPay();
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
              >
                💰 Receber Parcela Agora
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
