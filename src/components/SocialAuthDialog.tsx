import React, { useState } from 'react';
import { UserAccount } from '../types';
import { signInWithGoogleOAuth } from '../lib/firebase';

interface SocialAuthDialogProps {
  isOpen: boolean;
  provider: 'gmail' | 'facebook' | 'whatsapp';
  onClose: () => void;
  onSuccess: (user: UserAccount) => void;
}

export const SocialAuthDialog: React.FC<SocialAuthDialogProps> = ({
  isOpen,
  provider,
  onClose,
  onSuccess,
}) => {
  if (!isOpen) return null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const user = await signInWithGoogleOAuth();
      onSuccess(user);
      onClose();
    } catch (err: any) {
      console.error('Google Auth error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('A janela de autenticação Google foi fechada.');
      } else {
        setError(err.message || 'Falha na autenticação Google. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            {provider === 'gmail' && (
              <span className="material-symbols-outlined text-red-500 text-2xl">mail</span>
            )}
            {provider === 'facebook' && (
              <span className="material-symbols-outlined text-blue-600 text-2xl">public</span>
            )}
            {provider === 'whatsapp' && (
              <span className="material-symbols-outlined text-emerald-600 text-2xl">chat</span>
            )}
            <h3 className="font-bold text-slate-900 text-base">
              {provider === 'gmail' && 'Autenticação Google / Gmail'}
              {provider === 'facebook' && 'Login com Facebook'}
              {provider === 'whatsapp' && 'Verificação WhatsApp'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {provider === 'gmail' && (
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center border border-red-100">
                <span className="material-symbols-outlined text-3xl">account_circle</span>
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-base">Autenticação Oficial Google</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Acesse sua conta HASPAHO de forma rápida e segura utilizando o OAuth oficial do Google.
                </p>
              </div>

              {error && (
                <div className="w-full p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs text-left">
                  {error}
                </div>
              )}

              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-sm flex items-center justify-center gap-3 shadow-md hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                    <span>Conectando ao Google...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                      />
                    </svg>
                    <span>Entrar com Conta Google</span>
                  </>
                )}
              </button>
            </div>
          )}

          {provider === 'facebook' && (
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                <span className="material-symbols-outlined text-3xl">lock</span>
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-base">Provedor Não Configurado</h4>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  O provedor de login com o Facebook não está habilitado no Firebase Console deste projeto.
                </p>
                <div className="mt-3 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs text-left">
                  <div className="font-bold flex items-center gap-1.5 mb-1">
                    <span className="material-symbols-outlined text-[16px]">info</span>
                    Autenticação Real Necessária:
                  </div>
                  Para garantir a segurança dos seus dados financeiros, utilize seu <strong>E-mail e Senha</strong> cadastrados ou faça login direto com <strong>Google</strong>.
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors cursor-pointer"
              >
                Voltar e Entrar com E-mail ou Google
              </button>
            </div>
          )}

          {provider === 'whatsapp' && (
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                <span className="material-symbols-outlined text-3xl">verified_user</span>
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-base">Verificação WhatsApp Oficial</h4>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  O login por WhatsApp requer o envio de código OTP via API Oficial da Meta / Twilio configurada.
                </p>
                <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs text-left">
                  <div className="font-bold flex items-center gap-1.5 mb-1">
                    <span className="material-symbols-outlined text-[16px]">security</span>
                    Segurança de Acesso:
                  </div>
                  Em conformidade com as diretrizes de segurança, não são permitidos acessos sem validação real de credencial. Por favor, utilize seu <strong>E-mail e Senha</strong> ou sua conta <strong>Google</strong>.
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors cursor-pointer"
              >
                Entrar com Credenciais Reais
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
