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
    notes?: string;
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

      const safeDebs = (debtors || []).filter((d): d is Debtor => !!d && !!d.id);
      if (selectedDebtorId && selectedDebtorId !== 'all' && safeDebs.some((d) => d.id === selectedDebtorId)) {
        setDebtorId(selectedDebtorId);
        const currentDeb = safeDebs.find((d) => d.id === selectedDebtorId);
        if (currentDeb?.relation) setRelation(currentDeb.relation);
      } else if (safeDebs.length > 0) {
        setDebtorId(safeDebs[0].id);
        if (safeDebs[0].relation) setRelation(safeDebs[0].relation);
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

  const safeDebtorsList = (debtors || []).filter((d): d is Debtor => !!d && !!d.id);

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
    if (!isOpen || totalNum <= 0 || installmentsTotal <= 0 || !firstDueDate) return [];
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
  }, [isOpen, totalNum, installmentsTotal, firstDueDate]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const effectiveDebtorId =
      debtorId && safeDebtorsList.some((d) => d.id === debtorId)
        ? debtorId
        : selectedDebtorId && selectedDebtorId !== 'all' && safeDebtorsList.some((d) => d.id === selectedDebtorId)
        ? selectedDebtorId
        : safeDebtorsList[0]?.id || '';

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
      notes: notes.trim(),
    });

    setProduct('');
    setStore('');
    setTotalAmount('');
    setNotes('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200 pointer-events-auto">
      <div className="w-full max-w-xl bg-gradient-to-b from-[#0b1b36] via-[#0e2447] to-[#081326] rounded-2xl sm:rounded-3xl shadow-[0_20px_60px_rgba(6,182,212,0.35)] flex flex-col max-h-[94vh] sm:max-h-[92vh] overflow-hidden border-2 border-cyan-400/80 my-auto shrink-0 text-white pointer-events-auto">
        
        {/* Topo do Modal com Botão Voltar & Fechar - TEMA ESCURO CÓSMICO IGUAL AO NOVO DEVEDOR */}
        <div className="flex items-center justify-between px-3.5 py-2.5 sm:px-4 sm:py-3 border-b border-white/10 bg-[#09152b]/95 text-white shrink-0 gap-2">
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
            <div className="flex items-center justify-center gap-1.5">
              <span className="material-symbols-outlined text-cyan-300 text-[18px]">add_shopping_cart</span>
              <h3 className="font-black text-white text-xs sm:text-sm md:text-base leading-tight truncate">
                Nova Compra
              </h3>
            </div>
            <span className="text-[10px] sm:text-[10.5px] text-cyan-300 font-medium block truncate">
              Janela de Anotações &amp; Lançamento de Itens
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

        {/* Corpo do Formulário Estruturado em Estilo Cósmico / Azul Escuro */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-3.5 py-3 sm:px-5 sm:py-4 flex flex-col gap-3.5 text-xs text-white scrollbar-thin">
          {validationError && (
            <div className="p-2.5 bg-red-500/20 border border-red-500/40 rounded-xl text-xs text-red-200 font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-red-400 shrink-0">error</span>
              <span>{validationError}</span>
            </div>
          )}

          {/* 1. DEVEDOR RESPONSÁVEL (COLUNA) */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-cyan-400 text-[15px]">person</span>
                <span>1. Devedor Responsável</span>
              </label>
              {onOpenNewDebtor && (
                <button
                  type="button"
                  onClick={onOpenNewDebtor}
                  className="text-[11px] text-cyan-300 hover:text-cyan-100 font-bold flex items-center gap-0.5 cursor-pointer hover:underline"
                >
                  <span className="material-symbols-outlined text-[13px]">person_add</span>
                  <span>+ Novo Devedor</span>
                </button>
              )}
            </div>

            {safeDebtorsList.length === 0 ? (
              <div className="p-3 bg-amber-500/20 border border-amber-500/40 rounded-xl text-xs text-amber-200 font-semibold flex items-center justify-between">
                <span>Nenhum devedor cadastrado. Cadastre um novo devedor primeiro.</span>
                {onOpenNewDebtor && (
                  <button
                    type="button"
                    onClick={onOpenNewDebtor}
                    className="px-2.5 py-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg font-black text-[11px] cursor-pointer"
                  >
                    + Novo Devedor
                  </button>
                )}
              </div>
            ) : (
              <select
                value={debtorId || safeDebtorsList[0]?.id || ''}
                onChange={(e) => handleDebtorChange(e.target.value)}
                className="w-full h-10 px-3 bg-[#0e2447] border border-cyan-500/40 rounded-xl text-xs font-bold text-white focus:border-cyan-400 outline-none cursor-pointer"
                required
              >
                {safeDebtorsList.map((d) => (
                  <option key={d.id} value={d.id} className="bg-slate-900 text-white">
                    👤 {d.name || 'Sem nome'} {d.relation ? `(Vínculo: ${d.relation})` : ''} {d.phone ? `• ${d.phone}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 2. OPÇÕES DE VÍNCULO EM COLUNA */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-cyan-400 text-[15px]">diversity_3</span>
              <span>2. Tipo de Vínculo com o Devedor</span>
            </label>
            <select
              value={relation}
              onChange={(e) => setRelation(e.target.value)}
              className="w-full h-10 px-3 bg-[#0e2447] border border-cyan-500/40 rounded-xl text-xs font-bold text-white focus:border-cyan-400 outline-none cursor-pointer"
            >
              {RELATION_OPTIONS.map((opt) => (
                <option key={opt} value={opt} className="bg-slate-900 text-white">
                  🤝 {opt}
                </option>
              ))}
            </select>
          </div>

          {/* 3. PRODUTO / DESCRIÇÃO (COLUNA) */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-cyan-400 text-[15px]">inventory_2</span>
              <span>3. Produto / Descrição do Auxílio *</span>
            </label>
            <input
              type="text"
              placeholder="Ex: Smartphone Samsung Galaxy, Notebook Dell, Geladeira..."
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              className="w-full h-10 px-3 bg-white/10 border border-cyan-500/40 rounded-xl text-xs font-medium text-white placeholder-slate-400 focus:bg-white/15 focus:border-cyan-400 outline-none transition-all"
              required
            />
          </div>

          {/* 4. LOJA / ESTABELECIMENTO (COLUNA) */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-amber-400 text-[15px]">store</span>
              <span>4. Loja / Estabelecimento</span>
            </label>
            <input
              type="text"
              placeholder="Ex: Mercado Livre, Magazine Luiza, Loja Física..."
              value={store}
              onChange={(e) => setStore(e.target.value)}
              className="w-full h-10 px-3 bg-white/10 border border-cyan-500/40 rounded-xl text-xs font-medium text-white placeholder-slate-400 focus:bg-white/15 focus:border-cyan-400 outline-none transition-all"
            />
          </div>

          {/* 5. DATA DA OPERAÇÃO / DESEMBOLSO */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-cyan-400 text-[15px]">calendar_today</span>
              <span>5. Data da Operação (Desembolso Realizado)</span>
            </label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full h-10 px-3 bg-white/10 border border-cyan-500/40 rounded-xl text-xs font-semibold text-white focus:bg-white/15 focus:border-cyan-400 outline-none cursor-pointer [color-scheme:dark]"
            />
          </div>

          {/* 6. MEIO DE PAGAMENTO UTILIZADO */}
          <div className="flex flex-col gap-1">
            <PaymentMethodSelector
              value={cardName}
              onChange={setCardName}
              label="6. Meio de pagamento utilizado"
              theme="dark"
            />
          </div>

          {/* 7. VALOR TOTAL DESEMBOLSADO */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-emerald-400 text-[15px]">payments</span>
              <span>7. Valor Total Desembolsado (R$) *</span>
            </label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              className="w-full h-11 px-3 bg-white/10 border border-emerald-500/50 rounded-xl text-base font-black text-white placeholder-slate-400 focus:bg-white/15 focus:border-emerald-400 outline-none font-mono"
              required
            />
          </div>

          {/* 8. NÚMERO DE PARCELAS */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-cyan-400 text-[15px]">calendar_view_day</span>
              <span>8. Plano de Parcelas de Restituição</span>
            </label>
            <select
              value={installmentsTotal}
              onChange={(e) => setInstallmentsTotal(parseInt(e.target.value, 10) || 1)}
              className="w-full h-10 px-3 bg-[#0e2447] border border-cyan-500/40 rounded-xl text-xs font-bold text-white focus:border-cyan-400 outline-none cursor-pointer"
            >
              {Array.from({ length: 48 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n} className="bg-slate-900 text-white">
                  {n}x {n === 1 ? '(À vista)' : 'parcelas'} {totalNum > 0 ? `• R$ ${(totalNum / n).toFixed(2).replace('.', ',')} / mês` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 9. DATA DO 1º VENCIMENTO */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-cyan-400 text-[15px]">event</span>
                <span>9. Data do 1º Vencimento *</span>
              </label>
              {schedulePreview.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowSchedulePreview(!showSchedulePreview)}
                  className="text-[11px] text-cyan-300 hover:text-cyan-100 font-bold flex items-center gap-0.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[13px]">calendar_month</span>
                  <span>{showSchedulePreview ? 'Ocultar Cronograma' : 'Ver Cronograma'}</span>
                </button>
              )}
            </div>

            <input
              type="date"
              value={firstDueDate}
              onChange={(e) => setFirstDueDate(e.target.value)}
              className="w-full h-10 px-3 bg-white/10 border border-cyan-500/40 rounded-xl text-xs font-semibold text-white focus:bg-white/15 focus:border-cyan-400 outline-none cursor-pointer [color-scheme:dark]"
              required
            />

            {/* Cronograma Crescente em Coluna */}
            {showSchedulePreview && schedulePreview.length > 0 && (
              <div className="mt-2 p-3 bg-slate-900/80 rounded-2xl border border-cyan-500/30 flex flex-col gap-1.5 animate-in fade-in">
                <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider block mb-0.5">
                  Cronograma de Vencimentos em Coluna ({schedulePreview.length} parcelas):
                </span>
                <div className="flex flex-col gap-1">
                  {schedulePreview.map((item) => (
                    <div key={item.num} className="p-2 bg-white/5 rounded-xl border border-cyan-500/20 flex items-center justify-between text-xs text-slate-200">
                      <span className="font-bold text-slate-200">{item.num}ª Parcela:</span>
                      <span className="font-mono text-cyan-300 font-semibold">{item.due} • R$ {item.amount.toFixed(2).replace('.', ',')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 10. QUADRO DE TRANSPARÊNCIA DO AUXÍLIO */}
          {totalNum > 0 && (
            <div className="p-3.5 bg-gradient-to-br from-emerald-950/60 to-teal-950/60 border-2 border-emerald-500/50 rounded-2xl flex flex-col gap-2.5 text-white">
              <div className="flex items-center justify-between pb-1.5 border-b border-emerald-500/30">
                <span className="text-xs font-black text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-emerald-400">verified</span>
                  Quadro de Restituição (Sem Juros)
                </span>
                <span className="text-xs font-black text-emerald-200 font-mono">
                  {installmentsTotal}x de R$ {installmentVal.replace('.', ',')}
                </span>
              </div>

              <div className="flex flex-col gap-1 text-[11px]">
                <div className="p-2 bg-slate-900/60 rounded-xl border border-emerald-500/20 flex items-center justify-between">
                  <span className="text-slate-300 font-medium">Valor Desembolsado:</span>
                  <span className="font-bold text-white">R$ {totalNum.toFixed(2).replace('.', ',')}</span>
                </div>
                <div className="p-2 bg-slate-900/60 rounded-xl border border-emerald-500/20 flex items-center justify-between">
                  <span className="text-emerald-300 font-medium">Remuneração / Lucro pelo Auxílio:</span>
                  <span className="font-bold text-emerald-300">R$ 0,00</span>
                </div>
                <div className="p-2 bg-slate-900/60 rounded-xl border border-emerald-500/20 flex items-center justify-between">
                  <span className="text-emerald-300 font-medium">Taxa Administrativa / Comissão:</span>
                  <span className="font-bold text-emerald-300">R$ 0,00</span>
                </div>
                <div className="p-2.5 bg-emerald-500/20 rounded-xl border border-emerald-400/40 flex items-center justify-between font-bold">
                  <span className="text-emerald-200 font-bold">Total a Restituir:</span>
                  <span className="font-black text-emerald-100 text-xs font-mono">R$ {totalNum.toFixed(2).replace('.', ',')}</span>
                </div>
              </div>
            </div>
          )}

          {/* 11. OBSERVAÇÃO / ANOTAÇÕES DO PRODUTO OU ITEM COMPRADO */}
          <div className="flex flex-col gap-1.5 bg-white/5 p-3.5 rounded-2xl border border-cyan-500/30">
            <label className="text-[11px] font-bold text-cyan-200 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-cyan-400 text-[17px]">edit_note</span>
              <span>11. Anotações &amp; Detalhes do Produto / Item Comprado</span>
            </label>
            <textarea
              rows={3}
              placeholder="Digite aqui as anotações detalhadas referentes ao produto ou item comprado (ex: modelo, cor, especificações, número de série ou observações adicionais)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 bg-white/10 border border-cyan-500/40 rounded-xl text-xs text-white placeholder-slate-400 focus:border-cyan-400 outline-none resize-none shadow-2xs"
            />
          </div>

          {/* Rodapé Fixo com Botão de Ação */}
          <div className="sticky bottom-0 bg-[#081326] pt-3 pb-1 border-t border-white/10 flex items-center gap-2.5 mt-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 h-10 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-slate-300 font-bold text-xs border border-white/10 transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 h-10 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 active:scale-95 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[17px]">check_circle</span>
              <span>Cadastrar Compra</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
