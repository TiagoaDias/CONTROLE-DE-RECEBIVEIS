import React from 'react';
import { ScreenTab, UserAccount, Debtor } from '../types';
import { APP_IMAGES } from '../data/mockData';
import { HaspahoLogo } from './HaspahoLogo';

interface HeaderProps {
  currentTab: ScreenTab;
  onNavigate: (tab: ScreenTab, targetId?: string, extraId?: string) => void;
  onBack?: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenAssetInspector: () => void;
  onOpenNewPurchase?: () => void;
  onOpenGeminiScanner?: () => void;
  titleOverride?: string;
  subtitleOverride?: string;
  isStackScreen?: boolean;
  currentUser?: UserAccount | null;
  debtors?: Debtor[];
  onOpenNewDebtor?: () => void;
  onEditDebtor?: (debtor: Debtor) => void;
  onOpenContract?: (debtorId: string) => void;
  onOpenLogin?: () => void;
  onOpenWelcome?: () => void;
  onOpenUserSettings?: () => void;
  onLogout?: () => void;
  onOpenAuthLookup?: () => void;
  onRestoreAllData?: () => void;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onNavigate,
  onBack,
  searchQuery,
  onSearchChange,
  onOpenAssetInspector,
  onOpenNewPurchase,
  onOpenGeminiScanner,
  titleOverride,
  subtitleOverride,
  isStackScreen,
  currentUser,
  debtors = [],
  onOpenNewDebtor,
  onEditDebtor,
  onOpenContract,
  onOpenLogin,
  onOpenWelcome,
  onOpenUserSettings,
  onLogout,
  onOpenAuthLookup,
  onRestoreAllData,
  isDarkMode,
  onToggleTheme,
}) => {
  const getSubLabel = () => {
    switch (currentTab) {
      case 'inicio': return 'Início 3D • Login & Boas-Vindas';
      case 'dashboard': return 'HASPAHO • Dashboard';
      case 'devedores': return 'Devedores & Lápis de Edição';
      case 'parcelas': return 'Parcelas & Recebíveis';
      case 'relatorios': return 'Relatórios de Cobrança';
      case 'perfil': return 'Usuário & HASPAHO Info';
      case 'detalhe-atraso': return 'Em atraso • Fatura fechada';
      case 'detalhe-parcela': return 'Liquidação & Contrato';
      case 'erp-legacy': return 'Sistema ERP Enterprise • Delphi Desktop';
      case 'admin-forum': return '👑 Painel Admin Master & Fórum';
      default: return 'Financeiro';
    }
  };

  const userName = currentUser?.name || 'Tiago Dias';
  const userEmail = currentUser?.email || 'tiagodias8888@gmail.com';
  const userAvatar = currentUser?.avatar || APP_IMAGES.currentUser;

  // Stack Header for sub-screens (Detalhe Parcela, Detalhe Atraso)
  if (isStackScreen) {
    return (
      <header className={`fixed top-0 inset-x-0 z-40 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.03)] border-b transition-colors ${
        isDarkMode ? 'bg-slate-900/95 border-slate-800 text-white' : 'bg-white/95 border-slate-100 text-slate-900'
      }`}>
        <div className="h-16 w-full px-3 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBack || (() => onNavigate('dashboard'))}
              aria-label="Voltar"
              className={`w-10 h-10 -ml-1.5 flex items-center justify-center rounded-full transition-colors shrink-0 cursor-pointer ${
                isDarkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 active:bg-slate-200 text-slate-800'
              }`}
            >
              <span className="material-symbols-outlined text-[24px]">arrow_back</span>
            </button>
            <div className="cursor-pointer shrink-0" onClick={() => onNavigate('dashboard')}>
              <HaspahoLogo size="sm" variant="icon" />
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className={`font-bold text-sm sm:text-base leading-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {titleOverride || 'Detalhe'}
              </h1>
              <span className={`text-[11px] sm:text-xs truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {subtitleOverride || getSubLabel()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Avatar do Usuário */}
            <button
              onClick={() => onNavigate('perfil')}
              aria-label="Perfil do usuário"
              className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-blue-600/20 hover:ring-blue-600 transition-all ml-1 cursor-pointer shadow-xs"
            >
              <img
                src={userAvatar}
                alt={userName}
                className="w-full h-full object-cover"
              />
            </button>
          </div>
        </div>
      </header>
    );
  }

  // Main Header with responsive desktop expansion & mobile optimization
  return (
    <header className={`fixed top-0 inset-x-0 z-40 backdrop-blur-xl shadow-xs border-b transition-colors ${
      isDarkMode ? 'bg-slate-900/90 border-slate-800 text-slate-100' : 'bg-white/80 border-slate-200/60 text-slate-900'
    }`}>
      <div className="w-full px-3 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        {/* Desktop Single-Row Navbar (md: and above) */}
        <div className="hidden md:flex items-center justify-between h-16 gap-4">
          {/* Official HASPAHO Logo & Brand */}
          <div
            onClick={() => onNavigate('inicio')}
            className="flex items-center gap-3 cursor-pointer shrink-0 group"
            title="Ir para o Início 3D / Tela Inicial"
          >
            <HaspahoLogo
              size="sm"
              variant="horizontal"
              customName={currentTab === 'inicio' ? 'DESENVOLVEDOR FULL STACK' : userName}
            />
          </div>

          {/* Search bar & Theme Toggle */}
          <div className="flex items-center gap-1.5 lg:gap-2.5 shrink-0">
            <div className="relative w-48 sm:w-60 md:w-72 lg:w-80">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Buscar devedor..."
                className="w-full h-9 px-3 pr-6 bg-slate-50 text-slate-800 placeholder:text-slate-400 text-xs rounded-xl outline-none border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="absolute right-2 text-slate-400 hover:text-slate-600 top-2.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">close</span>
                </button>
              )}
            </div>

          </div>
        </div>

        {/* Mobile View Header (< md:) */}
        <div className="md:hidden flex flex-col justify-between py-2 gap-1.5">
          {/* Top line with Logo and Branding */}
          <div className="flex items-center justify-between h-11 gap-2 w-full">
            <div
              onClick={() => onNavigate('inicio')}
              className="flex items-center gap-2 cursor-pointer min-w-0 flex-1"
            >
              <div className="shrink-0">
                <HaspahoLogo size="sm" variant="icon" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-black text-slate-900 text-xs leading-tight tracking-tight truncate">
                  HASPAHO {currentTab === 'inicio' ? '• FULL STACK' : `• ${userName.split(' ')[0]}`}
                </span>
                <span className="text-[10px] text-slate-500 font-medium leading-none truncate">
                  {getSubLabel()}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => onNavigate('perfil')}
                aria-label="Perfil do usuário"
                className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-blue-600/20 hover:ring-blue-600 transition-all cursor-pointer shadow-xs"
              >
                <img
                  src={userAvatar}
                  alt={userName}
                  className="w-full h-full object-cover"
                />
              </button>
            </div>
          </div>

          {/* Mobile Second Line: Search Bar */}
          <div className="relative w-full mt-1.5">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar devedor..."
              className="w-full h-9 px-3 pr-8 bg-slate-100 text-slate-800 placeholder:text-slate-400 text-xs rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 text-slate-400 hover:text-slate-600 top-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
