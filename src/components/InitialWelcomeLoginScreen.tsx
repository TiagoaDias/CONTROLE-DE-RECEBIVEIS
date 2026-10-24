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
  onOpenPresentation?: () => void;
  onLogout?: () => void;
}

export const InitialWelcomeLoginScreen: React.FC<InitialWelcomeLoginScreenProps> = ({
  currentUser,
  onLoginSuccess,
  onEnterDashboard,
  onOpenPresentation,
  onLogout,
}) => {
  const [socialModalOpen, setSocialModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [directGmail, setDirectGmail] = useState('');

  const isLoggedIn = Boolean(currentUser && (currentUser.id || currentUser.email));

  // Executa a Autenticação e Verificação Google + Firebase
  const handleGoogleAuth = async () => {
    setErrorMessage('');
    setIsGoogleLoading(true);
    try {
      const user = await loginWithGoogle();
      onLoginSuccess(user, false);
    } catch (err: any) {
      console.info('Abrindo seletor de contas Gmail...', err);
      setSocialModalOpen(true);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleDirectGmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directGmail.trim()) {
      setSocialModalOpen(true);
      return;
    }
    setErrorMessage('');
    setIsGoogleLoading(true);
    try {
      const { loginWithDirectGoogleAccount } = await import('../lib/authService');
      const user = await loginWithDirectGoogleAccount(directGmail.trim());
      onLoginSuccess(user, false);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Informe um endereço @gmail.com válido.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center justify-center py-6 px-3 sm:px-6 relative z-10 pointer-events-auto animate-in fade-in duration-300">
      <div className="w-full max-w-4xl flex flex-col md:flex-row items-stretch bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden relative z-20 pointer-events-auto">
        {/* Coluna Esquerda: Apresentação da Marca & Segurança */}
        <div className="hidden md:flex md:w-[45%] bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 p-6 sm:p-8 flex-col justify-between text-white relative z-10 overflow-hidden shrink-0">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-blue-500/10 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none" />

          <div>
            <div className="flex items-center gap-3 mb-6">
              <HaspahoLogo size="md" variant="horizontal" darkTheme={true} />
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-[11px] font-bold tracking-wide uppercase mb-3 border border-blue-400/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Autenticação Oficial Gmail • Firebase Auth
            </div>

            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white leading-tight">
              HASPAHO • RECEBÍVEIS PRO
            </h2>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Plataforma com validação de conta Gmail (@gmail.com) e sincronização em nuvem protegida via Firebase.
            </p>

            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-3 text-xs text-slate-200">
                <span className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm font-bold">✓</span>
                <span>Acesso exclusivo e rápido com sua conta Gmail</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-200">
                <span className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm font-bold">✓</span>
                <span>Isolamento individual de recebíveis e devedores</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-200">
                <span className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm font-bold">✓</span>
                <span>Sincronização em tempo real com Firebase Firestore</span>
              </div>
            </div>
          </div>

          {isLoggedIn ? (
            <div className="mt-8 pt-4 border-t border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                  {(currentUser?.name || currentUser?.email || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-white truncate max-w-[130px]">{currentUser?.name || currentUser?.email || 'Usuário'}</div>
                  <div className="text-[10px] text-slate-400 truncate max-w-[130px]">{currentUser?.email || ''}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onEnterDashboard}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors cursor-pointer relative z-10"
                >
                  Entrar no App
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

        {/* Coluna Direita: Caixas de Autenticação OU Painel do Usuário Conectado */}
        <div className="w-full md:w-[55%] p-6 sm:p-8 flex flex-col justify-between bg-white relative z-20 pointer-events-auto">
          {isLoggedIn ? (
            /* CONTEÚDO PARA QUANDO O USUÁRIO JÁ ESTÁ LOGADO */
            <div className="space-y-6">
              <div className="mb-2 md:hidden flex items-center justify-center">
                <HaspahoLogo size="md" variant="horizontal" />
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-base shrink-0 shadow-xs">
                  ✓
                </div>
                <div>
                  <h4 className="font-black text-sm text-emerald-950">
                    Você já está conectado ao HASPAHO!
                  </h4>
                  <p className="text-xs text-emerald-700">
                    Sua sessão com {currentUser?.name || currentUser?.email} está 100% ativa.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  O que você gostaria de fazer agora?
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Como você já está autenticado, preparamos uma apresentação interativa automatizada explicando cada função do sistema, ou você pode ir direto ao seu controle de recebíveis.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                {/* Botão de Apresentação de Slides Automatizados */}
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenPresentation) onOpenPresentation();
                  }}
                  className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-black text-xs sm:text-sm flex items-center justify-between gap-3 shadow-lg shadow-indigo-600/25 transition-all cursor-pointer active:scale-98"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-2xl">slideshow</span>
                    <div className="text-left">
                      <div className="leading-tight">Apresentação do Sistema (Slides)</div>
                      <div className="text-[11px] font-normal text-blue-200">Tour interativo automatizado explicando tudo</div>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-xl">play_circle</span>
                </button>

                {/* Botão para Acessar o Dashboard */}
                <button
                  type="button"
                  onClick={onEnterDashboard}
                  className="w-full py-3.5 px-5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm flex items-center justify-between gap-3 shadow-md transition-all cursor-pointer active:scale-98"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-xl">dashboard</span>
                    <span>Ir para o Dashboard de Recebíveis</span>
                  </div>
                  <span className="material-symbols-outlined text-lg">arrow_forward</span>
                </button>
              </div>

              {onLogout && (
                <div className="pt-3 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={onLogout}
                    className="text-xs font-semibold text-slate-400 hover:text-red-600 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">logout</span>
                    <span>Desconectar desta conta</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* CONTEÚDO PARA QUANDO NÃO ESTÁ LOGADO (FORMULÁRIO DE LOGIN GMAIL) */
            <div>
              <div className="mb-4 md:hidden flex items-center justify-center">
                <HaspahoLogo size="md" variant="horizontal" />
              </div>

              <div className="mb-5 text-center md:text-left">
                <span className="text-[11px] font-black tracking-widest text-blue-600 uppercase">RECEBÍVEIS PRO</span>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
                  Entrar somente com Gmail
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Acesse rapidamente usando sua conta Google/Gmail (@gmail.com) com sincronização automática no Firebase.
                </p>
              </div>

              {errorMessage && (
                <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between gap-2 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] shrink-0 text-amber-600">info</span>
                    <span className="leading-snug font-medium">{errorMessage}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSocialModalOpen(true)}
                    className="text-[11px] font-bold text-blue-600 underline hover:text-blue-800 shrink-0 cursor-pointer"
                  >
                    Selecionar Conta
                  </button>
                </div>
              )}

              {/* BOTÃO PRINCIPAL DE ENTRADA COM CONTA GOOGLE / GMAIL */}
              <div className="space-y-3 py-2 relative z-10 pointer-events-auto">
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={isGoogleLoading}
                  className="w-full py-4 px-5 rounded-2xl border-2 border-blue-500 hover:border-blue-600 bg-white hover:bg-blue-50/60 text-slate-900 font-black text-sm flex items-center justify-center gap-3.5 shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-[0.98] disabled:opacity-75"
                >
                  {isGoogleLoading ? (
                    <div className="flex items-center gap-2.5 text-blue-600">
                      <span className="material-symbols-outlined animate-spin text-xl">sync</span>
                      <span className="font-bold">Conectando ao Gmail & Firebase...</span>
                    </div>
                  ) : (
                    <>
                      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"/>
                        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                        <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                      </svg>
                      <span className="tracking-wide">ENTRAR COM CONTA GMAIL</span>
                    </>
                  )}
                </button>

                {/* Entrada direta rápida somente com e-mail @gmail.com */}
                <form onSubmit={handleDirectGmailSubmit} className="pt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="email"
                      value={directGmail}
                      onChange={(e) => setDirectGmail(e.target.value)}
                      placeholder="Ou digite seu @gmail.com para entrar direto"
                      className="flex-1 px-3.5 py-3 rounded-xl border border-slate-300 focus:border-blue-500 bg-slate-50 focus:bg-white text-xs text-slate-900 outline-hidden font-medium"
                    />
                    <button
                      type="submit"
                      disabled={isGoogleLoading}
                      className="px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors cursor-pointer shrink-0 shadow-xs disabled:opacity-50"
                    >
                      Entrar
                    </button>
                  </div>
                </form>

                <button
                  type="button"
                  onClick={() => setSocialModalOpen(true)}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-slate-200"
                >
                  <span className="material-symbols-outlined text-base">account_circle</span>
                  <span>Ver Contas Gmail Salvas Neste Dispositivo</span>
                </button>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400 font-medium">
              HASPAHO Tecnologia da Informação • Suporte WhatsApp: (14) 99733-9863
            </p>
          </div>
        </div>
      </div>

      {/* Modal para Seleção Manual / Alternativa de Contas Google se necessário */}
      <SocialAuthDialog
        isOpen={socialModalOpen}
        onClose={() => setSocialModalOpen(false)}
        onSuccess={(user) => onLoginSuccess(user, false)}
      />
    </div>
  );
};
