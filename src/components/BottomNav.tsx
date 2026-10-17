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

      {/* Menu Flutuante de Ações Rápidas (Speed Dial Popover) */}
      {isMenuOpen && (
        <div
          role="menu"
          aria-label="Menu de Ações Rápidas"
          className="fixed bottom-22 left-1/2 -translate-x-1/2 z-[70] w-[310px] sm:w-[350px] max-h-[80vh] overflow-y-auto bg-slate-900/95 backdrop-blur-2xl text-white p-3 rounded-3xl border border-cyan-500/40 shadow-[0_20px_60px_rgba(0,0,0,0.8),0_0_35px_rgba(6,182,212,0.3)] flex flex-col gap-1.5 animate-in slide-in-from-bottom-5 zoom-in-95 duration-200"
        >
          {/* Header do Menu */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 mb-1">
            <div className="flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center shadow-xs">
                <span className="material-symbols-outlined text-[16px]">bolt</span>
              </span>
              <span className="text-xs font-black uppercase tracking-wider text-slate-100">
                Ações Rápidas
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsMenuOpen(false)}
              className="w-7 h-7 rounded-full hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Fechar menu"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          {/* 1. Novo Devedor / Comprador */}
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
            className="w-full text-left p-2.5 rounded-2xl bg-white/5 border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/10 flex items-center gap-3 transition-all cursor-pointer group active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(16,185,129,0.4)] group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[20px]">person_add</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-white group-hover:text-emerald-200 transition-colors flex items-center gap-1.5">
                <span>Novo Devedor</span>
                <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-emerald-500/30 text-emerald-300 border border-emerald-400/30">
                  Principal
                </span>
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                Cadastrar comprador e nova compra integrados
              </div>
            </div>
            <span className="material-symbols-outlined text-slate-500 text-[18px] group-hover:text-emerald-300 group-hover:translate-x-0.5 transition-all">
              chevron_right
            </span>
          </div>

          {/* 2. Nova Compra Parcelada */}
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
            className="w-full text-left p-2.5 rounded-2xl bg-white/5 border border-white/10 hover:border-blue-500/50 hover:bg-blue-500/10 flex items-center gap-3 transition-all cursor-pointer group active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(37,99,235,0.4)] group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[20px]">add_shopping_cart</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-white group-hover:text-blue-200 transition-colors flex items-center gap-1.5">
                <span>Nova Compra</span>
                <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-blue-500/30 text-blue-300 border border-blue-400/30">
                  Frequente
                </span>
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                Lançar produto, valores e gerar parcelas automáticas
              </div>
            </div>
            <span className="material-symbols-outlined text-slate-500 text-[18px] group-hover:text-blue-300 group-hover:translate-x-0.5 transition-all">
              chevron_right
            </span>
          </div>

          {/* 3. PDF (Central de Documentos: Extrato Total, Recibo Individual e Contrato Digital) */}
          <div
            onClick={() => {
              playAppSound('click');
              setIsMenuOpen(false);
              if (onOpenPdfHub) onOpenPdfHub();
            }}
            className="w-full p-2.5 rounded-2xl bg-white/5 border border-white/10 hover:border-rose-500/40 hover:bg-rose-500/10 flex items-center gap-3 transition-all cursor-pointer group active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-red-600 text-white flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(225,29,72,0.4)] group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-white group-hover:text-rose-200 transition-colors flex items-center gap-1.5">
                <span>Gerar Comprovantes &amp; PDFs</span>
                <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-rose-500/30 text-rose-200 border border-rose-400/40">
                  Documentos
                </span>
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                Extrato Total, Recibos Individuais e Contrato
              </div>
            </div>
            <span className="material-symbols-outlined text-slate-500 text-[18px] group-hover:text-rose-300 group-hover:translate-x-0.5 transition-all">
              chevron_right
            </span>
          </div>

          {/* 4. Meu Gerenciamento Pessoal (Exclusivo Tiago Dias) */}
          <div
            onClick={() => {
              setIsMenuOpen(false);
              if (onOpenMeuGerenciamento) onOpenMeuGerenciamento();
            }}
            className="w-full p-2.5 rounded-2xl bg-white/5 border border-white/10 hover:border-emerald-500/40 hover:bg-emerald-500/10 flex items-center gap-3 transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(16,185,129,0.4)] group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-white group-hover:text-emerald-200 transition-colors flex items-center gap-1.5">
                <span>Meu Gerenciamento Pessoal</span>
                <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/40">
                  Exclusivo
                </span>
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                Despesas fixas (CPFL, Água, Netflix), variáveis e diárias
              </div>
            </div>
            <span className="material-symbols-outlined text-slate-500 text-[18px] group-hover:text-emerald-300 group-hover:translate-x-0.5 transition-all">
              chevron_right
            </span>
          </div>

          {/* 5. Verificar Autenticação Digital */}
          {onOpenAuthLookup && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsMenuOpen(false);
                onOpenAuthLookup();
              }}
              className="group w-full p-2.5 rounded-2xl bg-white/5 hover:bg-purple-600/30 border border-purple-400/30 hover:border-purple-400/60 flex items-center gap-3 transition-all cursor-pointer text-left active:scale-[0.98]"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-100 border border-purple-300 text-purple-900 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(168,85,247,0.3)] group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[20px] text-purple-700 font-bold">verified</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white group-hover:text-purple-200 transition-colors">
                  Verificar Autenticação Digital
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  Autenticar código oficial de recibo
                </div>
              </div>
              <span className="material-symbols-outlined text-slate-500 text-[18px] group-hover:text-purple-300 group-hover:translate-x-0.5 transition-all">
                chevron_right
              </span>
            </button>
          )}

          {/* 6. Trocar Usuário */}
          <button
            onClick={() => {
              setIsMenuOpen(false);
              onOpenLogin();
            }}
            className="w-full p-3 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 hover:border-cyan-500/60 hover:bg-cyan-900/50 flex items-center gap-3 transition-all cursor-pointer group active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 text-white flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(6,182,212,0.4)] group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[20px]">switch_account</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-white group-hover:text-cyan-100 transition-colors">
                Trocar Usuário
              </div>
              <div className="text-xs text-cyan-200/60 truncate">
                Alterar para outra conta cadastrada
              </div>
            </div>
          </button>

          {/* 7. Sair (Logout) */}
          <button
            onClick={() => {
              setIsMenuOpen(false);
              if (onLogout) onLogout();
            }}
            className="w-full p-3 rounded-2xl bg-red-950/40 border border-red-500/30 hover:border-red-500/60 hover:bg-red-900/50 flex items-center gap-3 transition-all cursor-pointer group active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 to-rose-500 text-white flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(239,68,68,0.4)] group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[20px]">logout</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-red-100 group-hover:text-white transition-colors">
                Sair Definitivamente
              </div>
              <div className="text-xs text-red-200/60 truncate">
                Encerrar a sessão com segurança
              </div>
            </div>
          </button>


        </div>
      )}

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
