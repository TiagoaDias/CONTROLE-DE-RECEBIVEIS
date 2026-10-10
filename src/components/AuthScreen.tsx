import React, { useState } from 'react';
import { UserAccount } from '../types';
import { HaspahoLogo } from './HaspahoLogo';
import { SocialAuthDialog } from './SocialAuthDialog';
import {
  loginWithRealCredentials,
  registerRealUser,
  signInWithGoogleOAuth,
  signInWithFacebook,
} from '../lib/firebase';

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
  initialMode = 'login',
  canClose = true,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [socialModalOpen, setSocialModalOpen] = useState(false);
  const [socialProvider, setSocialProvider] = useState<'gmail' | 'facebook' | 'whatsapp'>('gmail');

  // Login Form States - start empty
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register Form States
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regWhatsapp, setRegWhatsapp] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');

  // Feedback
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  // Format Brazilian phone number
  const formatPhone = (val: string) => {
    const numbers = val.replace(/\D/g, '');
    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim();
    }
    return numbers.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim();
  };

  // Handle Real Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!loginIdentifier.trim()) {
      setErrorMessage('Por favor, informe seu usuário ou e-mail cadastrado.');
      return;
    }
    if (!loginPassword) {
      setErrorMessage('Por favor, digite sua senha de acesso.');
      return;
    }

    setIsLoading(true);
    try {
      const user = await loginWithRealCredentials(loginIdentifier, loginPassword);
      onLoginSuccess(user, false);
      if (onClose) onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha na autenticação. Verifique os dados informados.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Real Register
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!regName.trim()) {
      setErrorMessage('Por favor, preencha seu nome completo.');
      return;
    }
    if (!regEmail.trim() || !regEmail.includes('@')) {
      setErrorMessage('Por favor, informe um endereço de e-mail válido.');
      return;
    }
    if (!regWhatsapp.trim()) {
      setErrorMessage('Por favor, informe seu número de WhatsApp.');
      return;
    }
    if (!regPassword || regPassword.length < 6) {
      setErrorMessage('A senha deve conter no mínimo 6 caracteres.');
      return;
    }
    if (regPassword !== regPasswordConfirm) {
      setErrorMessage('A confirmação de senha não confere.');
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
        },
        regPassword
      );
      onLoginSuccess(newUser, true);
      if (onClose) onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao cadastrar novo usuário.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleDirect = async () => {
    setErrorMessage('');
    setIsLoading(true);
    try {
      const user = await signInWithGoogleOAuth();
      onLoginSuccess(user, false);
      if (onClose) onClose();
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        setErrorMessage('A janela de autenticação Google foi cancelada.');
      } else if (err.code === 'auth/unauthorized-domain' || (err.message && err.message.includes('unauthorized-domain'))) {
        setErrorMessage(`Domínio não autorizado (${window.location.hostname}). Adicione o domínio no Firebase Console (Authentication > Settings > Authorized domains).`);
      } else {
        setErrorMessage(err.message || 'Erro no login com Google.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFacebookDirect = async () => {
    setErrorMessage('');
    setIsLoading(true);
    try {
      const user = await signInWithFacebook();
      onLoginSuccess(user, false);
      if (onClose) onClose();
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        setErrorMessage('A janela de autenticação do Facebook foi cancelada.');
      } else if (err.code === 'auth/unauthorized-domain' || (err.message && err.message.includes('unauthorized-domain'))) {
        setErrorMessage(`Domínio não autorizado (${window.location.hostname}). Adicione o domínio no Firebase Console (Authentication > Settings > Authorized domains).`);
      } else {
        setErrorMessage(err.message || 'Erro no login com Facebook.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const openSocialAuth = (provider: 'gmail' | 'facebook' | 'whatsapp') => {
    if (provider === 'gmail') {
      handleGoogleDirect();
      return;
    }
    setSocialProvider(provider);
    setSocialModalOpen(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <SocialAuthDialog
        isOpen={socialModalOpen}
        provider={socialProvider}
        onClose={() => setSocialModalOpen(false)}
        onSuccess={(u) => {
          onLoginSuccess(u, false);
          if (onClose) onClose();
        }}
      />

      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <HaspahoLogo size="md" variant="horizontal" />
            {canClose && onClose && (
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            )}
          </div>

          <div className="flex items-center border-b border-slate-200 pb-2 mb-4 gap-4">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMessage('');
              }}
              className={`text-sm font-bold pb-1 border-b-2 cursor-pointer ${
                mode === 'login'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMessage('');
              }}
              className={`text-sm font-bold pb-1 border-b-2 cursor-pointer ${
                mode === 'register'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              Cadastrar
            </button>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
              <span className="material-symbols-outlined text-[16px] shrink-0 text-red-600">error</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {mode === 'login' ? (
            <div className="space-y-4 relative z-10 pointer-events-auto">
              {/* Prominent Google Quick Login Button */}
              <button
                type="button"
                onClick={handleGoogleDirect}
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl border-2 border-slate-200 hover:border-blue-600 bg-white hover:bg-slate-50 text-slate-900 font-bold text-xs sm:text-sm flex items-center justify-center gap-3 shadow-xs transition-colors cursor-pointer relative z-20 pointer-events-auto opacity-100"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
                <span className="font-extrabold tracking-wide">ENTRAR COM GOOGLE</span>
              </button>

              {/* Prominent Facebook Quick Login Button */}
              <button
                type="button"
                onClick={handleFacebookDirect}
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl border-2 border-slate-200 hover:border-blue-600 bg-white hover:bg-slate-50 text-slate-900 font-bold text-xs sm:text-sm flex items-center justify-center gap-3 shadow-xs transition-colors cursor-pointer relative z-20 pointer-events-auto opacity-100"
              >
                <svg className="w-5 h-5 shrink-0" fill="#1877F2" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                <span className="font-extrabold tracking-wide">ENTRAR COM FACEBOOK</span>
              </button>

              <div className="relative flex items-center justify-center my-2">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-white px-3 text-[11px] text-slate-500 uppercase font-bold shrink-0">
                  ──────── ou entre com e-mail ────────
                </span>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4 relative z-10">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">E-mail</label>
                  <input
                    type="text"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="seu.email@exemplo.com"
                    className="w-full px-3.5 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 text-sm text-slate-900 bg-white placeholder:text-slate-400 outline-hidden font-medium relative z-10"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">Senha</label>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 pr-11 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 text-sm text-slate-900 bg-white placeholder:text-slate-400 outline-hidden font-medium relative z-10"
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

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs sm:text-sm tracking-wider flex items-center justify-center gap-2 shadow-md transition-colors disabled:opacity-50 cursor-pointer relative z-20 pointer-events-auto opacity-100"
                >
                  {isLoading ? 'VALIDANDO CREDENCIAIS...' : 'ENTRAR'}
                </button>

                {/* Master Developer Fast Login */}
                <button
                  type="button"
                  onClick={() => {
                    setLoginIdentifier('tiagodias8888@gmail.com');
                    setLoginPassword('haspaho2026');
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-50 to-blue-50 border border-blue-200 hover:border-blue-400 text-slate-800 text-[11px] font-bold flex items-center justify-between transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-amber-500 text-[16px] font-bold">crown</span>
                    <span>Preencher: Tiago Augusto Dias (Full Stack Dev)</span>
                  </div>
                  <span className="text-[9px] bg-blue-600 text-white font-mono font-black px-1.5 py-0.5 rounded">
                    ADMIN
                  </span>
                </button>

                {/* Password Recovery Help via WhatsApp/Email */}
                <div className="pt-2 text-center border-t border-slate-100">
                  <p className="text-[11px] text-slate-500">
                    Esqueceu sua senha ou precisa de suporte de acesso?
                  </p>
                  <a
                    href="https://wa.me/5514997339863?text=Ol%C3%A1%20Tiago%20Augusto%20Dias%2C%20preciso%20de%20ajuda%20para%20recuperar%20a%20senha%20do%20meu%20usu%C3%A1rio%20no%20Haspaho."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-800 font-bold inline-flex items-center gap-1 mt-0.5"
                  >
                    <span className="material-symbols-outlined text-[15px] text-emerald-600">chat</span>
                    <span>Solicitar Suporte ao Desenvolvedor (WhatsApp: 014 99733-9863)</span>
                  </a>
                </div>
              </form>
            </div>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nome Completo</label>
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Nome Completo"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-blue-500 text-xs text-slate-900 outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">E-mail</label>
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
                <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp</label>
                <input
                  type="tel"
                  value={regWhatsapp}
                  onChange={(e) => setRegWhatsapp(e.target.value)}
                  placeholder="(14) 99999-9999"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-blue-500 text-xs text-slate-900 outline-hidden"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Senha (mín. 6)</label>
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">Confirmar</label>
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

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? 'Cadastrando...' : 'Criar Nova Conta'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
