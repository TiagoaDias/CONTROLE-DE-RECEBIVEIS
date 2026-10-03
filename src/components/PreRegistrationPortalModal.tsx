import React, { useState, useEffect } from 'react';

interface PreRegistrationPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitPreReg: (data: {
    name: string;
    cpf: string;
    email: string;
    phone: string;
    relation: string;
    pixKey: string;
    optionalMessage: string;
    purchaseProduct: string;
    purchaseInstallments: number;
    purchaseStore: string;
    purchaseDate: string;
    purchaseAmount: number;
    chosenAuthMethod?: string;
  }) => void;
}

export const PreRegistrationPortalModal: React.FC<PreRegistrationPortalModalProps> = ({
  isOpen,
  onClose,
  onSubmitPreReg,
}) => {
  // Read params from URL if present
  const [urlUser, setUrlUser] = useState('');
  const [urlMethod, setUrlMethod] = useState('gmail');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const userParam = params.get('user') || '';
      const methodParam = params.get('method') || 'gmail';
      if (userParam) {
        setUrlUser(userParam);
        setName(userParam.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
      }
      if (methodParam) {
        setUrlMethod(methodParam);
        setSelectedAuthMethod(methodParam as any);
      }
    }
  }, [isOpen]);

  const [selectedAuthMethod, setSelectedAuthMethod] = useState<'gmail' | 'facebook' | 'whatsapp' | 'password'>('gmail');
  const [verificationCode, setVerificationCode] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [userPassword, setUserPassword] = useState('');

  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [relation, setRelation] = useState('Família');
  const [pixKey, setPixKey] = useState('');
  const [optionalMessage, setOptionalMessage] = useState('');

  // Purchase Details
  const [purchaseProduct, setPurchaseProduct] = useState('');
  const [purchaseInstallments, setPurchaseInstallments] = useState(12);
  const [purchaseStore, setPurchaseStore] = useState('Mercado Livre');
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [purchaseAmount, setPurchaseAmount] = useState('1200.00');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authSuccess, setAuthSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSendVerificationCode = () => {
    if (!phone && !email) {
      setFormError('Informe seu telefone ou e-mail para receber o código de 6 dígitos.');
      return;
    }
    setFormError(null);
    setIsCodeSent(true);
    setVerificationCode('582914');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Por favor, informe seu nome completo para validação do cadastro.');
      return;
    }

    if (!phone.trim()) {
      setFormError('Informe seu Telefone / WhatsApp para contato e autenticação.');
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      setAuthSuccess(true);
      onSubmitPreReg({
        name: name.trim(),
        cpf: cpf || '321.456.789-00',
        email: email || `${(name || 'cliente').toLowerCase().replace(/\s+/g, '')}@gmail.com`,
        phone,
        relation,
        pixKey: pixKey || phone,
        optionalMessage,
        purchaseProduct: purchaseProduct.trim() || 'Smart TV / Compras Parceladas',
        purchaseInstallments: Number(purchaseInstallments) || 12,
        purchaseStore: purchaseStore.trim() || 'Mercado Livre / Loja',
        purchaseDate: purchaseDate || new Date().toISOString().split('T')[0],
        purchaseAmount: parseFloat(purchaseAmount) || 1200.0,
        chosenAuthMethod: selectedAuthMethod,
      });
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-[250] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-xl bg-gradient-to-b from-[#091834] via-[#0d2249] to-[#071328] rounded-3xl shadow-[0_20px_60px_rgba(6,182,212,0.4)] flex flex-col max-h-[calc(100vh-60px)] overflow-hidden border-2 border-cyan-400/80 my-auto text-white">
        {/* TOPO DO PORTAL COM IDENTIDADE VISUAL OFICIAL */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#061226]/95 shrink-0 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg border border-cyan-300/40 shrink-0">
              <span className="material-symbols-outlined text-white text-[22px]">verified_user</span>
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-white text-sm sm:text-base leading-tight truncate flex items-center gap-1.5">
                <span>Portal do Comprador • Primeiro Acesso</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              </h3>
              <p className="text-[11px] text-cyan-300 font-medium truncate">
                HASPAHO • Acesso Exclusivo e Protegido
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-red-500/20 hover:text-red-300 text-slate-300 flex items-center justify-center transition-colors cursor-pointer border border-white/10 shrink-0"
            title="Fechar Portal"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {authSuccess ? (
          <div className="p-6 sm:p-8 flex flex-col items-center justify-center gap-4 text-center overflow-y-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400 flex items-center justify-center shadow-lg animate-in zoom-in-95">
              <span className="material-symbols-outlined text-[36px]">check_circle</span>
            </div>
            <div className="space-y-1">
              <h4 className="text-lg font-black text-white">Primeiro Acesso Concluído com Sucesso!</h4>
              <p className="text-xs text-cyan-200/90 max-w-md mx-auto leading-relaxed">
                Suas informações foram validadas e criptografadas. Seu painel exclusivo de compras, parcelas e extratos já está liberado.
              </p>
            </div>

            <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl p-3.5 text-xs text-left space-y-1.5 font-mono">
              <div className="flex justify-between text-slate-300">
                <span>Comprador:</span>
                <b className="text-white">{name}</b>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Autenticação:</span>
                <b className="text-emerald-400 font-bold uppercase">{selectedAuthMethod}</b>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Status da Conta:</span>
                <b className="text-emerald-300 font-bold">ATIVA E ISOLADA ✓</b>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mt-2 px-8 h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs shadow-lg transition-all cursor-pointer active:scale-95 ring-1 ring-emerald-300"
            >
              Acessar Meu Painel Agora
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="overflow-y-auto p-4 sm:p-5 flex flex-col gap-4 flex-1 scrollbar-thin">
            {formError && (
              <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-xs text-red-200 font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-red-400 shrink-0">error</span>
                <span>{formError}</span>
              </div>
            )}

            {/* SELEÇÃO DO MÉTODO DE PRIMEIRO ACESSO */}
            <div className="space-y-2 bg-white/5 p-3.5 rounded-2xl border border-white/10">
              <label className="text-xs font-bold text-cyan-300 flex items-center gap-1.5 uppercase tracking-wider">
                <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
                <span>Como você prefere autenticar seu acesso?</span>
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {[
                  { id: 'gmail', label: 'Google / Gmail', icon: 'mail', desc: 'Recomendado' },
                  { id: 'facebook', label: 'Facebook', icon: 'public', desc: 'Rede Social' },
                  { id: 'whatsapp', label: 'Código WhatsApp', icon: 'chat', desc: 'SMS / Zap' },
                  { id: 'password', label: 'Criar Senha', icon: 'key', desc: 'Personalizada' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedAuthMethod(m.id as any)}
                    className={`p-2.5 rounded-xl text-left transition-all cursor-pointer border flex flex-col justify-between ${
                      selectedAuthMethod === m.id
                        ? 'bg-cyan-500 text-slate-950 font-black border-cyan-300 shadow-md ring-1 ring-cyan-200'
                        : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="material-symbols-outlined text-[18px]">{m.icon}</span>
                      {selectedAuthMethod === m.id && (
                        <span className="material-symbols-outlined text-[14px]">check</span>
                      )}
                    </div>
                    <span className="text-[11px] font-bold mt-1.5 block truncate">{m.label}</span>
                    <span className={`text-[9px] block ${selectedAuthMethod === m.id ? 'text-slate-800' : 'text-slate-400'}`}>
                      {m.desc}
                    </span>
                  </button>
                ))}
              </div>

              {/* BLOCO ESPECÍFICO CONFORME MÉTODO ESCOLHIDO */}
              {selectedAuthMethod === 'gmail' && (
                <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-cyan-400 text-[18px]">account_circle</span>
                    <span className="text-cyan-200 text-[11px]">
                      Conecte sua conta Google/Gmail para verificação instantânea.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!email) setEmail(`${(name || 'comprador').toLowerCase().replace(/\s+/g, '')}@gmail.com`);
                    }}
                    className="h-7 px-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-[10.5px] cursor-pointer"
                  >
                    Validar Gmail
                  </button>
                </div>
              )}

              {selectedAuthMethod === 'whatsapp' && (
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex flex-col gap-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-300 font-bold text-[11px]">Código de Verificação WhatsApp</span>
                    <button
                      type="button"
                      onClick={handleSendVerificationCode}
                      className="text-[10px] text-emerald-400 hover:underline font-bold cursor-pointer"
                    >
                      {isCodeSent ? 'Reenviar Código' : 'Enviar Código 6 Dígitos'}
                    </button>
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Digite o código (ex: 582914)"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    className="w-full h-9 px-3 bg-white/10 border border-emerald-400/40 rounded-xl text-center font-mono font-bold tracking-widest text-white outline-none"
                  />
                </div>
              )}

              {selectedAuthMethod === 'password' && (
                <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/30 flex flex-col gap-1.5 text-xs">
                  <label className="text-purple-300 font-bold text-[11px]">Defina sua Senha Pessoal de Acesso</label>
                  <input
                    type="password"
                    placeholder="Sua senha secreta..."
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    className="w-full h-9 px-3 bg-white/10 border border-purple-400/40 rounded-xl text-white font-mono outline-none"
                  />
                </div>
              )}
            </div>

            {/* CONFIRMAÇÃO DOS DADOS DO COMPRADOR */}
            <div className="space-y-3 bg-white/5 p-3.5 rounded-2xl border border-white/10">
              <label className="text-xs font-bold text-cyan-300 flex items-center gap-1.5 uppercase tracking-wider">
                <span className="material-symbols-outlined text-[16px]">person</span>
                <span>Seus Dados Cadastrais</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    placeholder="Seu nome completo"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-9 px-3 bg-white/10 border border-white/15 rounded-xl text-white outline-none focus:border-cyan-400"
                    required
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">CPF *</label>
                  <input
                    type="text"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    className="w-full h-9 px-3 bg-white/10 border border-white/15 rounded-xl text-white outline-none focus:border-cyan-400 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Telefone / WhatsApp *</label>
                  <input
                    type="text"
                    placeholder="(14) 99999-9999"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-9 px-3 bg-white/10 border border-white/15 rounded-xl text-white outline-none focus:border-cyan-400 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">E-mail</label>
                  <input
                    type="email"
                    placeholder="seu.email@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-9 px-3 bg-white/10 border border-white/15 rounded-xl text-white outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-amber-300 font-semibold block mb-1">Sua Chave PIX (Para estorno/troco)</label>
                  <input
                    type="text"
                    placeholder="Chave PIX (Celular, CPF, E-mail ou Aleatória)"
                    value={pixKey}
                    onChange={(e) => setPixKey(e.target.value)}
                    className="w-full h-9 px-3 bg-white/10 border border-amber-500/40 rounded-xl text-white outline-none focus:border-amber-400 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* DETALHES DA COMPRA / PARCELAMENTO */}
            <div className="space-y-2.5 bg-emerald-950/30 border border-emerald-500/30 p-3.5 rounded-2xl">
              <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5 uppercase tracking-wider">
                <span className="material-symbols-outlined text-[16px]">shopping_bag</span>
                <span>Objeto do Parcelamento / Compra</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="sm:col-span-2">
                  <label className="text-slate-300 font-semibold block mb-1">Item / Produto</label>
                  <input
                    type="text"
                    placeholder="ex: Smartphone Galaxy S24, Smart TV, Notebook..."
                    value={purchaseProduct}
                    onChange={(e) => setPurchaseProduct(e.target.value)}
                    className="w-full h-9 px-3 bg-white/10 border border-emerald-400/40 rounded-xl text-white outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Quantidade de Parcelas</label>
                  <select
                    value={purchaseInstallments}
                    onChange={(e) => setPurchaseInstallments(Number(e.target.value))}
                    className="w-full h-9 px-3 bg-[#061224] border border-emerald-400/40 rounded-xl text-white outline-none"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24].map((n) => (
                      <option key={n} value={n}>{n}x parcelas</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Valor Total Estimado (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={purchaseAmount}
                    onChange={(e) => setPurchaseAmount(e.target.value)}
                    className="w-full h-9 px-3 bg-white/10 border border-emerald-400/40 rounded-xl text-white outline-none font-mono font-bold"
                  />
                </div>
              </div>
            </div>

            {/* AVISO DE SEGURANÇA E ISOLAMENTO DE DADOS */}
            <div className="p-3 rounded-2xl bg-blue-950/40 border border-blue-400/30 text-[10.5px] text-blue-200 leading-relaxed flex items-start gap-2">
              <span className="material-symbols-outlined text-[16px] text-blue-400 shrink-0 mt-0.5">shield</span>
              <span>
                <strong>Privacidade &amp; Segurança Garantida:</strong> Toda criação e adição de informações é exclusiva da sua conta. Nenhum outro usuário tem permissão para editar seus dados ou o sistema.
              </span>
            </div>

            {/* BOTÃO DE CONFIRMAR CADASTRO */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-extrabold text-xs sm:text-sm shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 ring-1 ring-cyan-300"
            >
              {isSubmitting ? (
                <>
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Autenticando e Validando Conta...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  <span>Confirmar e Ativar Meu Primeiro Acesso</span>
                </>
              )}
            </button>

            {/* CRÉDITO OFICIAL E SUPORTE TIAGO AUGUSTO DIAS */}
            <div className="text-[9.5px] text-slate-400 text-center leading-tight py-2 border-t border-white/10 flex flex-col sm:flex-row items-center justify-center gap-1">
              <span>Engenharia &amp; Desenvolvimento: <strong>Tiago Augusto Dias (CPF: 368.497.448-01)</strong></span>
              <span className="hidden sm:inline">•</span>
              <span>WhatsApp: <strong>(14) 99733-9863</strong> | <strong>tiagodias8888@gmail.com</strong></span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
