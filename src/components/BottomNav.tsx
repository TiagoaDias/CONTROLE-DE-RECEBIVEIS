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

      {/* Menu Flutuante de Ações Rápidas Otimizado (Zero Scroll no Mobile & Grande/Intuitivo na Web) */}
      {isMenuOpen && (
        <div
          role="menu"
          aria-label="Menu de Ações Rápidas"
          className="fixed bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 z-[70] w-[calc(100vw-16px)] max-w-[420px] sm:max-w-[490px] bg-slate-950/95 sm:bg-slate-900/95 backdrop-blur-2xl text-white p-2.5 sm:p-3.5 rounded-3xl border border-cyan-500/40 shadow-[0_20px_60px_rgba(0,0,0,0.85),0_0_35px_rgba(6,182,212,0.25)] flex flex-col gap-2 animate-in slide-in-from-bottom-5 zoom-in-95 duration-200 select-none"
        >
          {/* Header do Menu */}
          <div className="flex items-center justify-between px-1.5 py-0.5 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center shadow-xs">
                <span className="material-symbols-outlined text-[15px] sm:text-[17px]">bolt</span>
              </span>
              <div>
                <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-100 block leading-tight">
                  Ações Rápidas
                </span>
                <span className="text-[9.5px] text-cyan-300/80 font-medium hidden sm:block">
                  Atalhos essenciais compactos sem rolagem
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                try { playAppSound('whoosh'); } catch {}
              }}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full hover:bg-white/10 active:scale-90 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              aria-label="Fechar menu"
            >
              <span className="material-symbols-outlined text-[18px] sm:text-[20px]">close</span>
            </button>
          </div>

          {/* Destaque Central: Botão Automação Inteligente Gemini com Comando de Voz & Texto */}
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
            className="p-2 sm:p-2.5 rounded-2xl bg-gradient-to-r from-blue-900/60 via-indigo-900/60 to-purple-900/60 hover:from-blue-600/40 hover:to-purple-600/40 border border-blue-400/50 hover:border-blue-300 flex items-center gap-2.5 sm:gap-3 transition-all cursor-pointer group active:scale-[0.98] shadow-md hover:shadow-indigo-500/20"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-blue-500 via-indigo-600 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(99,102,241,0.6)] group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[20px] sm:text-[22px]">smart_toy</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-black text-white group-hover:text-cyan-200 transition-colors truncate">
                  Automação Gemini
                </span>
                <span className="text-[8.5px] sm:text-[9.5px] font-black px-1.5 py-0.2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white shrink-0 animate-pulse">
                  IA Ativa
                </span>
                <span className="text-[8.5px] sm:text-[9.5px] font-bold px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 shrink-0 hidden sm:inline-flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-[10px]">mic</span>
                  <span>Voz &amp; Texto</span>
                </span>
              </div>
              <div className="text-[10px] sm:text-[11px] text-cyan-200/80 truncate">
                Comandos falados ou digitados, histórico TXT e rateio
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0 text-cyan-300">
              <span className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-[14px]">mic</span>
              </span>
              <span className="material-symbols-outlined text-slate-400 text-[18px] group-hover:text-white group-hover:translate-x-0.5 transition-all">
                chevron_right
              </span>
            </div>
          </div>

          {/* Grid Otimizado de Ações Rápidas (2 Colunas Compactas: Cabe perfeitamente na tela sem rolagem) */}
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
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
              className="p-2 sm:p-2.5 rounded-2xl bg-white/5 hover:bg-emerald-500/15 border border-white/10 hover:border-emerald-500/50 flex items-center gap-2 sm:gap-2.5 transition-all cursor-pointer group active:scale-[0.98]"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[18px]">person_add</span>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold text-white group-hover:text-emerald-200 transition-colors block truncate">
                  Novo Comprador
                </span>
                <span className="text-[9.5px] text-slate-400 truncate block">
                  Cadastrar devedor
                </span>
              </div>
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
              className="p-2 sm:p-2.5 rounded-2xl bg-white/5 hover:bg-blue-500/15 border border-white/10 hover:border-blue-500/50 flex items-center gap-2.5 transition-all cursor-pointer group active:scale-[0.98]"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold text-white group-hover:text-blue-200 transition-colors block truncate">
                  Nova Compra
                </span>
                <span className="text-[9.5px] text-slate-400 truncate block">
                  Lançar parcelas
                </span>
              </div>
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
                className="p-2 sm:p-2.5 rounded-2xl bg-white/5 hover:bg-cyan-500/15 border border-white/10 hover:border-cyan-400/50 flex items-center gap-2 sm:gap-2.5 transition-all cursor-pointer group active:scale-[0.98]"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-[18px]">document_scanner</span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold text-white group-hover:text-cyan-200 transition-colors block truncate">
                    Escanear com IA
                  </span>
                  <span className="text-[9.5px] text-slate-400 truncate block">
                    Contratos &amp; cupons
                  </span>
                </div>
              </div>
            )}

            {/* 4. Gerar PDFs & Comprovantes */}
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
              className="p-2 sm:p-2.5 rounded-2xl bg-white/5 hover:bg-rose-500/15 border border-white/10 hover:border-rose-500/40 flex items-center gap-2 sm:gap-2.5 transition-all cursor-pointer group active:scale-[0.98]"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-600 to-red-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold text-white group-hover:text-rose-200 transition-colors block truncate">
                  PDFs &amp; Recibos
                </span>
                <span className="text-[9.5px] text-slate-400 truncate block">
                  Extratos &amp; contratos
                </span>
              </div>
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
              className="p-2 sm:p-2.5 rounded-2xl bg-white/5 hover:bg-emerald-500/15 border border-white/10 hover:border-emerald-500/40 flex items-center gap-2 sm:gap-2.5 transition-all cursor-pointer group active:scale-[0.98]"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold text-white group-hover:text-emerald-200 transition-colors block truncate">
                  Minhas Finanças
                </span>
                <span className="text-[9.5px] text-slate-400 truncate block">
                  Controle de despesas
                </span>
              </div>
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
                className="p-2 sm:p-2.5 rounded-2xl bg-white/5 hover:bg-purple-600/20 border border-white/10 hover:border-purple-400/50 flex items-center gap-2 sm:gap-2.5 transition-all cursor-pointer group active:scale-[0.98]"
              >
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-400/30 text-purple-200 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-[18px] text-purple-300 font-bold">verified</span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold text-white group-hover:text-purple-200 transition-colors block truncate">
                    Autenticar Código
                  </span>
                  <span className="text-[9.5px] text-slate-400 truncate block">
                    Verificar recibo
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Barra Inferior com Sair da Conta (e Atalho de Painel na Web) */}
          <div className="flex items-center gap-2 pt-1 border-t border-white/10 shrink-0">
            {onOpenControlPanel && (
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenControlPanel();
                  try { playAppSound('pop'); } catch {}
                }}
                className="flex-1 py-1.5 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                title="Abrir Centro de Controle e Configurações"
              >
                <span className="material-symbols-outlined text-[15px] text-cyan-400">tune</span>
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
              className="flex-1 py-1.5 px-2.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-200 hover:text-white text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              title="Encerrar sessão com segurança"
            >
              <span className="material-symbols-outlined text-[15px] text-red-400">logout</span>
              <span className="truncate">Sair da Conta</span>
            </button>
          </div>
        </div>
      )}

      {/* Barra de Navegação Fixa Inferior */}

      <nav
        aria-label="Navegação Principal do Rodapé"
        className="fixed bottom-0 inset-x-0 z-[65] bg-white/85 backdrop-blur-xl border-t border-slate-200/60 shadow-[0_-4px_25px_rgba(15,23,42,0.09)] pb-safe transition-all"
      >
        <div className="w-full max-w-md sm:max-w-lg md:max-w-xl mx-auto flex justify-between items-center h-16 px-3 sm:px-6">
          {/* 1. Dashboard */}
          <button
            type="button"
            onClick={() => handleTabClick('dashboard')}
            aria-label="Ir para o Dashboard"
            className={`group flex flex-col items-center justify-center flex-1 h-full transition-all gap-1 cursor-pointer select-none ${
              currentTab === 'dashboard'
                ? 'text-blue-600 font-bold scale-102'
                : 'text-slate-500 hover:text-slate-800 font-semibold'
            }`}
          >
            {/* Ícone Dashboard estilo painel com subdivisões igual ao print */}
            <div className="relative flex items-center justify-center">
              <svg
                className={`w-6 h-6 transition-transform ${
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
              className={`text-[10px] sm:text-[11px] tracking-tight text-center leading-none ${
                currentTab === 'dashboard' ? 'text-blue-600 font-extrabold' : 'text-slate-600'
              }`}
            >
              Dashboard
            </span>
          </button>

          {/* 2. Botão Central Flutuante Azul (+) com menu de Ações Rápidas */}
          <div className="flex items-center justify-center shrink-0 px-4 -mt-7 pointer-events-auto z-[75] relative">
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
              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full text-white shadow-[0_8px_25px_rgba(37,99,235,0.55)] hover:shadow-[0_12px_32px_rgba(37,99,235,0.7)] flex items-center justify-center transition-all duration-200 cursor-pointer ring-4 outline-none pointer-events-auto active:scale-95 ${
                isMenuOpen
                  ? 'bg-rose-600 rotate-45 ring-rose-300 shadow-[0_8px_25px_rgba(225,29,72,0.6)]'
                  : 'bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 ring-white'
              }`}
              title="Ações Rápidas (+)"
            >
              <span className="material-symbols-outlined text-[34px] sm:text-[36px] font-normal leading-none select-none transition-transform duration-200">
                add
              </span>
            </button>
          </div>

          {/* 5. Relatórios */}
          <button
            type="button"
            onClick={() => handleTabClick('relatorios')}
            aria-label="Ir para Relatórios"
            className={`group flex flex-col items-center justify-center flex-1 h-full transition-all gap-1 cursor-pointer select-none ${
              currentTab === 'relatorios'
                ? 'text-blue-600 font-bold scale-102'
                : 'text-slate-500 hover:text-slate-800 font-semibold'
            }`}
          >
            {/* Ícone Relatórios (três colunas verticais de gráfico) igual ao print */}
            <div className="relative flex items-center justify-center">
              <svg
                className={`w-6 h-6 transition-transform ${
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
              className={`text-[10px] sm:text-[11px] tracking-tight text-center leading-none ${
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
