import React, { useMemo, useState } from 'react';
import { Debtor, Installment } from '../types';
import { SafeDebtorAvatar } from './DebtorsMasterSpreadsheet';
import { safeToFixed } from '../utils/numberUtils';
import { parseDateParts } from '../utils/dateUtils';
import { getProductIcon } from '../utils/debtorItemsUtils';
import { WhatsAppIcon } from './WhatsAppIcon';

export type DebtorKpiType = 'open' | 'paid' | 'overdue' | 'month';

interface DebtorKpiDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: DebtorKpiType;
  debtor: Debtor | null;
  installments: Installment[];
  onSettleInstallment?: (inst: Installment) => void;
  onShowProof?: (
    payer: string,
    amount: string,
    date: string,
    dest: string,
    auth: string,
    item: string
  ) => void;
  onNudgeWhatsApp?: (inst: Installment, customMsg?: string) => void;
  onToast?: (msg: string) => void;
}

interface ItemGroup {
  product: string;
  icon: string;
  cardName?: string;
  installments: Installment[];
  totalItemAmount: number;
  monthlyAmount: number;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
  totalProductInstallments: number;
  monthPaidCount: number;
  monthPendingCount: number;
  monthOverdueCount: number;
  isMonthAllPaid: boolean;
  lastPaymentDate?: string;
}

