import React, { useState, useEffect } from 'react';
import { Purchase, Installment, Debtor } from '../types';
import { safeToFixed, safeToNumber } from '../utils/numberUtils';
import { addMonthsToDateStr } from '../utils/dateUtils';

export interface EditPurchaseSavePayload {
  mode: 'full_purchase' | 'single_installment';
  purchaseId?: string;
  originalProductName?: string;
  debtorId: string;
  product: string;
  store: string;
  cardName: string;
  totalAmount: number;
  installmentsTotal: number;
  firstDueDate: string;
  singleInstallmentId?: string;
  singleInstallmentDueDate?: string;
  singleInstallmentAmount?: number;
}

interface EditPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchase?: Purchase | null;
  installment?: Installment | null;
  debtor?: Debtor | null;
  allInstallments: Installment[];
  onSave: (payload: EditPurchaseSavePayload) => void;
  onDeletePurchase: (purchaseId?: string, productName?: string, debtorId?: string) => void;
  onDeleteInstallment?: (installmentId: string) => void;
}

// Converte DD/MM/AAAA para YYYY-MM-DD para o input type="date"
function brDateToIso(dateStr: string): string {
  if (!dateStr) return '';
  const clean = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  const parts = clean.split('/');
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    return `${yyyy.padStart(4, '20')}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  return '';
}

// Converte YYYY-MM-DD para DD/MM/AAAA
function isoDateToBr(isoStr: string): string {
  if (!isoStr) return '';
  const clean = isoStr.trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) return clean;
  const parts = clean.split('-');
  if (parts.length === 3) {
    const [yyyy, mm, dd] = parts;
    return `${dd.padStart(2, '0')}/${mm.padStart(2, '0')}/${yyyy}`;
  }
  return clean;
}

export const EditPurchaseModal: React.FC<EditPurchaseModalProps> = ({
  isOpen,
  onClose,
  purchase,
  installment,
  debtor,
  allInstallments,
  onSave,
  onDeletePurchase,
  onDeleteInstallment,
}) => {
  const [editMode, setEditMode] = useState<'full_purchase' | 'single_installment'>('full_purchase');
  const [product, setProduct] = useState('');
  const [store, setStore] = useState('');
  const [cardName, setCardName] = useState('Nubank Croma');
  const [totalAmountStr, setTotalAmountStr] = useState('');
  const [installmentsTotal, setInstallmentsTotal] = useState(1);
  const [firstDueDateBr, setFirstDueDateBr] = useState('');
  const [singleDueDateBr, setSingleDueDateBr] = useState('');
  const [singleAmountStr, setSingleAmountStr] = useState('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Localiza todas as parcelas vinculadas a esta compra
  const linkedInstallments = React.useMemo(() => {
    const pId = purchase?.id || installment?.purchaseId;
    const prodName = (purchase?.product || installment?.product || '').trim().toLowerCase();
    const dId = purchase?.debtorId || installment?.debtorId || debtor?.id;

    return allInstallments
      .filter((inst) => {
        if (pId && inst.purchaseId === pId) return true;
        if (
          prodName &&
          (inst.product || '').trim().toLowerCase() === prodName &&
          (!dId || inst.debtorId === dId)
        ) {
          return true;
        }
        return false;
      })
      .sort((a, b) => (a.installmentNumber || 1) - (b.installmentNumber || 1));
  }, [purchase, installment, debtor, allInstallments]);

  useEffect(() => {
    if (!isOpen) return;
    setConfirmDeleteOpen(false);
    setEditMode('full_purchase');

    const resolvedProduct = purchase?.product || installment?.product || '';
    const resolvedStore = purchase?.store || installment?.cardName || 'Mercado Livre / Loja';
    const resolvedCard = purchase?.cardName || installment?.cardName || 'Nubank Croma';

    const resolvedCount =
      purchase?.installmentsTotal ||
      installment?.totalInstallments ||
      linkedInstallments.length ||
      1;

    const sumFromInsts = linkedInstallments.reduce(
      (acc, i) => acc + safeToNumber(i.originalAmount || i.amount),
      0
    );
    const resolvedTotal =
      purchase?.totalAmount ||
      sumFromInsts ||
      safeToNumber(installment?.originalAmount || installment?.amount) * resolvedCount ||
      0;

    // Descobre a data da 1ª parcela (parcela #1 ou firstDueDate da compra)
    const firstInst = linkedInstallments.find((i) => i.installmentNumber === 1) || linkedInstallments[0];
    const rawFirstDate =
      purchase?.firstDueDate ||
      firstInst?.dueDate ||
      purchase?.nextDueDate ||
      installment?.dueDate ||
      new Date().toLocaleDateString('pt-BR');

    setProduct(resolvedProduct);
    setStore(resolvedStore);
    setCardName(resolvedCard);
    setTotalAmountStr(resolvedTotal > 0 ? safeToFixed(resolvedTotal, 2) : '');
    setInstallmentsTotal(Math.max(1, resolvedCount));
    setFirstDueDateBr(isoDateToBr(rawFirstDate));

    if (installment) {
      setSingleDueDateBr(isoDateToBr(installment.dueDate || rawFirstDate));
      setSingleAmountStr(safeToFixed(installment.amount || installment.originalAmount || 0, 2));
    } else if (firstInst) {
      setSingleDueDateBr(isoDateToBr(firstInst.dueDate));
      setSingleAmountStr(safeToFixed(firstInst.amount || firstInst.originalAmount || 0, 2));
    }
  }, [isOpen, purchase, installment, linkedInstallments]);

  if (!isOpen) return null;

  const parsedTotalAmount = Math.max(0, parseFloat(totalAmountStr.replace(',', '.')) || 0);
  const parsedInstCount = Math.max(1, Number(installmentsTotal) || 1);
  const previewInstValue = parsedTotalAmount / parsedInstCount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedDebtorId =
      purchase?.debtorId || installment?.debtorId || debtor?.id || '';
    const cleanFirstDate = firstDueDateBr.trim() || new Date().toLocaleDateString('pt-BR');

    onSave({
      mode: editMode,
      purchaseId: purchase?.id || installment?.purchaseId,
      originalProductName: purchase?.product || installment?.product,
      debtorId: resolvedDebtorId,
      product: product.trim() || 'Item Parcelado',
      store: store.trim() || 'Loja Parceira',
      cardName: cardName.trim() || 'Nubank Croma',
      totalAmount: parsedTotalAmount > 0 ? parsedTotalAmount : safeToNumber(singleAmountStr) * parsedInstCount,
      installmentsTotal: parsedInstCount,
      firstDueDate: cleanFirstDate,
      singleInstallmentId: installment?.id,
      singleInstallmentDueDate: singleDueDateBr.trim() || cleanFirstDate,
      singleInstallmentAmount: Math.max(0, parseFloat(singleAmountStr.replace(',', '.')) || 0),
    });
    onClose();
  };

  const handleConfirmDeleteEntirePurchase = () => {
    const pId = purchase?.id || installment?.purchaseId;
    const prodName = purchase?.product || installment?.product || product;
    const dId = purchase?.debtorId || installment?.debtorId || debtor?.id;
    onDeletePurchase(pId, prodName, dId);
    setConfirmDeleteOpen(false);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Editar Compra e Datas das Parcelas"
      className="fixed inset-0 z-[9995] flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/75 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-3xl shadow-2xl border-2 border-cyan-400/70 w-full max-w-lg overflow-hidden my-auto text-slate-900 animate-in zoom-in-95 duration-200">
        {/* Cabeçalho */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white px-4 sm:px-5 py-3.5 flex items-center justify-between border-b border-cyan-500/30">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">edit_calendar</span>
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-sm sm:text-base leading-tight truncate">
                Editar Compra &amp; Data da 1ª Parcela
              </h3>
              <p className="text-[11px] text-cyan-200/90 font-medium truncate">
                {debtor?.name || purchase?.debtorName || installment?.debtorName || 'Cliente'} • Corrija informações sem precisar recriar
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white flex items-center justify-center cursor-pointer transition-colors shrink-0"
            title="Fechar"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Seletor de Modo: Editar Compra Completa vs Apenas Esta Parcela */}
        {installment && (
          <div className="px-4 pt-3 bg-slate-50 border-b border-slate-200 pb-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditMode('full_purchase')}
              className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                editMode === 'full_purchase'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">shopping_bag</span>
              <span>Editar Compra Completa ({linkedInstallments.length || parsedInstCount}x)</span>
            </button>

            <button
              type="button"
              onClick={() => setEditMode('single_installment')}
              className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                editMode === 'single_installment'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">event</span>
              <span>Só Parcela #{installment.installmentNumber}</span>
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5 text-xs">
          {/* Nome do Produto / Item */}
          <div>
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 mb-1">
              Nome do Produto / Item Comprado *
            </label>
            <input
              type="text"
              required
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder="Ex: Smart TV 55 Polegadas, Celular..."
              className="w-full h-10 px-3 rounded-xl border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-900 outline-none"
            />
          </div>

          {editMode === 'full_purchase' ? (
            <>
              {/* Data da 1ª Parcela (Destaque especial para corrigir datas esquecidas) */}
              <div className="p-3 rounded-2xl bg-amber-50/90 border-2 border-amber-300/90 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-amber-600">calendar_month</span>
                    <span>Data da 1ª Parcela (Vencimento Inicial) *</span>
                  </label>
                  <span className="text-[10px] font-bold bg-amber-200/80 text-amber-950 px-2 py-0.5 rounded-full">
                    Recalcula meses seguintes
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Input DD/MM/AAAA direto */}
                  <div>
                    <span className="text-[10px] text-amber-800 font-semibold block mb-0.5">
                      Digite (DD/MM/AAAA):
                    </span>
                    <input
                      type="text"
                      required
                      value={firstDueDateBr}
                      onChange={(e) => setFirstDueDateBr(e.target.value)}
                      placeholder="Ex: 10/10/2026"
                      className="w-full h-9 px-3 rounded-xl bg-white border border-amber-400 font-mono font-black text-slate-900 text-xs outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  {/* Seletor de Calendário Nativo */}
                  <div>
                    <span className="text-[10px] text-amber-800 font-semibold block mb-0.5">
                      Ou escolha no calendário:
                    </span>
                    <input
                      type="date"
                      value={brDateToIso(firstDueDateBr)}
                      onChange={(e) => {
                        if (e.target.value) {
                          setFirstDueDateBr(isoDateToBr(e.target.value));
                        }
                      }}
                      className="w-full h-9 px-2.5 rounded-xl bg-white border border-amber-400 font-mono font-bold text-slate-900 text-xs outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                    />
                  </div>
                </div>

                {firstDueDateBr && parsedInstCount > 1 && (
                  <p className="text-[10.5px] text-amber-900 font-medium pt-0.5">
                    📅 Cronograma automático: <strong>1ª em {firstDueDateBr}</strong> → 2ª em{' '}
                    <strong>{addMonthsToDateStr(firstDueDateBr, 1)}</strong> ... até a {parsedInstCount}ª em{' '}
                    <strong>{addMonthsToDateStr(firstDueDateBr, parsedInstCount - 1)}</strong>.
                  </p>
                )}
              </div>

              {/* Valor Total e Quantidade de Parcelas */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 mb-1">
                    Valor Total da Compra (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={totalAmountStr}
                    onChange={(e) => setTotalAmountStr(e.target.value)}
                    placeholder="Ex: 2400.00"
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 focus:border-blue-600 font-mono font-bold text-slate-900 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 mb-1">
                    Nº de Parcelas *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    required
                    value={installmentsTotal}
                    onChange={(e) => setInstallmentsTotal(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 focus:border-blue-600 font-mono font-bold text-slate-900 outline-none"
                  />
                </div>
              </div>

              {/* Loja e Cartão / Forma */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 mb-1">
                    Loja / Origem
                  </label>
                  <input
                    type="text"
                    value={store}
                    onChange={(e) => setStore(e.target.value)}
                    placeholder="Ex: Mercado Livre, Casas Bahia"
                    className="w-full h-9 px-3 rounded-xl border border-slate-300 focus:border-blue-600 font-semibold text-slate-800 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 mb-1">
                    Cartão / Forma
                  </label>
                  <input
                    type="text"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    placeholder="Ex: Nubank, PIX, Boleto"
                    className="w-full h-9 px-3 rounded-xl border border-slate-300 focus:border-blue-600 font-semibold text-slate-800 outline-none"
                  />
                </div>
              </div>

              {/* Resumo do Cálculo */}
              <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between">
                <span className="text-[11px] font-bold text-blue-900">
                  Valor atualizado de cada parcela ({parsedInstCount}x):
                </span>
                <span className="font-mono font-black text-sm text-blue-700">
                  R$ {safeToFixed(previewInstValue, 2).replace('.', ',')}
                </span>
              </div>
            </>
          ) : (
            /* Modo de Edição de Parcela Individual */
            <div className="p-3 rounded-2xl bg-indigo-50/80 border border-indigo-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-black text-indigo-950 text-xs">
                  Editando apenas a Parcela #{installment?.installmentNumber}/{installment?.totalInstallments}
                </span>
                <span className="text-[10px] font-mono bg-indigo-200/70 text-indigo-900 px-2 py-0.5 rounded-md font-bold">
                  Individual
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10.5px] font-bold text-indigo-950 mb-1">
                    Vencimento desta Parcela (DD/MM/AAAA):
                  </label>
                  <input
                    type="text"
                    required
                    value={singleDueDateBr}
                    onChange={(e) => setSingleDueDateBr(e.target.value)}
                    placeholder="Ex: 10/10/2026"
                    className="w-full h-9 px-3 rounded-xl bg-white border border-indigo-300 font-mono font-bold text-slate-900 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10.5px] font-bold text-indigo-950 mb-1">
                    Escolher no Calendário:
                  </label>
                  <input
                    type="date"
                    value={brDateToIso(singleDueDateBr)}
                    onChange={(e) => {
                      if (e.target.value) setSingleDueDateBr(isoDateToBr(e.target.value));
                    }}
                    className="w-full h-9 px-2.5 rounded-xl bg-white border border-indigo-300 font-mono font-bold text-slate-900 outline-none cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10.5px] font-bold text-indigo-950 mb-1">
                    Valor desta Parcela (R$):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={singleAmountStr}
                    onChange={(e) => setSingleAmountStr(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-white border border-indigo-300 font-mono font-bold text-slate-900 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10.5px] font-bold text-indigo-950 mb-1">
                    Cartão / Forma:
                  </label>
                  <input
                    type="text"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-white border border-indigo-300 font-semibold text-slate-900 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Área de Exclusão Rápida caso tenha cadastrado duplicado ou por engano */}
          <div className="pt-2 border-t border-slate-200">
            {!confirmDeleteOpen ? (
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteOpen(true)}
                  className="py-2 px-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-[11px] flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                  title="Excluir esta compra inteira e todas as suas parcelas"
                >
                  <span className="material-symbols-outlined text-[16px]">delete_forever</span>
                  <span>Excluir Compra Inteira ({product || 'Item'})</span>
                </button>

                {installment && onDeleteInstallment && (
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteInstallment(installment.id);
                      onClose();
                    }}
                    className="py-2 px-2.5 rounded-xl bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-700 border border-slate-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-all"
                  >
                    <span className="material-symbols-outlined text-[15px]">delete</span>
                    <span>Excluir só Parcela #{installment.installmentNumber}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-red-50 border-2 border-red-300 space-y-2 animate-in fade-in duration-150">
                <p className="text-xs font-extrabold text-red-900 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[17px] text-red-600">warning</span>
                  <span>Confirmar exclusão definitiva da compra "{product}"?</span>
                </p>
                <p className="text-[11px] text-red-700">
                  Isso removerá este produto e todas as suas {linkedInstallments.length || parsedInstCount} parcelas do sistema e do banco de dados, sem reaparecer ao atualizar a página.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleConfirmDeleteEntirePurchase}
                    className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs flex items-center justify-center gap-1 cursor-pointer shadow-xs active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[15px]">delete_forever</span>
                    <span>Sim, Excluir Compra Completa</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteOpen(false)}
                    className="py-2 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Botões Principais Salvar / Cancelar */}
          <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="h-10 px-5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[17px]">save</span>
              <span>Salvar Alterações</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
