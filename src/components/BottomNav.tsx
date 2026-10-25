import React, { useState, useEffect } from 'react';
import { ScreenTab } from '../types';
import { playAppSound } from '../utils/soundUtils';

interface BottomNavProps {
  currentTab: ScreenTab;
  onNavigate: (tab: ScreenTab, targetId?: string, extraId?: string) => void;
  onOpenNewPurchase: () => void;
  onOpenNewDebtor?: () => void;
  onOpenGeminiScanner?: () => void;
  onOpenExtratoTotal?: () => void;
  onOpenAuthLookup?: () => void;
  onOpenNovoRecibo?: () => void;
  onOpenPdfHub?: () => void;
  onOpenMeuGerenciamento?: () => void;
  onToggleMoveButtons?: () => void;
  onLogout?: () => void;
  onOpenUserSettings?: (tab?: 'profile' | 'address' | 'pix' | 'security' | 'lixeira') => void;
  onOpenControlPanel?: () => void;
  onRestoreAllData?: () => void;
  onOpenLogin: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onNavigate,
  onOpenNewPurchase,
  onOpenNewDebtor,
  onOpenGeminiScanner,
  onOpenExtratoTotal,
  onOpenAuthLookup,
  onOpenNovoRecibo,
  onOpenPdfHub,
  onOpenMeuGerenciamento,
  onToggleMoveButtons,
  onLogout,
  onOpenUserSettings,
  onOpenControlPanel,
  onRestoreAllData,
  onOpenLogin,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);

  // Fechar menu ao pressionar Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };
    if (isMenuOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isMenuOpen]);

  const handleTabClick = (tab: ScreenTab) => {
    playAppSound('click');
    setIsMenuOpen(false);
    onNavigate(tab);
  };

  return (
    <>
      {/* Backdrop com blur ao abrir menu de ações rápidas */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm transition-opacity animate-in fade-in duration-200 pointer-events-auto"
          onClick={() => setIsMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Menu Flutuante de Ações Rápidas Otimizado (Grade Compacta em Tela Única no Mobile & Web) */}
      {isMenuOpen && (
        <div
          role="menu"
          aria-label="Menu de Ações Rápidas"
          className="fixed bottom-[3.4rem] sm:bottom-16 left-1/2 -translate-x-1/2 z-[70] w-[calc(100vw-12px)] max-w-[350px] sm:max-w-[420px] max-h-[calc(100dvh-4rem)] overflow-hidden bg-slate-950/95 sm:bg-slate-900/95 backdrop-blur-2xl text-white p-1.5 sm:p-2 rounded-2xl border border-cyan-500/40 shadow-[0_16px_48px_rgba(0,0,0,0.85),0_0_28px_rgba(6,182,212,0.22)] flex flex-col gap-1 sm:gap-1.5 animate-in slide-in-from-bottom-4 zoom-in-95 duration-150 select-none"
        >
          {/* Header Compacto do Menu */}
          <div className="flex items-center justify-between px-1 py-0.5 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center shadow-2xs">
                <span className="material-symbols-outlined text-[13px] sm:text-[15px]">bolt</span>
              </span>
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-100 leading-none">
                Ações Rápidas
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                try { playAppSound('whoosh'); } catch {}
              }}
              className="w-6 h-6 rounded-full hover:bg-white/10 active:scale-90 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              aria-label="Fechar menu"
            >
              <span className="material-symbols-outlined text-[15px] sm:text-[16px]">close</span>
            </button>
          </div>

          {/* Grade Compacta Única (Automação Gemini + Ícones em Tela Única no Mobile sem Rolagem) */}
          <div className="grid grid-cols-3 gap-1 sm:gap-1.5">
            {/* Botão Principal Integrado na Grade: Automação Inteligente Gemini */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                setIsMenuOpen(false);
                onNavigate('gemini-automacao');
                try { playAppSound('click'); } catch {}
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsMenuOpen(false);
                  onNavigate('gemini-automacao');
                  try { playAppSound('click'); } catch {}
                }
              }}
              className="col-span-3 px-2 py-1.5 rounded-xl bg-gradient-to-r from-blue-900/70 via-indigo-900/70 to-purple-900/70 hover:from-blue-600/40 hover:to-purple-600/40 border border-blue-400/50 hover:border-blue-300 flex items-center gap-2 transition-all cursor-pointer group active:scale-[0.98] shadow-sm"
            >
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-gradient-to-tr from-blue-500 via-indigo-600 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(99,102,241,0.5)] group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[15px] sm:text-[17px]">smart_toy</span>
              </div>
              <div className="flex-1 min-w-0 leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-black text-white group-hover:text-cyan-200 transition-colors truncate">
                    Automação Gemini
                  </span>
                  <span className="text-[8.5px] font-bold text-cyan-300 truncate">
                    · Voz &amp; Texto
                  </span>
                </div>
                <div className="text-[9.5px] text-cyan-200/80 truncate">
                  Comandos rápidos, histórico TXT e rateio
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0 text-cyan-300">
                <span className="w-5 h-5 rounded-md bg-blue-500/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[12px] sm:text-[13px]">mic</span>
                </span>
                <span className="material-symbols-outlined text-slate-400 text-[15px] group-hover:text-white group-hover:translate-x-0.5 transition-all">
                  chevron_right
                </span>
              </div>
            </div>

            {/* 1. Novo Comprador */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                setIsMenuOpen(false);
                if (onOpenNewDebtor) onOpenNewDebtor();
                try { playAppSound('click'); } catch {}
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsMenuOpen(false);
                  if (onOpenNewDebtor) onOpenNewDebtor();
                  try { playAppSound('click'); } catch {}
                }
              }}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-emerald-500/15 border border-white/10 hover:border-emerald-500/50 flex flex-col items-center justify-center text-center gap-0.5 transition-all cursor-pointer group active:scale-[0.97]"
            >
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[15px] sm:text-[16px]">person_add</span>
              </div>
              <span className="text-[9.5px] sm:text-[10.5px] font-bold text-white group-hover:text-emerald-200 transition-colors leading-tight truncate w-full">
                Comprador
              </span>
            </div>

            {/* 2. Nova Compra */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                setIsMenuOpen(false);
                if (onOpenNewPurchase) onOpenNewPurchase();
                try { playAppSound('click'); } catch {}
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsMenuOpen(false);
                  if (onOpenNewPurchase) onOpenNewPurchase();
                  try { playAppSound('click'); } catch {}
                }
              }}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-blue-500/15 border border-white/10 hover:border-blue-500/50 flex flex-col items-center justify-center text-center gap-0.5 transition-all cursor-pointer group active:scale-[0.97]"
            >
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[15px] sm:text-[16px]">add_shopping_cart</span>
              </div>
              <span className="text-[9.5px] sm:text-[10.5px] font-bold text-white group-hover:text-blue-200 transition-colors leading-tight truncate w-full">
                Nova Compra
              </span>
            </div>

            {/* 3. Escanear com IA */}
            {onOpenGeminiScanner && (
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenGeminiScanner();
                  try { playAppSound('click'); } catch {}
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setIsMenuOpen(false);
                    onOpenGeminiScanner();
                    try { playAppSound('click'); } catch {}
                  }
                }}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-cyan-500/15 border border-white/10 hover:border-cyan-400/50 flex flex-col items-center justify-center text-center gap-0.5 transition-all cursor-pointer group active:scale-[0.97]"
              >
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-[15px] sm:text-[16px]">document_scanner</span>
                </div>
                <span className="text-[9.5px] sm:text-[10.5px] font-bold text-white group-hover:text-cyan-200 transition-colors leading-tight truncate w-full">
                  Escanear IA
                </span>
              </div>
            )}

            {/* 4. Gerar PDFs, TXT & Comprovantes */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                setIsMenuOpen(false);
                if (onOpenPdfHub) onOpenPdfHub();
                try { playAppSound('click'); } catch {}
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsMenuOpen(false);
                  if (onOpenPdfHub) onOpenPdfHub();
                  try { playAppSound('click'); } catch {}
                }
              }}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-rose-500/15 border border-white/10 hover:border-rose-500/40 flex flex-col items-center justify-center text-center gap-0.5 transition-all cursor-pointer group active:scale-[0.97]"
            >
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-gradient-to-tr from-rose-600 to-red-600 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[15px] sm:text-[16px]">picture_as_pdf</span>
              </div>
              <span className="text-[9.5px] sm:text-[10.5px] font-bold text-white group-hover:text-rose-200 transition-colors leading-tight truncate w-full">
                PDFs &amp; TXT
              </span>
            </div>

            {/* 5. Meu Gerenciamento Pessoal */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                setIsMenuOpen(false);
                if (onOpenMeuGerenciamento) onOpenMeuGerenciamento();
                try { playAppSound('click'); } catch {}
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsMenuOpen(false);
                  if (onOpenMeuGerenciamento) onOpenMeuGerenciamento();
                  try { playAppSound('click'); } catch {}
                }
              }}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-emerald-500/15 border border-white/10 hover:border-emerald-500/40 flex flex-col items-center justify-center text-center gap-0.5 transition-all cursor-pointer group active:scale-[0.97]"
            >
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[15px] sm:text-[16px]">account_balance_wallet</span>
              </div>
              <span className="text-[9.5px] sm:text-[10.5px] font-bold text-white group-hover:text-emerald-200 transition-colors leading-tight truncate w-full">
                Finanças
              </span>
            </div>

            {/* 6. Verificar Autenticação Digital */}
            {onOpenAuthLookup && (
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenAuthLookup();
                  try { playAppSound('click'); } catch {}
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setIsMenuOpen(false);
                    onOpenAuthLookup();
                    try { playAppSound('click'); } catch {}
                  }
                }}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-purple-600/20 border border-white/10 hover:border-purple-400/50 flex flex-col items-center justify-center text-center gap-0.5 transition-all cursor-pointer group active:scale-[0.97]"
              >
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-purple-500/20 border border-purple-400/30 text-purple-200 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-[15px] sm:text-[16px] text-purple-300 font-bold">verified</span>
                </div>
                <span className="text-[9.5px] sm:text-[10.5px] font-bold text-white group-hover:text-purple-200 transition-colors leading-tight truncate w-full">
                  Autenticar
                </span>
              </div>
            )}
          </div>

          {/* Barra Inferior Compacta: Painel & Sair da Conta */}
          <div className="flex items-center gap-1.5 pt-1 border-t border-white/10 shrink-0">
            {onOpenControlPanel && (
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenControlPanel();
                  try { playAppSound('pop'); } catch {}
                }}
                className="flex-1 py-1 px-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-[10px] sm:text-[11px] font-bold flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer"
                title="Abrir Centro de Controle e Configurações"
              >
                <span className="material-symbols-outlined text-[13px] text-cyan-400">tune</span>
                <span className="truncate">Painel &amp; Ajustes</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                if (onLogout) onLogout();
                try { playAppSound('whoosh'); } catch {}
              }}
              className="flex-1 py-1 px-2 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-200 hover:text-white text-[10px] sm:text-[11px] font-bold flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer"
              title="Encerrar sessão com segurança"
            >
              <span className="material-symbols-outlined text-[13px] text-red-400">logout</span>
              <span className="truncate">Sair da Conta</span>
            </button>
          </div>
        </div>
      )}

      {/* Barra de Navegação Fixa Inferior Compacta */}
      <nav
        aria-label="Navegação Principal do Rodapé"
        className="fixed bottom-0 inset-x-0 z-[65] bg-white/90 backdrop-blur-xl border-t border-slate-200/60 shadow-[0_-2px_18px_rgba(15,23,42,0.08)] pb-safe transition-all"
      >
        <div className="w-full max-w-md sm:max-w-lg md:max-w-xl mx-auto flex justify-between items-center h-12 sm:h-13 px-2 sm:px-5">
          {/* 1. Dashboard */}
          <button
            type="button"
            onClick={() => handleTabClick('dashboard')}
            aria-label="Ir para o Dashboard"
            className={`group flex flex-col items-center justify-center flex-1 h-full transition-all gap-0.5 py-0.5 cursor-pointer select-none ${
              currentTab === 'dashboard'
                ? 'text-blue-600 font-bold'
                : 'text-slate-500 hover:text-slate-800 font-semibold'
            }`}
          >
            <div className="relative flex items-center justify-center">
              <svg
                className={`w-[18px] h-[18px] sm:w-5 sm:h-5 transition-transform ${
                  currentTab === 'dashboard' ? 'stroke-blue-600 fill-blue-50/50' : 'stroke-slate-500 group-hover:stroke-slate-700'
                }`}
                viewBox="0 0 24 24"
                fill="none"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="7" height="9" rx="1.5" />
                <rect x="14" y="3" width="7" height="5" rx="1.5" />
                <rect x="14" y="12" width="7" height="9" rx="1.5" />
                <rect x="3" y="16" width="7" height="5" rx="1.5" />
              </svg>
            </div>
            <span
              className={`text-[9.5px] sm:text-[10px] tracking-tight text-center leading-none ${
                currentTab === 'dashboard' ? 'text-blue-600 font-extrabold' : 'text-slate-600'
              }`}
            >
              Dashboard
            </span>
          </button>

          {/* 2. Botão Central Flutuante Azul (+) Compacto com menu de Ações Rápidas */}
          <div className="flex items-center justify-center shrink-0 px-2.5 -mt-4 sm:-mt-5 pointer-events-auto z-[75] relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const nextState = !isMenuOpen;
                setIsMenuOpen(nextState);
                playAppSound(nextState ? 'pop' : 'whoosh');
              }}
              aria-label={isMenuOpen ? "Fechar Menu de Ações Rápidas" : "Abrir Menu de Ações Rápidas"}
              aria-expanded={isMenuOpen}
              className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full text-white shadow-[0_6px_18px_rgba(37,99,235,0.5)] hover:shadow-[0_8px_24px_rgba(37,99,235,0.65)] flex items-center justify-center transition-all duration-200 cursor-pointer ring-2 sm:ring-3 outline-none pointer-events-auto active:scale-95 ${
                isMenuOpen
                  ? 'bg-rose-600 rotate-45 ring-rose-300 shadow-[0_6px_18px_rgba(225,29,72,0.55)]'
                  : 'bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 ring-white'
              }`}
              title="Ações Rápidas (+)"
            >
              <span className="material-symbols-outlined text-[24px] sm:text-[26px] font-normal leading-none select-none transition-transform duration-200">
                add
              </span>
            </button>
          </div>

          {/* 3. Relatórios */}
          <button
            type="button"
            onClick={() => handleTabClick('relatorios')}
            aria-label="Ir para Relatórios"
            className={`group flex flex-col items-center justify-center flex-1 h-full transition-all gap-0.5 py-0.5 cursor-pointer select-none ${
              currentTab === 'relatorios'
                ? 'text-blue-600 font-bold'
                : 'text-slate-500 hover:text-slate-800 font-semibold'
            }`}
          >
            <div className="relative flex items-center justify-center">
              <svg
                className={`w-[18px] h-[18px] sm:w-5 sm:h-5 transition-transform ${
                  currentTab === 'relatorios' ? 'stroke-blue-600 fill-blue-50/50' : 'stroke-slate-500 group-hover:stroke-slate-700'
                }`}
                viewBox="0 0 24 24"
                fill="none"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="6" y1="20" x2="6" y2="14" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="18" y1="20" x2="18" y2="10" />
              </svg>
            </div>
            <span
              className={`text-[9.5px] sm:text-[10px] tracking-tight text-center leading-none ${
                currentTab === 'relatorios' ? 'text-blue-600 font-extrabold' : 'text-slate-600'
              }`}
            >
              Relatórios
            </span>
          </button>
        </div>
      </nav>
    </>
  );
};
