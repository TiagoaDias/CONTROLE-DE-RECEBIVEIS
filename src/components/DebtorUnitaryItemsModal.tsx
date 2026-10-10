import React, { useState, useMemo } from 'react';
import { Debtor, Installment, Purchase } from '../types';
import { SafeDebtorAvatar } from './DebtorsMasterSpreadsheet';
import { DebtorUnitaryItem, getDebtorUnitaryItems } from '../utils/debtorItemsUtils';

interface DebtorUnitaryItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  debtor: Debtor | null;
  purchases: Purchase[];
  installments: Installment[];
  initialSelectedItemId?: string;
  onNudgeWhatsApp?: (name: string, amount: string, item: string, parcel: string, phone?: string) => void;
  onSettleInstallment?: (inst: Installment) => void;
  onShowProof?: (
    payer: string,
    amount: string,
    date: string,
    dest: string,
    auth: string,
    item: string
  ) => void;
  onOpenNewPurchaseForDebtor?: (debtorId: string) => void;
  onOpenExtratoTotal?: (purchaseId?: string, debtorId?: string) => void;
}

export const DebtorUnitaryItemsModal: React.FC<DebtorUnitaryItemsModalProps> = ({
  isOpen,
  onClose,
  debtor,
  purchases,
  installments,
  initialSelectedItemId,
  onNudgeWhatsApp,
  onSettleInstallment,
  onShowProof,
  onOpenNewPurchaseForDebtor,
  onOpenExtratoTotal,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [expandedItemIds, setExpandedItemIds] = useState<Record<string, boolean>>({});

  // Calcular itens unitários do devedor
  const items: DebtorUnitaryItem[] = useMemo(() => {
    if (!debtor) return [];
    return getDebtorUnitaryItems(debtor.id, debtor.name, purchases, installments);
  }, [debtor, purchases, installments]);

  // Se houver um item inicial selecionado, focar nele
  React.useEffect(() => {
    if (initialSelectedItemId) {
      setSelectedFilter(initialSelectedItemId);
      setExpandedItemIds((prev) => ({ ...prev, [initialSelectedItemId]: true }));
    } else {
      setSelectedFilter('all');
    }
  }, [initialSelectedItemId, isOpen]);

  if (!isOpen || !debtor) return null;

  const totalInstallmentsCount = items.reduce((acc, it) => acc + it.totalInstallments, 0);
  const totalPaidInstallmentsCount = items.reduce((acc, it) => acc + it.paidInstallments, 0);
  const totalOwedAmount = items.reduce((acc, it) => acc + it.remainingAmount, 0);
  const totalPaidAmount = items.reduce((acc, it) => acc + it.paidAmount, 0);
  const overallPercent = totalInstallmentsCount > 0 ? (totalPaidInstallmentsCount / totalInstallmentsCount) * 100 : 0;

  const toggleExpand = (itemId: string) => {
    setExpandedItemIds((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const displayedItems = selectedFilter === 'all'
    ? items
    : items.filter((it) => it.id === selectedFilter);

  const handleCobrarItem = (item: DebtorUnitaryItem) => {
    if (!onNudgeWhatsApp) return;
    const pendingInst = item.installments.find((i) => i.status !== 'paid');
    const parcelLabel = pendingInst
      ? `${pendingInst.installmentNumber}/${pendingInst.totalInstallments}`
      : `${item.paidInstallments + 1}/${item.totalInstallments}`;
    const amountLabel = `R$ ${item.installmentValue.toFixed(2).replace('.', ',')}`;
    onNudgeWhatsApp(debtor.name, amountLabel, item.productName, parcelLabel, debtor.phone);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/60 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-white border border-slate-200 rounded-2xl shadow-2xl text-slate-900 overflow-hidden flex flex-col max-h-[88dvh] m-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Compacto do Modal com Dados do Devedor */}
        <div className="relative px-4 py-2.5 bg-gradient-to-r from-sky-50 via-white to-blue-50/70 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative shrink-0">
              <SafeDebtorAvatar
                name={debtor.name}
                avatar={debtor.avatar}
                size="sm"
                status={debtor.overdueCount > 0 ? 'late' : 'ok'}
                className="ring-2 ring-cyan-300 shadow-xs"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-slate-900 truncate tracking-tight">
                  {debtor.name}
                </h3>
                {debtor.relation && (
                  <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                    {debtor.relation}
                  </span>
                )}
                <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-md bg-cyan-50 text-cyan-700 border border-cyan-200">
                  {items.length} {items.length === 1 ? 'item' : 'itens'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 flex items-center gap-1.5 font-medium truncate">
                <span>Detalhamento unitário de parcelas por compra/item</span>
                {debtor.phone && (
                  <span className="text-slate-400 hidden sm:inline">• {debtor.phone}</span>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-950 flex items-center justify-center transition-all cursor-pointer shrink-0 border border-slate-200 shadow-2xs"
            title="Fechar"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Scrollable Body Otimizado */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-2.5 custom-scrollbar bg-slate-50/50 flex-1">
          
          {/* Card de Balanço Consolidado Compacto */}
          <div className="bg-gradient-to-br from-slate-50 via-white to-blue-50/20 p-2.5 sm:p-3 rounded-xl border border-cyan-300/40 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between gap-3 relative z-1 flex-wrap">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-cyan-100 text-cyan-700 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[13px]">analytics</span>
                  </span>
                  <span className="text-[10.5px] font-bold text-cyan-800 uppercase tracking-wider">
                    Balanço Consolidado
                  </span>
                </div>
                <div className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="text-xl sm:text-2xl font-black text-amber-600 font-mono">
                    R$ {totalOwedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10.5px] text-slate-500 font-medium">saldo a pagar</span>
                </div>
              </div>

              {/* Placar de Parcelas: X de Y Pagas */}
              <div className="bg-slate-100/80 px-2.5 py-1 rounded-lg border border-slate-200/80 text-right">
                <span className="text-[9.5px] text-slate-500 block font-bold">Parcelas Consolidadas</span>
                <span className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1 sm:justify-end">
                  <span className="text-cyan-700 font-mono">{totalPaidInstallmentsCount}</span>
                  <span className="text-slate-400 text-[10px] font-medium">de</span>
                  <span className="text-slate-800 font-mono">{totalInstallmentsCount}</span>
                  <span className="text-[10px] text-emerald-600 font-bold ml-0.5">pagas ({overallPercent.toFixed(0)}%)</span>
                </span>
              </div>
            </div>

            {/* Barra de Progresso Global Compacta */}
            <div className="mt-2 pt-2 border-t border-slate-200/70">
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, overallPercent))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Seletor de Filtro / Abas de Itens Unitários Compacto */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none border-b border-slate-200">
            <button
              type="button"
              onClick={() => setSelectedFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 border ${
                selectedFilter === 'all'
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-2xs font-black'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">grid_view</span>
              <span>Todos ({items.length})</span>
            </button>

            {items.map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() => setSelectedFilter(it.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 border ${
                  selectedFilter === it.id
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-2xs font-black'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className="material-symbols-outlined text-[13px] text-cyan-600 font-black">
                  {it.icon}
                </span>
                <span className="truncate max-w-[110px]">{it.shortName}</span>
                <span className={`text-[9.5px] px-1 rounded-md font-mono font-bold ${
                  it.isPaidOff ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-300'
                }`}>
                  {it.paidInstallments}/{it.totalInstallments}
                </span>
              </button>
            ))}
          </div>

          {/* Lista de Itens Unitários Compacta */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px] text-cyan-600 font-bold">devices</span>
                <span>Itens Detalhados</span>
              </span>
              <span className="text-[10px] text-slate-400 font-semibold">
                Mostrando {displayedItems.length} de {items.length} itens
              </span>
            </div>

            {displayedItems.length === 0 ? (
              <div className="text-center py-6 bg-white rounded-xl border border-slate-200 p-3">
                <span className="material-symbols-outlined text-3xl text-slate-400 mb-1">inventory_2</span>
                <p className="text-xs font-semibold text-slate-600">Nenhum item unitário encontrado</p>
                <p className="text-[11px] text-slate-500 font-medium">Este devedor não possui compras ou parcelas registradas.</p>
              </div>
            ) : (
              displayedItems.map((item) => {
                const isExpanded = !!expandedItemIds[item.id];

                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border transition-all duration-200 overflow-hidden shadow-2xs ${
                      item.isPaidOff
                        ? 'bg-emerald-50/20 border-emerald-250'
                        : item.overdueInstallments > 0
                        ? 'bg-red-50/25 border-red-250 ring-1 ring-red-350'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    {/* Cabeçalho do Item Unitário Compacto */}
                    <div className="p-2.5 sm:p-3 flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Ícone Unitário */}
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border shadow-2xs ${
                              item.isPaidOff
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                : item.overdueInstallments > 0
                                ? 'bg-red-50 border-red-200 text-red-700'
                                : 'bg-cyan-50 border-cyan-200 text-cyan-700'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              {item.icon}
                            </span>
                          </div>

                          {/* Título & Categoria do Item Unitário */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="text-xs sm:text-sm font-black text-slate-900 truncate tracking-tight">
                                {item.productName}
                              </h4>
                              {item.isPaidOff ? (
                                <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-0.5">
                                  <span className="material-symbols-outlined text-[10px] font-black">check_circle</span>
                                  <span>Quitado</span>
                                </span>
                              ) : item.overdueInstallments > 0 ? (
                                <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-red-50 text-red-700 border border-red-200 flex items-center gap-0.5 animate-pulse">
                                  <span className="material-symbols-outlined text-[10px] font-bold">error</span>
                                  <span>{item.overdueInstallments} em atraso</span>
                                </span>
                              ) : (
                                <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-cyan-50 text-cyan-800 border border-cyan-200 flex items-center gap-0.5">
                                  <span className="material-symbols-outlined text-[10px] font-bold">schedule</span>
                                  <span>Em dia</span>
                                </span>
                              )}
                            </div>

                            {/* Loja & Cartão */}
                            <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500 mt-0.5 flex-wrap font-medium">
                              <span className="flex items-center gap-0.5 text-slate-600">
                                <span className="material-symbols-outlined text-[11px] text-slate-500">store</span>
                                <span>{item.store}</span>
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="flex items-center gap-0.5 text-slate-600">
                                <span className="material-symbols-outlined text-[11px] text-slate-500">credit_card</span>
                                <span>{item.cardName}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Placar Unitário: X de Y pagas */}
                        <div className="text-right shrink-0 bg-slate-100/90 px-2 py-1 rounded-lg border border-slate-200/80 shadow-2xs">
                          <span className="text-[9px] text-slate-500 block font-bold">Progresso</span>
                          <span className="text-xs sm:text-sm font-black text-cyan-700 font-mono">
                            {item.paidInstallments} <span className="text-[10px] text-slate-400 font-sans font-medium">de</span> {item.totalInstallments}
                          </span>
                          <span className="text-[9px] text-emerald-600 block font-bold">pagas</span>
                        </div>
                      </div>

                      {/* Métricas Financeiras Unitárias Compactas */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1.5 border-t border-slate-200/80 text-[11px]">
                        <div className="bg-slate-100/50 p-1.5 rounded-lg border border-slate-200/60 text-center">
                          <span className="text-[9px] text-slate-500 block font-semibold">Valor Parcela</span>
                          <span className="font-mono font-bold text-slate-800 text-xs">
                            R$ {item.installmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="bg-slate-100/50 p-1.5 rounded-lg border border-slate-200/60 text-center">
                          <span className="text-[9px] text-slate-500 block font-semibold">Saldo Restante</span>
                          <span className="font-mono font-bold text-amber-600 text-xs">
                            {item.isPaidOff ? 'R$ 0,00' : `R$ ${item.remainingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                          </span>
                        </div>

                        <div className="bg-slate-100/50 p-1.5 rounded-lg border border-slate-200/60 text-center">
                          <span className="text-[9px] text-slate-500 block font-semibold">Total Item</span>
                          <span className="font-mono font-bold text-slate-750 text-xs">
                            R$ {item.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="bg-slate-100/50 p-1.5 rounded-lg border border-slate-200/60 text-center">
                          <span className="text-[9px] text-slate-500 block font-semibold">Vencimento</span>
                          <span className="font-mono font-bold text-cyan-700 text-xs">
                            {item.isPaidOff ? 'Quitado' : item.nextDueDate || '10/10/2026'}
                          </span>
                        </div>
                      </div>

                      {/* Barra de Progresso Unitária Compacta */}
                      <div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/80">
                          <div
                            className={`h-full transition-all duration-300 rounded-full ${
                              item.isPaidOff
                                ? 'bg-emerald-500'
                                : 'bg-gradient-to-r from-blue-500 to-cyan-400'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, item.percentPaid))}%` }}
                          />
                        </div>
                      </div>

                      {/* Botões de Ação do Item Unitário Compactos */}
                      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1.5 border-t border-slate-200/80">
                        <button
                          type="button"
                          onClick={() => toggleExpand(item.id)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-[10.5px] text-cyan-800 font-bold flex items-center gap-1 transition-all cursor-pointer border border-slate-200"
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            {isExpanded ? 'expand_less' : 'expand_more'}
                          </span>
                          <span>
                            {isExpanded
                              ? 'Ocultar Parcelas'
                              : `Ver Parcelas (${item.installments.length})`}
                          </span>
                        </button>

                        <div className="flex items-center gap-1.5">
                          {!item.isPaidOff && onNudgeWhatsApp && debtor.phone && (
                            <button
                              type="button"
                              onClick={() => handleCobrarItem(item)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-[10.5px] text-white font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                              title="Cobrar via WhatsApp"
                            >
                              <span className="material-symbols-outlined text-[13px]">send</span>
                              <span>Cobrar</span>
                            </button>
                          )}

                          {onOpenExtratoTotal && item.purchaseId && (
                            <button
                              type="button"
                              onClick={() => onOpenExtratoTotal(item.purchaseId, debtor.id)}
                              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-95 text-[10.5px] text-white font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                              title="PDFs e documentos detalhados"
                            >
                              <span className="material-symbols-outlined text-[13px]">picture_as_pdf</span>
                              <span>PDFs e documentos</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Lista Expandida de Parcelas Deste Item Unitário */}
                    {isExpanded && (
                      <div className="bg-slate-100/90 border-t border-slate-200 p-2.5 sm:p-3 space-y-1.5 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold px-1 mb-1">
                          <span>Cronograma: {item.productName}</span>
                          <span>{item.installments.length} parcelas</span>
                        </div>

                        {item.installments.length === 0 ? (
                          <div className="text-center py-3 text-xs text-slate-500 font-semibold">
                            Nenhuma parcela individual vinculada encontrada.
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {item.installments.map((inst, instIdx) => {
                              const isPaid = inst.status === 'paid';
                              const isOverdue = inst.status === 'overdue';
                              const val = inst.amount || inst.originalAmount || 0;

                              return (
                                <div
                                  key={inst.id || instIdx}
                                  className={`p-2 rounded-lg border flex items-center justify-between gap-2 text-xs transition-all ${
                                    isPaid
                                      ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-950'
                                      : isOverdue
                                      ? 'bg-red-50/70 border-red-200/80 text-red-950'
                                      : 'bg-white border-slate-200/80 text-slate-800'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="font-mono font-bold text-[10.5px] px-1.5 py-0.2 rounded bg-slate-100 border border-slate-200 text-slate-700">
                                      #{inst.installmentNumber}/{inst.totalInstallments}
                                    </span>
                                    <span className="font-mono text-[11px] text-slate-600 flex items-center gap-0.5">
                                      <span className="material-symbols-outlined text-[12px] text-slate-400">calendar_today</span>
                                      <span>{inst.dueDate}</span>
                                    </span>
                                    <span className="font-mono font-black text-slate-900 text-xs">
                                      R$ {val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {isPaid ? (
                                      <div className="flex items-center gap-1">
                                        <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-0.5 bg-emerald-100/80 px-1.5 py-0.2 rounded border border-emerald-200">
                                          <span className="material-symbols-outlined text-[11px]">check_circle</span>
                                          <span>Paga</span>
                                        </span>
                                        {onShowProof && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              onShowProof(
                                                inst.debtorName,
                                                `R$ ${inst.amount.toFixed(2).replace('.', ',')}`,
                                                inst.paidAt || inst.dueDate,
                                                'Tiago Dias (Credor)',
                                                inst.authCode || 'AUT-OFICIAL',
                                                `${inst.product} (Parcela #${inst.installmentNumber}/${inst.totalInstallments})`
                                              )
                                            }
                                            className="px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10.5px] flex items-center gap-0.5 transition-all cursor-pointer"
                                            title="Ver Comprovante Oficial"
                                          >
                                            <span className="material-symbols-outlined text-[11px]">verified</span>
                                            <span>Recibo</span>
                                          </button>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1">
                                        <span
                                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                                            isOverdue
                                              ? 'bg-red-50 text-red-750 border-red-200'
                                              : 'bg-amber-50 text-amber-700 border-amber-200'
                                          }`}
                                        >
                                          {isOverdue ? 'Atrasada' : 'A vencer'}
                                        </span>

                                        {onSettleInstallment && (
                                          <button
                                            type="button"
                                            onClick={() => onSettleInstallment(inst)}
                                            className="px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10.5px] flex items-center gap-0.5 transition-all cursor-pointer"
                                            title="Liquidar e dar baixa"
                                          >
                                            <span className="material-symbols-outlined text-[12px]">paid</span>
                                            <span>Baixa</span>
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Rodapé Compacto do Modal */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
          {onOpenNewPurchaseForDebtor ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenNewPurchaseForDebtor(debtor.id);
              }}
              className="h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-[15px]">add_shopping_cart</span>
              <span>+ Nova Parcela / Item</span>
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="h-8 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 hover:text-slate-900 font-bold text-xs transition-all cursor-pointer border border-slate-200"
          >
            Fechar Detalhes
          </button>
        </div>
      </div>
    </div>
  );
};
