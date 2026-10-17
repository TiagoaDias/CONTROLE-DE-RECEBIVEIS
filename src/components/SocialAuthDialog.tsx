import React, { useState, useEffect } from 'react';
import { UserAccount } from '../types';
import { signInWithGoogleOAuth } from '../lib/firebase';

interface SocialAuthDialogProps {
  isOpen: boolean;
  provider: 'gmail' | 'facebook' | 'whatsapp';
  onClose: () => void;
  onSuccess: (user: UserAccount) => void;
}

interface SavedAccount {
  email: string;
  name: string;
  initials: string;
  lastUsed: string;
}

const STORAGE_ACCOUNTS_KEY = 'haspaho_recent_google_accounts';

export const SocialAuthDialog: React.FC<SocialAuthDialogProps> = ({
  isOpen,
  provider,
  onClose,
  onSuccess,
}) => {
  if (!isOpen) return null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);

  // Load saved accounts on device
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_ACCOUNTS_KEY);
      if (raw) {
        const parsed: SavedAccount[] = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setSavedAccounts(parsed);
          return;
        }
      }
    } catch {}
    setSavedAccounts([]);
  }, []);

  const saveAccountToRecent = (email: string, name?: string) => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanName = name || cleanEmail.split('@')[0];
      const initials = cleanName
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase() || 'US';

      setSavedAccounts((prev) => {
        const filtered = prev.filter((a) => a.email.toLowerCase() !== cleanEmail);
        const updated = [
          { email: cleanEmail, name: cleanName, initials, lastUsed: new Date().toISOString() },
          ...filtered,
        ].slice(0, 5); // Keep up to 5 accounts
        localStorage.setItem(STORAGE_ACCOUNTS_KEY, JSON.stringify(updated));
        return updated;
      });
    } catch {}
  };

  const removeAccountFromRecent = (e: React.MouseEvent, emailToRemove: string) => {
    e.stopPropagation();
    try {
      const updated = savedAccounts.filter(
        (a) => a.email.toLowerCase() !== emailToRemove.toLowerCase()
      );
      setSavedAccounts(updated);
      localStorage.setItem(STORAGE_ACCOUNTS_KEY, JSON.stringify(updated));
    } catch {}
  };

  const handleGoogleLogin = async (emailToUse?: string) => {
    setError('');
    setLoading(true);
    try {
      // Explicit selection: only use an email if passed or typed
      const targetEmail = emailToUse !== undefined ? emailToUse.trim() : customEmail.trim();
      const user = await signInWithGoogleOAuth(targetEmail || undefined);
      if (user && user.email) {
        saveAccountToRecent(user.email, user.name);
      }
      onSuccess(user);
      onClose();
    } catch (err: any) {
      console.error('Google Auth error:', err);
      setError(err.message || 'Falha na autenticação Google. Escolha outra conta ou digite seu e-mail.');
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
              {provider === 'gmail' && 'Escolha uma Conta Google'}
              {provider === 'facebook' && 'Login com Facebook'}
              {provider === 'whatsapp' && 'Verificação WhatsApp'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {provider === 'gmail' && (
            <div className="flex flex-col gap-4">
              <div className="text-center">
                <h4 className="font-bold text-slate-900 text-base">Com qual conta você quer entrar?</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Selecione uma conta salva neste aparelho ou adicione um novo e-mail:
                </p>
              </div>

              {error && (
                <div className="w-full p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs text-left animate-in fade-in">
                  {error}
                </div>
              )}

              {/* List of Accounts Saved on Device */}
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {savedAccounts.map((account) => {
                  const isTiago = account.email.toLowerCase() === 'tiagodias8888@gmail.com';
                  return (
                    <div
                      key={account.email}
                      onClick={() => handleGoogleLogin(account.email)}
                      className={`w-full p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between shadow-xs active:scale-98 ${
                        isTiago
                          ? 'border-blue-500 bg-blue-50/70 hover:bg-blue-100/90'
                          : 'border-slate-200 hover:border-blue-400 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 text-left overflow-hidden">
                        <div
                          className={`w-10 h-10 rounded-full font-bold flex items-center justify-center shrink-0 shadow-xs text-white ${
                            isTiago ? 'bg-blue-600' : 'bg-emerald-600'
                          }`}
                        >
                          {account.initials || 'G'}
                        </div>
                        <div className="overflow-hidden">
                          <div className="font-extrabold text-slate-900 text-sm truncate">
                            {account.name}
                          </div>
                          <div className="text-[11px] text-slate-600 truncate">
                            {account.email} {isTiago && '• Gestor Mestre'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        {!isTiago && (
                          <button
                            type="button"
                            title="Remover desta lista"
                            onClick={(e) => removeAccountFromRecent(e, account.email)}
                            className="p-1 text-slate-400 hover:text-red-500 rounded-md hover:bg-red-50 transition-colors"
                          >
                            <span className="material-symbols-outlined text-base">close</span>
                          </button>
                        )}
                        <span className="material-symbols-outlined text-slate-400 text-lg">
                          arrow_forward
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="relative flex items-center justify-center my-0.5">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-white px-2 text-[10px] text-slate-400 font-bold uppercase shrink-0">
                  ou usar outra conta google
                </span>
              </div>

              {/* Custom Google Email Input Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (customEmail.trim()) {
                    handleGoogleLogin(customEmail.trim());
                  }
                }}
                className="space-y-3"
              >
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Digitar outro E-mail Google / Gmail:
                  </label>
                  <input
                    type="email"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    placeholder="exemplo.outro@gmail.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border-2 border-slate-200 focus:border-blue-600 text-xs text-slate-900 outline-hidden font-medium"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !customEmail.trim()}
                  className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                      <span>Autenticando...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-base">person_add</span>
                      <span>Entrar com este E-mail</span>
                    </>
                  )}
                </button>
              </form>

              <div className="relative flex items-center justify-center my-0.5">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-white px-2 text-[10px] text-slate-400 font-bold uppercase shrink-0">
                  ou seletor nativo do navegador
                </span>
              </div>

              {/* Official Google Account Chooser Button */}
              <button
                type="button"
                onClick={() => handleGoogleLogin()}
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-2.5 transition-all cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
                <span>Tentar Pop-up do Google no Navegador</span>
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
                  Utilize seu <strong>E-mail e Senha</strong> cadastrados ou faça login direto com <strong>Google</strong>.
                </p>
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
                <h4 className="font-bold text-slate-900 text-base">Verificação WhatsApp</h4>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Por favor, utilize seu <strong>E-mail e Senha</strong> ou sua conta <strong>Google</strong>.
                </p>
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
