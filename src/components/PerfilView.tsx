import React, { useState, useEffect } from 'react';
import { ScreenTab, UserAccount } from '../types';
import { APP_IMAGES } from '../data/mockData';
import { HaspahoLogo } from './HaspahoLogo';
import { ImageCropperModal } from './ImageCropperModal';

interface PerfilViewProps {
  currentUser: UserAccount | null;
  onNavigate: (tab: ScreenTab) => void;
  onOpenAssetInspector: () => void;
  onOpenLogin: () => void;
  onOpenWelcome: () => void;
  onOpenUserSettings?: () => void;
  onSaveUser?: (updatedUser: UserAccount) => void;
  onLogout: () => void;
  onToast: (msg: string) => void;
  onClearAllData?: () => void;
}

export const PerfilView: React.FC<PerfilViewProps> = ({
  currentUser,
  onNavigate,
  onOpenAssetInspector,
  onOpenLogin,
  onOpenWelcome,
  onOpenUserSettings,
  onSaveUser,
  onLogout,
  onToast,
  onClearAllData,
}) => {
  const [pixKey, setPixKey] = useState(
    currentUser?.pixKey || '(14) 99733-9863'
  );
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(true);
  const [notifyInvoiceClose, setNotifyInvoiceClose] = useState(true);
  const [autoPenalty, setAutoPenalty] = useState(true);

  // Photo editing states
  const [currentAvatar, setCurrentAvatar] = useState(
    currentUser?.avatar || APP_IMAGES.currentUser || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
  );
  const [zoom, setZoom] = useState(1);
  const [cropShape, setCropShape] = useState<'circle' | 'square'>('circle');
  const [isPhotoEditorOpen, setIsPhotoEditorOpen] = useState(false);
  const [rawUploadImage, setRawUploadImage] = useState<string | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);

  // Sincroniza estado quando o usuário ativo muda
  useEffect(() => {
    if (currentUser) {
      setPixKey(currentUser.pixKey || '(14) 99733-9863');
      setCurrentAvatar(currentUser.avatar || APP_IMAGES.currentUser || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80');
    }
  }, [currentUser]);

  const developerPhone = '14997339863';
  const developerPhoneFormatted = '(14) 99733-9863';
  const developerWhatsappUrl = `https://wa.me/55${developerPhone}?text=${encodeURIComponent(
    'Olá Tiago Dias, estou utilizando o sistema HASPAHO de controle de devedores e parcelamentos!'
  )}`;

  const displayName = currentUser?.name || 'Tiago Dias';
  const displayEmail = currentUser?.email || 'tiagodias8888@gmail.com';
  const displayPhone = currentUser?.phoneWhatsapp || '(14) 99733-9863';
  const displayProvider = currentUser?.authProvider || 'local';
  const displayCpf = currentUser?.cpfCnpj || 'Não informado';
  const displayCompany = currentUser?.companyName || 'HASPAHO Tecnologia da Informação';
  const displayRole = currentUser?.role || 'Desenvolvedor Full Stack';
  const displayAddress = currentUser?.address
    ? `${currentUser.address}, ${currentUser.addressNumber || 'S/N'} - ${currentUser.neighborhood || ''}, ${currentUser.city || 'Mineiros do Tietê'}/${currentUser.state || 'SP'} (CEP: ${currentUser.cep || '17320-000'})`
    : 'Mineiros do Tietê - SP';

  const handleSavePhoto = () => {
    if (currentUser && onSaveUser) {
      const updated: UserAccount = {
        ...currentUser,
        avatar: currentAvatar,
      };
      onSaveUser(updated);
    }
    setIsPhotoEditorOpen(false);
    onToast('✨ Foto de perfil atualizada, recortada e salva com sucesso!');
  };

  const handleSavePixKey = () => {
    if (!pixKey.trim()) {
      onToast('Por favor, informe uma chave PIX válida.');
      return;
    }
    if (currentUser && onSaveUser) {
      const updated: UserAccount = {
        ...currentUser,
        pixKey: pixKey.trim(),
      };
      onSaveUser(updated);
      onToast(`🔑 Chave PIX "${pixKey.trim()}" atualizada e salva com sucesso!`);
    } else {
      onToast('Chave PIX salva!');
    }
  };

  return (
    <div className="flex flex-col max-w-2xl mx-auto w-full pb-24 gap-4">
      {/* Profile Card with Logged User Information */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col items-center text-center gap-3">
        <div className="relative group cursor-pointer" onClick={() => setIsPhotoEditorOpen(true)}>
          <div className="w-24 h-24 rounded-full overflow-hidden shadow-sm ring-4 ring-blue-50 flex items-center justify-center bg-slate-100">
            <img
              src={currentAvatar}
              alt={displayName}
              style={{ transform: `scale(${zoom})`, transition: 'transform 0.2s ease' }}
              className={`w-full h-full object-cover ${cropShape === 'circle' ? 'rounded-full' : 'rounded-xl'}`}
            />
          </div>
          <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
            <span className="material-symbols-outlined text-[24px]">crop</span>
          </div>
          <span className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center ring-2 ring-white text-[12px] shadow-sm" title="Editar / Recortar Foto">
            <span className="material-symbols-outlined text-[15px]">edit</span>
          </span>
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-900 leading-tight">
            {displayName}
          </h2>
          <span className="text-xs text-slate-500">
            {displayEmail} • {displayPhone}
          </span>
          <div className="mt-1 flex items-center justify-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
              Acesso: {displayProvider.toUpperCase()}
            </span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
              HASPAHO ID: #{currentUser?.username || 'tiagodias'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-1 flex-wrap justify-center w-full">
          {onOpenUserSettings && (
            <button
              type="button"
              onClick={onOpenUserSettings}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
              title="Editar todos os seus dados cadastrais, endereço e chave PIX"
            >
              <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
              <span>Editar Meus Dados Pessoais &amp; PIX</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setRawUploadImage(currentAvatar);
              setIsCropperOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-purple-200"
          >
            <span className="material-symbols-outlined text-[16px]">crop</span>
            <span>Ajustar Foto</span>
          </button>

          <button
            type="button"
            onClick={onOpenWelcome}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Abrir tela de Boas-Vindas oficial"
          >
            <span className="material-symbols-outlined text-[16px]">celebration</span>
            <span>Boas-Vindas</span>
          </button>

          <button
            type="button"
            onClick={onOpenLogin}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Trocar usuário ou cadastrar nova conta"
          >
            <span className="material-symbols-outlined text-[16px]">switch_account</span>
            <span>Trocar Conta</span>
          </button>

          {onClearAllData && (
            <button
              type="button"
              onClick={onClearAllData}
              className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-amber-200"
              title="Limpar todos os dados e começar com ambiente 100% zerado"
            >
              <span className="material-symbols-outlined text-[16px]">cleaning_services</span>
              <span>Zerar Dados</span>
            </button>
          )}

          <button
            type="button"
            onClick={onLogout}
            className="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Desconectar do sistema"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
            <span>Sair</span>
          </button>
        </div>
      </div>

      {/* PIX Key Configuration & Direct Save */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px] text-emerald-600">qr_code_2</span>
            Chave PIX Padrão para Cobranças dos Devedores
          </label>
          <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            Usada no WhatsApp &amp; Recibos
          </span>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <input
            type="text"
            value={pixKey}
            onChange={(e) => setPixKey(e.target.value)}
            placeholder="Digite seu e-mail, telefone, CPF ou chave aleatória"
            className="flex-1 h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-emerald-600 outline-none"
          />
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSavePixKey}
              className="flex-1 sm:flex-none h-11 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer"
              title="Salvar alteração da chave PIX no banco de dados"
            >
              <span className="material-symbols-outlined text-[17px]">save</span>
              <span>Salvar Chave PIX</span>
            </button>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(pixKey);
                onToast('Chave PIX copiada para a área de transferência!');
              }}
              className="h-11 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
              title="Copiar Chave PIX"
            >
              <span className="material-symbols-outlined text-[16px]">content_copy</span>
              <span className="hidden sm:inline">Copiar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Complete Personal Data Summary Box */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px] text-blue-600">badge</span>
            Meus Dados Cadastrais &amp; Fiscais
          </h3>
          {onOpenUserSettings && (
            <button
              type="button"
              onClick={onOpenUserSettings}
              className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-0.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">edit</span>
              <span>Editar Todos</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] text-slate-400 font-bold block uppercase">Nome Completo</span>
            <span className="font-bold text-slate-800">{displayName}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] text-slate-400 font-bold block uppercase">E-mail Principal</span>
            <span className="font-bold text-slate-800">{displayEmail}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] text-slate-400 font-bold block uppercase">WhatsApp / Telefone</span>
            <span className="font-bold text-slate-800">{displayPhone}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] text-slate-400 font-bold block uppercase">CPF ou CNPJ</span>
            <span className="font-bold text-slate-800">{displayCpf}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] text-slate-400 font-bold block uppercase">Empresa / Razão Social</span>
            <span className="font-bold text-slate-800">{displayCompany}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] text-slate-400 font-bold block uppercase">Cargo / Função</span>
            <span className="font-bold text-slate-800">{displayRole}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 sm:col-span-2">
            <span className="text-[10px] text-slate-400 font-bold block uppercase">Endereço &amp; CEP (Usados em Contratos e PDFs)</span>
            <span className="font-semibold text-slate-700">{displayAddress}</span>
          </div>
        </div>
      </div>

      {/* Official Company & Developer Presentation Card (HASPAHO TIAGO AUGUSTO DIAS) */}
      <div className="bg-gradient-to-br from-[#031525] via-[#072c4e] to-[#0a3f6f] rounded-2xl p-5 text-white shadow-lg border border-blue-500/30 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-white rounded-xl shadow-md shrink-0">
              <HaspahoLogo size="sm" variant="icon" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-sm tracking-tight text-white">HASPAHO</span>
                <span className="text-xs font-bold text-amber-300">TIAGO AUGUSTO DIAS</span>
                <span className="bg-amber-400 text-slate-950 text-[9px] font-black px-1.5 py-0.5 rounded font-mono">
                  ADMIN MASTER &amp; DEV
                </span>
              </div>
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mt-0.5">
                DESENVOLVEDOR &amp; PROGRAMADOR FULL STACK • AUTONOMIA TOTAL
              </p>
              <div className="text-xs text-slate-200 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                <span><strong>CPF:</strong> 368.497.448-01</span>
                <span><strong>WhatsApp:</strong> (014) 99733-9863</span>
                <span><strong>Gmail:</strong> tiagodias8888@gmail.com</span>
              </div>
              <p className="text-[11px] text-slate-300 flex items-center gap-1 mt-1">
                <span className="material-symbols-outlined text-[14px] text-blue-400">location_on</span>
                <span>Mineiros do Tietê, SP • Interior Paulista</span>
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch gap-2 shrink-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => onNavigate('admin-forum')}
              className="h-10 px-3.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">crown</span>
              <span>Abrir Painel Admin &amp; Fórum</span>
            </button>

            <a
              href="https://wa.me/5514997339863?text=Ol%C3%A1%20Tiago%20Augusto%20Dias%2C%20gostaria%20de%20enviar%20uma%20sugest%C3%A3o%2Ffeedback%20sobre%20a%20plataforma%20HASPAHO!"
              target="_blank"
              rel="noopener noreferrer"
              className="h-10 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer"
              title="Conversar diretamente com Tiago Dias no WhatsApp (014 99733 9863)"
            >
              <span className="material-symbols-outlined text-[18px]">chat</span>
              <span>WhatsApp (014) 99733-9863</span>
            </a>
          </div>
        </div>

        {/* Closed Forum Quick Submission Box */}
        <div className="bg-black/30 rounded-xl p-3 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-400 text-[20px]">forum</span>
            <div>
              <span className="font-bold text-white">Fórum Fechado de Sugestões &amp; Melhorias</span>
              <p className="text-[11px] text-slate-300">
                Envie suas ideias ou tire dúvidas diretamente com o desenvolvedor Tiago Augusto Dias.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => onNavigate('admin-forum')}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer w-full sm:w-auto justify-center"
            >
              <span className="material-symbols-outlined text-[15px]">rate_review</span>
              <span>Ver Fórum Fechado</span>
            </button>
          </div>
        </div>
      </div>

      {/* Preferences & Automations */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col gap-3">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
          Automações e Preferências do Sistema
        </h3>

        <div className="divide-y divide-slate-100">
          <label className="flex items-center justify-between py-2.5 cursor-pointer">
            <div>
              <p className="text-xs font-bold text-slate-800">Lembrete Automático WhatsApp</p>
              <p className="text-[11px] text-slate-500">
                Sugerir mensagem cordial com detalhes de parcelas e chave PIX.
              </p>
            </div>
            <input
              type="checkbox"
              checked={notifyWhatsapp}
              onChange={(e) => setNotifyWhatsapp(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between py-2.5 cursor-pointer">
            <div>
              <p className="text-xs font-bold text-slate-800">Alerta de Fechamento de Fatura</p>
              <p className="text-[11px] text-slate-500">
                Avisar quando faltarem 3 dias para fechar faturas dos cartões.
              </p>
            </div>
            <input
              type="checkbox"
              checked={notifyInvoiceClose}
              onChange={(e) => setNotifyInvoiceClose(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between py-2.5 cursor-pointer">
            <div>
              <p className="text-xs font-bold text-slate-800">Taxa Fixa de Atraso (R$ 5,00) e Juros</p>
              <p className="text-[11px] text-slate-500">
                Aplicar taxa de atraso no valor total da parcela se o pagamento estiver vencido.
              </p>
            </div>
            <input
              type="checkbox"
              checked={autoPenalty}
              onChange={(e) => setAutoPenalty(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* Navigation shortcuts */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col gap-2">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
          Integrações &amp; Recursos
        </h3>

        <button
          onClick={() => onNavigate('relatorios')}
          className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 text-left transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5 text-slate-800">
            <span className="material-symbols-outlined text-[20px] text-blue-600">account_balance</span>
            <span className="text-xs font-semibold">Bancos &amp; Cartões Conectados</span>
          </div>
          <span className="material-symbols-outlined text-slate-400 text-[18px]">chevron_right</span>
        </button>

        <button
          onClick={() => onNavigate('erp-legacy')}
          className="w-full flex items-center justify-between p-2.5 rounded-xl bg-amber-50/60 hover:bg-amber-100/60 border border-amber-200/80 text-left transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5 text-amber-950">
            <span className="material-symbols-outlined text-[20px] text-amber-600">desktop_windows</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold">Sistema ERP Corporativo (Desktop)</span>
                <span className="text-[9px] bg-amber-400 text-slate-950 font-black px-1.5 py-0.5 rounded font-mono">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-amber-800/80">
                Interface de formulário de dados denso (estilo Delphi/WinForms) com atalhos de teclado (F2-F6).
              </p>
            </div>
          </div>
          <span className="material-symbols-outlined text-amber-600 text-[18px]">chevron_right</span>
        </button>

        <button
          onClick={onOpenAssetInspector}
          className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 text-left transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5 text-slate-800">
            <span className="material-symbols-outlined text-[20px] text-purple-600">image</span>
            <span className="text-xs font-semibold">Links Diretos das Imagens HTML</span>
          </div>
          <span className="material-symbols-outlined text-slate-400 text-[18px]">chevron_right</span>
        </button>
      </div>

      {/* Photo Editor Modal */}
      {isPhotoEditorOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">crop</span>
                </span>
                <h3 className="font-bold text-slate-900 text-base">Editor de Foto &amp; Recorte</h3>
              </div>
              <button onClick={() => setIsPhotoEditorOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Live Preview Window with Zoom & Crop */}
            <div className="flex flex-col items-center justify-center gap-3 py-4 bg-slate-900 rounded-2xl p-4 overflow-hidden relative">
              <div className={`w-36 h-36 overflow-hidden border-4 border-white/80 shadow-lg flex items-center justify-center bg-slate-800 transition-all ${cropShape === 'circle' ? 'rounded-full' : 'rounded-2xl'}`}>
                <img
                  src={currentAvatar}
                  alt="Preview"
                  style={{ transform: `scale(${zoom})`, transition: 'transform 0.1s ease-out' }}
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-[11px] text-slate-300">
                Zoom: {Math.round(zoom * 100)}% • Formato: {cropShape === 'circle' ? 'Círculo' : 'Quadrado'}
              </span>
            </div>

            {/* Zoom Controls */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">Controle de Zoom (Aproximar / Afastar)</label>
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  className="text-[11px] text-blue-600 hover:underline font-semibold cursor-pointer"
                >
                  Restaurar 100%
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setZoom(Math.max(0.8, zoom - 0.1))}
                  className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center cursor-pointer shadow-2xs"
                  title="Diminuir Zoom"
                >
                  <span className="material-symbols-outlined text-[18px]">zoom_out</span>
                </button>
                <input
                  type="range"
                  min="0.8"
                  max="2.5"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="flex-1 accent-purple-600 cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => setZoom(Math.min(2.5, zoom + 0.1))}
                  className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center cursor-pointer shadow-2xs"
                  title="Aumentar Zoom"
                >
                  <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                </button>
              </div>
            </div>

            {/* Crop Shape Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">Formato do Recorte</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCropShape('circle')}
                  className={`h-9 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${cropShape === 'circle' ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                >
                  <span className="material-symbols-outlined text-[16px]">radio_button_checked</span>
                  <span>Círculo (Redondo)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCropShape('square')}
                  className={`h-9 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${cropShape === 'square' ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                >
                  <span className="material-symbols-outlined text-[16px]">square</span>
                  <span>Quadrado / Retrato</span>
                </button>
              </div>
            </div>

            {/* Upload Options */}
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-700">Alterar Imagem da Foto</label>
              <label className="w-full h-10 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer border border-blue-200">
                <span className="material-symbols-outlined text-[16px]">upload</span>
                <span>Carregar do Computador</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        if (event.target?.result) {
                          setRawUploadImage(event.target.result as string);
                          setIsCropperOpen(true);
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsPhotoEditorOpen(false)}
                className="w-1/3 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSavePhoto}
                className="flex-1 h-10 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">check</span>
                <span>Salvar Foto Recortada</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recorte Manual Interativo da Foto do Perfil */}
      <ImageCropperModal
        isOpen={isCropperOpen}
        imageSrc={rawUploadImage}
        shape={cropShape}
        title="Recorte Manual da Foto de Perfil"
        onConfirm={(croppedUrl) => {
          setCurrentAvatar(croppedUrl);
          setIsCropperOpen(false);
          setRawUploadImage(null);
          if (currentUser && onSaveUser) {
            onSaveUser({ ...currentUser, avatar: croppedUrl });
          }
          onToast('Foto de perfil recortada e salva!');
        }}
        onCancel={() => {
          setIsCropperOpen(false);
          setRawUploadImage(null);
        }}
      />
    </div>
  );
};
