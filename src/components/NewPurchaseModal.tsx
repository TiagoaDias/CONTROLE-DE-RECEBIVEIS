import React, { useState, useEffect, useMemo } from 'react';
import { Debtor } from '../types';
import { addMonthsToDateStr } from '../utils/dateUtils';
import { PaymentMethodSelector } from './PaymentMethodSelector';

interface NewPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  debtors: Debtor[];
  selectedDebtorId?: string;
  onAddPurchase: (purchase: {
    debtorId: string;
    product: string;
    store: string;
    cardName: string;
    totalAmount: number;
    installmentsTotal: number;
    firstDueDate: string;
  }) => void;
  onOpenNewDebtor: () => void;
}

const RELATION_OPTIONS = [
  'Amigo(a)',
  'Família',
  'Colega de Trabalho',
  'Vizinho(a)',
  'Prestador de Serviço',
  'Outro Vínculo Particular',
];

export const NewPurchaseModal: React.FC<NewPurchaseModalProps> = ({
  isOpen,
  onClose,
  debtors,
  selectedDebtorId,
  onAddPurchase,
  onOpenNewDebtor,
}) => {
  const [debtorId, setDebtorId] = useState<string>('');
  const [relation, setRelation] = useState<string>('Amigo(a)');
  const [product, setProduct] = useState('');
  const [store, setStore] = useState('');
  const [cardName, setCardName] = useState('Nubank Croma');
  const [isManualCard, setIsManualCard] = useState<boolean>(false);
  const [manualCardInput, setManualCardInput] = useState<string>('');
  const [totalAmount, setTotalAmount] = useState('');
  const [installmentsTotal, setInstallmentsTotal] = useState(12);
  const [firstDueDate, setFirstDueDate] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [notes, setNotes] = useState('');
  const [showSchedulePreview, setShowSchedulePreview] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Inicializar datas padrão ao abrir
  useEffect(() => {
    if (isOpen) {
      setValidationError(null);
      const today = new Date();
      const todayIso = today.toISOString().split('T')[0];
      setPurchaseDate(todayIso);

      // 1º vencimento no próximo mês
      const nextMonth = new Date(today);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const nextMonthIso = nextMonth.toISOString().split('T')[0];
      setFirstDueDate(nextMonthIso);

      if (selectedDebtorId && Array.isArray(debtors) && debtors.some((d) => d && d.id === selectedDebtorId)) {
        setDebtorId(selectedDebtorId);
        const currentDeb = debtors.find((d) => d && d.id === selectedDebtorId);
        if (currentDeb?.relation) setRelation(currentDeb.relation);
      } else if (Array.isArray(debtors) && debtors.length > 0 && debtors[0]) {
        setDebtorId(debtors[0].id);
        if (debtors[0].relation) setRelation(debtors[0].relation);
      }
    }
  }, [isOpen, selectedDebtorId, debtors]);

  // Atualizar vínculo quando o devedor muda
  const handleDebtorChange = (newId: string) => {
    setDebtorId(newId);
    const selected = (debtors || []).find((d) => d && d.id === newId);
    if (selected?.relation) {
      setRelation(selected.relation);
    }
  };

  if (!isOpen) return null;

  // Helper para interpretar valor digitado (ex: 2500, 2.500,00 ou 2500,00)
  const parseAmountNumber = (val: string): number => {
    if (!val) return 0;
    let cleaned = String(val).trim();
    if (cleaned.includes(',') && cleaned.includes('.')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (cleaned.includes(',')) {
      cleaned = cleaned.replace(',', '.');
    }
    return parseFloat(cleaned) || 0;
  };

  const totalNum = parseAmountNumber(totalAmount);
  const installmentVal = installmentsTotal > 0 ? (totalNum / installmentsTotal).toFixed(2) : '0.00';

  // Gerar prévia do cronograma de parcelas em coluna vertical
  const schedulePreview = useMemo(() => {
    if (totalNum <= 0 || installmentsTotal <= 0 || !firstDueDate) return [];
    try {
      const items = [];
      const valEach = totalNum / installmentsTotal;
      const parts = String(firstDueDate).split('-');
      const baseFormatted = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : firstDueDate;

      const maxItems = Math.min(installmentsTotal, 8);
      for (let i = 1; i <= maxItems; i++) {
        const due = addMonthsToDateStr(baseFormatted, i - 1);
        items.push({
          num: i,
          due,
          amount: valEach,
        });
      }
      return items;
    } catch {
      return [];
    }
  }, [totalNum, installmentsTotal, firstDueDate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const safeDebtors = Array.isArray(debtors) ? debtors : [];
    const effectiveDebtorId =
      debtorId && safeDebtors.some((d) => d && d.id === debtorId)
        ? debtorId
        : selectedDebtorId && safeDebtors.some((d) => d && d.id === selectedDebtorId)
        ? selectedDebtorId
        : safeDebtors[0]?.id || '';

    if (!effectiveDebtorId) {
      setValidationError('Por favor, selecione ou cadastre um devedor para vincular a compra.');
      return;
    }

    if (!product.trim()) {
      setValidationError('Por favor, informe a descrição ou nome do produto.');
      return;
    }

    if (totalNum <= 0) {
      setValidationError('Por favor, informe um valor total válido maior que zero.');
      return;
    }

    const finalCardName = isManualCard && manualCardInput.trim() ? manualCardInput.trim() : cardName;

    onAddPurchase({
      debtorId: effectiveDebtorId,
      product: product.trim(),
      store: store.trim() || 'Mercado Livre / Loja',
      cardName: finalCardName || 'Nubank Croma',
      totalAmount: totalNum,
      installmentsTotal: Math.max(1, installmentsTotal),
      firstDueDate: firstDueDate || '2026-10-10',
    });

    setProduct('');
    setStore('');
    setTotalAmount('');
    setNotes('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex flex-col items-center justify-start overflow-y-auto pt-16 sm:pt-20 pb-24 sm:pb-28 px-3 sm:px-6 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl flex flex-col max-h-[calc(100dvh-160px)] sm:max-h-[calc(100dvh-180px)] overflow-hidden border border-slate-200 my-auto shrink-0">
        
        {/* Topo do Modal com Botão Voltar & Fechar */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-900 text-white shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-bold flex items-center gap-1 transition-all cursor-pointer border border-white/10"
            title="Voltar"
          >
            <span className="material-symbols-outlined text-[17px]">arrow_back</span>
            <span>Voltar</span>
          </button>

          <div className="text-center min-w-0 px-2">
            <h3 className="font-bold text-white text-sm sm:text-base leading-tight truncate">
              Nova Compra / Repasse Parcelado
            </h3>
            <span className="text-[10.5px] text-slate-300 block">
              Registro de Auxílio e Compromisso de Restituição
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-red-500/20 hover:text-red-300 text-slate-300 flex items-center justify-center transition-colors cursor-pointer border border-white/10"
            title="Fechar (X)"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Corpo do Formulário Estruturado 100% em COLUNA VERTICAL */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-4 text-xs">
          {validationError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-red-600 shrink-0">error</span>
              <span>{validationError}</span>
            </div>
          )}

          {/* 1. DEVEDOR RESPONSÁVEL (COLUNA) */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-blue-600 text-[17px]">person</span>
                <span>1. Devedor Responsável</span>
              </label>
              {onOpenNewDebtor && (
                <button
                  type="button"
                  onClick={onOpenNewDebtor}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-0.5 cursor-pointer hover:underline"
                >
                  <span className="material-symbols-outlined text-[14px]">person_add</span>
                  <span>+ Novo Devedor</span>
                </button>
              )}
            </div>

            {(!debtors || debtors.length === 0) ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 font-semibold flex items-center justify-between">
                <span>Nenhum devedor cadastrado. Cadastre um novo devedor primeiro.</span>
                {onOpenNewDebtor && (
                  <button
                    type="button"
                    onClick={onOpenNewDebtor}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[11px] cursor-pointer"
                  >
                    + Novo Devedor
                  </button>
                )}
              </div>
            ) : (
              <select
                value={debtorId}
                onChange={(e) => handleDebtorChange(e.target.value)}
                className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none cursor-pointer"
                required
              >
                {debtors.map((d) => (
                  <option key={d.id} value={d.id}>
                    👤 {d.name || 'Sem nome'} {d.relation ? `(Vínculo: ${d.relation})` : ''} {d.phone ? `• ${d.phone}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 2. OPÇÕES DE VÍNCULO EM COLUNA / SELECT ESTRUTURADO */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-blue-600 text-[17px]">diversity_3</span>
              <span>2. Tipo de Vínculo com o Devedor</span>
            </label>
            <select
              value={relation}
              onChange={(e) => setRelation(e.target.value)}
              className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none cursor-pointer"
            >
              {RELATION_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  🤝 {opt}
                </option>
              ))}
            </select>
          </div>

          {/* 3. PRODUTO / DESCRIÇÃO (COLUNA) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-blue-600 text-[17px]">shopping_bag</span>
              <span>3. Produto / Descrição do Auxílio *</span>
            </label>
            <input
              type="text"
              placeholder="Ex: Smartphone Samsung Galaxy, Notebook Dell, Geladeira..."
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none"
              required
            />
          </div>

          {/* 4. LOJA / ESTABELECIMENTO (COLUNA) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-blue-600 text-[17px]">storefront</span>
              <span>4. Loja / Estabelecimento</span>
            </label>
            <input
              type="text"
              placeholder="Ex: Mercado Livre, Magazine Luiza, Loja Física..."
              value={store}
              onChange={(e) => setStore(e.target.value)}
              className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none"
            />
          </div>

          {/* 5. DATA DA OPERAÇÃO / DESEMBOLSO (COLUNA) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-blue-600 text-[17px]">calendar_today</span>
              <span>5. Data da Operação (Desembolso Realizado)</span>
            </label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none cursor-pointer"
            />
          </div>

          {/* 6. MEIO DE PAGAMENTO UTILIZADO */}
          <div className="flex flex-col gap-1.5">
            <PaymentMethodSelector
              value={cardName}
              onChange={setCardName}
              label="6. Meio de pagamento utilizado"
              theme="light"
            />
          </div>

          {/* 7. VALOR TOTAL DESEMBOLSADO (COLUNA) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-blue-600 text-[17px]">attach_money</span>
              <span>7. Valor Total Desembolsado (R$) *</span>
            </label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              className="w-full h-12 px-3 bg-slate-50 border border-slate-300 rounded-xl text-base font-black text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none font-mono"
              required
            />
          </div>

          {/* 8. NÚMERO DE PARCELAS (COLUNA) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-blue-600 text-[17px]">format_list_numbered</span>
              <span>8. Plano de Parcelas de Restituição</span>
            </label>
            <select
              value={installmentsTotal}
              onChange={(e) => setInstallmentsTotal(parseInt(e.target.value, 10) || 1)}
              className="w-full h-11 px-3 bg-white border-2 border-blue-400 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer shadow-2xs"
            >
              {Array.from({ length: 48 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}x {n === 1 ? '(À vista)' : 'parcelas'} {totalNum > 0 ? `• R$ ${(totalNum / n).toFixed(2).replace('.', ',')} / mês` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 9. DATA DO 1º VENCIMENTO (COLUNA) */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-blue-600 text-[17px]">event</span>
                <span>9. Data do 1º Vencimento *</span>
              </label>
              {schedulePreview.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowSchedulePreview(!showSchedulePreview)}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-0.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">calendar_month</span>
                  <span>{showSchedulePreview ? 'Ocultar Cronograma' : 'Ver Cronograma'}</span>
                </button>
              )}
            </div>

            <input
              type="date"
              value={firstDueDate}
              onChange={(e) => setFirstDueDate(e.target.value)}
              className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none cursor-pointer"
              required
            />

            {/* Cronograma Crescente em Coluna */}
            {showSchedulePreview && schedulePreview.length > 0 && (
              <div className="mt-2 p-3 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col gap-1.5 animate-in fade-in">
                <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
                  Cronograma de Vencimentos em Coluna ({schedulePreview.length} parcelas):
                </span>
                <div className="flex flex-col gap-1">
                  {schedulePreview.map((item) => (
                    <div key={item.num} className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700">{item.num}ª Parcela:</span>
                      <span className="font-mono text-slate-900 font-semibold">{item.due} • R$ {item.amount.toFixed(2).replace('.', ',')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 10. QUADRO DE TRANSPARÊNCIA DO AUXÍLIO EM LINHAS / COLUNAS VERTICAIS */}
          {totalNum > 0 && (
            <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-300 rounded-2xl flex flex-col gap-2.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-emerald-200">
                <span className="text-xs font-black text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px] text-emerald-600">verified</span>
                  Quadro de Restituição (Sem Juros)
                </span>
                <span className="text-xs font-black text-emerald-900 font-mono">
                  {installmentsTotal}x de R$ {installmentVal.replace('.', ',')}
                </span>
              </div>

              <div className="flex flex-col gap-1 text-[11px]">
                <div className="p-2 bg-white rounded-xl border border-emerald-100 flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Valor Desembolsado:</span>
                  <span className="font-bold text-slate-900">R$ {totalNum.toFixed(2).replace('.', ',')}</span>
                </div>
                <div className="p-2 bg-white rounded-xl border border-emerald-100 flex items-center justify-between">
                  <span className="text-emerald-700 font-medium">Remuneração / Lucro pelo Auxílio:</span>
                  <span className="font-bold text-emerald-800">R$ 0,00</span>
                </div>
                <div className="p-2 bg-white rounded-xl border border-emerald-100 flex items-center justify-between">
                  <span className="text-emerald-700 font-medium">Taxa Administrativa / Comissão:</span>
                  <span className="font-bold text-emerald-800">R$ 0,00</span>
                </div>
                <div className="p-2.5 bg-emerald-100/70 rounded-xl border border-emerald-200 flex items-center justify-between font-bold">
                  <span className="text-emerald-950 font-bold">Total a Restituir:</span>
                  <span className="font-black text-emerald-950 text-xs font-mono">R$ {totalNum.toFixed(2).replace('.', ',')}</span>
                </div>
              </div>
            </div>
          )}

          {/* 11. OBSERVAÇÃO / NOTA DO AUXÍLIO (COLUNA) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-blue-600 text-[17px]">notes</span>
              <span>11. Observação / Finalidade do Auxílio (Opcional)</span>
            </label>
            <input
              type="text"
              placeholder="Ex: Aquisição de insumos para trabalho, auxílio particular..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none"
            />
          </div>

          {/* Rodapé Fixo com Botão de Ação */}
          <div className="sticky bottom-0 bg-white pt-3 pb-1 border-t border-slate-200 flex items-center gap-2.5 mt-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold text-xs transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              <span>Cadastrar Compra</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
