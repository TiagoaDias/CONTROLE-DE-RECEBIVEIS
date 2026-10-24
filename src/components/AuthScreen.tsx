import React, { useState } from 'react';
import { UserAccount } from '../types';
import { HaspahoLogo } from './HaspahoLogo';
import { SocialAuthDialog } from './SocialAuthDialog';
import { loginWithGoogle } from '../lib/authService';

interface AuthScreenProps {
  isOpen: boolean;
  onClose?: () => void;
  onLoginSuccess: (user: UserAccount, isNewAccount?: boolean) => void;
  initialMode?: 'login' | 'register';
  canClose?: boolean;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  canClose = true,
}) => {
  const [socialModalOpen, setSocialModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleGoogleDirect = async () => {
    setErrorMessage('');
    setIsLoading(true);
    try {
      const user = await loginWithGoogle();
      onLoginSuccess(user, false);
      if (onClose) onClose();
    } catch (err: any) {
      console.info('Abertura do seletor de contas Gmail...', err);
      setSocialModalOpen(true);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <SocialAuthDialog
        isOpen={socialModalOpen}
        onClose={() => setSocialModalOpen(false)}
        onSuccess={(u) => {
          onLoginSuccess(u, false);
          if (onClose) onClose();
        }}
      />

      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <HaspahoLogo size="md" variant="horizontal" />
            {canClose && onClose && (
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            )}
          </div>

          <div className="mb-4 text-center">
            <span className="text-[11px] font-black tracking-widest text-blue-600 uppercase">RECEBÍVEIS PRO</span>
            <h3 className="text-xl font-black text-slate-900 mt-1">Entrar somente com Gmail</h3>
            <p className="text-xs text-slate-500 mt-1">
              Segurança avançada com login direto usando sua conta @gmail.com.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] shrink-0 text-amber-600">info</span>
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setSocialModalOpen(true)}
                className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">account_circle</span>
                <span>SELECIONAR OU DIGITAR CONTA GMAIL</span>
              </button>
            </div>
          )}

          <div className="space-y-3 py-2">
            {/* Google Login Sem Pop-up */}
            <button
              type="button"
              onClick={handleGoogleDirect}
              disabled={isLoading}
              className="w-full py-3.5 px-4 rounded-xl border-2 border-blue-500 hover:border-blue-600 bg-white hover:bg-blue-50/50 text-slate-900 font-bold text-xs sm:text-sm flex items-center justify-center gap-3 shadow-xs transition-colors cursor-pointer"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
              </svg>
              <div className="text-left">
                <div className="font-extrabold text-xs">{isLoading ? 'Conectando...' : 'ENTRAR COM CONTA GMAIL'}</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSocialModalOpen(true)}
              className="w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-slate-200"
            >
              <span className="material-symbols-outlined text-base">manage_accounts</span>
              <span>Alternar ou Digitar E-mail @gmail.com</span>
            </button>

            
            {/* Logout */}
            <button
              type="button"
              onClick={async () => {
                await import('../lib/authService').then(m => m.logoutUser());
                window.location.reload();
              }}
              className="w-full py-2 px-3 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 text-[10px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer mt-4"
            >
              <span className="material-symbols-outlined text-[14px]">logout</span>
              <span>Sair da conta atual</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
