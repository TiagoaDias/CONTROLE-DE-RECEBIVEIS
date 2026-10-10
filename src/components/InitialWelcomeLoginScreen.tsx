import React, { useState } from 'react';
import { UserAccount, Debtor, Installment } from '../types';
import { HaspahoLogo } from './HaspahoLogo';
import { SocialAuthDialog } from './SocialAuthDialog';
import {
  loginWithRealCredentials,
  registerRealUser,
  signInWithGoogleOAuth,
  signInWithFacebook,
  sendFirebasePasswordReset,
  activeFirebaseConfig,
} from '../lib/firebase';

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
  debtors = [],
  onLoginSuccess,
  onEnterDashboard,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'recover'>('login');

  // Form States - start empty to allow explicit method choice without autofill overriding
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Social Auth Modal State
  const [socialModalOpen, setSocialModalOpen] = useState(false);
  const [socialProvider, setSocialProvider] = useState<'gmail' | 'facebook' | 'whatsapp'>('gmail');

  // Register Form States
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regWhatsapp, setRegWhatsapp] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');
  const [regPixKey, setRegPixKey] = useState('');
  const [regCep, setRegCep] = useState('');

  // Feedback states
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);

  // Format phone helper
  const formatPhone = (val: string) => {
    const numbers = val.replace(/\D/g, '');
    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim();
    }
    return numbers.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim();
  };

  // Handle Real Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!loginIdentifier.trim()) {
      setErrorMessage('Por favor, informe seu usuário ou e-mail cadastrado.');
      return;
    }
    if (!loginPassword) {
      setErrorMessage('Por favor, informe sua senha de acesso.');
      return;
    }

    setIsLoading(true);
    try {
      const user = await loginWithRealCredentials(loginIdentifier, loginPassword);
      onLoginSuccess(user, false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha na autenticação. Verifique suas credenciais.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Real Registration Submit
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!regName.trim()) {
      setErrorMessage('Por favor, informe seu nome completo.');
      return;
    }
    if (!regEmail.trim() || !regEmail.includes('@')) {
      setErrorMessage('Por favor, informe um e-mail válido.');
      return;
    }
    if (!regWhatsapp.trim()) {
      setErrorMessage('Por favor, informe seu número de WhatsApp.');
      return;
    }
    if (!regPassword || regPassword.length < 6) {
      setErrorMessage('A senha deve possuir pelo menos 6 caracteres.');
      return;
    }
    if (regPassword !== regPasswordConfirm) {
      setErrorMessage('As senhas digitadas não coincidem.');
      return;
    }

    setIsLoading(true);
    try {
      const newUser = await registerRealUser(
        {
          name: regName.trim(),
          username: regUsername.trim() || regEmail.split('@')[0].toLowerCase(),
          email: regEmail.trim(),
          phoneWhatsapp: formatPhone(regWhatsapp),
          pixKey: regPixKey.trim() || regEmail.trim(),
          cep: regCep.trim() || '17320-000',
        },
        regPassword
      );
      onLoginSuccess(newUser, true);
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao realizar cadastro. Tente outro e-mail.');
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger Google Login
  const handleGoogleAuthDirect = async () => {
    setErrorMessage('');
    setUnauthorizedDomain(null);
    setIsLoading(true);
    try {
      const user = await signInWithGoogleOAuth();
      onLoginSuccess(user, false);
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        setErrorMessage('A janela de autenticação Google foi cancelada.');
      } else if (err.code === 'auth/unauthorized-domain' || (err.message && err.message.includes('unauthorized-domain'))) {
        const domain = window.location.hostname || 'controle-de-recebiveis.vercel.app';
        setUnauthorizedDomain(domain);
        setErrorMessage(`Domínio não autorizado (${domain}). Adicione este domínio no Firebase Console (Authentication > Configurações > Domínios autorizados).`);
      } else {
        setErrorMessage(err.message || 'Erro na autenticação Google.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger Facebook Login
  const handleFacebookAuthDirect = async () => {
    setErrorMessage('');
    setUnauthorizedDomain(null);
    setIsLoading(true);
    try {
      const user = await signInWithFacebook();
      onLoginSuccess(user, false);
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        setErrorMessage('A janela de autenticação do Facebook foi cancelada.');
      } else if (err.code === 'auth/unauthorized-domain' || (err.message && err.message.includes('unauthorized-domain'))) {
        const domain = window.location.hostname || 'controle-de-recebiveis.vercel.app';
        setUnauthorizedDomain(domain);
        setErrorMessage(`Domínio não autorizado (${domain}). Adicione este domínio no Firebase Console (Authentication > Configurações > Domínios autorizados).`);
      } else {
        setErrorMessage(err.message || 'Não foi possível entrar com Facebook. Verifique a configuração no console do Firebase.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger Social Auth Modal
  const openSocialAuth = (provider: 'gmail' | 'facebook' | 'whatsapp') => {
    if (provider === 'gmail') {
      handleGoogleAuthDirect();
      return;
    }
    if (provider === 'facebook') {
      handleFacebookAuthDirect();
      return;
    }
    setSocialProvider(provider);
    setSocialModalOpen(true);
  };

  // Recover Password States via Official Firebase Auth
  const [recoverEmail, setRecoverEmail] = useState('');
  const [recoverSuccessMsg, setRecoverSuccessMsg] = useState('');

  const handleFirebasePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setRecoverSuccessMsg('');

    const rawEmail = recoverEmail.trim().toLowerCase();
    if (!rawEmail || !rawEmail.includes('@')) {
      setErrorMessage('Por favor, informe um endereço de e-mail válido.');
      return;
    }

    setIsLoading(true);
    try {
      await sendFirebasePasswordReset(rawEmail);
      setRecoverSuccessMsg(
        `E-mail de recuperação enviado para ${rawEmail}! Verifique sua caixa de entrada (e a pasta de spam) para redefinir sua senha com segurança pelo Firebase.`
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao enviar e-mail de recuperação.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center justify-center py-6 px-3 sm:px-6 relative z-10 pointer-events-auto">
      {/* Social Modal */}
      <SocialAuthDialog
        isOpen={socialModalOpen}
        provider={socialProvider}
        onClose={() => setSocialModalOpen(false)}
        onSuccess={(u) => onLoginSuccess(u, false)}
      />

      <div className="w-full max-w-5xl flex flex-col md:flex-row items-stretch bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden relative z-20 pointer-events-auto">
        {/* Left Column: Brand & Security Presentation (Desktop / Tablet) */}
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
              Plataforma com isolamento individual de dados, autenticação real e integração direta com o banco de dados Firebase.
            </p>

            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-3 text-xs text-slate-200">
                <span className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm font-bold">✓</span>
                <span>Dados 100% isolados por conta e usuário</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-200">
                <span className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm font-bold">✓</span>
                <span>Contratos digitais e recibos com QR Code e Hash SHA-256</span>
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
                  {currentUser.name.charAt(0)}
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-white truncate max-w-[130px]">{currentUser.name}</div>
                  <div className="text-[10px] text-slate-400 truncate max-w-[130px]">{currentUser.email}</div>
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
            <div className="mt-8 pt-4 border-t border-white/10 text-[11px] text-slate-400 text-center">
              HASPAHO Tecnologia da Informação • Versão 2.5 PRO
            </div>
          )}
        </div>

        {/* Right Column: Authentication Form */}
        <div className="w-full md:w-[55%] p-6 sm:p-8 flex flex-col justify-between bg-white relative z-20 pointer-events-auto">
          <div>
            {/* Mobile Brand Header */}
            <div className="mb-4 md:hidden flex items-center justify-center">
              <HaspahoLogo size="md" variant="horizontal" />
            </div>

            {/* Header Titles */}
            <div className="mb-4">
              <span className="text-[11px] font-black tracking-widest text-blue-600 uppercase">RECEBÍVEIS PRO</span>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Entre na sua conta</h3>
            </div>

            {/* Tabs */}
            <div className="flex items-center border-b border-slate-200 pb-3 mb-5 gap-4">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  setErrorMessage('');
                }}
                className={`text-sm font-bold transition-colors pb-1 border-b-2 cursor-pointer ${
                  activeTab === 'login'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-400 hover:text-slate-700'
                }`}
              >
                Entrar na Conta
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('register');
                  setErrorMessage('');
                }}
                className={`text-sm font-bold transition-colors pb-1 border-b-2 cursor-pointer ${
                  activeTab === 'register'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-400 hover:text-slate-700'
                }`}
              >
                Cadastrar Nova Conta
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('recover');
                  setErrorMessage('');
                }}
                className={`text-xs font-semibold transition-colors pb-1 border-b-2 ml-auto cursor-pointer ${
                  activeTab === 'recover'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-400 hover:text-slate-700'
                }`}
              >
                Esqueci a Senha
              </button>
            </div>

            {/* Domain Authorization Helper Card */}
            {(unauthorizedDomain || errorMessage.includes('Domínio não autorizado')) && (
              <div className="mb-4 p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 text-xs shadow-sm animate-in fade-in duration-200">
                <div className="flex items-start gap-2.5 mb-2.5">
                  <span className="material-symbols-outlined text-amber-600 text-xl shrink-0 mt-0.5">domain_verification</span>
                  <div>
                    <h4 className="font-extrabold text-amber-900 text-sm">Domínio Não Autorizado no Firebase</h4>
                    <p className="text-amber-800 text-[11px] mt-0.5 leading-relaxed">
                      O login via Google/Facebook requer que o domínio <strong className="font-bold underline text-amber-950">{unauthorizedDomain || window.location.hostname}</strong> esteja registrado no Firebase Authentication.
                    </p>
                  </div>
                </div>

                <div className="bg-white/80 border border-amber-200 rounded-xl p-3 mb-3 space-y-1.5">
                  <p className="font-bold text-[11px] text-amber-900">Passo a passo rápido (leva 30 segundos):</p>
                  <ol className="list-decimal list-inside space-y-1 text-[11px] text-amber-900 pl-1 font-medium">
                    <li>Acesse o <strong>Firebase Console</strong> do projeto <code>{activeFirebaseConfig.projectId}</code></li>
                    <li>Vá em <strong>Authentication</strong> → aba <strong>Configurações</strong> → <strong>Domínios autorizados</strong></li>
                    <li>Clique em <strong>Adicionar domínio</strong> e cole <code>{unauthorizedDomain || window.location.hostname}</code></li>
                  </ol>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      const domainToCopy = unauthorizedDomain || window.location.hostname || 'controle-de-recebiveis.vercel.app';
                      navigator.clipboard.writeText(domainToCopy);
                      setCopiedDomain(true);
                      setTimeout(() => setCopiedDomain(false), 3000);
                    }}
                    className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <span className="material-symbols-outlined text-sm">
                      {copiedDomain ? 'check' : 'content_copy'}
                    </span>
                    {copiedDomain ? 'Domínio Copiado!' : `Copiar "${unauthorizedDomain || window.location.hostname}"`}
                  </button>

                  <a
                    href={`https://console.firebase.google.com/project/${activeFirebaseConfig.projectId}/authentication/settings`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold rounded-lg text-[11px] flex items-center gap-1.5 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                    Abrir Domínios no Firebase
                  </a>

                  <a
                    href={`https://console.firebase.google.com/project/${activeFirebaseConfig.projectId}/authentication/providers`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold rounded-lg text-[11px] flex items-center gap-1.5 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">toggle_on</span>
                    Ativar E-mail/Senha no Console
                  </a>
                </div>

                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] flex items-start gap-2">
                  <span className="material-symbols-outlined text-emerald-600 text-base shrink-0 mt-0.5">lock_open</span>
                  <div className="leading-snug">
                    <strong className="font-bold">Acesso imediato com E-mail e Senha:</strong> Você pode <strong>entrar ou criar uma nova conta</strong> no formulário abaixo imediatamente, com armazenamento seguro no Firestore!
                  </div>
                </div>
              </div>
            )}

            {/* Error Message (for other errors) */}
            {errorMessage && !unauthorizedDomain && !errorMessage.includes('Domínio não autorizado') && (
              <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2 animate-in fade-in duration-200">
                <span className="material-symbols-outlined text-[18px] shrink-0 text-red-600">error</span>
                <span className="leading-snug">{errorMessage}</span>
              </div>
            )}

            {/* Success Message */}
            {recoverSuccessMsg && (
              <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2 animate-in fade-in duration-200">
                <span className="material-symbols-outlined text-[18px] shrink-0 text-emerald-600">check_circle</span>
                <span className="leading-snug">{recoverSuccessMsg}</span>
              </div>
            )}

            {/* TAB 1: LOGIN */}
            {activeTab === 'login' && (
              <div className="space-y-3.5 relative z-10 pointer-events-auto">
                {/* 1. Google Button */}
                <button
                  type="button"
                  onClick={handleGoogleAuthDirect}
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 rounded-xl border-2 border-slate-200 hover:border-blue-600 hover:bg-slate-50 bg-white text-slate-900 font-bold text-xs sm:text-sm flex items-center justify-center gap-3 shadow-xs transition-colors cursor-pointer relative z-20 pointer-events-auto opacity-100"
                >
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"/>
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                  </svg>
                  <span className="font-extrabold tracking-wide">ENTRAR COM GOOGLE</span>
                </button>

                {/* 2. Facebook Button */}
                <button
                  type="button"
                  onClick={handleFacebookAuthDirect}
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 rounded-xl border-2 border-slate-200 hover:border-blue-600 hover:bg-slate-50 bg-white text-slate-900 font-bold text-xs sm:text-sm flex items-center justify-center gap-3 shadow-xs transition-colors cursor-pointer relative z-20 pointer-events-auto opacity-100"
                >
                  <svg className="w-5 h-5 shrink-0" fill="#1877F2" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  <span className="font-extrabold tracking-wide">ENTRAR COM FACEBOOK</span>
                </button>

                {/* Divider */}
                <div className="relative flex items-center justify-center my-3">
                  <div className="border-t border-slate-200 w-full" />
                  <span className="bg-white px-3 text-[11px] text-slate-500 uppercase font-bold shrink-0">
                    ──────── ou com e-mail e senha ────────
                  </span>
                </div>

                <form onSubmit={handleLoginSubmit} className="space-y-3.5 relative z-10">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      E-mail
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3.5 top-3 text-slate-400 text-lg pointer-events-none">
                        person
                      </span>
                      <input
                        type="text"
                        value={loginIdentifier}
                        onChange={(e) => setLoginIdentifier(e.target.value)}
                        placeholder="seu.email@exemplo.com ou usuário"
                        className="w-full pl-10 pr-3.5 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 text-xs sm:text-sm text-slate-900 bg-white placeholder:text-slate-400 outline-hidden transition-all font-medium relative z-10"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">Senha</label>
                    </div>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3.5 top-3 text-slate-400 text-lg pointer-events-none">
                        lock
                      </span>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-11 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 text-xs sm:text-sm text-slate-900 bg-white placeholder:text-slate-400 outline-hidden transition-all font-medium relative z-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-700 cursor-pointer p-0.5 z-20"
                        title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        <span className="material-symbols-outlined text-xl">
                          {showPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* 4. ENTRAR Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs sm:text-sm tracking-wider flex items-center justify-center gap-2 shadow-md transition-colors disabled:opacity-50 cursor-pointer relative z-20 pointer-events-auto opacity-100"
                  >
                    {isLoading ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                        <span>VALIDANDO CREDENCIAIS...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[18px]">login</span>
                        <span>ENTRAR</span>
                      </>
                    )}
                  </button>

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('recover');
                        setErrorMessage('');
                      }}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer relative z-20"
                    >
                      Esqueci minha senha
                    </button>
                  </div>

                  {/* Master Developer Quick Fill & Login Button */}
                  <button
                    type="button"
                    onClick={async () => {
                      setLoginIdentifier('tiagodias8888@gmail.com');
                      setLoginPassword('haspaho2026');
                      setIsLoading(true);
                      setErrorMessage('');
                      try {
                        const user = await loginWithRealCredentials('tiagodias8888@gmail.com', 'haspaho2026');
                        onLoginSuccess(user, false);
                      } catch (err: any) {
                        setErrorMessage(err.message || 'Falha ao autenticar administrador.');
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    disabled={isLoading}
                    className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-50 to-blue-50 border border-blue-200 hover:border-blue-400 text-slate-800 text-[11px] font-bold flex items-center justify-between transition-colors cursor-pointer relative z-20"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-amber-500 text-[16px] font-bold">crown</span>
                      <span>Entrar como: Tiago Augusto Dias (Admin)</span>
                    </div>
                    <span className="text-[9px] bg-blue-600 text-white font-mono font-black px-1.5 py-0.5 rounded">
                      ADMIN
                    </span>
                  </button>
                </form>

                {/* Switch to Register footer */}
                <div className="mt-4 pt-3 border-t border-slate-200 text-center relative z-20">
                  <p className="text-xs text-slate-600 mb-2">Não possui uma conta?</p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('register');
                      setErrorMessage('');
                    }}
                    className="w-full py-3 px-4 rounded-xl border-2 border-blue-600 text-blue-600 hover:bg-blue-50 font-black text-xs sm:text-sm tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer relative z-20 pointer-events-auto opacity-100"
                  >
                    <span className="material-symbols-outlined text-lg">person_add</span>
                    <span>CADASTRAR</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: REGISTER */}
            {activeTab === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nome Completo</label>
                    <input
                      type="text"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="Ex: Maria Oliveira"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-blue-500 text-xs text-slate-900 outline-hidden"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Usuário / Apelido</label>
                    <input
                      type="text"
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      placeholder="Ex: mariaoliveira"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-blue-500 text-xs text-slate-900 outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">E-mail de Acesso</label>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="seu.email@exemplo.com"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-blue-500 text-xs text-slate-900 outline-hidden"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp / Telefone</label>
                    <input
                      type="tel"
                      value={regWhatsapp}
                      onChange={(e) => setRegWhatsapp(e.target.value)}
                      placeholder="(11) 99999-9999"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-blue-500 text-xs text-slate-900 outline-hidden"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Senha (mín. 6 dígitos)</label>
                    <input
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-blue-500 text-xs text-slate-900 outline-hidden"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Confirmar Senha</label>
                    <input
                      type="password"
                      value={regPasswordConfirm}
                      onChange={(e) => setRegPasswordConfirm(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-blue-500 text-xs text-slate-900 outline-hidden"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Chave PIX (para Recibos)</label>
                    <input
                      type="text"
                      value={regPixKey}
                      onChange={(e) => setRegPixKey(e.target.value)}
                      placeholder="E-mail, CPF ou Telefone"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-blue-500 text-xs text-slate-900 outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">CEP</label>
                    <input
                      type="text"
                      value={regCep}
                      onChange={(e) => setRegCep(e.target.value)}
                      placeholder="00000-000"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-blue-500 text-xs text-slate-900 outline-hidden"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                        <span>Criando sua Conta Segura...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
                        <span>Cadastrar e Iniciar Ambiente Novo</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 3: RECOVER VIA OFFICIAL FIREBASE AUTH */}
            {activeTab === 'recover' && (
              <form onSubmit={handleFirebasePasswordReset} className="space-y-4">
                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-[20px] text-blue-600 shrink-0 mt-0.5">lock_reset</span>
                  <div className="text-[12px] leading-relaxed">
                    <strong className="block font-bold mb-0.5">Recuperação de Senha Segura (Firebase)</strong>
                    <span>Digite o e-mail cadastrado na sua conta. Você receberá um link oficial do Firebase para redefinir sua senha com total segurança.</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    E-mail Cadastrado
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-3 text-slate-400 text-lg pointer-events-none">
                      mail
                    </span>
                    <input
                      type="email"
                      value={recoverEmail}
                      onChange={(e) => setRecoverEmail(e.target.value)}
                      placeholder="seu.email@exemplo.com"
                      className="w-full pl-10 pr-3.5 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 text-xs sm:text-sm text-slate-900 bg-white placeholder:text-slate-400 outline-hidden transition-all font-medium"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs sm:text-sm tracking-wide flex items-center justify-center gap-2 shadow-md transition-colors disabled:opacity-60 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                        <span>ENVIANDO E-MAIL...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[18px]">send</span>
                        <span>ENVIAR LINK DE RECUPERAÇÃO</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('login');
                      setErrorMessage('');
                    }}
                    className="w-full sm:w-auto py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
                  >
                    Voltar ao Login
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
