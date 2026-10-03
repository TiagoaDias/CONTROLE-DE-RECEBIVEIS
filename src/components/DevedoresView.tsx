import React, { useState, useMemo } from 'react';
import { Debtor, Installment, Purchase, ScreenTab, generateAuthCode } from '../types';
import { SafeDebtorAvatar, getItemIcon } from './DebtorsMasterSpreadsheet';
import { getCardBadgeInfo } from './ParcelasView';
import { HaspahoLogo } from './HaspahoLogo';
import { DebtorUnitaryItemsModal } from './DebtorUnitaryItemsModal';
import { getDebtorUnitaryItems, getProductCategory } from '../utils/debtorItemsUtils';
import { CosmicMoonRocket } from './CosmicMoonRocket';
import { CardMeteor } from './CardMeteor';
import { WhatsAppIcon } from './WhatsAppIcon';
import { safeToFixed, safeFormatCurrency, safeToNumber } from '../utils/numberUtils';

interface DevedoresViewProps {
  debtors: Debtor[];
  purchases: Purchase[];
  installments: Installment[];
  onNavigate: (tab: ScreenTab, targetId?: string, extraId?: string) => void;
  onOpenNewPurchaseForDebtor: (debtorId: string) => void;
  onOpenNewDebtor: () => void;
  onEditDebtor?: (debtor: Debtor) => void;
  onOpenContract?: (debtorId: string) => void;
  onOpenExtratoTotal?: (purchaseId?: string, debtorId?: string) => void;
  onOpenGeminiScanner?: () => void;
  onNudgeWhatsApp: (name: string, amount: string, item: string, parcel: string, phone?: string) => void;
  onSettleInstallment: (inst: Installment) => void;
  onDeleteInstallment: (id: string) => void;
  onShowProof?: (
    payer: string,
    amount: string,
    date: string,
    dest: string,
    auth: string,
    item: string
  ) => void;
  onToast: (msg: string) => void;
  searchQuery?: string;
  theme?: 'light' | 'dark';
}

