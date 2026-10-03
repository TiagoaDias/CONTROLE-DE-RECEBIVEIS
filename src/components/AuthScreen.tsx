import React, { useState } from 'react';
import { UserAccount } from '../types';
import { HaspahoLogo } from './HaspahoLogo';
import { SocialAuthDialog } from './SocialAuthDialog';
import {
  loginWithRealCredentials,
  registerRealUser,
  signInWithGoogleOAuth,
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

  // Login Form States
  const [loginIdentifier, setLoginIdentifier] = useState('tiagodias8888@gmail.com');
  const [loginPassword, setLoginPassword] = useState('haspaho2026');
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
      } else {
        setErrorMessage(err.message || 'Erro no login com Google.');
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
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">E-mail ou Usuário</label>
                <input
                  type="text"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder="seu.email@exemplo.com"
                  className="w-full px-3.5 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 text-sm text-slate-900 bg-white placeholder:text-slate-400 outline-hidden font-medium"
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
                    className="w-full px-3.5 pr-11 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 text-sm text-slate-900 bg-white placeholder:text-slate-400 outline-hidden font-medium"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
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
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? 'Autenticando...' : 'Acessar Conta'}
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

              <div className="grid grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => openSocialAuth('gmail')}
                  className="py-1.5 px-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-[11px] font-bold text-slate-700 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>Google</span>
                </button>
                <button
                  type="button"
                  onClick={() => openSocialAuth('facebook')}
                  className="py-1.5 px-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-[11px] font-bold text-slate-700 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>Facebook</span>
                </button>
                <button
                  type="button"
                  onClick={() => openSocialAuth('whatsapp')}
                  className="py-1.5 px-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-[11px] font-bold text-slate-700 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>WhatsApp</span>
                </button>
              </div>
            </form>
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
