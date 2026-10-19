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
          className="fixed bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 z-[70] w-[calc(100vw-20px)] max-w-[380px] sm:max-w-[480px] md:max-w-[520px] max-h-[84vh] overflow-y-auto no-scrollbar bg-slate-950/95 sm:bg-slate-900/95 backdrop-blur-2xl text-white p-2 sm:p-4 rounded-3xl border border-cyan-500/40 shadow-[0_20px_60px_rgba(0,0,0,0.85),0_0_35px_rgba(6,182,212,0.3)] flex flex-col gap-1.5 sm:gap-2 animate-in slide-in-from-bottom-5 zoom-in-95 duration-200 select-none"
        >
          {/* Header do Menu */}
          <div className="flex items-center justify-between px-2 sm:px-3 py-1 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="w-6 h-6 sm:w-8 sm:h-8 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center shadow-xs">
                <span className="material-symbols-outlined text-[15px] sm:text-[18px]">bolt</span>
              </span>
              <div>
                <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-100 block leading-tight">
                  Ações Rápidas
                </span>
                <span className="text-[9.5px] text-cyan-300/80 font-medium hidden sm:block">
                  Atalhos essenciais para gestão rápida sem rolagem
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

          {/* Lista de Ações Rápidas: Um de baixo do outro (Formato Lista Vertical Otimizado) */}
          <div className="flex flex-col gap-1 sm:gap-2">
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
              className="p-1.5 sm:p-2.5 rounded-2xl bg-white/5 hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/50 flex items-center gap-2.5 sm:gap-3 transition-all cursor-pointer group active:scale-[0.98]"
            >
              <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(16,185,129,0.35)] group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[18px] sm:text-[22px]">person_add</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm font-bold text-white group-hover:text-emerald-200 transition-colors truncate">
                    Novo Comprador
                  </span>
                  <span className="text-[8.5px] sm:text-[9.5px] font-black px-1.5 py-0.2 rounded-full bg-emerald-500/30 text-emerald-300 shrink-0">
                    Principal
                  </span>
                </div>
                <div className="text-[10px] sm:text-[11.5px] text-slate-400 truncate">
                  Cadastrar comprador e nova compra integrados
                </div>
              </div>
              <span className="material-symbols-outlined text-slate-500 text-[18px] sm:text-[20px] group-hover:text-emerald-300 group-hover:translate-x-0.5 transition-all shrink-0">
                chevron_right
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
              className="p-1.5 sm:p-2.5 rounded-2xl bg-white/5 hover:bg-blue-500/10 border border-white/10 hover:border-blue-500/50 flex items-center gap-2.5 sm:gap-3 transition-all cursor-pointer group active:scale-[0.98]"
            >
              <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(37,99,235,0.35)] group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[18px] sm:text-[22px]">add_shopping_cart</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm font-bold text-white group-hover:text-blue-200 transition-colors truncate">
                    Nova Compra
                  </span>
                  <span className="text-[8.5px] sm:text-[9.5px] font-black px-1.5 py-0.2 rounded-full bg-blue-500/30 text-blue-300 shrink-0">
                    Frequente
                  </span>
                </div>
                <div className="text-[10px] sm:text-[11.5px] text-slate-400 truncate">
                  Lançar produto, valores e gerar parcelas automáticas
                </div>
              </div>
              <span className="material-symbols-outlined text-slate-500 text-[18px] sm:text-[20px] group-hover:text-blue-300 group-hover:translate-x-0.5 transition-all shrink-0">
                chevron_right
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
                className="p-1.5 sm:p-2.5 rounded-2xl bg-white/5 hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-400/50 flex items-center gap-2.5 sm:gap-3 transition-all cursor-pointer group active:scale-[0.98]"
              >
                <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(6,182,212,0.35)] group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-[18px] sm:text-[22px]">document_scanner</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs sm:text-sm font-bold text-white group-hover:text-cyan-200 transition-colors truncate">
                      Escanear com IA
                    </span>
                    <span className="text-[8.5px] sm:text-[9.5px] font-black px-1.5 py-0.2 rounded-full bg-cyan-500/30 text-cyan-200 shrink-0">
                      Gemini IA
                    </span>
                  </div>
                  <div className="text-[10px] sm:text-[11.5px] text-slate-400 truncate">
                    Importar contratos, cupons ou prints via IA
                  </div>
                </div>
                <span className="material-symbols-outlined text-slate-500 text-[18px] sm:text-[20px] group-hover:text-cyan-300 group-hover:translate-x-0.5 transition-all shrink-0">
                  chevron_right
                </span>
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
              className="p-1.5 sm:p-2.5 rounded-2xl bg-white/5 hover:bg-rose-500/10 border border-white/10 hover:border-rose-500/40 flex items-center gap-2.5 sm:gap-3 transition-all cursor-pointer group active:scale-[0.98]"
            >
              <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-tr from-rose-600 to-red-600 text-white flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(225,29,72,0.35)] group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[18px] sm:text-[22px]">picture_as_pdf</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm font-bold text-white group-hover:text-rose-200 transition-colors truncate">
                    Gerar Comprovantes &amp; PDFs
                  </span>
                  <span className="text-[8.5px] sm:text-[9.5px] font-black px-1.5 py-0.2 rounded-full bg-rose-500/30 text-rose-200 shrink-0">
                    Documentos
                  </span>
                </div>
                <div className="text-[10px] sm:text-[11.5px] text-slate-400 truncate">
                  Extrato Total, Recibos Individuais e Contrato
                </div>
              </div>
              <span className="material-symbols-outlined text-slate-500 text-[18px] sm:text-[20px] group-hover:text-rose-300 group-hover:translate-x-0.5 transition-all shrink-0">
                chevron_right
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
              className="p-1.5 sm:p-2.5 rounded-2xl bg-white/5 hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/40 flex items-center gap-2.5 sm:gap-3 transition-all cursor-pointer group active:scale-[0.98]"
            >
              <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(16,185,129,0.35)] group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[18px] sm:text-[22px]">account_balance_wallet</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm font-bold text-white group-hover:text-emerald-200 transition-colors truncate">
                    Meu Gerenciamento Pessoal
                  </span>
                  <span className="text-[8.5px] sm:text-[9.5px] font-black px-1.5 py-0.2 rounded-full bg-emerald-500/30 text-emerald-200 shrink-0">
                    Finanças
                  </span>
                </div>
                <div className="text-[10px] sm:text-[11.5px] text-slate-400 truncate">
                  Controle de despesas fixas, variáveis e receitas
                </div>
              </div>
              <span className="material-symbols-outlined text-slate-500 text-[18px] sm:text-[20px] group-hover:text-emerald-300 group-hover:translate-x-0.5 transition-all shrink-0">
                chevron_right
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
                className="p-1.5 sm:p-2.5 rounded-2xl bg-white/5 hover:bg-purple-600/20 border border-white/10 hover:border-purple-400/50 flex items-center gap-2.5 sm:gap-3 transition-all cursor-pointer group active:scale-[0.98]"
              >
                <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl bg-purple-100 border border-purple-300 text-purple-900 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(168,85,247,0.3)] group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-[18px] sm:text-[22px] text-purple-700 font-bold">verified</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs sm:text-sm font-bold text-white group-hover:text-purple-200 transition-colors truncate">
                      Verificar Autenticação Digital
                    </span>
                    <span className="text-[8.5px] sm:text-[9.5px] font-black px-1.5 py-0.2 rounded-full bg-purple-500/30 text-purple-200 shrink-0">
                      Oficial
                    </span>
                  </div>
                  <div className="text-[10px] sm:text-[11.5px] text-slate-400 truncate">
                    Consultar e autenticar código oficial de recibo
                  </div>
                </div>
                <span className="material-symbols-outlined text-slate-500 text-[18px] sm:text-[20px] group-hover:text-purple-300 group-hover:translate-x-0.5 transition-all shrink-0">
                  chevron_right
                </span>
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
                className="flex-1 py-1.5 sm:py-2 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                title="Abrir Centro de Controle e Configurações"
              >
                <span className="material-symbols-outlined text-[16px] text-cyan-400">tune</span>
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
              className="flex-1 py-1.5 sm:py-2 px-2.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-200 hover:text-white text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              title="Encerrar sessão com segurança"
            >
              <span className="material-symbols-outlined text-[16px] text-red-400">logout</span>
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
