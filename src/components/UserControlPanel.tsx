import React, { useState, useMemo } from 'react';
import { Debtor, UserAccount, ScreenTab } from '../types';
import { HaspahoLogo } from './HaspahoLogo';
import { SafeDebtorAvatar } from './DebtorsMasterSpreadsheet';
import { APP_IMAGES } from '../data/mockData';

export type ControlPanelLayer =
  | 'root'
  | 'perfil'
  | 'conta'
  | 'devedores'
  | 'credor'
  | 'relacionados'
  | 'confirm_trocar'
  | 'confirm_sair';

interface UserControlPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: UserAccount | null;
  debtors: Debtor[];
  onNavigate: (tab: ScreenTab, targetId?: string, extraId?: string) => void;
  onOpenUserSettings?: () => void;
  onOpenNewDebtor?: () => void;
  onEditDebtor?: (debtor: Debtor) => void;
  onOpenContract?: (debtorId: string) => void;
  onOpenAuthLookup?: () => void;
  onOpenGeminiScanner?: () => void;
  onOpenLogin?: () => void;
  onOpenWelcome?: () => void;
  onLogout?: () => void;
  onRestoreAllData?: () => void;
}

export const UserControlPanel: React.FC<UserControlPanelProps> = ({
  isOpen,
  onClose,
  currentUser,
  debtors,
  onNavigate,
  onOpenUserSettings,
  onOpenNewDebtor,
  onEditDebtor,
  onOpenContract,
  onOpenAuthLookup,
  onOpenGeminiScanner,
  onOpenLogin,
  onOpenWelcome,
  onLogout,
  onRestoreAllData,
}) => {
  const [activeLayer, setActiveLayer] = useState<ControlPanelLayer>('root');
  const [debtorSearch, setDebtorSearch] = useState('');
  const [relationFilter, setRelationFilter] = useState<'all' | 'familia' | 'amigos' | 'trabalho' | 'servicos'>('all');

  // Filtered debtors for "Editar Devedores"
  const filteredDebtors = useMemo(() => {
    const q = debtorSearch.trim().toLowerCase();
    if (!q) return debtors.slice(0, 8); // show initial top 8 for clean aesthetics
    return debtors.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.phone && d.phone.toLowerCase().includes(q)) ||
        (d.relation && d.relation.toLowerCase().includes(q))
    );
  }, [debtors, debtorSearch]);

  // Filtered debtors for "Meus Relacionados"
  const relatedPeople = useMemo(() => {
    return debtors.filter((d) => {
      const rel = (d.relation || '').toLowerCase();
      if (relationFilter === 'familia') {
        return rel.includes('fam') || rel.includes('irm') || rel.includes('mãe') || rel.includes('pai') || rel.includes('espos') || rel.includes('filh');
      }
      if (relationFilter === 'amigos') {
        return rel.includes('amig') || rel.includes('vizinh') || rel.includes('particular');
      }
      if (relationFilter === 'trabalho') {
        return rel.includes('trabalho') || rel.includes('coleg') || rel.includes('sóci') || rel.includes('empresa');
      }
      if (relationFilter === 'servicos') {
        return rel.includes('servi') || rel.includes('presta') || rel.includes('cliente') || rel.includes('forneced');
      }
      return true;
    });
  }, [debtors, relationFilter]);

  if (!isOpen) return null;

  const userName = currentUser?.name || 'Tiago Dias';
  const firstName = userName.split(' ')[0];
  const userEmail = currentUser?.email || 'tiagodias8888@gmail.com';
  const userAvatar = currentUser?.avatar || APP_IMAGES.currentUser;
  const userRole = currentUser?.role || 'Desenvolvedor Full Stack & Administrador Master';
  const userPhone = currentUser?.phoneWhatsapp || '(14) 99733-9863';
  const userPix = currentUser?.pixKey || '(14) 99733-9863';
  const userDoc = currentUser?.cpfCnpj || '368.497.448-01';
  const userAddress = currentUser?.address
    ? `${currentUser.address}, ${currentUser.addressNumber || 'S/N'} • ${currentUser.city || 'Mineiros do Tietê'}-${currentUser.state || 'SP'}`
    : 'Mineiros do Tietê - SP';

  const handleActionAndClose = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <>
      {/* Backdrop overlay with controlled blur for dismissing */}
      <div
        className="fixed inset-0 z-[105] bg-slate-950/30 backdrop-blur-[1px] transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Main Control Panel Flyout / Carenagem - Perfeitamente centralizada e responsiva */}
      <aside
        role="dialog"
        aria-label="Central de Controle Pessoal do Usuário"
        className="fixed z-[110] inset-auto top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-20px)] sm:w-[430px] max-h-[88vh] bg-white rounded-3xl shadow-[0_25px_70px_-15px_rgba(15,23,42,0.5)] border border-slate-200/90 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* ============================================================ */}
        {/* CABEÇALHO DO PAINEL (CAMADA 1 & SUBCAMADAS)                  */}
        {/* ============================================================ */}
        <div className="bg-gradient-to-r from-slate-900 via-[#0e2246] to-slate-900 text-white p-4 sm:p-4.5 border-b border-white/10 shrink-0 relative">
          <div className="flex items-center justify-between gap-3">
            {activeLayer === 'root' ? (
              // Cabeçalho da Camada 1: Avatar, Nome, Identificação e Status
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <div className="w-11 h-11 rounded-full overflow-hidden ring-2 ring-blue-400 shadow-md">
                    <img
                      src={userAvatar}
                      alt={userName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span
                    className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-slate-900"
                    title="Sessão conectada"
                  />
                </div>

                <div className="flex flex-col min-w-0 leading-tight">
                  <div className="flex items-center gap-1.5">
                    <h2 className="font-extrabold text-sm sm:text-base text-white truncate">
                      {userName}
                    </h2>
                    <span className="w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center text-[9px] font-black shrink-0">
                      ✓
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-blue-200/90 font-medium truncate">
                      Conta ativa
                    </span>
                    <span className="text-[10px] text-slate-400">•</span>
                    <span className="text-[10px] text-emerald-300 font-mono font-bold bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-500/30">
                      HASPAHO TI
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              // Cabeçalho das Subcamadas: Botão Voltar + Título do Contexto
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => setActiveLayer('root')}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center transition-all cursor-pointer text-white shrink-0"
                  title="Voltar ao menu inicial"
                >
                  <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                </button>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-blue-300">
                    Centro de Controle
                  </span>
                  <h3 className="font-extrabold text-sm sm:text-base text-white leading-tight truncate">
                    {activeLayer === 'perfil' && 'Meu Perfil'}
                    {activeLayer === 'conta' && 'Minha Conta'}
                    {activeLayer === 'devedores' && 'Editar Devedores'}
                    {activeLayer === 'credor' && 'Dados do Credor'}
                    {activeLayer === 'relacionados' && 'Meus Relacionados'}
                    {activeLayer === 'confirm_trocar' && 'Trocar Usuário'}
                    {activeLayer === 'confirm_sair' && 'Encerrar Sessão'}
                  </h3>
                </div>
              </div>
            )}

            {/* Botão Fechar Painel */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
              title="Fechar painel"
              aria-label="Fechar painel"
            >
              <span className="material-symbols-outlined text-[19px]">close</span>
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* CORPO DO PAINEL (SCROLLÁVEL E RESPONSIVO)                     */}
        {/* ============================================================ */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-3.5 sm:p-4 space-y-3.5">
          {/* ---------------------------------------------------------- */}
          {/* CAMADA 1: HOME DA CARENAGEM (ACESSO RÁPIDO & ORGANIZADO)    */}
          {/* ---------------------------------------------------------- */}
          {activeLayer === 'root' && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              {/* 1. Grade de Atalhos Rápidos (Poucos e Importantes) */}
              <div>
                <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block mb-2 px-1">
                  Acesso Rápido
                </span>
                <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                  {/* + Novo Relacionado */}
                  {onOpenNewDebtor && (
                    <button
                      type="button"
                      onClick={() => handleActionAndClose(onOpenNewDebtor)}
                      className="p-2 sm:p-2.5 rounded-2xl bg-blue-50/80 hover:bg-blue-100 active:scale-95 border border-blue-200/70 flex flex-col items-center justify-center text-center gap-1 transition-all cursor-pointer group"
                      title="Cadastrar novo relacionado ou devedor"
                    >
                      <span className="material-symbols-outlined text-[20px] text-blue-600 group-hover:scale-110 transition-transform">
                        person_add
                      </span>
                      <span className="text-[10px] font-bold text-blue-900 leading-tight">
                        + Novo
                      </span>
                    </button>
                  )}

                  {/* Devedores */}
                  <button
                    type="button"
                    onClick={() => setActiveLayer('devedores')}
                    className="p-2 sm:p-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 active:scale-95 border border-slate-200/80 flex flex-col items-center justify-center text-center gap-1 transition-all cursor-pointer group"
                    title="Editar ou pesquisar devedores"
                  >
                    <span className="material-symbols-outlined text-[20px] text-indigo-600 group-hover:scale-110 transition-transform">
                      group
                    </span>
                    <span className="text-[10px] font-bold text-slate-800 leading-tight">
                      Devedores
                    </span>
                  </button>

                  {/* Credor */}
                  <button
                    type="button"
                    onClick={() => setActiveLayer('credor')}
                    className="p-2 sm:p-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 active:scale-95 border border-slate-200/80 flex flex-col items-center justify-center text-center gap-1 transition-all cursor-pointer group"
                    title="Visualizar e editar dados do credor"
                  >
                    <span className="material-symbols-outlined text-[20px] text-emerald-600 group-hover:scale-110 transition-transform">
                      account_balance_wallet
                    </span>
                    <span className="text-[10px] font-bold text-slate-800 leading-tight">
                      Credor
                    </span>
                  </button>

                  {/* Central de Parcelas */}
                  <button
                    type="button"
                    onClick={() => handleActionAndClose(() => onNavigate('parcelas'))}
                    className="p-2 sm:p-2.5 rounded-2xl bg-cyan-50/80 hover:bg-cyan-100 active:scale-95 border border-cyan-200/80 flex flex-col items-center justify-center text-center gap-1 transition-all cursor-pointer group"
                    title="Central de Parcelas e Recebíveis"
                  >
                    <span className="material-symbols-outlined text-[20px] text-cyan-600 group-hover:scale-110 transition-transform">
                      view_kanban
                    </span>
                    <span className="text-[10px] font-bold text-cyan-900 leading-tight">
                      Parcelas
                    </span>
                  </button>

                  {/* Minha Conta */}
                  <button
                    type="button"
                    onClick={() => setActiveLayer('conta')}
                    className="p-2 sm:p-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 active:scale-95 border border-slate-200/80 flex flex-col items-center justify-center text-center gap-1 transition-all cursor-pointer group"
                    title="Segurança e configurações de conta"
                  >
                    <span className="material-symbols-outlined text-[20px] text-amber-600 group-hover:scale-110 transition-transform">
                      shield_person
                    </span>
                    <span className="text-[10px] font-bold text-slate-800 leading-tight">
                      Conta
                    </span>
                  </button>
                </div>
              </div>

              {/* 2. Menu Principal de Seções (Arquitetura em Camadas) */}
              <div>
                <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block mb-2 px-1">
                  Gerenciamento &amp; Identificação
                </span>

                <div className="space-y-1.5">
                  {/* Seção 1: Meu Perfil */}
                  <button
                    type="button"
                    onClick={() => setActiveLayer('perfil')}
                    className="w-full p-2.5 sm:p-3 rounded-2xl bg-white hover:bg-slate-50 active:scale-[0.99] border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3 transition-all cursor-pointer group text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <span className="material-symbols-outlined text-[20px]">badge</span>
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-blue-600 transition-colors">
                          Meu perfil
                        </h4>
                        <p className="text-[11px] text-slate-500 truncate">
                          Visualizar e atualizar dados pessoais e foto
                        </p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-[18px] text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all">
                      chevron_right
                    </span>
                  </button>

                  {/* Seção 2: Minha Conta */}
                  <button
                    type="button"
                    onClick={() => setActiveLayer('conta')}
                    className="w-full p-2.5 sm:p-3 rounded-2xl bg-white hover:bg-slate-50 active:scale-[0.99] border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3 transition-all cursor-pointer group text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                        <span className="material-symbols-outlined text-[20px]">security</span>
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-purple-600 transition-colors">
                          Minha conta
                        </h4>
                        <p className="text-[11px] text-slate-500 truncate">
                          Segurança, senha, chave PIX e preferências
                        </p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-[18px] text-slate-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all">
                      chevron_right
                    </span>
                  </button>

                  {/* Seção 3: Editar Devedores */}
                  <button
                    type="button"
                    onClick={() => setActiveLayer('devedores')}
                    className="w-full p-2.5 sm:p-3 rounded-2xl bg-white hover:bg-slate-50 active:scale-[0.99] border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3 transition-all cursor-pointer group text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center shrink-0 group-hover:bg-cyan-600 group-hover:text-white transition-colors">
                        <span className="material-symbols-outlined text-[20px]">contact_page</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-cyan-700 transition-colors">
                            Editar devedores
                          </h4>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-cyan-100 text-cyan-800">
                            {debtors.length}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">
                          Busca rápida, atualização cadastral e histórico
                        </p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-[18px] text-slate-400 group-hover:text-cyan-700 group-hover:translate-x-0.5 transition-all">
                      chevron_right
                    </span>
                  </button>

                  {/* Seção 4: Editar Credor */}
                  <button
                    type="button"
                    onClick={() => setActiveLayer('credor')}
                    className="w-full p-2.5 sm:p-3 rounded-2xl bg-white hover:bg-slate-50 active:scale-[0.99] border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3 transition-all cursor-pointer group text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                        <span className="material-symbols-outlined text-[20px]">storefront</span>
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-emerald-700 transition-colors">
                          Editar credor
                        </h4>
                        <p className="text-[11px] text-slate-500 truncate">
                          Dados do titular, recebimentos e endereço comercial
                        </p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-[18px] text-slate-400 group-hover:text-emerald-700 group-hover:translate-x-0.5 transition-all">
                      chevron_right
                    </span>
                  </button>

                  {/* Seção 5: Meus Relacionados */}
                  <button
                    type="button"
                    onClick={() => setActiveLayer('relacionados')}
                    className="w-full p-2.5 sm:p-3 rounded-2xl bg-white hover:bg-slate-50 active:scale-[0.99] border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3 transition-all cursor-pointer group text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <span className="material-symbols-outlined text-[20px]">diversity_3</span>
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-indigo-700 transition-colors">
                          Meus relacionados
                        </h4>
                        <p className="text-[11px] text-slate-500 truncate">
                          Família, amigos, trabalho e prestadores de serviços
                        </p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-[18px] text-slate-400 group-hover:text-indigo-700 group-hover:translate-x-0.5 transition-all">
                      chevron_right
                    </span>
                  </button>
                </div>
              </div>

              {/* 3. Acessos do Sistema & Ferramentas Integradas */}
              <div>
                <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block mb-2 px-1">
                  Módulos &amp; Ferramentas
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {/* Painel Dev & Fórum Admin */}
                  <button
                    type="button"
                    onClick={() => handleActionAndClose(() => onNavigate('admin-forum'))}
                    className="p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50/70 border border-slate-200/80 flex items-center gap-2 transition-all cursor-pointer text-left group"
                  >
                    <span className="material-symbols-outlined text-[18px] text-amber-500">crown</span>
                    <div className="min-w-0">
                      <span className="font-bold text-xs text-slate-800 block truncate">
                        Admin Fórum
                      </span>
                      <span className="text-[10px] text-slate-500 truncate block">Painel Master</span>
                    </div>
                  </button>

                  {/* Sistema ERP Corporativo */}
                  <button
                    type="button"
                    onClick={() => handleActionAndClose(() => onNavigate('erp-legacy'))}
                    className="p-2.5 rounded-xl bg-slate-50 hover:bg-amber-50/70 border border-slate-200/80 flex items-center gap-2 transition-all cursor-pointer text-left group"
                  >
                    <span className="material-symbols-outlined text-[18px] text-amber-600">desktop_windows</span>
                    <div className="min-w-0">
                      <span className="font-bold text-xs text-slate-800 block truncate">
                        Modo ERP
                      </span>
                      <span className="text-[10px] text-slate-500 truncate block">Desktop Pro</span>
                    </div>
                  </button>

                  {/* Autenticador Digital */}
                  {onOpenAuthLookup && (
                    <button
                      type="button"
                      onClick={() => handleActionAndClose(onOpenAuthLookup)}
                      className="p-2.5 rounded-xl bg-slate-50 hover:bg-purple-50/70 border border-slate-200/80 flex items-center gap-2 transition-all cursor-pointer text-left group"
                    >
                      <span className="material-symbols-outlined text-[18px] text-purple-600">verified</span>
                      <div className="min-w-0">
                        <span className="font-bold text-xs text-slate-800 block truncate">
                          Autenticador
                        </span>
                        <span className="text-[10px] text-slate-500 truncate block">Consultar Chave</span>
                      </div>
                    </button>
                  )}

                  {/* Scanner IA Gemini */}
                  {onOpenGeminiScanner && (
                    <button
                      type="button"
                      onClick={() => handleActionAndClose(onOpenGeminiScanner)}
                      className="p-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50/70 border border-slate-200/80 flex items-center gap-2 transition-all cursor-pointer text-left group"
                    >
                      <span className="material-symbols-outlined text-[18px] text-indigo-600">auto_awesome</span>
                      <div className="min-w-0">
                        <span className="font-bold text-xs text-slate-800 block truncate">
                          Scanner IA
                        </span>
                        <span className="text-[10px] text-slate-500 truncate block">Ler Contratos</span>
                      </div>
                    </button>
                  )}

                  {/* Restaurar Base de Dados Padrão */}
                  {onRestoreAllData && (
                    <button
                      type="button"
                      onClick={() => handleActionAndClose(onRestoreAllData)}
                      className="p-2.5 rounded-xl bg-emerald-50/60 hover:bg-emerald-100/80 border border-emerald-200/80 flex items-center gap-2 transition-all cursor-pointer text-left group col-span-2"
                      title="Recarrega todos os devedores, compras e parcelas oficiais"
                    >
                      <span className="material-symbols-outlined text-[18px] text-emerald-600">sync_saved_locally</span>
                      <div className="min-w-0">
                        <span className="font-bold text-xs text-emerald-950 block truncate">
                          Restaurar Base de Dados
                        </span>
                        <span className="text-[10px] text-emerald-700 truncate block">Recarregar Devedores e Compras Oficiais</span>
                      </div>
                    </button>
                  )}
                </div>
              </div>

              {/* 4. Rodapé da Camada 1: Trocar Usuário & Sair */}
              <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setActiveLayer('confirm_trocar')}
                  className="flex-1 py-2 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[17px] text-slate-600">switch_account</span>
                  <span>Trocar usuário</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveLayer('confirm_sair')}
                  className="py-2 px-3 rounded-xl bg-red-50 hover:bg-red-100 active:scale-95 text-red-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-red-200/60"
                >
                  <span className="material-symbols-outlined text-[17px] text-red-600">logout</span>
                  <span>Sair</span>
                </button>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------- */}
          {/* CAMADA 2: SEÇÃO MEU PERFIL                                 */}
          {/* ---------------------------------------------------------- */}
          {activeLayer === 'perfil' && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              {/* Card Resumo do Usuário */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/70 via-slate-50 to-indigo-50/40 border border-blue-200/70 flex items-start gap-3.5">
                <div className="w-14 h-14 rounded-2xl overflow-hidden ring-2 ring-blue-500/40 shadow-md shrink-0">
                  <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0 space-y-1">
                  <h4 className="font-extrabold text-slate-900 text-sm sm:text-base leading-tight">
                    {userName}
                  </h4>
                  <p className="text-xs text-blue-700 font-medium leading-snug">
                    {userRole}
                  </p>
                  <span className="inline-block text-[10px] font-mono font-bold bg-white text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                    Doc: {userDoc}
                  </span>
                </div>
              </div>

              {/* Informações Pessoais Estruturadas */}
              <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                  <span className="text-slate-500">E-mail Cadastrado:</span>
                  <strong className="text-slate-800 font-mono">{userEmail}</strong>
                </div>
                <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                  <span className="text-slate-500">WhatsApp / Telefone:</span>
                  <strong className="text-slate-800 font-mono">{userPhone}</strong>
                </div>
                <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                  <span className="text-slate-500">Chave PIX Oficial:</span>
                  <strong className="text-emerald-700 font-mono font-bold">{userPix}</strong>
                </div>
                <div className="flex items-center justify-between text-xs py-1">
                  <span className="text-slate-500">Localidade:</span>
                  <span className="text-slate-700 text-right truncate max-w-[200px]">{userAddress}</span>
                </div>
              </div>

              {/* Ações da Camada 3 */}
              <div className="space-y-2 pt-1">
                {onOpenUserSettings && (
                  <button
                    type="button"
                    onClick={() => handleActionAndClose(onOpenUserSettings)}
                    className="w-full py-2.5 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                    <span>Editar Dados Pessoais &amp; Foto</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleActionAndClose(() => onNavigate('perfil'))}
                  className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[17px]">account_box</span>
                  <span>Ver Página Completa de Perfil</span>
                </button>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------- */}
          {/* CAMADA 2: SEÇÃO MINHA CONTA                                */}
          {/* ---------------------------------------------------------- */}
          {activeLayer === 'conta' && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-200/70 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800">
                  Credenciais &amp; Segurança
                </span>
                <h4 className="font-extrabold text-slate-900 text-sm">
                  Configurações da Conta
                </h4>
                <p className="text-xs text-slate-600">
                  Gerencie sua senha, chave de acesso e segurança criptográfica.
                </p>
              </div>

              {/* Cartão de Dados de Segurança */}
              <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                  <span className="text-slate-500">Usuário de Acesso:</span>
                  <span className="font-mono font-bold text-slate-800">{currentUser?.username || 'tiagodias'}</span>
                </div>
                <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                  <span className="text-slate-500">Status da Senha:</span>
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px]">lock</span>
                    Protegida e Criptografada
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                  <span className="text-slate-500">Sessão Atual:</span>
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Ativa no Firebase Firestore
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs py-1">
                  <span className="text-slate-500">Provedor de Login:</span>
                  <span className="uppercase text-[10px] font-bold px-2 py-0.5 bg-slate-100 rounded text-slate-700">
                    {currentUser?.authProvider || 'Local / Seguro'}
                  </span>
                </div>
              </div>

              {/* Ações da Conta */}
              <div className="space-y-2 pt-1">
                {onOpenUserSettings && (
                  <button
                    type="button"
                    onClick={() => handleActionAndClose(onOpenUserSettings)}
                    className="w-full py-2.5 px-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">password</span>
                    <span>Alterar Senha &amp; Chave PIX</span>
                  </button>
                )}

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveLayer('confirm_trocar')}
                    className="py-2 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">switch_account</span>
                    <span>Trocar Conta</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveLayer('confirm_sair')}
                    className="py-2 px-2.5 rounded-xl bg-red-50 hover:bg-red-100 active:scale-95 text-red-700 font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer border border-red-200/50"
                  >
                    <span className="material-symbols-outlined text-[16px]">logout</span>
                    <span>Encerrar Sessão</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------- */}
          {/* CAMADA 2: SEÇÃO EDITAR DEVEDORES                           */}
          {/* ---------------------------------------------------------- */}
          {activeLayer === 'devedores' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              {/* Barra de Pesquisa Rápida */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">
                  search
                </span>
                <input
                  type="text"
                  value={debtorSearch}
                  onChange={(e) => setDebtorSearch(e.target.value)}
                  placeholder="Pesquisar devedor por nome ou telefone..."
                  className="w-full pl-9 pr-8 py-2 bg-slate-100 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 outline-none border border-slate-200 focus:bg-white focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                  autoFocus
                />
                {debtorSearch && (
                  <button
                    type="button"
                    onClick={() => setDebtorSearch('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                )}
              </div>

              {/* Lista Enxuta de Devedores */}
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                {filteredDebtors.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <span className="material-symbols-outlined text-2xl text-slate-400 block mb-1">person_search</span>
                    <p className="text-xs font-semibold">Nenhum devedor encontrado</p>
                    <p className="text-[11px] text-slate-400">Tente buscar por outro termo</p>
                  </div>
                ) : (
                  filteredDebtors.map((d) => (
                    <div
                      key={d.id}
                      className="p-2.5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200/90 shadow-2xs flex items-center justify-between gap-2 transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <SafeDebtorAvatar
                          name={d.name}
                          avatar={d.avatar}
                          size="sm"
                          status={d.overdueCount > 0 ? 'late' : 'ok'}
                        />
                        <div className="min-w-0">
                          <h5 className="font-bold text-xs text-slate-900 truncate">
                            {d.name}
                          </h5>
                          <span className="text-[10px] text-slate-500 truncate block">
                            {d.relation || 'Relacionado'} • Saldo: R$ {d.totalOwed.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {onEditDebtor && (
                          <button
                            type="button"
                            onClick={() => handleActionAndClose(() => onEditDebtor(d))}
                            className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                            title="Editar cadastro do devedor"
                          >
                            <span className="material-symbols-outlined text-[15px]">edit</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleActionAndClose(() => onNavigate('parcelas', d.id))}
                          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-700 text-slate-700 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                          title="Ver parcelas e histórico"
                        >
                          <span className="material-symbols-outlined text-[15px]">receipt_long</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Botões do Rodapé de Devedores */}
              <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                {onOpenNewDebtor && (
                  <button
                    type="button"
                    onClick={() => handleActionAndClose(onOpenNewDebtor)}
                    className="flex-1 py-2 px-3 rounded-xl bg-cyan-700 hover:bg-cyan-800 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[16px]">person_add</span>
                    <span>Novo Devedor</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleActionAndClose(() => onNavigate('devedores'))}
                  className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
                >
                  <span>Módulo Geral</span>
                  <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                </button>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------- */}
          {/* CAMADA 2: SEÇÃO EDITAR CREDOR                              */}
          {/* ---------------------------------------------------------- */}
          {activeLayer === 'credor' && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                  Titular &amp; Dados de Recebimento
                </span>
                <h4 className="font-extrabold text-slate-900 text-sm">
                  Perfil Oficial do Credor
                </h4>
                <p className="text-xs text-slate-600">
                  Estes dados aparecem nos recibos, contratos digitais e liquidações emitidas.
                </p>
              </div>

              {/* Cartão de Informações do Credor */}
              <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                  <span className="text-slate-500">Titular Credor:</span>
                  <strong className="text-slate-900 font-bold">{userName}</strong>
                </div>
                <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                  <span className="text-slate-500">Chave PIX de Recebimento:</span>
                  <strong className="text-emerald-700 font-mono font-bold">{userPix}</strong>
                </div>
                <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                  <span className="text-slate-500">CPF / CNPJ do Credor:</span>
                  <strong className="text-slate-800 font-mono">{userDoc}</strong>
                </div>
                <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                  <span className="text-slate-500">Empresa / Marca:</span>
                  <span className="text-slate-800 font-medium">HASPAHO TI</span>
                </div>
                <div className="flex items-center justify-between text-xs py-1">
                  <span className="text-slate-500">Endereço Comercial:</span>
                  <span className="text-slate-700 text-right truncate max-w-[200px]">{userAddress}</span>
                </div>
              </div>

              {/* Ação de Edição do Credor */}
              <div className="space-y-2 pt-1">
                {onOpenUserSettings && (
                  <button
                    type="button"
                    onClick={() => handleActionAndClose(onOpenUserSettings)}
                    className="w-full py-2.5 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit_note</span>
                    <span>Atualizar Cadastro do Credor &amp; Chave PIX</span>
                  </button>
                )}

                <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                  Os dados do credor são validados com segurança e utilizados na geração de autenticações e comprovantes oficiais.
                </p>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------- */}
          {/* CAMADA 2: SEÇÃO MEUS RELACIONADOS                          */}
          {/* ---------------------------------------------------------- */}
          {activeLayer === 'relacionados' && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              {/* Apresentação Responsável de Organização Financeira */}
              <div className="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-200/70">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800 block">
                  Organização Pessoal
                </span>
                <p className="text-xs text-slate-700 mt-0.5 leading-snug">
                  Gestão transparente de relacionamentos, serviços e compromissos com familiares, amigos e prestadores.
                </p>
              </div>

              {/* Filtros em Abas Rápidas */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
                <button
                  type="button"
                  onClick={() => setRelationFilter('all')}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                    relationFilter === 'all'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Todos ({debtors.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRelationFilter('familia')}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                    relationFilter === 'familia'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Família
                </button>
                <button
                  type="button"
                  onClick={() => setRelationFilter('amigos')}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                    relationFilter === 'amigos'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Amigos
                </button>
                <button
                  type="button"
                  onClick={() => setRelationFilter('trabalho')}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                    relationFilter === 'trabalho'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Trabalho
                </button>
                <button
                  type="button"
                  onClick={() => setRelationFilter('servicos')}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                    relationFilter === 'servicos'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Serviços
                </button>
              </div>

              {/* Lista Filtrada de Relacionados */}
              <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                {relatedPeople.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <span className="material-symbols-outlined text-2xl text-slate-400 block mb-1">diversity_3</span>
                    <p className="text-xs font-semibold">Nenhum relacionado neste grupo</p>
                  </div>
                ) : (
                  relatedPeople.map((p) => (
                    <div
                      key={p.id}
                      className="p-2.5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200/90 shadow-2xs flex items-center justify-between gap-2 transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <SafeDebtorAvatar
                          name={p.name}
                          avatar={p.avatar}
                          size="sm"
                          status="ok"
                        />
                        <div className="min-w-0">
                          <h5 className="font-bold text-xs text-slate-900 truncate">
                            {p.name}
                          </h5>
                          <span className="text-[10px] text-indigo-700 font-medium truncate block">
                            {p.relation || 'Relacionado'} • {p.phone || 'Sem telefone'}
                          </span>
                        </div>
                      </div>

                      {onEditDebtor && (
                        <button
                          type="button"
                          onClick={() => handleActionAndClose(() => onEditDebtor(p))}
                          className="h-7 px-2 rounded-lg bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer shrink-0"
                          title="Editar informações do contato"
                        >
                          <span className="material-symbols-outlined text-[13px]">edit</span>
                          <span>Editar</span>
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Botão Novo Relacionado */}
              {onOpenNewDebtor && (
                <button
                  type="button"
                  onClick={() => handleActionAndClose(onOpenNewDebtor)}
                  className="w-full py-2.5 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">person_add</span>
                  <span>+ Cadastrar Novo Relacionado</span>
                </button>
              )}
            </div>
          )}

          {/* ---------------------------------------------------------- */}
          {/* CONFIRMAÇÃO: TROCAR USUÁRIO                                */}
          {/* ---------------------------------------------------------- */}
          {activeLayer === 'confirm_trocar' && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 text-center space-y-3 animate-in fade-in duration-150">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto shadow-2xs">
                <span className="material-symbols-outlined text-2xl">switch_account</span>
              </div>

              <div className="space-y-1">
                <h4 className="font-extrabold text-slate-900 text-sm sm:text-base">
                  Deseja trocar de usuário?
                </h4>
                <p className="text-xs text-slate-600 max-w-xs mx-auto leading-relaxed">
                  Você poderá entrar com outra conta cadastrada. Todos os dados desta conta permanecem intactos e seguros.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveLayer('root')}
                  className="py-2.5 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onOpenLogin) onOpenLogin();
                  }}
                  className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
                >
                  Trocar usuário
                </button>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------- */}
          {/* CONFIRMAÇÃO: SAIR DA CONTA                                 */}
          {/* ---------------------------------------------------------- */}
          {activeLayer === 'confirm_sair' && (
            <div className="p-4 rounded-2xl bg-red-50/50 border border-red-200/70 text-center space-y-3 animate-in fade-in duration-150">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto shadow-2xs">
                <span className="material-symbols-outlined text-2xl">logout</span>
              </div>

              <div className="space-y-1">
                <h4 className="font-extrabold text-slate-900 text-sm sm:text-base">
                  Deseja encerrar esta sessão?
                </h4>
                <p className="text-xs text-slate-600 max-w-xs mx-auto leading-relaxed">
                  Sua sessão será encerrada com segurança. Você poderá entrar novamente a qualquer momento com sua senha.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveLayer('root')}
                  className="py-2.5 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onLogout) onLogout();
                  }}
                  className="py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
                >
                  Sair
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
