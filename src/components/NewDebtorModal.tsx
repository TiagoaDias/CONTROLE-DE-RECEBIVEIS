import React, { useState } from 'react';
import { APP_IMAGES } from '../data/mockData';
import { PaymentMethodSelector } from './PaymentMethodSelector';

function isValidCpf(str: string): boolean {
  const clean = str.replace(/\D/g, '');
  if (clean.length !== 11 || /^(\d)\1{10}$/.test(clean)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(clean[i]) * (10 - i);
  let d1 = 11 - (sum % 11);
  if (d1 >= 10) d1 = 0;
  if (d1 !== parseInt(clean[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(clean[i]) * (11 - i);
  let d2 = 11 - (sum % 11);
  if (d2 >= 10) d2 = 0;
  if (d2 !== parseInt(clean[10])) return false;
  return true;
}

function generateValidCpf(): string {
  const rand = (n: number) => Math.floor(Math.random() * n);
  const n = Array.from({ length: 9 }, () => rand(10));
  let d1 = n.reduce((sum, digit, index) => sum + digit * (10 - index), 0);
  d1 = 11 - (d1 % 11);
  if (d1 >= 10) d1 = 0;
  n.push(d1);
  let d2 = n.reduce((sum, digit, index) => sum + digit * (11 - index), 0);
  d2 = 11 - (d2 % 11);
  if (d2 >= 10) d2 = 0;
  n.push(d2);
  const str = n.join('');
  return `${str.slice(0, 3)}.${str.slice(3, 6)}.${str.slice(6, 9)}-${str.slice(9)}`;
}

const VINCULO_OPTIONS = [
  'Amigo(a)',
  'Família',
  'Colega de Trabalho',
  'Vizinho(a)',
  'Prestador de Serviço',
  'Outro Vínculo Particular',
];

const CARD_OPTIONS = [
  'Nubank Croma',
  'Nubank Ultravioleta',
  'C6 Carbon Black',
  'Itaú Personalité Visa Infinite',
  'Bradesco Elo Nanquim',
  'Santander Unlimited',
  'Outro Cartão Particular',
];

interface NewDebtorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddDebtor: (debtor: {
    name: string;
    phone: string;
    relation: string;
    pixKey: string;
    email: string;
    avatar: string;
    documentNumber?: string;
    cpfCnpj?: string;
    myPixKey?: string;
    debtorPixKey?: string;
    optionalMessage?: string;
    username?: string;
    password?: string;
    authMethod?: 'local' | 'gmail' | 'facebook' | 'whatsapp';
    portalToken?: string;
    initialPurchase?: {
      product: string;
      store?: string;
      cardName?: string;
      totalAmount: number;
      installmentsTotal: number;
      firstDueDate: string;
    };
  }) => void;
  onToast?: (msg: string) => void;
}

export const NewDebtorModal: React.FC<NewDebtorModalProps> = ({
  isOpen,
  onClose,
  onAddDebtor,
  onToast,
}) => {
  const [activeStep, setActiveStep] = useState<'dados' | 'compra' | 'pix' | 'credenciais'>('dados');

  // Campos do Comprador
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [relation, setRelation] = useState('Amigo(a)');
  const [isCustomRelation, setIsCustomRelation] = useState(false);
  const [customRelationText, setCustomRelationText] = useState('');

  // Nova Compra Integrada no Novo Comprador
  const [enablePurchase, setEnablePurchase] = useState(true);
  const [product, setProduct] = useState('');
  const [store, setStore] = useState('');
  const [cardName, setCardName] = useState('Nubank Croma');
  const [totalAmount, setTotalAmount] = useState('');
  const [installmentsTotal, setInstallmentsTotal] = useState(10);
  const [firstDueDate, setFirstDueDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(10);
    return d.toISOString().split('T')[0];
  });

  // PIX do comprador
  const [debtorPixKey, setDebtorPixKey] = useState('');

  // Credenciais & Link
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('123456');
  const [authMethod, setAuthMethod] = useState<'local' | 'gmail' | 'facebook' | 'whatsapp'>('gmail');

  const [isPreRegistrationSent, setIsPreRegistrationSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  const finalUsername = username.trim() || name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const portalToken = `portal_${finalUsername || 'usr'}_${Date.now()}`;
  const exclusiveLoginUrl = `${window.location.origin}/?portal_comprador=true&user=${encodeURIComponent(finalUsername || 'comprador')}&token=${portalToken}&method=${authMethod}`;

  // Cálculo da parcela da compra em tempo real
  const parsedTotal = parseFloat(totalAmount.replace(',', '.')) || 0;
  const singleInstallmentValue = installmentsTotal > 0 ? parsedTotal / installmentsTotal : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!name.trim()) {
      setFormError('Por favor, informe o nome completo da pessoa / comprador.');
      setActiveStep('dados');
      return;
    }

    const validDocumentNumber = isValidCpf(cpf) ? cpf : generateValidCpf();
    const finalRelation = isCustomRelation ? customRelationText.trim() || 'Outro' : relation;

    // Compra inicial se preenchida
    let initialPurchaseData: {
      product: string;
      store?: string;
      cardName?: string;
      totalAmount: number;
      installmentsTotal: number;
      firstDueDate: string;
    } | undefined = undefined;

    if (enablePurchase && product.trim() && parsedTotal > 0) {
      initialPurchaseData = {
        product: product.trim(),
        store: store.trim() || 'Loja Parceira',
        cardName: cardName || 'Nubank Croma',
        totalAmount: parsedTotal,
        installmentsTotal: Number(installmentsTotal) || 1,
        firstDueDate: firstDueDate || new Date().toISOString().split('T')[0],
      };
    }

    onAddDebtor({
      name: name.trim(),
      phone: phone || '(11) 99999-9999',
      relation: finalRelation,
      pixKey: debtorPixKey || phone || email || 'pix@banco.com.br',
      email: email || `${finalUsername}@gmail.com`,
      avatar: APP_IMAGES.carlos,
      documentNumber: validDocumentNumber,
      cpfCnpj: validDocumentNumber,
      debtorPixKey,
      username: finalUsername,
      password: password || '123456',
      authMethod,
      portalToken,
      initialPurchase: initialPurchaseData,
    });

    if (onToast) {
      if (initialPurchaseData) {
        onToast(`✨ Comprador "${name}" e compra "${initialPurchaseData.product}" cadastrados juntos com sucesso!`);
      } else {
        onToast(`✨ Comprador "${name}" cadastrado com sucesso!`);
      }
    }
    onClose();
  };

  const handleCopyExclusiveLink = () => {
    navigator.clipboard.writeText(exclusiveLoginUrl);
    if (onToast) {
      onToast('🔗 Link exclusivo de primeiro acesso copiado com sucesso!');
    }
  };

  const handleSendCredentialsWhatsApp = () => {
    setFormError(null);
    if (!name.trim()) {
      setFormError('Preencha o Nome da pessoa antes de enviar as credenciais.');
      setActiveStep('dados');
      return;
    }
    if (!phone.trim()) {
      setFormError('Informe o Telefone / WhatsApp para enviar o login.');
      setActiveStep('dados');
      return;
    }

    setIsPreRegistrationSent(true);

    const authDesc =
      authMethod === 'gmail'
        ? 'Autenticação rápida e segura via Google / Gmail'
        : authMethod === 'facebook'
        ? 'Autenticação via Facebook'
        : authMethod === 'whatsapp'
        ? 'Código de confirmação no WhatsApp'
        : 'Senha padrão de acesso';

    const message =
      `Olá *${name}*! 👋\n\n` +
      `Aqui está o seu link exclusivo para *Primeiro Acesso* ao HASPAHO Cobranças & Recebíveis para acompanhar suas compras e parcelas:\n\n` +
      `🔗 *Link de Acesso:* ${exclusiveLoginUrl}\n` +
      `👤 *Usuário:* \`${finalUsername}\`\n` +
      `🔑 *Senha Inicial:* \`${password}\`\n` +
      `🛡️ *Método:* ${authDesc}\n\n` +
      `_Acesso individual, seguro e confidencial._\n\n` +
      `Desenvolvedor Full Stack: Tiago Augusto Dias (14) 99733-9863`;

    const cleanPhone = phone.replace(/\D/g, '');
    const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');

    if (onToast) {
      onToast(`🚀 Link enviado no WhatsApp de ${name}!`);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-gradient-to-b from-[#0b1b36] via-[#0e2447] to-[#081326] rounded-2xl sm:rounded-3xl shadow-[0_20px_60px_rgba(6,182,212,0.35)] flex flex-col max-h-[94vh] sm:max-h-[92vh] overflow-hidden border-2 border-cyan-400/80 my-auto text-white">
        
        {/* 1. CABEÇALHO DO MODAL */}
        <div className="flex items-center justify-between px-3.5 py-2.5 sm:px-4 sm:py-3 border-b border-white/10 bg-[#09152b]/95 shrink-0 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-7 sm:h-8 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-bold flex items-center gap-1 transition-all cursor-pointer border border-white/10"
            title="Voltar"
          >
            <span className="material-symbols-outlined text-[15px]">arrow_back</span>
            <span className="hidden sm:inline">Voltar</span>
          </button>

          <div className="text-center min-w-0 px-2 flex-1">
            <h3 className="font-black text-white text-xs sm:text-sm md:text-base leading-tight truncate">
              Cadastrar Novo Comprador
            </h3>
            <span className="text-[10px] sm:text-[10.5px] text-cyan-300 font-medium block truncate">
              Preencha os dados e registre a compra tudo aqui dentro
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white/10 hover:bg-red-500/20 hover:text-red-300 text-slate-300 flex items-center justify-center transition-colors cursor-pointer border border-white/10 shrink-0"
            title="Fechar (X)"
          >
            <span className="material-symbols-outlined text-[17px]">close</span>
          </button>
        </div>

        {/* 2. ABAS DE NAVEGAÇÃO DE ETAPAS (DADOS, COMPRA, PIX, LOGIN) */}
        <div className="flex items-center gap-1 px-2.5 py-1.5 bg-[#061224] border-b border-white/10 shrink-0 text-xs font-bold overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveStep('dados')}
            className={`flex-1 min-w-[85px] py-1.5 px-2 rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer text-[10.5px] ${
              activeStep === 'dados'
                ? 'bg-cyan-500 text-slate-950 font-black shadow-md ring-1 ring-cyan-300'
                : 'bg-white/5 text-slate-300 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[13px]">person</span>
            <span>1. Dados</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveStep('compra')}
            className={`flex-1 min-w-[95px] py-1.5 px-2 rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer text-[10.5px] ${
              activeStep === 'compra'
                ? 'bg-cyan-500 text-slate-950 font-black shadow-md ring-1 ring-cyan-300'
                : 'bg-white/5 text-slate-300 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[13px]">shopping_cart</span>
            <span>2. Compra</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveStep('pix')}
            className={`flex-1 min-w-[75px] py-1.5 px-2 rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer text-[10.5px] ${
              activeStep === 'pix'
                ? 'bg-cyan-500 text-slate-950 font-black shadow-md ring-1 ring-cyan-300'
                : 'bg-white/5 text-slate-300 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[13px]">pix</span>
            <span>3. Pix</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveStep('credenciais')}
            className={`flex-1 min-w-[95px] py-1.5 px-2 rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer text-[10.5px] ${
              activeStep === 'credenciais'
                ? 'bg-cyan-500 text-slate-950 font-black shadow-md ring-1 ring-cyan-300'
                : 'bg-white/5 text-slate-300 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[13px]">key</span>
            <span>4. Login</span>
          </button>
        </div>

        {/* 3. CORPO DO FORMULÁRIO */}
        <form onSubmit={handleSubmit} className="overflow-y-auto px-3.5 py-3 sm:px-5 sm:py-4 flex flex-col gap-3 flex-1 scrollbar-thin">
          {formError && (
            <div className="p-2.5 bg-red-500/20 border border-red-500/40 rounded-xl text-xs text-red-200 font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-red-400 shrink-0">error</span>
              <span>{formError}</span>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 1: INFORMAÇÕES PESSOAIS DO COMPRADOR                                */}
          {/* ========================================================================= */}
          {activeStep === 'dados' && (
            <div className="space-y-2.5 animate-in fade-in duration-150">
              <div className="flex items-center gap-1.5 pb-1 border-b border-white/10 text-[11px] font-bold text-cyan-300 uppercase tracking-wider">
                <span className="material-symbols-outlined text-[15px]">badge</span>
                <span>1. Informações Pessoais do Comprador</span>
              </div>

              {/* Nome Completo */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-200 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-cyan-400">person</span>
                  <span>Nome Completo *</span>
                </label>
                <input
                  type="text"
                  placeholder="Nome completo do comprador"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!username) {
                      setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''));
                    }
                  }}
                  className="w-full h-9 px-3 bg-white/10 border border-cyan-500/40 rounded-xl text-xs font-medium text-white placeholder-slate-400 focus:bg-white/15 focus:border-cyan-400 outline-none transition-all"
                />
              </div>

              {/* Vínculo */}
              <div className="flex flex-col gap-1 bg-white/5 p-2.5 rounded-xl border border-white/10">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-cyan-300 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px] text-cyan-400">handshake</span>
                    <span>Vínculo</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCustomRelation(!isCustomRelation)}
                    className="text-[10px] text-cyan-300 hover:text-white font-bold underline cursor-pointer"
                  >
                    {isCustomRelation ? 'Usar Lista' : 'Outro Vínculo'}
                  </button>
                </div>

                {isCustomRelation ? (
                  <input
                    type="text"
                    value={customRelationText}
                    onChange={(e) => setCustomRelationText(e.target.value)}
                    placeholder="Especifique o vínculo (ex: Vizinho, Colega de Trabalho...)"
                    className="w-full h-8 px-2.5 bg-white/10 border border-cyan-400 rounded-xl text-xs font-medium text-white placeholder-slate-400 outline-none"
                    autoFocus
                  />
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                    {VINCULO_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setRelation(opt)}
                        className={`h-7 px-2 rounded-lg text-[10.5px] font-semibold flex items-center justify-between transition-all cursor-pointer border ${
                          relation === opt
                            ? 'bg-cyan-500 text-slate-950 font-black border-cyan-300 shadow-xs'
                            : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <span className="truncate">{opt}</span>
                        {relation === opt && (
                          <span className="material-symbols-outlined text-[12px]">check</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* CPF e Telefone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-200 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px] text-cyan-400">badge</span>
                    <span>CPF</span>
                  </label>
                  <input
                    type="text"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    className="w-full h-9 px-3 bg-white/10 border border-cyan-500/40 rounded-xl text-xs font-mono font-medium text-white placeholder-slate-400 focus:bg-white/15 focus:border-cyan-400 outline-none transition-all"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-200 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px] text-emerald-400">phone</span>
                    <span>Telefone / WhatsApp</span>
                  </label>
                  <input
                    type="text"
                    placeholder="(14) 99999-9999"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-9 px-3 bg-white/10 border border-cyan-500/40 rounded-xl text-xs font-mono font-medium text-white placeholder-slate-400 focus:bg-white/15 focus:border-cyan-400 outline-none transition-all"
                  />
                </div>
              </div>

              {/* E-mail */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-200 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px] text-cyan-400">mail</span>
                  <span>E-mail</span>
                </label>
                <input
                  type="email"
                  placeholder="comprador@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-9 px-3 bg-white/10 border border-cyan-500/40 rounded-xl text-xs font-medium text-white placeholder-slate-400 focus:bg-white/15 focus:border-cyan-400 outline-none transition-all"
                />
              </div>

              {/* Botões de Avançar da Etapa 1 */}
              <div className="flex flex-col sm:flex-row items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setFormError(null);
                    setActiveStep('compra');
                  }}
                  className="w-full sm:flex-1 h-9.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
                >
                  <span className="material-symbols-outlined text-[15px]">add_shopping_cart</span>
                  <span>Avançar para Nova Compra</span>
                  <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFormError(null);
                    setActiveStep('pix');
                  }}
                  className="w-full sm:w-auto px-3.5 h-9.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 active:scale-[0.98] font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">pix</span>
                  <span>Avançar para Pix</span>
                  <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 2: NOVA COMPRA INTEGRADA NO NOVO COMPRADOR                          */}
          {/* ========================================================================= */}
          {activeStep === 'compra' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between pb-1 border-b border-white/10 text-[11px] font-bold text-cyan-300 uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px]">add_shopping_cart</span>
                  <span>2. Registrar Compra para este Comprador</span>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer normal-case text-xs text-white">
                  <input
                    type="checkbox"
                    checked={enablePurchase}
                    onChange={(e) => setEnablePurchase(e.target.checked)}
                    className="accent-cyan-400 rounded w-4 h-4 cursor-pointer"
                  />
                  <span>Lançar compra agora</span>
                </label>
              </div>

              {enablePurchase ? (
                <div className="space-y-2.5 bg-white/5 p-3 rounded-2xl border border-cyan-500/30">
                  {/* Produto / Item */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-slate-200 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px] text-cyan-400">inventory_2</span>
                      <span>Produto / Item Comprado *</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Armário de Cozinha, Smartphone, Smart TV..."
                      value={product}
                      onChange={(e) => setProduct(e.target.value)}
                      className="w-full h-9 px-3 bg-white/10 border border-cyan-500/40 rounded-xl text-xs font-medium text-white placeholder-slate-400 focus:border-cyan-400 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* Loja */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-slate-200 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px] text-amber-400">store</span>
                        <span>Loja / Estabelecimento</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Magazine Luiza, Mercado Livre..."
                        value={store}
                        onChange={(e) => setStore(e.target.value)}
                        className="w-full h-9 px-3 bg-white/10 border border-cyan-500/40 rounded-xl text-xs font-medium text-white placeholder-slate-400 outline-none"
                      />
                    </div>

                    {/* Meio de Pagamento Utilizado */}
                    <div className="flex flex-col gap-1">
                      <PaymentMethodSelector
                        value={cardName}
                        onChange={setCardName}
                        label="Meio de pagamento utilizado"
                        theme="dark"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* Valor Total */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-emerald-300 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px]">payments</span>
                        <span>Valor Total (R$) *</span>
                      </label>
                      <input
                        type="text"
                        placeholder="0,00"
                        value={totalAmount}
                        onChange={(e) => setTotalAmount(e.target.value)}
                        className="w-full h-9 px-3 bg-white/10 border border-emerald-500/50 rounded-xl text-xs font-mono font-bold text-white placeholder-slate-400 outline-none"
                      />
                    </div>

                    {/* Número de Parcelas */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-slate-200 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px] text-cyan-400">calendar_view_day</span>
                        <span>Nº de Parcelas</span>
                      </label>
                      <select
                        value={installmentsTotal}
                        onChange={(e) => setInstallmentsTotal(parseInt(e.target.value, 10))}
                        className="w-full h-9 px-2 bg-slate-800 border border-cyan-500/40 rounded-xl text-xs font-mono text-white outline-none"
                      >
                        {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>
                            {n}x {parsedTotal > 0 ? `(R$ ${(parsedTotal / n).toFixed(2).replace('.', ',')})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Vencimento 1ª Parcela */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-slate-200 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px] text-cyan-400">event</span>
                        <span>1º Vencimento</span>
                      </label>
                      <input
                        type="date"
                        value={firstDueDate}
                        onChange={(e) => setFirstDueDate(e.target.value)}
                        className="w-full h-9 px-2 bg-slate-800 border border-cyan-500/40 rounded-xl text-xs font-mono text-white outline-none"
                      />
                    </div>
                  </div>

                  {/* Resumo da Parcela Calculada */}
                  {parsedTotal > 0 && (
                    <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between text-xs">
                      <span className="text-slate-300">Resumo do Plano:</span>
                      <span className="font-mono font-black text-emerald-300">
                        {installmentsTotal}x de R$ {singleInstallmentValue.toFixed(2).replace('.', ',')} (Total: R$ {parsedTotal.toFixed(2).replace('.', ',')})
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-6 text-center bg-white/5 border border-white/10 rounded-2xl">
                  <p className="text-xs text-slate-400">
                    Você optou por cadastrar somente os dados da pessoa agora. A compra poderá ser adicionada posteriormente.
                  </p>
                </div>
              )}

              {/* Botões de Navegação */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setActiveStep('dados')}
                  className="flex-1 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">arrow_back</span>
                  <span>Voltar para Dados</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveStep('pix')}
                  className="flex-1 h-9 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
                >
                  <span>Avançar para Pix</span>
                  <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 3: DADOS DO PIX DO COMPRADOR                                        */}
          {/* ========================================================================= */}
          {activeStep === 'pix' && (
            <div className="space-y-2.5 animate-in fade-in duration-150">
              <div className="flex items-center gap-1.5 pb-1 border-b border-white/10 text-[11px] font-bold text-cyan-300 uppercase tracking-wider">
                <span className="material-symbols-outlined text-[15px]">account_balance_wallet</span>
                <span>3. Dados Financeiros &amp; Chave PIX</span>
              </div>

              <div className="flex flex-col gap-1.5 bg-white/5 p-3 rounded-2xl border border-white/10">
                <label className="text-xs font-bold text-amber-300 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px]">pix</span>
                  <span>Chave Pix do Comprador</span>
                </label>
                <input
                  type="text"
                  placeholder="CPF, Celular, E-mail ou Chave Aleatória"
                  value={debtorPixKey}
                  onChange={(e) => setDebtorPixKey(e.target.value)}
                  className="w-full h-9 px-3 bg-white/10 border border-amber-500/40 rounded-xl text-xs font-medium text-white placeholder-slate-400 focus:border-amber-400 outline-none transition-all font-mono"
                />
                <p className="text-[10px] text-slate-300 leading-tight">
                  Chave utilizada para conferência e devoluções automáticas de excedente.
                </p>
              </div>

              {/* Botões de Navegação */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setActiveStep('compra')}
                  className="flex-1 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">arrow_back</span>
                  <span>Voltar para Compra</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveStep('credenciais')}
                  className="flex-1 h-9 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
                >
                  <span>Avançar para Login</span>
                  <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 4: CREDENCIAIS DE ACESSO & LINK EXCLUSIVO                           */}
          {/* ========================================================================= */}
          {activeStep === 'credenciais' && (
            <div className="space-y-2.5 animate-in fade-in duration-150">
              <div className="flex items-center gap-1.5 pb-1 border-b border-white/10 text-[11px] font-bold text-purple-300 uppercase tracking-wider">
                <span className="material-symbols-outlined text-[15px]">key</span>
                <span>4. Credenciais de Acesso &amp; Link Exclusivo</span>
              </div>

              <div className="bg-purple-900/25 border border-purple-500/40 p-3 rounded-2xl flex flex-col gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0 border border-purple-400/30">
                    <span className="material-symbols-outlined text-[15px]">lock</span>
                  </span>
                  <div>
                    <h4 className="text-[11px] font-bold text-purple-200">Acesso Individual do Comprador</h4>
                    <p className="text-[9.5px] text-purple-300/80 leading-none">Acesso exclusivo para conferir extratos e dados.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Username */}
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[10.5px] font-semibold text-slate-300">Login / Nome de Usuário</label>
                    <input
                      type="text"
                      placeholder="ex: beatriz_lima"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full h-8 px-2.5 bg-white/10 border border-purple-400/40 rounded-xl text-xs font-medium text-white placeholder-slate-400 focus:border-purple-400 outline-none font-mono"
                    />
                  </div>

                  {/* Senha */}
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[10.5px] font-semibold text-slate-300">Senha Provisória</label>
                    <input
                      type="text"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-8 px-2.5 bg-white/10 border border-purple-400/40 rounded-xl text-xs font-medium text-white placeholder-slate-400 focus:border-purple-400 outline-none font-mono"
                    />
                  </div>
                </div>

                {/* Métodos de Login */}
                <div className="flex flex-col gap-1 pt-0.5">
                  <label className="text-[10.5px] font-semibold text-slate-300">Método de Login Preferencial</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                    {[
                      { id: 'gmail', label: 'Google / Gmail', icon: 'mail' },
                      { id: 'whatsapp', label: 'WhatsApp', icon: 'chat' },
                      { id: 'facebook', label: 'Facebook', icon: 'public' },
                      { id: 'local', label: 'Senha Padrão', icon: 'key' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setAuthMethod(m.id as any)}
                        className={`h-7 px-1.5 rounded-lg text-[10px] font-semibold flex items-center justify-between transition-all cursor-pointer border ${
                          authMethod === m.id
                            ? 'bg-purple-600 text-white font-black border-purple-300 shadow-2xs ring-1 ring-purple-300'
                            : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <span className="flex items-center gap-1 truncate">
                          <span className="material-symbols-outlined text-[13px]">{m.icon}</span>
                          <span className="truncate">{m.label}</span>
                        </span>
                        {authMethod === m.id && (
                          <span className="material-symbols-outlined text-[11px]">check</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card de Envio do Link */}
              <div className="bg-emerald-950/40 border border-emerald-500/40 p-2.5 sm:p-3 rounded-2xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">share</span>
                    <span>Link Exclusivo de Login Pronto</span>
                  </span>
                  {isPreRegistrationSent && (
                    <span className="text-[9px] bg-emerald-500 text-slate-950 px-1.5 py-0.2 rounded-full font-black">
                      Enviado ✓
                    </span>
                  )}
                </div>

                <p className="text-[10px] text-emerald-200/80 leading-tight">
                  Envie o link pronto para o comprador no WhatsApp ou copie para a área de transferência:
                </p>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={handleSendCredentialsWhatsApp}
                    className="h-8.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1 transition-all shadow-sm cursor-pointer active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[15px]">send</span>
                    <span>Enviar WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyExclusiveLink}
                    className="h-8.5 rounded-xl bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 hover:text-white border border-cyan-400/40 font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[15px]">content_copy</span>
                    <span>Copiar Link</span>
                  </button>
                </div>

                {/* Botão para voltar à Etapa 3 */}
                <div className="pt-0.5">
                  <button
                    type="button"
                    onClick={() => setActiveStep('pix')}
                    className="w-full h-8 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">arrow_back</span>
                    <span>Voltar para Pix do Comprador</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 4. AVISO DE ISOLAMENTO DE DADOS & SEGURANÇA */}
          <div className="p-2 rounded-xl bg-blue-950/30 border border-blue-500/20 text-[9.5px] text-blue-200/90 leading-tight flex items-start gap-1.5 shrink-0">
            <span className="material-symbols-outlined text-[14px] text-blue-400 shrink-0 mt-0.5">shield</span>
            <span>
              <strong>Segurança:</strong> Toda informação é isolada e exclusiva do usuário. Sem permissão de edição para terceiros.
            </span>
          </div>

          {/* 5. RODAPÉ DO FORMULÁRIO COM BOTÕES E CRÉDITO COMPACTO */}
          <div className="flex flex-col gap-1.5 pt-2 border-t border-white/10 mt-auto shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="w-1/3 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-[15px]">arrow_back</span>
                <span>Cancelar</span>
              </button>

              <button
                type="submit"
                className="flex-1 h-9 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer active:scale-95 ring-1 ring-cyan-400/50"
              >
                <span className="material-symbols-outlined text-[16px]">check</span>
                <span>Salvar Comprador {enablePurchase && product ? '& Compra' : ''}</span>
              </button>
            </div>

            {/* Crédito Oficial de Engenharia */}
            <div className="text-[9px] text-slate-400 text-center leading-tight pt-1 flex items-center justify-center gap-1 flex-wrap">
              <span>Dev: <strong>Tiago Augusto Dias (CPF: 368.497.448-01)</strong></span>
              <span>•</span>
              <span>Suporte: <strong>(14) 99733-9863</strong> | <strong>tiagodias8888@gmail.com</strong></span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
