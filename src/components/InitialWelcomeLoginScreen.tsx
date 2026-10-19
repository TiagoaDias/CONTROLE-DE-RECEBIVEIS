import React, { useState } from 'react';
import { UserAccount, Debtor, Installment } from '../types';
import { HaspahoLogo } from './HaspahoLogo';
import { SocialAuthDialog } from './SocialAuthDialog';
import { loginWithGoogle } from '../lib/authService';

interface InitialWelcomeLoginScreenProps {
  currentUser: UserAccount | null;
  debtors?: Debtor[];
  installments?: Installment[];
  onLoginSuccess: (user: UserAccount, isNewAccount?: boolean) => void;
  onEnterDashboard: () => void;
  onOpenGeminiScanner?: () => void;
  onLogout?: () => void;
}

export const InitialWelcomeLoginScreen: React.FC<InitialWelcomeLoginScreenProps> = ({
  currentUser,
  onLoginSuccess,
  onEnterDashboard,
  onLogout,
}) => {
  const [socialModalOpen, setSocialModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Trigger Google Login
  const handleGoogleAuth = async () => {
    setErrorMessage('');
    setIsGoogleLoading(true);
    try {
      const user = await loginWithGoogle();
      onLoginSuccess(user, false);
    } catch (err: any) {
      console.error('Falha no login Google:', err);
      const msg = err?.message || '';
      if (msg.includes('fechada antes de concluir') || msg.includes('cancelada')) {
        setErrorMessage('Seleção de conta cancelada.');
      } else {
        setErrorMessage(msg || 'Não foi possível autenticar pelo navegador. Selecione ou digite sua conta Google abaixo:');
        setSocialModalOpen(true);
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center justify-center py-6 px-3 sm:px-6 relative z-10 pointer-events-auto">
      <div className="w-full max-w-4xl flex flex-col md:flex-row items-stretch bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden relative z-20 pointer-events-auto">
        {/* Left Column: Brand & Security Presentation */}
        <div className="hidden md:flex md:w-[45%] bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 p-6 sm:p-8 flex-col justify-between text-white relative z-10 overflow-hidden shrink-0">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-blue-500/10 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none" />

          <div>
            <div className="flex items-center gap-3 mb-6">
              <HaspahoLogo size="md" variant="horizontal" darkTheme={true} />
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-[11px] font-bold tracking-wide uppercase mb-3 border border-blue-400/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Ambiente Seguro • HASPAHO ERP PRO
            </div>

            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white leading-tight">
              HASPAHO • RECEBÍVEIS PRO
            </h2>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Plataforma com isolamento individual de dados, autenticação Google oficial e sincronização segura via Firebase.
            </p>

            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-3 text-xs text-slate-200">
                <span className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm font-bold">✓</span>
                <span>Dados 100% isolados por conta Google</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-200">
                <span className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm font-bold">✓</span>
                <span>Contratos digitais e recibos com QR Code</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-200">
                <span className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm font-bold">✓</span>
                <span>Sincronização em nuvem via Firebase Firestore</span>
              </div>
            </div>
          </div>

          {currentUser ? (
            <div className="mt-8 pt-4 border-t border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                  {(currentUser.name || currentUser.email || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-white truncate max-w-[130px]">{currentUser.name || currentUser.email || 'Usuário'}</div>
                  <div className="text-[10px] text-slate-400 truncate max-w-[130px]">{currentUser.email || ''}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onEnterDashboard}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors cursor-pointer relative z-10"
                >
                  Entrar
                </button>
                {onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer relative z-10"
                    title="Sair da Conta"
                  >
                    <span className="material-symbols-outlined text-[16px]">logout</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-8 pt-4 border-t border-white/10 flex flex-col items-center gap-2">
              <div className="text-[11px] text-slate-400 text-center font-medium">
                HASPAHO Tecnologia da Informação • Versão 90 PRO Segura
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Google Authentication Box */}
        <div className="w-full md:w-[55%] p-6 sm:p-8 flex flex-col justify-between bg-white relative z-20 pointer-events-auto">
          <div>
            <div className="mb-4 md:hidden flex items-center justify-center">
              <HaspahoLogo size="md" variant="horizontal" />
            </div>

            <div className="mb-6 text-center md:text-left">
              <span className="text-[11px] font-black tracking-widest text-blue-600 uppercase">RECEBÍVEIS PRO</span>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">Acesse com sua conta Google</h3>
              <p className="text-xs text-slate-500 mt-1">
                Segurança avançada com seleção obrigatória de conta e sincronização em nuvem.
              </p>
            </div>

            {errorMessage && (
              <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2 animate-in fade-in duration-200">
                <span className="material-symbols-outlined text-[18px] shrink-0 text-red-600">error</span>
                <span className="leading-snug">{errorMessage}</span>
              </div>
            )}

            <div className="space-y-3 py-3 relative z-10 pointer-events-auto">
              {/* Botão Oficial Google Único e Direto */}
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={isGoogleLoading}
                className="w-full py-4 px-4 rounded-2xl border-2 border-blue-500 hover:border-blue-600 bg-white hover:bg-blue-50/50 text-slate-900 font-extrabold text-sm flex items-center justify-center gap-3 shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-[0.98]"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
                <span>{isGoogleLoading ? 'Conectando ao Google...' : 'ENTRAR COM CONTA GOOGLE'}</span>
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400">
              HASPAHO Tecnologia da Informação • Suporte WhatsApp: (14) 99733-9863
            </p>
          </div>
        </div>
      </div>

      {/* Modal para Alternar Contas ou Digitar a 2ª Conta Google */}
      <SocialAuthDialog
        isOpen={socialModalOpen}
        onClose={() => setSocialModalOpen(false)}
        onSuccess={(user) => onLoginSuccess(user, false)}
      />
    </div>
  );
};
