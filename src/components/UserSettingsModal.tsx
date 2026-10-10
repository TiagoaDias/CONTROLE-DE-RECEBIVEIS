import React, { useState, useRef, useEffect } from 'react';
import { UserAccount, Debtor } from '../types';
import { HaspahoLogo } from './HaspahoLogo';
import { WhatsAppIcon } from './WhatsAppIcon';
import { systemHealthSentinel, SystemHealthReport } from '../utils/systemHealthSentinel';
import { capturePanelScreenshot } from '../utils/screenshotHelper';
import { ImageCropperModal } from './ImageCropperModal';

interface UserSettingsModalProps {
  isOpen: boolean;
  currentUser: UserAccount | null;
  onClose: () => void;
  onSaveUser: (updatedUser: UserAccount) => void;
  onLogout: () => void;
  onToast: (msg: string) => void;
  deletedDebtors?: Debtor[];
  onRestoreDebtor?: (debtorId: string) => void;
  onPermanentDeleteDebtor?: (debtorId: string) => void;
  initialTab?: 'profile' | 'address' | 'pix' | 'security' | 'suporte' | 'lixeira';
}

export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  onSaveUser,
  onLogout,
  onToast,
  deletedDebtors = [],
  onRestoreDebtor,
  onPermanentDeleteDebtor,
  initialTab = 'profile',
}) => {
  if (!isOpen || !currentUser) return null;

  // Local form state
  const [name, setName] = useState(currentUser.name || 'Tiago Dias');
  const [email, setEmail] = useState(currentUser.email || 'tiagodias8888@gmail.com');
  const [phone, setPhone] = useState(currentUser.phoneWhatsapp || '(14) 99733-9863');
  const [avatar, setAvatar] = useState(
    currentUser.avatar ||
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80'
  );
  const [pixKey, setPixKey] = useState(currentUser.pixKey || '(14) 99733-9863');
  const [cep, setCep] = useState(currentUser.cep || '17320-000');
  const [address, setAddress] = useState(currentUser.address || 'Rua Principal');
  const [addressNumber, setAddressNumber] = useState(currentUser.addressNumber || '100');
  const [neighborhood, setNeighborhood] = useState(currentUser.neighborhood || 'Centro');
  const [city, setCity] = useState(currentUser.city || 'Mineiros do Tietê');
  const [state, setState] = useState(currentUser.state || 'SP');
  const [cpfCnpj, setCpfCnpj] = useState(currentUser.cpfCnpj || '123.456.789-00');
  const [companyName, setCompanyName] = useState(
    currentUser.companyName || 'HASPAHO Tecnologia da Informação'
  );
  const [role, setRole] = useState(currentUser.role || 'Desenvolvedor Full Stack');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [activeTab, setActiveTab] = useState<'profile' | 'address' | 'pix' | 'security' | 'suporte' | 'lixeira'>(
    initialTab || 'profile'
  );

  const [diagnosticReport, setDiagnosticReport] = useState<SystemHealthReport | null>(null);
  const [isRunningDiagnostic, setIsRunningDiagnostic] = useState(false);
  const [isCapturingSupportPrint, setIsCapturingSupportPrint] = useState(false);

  // Sincroniza o formulário sempre que o modal abre ou o usuário ativo muda
  useEffect(() => {
    if (currentUser && isOpen) {
      setName(currentUser.name || 'Tiago Dias');
      setEmail(currentUser.email || 'tiagodias8888@gmail.com');
      setPhone(currentUser.phoneWhatsapp || '(14) 99733-9863');
      setAvatar(currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80');
      setPixKey(currentUser.pixKey || '(14) 99733-9863');
      setCep(currentUser.cep || '17320-000');
      setAddress(currentUser.address || 'Rua Principal');
      setAddressNumber(currentUser.addressNumber || '100');
      setNeighborhood(currentUser.neighborhood || 'Centro');
      setCity(currentUser.city || 'Mineiros do Tietê');
      setState(currentUser.state || 'SP');
      setCpfCnpj(currentUser.cpfCnpj || '123.456.789-00');
      setCompanyName(currentUser.companyName || 'HASPAHO Tecnologia da Informação');
      setRole(currentUser.role || 'Desenvolvedor Full Stack');
      setNewPassword('');
      setConfirmPassword('');
      if (initialTab) setActiveTab(initialTab);
    }
  }, [currentUser, isOpen, initialTab]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Avatar presets
  const AVATAR_PRESETS = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&auto=format&fit=crop&q=80',
  ];

  // Upload local image from computer with crop support
  const [rawUploadImage, setRawUploadImage] = useState<string | null>(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropZoom, setCropZoom] = useState(1);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 8 * 1024 * 1024) {
        onToast('A imagem deve ter no máximo 8MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setRawUploadImage(reader.result);
          setCropZoom(1);
          setCropModalOpen(true);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleApplyCrop = () => {
    if (!rawUploadImage) return;
    const img = new Image();
    img.src = rawUploadImage;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 300;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.translate(size / 2, size / 2);
      ctx.scale(cropZoom, cropZoom);
      ctx.translate(-size / 2, -size / 2);

      const scale = Math.max(size / img.width, size / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (size - w) / 2;
      const y = (size - h) / 2;

      ctx.drawImage(img, x, y, w, h);
      ctx.restore();

      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setAvatar(croppedDataUrl);
      setCropModalOpen(false);
      setRawUploadImage(null);
      onToast('Foto recortada e aplicada com sucesso!');
    };
  };

  // Format CEP (XXXXX-XXX)
  const handleCepChange = (val: string) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 8);
    if (cleaned.length <= 5) {
      setCep(cleaned);
    } else {
      setCep(`${cleaned.slice(0, 5)}-${cleaned.slice(5)}`);
    }

    // Auto-fill common CEP example for Mineiros do Tietê / SP
    if (cleaned === '17320000' || cleaned.length === 8) {
      if (!city) setCity('Mineiros do Tietê');
      if (!state) setState('SP');
    }
  };

  // Save changes
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      onToast('Por favor, informe seu nome.');
      return;
    }

    if (newPassword) {
      if (newPassword.length < 4) {
        onToast('A nova senha deve ter pelo menos 4 caracteres.');
        return;
      }
      if (newPassword !== confirmPassword) {
        onToast('As senhas digitadas não coincidem.');
        return;
      }
    }

    const updatedUser: UserAccount = {
      ...currentUser,
      name: name.trim(),
      email: email.trim(),
      phoneWhatsapp: phone.trim(),
      avatar: avatar.trim(),
      pixKey: pixKey.trim(),
      cep: cep.trim(),
      address: address.trim(),
      addressNumber: addressNumber.trim(),
      neighborhood: neighborhood.trim(),
      city: city.trim(),
      state: state.trim(),
      cpfCnpj: cpfCnpj.trim(),
      companyName: companyName.trim(),
      role: role.trim(),
      password: newPassword ? newPassword : currentUser.password,
      lastKnownPassword: newPassword ? newPassword : currentUser.lastKnownPassword,
    };

    onSaveUser(updatedUser);
    onToast(`Dados do perfil de ${updatedUser.name} atualizados com sucesso!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94dvh] sm:max-h-[90vh] my-auto animate-in zoom-in-95 duration-200">
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-[#07243e] via-[#0d3b66] to-[#041a2f] p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-2xl shadow-md shrink-0 flex items-center justify-center p-1.5">
              <HaspahoLogo size="sm" variant="icon" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sm sm:text-base text-white leading-tight">
                  Configurações do Usuário & Perfil
                </h2>
                <span className="text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 rounded-full">
                  Exclusivo
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300 line-clamp-1 mt-0.5">
                Gerencie seus dados pessoais, foto, chave PIX, endereço e suporte técnico direto.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Fechar"
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Tab Navigation (Nunca corta nenhum texto) */}
        <div className="flex flex-nowrap items-center border-b border-slate-200 bg-slate-50 px-2 sm:px-6 gap-1 sm:gap-2 overflow-x-auto no-scrollbar shrink-0">
          {[
            { id: 'profile', label: 'Dados Pessoais & Foto', shortLabel: 'Perfil & Foto', icon: 'person' },
            { id: 'pix', label: 'Chave PIX de Recebimento', shortLabel: 'Chave PIX', icon: 'qr_code_2' },
            { id: 'address', label: 'Endereço & CEP', shortLabel: 'Endereço & CEP', icon: 'home_pin' },
            { id: 'security', label: 'Segurança & Senha', shortLabel: 'Segurança', icon: 'shield_lock' },
            { id: 'suporte', label: 'Sentinela & Suporte Full Stack', shortLabel: 'Suporte (Zap)', icon: 'health_and_safety', highlight: true },
            { id: 'lixeira', label: `🗑️ Lixeira (${deletedDebtors.length})`, shortLabel: `🗑️ Lixeira (${deletedDebtors.length})`, icon: 'delete_sweep' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 py-3 px-3 sm:px-3.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-700 bg-white shadow-xs rounded-t-xl font-black'
                  : tab.highlight
                  ? 'border-transparent text-emerald-700 hover:text-emerald-900 bg-emerald-50/50 hover:bg-emerald-50 rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className={`material-symbols-outlined text-[17px] ${tab.highlight && activeTab !== tab.id ? 'text-emerald-600' : ''}`}>{tab.icon}</span>
              <span className="hidden md:inline">{tab.label}</span>
              <span className="md:hidden">{tab.shortLabel}</span>
            </button>
          ))}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5">
          {/* TAB 1: PROFILE & PHOTO */}
          {activeTab === 'profile' && (
            <div className="space-y-5">
              {/* Photo section */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-5">
                <div className="relative group shrink-0">
                  <img
                    src={avatar}
                    alt={name}
                    className="w-24 h-24 rounded-full object-cover shadow-md ring-4 ring-blue-100 border border-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity cursor-pointer"
                    title="Carregar foto do computador"
                  >
                    <span className="material-symbols-outlined text-[24px]">photo_camera</span>
                    <span className="text-[10px] font-bold">Alterar</span>
                  </button>
                  <span className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-2 ring-white text-[12px]">
                    <span className="material-symbols-outlined text-[14px]">check</span>
                  </span>
                </div>

                <div className="flex-1 space-y-2 text-center sm:text-left">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Foto do Seu Perfil</h3>
                    <p className="text-xs text-slate-500">
                      Esta foto aparece nas barras do sistema, cabeçalho e contratos de cobrança.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-9 px-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[17px]">upload</span>
                      <span>Carregar do Computador</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const url = window.prompt('Cole a URL da sua foto na internet:', avatar);
                        if (url && url.trim()) {
                          setAvatar(url.trim());
                          onToast('URL da foto atualizada!');
                        }
                      }}
                      className="h-9 px-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[17px]">link</span>
                      <span>Colar URL</span>
                    </button>
                  </div>

                  {/* Preset Quick Avatars */}
                  <div className="pt-2">
                    <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">
                      Ou escolha um avatar executivo rápido:
                    </span>
                    <div className="flex items-center gap-2 justify-center sm:justify-start">
                      {AVATAR_PRESETS.map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setAvatar(p);
                            onToast('Avatar selecionado!');
                          }}
                          className={`w-8 h-8 rounded-full overflow-hidden ring-2 transition-all cursor-pointer ${
                            avatar === p ? 'ring-blue-600 scale-110' : 'ring-transparent opacity-80 hover:opacity-100'
                          }`}
                        >
                          <img src={p} alt="Preset" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Personal Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome Completo do Usuário *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Thiago Dias"
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    E-mail Principal *
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Ex: tiagodias8888@gmail.com"
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    WhatsApp / Telefone para Notificações *
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(14) 99733-9863"
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    CPF ou CNPJ
                  </label>
                  <input
                    type="text"
                    value={cpfCnpj}
                    onChange={(e) => setCpfCnpj(e.target.value)}
                    placeholder="000.000.000-00"
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Empresa / Organização
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="HASPAHO Tecnologia da Informação"
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Função / Cargo
                  </label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="Desenvolvedor Full Stack"
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PIX KEY */}
          {activeTab === 'pix' && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-950 flex items-start gap-3">
                <span className="material-symbols-outlined text-[24px] text-emerald-600 shrink-0">
                  qr_code_2
                </span>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-emerald-900">
                    Chave PIX Principal para Recebimento de Cobranças
                  </h4>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    Esta chave PIX é enviada automaticamente aos devedores nas mensagens de cobrança via
                    WhatsApp e inserida nos comprovantes oficiais de liquidação com autenticação bancária.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Sua Chave PIX Padrão (E-mail, Telefone, CPF ou Chave Aleatória) *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={pixKey}
                    onChange={(e) => setPixKey(e.target.value)}
                    placeholder="Ex: tiagodias8888@gmail.com ou 14997339863"
                    className="flex-1 h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-emerald-600 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(pixKey);
                      onToast('Chave PIX copiada para a área de transferência!');
                    }}
                    className="h-11 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                  >
                    <span className="material-symbols-outlined text-[17px]">content_copy</span>
                    <span>Copiar</span>
                  </button>
                </div>
              </div>

              {/* PIX Quick Shortcuts */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-600 block mb-2">
                  Atalhos rápidos para definir sua chave:
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPixKey(email);
                      onToast('Chave definida como seu e-mail!');
                    }}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-blue-400 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Usar meu E-mail ({email})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPixKey('14997339863');
                      onToast('Chave definida como WhatsApp!');
                    }}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-emerald-400 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Usar Telefone (14997339863)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ADDRESS & CEP */}
          {activeTab === 'address' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-blue-950 flex items-start gap-3">
                <span className="material-symbols-outlined text-[24px] text-blue-600 shrink-0">
                  location_on
                </span>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-blue-900">
                    Endereço Completo do Usuário / Credor
                  </h4>
                  <p className="text-[11px] text-blue-800 leading-relaxed">
                    Essas informações são utilizadas nos contratos de confissão de dívida emitidos pela
                    HASPAHO Tecnologia e no cabeçalho fiscal de relatórios exportados em PDF.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                <div className="min-w-0">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    CEP (Código Postal) *
                  </label>
                  <input
                    type="text"
                    value={cep}
                    onChange={(e) => handleCepChange(e.target.value)}
                    placeholder="17320-000"
                    maxLength={9}
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none font-mono"
                  />
                </div>

                <div className="sm:col-span-2 min-w-0">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Logradouro / Rua / Avenida *
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Ex: Rua Central"
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                  />
                </div>

                <div className="min-w-0">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Número
                  </label>
                  <input
                    type="text"
                    value={addressNumber}
                    onChange={(e) => setAddressNumber(e.target.value)}
                    placeholder="100"
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                  />
                </div>

                <div className="min-w-0">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Bairro
                  </label>
                  <input
                    type="text"
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    placeholder="Centro"
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                  />
                </div>

                <div className="min-w-0">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Complemento / Referência
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Apto 12, Bloco B"
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                  />
                </div>

                <div className="sm:col-span-2 min-w-0">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cidade / Município *
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Mineiros do Tietê"
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white outline-none"
                  />
                </div>

                <div className="min-w-0">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Estado (UF) *
                  </label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value.toUpperCase())}
                    maxLength={2}
                    placeholder="SP"
                    className="w-full h-11 px-3.5 text-center uppercase font-bold bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white outline-none font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SECURITY & LOGOUT */}
          {activeTab === 'security' && (
            <div className="space-y-5">
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Método de Autenticação Ativo</h4>
                    <p className="text-[11px] text-slate-500">
                      Provedor conectado à sua conta individual.
                    </p>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full">
                    {currentUser.authProvider.toUpperCase()}
                  </span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200/60 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-emerald-600 text-[20px]">
                      verified_user
                    </span>
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        ID Único: #{currentUser.username || 'tiagodias'}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Criado em: {new Date(currentUser.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <span className="text-emerald-700 text-xs font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Seguro
                  </span>
                </div>
              </div>

              {/* Change Password */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-900">Atualizar Senha de Acesso</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Nova Senha
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 4 caracteres"
                      className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Confirmar Nova Senha
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repita a nova senha"
                      className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Logout Action Inside Security */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900">Desconectar deste dispositivo</p>
                  <p className="text-[11px] text-slate-500">
                    Fecha sua sessão e protege seus devedores com a barreira de login.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onLogout();
                  }}
                  className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[17px]">logout</span>
                  <span>Sair da Conta</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: SUPORTE DIRETO & SENTINELA INTELIGENTE (TIAGO DIAS) */}
          {activeTab === 'suporte' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-amber-50 to-orange-50/60 border-2 border-amber-300 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center gap-2 text-amber-950 font-extrabold text-sm">
                  <span className="material-symbols-outlined text-amber-600 text-[24px]">contact_support</span>
                  <span>Suporte Direto com o Desenvolvedor Programador Full Stack</span>
                </div>

                <p className="text-slate-700 leading-relaxed text-xs sm:text-[13px]">
                  Caso identifique qualquer eventual problema no sistema, programa, software ou aplicativo, entre em contato imediatamente com o desenvolvedor <b>Tiago Dias (Programador Full Stack)</b> pelo WhatsApp no número <b>(14) 99733-9863</b>.
                </p>

                <div className="p-3.5 bg-white/90 rounded-xl border border-amber-200 text-amber-950 font-medium space-y-1 shadow-2xs">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-amber-900">
                    <span className="material-symbols-outlined text-[17px] text-amber-700">photo_camera</span>
                    <span>Envio de Print da Tela:</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    Tire um <b>print da tela</b> e nos envie junto pelo WhatsApp explicando o que está acontecendo. O mais breve possível a falha será verificada e resolvida pelo desenvolvedor!
                  </p>
                </div>

                {/* Ação Rápida WhatsApp com Print */}
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={isCapturingSupportPrint}
                    onClick={async () => {
                      try {
                        setIsCapturingSupportPrint(true);
                        onToast('📸 Capturando print da tela...');
                        await capturePanelScreenshot(document.body, `Erro_Sistema_HASPAHO_${Date.now()}.png`);
                        const text = `🚨 *SUPORTE TÉCNICO HASPAHO*\n\nOlá Tiago Dias, estou precisando de suporte no sistema.\nData: ${new Date().toLocaleString('pt-BR')}\n\n(Segue o print da tela em anexo)`;
                        const url = `https://api.whatsapp.com/send?phone=5514997339863&text=${encodeURIComponent(text)}`;
                        window.open(url, '_blank', 'noopener,noreferrer');
                        onToast('WhatsApp aberto! Anexe o print que foi salvo nos seus Downloads.');
                      } catch (err) {
                        const fallback = `https://api.whatsapp.com/send?phone=5514997339863&text=${encodeURIComponent('Olá Tiago Dias, preciso de suporte no sistema HASPAHO.')}`;
                        window.open(fallback, '_blank', 'noopener,noreferrer');
                      } finally {
                        setIsCapturingSupportPrint(false);
                      }
                    }}
                    className="flex-1 min-w-[260px] h-11 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                  >
                    <WhatsAppIcon className="w-5 h-5 text-white" size={19} />
                    <span>{isCapturingSupportPrint ? 'Capturando Print...' : '📸 Tirar Print & Abrir WhatsApp de Tiago Dias'}</span>
                  </button>

                  <a
                    href="mailto:tiagodias8888@gmail.com?subject=Suporte%20HASPAHO"
                    className="h-11 px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[18px]">mail</span>
                    <span>E-mail</span>
                  </a>
                </div>
              </div>

              {/* Análise Automática e Anônima */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-200 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-blue-600">monitor_heart</span>
                    <span className="font-bold text-slate-900 text-xs sm:text-sm">
                      Sentinela: Análise Anônima de Integridade do Sistema
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={isRunningDiagnostic}
                    onClick={async () => {
                      setIsRunningDiagnostic(true);
                      try {
                        const rep = await systemHealthSentinel.runDiagnostics();
                        setDiagnosticReport(rep);
                        onToast('Diagnóstico concluído: Sistema 100% verificado.');
                      } finally {
                        setIsRunningDiagnostic(false);
                      }
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-all active:scale-95"
                  >
                    <span className={`material-symbols-outlined text-[15px] ${isRunningDiagnostic ? 'animate-spin' : ''}`}>
                      refresh
                    </span>
                    <span>{isRunningDiagnostic ? 'Analisando...' : 'Executar Análise de Integridade Agora'}</span>
                  </button>
                </div>

                <p className="text-[11px] text-slate-600 leading-relaxed">
                  O sistema executa análises anônimas preventivas em segundo plano. Caso ocorra qualquer inconsistência, o sentinela alerta o usuário e possibilita o envio de notificação imediata ao administrador.
                </p>

                {diagnosticReport && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {diagnosticReport.checks.map((c, i) => (
                      <div
                        key={i}
                        className={`p-2.5 rounded-xl border flex items-start gap-2 ${
                          c.passed
                            ? 'bg-white border-slate-200 text-slate-700'
                            : 'bg-red-50 border-red-200 text-red-900'
                        }`}
                      >
                        <span className={`material-symbols-outlined text-[18px] shrink-0 mt-0.5 ${c.passed ? 'text-emerald-600' : 'text-red-600'}`}>
                          {c.passed ? 'check_circle' : 'error'}
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-[11px]">{c.name}</div>
                          <div className="text-[10px] text-slate-500">{c.details}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: LIXEIRA DE DEVEDORES EXCLUÍDOS (RECUPERAÇÃO EM ATÉ 8 DIAS) */}
          {activeTab === 'lixeira' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                <span className="material-symbols-outlined text-amber-600 text-[24px] shrink-0 mt-0.5">
                  info
                </span>
                <div className="text-xs space-y-1">
                  <h4 className="font-bold text-amber-950">
                    Lixeira de Devedores & Pessoas Excluídas
                  </h4>
                  <p className="text-amber-800 leading-relaxed">
                    Você pode restaurar qualquer usuário, pessoa ou devedor excluído nesta tela.
                    <strong className="block mt-0.5 text-amber-900 font-extrabold">
                      Automaticamente, a exclusão de um usuário ou devedor pode ser desfeita no máximo em 8 dias.
                    </strong>
                  </p>
                </div>
              </div>

              {deletedDebtors.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <span className="material-symbols-outlined text-4xl text-slate-300 mb-2 block">
                    delete_sweep
                  </span>
                  <p className="text-sm font-bold text-slate-700">A Lixeira está vazia</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Nenhum devedor ou pessoa foi excluído recentemente.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                  {deletedDebtors.map((d) => (
                    <div
                      key={d.id}
                      className="p-3.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-2xl flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={d.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
                          alt={d.name}
                          className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-300 shrink-0"
                        />
                        <div className="min-w-0">
                          <h5 className="font-extrabold text-slate-900 text-xs sm:text-sm truncate">
                            {d.name}
                          </h5>
                          <p className="text-[11px] text-slate-500 truncate">
                            Vínculo: <strong>{d.relation || 'Cliente'}</strong> • Saldo: <strong className="text-slate-800">R$ {d.totalOwed.toFixed(2)}</strong>
                          </p>
                          <p className="text-[10px] text-amber-700 font-bold mt-0.5">
                            🕒 Excluído recentemente • Pode ser restaurado em até 8 dias
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {onRestoreDebtor && (
                          <button
                            type="button"
                            onClick={() => {
                              onRestoreDebtor(d.id);
                              onToast(`Devedor "${d.name}" restaurado com sucesso!`);
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                            title="Restaurar este devedor"
                          >
                            <span className="material-symbols-outlined text-[16px]">restore</span>
                            <span>Restaurar</span>
                          </button>
                        )}

                        {onPermanentDeleteDebtor && (
                          <button
                            type="button"
                            onClick={() => {
                              onPermanentDeleteDebtor(d.id);
                              onToast(`Devedor "${d.name}" removido permanentemente.`);
                            }}
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Excluir Definitivamente"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete_forever</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          </div>

          {/* Action Buttons Footer (always visible and never clipped) */}
          <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[17px]">save</span>
              <span>Salvar Alterações</span>
            </button>
          </div>
        </form>
      </div>

      {/* Avatar Cropping Modal Overlay */}
      <ImageCropperModal
        isOpen={cropModalOpen}
        imageSrc={rawUploadImage}
        shape="circle"
        title="Recorte Manual da Foto do Credor"
        onConfirm={(croppedDataUrl) => {
          setAvatar(croppedDataUrl);
          setCropModalOpen(false);
          setRawUploadImage(null);
          onToast('Foto do credor recortada e aplicada com sucesso!');
        }}
        onCancel={() => {
          setCropModalOpen(false);
          setRawUploadImage(null);
        }}
      />
    </div>
  );
};