export const DevedoresView: React.FC<DevedoresViewProps> = ({
  debtors,
  purchases,
  installments,
  onNavigate,
  onOpenNewPurchaseForDebtor,
  onOpenNewDebtor,
  onEditDebtor,
  onOpenContract,
  onOpenExtratoTotal,
  onOpenGeminiScanner,
  onNudgeWhatsApp,
  onSettleInstallment,
  onDeleteInstallment = () => {},
  onShowProof,
  onToast: _onToast,
  searchQuery = '',
  theme = 'light',
}) => {
  const isDark = theme === 'dark';
  const [localSearch, setLocalSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'adimplente' | 'inadimplente' | 'quitado'>('all');
  const [displayMode, setDisplayMode] = useState<'deck' | 'grid'>('deck');
  const [activeDebtorId, setActiveDebtorId] = useState<string | null>(
    () => (debtors.length > 0 ? debtors[0].id : null)
  );
  const [expandedDebtorId, setExpandedDebtorId] = useState<string | null>(
    () => (debtors.length > 0 ? debtors[0].id : null)
  );
  const [selectedItemIdByDebtor, setSelectedItemIdByDebtor] = useState<Record<string, string>>({});

  React.useEffect(() => {
    if (debtors.length > 0 && !activeDebtorId) {
      setActiveDebtorId(debtors[0].id);
      setExpandedDebtorId(debtors[0].id);
    }
  }, [debtors, activeDebtorId]);

  // Estado para Modal de Detalhes dos Itens Unitários
  const [isUnitaryModalOpen, setIsUnitaryModalOpen] = useState(false);
  const [selectedDebtorForUnitary, setSelectedDebtorForUnitary] = useState<Debtor | null>(null);
  const [initialUnitaryItemId, setInitialUnitaryItemId] = useState<string | undefined>(undefined);

  const handleOpenUnitaryModal = (debtor: Debtor, initialItemId?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedDebtorForUnitary(debtor);
    setInitialUnitaryItemId(initialItemId);
    setIsUnitaryModalOpen(true);
  };

  const toggleDebtorExpanded = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveDebtorId(id);
    setExpandedDebtorId((prev) => (prev === id ? null : id));
  };

  // Filter debtors
  const filteredDebtors = useMemo(() => {
    const q = (searchQuery || localSearch).trim().toLowerCase();
    return debtors.filter((d) => {
      const matchesSearch =
        !q ||
        d.name.toLowerCase().includes(q) ||
        (d.phone && d.phone.toLowerCase().includes(q)) ||
        (d.cpfCnpj && d.cpfCnpj.toLowerCase().includes(q)) ||
        (d.city && d.city.toLowerCase().includes(q));

      const hasOverdue = (d.overdueCount || 0) > 0;
      const isPaidOff = d.totalOwed <= 0;

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'adimplente' && !hasOverdue && !isPaidOff) ||
        (statusFilter === 'inadimplente' && hasOverdue) ||
        (statusFilter === 'quitado' && isPaidOff);

      return matchesSearch && matchesStatus;
    });
  }, [debtors, searchQuery, localSearch, statusFilter]);

  // Selected debtor for primary card
  const selectedPrimaryDebtor = useMemo(() => {
    if (activeDebtorId) {
      const found = filteredDebtors.find((d) => d.id === activeDebtorId);
      if (found) return found;
    }
    return filteredDebtors.length > 0 ? filteredDebtors[0] : null;
  }, [filteredDebtors, activeDebtorId]);

  // Totals for header badges
  const totalDebtorsCount = debtors.length;
  const overdueDebtorsCount = debtors.filter((d) => (d.overdueCount || 0) > 0).length;
  const onTimeDebtorsCount = totalDebtorsCount - overdueDebtorsCount;

  return (
    <div className={`flex flex-col w-full gap-4 pb-24 ${isDark ? 'text-white' : 'text-slate-850'}`}>
      {/* 3. Lista / Deck de Devedores */}
      {filteredDebtors.length === 0 ? (
        <div className={`${isDark ? 'bg-black border-cyan-900' : 'bg-white/80 border-white/60'} backdrop-blur-xl rounded-3xl p-12 text-center shadow-2xl`}>
          <div className={`w-14 h-14 rounded-2xl ${isDark ? 'bg-slate-900 text-cyan-500' : 'bg-blue-50 text-blue-600'} flex items-center justify-center mx-auto mb-3`}>
            <span className="material-symbols-outlined text-3xl">group_off</span>
          </div>
          <h3 className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'} text-base`}>Nenhum devedor encontrado</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery || localSearch
              ? 'Tente ajustar os termos de busca ou filtros aplicados.'
              : 'Nenhum devedor cadastrado nesta conta. Clique em "Novo Devedor" para iniciar seu cadastro.'}
          </p>
          <button
            onClick={onOpenNewDebtor}
            className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs"
          >
            Cadastrar Primeiro Devedor
          </button>
        </div>
      ) : displayMode === 'deck' ? (
        /* ============================================================ */
        /* MODO DECK: CARD DO DEVEDOR À ESQUERDA & LISTA À DIREITA      */
        /* ============================================================ */
        <div className="w-full flex flex-col gap-4">
           {/* Grid Principal: Esquerda (Card do Devedor + Seletor) & Direita (Planilha Financeira idêntica ao print) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            
            {/* ============================================================ */}
            {/* COLUNA ESQUERDA: CARD DO DEVEDOR & SELETOR DE PESSOAS        */}
            {/* ============================================================ */}
            <div className="lg:col-span-4 xl:col-span-4 flex flex-col gap-3.5 sticky top-4">
              
              {/* Seletor Rápido de Devedores em Cascata Compacta */}
              <div className="bg-white/95 p-3 sm:p-3.5 rounded-3xl border border-slate-200/90 shadow-sm flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs pb-1.5 border-b border-slate-100">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5 text-[11px]">
                    <span className="material-symbols-outlined text-[15px] text-cyan-600">badge</span>
                    <span>Devedores ({filteredDebtors.length}):</span>
                  </span>
                  <button
                    type="button"
                    onClick={onOpenNewDebtor}
                    className="text-[10px] text-blue-600 font-extrabold hover:underline flex items-center gap-0.5"
                  >
                    <span>+ Novo</span>
                  </button>
                </div>

                {/* Lista compacta sobreposta de seleção */}
                <div className="flex flex-col gap-1 max-h-40 overflow-y-auto pr-0.5 custom-scrollbar">
                  {filteredDebtors.map((d) => {
                    const isSelected = selectedPrimaryDebtor?.id === d.id;
                    const dHasOverdue = (d.overdueCount || 0) > 0;
                    const dIsPaid = d.totalOwed <= 0;

                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          setActiveDebtorId(d.id);
                          setExpandedDebtorId(d.id);
                          // Auto scroll to top on selection
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className={`w-full p-2 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2 text-left select-none ${
                          isSelected
                            ? 'bg-gradient-to-r from-cyan-50 via-blue-50/60 to-white border-cyan-400 text-slate-900 shadow-sm ring-1 ring-cyan-400/50'
                            : 'bg-white hover:bg-slate-50 border-slate-200/80 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <SafeDebtorAvatar
                            name={d.name}
                            avatar={d.avatar}
                            size="xs"
                            status={dHasOverdue ? 'late' : 'ok'}
                            className="shrink-0"
                          />
                          <div className="min-w-0 leading-none">
                            <span className="text-xs font-bold text-slate-900 truncate block">
                              {d.name}
                            </span>
                            <span className="text-[9.5px] text-slate-400 mt-0.5 block">
                              {d.relation || 'Cliente'}
                            </span>
                          </div>
                        </div>

                        <span className={`text-[10.5px] font-mono font-bold shrink-0 ${
                          dIsPaid ? 'text-emerald-600' : dHasOverdue ? 'text-red-600' : 'text-slate-800'
                        }`}>
                          R$ {d.totalOwed.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* CARD DO DEVEDOR SELECIONADO (QUADRADO COMPACTO) */}
              {selectedPrimaryDebtor ? (
                (() => {
                  const debtor = selectedPrimaryDebtor;
                  const hasOverdue = (debtor.overdueCount || 0) > 0;
                  const isPaidOff = debtor.totalOwed <= 0;
                  const debtorInstallments = installments.filter((i) => i.debtorId === debtor.id);
                  const paidCount = debtorInstallments.filter((i) => i.status === 'paid').length;
                  const totalCount = debtorInstallments.length;
                  const debtorUnitaryItems = getDebtorUnitaryItems(debtor.id, debtor.name, purchases, installments);
                  const rawSelectedItemId = selectedItemIdByDebtor[debtor.id];
                  const currentSelectedItem = debtorUnitaryItems.length > 0
                    ? debtorUnitaryItems.find((it) => it.id === rawSelectedItemId) || debtorUnitaryItems[0]
                    : null;

                  return (
                    <div className="relative bg-white/95 p-4 rounded-3xl border border-cyan-300/70 shadow-md flex flex-col gap-3 overflow-hidden select-none animate-in fade-in zoom-in-95 duration-200">
                      <CosmicMoonRocket variant="ambient" />

                      {/* Topo do Bloco do Card */}
                      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200 relative z-10">
                        <span className="text-[11px] font-black uppercase tracking-wider text-cyan-800 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[15px]">badge</span>
                          <span>Card do Devedor</span>
                        </span>
                        <div className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200" title="Verificado">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span className="text-[9px] font-black text-slate-600 uppercase">Ativo</span>
                        </div>
                      </div>

                      {/* Foto e Nome */}
                      <div className="flex items-center gap-3 relative z-10">
                        <SafeDebtorAvatar
                          name={debtor.name}
                          avatar={debtor.avatar}
                          size="md"
                          status={hasOverdue ? 'late' : 'ok'}
                          className="shrink-0 ring-2 ring-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.7)]"
                        />
                        <div className="flex flex-col min-w-0 leading-tight">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="font-black text-slate-900 text-base truncate">
                              {debtor.name}
                            </h3>
                            <span className="w-3.5 h-3.5 rounded-full bg-[#1d9bf0] text-white flex items-center justify-center text-[8.5px] font-black shrink-0">
                              ✓
                            </span>
                          </div>
                          <span className="text-[10.5px] text-slate-500 font-medium truncate mt-0.5">
                            {debtor.relation || 'Cliente'} • {totalCount} parcelas ({paidCount} pagas)
                          </span>
                        </div>
                      </div>

                      {/* Dados Cadastrais, WhatsApp, PIX */}
                      <div className="bg-slate-50/80 p-2.5 rounded-2xl border border-slate-200/80 flex flex-col gap-1.5 text-xs relative z-10">
                        <div className="flex items-center justify-between gap-1 flex-wrap text-[11px]">
                          <span className="text-slate-600">
                            Vínculo: <strong className="text-slate-900 font-bold">{debtor.relation || 'Cliente'}</strong>
                          </span>
                          {debtor.cpfCnpj && (
                            <span className="text-slate-500 font-mono text-[10.5px]">
                              Doc: <strong className="text-slate-800">{debtor.cpfCnpj}</strong>
                            </span>
                          )}
                        </div>

                        {debtor.pixKey && (
                          <div className="text-[11px] text-slate-600 truncate">
                            PIX: <strong className="text-emerald-700 font-mono">{debtor.pixKey}</strong>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60">
                          <span className="text-amber-700 font-semibold flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px]">calendar_today</span>
                            <span>Próx: <strong className="text-slate-900 font-mono">{debtor.nextDueDate || '10/10/2026'}</strong></span>
                          </span>

                          {debtor.phone && (
                            <span className="text-slate-600 font-mono text-[10.5px]">
                              {debtor.phone}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Resumo Financeiro */}
                      <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between text-xs relative z-10">
                        <div>
                          <span className="text-[10px] text-slate-500 block font-semibold">
                            {currentSelectedItem ? `Saldo (${currentSelectedItem.shortName})` : 'Saldo Total'}
                          </span>
                          <span className="text-lg font-black text-amber-600 font-mono">
                            {currentSelectedItem
                              ? currentSelectedItem.isPaidOff
                                ? 'R$ 0,00'
                                : `R$ ${currentSelectedItem.remainingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                              : isPaidOff
                              ? 'R$ 0,00'
                              : `R$ ${debtor.totalOwed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 block font-semibold">Situação</span>
                          <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full border inline-block ${
                            hasOverdue
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : isPaidOff
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            {hasOverdue ? `${debtor.overdueCount} atrasadas` : isPaidOff ? 'Quitado' : 'Em dia'}
                          </span>
                        </div>
                      </div>

                      {/* Ações Rápidas do Card */}
                      <div className="pt-2 border-t border-slate-200 grid grid-cols-3 gap-1.5 relative z-10">
                        <button
                          type="button"
                          onClick={() => onOpenNewPurchaseForDebtor(debtor.id)}
                          className="h-8 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10.5px] flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">add_shopping_cart</span>
                          <span>+ Parcela</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleOpenUnitaryModal(debtor, undefined, e)}
                          className="h-8 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[10.5px] flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">devices</span>
                          <span>Itens</span>
                        </button>

                        {debtor.phone ? (
                          <button
                            type="button"
                            onClick={() => onNudgeWhatsApp(
                              debtor.name,
                              `R$ ${safeToFixed(debtor.totalOwed)}`,
                              'Parcelas em aberto',
                              'Atual',
                              debtor.phone
                            )}
                            className="h-8 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10.5px] flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[14px]">chat</span>
                            <span>WhatsApp</span>
                          </button>
                        ) : onOpenContract ? (
                          <button
                            type="button"
                            onClick={() => onOpenContract(debtor.id)}
                            className="h-8 rounded-xl bg-purple-700 hover:bg-purple-600 text-white font-bold text-[10.5px] flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[14px]">history_edu</span>
                            <span>Contrato</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onEditDebtor?.(debtor)}
                            className="h-8 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-[10.5px] flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[14px]">edit</span>
                            <span>Editar</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()
              ) : null}
            </div>

            {/* ============================================================ */}
            {/* COLUNA DIREITA: PLANILHA FINANCEIRA IDÊNTICA AO PRINT        */}
            {/* ============================================================ */}
            <div className="lg:col-span-8 xl:col-span-8 flex flex-col gap-3">
              {selectedPrimaryDebtor ? (
                (() => {
                  const debtor = selectedPrimaryDebtor;
                  const debtorInstallments = installments.filter((i) => i.debtorId === debtor.id);
                  const rawSelectedItemId = selectedItemIdByDebtor[debtor.id];
                  const debtorUnitaryItems = getDebtorUnitaryItems(debtor.id, debtor.name, purchases, installments);
                  const currentSelectedItem = debtorUnitaryItems.length > 0
                    ? debtorUnitaryItems.find((it) => it.id === rawSelectedItemId) || debtorUnitaryItems[0]
                    : null;

                  const displayedInstallments = (currentSelectedItem
                    ? debtorInstallments.filter((inst) => {
                        return (
                          currentSelectedItem.installments.some((itInst) => itInst.id === inst.id) ||
                          inst.purchaseId === currentSelectedItem.purchaseId ||
                          inst.product === currentSelectedItem.productName
                        );
                      })
                    : debtorInstallments
                  ).sort((a, b) => {
                    const numA = Number(a.installmentNumber) || 0;
                    const numB = Number(b.installmentNumber) || 0;
                    if (numA !== numB) return numA - numB;
                    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                  });

                  return (
                    <div className="bg-white/95 rounded-3xl border border-slate-200 shadow-lg p-3 sm:p-4 flex flex-col gap-3 text-slate-900 select-none">
                      
                      {/* Topo da Planilha Financeira */}
                      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-200 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block shadow-xs" />
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                            Planilha Financeira • Item: {currentSelectedItem?.productName || currentSelectedItem?.shortName || 'Item Selecionado'} ({displayedInstallments.length} parcelas)
                          </h4>
                        </div>

                        {/* Filtros de Itens Específicos */}
                        <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] select-none scrollbar-none">
                          {debtorUnitaryItems.map((it) => {
                            const isSelected = currentSelectedItem?.id === it.id;
                            return (
                              <button
                                key={it.id}
                                type="button"
                                onClick={() => setSelectedItemIdByDebtor((prev) => ({ ...prev, [debtor.id]: it.id }))}
                                className={`px-2.5 py-1 rounded-xl font-bold transition-all cursor-pointer border flex items-center gap-1 ${
                                  isSelected
                                    ? 'bg-cyan-500 text-slate-950 border-cyan-300 font-extrabold shadow-2xs'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[12px]">{it.icon}</span>
                                <span>{it.shortName}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 1. VISUALIZAÇÃO MOBILE OTIMIZADA: CARDS INDIVIDUAIS LIMPOS (Zero colisão/sobreposição) */}
                      <div className="flex flex-col gap-2.5 sm:hidden">
                        {displayedInstallments.length === 0 ? (
                          <div className="py-8 text-center text-slate-400 text-xs">
                            Nenhum registro encontrado para este filtro.
                          </div>
                        ) : (
                          displayedInstallments.map((inst, instIdx) => {
                            const isPaid = inst.status === 'paid';
                            const isLate = inst.status === 'overdue' || (inst.delayDays || 0) > 0;
                            const instAmount = inst.amount || inst.originalAmount || 0;
                            const itemIconName = getItemIcon(inst.product);
                            const authCode = inst.authCode || generateAuthCode();

                            return (
                              <div
                                key={inst.id || instIdx}
                                className={`p-3 rounded-2xl border transition-all flex flex-col gap-2.5 shadow-2xs ${
                                  isPaid
                                    ? 'bg-slate-50/80 border-emerald-200/90'
                                    : isLate
                                    ? 'bg-rose-50/50 border-rose-200'
                                    : 'bg-white border-slate-200'
                                }`}
                              >
                                {/* Linha 1: Parcela, Vencimento & Badge Situação */}
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-black font-mono px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800 border border-slate-200">
                                      {inst.installmentNumber}/{inst.totalInstallments}
                                    </span>
                                    <div className="flex items-center gap-1 text-[11px] font-mono text-slate-600">
                                      <span className="material-symbols-outlined text-[13px] text-slate-500">calendar_today</span>
                                      <span>{inst.dueDate}</span>
                                    </div>
                                  </div>

                                  {/* Badge de Situação */}
                                  {isPaid ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-emerald-300 bg-emerald-100/80 text-emerald-800 font-bold text-[10.5px]">
                                      <span className="material-symbols-outlined text-[12px]">check_circle</span>
                                      <span>PAGO</span>
                                    </span>
                                  ) : isLate ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-red-300 bg-red-100/80 text-red-800 font-bold text-[10.5px] animate-pulse">
                                      <span className="material-symbols-outlined text-[12px]">warning</span>
                                      <span>ATRASADA</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-amber-300 bg-amber-100/80 text-amber-800 font-bold text-[10.5px]">
                                      <span>A VENCER</span>
                                    </span>
                                  )}
                                </div>

                                {/* Linha 2: Produto / Item e Valor */}
                                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0">
                                      <span className="material-symbols-outlined text-[16px]">{itemIconName}</span>
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-xs font-bold text-slate-800 truncate" title={inst.product}>
                                        {inst.product}
                                      </span>
                                      <span className="text-[10px] text-slate-400 truncate">
                                        {inst.cardName || 'Nubank Croma'}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="text-right shrink-0">
                                    <span className="text-xs font-mono font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                                      R$ {instAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                </div>

                                {/* Linha 3: Ações Rápidas */}
                                <div className="flex items-center justify-end gap-2 pt-1.5 border-t border-slate-100">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (isPaid && onShowProof) {
                                        onShowProof(
                                          debtor.name,
                                          `R$ ${safeToFixed(instAmount, 2)}`,
                                          inst.paidAt || inst.dueDate || 'Hoje',
                                          inst.paymentMethod || 'PIX / Banco',
                                          authCode,
                                          `${inst.product} (Parcela ${inst.installmentNumber}/${inst.totalInstallments})`
                                        );
                                      } else {
                                        onSettleInstallment(inst);
                                      }
                                    }}
                                    className="flex-1 py-1.5 px-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95"
                                    title={isPaid ? "Visualizar Recibo de Pagamento" : "Ver detalhes da situação / Quitar ou Pagar"}
                                  >
                                    <span className="material-symbols-outlined text-[16px]">visibility</span>
                                  </button>

                                  {!isPaid && debtor.phone && (
                                    <button
                                      type="button"
                                      onClick={() => onNudgeWhatsApp(
                                        debtor.name,
                                        `R$ ${safeToFixed(instAmount, 2)}`,
                                        `Parcela ${inst.installmentNumber}/${inst.totalInstallments} (${inst.product})`,
                                        inst.dueDate,
                                        debtor.phone
                                      )}
                                      className="py-1.5 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-2xs"
                                    >
                                      <WhatsAppIcon className="w-4 h-4 text-emerald-400" size={15} />
                                      <span>WhatsApp</span>
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteInstallment(inst.id);
                                    }}
                                    className="py-1.5 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-bold text-xs flex items-center justify-center cursor-pointer transition-all active:scale-95"
                                    title="Excluir Parcela"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">delete</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* 2. VISUALIZAÇÃO DESKTOP / TABLET (Tabela com largura mínima garantida) */}
                      <div className="hidden sm:block w-full overflow-x-auto no-scrollbar">
                        <table className="w-full min-w-[720px] text-center text-xs border-collapse">
                          <thead>
                            <tr className="text-slate-600 font-bold uppercase text-[9.5px] sm:text-[10px] tracking-wider border-b border-slate-200 select-none">
                              <th className="py-2.5 px-2 text-center whitespace-nowrap">PARCELAS / VENC.</th>
                              <th className="py-2.5 px-2 text-center whitespace-nowrap">DEVEDOR</th>
                              <th className="py-2.5 px-2 text-center whitespace-nowrap">ITEM / DESC.</th>
                              <th className="py-2.5 px-2 text-center whitespace-nowrap">CARTÃO / FORMA</th>
                              <th className="py-2.5 px-2 text-center whitespace-nowrap">VALOR</th>
                              <th className="py-2.5 px-2 text-center whitespace-nowrap">SITUAÇÃO</th>
                              <th className="py-2.5 px-2 text-center whitespace-nowrap">AÇÕES</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-sans">
                            {displayedInstallments.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                                  Nenhum registro encontrado para este filtro.
                                </td>
                              </tr>
                            ) : (
                              displayedInstallments.map((inst, instIdx) => {
                                const isPaid = inst.status === 'paid';
                                const isLate = inst.status === 'overdue' || (inst.delayDays || 0) > 0;
                                const instAmount = inst.amount || inst.originalAmount || 0;
                                const itemIconName = getItemIcon(inst.product);
                                const cardBadge = getCardBadgeInfo(inst.cardName);
                                const authCode = inst.authCode || generateAuthCode();

                                return (
                                  <tr
                                    key={inst.id || instIdx}
                                    className={`transition-all duration-150 border-b border-slate-100/90 ${
                                      isPaid
                                        ? 'bg-slate-50/40 hover:bg-slate-50/80'
                                        : isLate
                                        ? 'bg-rose-50/30 hover:bg-rose-50/60'
                                        : 'bg-white hover:bg-slate-50/50'
                                    }`}
                                  >
                                    {/* 1. PARCELAS / VENC. com linha vertical e ponto luminoso */}
                                    <td className="py-3 pl-4 pr-2 text-center align-middle whitespace-nowrap">
                                      <div className="flex items-center gap-2 justify-center">
                                        {/* Ramificação tracejada vertical com ponto ciano brilhante */}
                                        <div className="relative w-4 self-stretch min-h-[44px] flex items-center justify-center shrink-0">
                                          <div className="absolute top-0 bottom-0 left-2 w-[1.5px] border-l-2 border-dashed border-cyan-400/50" />
                                          <div className="absolute top-1/2 left-2 -translate-x-[2px] -translate-y-[2px] w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] z-10" />
                                        </div>

                                        <div className="flex flex-col items-center justify-center gap-1">
                                          <span className="text-[10px] font-bold text-slate-600 font-mono">
                                            {inst.installmentNumber}/{inst.totalInstallments}
                                          </span>
                                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-slate-250 bg-white text-slate-700 text-[10px] font-mono shadow-2xs">
                                            <span className="material-symbols-outlined text-[12px] text-slate-500">calendar_today</span>
                                            <span>{inst.dueDate}</span>
                                          </div>
                                        </div>
                                      </div>
                                    </td>

                                    {/* 2. DEVEDOR com foto e nome embaixo */}
                                    <td className="py-3 px-2 text-center align-middle whitespace-nowrap">
                                      <div className="flex flex-col items-center justify-center gap-1">
                                        <div className="relative inline-flex items-center justify-center">
                                          <SafeDebtorAvatar
                                            name={inst.debtorName || debtor.name}
                                            avatar={debtor.avatar}
                                            size="sm"
                                            status={isLate ? 'late' : 'ok'}
                                            className="ring-2 ring-cyan-300"
                                          />
                                          <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[8px] font-black ring-1 ring-white">
                                            ✓
                                          </span>
                                        </div>
                                        <span className="inline-block px-2 py-0.2 rounded-md bg-slate-100 text-slate-800 text-[10px] font-bold">
                                          {(inst.debtorName || debtor.name).split(' ')[0]}
                                        </span>
                                      </div>
                                    </td>

                                    {/* 3. ITEM / DESCRIÇÃO em caixa contornada */}
                                    <td className="py-3 px-2 text-center align-middle whitespace-nowrap">
                                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-800 font-bold text-[11px] shadow-2xs max-w-[170px]">
                                        <span className="material-symbols-outlined text-[15px] text-slate-600 shrink-0">
                                          {itemIconName}
                                        </span>
                                        <span className="truncate" title={inst.product}>{inst.product}</span>
                                      </div>
                                    </td>

                                    {/* 4. CARTÃO / FORMA em badge roxo/destaque */}
                                    <td className="py-3 px-2 text-center align-middle whitespace-nowrap">
                                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-200 bg-purple-50/60 text-purple-700 font-bold text-[11px]">
                                        <span className="material-symbols-outlined text-[15px] text-purple-600">credit_card</span>
                                        <span className="truncate max-w-[110px]">{inst.cardName || 'Nubank Croma'}</span>
                                      </div>
                                    </td>

                                    {/* 5. VALOR & AÇÃO com valor verde e botão Recibo / Baixar */}
                                    <td className="py-3 px-2 text-center align-middle whitespace-nowrap">
                                      <div className="flex items-center justify-center">
                                        <div className={`inline-flex items-center px-2 py-0.5 rounded-md font-mono text-[11px] font-bold border ${
                                          isPaid 
                                            ? 'bg-emerald-50 border-emerald-250 text-emerald-700' 
                                            : isLate 
                                            ? 'bg-red-50 border-red-250 text-red-700' 
                                            : 'bg-blue-50 border-blue-250 text-blue-700'
                                        }`}>
                                          R$ {instAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </div>
                                      </div>
                                      {/* Removido botões daqui */}
                                      <div className="hidden">
                                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                          {/* botões removidos */}
                                        </div>
                                      </div>
                                    </td>

                                    {/* 6. SITUAÇÃO */}
                                    <td className="py-3 px-2 text-center align-middle whitespace-nowrap">
                                      {isPaid ? (
                                        <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                                          <span className="material-symbols-outlined text-[12px]">check_circle</span>
                                          <span>PAGO</span>
                                        </div>
                                      ) : isLate ? (
                                        <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border border-red-300 bg-red-50 text-red-700 font-bold text-[10px] animate-pulse">
                                          <span className="material-symbols-outlined text-[12px]">warning</span>
                                          <span>ATRASADA</span>
                                        </div>
                                      ) : (
                                        <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 font-bold text-[10px]">
                                          <span>A VENCER</span>
                                        </div>
                                      )}
                                    </td>

                                    {/* 7. AÇÕES */}
                                    <td className="py-3 px-2 text-center align-middle whitespace-nowrap">
                                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (isPaid && onShowProof) {
                                              onShowProof(
                                                inst.debtorName || debtor.name,
                                                `R$ ${instAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                                                inst.paidAt || inst.dueDate || 'Hoje',
                                                inst.paymentMethod || 'PIX / Banco',
                                                authCode,
                                                `${inst.product} (Parcela ${inst.installmentNumber}/${inst.totalInstallments})`
                                              );
                                            } else {
                                              onSettleInstallment(inst);
                                            }
                                          }}
                                          className="w-8 h-8 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center transition-colors cursor-pointer shadow-xs active:scale-95"
                                          title={isPaid ? "Visualizar Recibo de Pagamento" : "Ver detalhes da situação / Quitar ou Pagar"}
                                        >
                                          <span className="material-symbols-outlined text-[18px]">visibility</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteInstallment(inst.id);
                                          }}
                                          className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center transition-colors cursor-pointer shadow-xs active:scale-95"
                                          title="Excluir parcela permanentemente"
                                        >
                                          <span className="material-symbols-outlined text-[18px]">delete</span>
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="bg-white/95 rounded-3xl border border-slate-200 p-8 text-center text-slate-500">
                  Selecione um devedor na coluna da esquerda para exibir a planilha financeira correspondente.
                </div>
              )}
            </div>

          </div>
        </div>
      ) : (
        /* ============================================================ */
        /* MODO GRADE GERAL TRADICIONAL                                 */
        /* ============================================================ */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredDebtors.map((debtor, index) => {
            const debtorInstallments = installments.filter((i) => i.debtorId === debtor.id);
            const hasOverdue = (debtor.overdueCount || 0) > 0;
            const isPaidOff = debtor.totalOwed <= 0;
            const paidCount = debtorInstallments.filter((i) => i.status === 'paid').length;
            const totalCount = debtorInstallments.length;
            const debtorUnitaryItems = getDebtorUnitaryItems(debtor.id, debtor.name, purchases, installments);
            const rawSelectedItemId = selectedItemIdByDebtor[debtor.id];
            const isItemFilterActive = Boolean(rawSelectedItemId && rawSelectedItemId !== 'all');
            const currentSelectedItem = isItemFilterActive
              ? debtorUnitaryItems.find((it) => it.id === rawSelectedItemId) || null
              : null;

            return (
              <div
                key={debtor.id}
                className="debtor-card-container bg-white/95 backdrop-blur-md rounded-3xl border border-slate-200/80 shadow-md p-4 sm:p-5 flex flex-col justify-between hover:border-cyan-400 hover:shadow-lg transition-all text-slate-900 relative overflow-hidden group"
              >
                <CardMeteor variant={index % 2 === 0 ? 'cyan' : 'amber'} />
                {/* Efeito de preenchimento (gradient) suave no fundo */}
                <div className="absolute inset-0 bg-radial from-blue-100/5 via-cyan-50/5 to-transparent opacity-80 pointer-events-none z-0" />
                
                {/* Marca d'água sutil e transparente da logo HASPAHO no canto inferior direito */}
                <div className="absolute -bottom-3 -right-3 opacity-[0.07] group-hover:opacity-[0.14] transition-opacity pointer-events-none select-none z-0 scale-125 transform rotate-6">
                  <HaspahoLogo size="lg" variant="icon" />
                </div>

                <div className="relative z-1">
                  {/* Cabeçalho / Cartão de Visita do Devedor */}
                  <div className="flex items-start gap-3.5">
                    <SafeDebtorAvatar
                      name={debtor.name}
                      avatar={debtor.avatar}
                      size="lg"
                      status={hasOverdue ? 'late' : 'ok'}
                    />

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-black text-slate-900 text-base sm:text-lg leading-tight truncate">
                          {debtor.name}
                        </h3>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            hasOverdue
                              ? 'bg-red-50 text-red-750 border-red-200'
                              : isPaidOff
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {hasOverdue
                            ? `⚠️ ${debtor.overdueCount} em atraso`
                            : isPaidOff
                            ? '🏆 Quitado'
                            : '✅ Situação Regular'}
                        </span>
                      </div>

                      {/* Botão de Editar e Ações */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {onEditDebtor && (
                          <button
                            type="button"
                            onClick={() => onEditDebtor(debtor)}
                            className="h-6 px-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-700 hover:text-slate-900 text-[11px] font-bold inline-flex items-center gap-1 transition-all cursor-pointer border border-slate-200 shadow-2xs"
                            title="Editar dados cadastrais, telefone e vínculo"
                          >
                            <span className="material-symbols-outlined text-[13px]">edit</span>
                            <span>Editar</span>
                          </button>
                        )}
                      </div>

                      {/* WhatsApp do Devedor */}
                      <div className="text-xs text-slate-600 font-medium">
                        {debtor.phone ? `WhatsApp: ${debtor.phone}` : 'Sem WhatsApp cadastrado'}
                      </div>

                      {/* Data de Vencimento debaixo do Devedor */}
                      <div className="flex items-center gap-1.5 text-xs text-amber-700 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-200 w-fit">
                        <span className="material-symbols-outlined text-[13px] text-amber-600">calendar_today</span>
                        <span>Próx. Vencimento: <strong className="font-mono text-slate-900">{debtor.nextDueDate || '10/10/2026'}</strong></span>
                      </div>

                      {/* Vínculo e Documento */}
                      <div className="flex items-center gap-2 flex-wrap text-xs text-slate-600 pt-0.5">
                        <span className="inline-flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200 text-slate-700">
                          <span className="text-slate-400">Vínculo:</span>
                          <strong className="text-slate-900 font-semibold">{debtor.relation || 'Cliente'}</strong>
                        </span>
                        {debtor.cpfCnpj && (
                          <span className="text-slate-500 text-[11px]">
                            Doc: <span className="text-slate-700 font-semibold">{debtor.cpfCnpj}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Resumo Financeiro no Cartão */}
                  <div className="mt-3.5 pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[11px] text-slate-500 block font-medium">
                        {currentSelectedItem ? `Saldo do Item` : 'Saldo Restante (Total)'}
                      </span>
                      <span className="text-base font-black text-amber-600 font-mono">
                        {currentSelectedItem
                          ? currentSelectedItem.isPaidOff
                            ? 'R$ 0,00'
                            : `R$ ${currentSelectedItem.remainingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                          : isPaidOff
                          ? 'R$ 0,00'
                          : `R$ ${debtor.totalOwed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                      </span>
                    </div>

                    {/* Exibição das Parcelas do Item Desejado */}
                    <div className="text-right">
                      <span className="text-[11px] text-slate-400 block font-medium">
                        {currentSelectedItem ? `Parcelas • Item` : 'Parcelas (Total)'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (currentSelectedItem) {
                            onNavigate('parcelas', debtor.id, currentSelectedItem.purchaseId || currentSelectedItem.id || currentSelectedItem.productName);
                          } else {
                            onNavigate('parcelas', debtor.id);
                          }
                        }}
                        className="group/btn inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 hover:text-white transition-all cursor-pointer shadow-2xs active:scale-95"
                        title={currentSelectedItem ? `Abrir parcelas de ${currentSelectedItem.productName} no sistema` : 'Abrir parcelas no sistema'}
                      >
                        <span className="material-symbols-outlined text-[14px] text-cyan-300 group-hover/btn:scale-110 transition-transform">
                          {currentSelectedItem ? currentSelectedItem.icon : 'devices'}
                        </span>
                        <span className="font-extrabold text-xs font-mono">
                          {currentSelectedItem
                            ? `${currentSelectedItem.paidInstallments} de ${currentSelectedItem.totalInstallments} pagas`
                            : `${paidCount} de ${totalCount} pagas`}
                        </span>
                      </button>
                    </div>
                  </div>

                  </div>

                  {/* Grade de Ações do Devedor Simplificada */}
                  <div className="mt-4 pt-3 border-t border-slate-200 flex flex-col gap-2">
                    {onOpenGeminiScanner && (
                      <button
                        type="button"
                        onClick={onOpenGeminiScanner}
                        className="w-full h-9 px-3 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                        title="Reconhecimento de IA (Gemini): Ler Contrato, Recibo ou Comprovante"
                      >
                        <span className="material-symbols-outlined text-[16px] text-amber-300">auto_awesome</span>
                        <span>Reconhecimento IA (Ler Comprovantes)</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onNavigate('parcelas', debtor.id)}
                      className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 hover:text-slate-900 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-200 transition-all cursor-pointer"
                    >
                      <span>Ver Tabela de Parcelas</span>
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </button>
                  </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Detalhes dos Itens Unitários (TV, Celular, etc.) */}
      <DebtorUnitaryItemsModal
        isOpen={isUnitaryModalOpen}
        onClose={() => setIsUnitaryModalOpen(false)}
        debtor={selectedDebtorForUnitary}
        purchases={purchases}
        installments={installments}
        initialSelectedItemId={initialUnitaryItemId}
        onNudgeWhatsApp={onNudgeWhatsApp}
        onSettleInstallment={onSettleInstallment}
        onShowProof={onShowProof}
        onOpenNewPurchaseForDebtor={onOpenNewPurchaseForDebtor}
        onOpenExtratoTotal={onOpenExtratoTotal}
      />
    </div>
  );
};