export const DebtorKpiDetailModal: React.FC<DebtorKpiDetailModalProps> = ({
  isOpen,
  onClose,
  type,
  debtor,
  installments = [],
  onSettleInstallment,
  onShowProof,
  onNudgeWhatsApp,
  onToast,
}) => {
  if (!isOpen || !debtor) return null;

  const [selectedProductFilter, setSelectedProductFilter] = useState<string>('all');

  const currentMonthNum = new Date().getMonth() + 1;
  const currentYearNum = new Date().getFullYear();
  const monthAbbrs = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  const currentMonthAbbr = monthAbbrs[currentMonthNum - 1];

  // 1. Filtra estritamente as parcelas do devedor selecionado (Hook incondicional)
  const debtorInstallments = useMemo(() => {
    if (!debtor) return [];
    if (debtor.id === 'general' || debtor.id === 'all') return installments || [];
    return (installments || []).filter(
      (i) =>
        i.debtorId === debtor.id ||
        (debtor.name && i.debtorName && i.debtorName.toLowerCase().trim() === debtor.name.toLowerCase().trim())
    );
  }, [installments, debtor]);

  // 2. Filtra as parcelas de acordo com a métrica clicada (Hook incondicional)
  const filteredInstallments = useMemo(() => {
    if (!debtor) return [];
    switch (type) {
      case 'open':
        return debtorInstallments
          .filter((i) => i.status !== 'paid')
          .sort((a, b) => (a.installmentNumber || 0) - (b.installmentNumber || 0));
      case 'paid':
        return debtorInstallments
          .filter((i) => i.status === 'paid')
          .sort((a, b) => (a.installmentNumber || 0) - (b.installmentNumber || 0));
      case 'overdue':
        return debtorInstallments
          .filter((i) => i.status === 'overdue' || (i.delayDays || 0) > 0)
          .sort((a, b) => (a.installmentNumber || 0) - (b.installmentNumber || 0));
      case 'month':
        return debtorInstallments
          .filter((i) => {
            if (!i.dueDate) return false;
            const { month, year } = parseDateParts(i.dueDate);
            return month === currentMonthNum && year === currentYearNum;
          })
          .sort((a, b) => (a.installmentNumber || 0) - (b.installmentNumber || 0));
      default:
        return debtorInstallments;
    }
  }, [debtorInstallments, type, currentMonthNum, currentYearNum, debtor]);

  // 3. Total acumulado da métrica (Hook incondicional)
  const totalAmount = useMemo(() => {
    return filteredInstallments.reduce(
      (acc, curr) => acc + (curr.paidAmount || curr.amount || curr.originalAmount || 0),
      0
    );
  }, [filteredInstallments]);

  // 4. Agrupamento estruturado por Item / Produto específico (Hook incondicional)
  const itemGroups = useMemo<ItemGroup[]>(() => {
    if (!debtor) return [];
    const groupsMap = new Map<string, Installment[]>();

    filteredInstallments.forEach((inst) => {
      const prodKey = inst.product || 'Outros Itens';
      if (!groupsMap.has(prodKey)) {
        groupsMap.set(prodKey, []);
      }
      groupsMap.get(prodKey)!.push(inst);
    });

    const result: ItemGroup[] = [];

    groupsMap.forEach((instList, product) => {
      const allForProduct = debtorInstallments.filter((i) => (i.product || 'Outros Itens') === product);
      const totalProductInstallments = allForProduct.length > 0
        ? Math.max(...allForProduct.map((i) => i.totalInstallments || 1), allForProduct.length)
        : instList.length;

      const totalItemAmount = instList.reduce(
        (acc, curr) => acc + (curr.paidAmount || curr.amount || curr.originalAmount || 0),
        0
      );

      const sampleInst = instList[0] || allForProduct[0];
      const monthlyAmount = sampleInst ? (sampleInst.amount || sampleInst.originalAmount || 0) : 0;
      const cardName = sampleInst?.cardName;

      const paidCount = allForProduct.filter((i) => i.status === 'paid').length;
      const overdueCount = allForProduct.filter((i) => i.status === 'overdue' || (i.delayDays || 0) > 0).length;
      const pendingCount = allForProduct.filter((i) => i.status !== 'paid').length;

      const monthPaidCount = instList.filter((i) => i.status === 'paid').length;
      const monthOverdueCount = instList.filter((i) => i.status === 'overdue' || (i.delayDays || 0) > 0).length;
      const monthPendingCount = instList.filter((i) => i.status !== 'paid').length;
      const isMonthAllPaid = instList.length > 0 && monthPaidCount === instList.length;
      const lastPayment = instList.find((i) => i.status === 'paid' && i.paidAt);

      result.push({
        product,
        icon: getProductIcon(product),
        cardName,
        installments: instList.sort((a, b) => (a.installmentNumber || 0) - (b.installmentNumber || 0)),
        totalItemAmount,
        monthlyAmount,
        paidCount,
        pendingCount,
        overdueCount,
        totalProductInstallments,
        monthPaidCount,
        monthPendingCount,
        monthOverdueCount,
        isMonthAllPaid,
        lastPaymentDate: lastPayment?.paidAt,
      });
    });

    return result.sort((a, b) => b.totalItemAmount - a.totalItemAmount);
  }, [filteredInstallments, debtorInstallments, debtor]);

  // 5. Itens filtrados para exibição (Hook incondicional)
  const displayedItemGroups = useMemo(() => {
    if (selectedProductFilter === 'all') return itemGroups;
    return itemGroups.filter((g) => g.product === selectedProductFilter);
  }, [itemGroups, selectedProductFilter]);

  // Verifica se todas as parcelas filtradas do mês estão quitadas
  const isEveryMonthInstallmentPaid = useMemo(() => {
    return filteredInstallments.length > 0 && filteredInstallments.every((i) => i.status === 'paid');
  }, [filteredInstallments]);

  // 6. Configurações de textos e títulos para cada tipo de métrica (Hook incondicional)
  const debtorName = debtor?.name || 'Devedor';
  const config = useMemo(() => {
    switch (type) {
      case 'open':
        return {
          title: 'Total em Aberto por Item e Mensal',
          subtitle: `Detalhamento de itens com saldo pendente de ${debtorName}`,
          itemPrefix: 'Total em aberto do',
          icon: 'account_balance_wallet',
          badgeText: 'EM ABERTO',
          borderHighlight: 'border-cyan-400',
          badgeStyle: 'bg-cyan-50 text-cyan-800 border-cyan-200',
          iconBox: 'bg-cyan-50 text-cyan-700 border-cyan-200',
          amountColor: 'text-slate-900',
        };
      case 'paid':
        return {
          title: 'Total Quitado por Item e Mensal',
          subtitle: `Detalhamento de quitação individualizada de ${debtorName}`,
          itemPrefix: 'Total quitado do',
          icon: 'check_circle',
          badgeText: 'QUITADO',
          borderHighlight: 'border-emerald-400',
          badgeStyle: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          iconBox: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          amountColor: 'text-emerald-700',
        };
      case 'overdue':
        return {
          title: 'Total em Atraso por Item e Mensal',
          subtitle: `Detalhamento de parcelas vencidas de ${debtorName}`,
          itemPrefix: 'Total em atraso do',
          icon: 'warning',
          badgeText: 'EM ATRASO',
          borderHighlight: 'border-red-400',
          badgeStyle: 'bg-red-50 text-red-800 border-red-200',
          iconBox: 'bg-red-50 text-red-700 border-red-200',
          amountColor: 'text-red-700',
        };
      case 'month':
        return {
          title: `Faturas Fechando no Mês (${currentMonthAbbr})`,
          subtitle: `Faturas e parcelas que fecham neste mês de ${debtorName}`,
          itemPrefix: 'Fatura do mês do',
          icon: 'calendar_month',
          badgeText: `MÊS ATUAL (${currentMonthAbbr})`,
          borderHighlight: 'border-amber-400',
          badgeStyle: 'bg-amber-50 text-amber-800 border-amber-200',
          iconBox: 'bg-amber-50 text-amber-700 border-amber-200',
          amountColor: 'text-amber-700',
        };
    }
  }, [type, debtorName, currentMonthAbbr]);

  // RETORNO CONDICIONAL SEGURO APÓS A EXECUÇÃO DE TODOS OS HOOKS
  if (!isOpen || !debtor) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[450] flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-2xl bg-white border-2 ${config.borderHighlight} ring-2 ring-cyan-400/40 shadow-[0_0_40px_rgba(6,182,212,0.3)] rounded-2xl sm:rounded-3xl overflow-hidden flex flex-col text-slate-800 animate-in zoom-in-95 duration-200 max-h-[85dvh] sm:max-h-[88vh] my-auto`}
      >
        {/* ============================================================ */}
        {/* CABEÇALHO COMPACTO E REENQUADRADO                            */}
        {/* ============================================================ */}
        <div className="px-3.5 py-3 border-b border-slate-200 flex items-center justify-between gap-2.5 bg-white shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-8.5 h-8.5 rounded-xl flex items-center justify-center shrink-0 border ${config.iconBox} shadow-2xs`}>
              <span className="material-symbols-outlined text-[19px]">{config.icon}</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-black text-xs sm:text-sm text-slate-900 truncate">
                  {config.title}
                </h3>
                <span className={`text-[9px] font-black uppercase px-2 py-0.2 rounded-full border ${config.badgeStyle}`}>
                  {config.badgeText}
                </span>
              </div>
              <p className="text-[10.5px] text-slate-500 truncate">
                {config.subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7.5 h-7.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer shrink-0 border border-slate-200"
            title="Fechar Janela"
          >
            <span className="material-symbols-outlined text-[17px]">close</span>
          </button>
        </div>

        {/* ============================================================ */}
        {/* CARD RESUMO DO DEVEDOR                                       */}
        {/* ============================================================ */}
        <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <SafeDebtorAvatar
              name={debtor.name}
              avatar={debtor.avatar}
              size="sm"
              status={debtor.overdueCount && debtor.overdueCount > 0 ? 'late' : 'ok'}
              className="ring-2 ring-cyan-500/40 shrink-0"
            />
            <div className="min-w-0">
              <span className="font-bold text-xs sm:text-sm text-slate-900 block truncate">
                {debtor.name}
              </span>
              <span className="text-[10px] text-slate-500 block font-mono truncate">
                {debtor.relation || 'Cliente'} • {itemGroups.length} {itemGroups.length === 1 ? 'item' : 'itens'}
              </span>
            </div>
          </div>

          <div className={`px-3 py-1 rounded-xl border text-right shrink-0 shadow-2xs ${
            type === 'month' && isEveryMonthInstallmentPaid
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-white border-slate-200'
          }`}>
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">
              {type === 'month'
                ? isEveryMonthInstallmentPaid
                  ? `TOTAL QUITADO (${currentMonthAbbr}):`
                  : `TOTAL DO MÊS (${currentMonthAbbr}):`
                : `Total ${config.badgeText}:`}
            </span>
            <span className={`text-sm sm:text-base font-black font-mono leading-none block ${
              type === 'month' && isEveryMonthInstallmentPaid ? 'text-emerald-700' : config.amountColor
            }`}>
              R$ {safeToFixed(totalAmount)}
            </span>
            {type === 'month' && isEveryMonthInstallmentPaid && (
              <span className="text-[8.5px] font-black text-emerald-700 uppercase tracking-tight block mt-0.5">
                ✓ 100% Liquidado
              </span>
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/* CHIPS DE FILTRO RÁPIDO POR ITEM                              */}
        {/* ============================================================ */}
        {itemGroups.length > 1 && (
          <div className="px-3.5 py-2 bg-white border-b border-slate-200 flex items-center gap-1 overflow-x-auto scrollbar-thin shrink-0">
            <button
              type="button"
              onClick={() => setSelectedProductFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 border ${
                selectedProductFilter === 'all'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
              }`}
            >
              Todos ({itemGroups.length})
            </button>

            {itemGroups.map((grp) => (
              <button
                key={grp.product}
                type="button"
                onClick={() => setSelectedProductFilter(grp.product)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1 border ${
                  selectedProductFilter === grp.product
                    ? 'bg-cyan-600 text-white border-cyan-600 shadow-2xs'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                }`}
              >
                <span className="material-symbols-outlined text-[13px]">{grp.icon}</span>
                <span>{grp.product}</span>
                <span className={`text-[9.5px] font-mono px-1 rounded ${
                  selectedProductFilter === grp.product ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
                }`}>
                  R$ {safeToFixed(grp.totalItemAmount)}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* ============================================================ */}
        {/* LISTA ROLÁVEL DE ITENS COM ASPECTO SOBREPOSTO HARMONIOSO     */}
        {/* ============================================================ */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin bg-slate-50/60">
          {displayedItemGroups.length === 0 ? (
            <div className="py-10 px-4 text-center flex flex-col items-center justify-center gap-2.5 bg-white rounded-2xl border border-slate-200">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${config.iconBox}`}>
                <span className="material-symbols-outlined text-[24px]">{config.icon}</span>
              </div>
              <div className="max-w-sm">
                <h4 className="font-bold text-xs sm:text-sm text-slate-900">Nenhum item com este status</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Não existem parcelas nesta categoria para <strong>{debtor.name}</strong>.
                </p>
              </div>
            </div>
          ) : (
            displayedItemGroups.map((grp) => {
              return (
                <div
                  key={grp.product}
                  className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden transition-all hover:shadow-md hover:border-slate-300 relative"
                >
                  {/* Cabeçalho do Item */}
                  <div className="px-3.5 py-2.5 bg-gradient-to-r from-slate-50/90 via-white to-slate-50/90 border-b border-slate-200/80 flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 shadow-2xs ${
                        type === 'month' && grp.isMonthAllPaid
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-cyan-50 border-cyan-200 text-cyan-700'
                      }`}>
                        <span className="material-symbols-outlined text-[17px]">
                          {type === 'month' && grp.isMonthAllPaid ? 'task_alt' : grp.icon}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-black text-xs sm:text-sm text-slate-900 truncate">
                            {type === 'month' && grp.isMonthAllPaid
                              ? 'Fatura quitada do '
                              : type === 'month' && grp.monthOverdueCount > 0
                              ? 'Fatura em atraso do '
                              : config.itemPrefix}{' '}
                            <span className={type === 'month' && grp.isMonthAllPaid ? 'text-emerald-800' : 'text-cyan-800'}>
                              {grp.product}
                            </span>
                          </h4>
                          {grp.cardName && (
                            <span className="text-[9.5px] font-mono px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200 font-bold">
                              {grp.cardName}
                            </span>
                          )}
                          {type === 'month' && grp.isMonthAllPaid && (
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[12px]">verified</span>
                              Paga
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500 font-medium mt-0.5 flex-wrap">
                          <span className="text-slate-700 font-bold">
                            Mensal: R$ {safeToFixed(grp.monthlyAmount)}
                          </span>
                          <span>•</span>
                          {type === 'paid' && (
                            <span className="text-emerald-700 font-bold">
                              {grp.paidCount}/{grp.totalProductInstallments} quitadas
                            </span>
                          )}
                          {type === 'open' && (
                            <span className="text-cyan-700 font-bold">
                              {grp.pendingCount} a vencer
                            </span>
                          )}
                          {type === 'overdue' && (
                            <span className="text-red-700 font-bold">
                              {grp.overdueCount} em atraso
                            </span>
                          )}
                          {type === 'month' && (
                            grp.isMonthAllPaid ? (
                              <span className="text-emerald-700 font-extrabold flex items-center gap-1 bg-emerald-50/80 px-2 py-0.5 rounded-md border border-emerald-200/80">
                                <span className="material-symbols-outlined text-[13px]">check_circle</span>
                                {grp.lastPaymentDate ? `Paga em ${grp.lastPaymentDate} (${currentMonthAbbr})` : `Paga neste mês (${currentMonthAbbr})`}
                              </span>
                            ) : grp.monthOverdueCount > 0 ? (
                              <span className="text-red-700 font-extrabold flex items-center gap-1 bg-red-50/80 px-2 py-0.5 rounded-md border border-red-200/80">
                                <span className="material-symbols-outlined text-[13px]">warning</span>
                                Vencida em atraso ({currentMonthAbbr})
                              </span>
                            ) : (
                              <span className="text-amber-700 font-bold flex items-center gap-1 bg-amber-50/80 px-2 py-0.5 rounded-md border border-amber-200/80">
                                <span className="material-symbols-outlined text-[13px]">schedule</span>
                                A vencer neste mês ({currentMonthAbbr})
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    </div>

                    <div className={`px-2.5 py-1 rounded-xl border text-right shrink-0 ${
                      type === 'month' && grp.isMonthAllPaid
                        ? 'bg-emerald-50/60 border-emerald-200'
                        : 'bg-slate-50 border-slate-200'
                    }`}>
                      <span className="text-[8.5px] text-slate-400 font-bold uppercase block">
                        {type === 'month' && grp.isMonthAllPaid ? 'Total Quitado:' : 'Subtotal:'}
                      </span>
                      <span className={`text-xs sm:text-sm font-black font-mono leading-none block ${
                        type === 'month' && grp.isMonthAllPaid ? 'text-emerald-700' : config.amountColor
                      }`}>
                        R$ {safeToFixed(grp.totalItemAmount)}
                      </span>
                    </div>
                  </div>

                  {/* Parcelas do Item */}
                  <div className="p-2.5 space-y-1.5">
                    {grp.installments.map((inst, instIdx) => {
                      const isPaid = inst.status === 'paid';
                      const isOverdue = inst.status === 'overdue' || (inst.delayDays || 0) > 0;
                      const authCode = inst.authCode || `AUT-${inst.id ? inst.id.slice(-4) : '0000'}`;

                      return (
                        <div
                          key={inst.id}
                          onClick={() => {
                            if (isPaid && onShowProof) {
                              onShowProof(
                                debtor?.name || 'Devedor',
                                `R$ ${safeToFixed(inst.paidAmount || inst.amount || 0)}`,
                                inst.paidAt || inst.dueDate,
                                'HASPAHO TI / Tiago Dias',
                                authCode,
                                `${inst.product} (Parcela #${inst.installmentNumber}/${inst.totalInstallments})`
                              );
                            } else if (!isPaid && onSettleInstallment) {
                              onClose();
                              onSettleInstallment(inst);
                            }
                          }}
                          className={`p-2 rounded-xl border border-slate-200/70 bg-white hover:bg-slate-50/80 transition-all flex items-center justify-between gap-2 shadow-2xs hover:shadow-xs relative z-[${10 - instIdx}] cursor-pointer group`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200 shrink-0">
                              #{inst.installmentNumber}/{inst.totalInstallments}
                            </span>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-800 flex-wrap">
                                <span>Venc: {inst.dueDate}</span>
                                {isPaid && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-extrabold uppercase">
                                    Paga
                                  </span>
                                )}
                                {isOverdue && !isPaid && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-red-50 text-red-700 border border-red-200 font-extrabold uppercase">
                                    {inst.delayDays || 1}d atraso
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono truncate">
                                {isPaid && inst.paidAt ? `Pago em ${inst.paidAt}` : `Mensal: R$ ${safeToFixed(inst.amount || inst.originalAmount || 0)}`}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-black font-mono text-slate-900 block">
                              R$ {safeToFixed(inst.paidAmount || inst.amount || inst.originalAmount || 0)}
                            </span>

                            {isPaid ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onShowProof) {
                                    onShowProof(
                                      debtor?.name || 'Devedor',
                                      `R$ ${safeToFixed(inst.paidAmount || inst.amount || 0)}`,
                                      inst.paidAt || inst.dueDate,
                                      'HASPAHO TI / Tiago Dias',
                                      authCode,
                                      `${inst.product} (Parcela #${inst.installmentNumber}/${inst.totalInstallments})`
                                    );
                                  }
                                }}
                                className="py-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10.5px] font-bold flex items-center gap-0.5 transition-all cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.35)] active:scale-95 hover:shadow-[0_0_16px_rgba(16,185,129,0.5)]"
                                title="Ver recibo individual oficial"
                              >
                                <span className="material-symbols-outlined text-[13px]">verified</span>
                                <span>Recibo</span>
                              </button>
                            ) : (
                              <div className="flex items-center gap-1">
                                {onSettleInstallment && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onClose();
                                      onSettleInstallment(inst);
                                      if (onToast) onToast(`Abrindo quitação da parcela #${inst.installmentNumber}...`);
                                    }}
                                    className="py-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10.5px] font-bold flex items-center gap-0.5 transition-all cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.3)] active:scale-95"
                                    title="Quitar esta parcela"
                                  >
                                    <span className="material-symbols-outlined text-[13px]">check</span>
                                    <span>Quitar</span>
                                  </button>
                                )}

                                {onNudgeWhatsApp && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onNudgeWhatsApp(inst, `Olá ${debtor.name}, lembrete sobre a parcela #${inst.installmentNumber}/${inst.totalInstallments} de ${inst.product} no valor de R$ ${safeToFixed(inst.amount || inst.originalAmount || 0)}.`);
                                    }}
                                    className="p-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold flex items-center transition-all cursor-pointer active:scale-95 shadow-2xs"
                                    title="Cobrança no WhatsApp"
                                  >
                                    <WhatsAppIcon className="w-3.5 h-3.5 text-emerald-600" size={13} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ============================================================ */}
        {/* RODAPÉ DO MODAL COMPACTO                                     */}
        {/* ============================================================ */}
        <div className="px-3.5 py-2.5 bg-white border-t border-slate-200 flex items-center justify-between gap-2.5 shrink-0">
          <span className="text-[10.5px] text-slate-400 font-mono hidden sm:inline">
            HASPAHO • Dados individuais por item de {debtor.name}
          </span>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all cursor-pointer shadow-xs active:scale-95 ml-auto"
          >
            Fechar Janela
          </button>
        </div>
      </div>
    </div>
  );
};
