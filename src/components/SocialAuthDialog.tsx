import React, { useState, useEffect } from 'react';
import { UserAccount } from '../types';
import { loginWithGoogle, loginWithDirectGoogleAccount } from '../lib/authService';

interface SocialAuthDialogProps {
  isOpen: boolean;
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
  onClose,
  onSuccess,
}) => {
  if (!isOpen) return null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAddOther, setShowAddOther] = useState(false);
  const [otherEmail, setOtherEmail] = useState('');
  const [otherName, setOtherName] = useState('');
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_ACCOUNTS_KEY);
      if (raw) {
        const parsed: SavedAccount[] = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
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
      const cleanName = (name || cleanEmail.split('@')[0] || '').trim();
      const initials = cleanName
        .split(/\s+/)
        .filter(Boolean)
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase() || 'US';

      setSavedAccounts((prev) => {
        const filtered = prev.filter((a) => a.email.toLowerCase() !== cleanEmail);
        const updated = [
          { email: cleanEmail, name: cleanName, initials, lastUsed: new Date().toISOString() },
          ...filtered,
        ].slice(0, 5);
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

  // Login com a conta Google selecionada
  const handleSelectAccount = async (accountEmail: string, accountName?: string) => {
    setError('');
    setLoading(true);
    try {
      const user = await loginWithDirectGoogleAccount(accountEmail, accountName);
      saveAccountToRecent(accountEmail, accountName || user.name);
      onSuccess(user);
      onClose();
    } catch (err: any) {
      console.error('Falha ao autenticar conta Google:', err);
      setError(err?.message || 'Falha ao autenticar com esta conta Google.');
    } finally {
      setLoading(false);
    }
  };

  // Pop-up oficial do Google
  const handleOfficialGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const user = await loginWithGoogle();
      saveAccountToRecent(user.email, user.name);
      onSuccess(user);
      onClose();
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('fechada antes de concluir') || msg.includes('cancelada') || err?.code === 'auth/popup-closed-by-user') {
        console.info('Login Google cancelado pelo usuário.');
        setError('Seleção de conta cancelada.');
      } else {
        console.warn('Erro ao autenticar:', err);
        setError(msg || 'Falha na autenticação do Google. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
              <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
            </svg>
            <h3 className="font-black text-slate-900 text-base">Contas Google</h3>
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
          <div className="flex flex-col gap-3">
            <div className="text-left mb-1">
              <h4 className="font-bold text-slate-900 text-sm">Selecione ou adicione sua conta Google:</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Cada conta possui seus próprios dados e relatórios isolados.
              </p>
            </div>

            {error && (
              <div className="w-full p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs text-left animate-in fade-in">
                {error}
              </div>
            )}

            {/* Botão Oficial do Google */}
            <button
              type="button"
              onClick={handleOfficialGoogleLogin}
              disabled={loading}
              className="w-full py-3 px-4 rounded-2xl border-2 border-blue-500 hover:border-blue-600 bg-white text-slate-900 font-bold text-xs flex items-center justify-center gap-2.5 shadow-sm hover:shadow transition-all cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
              </svg>
              <span>{loading ? 'Conectando...' : 'Abrir Seletor de Contas do Google'}</span>
            </button>

            {/* List of Saved Accounts with 1-Click Login */}
            {savedAccounts.length > 0 && (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1 mt-2">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Contas recentes neste dispositivo:</div>
                {savedAccounts.map((account) => (
                  <div
                    key={account.email}
                    onClick={() => handleSelectAccount(account.email, account.name)}
                    className="w-full p-3 rounded-xl border border-slate-200 hover:border-blue-400 bg-white hover:bg-slate-50 transition-all cursor-pointer flex items-center justify-between shadow-xs active:scale-98"
                  >
                    <div className="flex items-center gap-3 text-left overflow-hidden">
                      <div className="w-9 h-9 rounded-full font-bold flex items-center justify-center shrink-0 shadow-xs text-white bg-blue-600 text-xs">
                        {account.initials || 'G'}
                      </div>
                      <div className="overflow-hidden">
                        <div className="font-bold text-slate-900 text-xs truncate">
                          {account.name}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {account.email}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        type="button"
                        title="Remover desta lista"
                        onClick={(e) => removeAccountFromRecent(e, account.email)}
                        className="p-1 text-slate-400 hover:text-red-500 rounded-md hover:bg-red-50 transition-colors"
                      >
                        <span className="material-symbols-outlined text-base">close</span>
                      </button>
                      <span className="material-symbols-outlined text-blue-600 text-base font-bold">
                        arrow_forward
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Alternar / Digitar conta Google */}
            {!showAddOther ? (
              <button
                type="button"
                onClick={() => setShowAddOther(true)}
                className="w-full py-2.5 px-3 rounded-xl border border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/50 text-slate-600 hover:text-blue-700 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer mt-1"
              >
                <span className="material-symbols-outlined text-base">add_circle</span>
                <span>Digitar e-mail Google (@gmail.com)</span>
              </button>
            ) : (
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 animate-in fade-in duration-200 mt-1">
                <div className="text-xs font-bold text-slate-800">Digitar e-mail do Google:</div>
                <input
                  type="email"
                  value={otherEmail}
                  onChange={(e) => setOtherEmail(e.target.value)}
                  placeholder="exemplo@gmail.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 outline-hidden font-medium"
                />
                <input
                  type="text"
                  value={otherName}
                  onChange={(e) => setOtherName(e.target.value)}
                  placeholder="Seu nome (opcional)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 outline-hidden font-medium"
                />
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={!otherEmail.trim() || loading}
                    onClick={() => handleSelectAccount(otherEmail, otherName)}
                    className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Entrar com esta Conta
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddOther(false)}
                    className="py-2 px-3 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
