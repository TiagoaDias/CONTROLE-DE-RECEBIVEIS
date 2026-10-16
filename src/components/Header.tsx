import React, { useState } from 'react';
import { ScreenTab, UserAccount, Debtor, Installment } from '../types';
import { APP_IMAGES } from '../data/mockData';
import { HaspahoLogo } from './HaspahoLogo';
import { PushNotificationManager } from './PushNotificationManager';
import { testConnection } from '../lib/firebase';

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
  installments?: Installment[];
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
  onToast?: (msg: string) => void;
  onSettleInstallment?: (inst: Installment) => void;
  onOpenCredorScore?: () => void;
  onNudgeWhatsApp?: (
    debtorName: string,
    amount: string,
    product: string,
    parcel: string,
    debtorPhone?: string,
    dueDate?: string
  ) => void;
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
  installments = [],
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
  onToast,
  onSettleInstallment,
  onOpenCredorScore,
  onNudgeWhatsApp,
}) => {
  const [isTestingFirebase, setIsTestingFirebase] = useState(false);

  const handleTestFirebase = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsTestingFirebase(true);
    const start = Date.now();
    try {
      const ok = await testConnection();
      const elapsed = Date.now() - start;
      if (ok) {
        if (onToast) onToast(`🔥 Conectividade Firebase 100% OK! Ping: ${elapsed}ms • Cloud Firestore Ativo`);
      } else {
        if (onToast) onToast('⚠️ Resposta do Firebase não confirmada. Verifique sua conexão.');
      }
    } catch {
      if (onToast) onToast('⚠️ Erro ao verificar resposta do Firebase.');
    } finally {
      setIsTestingFirebase(false);
    }
  };
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
            title="Ir para o Início / Tela Inicial HASPAHO"
          >
            <HaspahoLogo
              size="sm"
              variant="horizontal"
              darkTheme={isDarkMode}
            />
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <PushNotificationManager
              installments={installments}
              debtors={debtors}
              onToast={onToast}
              onNavigateToParcelas={() => onNavigate('parcelas')}
              onSettleInstallment={onSettleInstallment}
              onNudgeWhatsApp={onNudgeWhatsApp}
              isDarkMode={isDarkMode}
            />

            {onOpenCredorScore && (
              <button
                onClick={onOpenCredorScore}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-violet-600/30 flex items-center gap-1.5 transition-all cursor-pointer animate-pulse"
                title="Botão Mágico — Score do Credor & Controle de Limite"
              >
                <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                <span>Score do Credor</span>
              </button>
            )}

            <button
              onClick={() => onNavigate('perfil')}
              aria-label="Perfil do usuário"
              className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-blue-600/20 hover:ring-blue-600 transition-all cursor-pointer shadow-xs"
            >
              <img
                src={userAvatar}
                alt={userName}
                className="w-full h-full object-cover"
              />
            </button>
          </div>
        </div>

        {/* Mobile View Header (< md:) */}
        <div className="md:hidden flex items-center justify-between h-14 gap-2 w-full">
          <div
            onClick={() => onNavigate('inicio')}
            className="flex items-center gap-2 cursor-pointer min-w-0 flex-1"
          >
            <div className="shrink-0">
              <HaspahoLogo size="xs" variant="icon" darkTheme={isDarkMode} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className={`font-black text-xs leading-tight tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                HASPAHO
              </span>
              <span className={`text-[10px] font-bold leading-none truncate ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                GESTÃO DE RECEBÍVEIS
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onOpenCredorScore && (
              <button
                onClick={onOpenCredorScore}
                className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-[11px] shadow-sm flex items-center gap-1 cursor-pointer"
                title="Score do Credor"
              >
                <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                <span>Score</span>
              </button>
            )}
            <PushNotificationManager
              installments={installments}
              debtors={debtors}
              onToast={onToast}
              onNavigateToParcelas={() => onNavigate('parcelas')}
              onSettleInstallment={onSettleInstallment}
              onNudgeWhatsApp={onNudgeWhatsApp}
              isDarkMode={isDarkMode}
            />
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
      </div>
    </header>
  );
};
