import React, { useState, useMemo } from 'react';
import { Debtor, Purchase, Installment } from '../types';
import { downloadIndividualReceiptPdf } from '../utils/receiptPdfHelper';
import { getCleanDebtorAvatar } from './DebtorsMasterSpreadsheet';
import { getProductIcon } from '../utils/debtorItemsUtils';

interface PdfDocumentsHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  debtors: Debtor[];
  purchases: Purchase[];
  installments: Installment[];
  onOpenExtratoTotal: (purchaseId?: string, debtorId?: string) => void;
  onOpenContract: (debtorId: string) => void;
  onShowProof: (
    payer: string,
    amount: string,
    date: string,
    dest: string,
    auth: string,
    item: string
  ) => void;
  onToast?: (msg: string) => void;
  initialDebtorId?: string;
}

export const PdfDocumentsHubModal: React.FC<PdfDocumentsHubModalProps> = ({
  isOpen,
  onClose,
  debtors = [],
  purchases = [],
  installments = [],
  onOpenExtratoTotal,
  onOpenContract,
  onShowProof,
  onToast,
  initialDebtorId,
}) => {
  const [selectedDebtorId, setSelectedDebtorId] = useState<string>(() => initialDebtorId || debtors[0]?.id || '');

  React.useEffect(() => {
    if (initialDebtorId) {
      setSelectedDebtorId(initialDebtorId);
    }
  }, [initialDebtorId]);
  const [selectedProductId, setSelectedProductId] = useState<string>('all');
  const [activeDocType, setActiveDocType] = useState<'extrato' | 'recibo' | 'contrato'>('extrato');
  const [isDebtorPickerOpen, setIsDebtorPickerOpen] = useState(false);
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);

  // Parcela selecionada para emissão de recibo individual
  const [selectedInstallmentId, setSelectedInstallmentId] = useState<string>('');

  const currentDebtor = useMemo(() => {
    return debtors.find((d) => d.id === selectedDebtorId) || debtors[0] || null;
  }, [debtors, selectedDebtorId]);

  // Parcelas do devedor selecionado
  const debtorInstallments = useMemo(() => {
    if (!currentDebtor) return [];
    return installments
      .filter((i) => i.debtorId === currentDebtor.id)
      .sort((a, b) => a.installmentNumber - b.installmentNumber);
  }, [installments, currentDebtor]);

  // Lista de produtos/compras do devedor selecionado
  const debtorProductsList = useMemo(() => {
    if (!currentDebtor) return [];

    const rawPurchases = purchases.filter((p) => p.debtorId === currentDebtor.id);
    const installmentProducts = Array.from(
      new Set(debtorInstallments.map((i) => i.product).filter(Boolean))
    );

    const productMap = new Map<
      string,
      { id: string; description: string; totalAmount: number; totalInstallments: number; paidCount: number; isAll?: boolean }
    >();

    rawPurchases.forEach((p) => {
      const pInsts = debtorInstallments.filter(
        (i) => i.purchaseId === p.id || i.product.toLowerCase() === p.product.toLowerCase()
      );
      const totalAmount =
        p.totalAmount || pInsts.reduce((acc, curr) => acc + (curr.originalAmount || curr.amount), 0);
      const paidCount = p.paidCount ?? pInsts.filter((i) => i.status === 'paid').length;
      productMap.set(p.id, {
        id: p.id,
        description: p.product,
        totalAmount,
        totalInstallments: p.installmentsTotal || pInsts.length || 1,
        paidCount,
      });
    });

    installmentProducts.forEach((prodName) => {
      const exists = Array.from(productMap.values()).some(
        (v) => v.description.toLowerCase() === prodName.toLowerCase()
      );
      if (!exists) {
        const pInsts = debtorInstallments.filter((i) => i.product.toLowerCase() === prodName.toLowerCase());
        const totalAmount = pInsts.reduce((acc, curr) => acc + (curr.originalAmount || curr.amount), 0);
        const paidCount = pInsts.filter((i) => i.status === 'paid').length;
        productMap.set(prodName, {
          id: pInsts[0]?.purchaseId || prodName,
          description: prodName,
          totalAmount,
          totalInstallments: pInsts.length || 1,
          paidCount,
        });
      }
    });

    const list = Array.from(productMap.values());
    const allAmount = debtorInstallments.reduce((acc, curr) => acc + (curr.originalAmount || curr.amount), 0);
    const allPaidCount = debtorInstallments.filter((i) => i.status === 'paid').length;

    return [
      {
        id: 'all',
        description: 'Todos os Produtos',
        totalAmount: allAmount,
        totalInstallments: debtorInstallments.length,
        paidCount: allPaidCount,
        isAll: true,
      },
      ...list,
    ];
  }, [currentDebtor, purchases, debtorInstallments]);

  const activeProduct = useMemo(() => {
    return debtorProductsList.find((p) => p.id === selectedProductId) || debtorProductsList[0] || null;
  }, [debtorProductsList, selectedProductId]);

  // Parcelas ativas filtradas de acordo com o produto
  const activeInstallmentsList = useMemo(() => {
    if (selectedProductId === 'all' || !activeProduct) return debtorInstallments;
    return debtorInstallments.filter(
      (i) => i.purchaseId === selectedProductId || i.product.toLowerCase() === activeProduct.description.toLowerCase()
    );
  }, [debtorInstallments, selectedProductId, activeProduct]);

  // Parcelas quitadas elegíveis para recibo individual
  const paidInstallments = useMemo(() => {
    return activeInstallmentsList.filter((i) => i.status === 'paid');
  }, [activeInstallmentsList]);

  // Parcela ativa para emissão do recibo
  const activePaidInstallment = useMemo(() => {
    if (selectedInstallmentId) {
      const found = paidInstallments.find((i) => i.id === selectedInstallmentId);
      if (found) return found;
    }
    return paidInstallments[0] || null;
  }, [paidInstallments, selectedInstallmentId]);

  const formatCleanPhone = (phone?: string) => {
    if (!phone) return '';
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 11) {
      return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
    }
    if (clean.length === 10) {
      return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
    }
    return phone.replace(/[()]/g, '').trim();
  };

  if (!isOpen) return null;

  const handleDownloadReceiptDirect = () => {
    if (!activePaidInstallment || !currentDebtor) {
      if (onToast) onToast('Selecione uma parcela quitada para emitir o recibo.');
      return;
    }

    const finalAmount = activePaidInstallment.amount || activePaidInstallment.originalAmount;
    const auth = activePaidInstallment.authCode || `AUTH-${Date.now().toString(36).toUpperCase()}`;

    downloadIndividualReceiptPdf({
      payerName: currentDebtor.name,
      payerPhone: currentDebtor.phone,
      creditorName: 'Tiago Dias',
      creditorCompany: 'HASPAHO Tecnologia da Informação',
      creditorPix: '(14) 99733-9863',
      productName: activePaidInstallment.product,
      installmentNumber: activePaidInstallment.installmentNumber,
      totalInstallments: activePaidInstallment.totalInstallments,
      amount: finalAmount,
      paymentDate: activePaidInstallment.paidAt || activePaidInstallment.dueDate,
      paymentMethod: activePaidInstallment.paymentMethod || 'PIX / Asaas',
      authCode: auth,
    }).catch(console.warn);

    if (onToast) {
      onToast(
        `📄 Baixando Recibo Individual da Parcela #${activePaidInstallment.installmentNumber}/${activePaidInstallment.totalInstallments}...`
      );
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-gradient-to-b from-slate-900 via-[#0d172a] to-slate-950 border border-cyan-500/30 rounded-3xl shadow-[0_25px_70px_-15px_rgba(0,0,0,0.8)] flex flex-col max-h-[92vh] overflow-hidden text-white my-auto animate-in zoom-in-95 duration-150">
        
        {/* ============================================================ */}
        {/* 1. CABEÇALHO MODERNO                                         */}
        {/* ============================================================ */}
        <div className="shrink-0 bg-slate-950/90 border-b border-white/10 px-4 py-3.5 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-cyan-500/20">
              <span className="material-symbols-outlined text-[22px]">picture_as_pdf</span>
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base text-white leading-tight truncate">
                  Central de Documentos &amp; PDFs
                </h3>
                <span className="text-[9.5px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 shrink-0">
                  Oficial
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                Extrato Total, Recibos Individuais e Contrato Digital com validade jurídica
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Fechar"
            aria-label="Fechar modal"
          >
            <span className="material-symbols-outlined text-[19px]">close</span>
          </button>
        </div>

        {/* ============================================================ */}
        {/* 2. SELETORES: COMPRADOR & PRODUTO/ITEM (LADO A LADO)        */}
        {/* ============================================================ */}
        <div className="p-3 sm:p-4 bg-slate-950/60 border-b border-white/10 shrink-0 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            
            {/* 1. SELETOR DE COMPRADOR / DEVEDOR */}
            <div className="relative space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-cyan-400">person</span>
                  <span>Comprador:</span>
                </span>
                <span className="text-[10px] text-slate-400">
                  {debtors.length} cadastrados
                </span>
              </div>

              {/* Botão Trigger Comprador */}
              <button
                type="button"
                onClick={() => {
                  setIsDebtorPickerOpen((prev) => !prev);
                  setIsProductPickerOpen(false);
                }}
                className="w-full p-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800/90 active:scale-[0.99] border border-cyan-500/30 hover:border-cyan-400 transition-all flex items-center justify-between gap-2.5 text-left cursor-pointer shadow-md group"
              >
                {currentDebtor ? (
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl overflow-hidden ring-2 ring-cyan-400/40 shrink-0 bg-slate-800">
                      <img
                        src={getCleanDebtorAvatar(currentDebtor.name, currentDebtor.avatar)}
                        alt={currentDebtor.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-xs sm:text-sm text-white group-hover:text-cyan-300 transition-colors truncate">
                          {currentDebtor.name}
                        </span>
                        <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono shrink-0">
                          {currentDebtor.relation || 'Cliente'}
                        </span>
                      </div>
                      <span className="text-[11px] text-cyan-200/80 font-mono block truncate mt-0.5">
                        {formatCleanPhone(currentDebtor.phone) || 'Sem telefone'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">Selecione uma pessoa...</span>
                )}

                <div className="flex items-center gap-1 text-cyan-400 shrink-0 pl-1">
                  <span className="text-[10.5px] font-bold hidden sm:inline">Trocar</span>
                  <span
                    className={`material-symbols-outlined text-[18px] transition-transform duration-200 ${
                      isDebtorPickerOpen ? 'rotate-180' : ''
                    }`}
                  >
                    expand_more
                  </span>
                </div>
              </button>

              {/* Menu Suspenso Customizado com Avatares (Sem barra de busca) */}
              {isDebtorPickerOpen && (
                <div className="absolute top-[calc(100%+6px)] left-0 right-0 z-50 bg-slate-900 border border-cyan-500/40 rounded-2xl shadow-2xl p-2 flex flex-col gap-1 max-h-60 animate-in fade-in zoom-in-95 duration-150">
                  <div className="overflow-y-auto space-y-1 custom-scrollbar max-h-52 pr-1">
                    {debtors.map((d) => {
                      const isSelected = d.id === currentDebtor?.id;
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => {
                            setSelectedDebtorId(d.id);
                            setSelectedProductId('all');
                            setSelectedInstallmentId('');
                            setIsDebtorPickerOpen(false);
                          }}
                          className={`w-full p-2 rounded-xl flex items-center justify-between gap-2.5 transition-all text-left cursor-pointer ${
                            isSelected
                              ? 'bg-cyan-500/20 border border-cyan-400/50 text-white'
                              : 'hover:bg-slate-800/80 border border-transparent text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={getCleanDebtorAvatar(d.name, d.avatar)}
                              alt=""
                              className="w-7 h-7 rounded-lg object-cover ring-1 ring-white/10 shrink-0"
                            />
                            <div className="min-w-0 leading-tight">
                              <span className="font-bold text-xs block text-white truncate">{d.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {formatCleanPhone(d.phone)}
                              </span>
                            </div>
                          </div>

                          {isSelected && (
                            <span className="material-symbols-outlined text-[17px] text-cyan-400 shrink-0">
                              check_circle
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 2. SELETOR DE PRODUTO / ITEM */}
            <div className="relative space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-cyan-400">inventory_2</span>
                  <span>Produto / Item:</span>
                </span>
                <span className="text-[10px] text-slate-400">
                  {debtorProductsList.length > 1 ? `${debtorProductsList.length - 1} cadastrado(s)` : '1 opção'}
                </span>
              </div>

              {/* Botão Trigger Produto */}
              <button
                type="button"
                onClick={() => {
                  setIsProductPickerOpen((prev) => !prev);
                  setIsDebtorPickerOpen(false);
                }}
                className="w-full p-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800/90 active:scale-[0.99] border border-cyan-500/30 hover:border-cyan-400 transition-all flex items-center justify-between gap-2.5 text-left cursor-pointer shadow-md group"
              >
                {activeProduct ? (
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 flex items-center justify-center shrink-0 shadow-xs">
                      <span className="material-symbols-outlined text-[20px]">
                        {activeProduct.isAll ? 'inventory_2' : getProductIcon(activeProduct.description)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-xs sm:text-sm text-white group-hover:text-cyan-300 transition-colors truncate">
                          {activeProduct.description}
                        </span>
                        {activeProduct.isAll && (
                          <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30 font-mono shrink-0">
                            Geral
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono block truncate mt-0.5">
                        {activeProduct.isAll
                          ? `${debtorInstallments.length} parcelas consolidadas`
                          : `R$ ${activeProduct.totalAmount.toFixed(2).replace('.', ',')} • ${activeProduct.totalInstallments} parcelas`}
                      </span>
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">Selecione um produto...</span>
                )}

                <div className="flex items-center gap-1 text-cyan-400 shrink-0 pl-1">
                  <span className="text-[10.5px] font-bold hidden sm:inline">Trocar</span>
                  <span
                    className={`material-symbols-outlined text-[18px] transition-transform duration-200 ${
                      isProductPickerOpen ? 'rotate-180' : ''
                    }`}
                  >
                    expand_more
                  </span>
                </div>
              </button>

              {/* Menu Suspenso Customizado de Produtos (Sem barra de busca) */}
              {isProductPickerOpen && (
                <div className="absolute top-[calc(100%+6px)] left-0 right-0 z-50 bg-slate-900 border border-cyan-500/40 rounded-2xl shadow-2xl p-2 flex flex-col gap-1 max-h-60 animate-in fade-in zoom-in-95 duration-150">
                  <div className="overflow-y-auto space-y-1 custom-scrollbar max-h-52 pr-1">
                    {debtorProductsList.map((p) => {
                      const isSelected = p.id === activeProduct?.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setSelectedProductId(p.id);
                            setSelectedInstallmentId('');
                            setIsProductPickerOpen(false);
                          }}
                          className={`w-full p-2 rounded-xl flex items-center justify-between gap-2.5 transition-all text-left cursor-pointer ${
                            isSelected
                              ? 'bg-cyan-500/20 border border-cyan-400/50 text-white'
                              : 'hover:bg-slate-800/80 border border-transparent text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-cyan-950 text-cyan-300 flex items-center justify-center shrink-0 border border-cyan-500/30">
                              <span className="material-symbols-outlined text-[15px]">
                                {p.isAll ? 'inventory_2' : getProductIcon(p.description)}
                              </span>
                            </div>
                            <div className="min-w-0 leading-tight">
                              <span className="font-bold text-xs block text-white truncate">{p.description}</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {p.isAll
                                  ? `${debtorInstallments.length} parcelas`
                                  : `R$ ${p.totalAmount.toFixed(2).replace('.', ',')} (${p.paidCount}/${p.totalInstallments} pagas)`}
                              </span>
                            </div>
                          </div>

                          {isSelected && (
                            <span className="material-symbols-outlined text-[17px] text-cyan-400 shrink-0">
                              check_circle
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* ============================================================ */}
        {/* 3. TABS DOS TIPOS DE DOCUMENTO (Extrato, Recibo, Contrato)   */}
        {/* ============================================================ */}
        <div className="shrink-0 flex items-center gap-1.5 p-1.5 bg-slate-950/70 border-b border-white/10">
          <button
            type="button"
            onClick={() => setActiveDocType('extrato')}
            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeDocType === 'extrato'
                ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-md ring-1 ring-amber-400/40'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">receipt_long</span>
            <span className="truncate">Extrato Total</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveDocType('recibo')}
            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeDocType === 'recibo'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md ring-1 ring-emerald-400/40'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">download_done</span>
            <span className="truncate">Recibo Individual</span>
            <span className="text-[9.5px] px-1.5 py-0.2 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-400/30">
              {paidInstallments.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveDocType('contrato')}
            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeDocType === 'contrato'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md ring-1 ring-cyan-400/40'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">history_edu</span>
            <span className="truncate">Contrato Digital</span>
          </button>
        </div>

        {/* ============================================================ */}
        {/* 4. CONTEÚDO DO DOCUMENTO SELECIONADO                         */}
        {/* ============================================================ */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
          
          {/* ABA 1: EXTRATO TOTAL */}
          {activeDocType === 'extrato' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/30 flex items-start gap-3">
                <span className="w-10 h-10 rounded-xl bg-amber-600/30 text-amber-300 border border-amber-400/30 flex items-center justify-center shrink-0 shadow-md">
                  <span className="material-symbols-outlined text-[22px]">receipt_long</span>
                </span>
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-sm text-amber-300">
                    Extrato Total Consolidado de Parcelas
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Demonstrativo financeiro de <b>{currentDebtor?.name}</b>
                    {activeProduct && !activeProduct.isAll ? ` referente a "${activeProduct.description}"` : ' com todas as compras consolidadas'}.
                  </p>
                </div>
              </div>

              <div className="bg-slate-900/80 rounded-2xl p-4 border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Total de Parcelas:</span>
                  <span className="font-mono font-bold text-white">{activeInstallmentsList.length} parcelas</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Parcelas Já Liquidadas:</span>
                  <span className="font-mono font-bold text-emerald-400">{paidInstallments.length} pagas</span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
                  <span className="text-slate-300 font-bold">Total Quitado Acumulado:</span>
                  <span className="font-mono font-black text-emerald-300 text-sm">
                    R${' '}
                    {paidInstallments
                      .reduce((acc, curr) => acc + (curr.amount || curr.originalAmount), 0)
                      .toFixed(2)
                      .replace('.', ',')}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenExtratoTotal(selectedProductId !== 'all' ? selectedProductId : undefined, currentDebtor?.id);
                }}
                className="w-full h-11 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 active:scale-95 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-900/30 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">visibility</span>
                <span>Visualizar &amp; Baixar Extrato Total em PDF</span>
              </button>
            </div>
          )}

          {/* ABA 2: RECIBO INDIVIDUAL */}
          {activeDocType === 'recibo' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 flex items-start gap-3">
                <span className="w-10 h-10 rounded-xl bg-emerald-600/30 text-emerald-300 border border-emerald-400/30 flex items-center justify-center shrink-0 shadow-md">
                  <span className="material-symbols-outlined text-[22px]">download_done</span>
                </span>
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-sm text-emerald-300">
                    Recibo de Pagamento Individual
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Comprovante exclusivo de quitação de uma parcela específica com autenticidade digital (Art. 320 CC).
                  </p>
                </div>
              </div>

              {paidInstallments.length === 0 ? (
                <div className="p-6 text-center bg-slate-900/60 border border-white/10 rounded-2xl">
                  <span className="material-symbols-outlined text-3xl text-slate-500 block mb-1">info</span>
                  <p className="text-xs text-slate-300 font-bold">
                    Nenhuma parcela quitada para {currentDebtor?.name}
                    {activeProduct && !activeProduct.isAll ? ` no item "${activeProduct.description}"` : ''}.
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Recibos individuais só podem ser gerados para parcelas com pagamento confirmado.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-300 block">
                    Selecione a Parcela Paga:
                  </span>

                  {/* Lista de cards visuais para selecionar a parcela */}
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                    {paidInstallments.map((inst) => {
                      const isSelected = (selectedInstallmentId || activePaidInstallment?.id) === inst.id;
                      const val = (inst.amount || inst.originalAmount).toFixed(2).replace('.', ',');
                      return (
                        <button
                          key={inst.id}
                          type="button"
                          onClick={() => setSelectedInstallmentId(inst.id)}
                          className={`w-full p-2.5 rounded-xl border transition-all flex items-center justify-between gap-3 text-left cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-500/20 border-emerald-400/60 shadow-xs ring-1 ring-emerald-400/30'
                              : 'bg-slate-900/70 hover:bg-slate-800/80 border-white/10 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-emerald-950 text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-500/30">
                              <span className="material-symbols-outlined text-[16px]">{getProductIcon(inst.product)}</span>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-xs text-white truncate">
                                  {inst.product}
                                </span>
                                <span className="text-[10px] font-mono font-bold text-emerald-300 bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-500/30 shrink-0">
                                  Parc. {inst.installmentNumber}/{inst.totalInstallments}
                                </span>
                              </div>
                              <span className="text-[10.5px] text-slate-400 block mt-0.5">
                                Pago em: {inst.paidAt || inst.dueDate}
                              </span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-mono font-black text-xs sm:text-sm text-emerald-300 block">
                              R$ {val}
                            </span>
                            <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">
                              Liquidado
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={handleDownloadReceiptDirect}
                      className="h-11 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/40 transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">download</span>
                      <span>Baixar Recibo (PDF)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (!activePaidInstallment || !currentDebtor) return;
                        const finalAmount = activePaidInstallment.amount || activePaidInstallment.originalAmount;
                        const auth = activePaidInstallment.authCode || `AUTH-${Date.now().toString(36).toUpperCase()}`;
                        onClose();
                        onShowProof(
                          currentDebtor.name,
                          `R$ ${finalAmount.toFixed(2).replace('.', ',')}`,
                          activePaidInstallment.paidAt || activePaidInstallment.dueDate,
                          activePaidInstallment.paymentMethod || 'PIX / Asaas',
                          auth,
                          `${activePaidInstallment.product} (Parcela ${activePaidInstallment.installmentNumber}/${activePaidInstallment.totalInstallments})`
                        );
                      }}
                      className="h-11 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-white/10 transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">visibility</span>
                      <span>Visualizar na Tela</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ABA 3: CONTRATO DIGITAL */}
          {activeDocType === 'contrato' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 flex items-start gap-3">
                <span className="w-10 h-10 rounded-xl bg-cyan-600/30 text-cyan-300 border border-cyan-400/30 flex items-center justify-center shrink-0 shadow-md">
                  <span className="material-symbols-outlined text-[22px]">history_edu</span>
                </span>
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-sm text-cyan-300">
                    Contrato Digital • Instrumento Particular
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Instrumento formal com valor por extenso, compromisso de reembolso sem juros e assinatura digital de <b>{currentDebtor?.name}</b>.
                  </p>
                </div>
              </div>

              <div className="bg-slate-900/80 rounded-2xl p-4 border border-white/10 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Status Jurídico:</span>
                  <span className="font-bold text-emerald-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">verified</span>
                    Pronto para Emissão &amp; Assinatura
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                  <span className="text-slate-300 font-bold">Total do Financiamento:</span>
                  <span className="font-mono font-black text-cyan-300 text-sm">
                    R${' '}
                    {activeInstallmentsList
                      .reduce((acc, curr) => acc + (curr.originalAmount || curr.amount), 0)
                      .toFixed(2)
                      .replace('.', ',')}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!currentDebtor) return;
                  onClose();
                  onOpenContract(currentDebtor.id);
                }}
                className="w-full h-11 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 active:scale-95 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-900/30 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">assignment</span>
                <span>Abrir Contrato Digital para Assinar &amp; Baixar (A4)</span>
              </button>
            </div>
          )}

        </div>

        {/* ============================================================ */}
        {/* 5. RODAPÉ FIXO DO MODAL                                      */}
        {/* ============================================================ */}
        <div className="shrink-0 bg-slate-950 border-t border-white/10 px-4 py-3 sm:px-6 flex items-center justify-between gap-2 text-xs text-slate-400">
          <span className="text-[10.5px] truncate">
            Documentos emitidos com validade jurídica (Lei 14.063/2020).
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold cursor-pointer transition-colors"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
