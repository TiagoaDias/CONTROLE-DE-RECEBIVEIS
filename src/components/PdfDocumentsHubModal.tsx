import React, { useState, useMemo } from 'react';
import { Debtor, Purchase, Installment } from '../types';
import { downloadIndividualReceiptPdf, downloadStatementPdfDirect } from '../utils/receiptPdfHelper';
import { generateReceiptTxt, generateStatementTxt, downloadTxtFile } from '../utils/receiptTxtHelper';
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
  const [selectedDebtorId, setSelectedDebtorId] = useState<string>(() =>
    initialDebtorId && initialDebtorId !== 'all' ? initialDebtorId : debtors[0]?.id || ''
  );

  React.useEffect(() => {
    if (initialDebtorId && initialDebtorId !== 'all') {
      setSelectedDebtorId(initialDebtorId);
    } else if ((!selectedDebtorId || selectedDebtorId === 'all') && debtors.length > 0) {
      setSelectedDebtorId(debtors[0].id);
    }
  }, [initialDebtorId, debtors, isOpen]);

  const [selectedProductId, setSelectedProductId] = useState<string>('all');
  const [activeDocType, setActiveDocType] = useState<'extrato' | 'recibo' | 'contrato' | 'txt'>('extrato');
  const [txtSubDocType, setTxtSubDocType] = useState<'recibo' | 'extrato'>('recibo');
  const [isDebtorPickerOpen, setIsDebtorPickerOpen] = useState(false);
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Parcela selecionada para emissão de recibo individual
  const [selectedInstallmentId, setSelectedInstallmentId] = useState<string>('');

  const currentDebtor = useMemo<Debtor>(() => {
    const found = debtors.find((d) => d.id === selectedDebtorId) || debtors[0];
    if (found) return found;
    return {
      id: 'fallback-debtor',
      name: 'Cliente HASPAHO',
      phone: '(14) 99733-9863',
      relation: 'Cliente',
      pixKey: '',
      avatar: '',
      totalOwed: 100,
      totalPaid: 0,
      overdueCount: 0,
      score: 850,
      scoreTier: 'excelente',
      onTimePaymentsCount: 0,
      justInTimePaymentsCount: 0,
      latePaymentsCount: 0,
      spendingAlert: false,
    };
  }, [debtors, selectedDebtorId]);

  // Parcelas do devedor selecionado (por ID ou Nome normalizado)
  const debtorInstallments = useMemo(() => {
    if (!currentDebtor) return [];
    const normDebtorName = (currentDebtor.name || '').trim().toLowerCase();
    return installments
      .filter(
        (i) =>
          i.debtorId === currentDebtor.id ||
          (normDebtorName.length > 0 && (i.debtorName || '').trim().toLowerCase() === normDebtorName)
      )
      .sort((a, b) => (Number(a.installmentNumber) || 0) - (Number(b.installmentNumber) || 0));
  }, [installments, currentDebtor]);

  // Lista de produtos/compras do devedor selecionado
  const debtorProductsList = useMemo(() => {
    if (!currentDebtor) return [];

    const normDebtorName = (currentDebtor.name || '').trim().toLowerCase();
    const rawPurchases = purchases.filter(
      (p) =>
        p.debtorId === currentDebtor.id ||
        (normDebtorName.length > 0 && (p.debtorName || '').trim().toLowerCase() === normDebtorName)
    );
    const installmentProducts = Array.from(
      new Set(debtorInstallments.map((i) => i.product).filter(Boolean))
    );

    const productMap = new Map<
      string,
      { id: string; description: string; totalAmount: number; totalInstallments: number; paidCount: number; isAll?: boolean }
    >();

    rawPurchases.forEach((p) => {
      const pInsts = debtorInstallments.filter(
        (i) => i.purchaseId === p.id || (i.product || '').toLowerCase() === (p.product || '').toLowerCase()
      );
      const totalAmount =
        p.totalAmount || pInsts.reduce((acc, curr) => acc + (curr.originalAmount || curr.amount || 0), 0);
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
        const pInsts = debtorInstallments.filter((i) => (i.product || '').toLowerCase() === prodName.toLowerCase());
        const totalAmount = pInsts.reduce((acc, curr) => acc + (curr.originalAmount || curr.amount || 0), 0);
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
    const allAmount =
      debtorInstallments.reduce((acc, curr) => acc + (curr.originalAmount || curr.amount || 0), 0) ||
      currentDebtor.totalOwed ||
      0;
    const allPaidCount = debtorInstallments.filter((i) => i.status === 'paid').length;

    return [
      {
        id: 'all',
        description: 'Todos os Produtos',
        totalAmount: allAmount,
        totalInstallments: debtorInstallments.length || 1,
        paidCount: allPaidCount,
        isAll: true,
      },
      ...list,
    ];
  }, [currentDebtor, purchases, debtorInstallments]);

  const activeProduct = useMemo(() => {
    return debtorProductsList.find((p) => p.id === selectedProductId) || debtorProductsList[0] || null;
  }, [debtorProductsList, selectedProductId]);

  // Parcelas ativas filtradas de acordo com o produto (com fallback garantido para nunca travar)
  const activeInstallmentsList = useMemo<Installment[]>(() => {
    let list = debtorInstallments;
    if (selectedProductId !== 'all' && activeProduct) {
      list = debtorInstallments.filter(
        (i) =>
          i.purchaseId === selectedProductId ||
          (i.product || '').toLowerCase() === (activeProduct.description || '').toLowerCase()
      );
    }
    if (list.length > 0) return list;

    // Fallback sintético caso o devedor não tenha parcelas listadas individualmente
    const fallbackAmount =
      activeProduct && !activeProduct.isAll && activeProduct.totalAmount > 0
        ? activeProduct.totalAmount
        : currentDebtor.totalOwed > 0
        ? currentDebtor.totalOwed
        : currentDebtor.totalPaid > 0
        ? currentDebtor.totalPaid
        : 100;

    return [
      {
        id: `synth-${currentDebtor.id}-1`,
        purchaseId: selectedProductId !== 'all' ? selectedProductId : `p-${currentDebtor.id}`,
        debtorId: currentDebtor.id,
        debtorName: currentDebtor.name,
        debtorAvatar: currentDebtor.avatar || '',
        product: activeProduct && !activeProduct.isAll ? activeProduct.description : 'Parcelamento / Acordo HASPAHO',
        cardName: 'PIX / Asaas',
        installmentNumber: 1,
        totalInstallments: activeProduct?.totalInstallments || 1,
        amount: fallbackAmount,
        originalAmount: fallbackAmount,
        dueDate: new Date().toLocaleDateString('pt-BR'),
        paidAt: currentDebtor.totalPaid > 0 ? new Date().toLocaleDateString('pt-BR') : undefined,
        status: currentDebtor.totalPaid > 0 ? 'paid' : 'ontime',
        authCode: `AUT-${currentDebtor.id.slice(-4).toUpperCase()}-01`,
      },
    ];
  }, [debtorInstallments, selectedProductId, activeProduct, currentDebtor]);

  // Parcelas quitadas
  const paidInstallments = useMemo(() => {
    return activeInstallmentsList.filter((i) => i.status === 'paid');
  }, [activeInstallmentsList]);

  // Lista de parcelas elegíveis para emissão de recibo (prioriza pagas, mas permite qualquer parcela)
  const receiptInstallmentsList = useMemo(() => {
    if (paidInstallments.length > 0) {
      const unpaid = activeInstallmentsList.filter((i) => i.status !== 'paid');
      return [...paidInstallments, ...unpaid];
    }
    return activeInstallmentsList;
  }, [paidInstallments, activeInstallmentsList]);

  // Parcela ativa selecionada para emissão do recibo (sempre disponível)
  const activeReceiptInstallment = useMemo(() => {
    if (selectedInstallmentId) {
      const found = receiptInstallmentsList.find((i) => i.id === selectedInstallmentId);
      if (found) return found;
    }
    return paidInstallments[0] || receiptInstallmentsList[0] || null;
  }, [receiptInstallmentsList, paidInstallments, selectedInstallmentId]);

  // Compra correspondente para o Extrato PDF
  const matchedPurchase = useMemo(() => {
    if (selectedProductId !== 'all') {
      const found = purchases.find(
        (p) =>
          p.id === selectedProductId ||
          (activeProduct && (p.product || '').toLowerCase() === (activeProduct.description || '').toLowerCase())
      );
      if (found) return found;
    }
    return purchases.find((p) => p.debtorId === currentDebtor.id);
  }, [purchases, selectedProductId, activeProduct, currentDebtor]);

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

  // Download direto do Extrato Total em PDF
  const handleDownloadStatementPdf = async () => {
    if (!currentDebtor || isGeneratingPdf) return;
    try {
      setIsGeneratingPdf(true);
      if (onToast) onToast(`📄 Gerando Extrato Total em PDF de ${currentDebtor.name}...`);
      await downloadStatementPdfDirect(currentDebtor, activeInstallmentsList, matchedPurchase);
      if (onToast) onToast(`✅ Extrato Total em PDF baixado com sucesso!`);
    } catch (err) {
      console.error('Erro ao baixar Extrato PDF:', err);
      if (onToast) onToast('Erro ao gerar o PDF do extrato. Tente novamente.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Download direto do Recibo Individual em PDF
  const handleDownloadReceiptDirect = async () => {
    const targetInst = activeReceiptInstallment || activeInstallmentsList[0];
    if (!targetInst || !currentDebtor) {
      if (onToast) onToast('Selecione uma parcela para emitir o recibo.');
      return;
    }

    try {
      setIsGeneratingPdf(true);
      const finalAmount = targetInst.paidAmount || targetInst.amount || targetInst.originalAmount || 0;
      const auth = targetInst.authCode || `AUTH-${Date.now().toString(36).toUpperCase()}`;

      if (onToast) {
        onToast(
          `📄 Baixando Recibo em PDF da Parcela #${targetInst.installmentNumber}/${targetInst.totalInstallments}...`
        );
      }

      await downloadIndividualReceiptPdf({
        payerName: currentDebtor.name,
        payerPhone: currentDebtor.phone,
        creditorName: 'Tiago Dias',
        creditorCompany: 'HASPAHO Tecnologia da Informação',
        creditorPix: '(14) 99733-9863',
        productName: targetInst.product,
        installmentNumber: targetInst.installmentNumber,
        totalInstallments: targetInst.totalInstallments,
        amount: finalAmount,
        paymentDate: targetInst.paidAt || targetInst.dueDate || new Date().toLocaleDateString('pt-BR'),
        paymentMethod: targetInst.paymentMethod || 'PIX / Asaas',
        authCode: auth,
      });

      if (onToast) {
        onToast(`✅ Recibo em PDF baixado com sucesso!`);
      }
    } catch (err) {
      console.error('Erro ao gerar Recibo PDF:', err);
      if (onToast) onToast('Erro ao baixar o recibo em PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Handler para download do recibo em formato TXT
  const handleDownloadReceiptTxt = () => {
    const targetInst = activeReceiptInstallment || activeInstallmentsList[0];
    if (!targetInst || !currentDebtor) {
      if (onToast) onToast('Selecione uma parcela para emitir o recibo em TXT.');
      return;
    }
    const finalAmount = targetInst.paidAmount || targetInst.amount || targetInst.originalAmount || 0;
    const auth = targetInst.authCode || `AUTH-${Date.now().toString(36).toUpperCase()}`;
    const txtContent = generateReceiptTxt({
      payerName: currentDebtor.name,
      payerPhone: currentDebtor.phone,
      payerCpf: currentDebtor.cpfCnpj || currentDebtor.documentNumber,
      creditorName: 'Tiago Dias',
      creditorCompany: 'HASPAHO Tecnologia da Informação',
      creditorPix: '(14) 99733-9863',
      productName: targetInst.product,
      installmentNumber: targetInst.installmentNumber,
      totalInstallments: targetInst.totalInstallments,
      amount: finalAmount,
      paymentDate: targetInst.paidAt || targetInst.dueDate || new Date().toLocaleDateString('pt-BR'),
      paymentMethod: targetInst.paymentMethod || 'PIX / Asaas',
      authCode: auth,
    });
    const safePayer = currentDebtor.name.trim().replace(/[^a-zA-Z0-9]/g, '_');
    downloadTxtFile(`recibo_${safePayer}_parc_${targetInst.installmentNumber}.txt`, txtContent);
    if (onToast) onToast(`📝 Recibo TXT da Parcela #${targetInst.installmentNumber} baixado com sucesso!`);
  };

  // Handler para download do extrato em formato TXT
  const handleDownloadStatementTxt = () => {
    if (!currentDebtor) return;
    const txtContent = generateStatementTxt(currentDebtor, activeInstallmentsList, purchases);
    const safePayer = currentDebtor.name.trim().replace(/[^a-zA-Z0-9]/g, '_');
    downloadTxtFile(`extrato_${safePayer}_haspaho.txt`, txtContent);
    if (onToast) onToast(`📋 Extrato consolidado em TXT baixado com sucesso!`);
  };

  // Handler para copiar TXT para a área de transferência
  const handleCopyTxtToClipboard = (type: 'recibo' | 'extrato') => {
    if (!currentDebtor) return;
    let txt = '';
    if (type === 'recibo') {
      const targetInst = activeReceiptInstallment || activeInstallmentsList[0];
      if (!targetInst) {
        if (onToast) onToast('Selecione uma parcela para copiar.');
        return;
      }
      const finalAmount = targetInst.paidAmount || targetInst.amount || targetInst.originalAmount || 0;
      const auth = targetInst.authCode || `AUTH-${Date.now().toString(36).toUpperCase()}`;
      txt = generateReceiptTxt({
        payerName: currentDebtor.name,
        payerPhone: currentDebtor.phone,
        payerCpf: currentDebtor.cpfCnpj || currentDebtor.documentNumber,
        creditorName: 'Tiago Dias',
        creditorCompany: 'HASPAHO Tecnologia da Informação',
        creditorPix: '(14) 99733-9863',
        productName: targetInst.product,
        installmentNumber: targetInst.installmentNumber,
        totalInstallments: targetInst.totalInstallments,
        amount: finalAmount,
        paymentDate: targetInst.paidAt || targetInst.dueDate || new Date().toLocaleDateString('pt-BR'),
        paymentMethod: targetInst.paymentMethod || 'PIX / Asaas',
        authCode: auth,
      });
    } else {
      txt = generateStatementTxt(currentDebtor, activeInstallmentsList, purchases);
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(txt);
      if (onToast) onToast('📋 Texto TXT copiado para a área de transferência!');
    }
  };

  // Preview ativo de TXT para visualização na tela
  const currentTxtPreview = useMemo(() => {
    if (!currentDebtor) return 'Nenhum devedor selecionado.';
    if (txtSubDocType === 'recibo') {
      const targetInst = activeReceiptInstallment || activeInstallmentsList[0];
      if (!targetInst) {
        return 'Nenhuma parcela disponível para exibir o recibo TXT.';
      }
      const finalAmount = targetInst.paidAmount || targetInst.amount || targetInst.originalAmount || 0;
      const auth = targetInst.authCode || `AUTH-${Date.now().toString(36).toUpperCase()}`;
      return generateReceiptTxt({
        payerName: currentDebtor.name,
        payerPhone: currentDebtor.phone,
        payerCpf: currentDebtor.cpfCnpj || currentDebtor.documentNumber,
        creditorName: 'Tiago Dias',
        creditorCompany: 'HASPAHO Tecnologia da Informação',
        creditorPix: '(14) 99733-9863',
        productName: targetInst.product,
        installmentNumber: targetInst.installmentNumber,
        totalInstallments: targetInst.totalInstallments,
        amount: finalAmount,
        paymentDate: targetInst.paidAt || targetInst.dueDate || new Date().toLocaleDateString('pt-BR'),
        paymentMethod: targetInst.paymentMethod || 'PIX / Asaas',
        authCode: auth,
      });
    } else {
      return generateStatementTxt(currentDebtor, activeInstallmentsList, purchases);
    }
  }, [currentDebtor, txtSubDocType, activeReceiptInstallment, activeInstallmentsList, purchases]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950 flex items-center justify-center animate-in fade-in duration-200">
      <div className="w-full h-full sm:h-[95vh] sm:max-w-4xl bg-gradient-to-b from-slate-900 via-[#0d172a] to-slate-950 border border-cyan-500/30 sm:rounded-3xl shadow-[0_25px_70px_-15px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden text-white sm:my-auto animate-in zoom-in-95 duration-150">
        
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
                Extrato Total, Recibos Individuais, TXT e Contrato Digital com validade jurídica
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

              {/* Menu Suspenso Customizado com Avatares */}
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
                          ? `${activeInstallmentsList.length} parcelas consolidadas`
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

              {/* Menu Suspenso Customizado de Produtos */}
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
                                  ? `${activeInstallmentsList.length} parcelas`
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
        {/* 3. TABS DOS TIPOS DE DOCUMENTO (Extrato, Recibo, Contrato, TxT) */}
        {/* ============================================================ */}
        <div className="shrink-0 grid grid-cols-4 gap-1 sm:gap-1.5 p-1 sm:p-1.5 bg-slate-950/70 border-b border-white/10">
          <button
            type="button"
            onClick={() => setActiveDocType('extrato')}
            className={`py-2 px-1 sm:px-2 rounded-xl text-[10.5px] sm:text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 min-w-0 ${
              activeDocType === 'extrato'
                ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-md ring-1 ring-amber-400/40'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-[15px] sm:text-[16px] shrink-0">receipt_long</span>
            <span className="truncate">Extrato</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveDocType('recibo')}
            className={`py-2 px-1 sm:px-2 rounded-xl text-[10.5px] sm:text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 min-w-0 ${
              activeDocType === 'recibo'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md ring-1 ring-emerald-400/40'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-[15px] sm:text-[16px] shrink-0">download_done</span>
            <span className="truncate">Recibo</span>
            <span className="text-[9px] px-1 py-0.1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-400/30 shrink-0">
              {receiptInstallmentsList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveDocType('contrato')}
            className={`py-2 px-1 sm:px-2 rounded-xl text-[10.5px] sm:text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 min-w-0 ${
              activeDocType === 'contrato'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md ring-1 ring-cyan-400/40'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-[15px] sm:text-[16px] shrink-0">history_edu</span>
            <span className="truncate">Contrato</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveDocType('txt')}
            className={`py-2 px-1 sm:px-2 rounded-xl text-[10.5px] sm:text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 min-w-0 ${
              activeDocType === 'txt'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md ring-1 ring-purple-400/40'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-[15px] sm:text-[16px] shrink-0">text_snippet</span>
            <span className="truncate">Formato TxT</span>
            <span className="text-[8.5px] px-1 py-0.1 rounded bg-purple-950 text-purple-300 border border-purple-400/30 font-bold shrink-0 hidden xs:inline">
              .TXT
            </span>
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
                      .reduce((acc, curr) => acc + (curr.paidAmount || curr.amount || curr.originalAmount || 0), 0)
                      .toFixed(2)
                      .replace('.', ',')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  disabled={isGeneratingPdf}
                  onClick={handleDownloadStatementPdf}
                  className="h-11 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 active:scale-95 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-900/30 transition-all cursor-pointer disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  <span>{isGeneratingPdf ? 'Gerando PDF...' : 'Baixar Extrato (PDF)'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadStatementTxt}
                  className="h-11 rounded-2xl bg-amber-950/80 hover:bg-amber-900 active:scale-95 text-amber-200 border border-amber-500/40 font-black text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">text_snippet</span>
                  <span>Baixar Extrato (.TXT)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenExtratoTotal(
                      matchedPurchase?.id || (selectedProductId !== 'all' ? selectedProductId : undefined),
                      currentDebtor?.id
                    );
                  }}
                  className="h-11 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-white/10 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">visibility</span>
                  <span>Visualizar Extrato</span>
                </button>
              </div>
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
                    Comprovante exclusivo de parcela com autenticidade digital e QR Code PIX (Art. 320 CC).
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 block">
                    Selecione a Parcela para o Recibo:
                  </span>
                  <span className="text-[10.5px] text-emerald-400 font-mono">
                    {paidInstallments.length > 0
                      ? `${paidInstallments.length} quitada(s) • ${receiptInstallmentsList.length} total`
                      : `${receiptInstallmentsList.length} parcela(s) disponível(is)`}
                  </span>
                </div>

                {/* Lista de cards visuais para selecionar a parcela */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                  {receiptInstallmentsList.map((inst) => {
                    const isSelected = (selectedInstallmentId || activeReceiptInstallment?.id) === inst.id;
                    const isPaid = inst.status === 'paid';
                    const val = (inst.paidAmount || inst.amount || inst.originalAmount || 0).toFixed(2).replace('.', ',');
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
                              {isPaid ? `Pago em: ${inst.paidAt || inst.dueDate}` : `Vencimento: ${inst.dueDate}`}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-mono font-black text-xs sm:text-sm text-emerald-300 block">
                            R$ {val}
                          </span>
                          <span
                            className={`text-[9px] font-bold uppercase tracking-wider ${
                              isPaid ? 'text-emerald-400' : 'text-amber-400'
                            }`}
                          >
                            {isPaid ? 'Liquidado' : 'Em Aberto'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isGeneratingPdf}
                    onClick={handleDownloadReceiptDirect}
                    className="h-11 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/40 transition-all cursor-pointer disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-[18px]">download</span>
                    <span>{isGeneratingPdf ? 'Gerando...' : 'Baixar Recibo (PDF)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadReceiptTxt}
                    className="h-11 rounded-2xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-md"
                  >
                    <span className="material-symbols-outlined text-[18px]">text_snippet</span>
                    <span>Baixar Recibo (.TXT)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const targetInst = activeReceiptInstallment || activeInstallmentsList[0];
                      if (!targetInst || !currentDebtor) return;
                      const finalAmount = targetInst.paidAmount || targetInst.amount || targetInst.originalAmount || 0;
                      const auth = targetInst.authCode || `AUTH-${Date.now().toString(36).toUpperCase()}`;
                      onClose();
                      onShowProof(
                        currentDebtor.name,
                        `R$ ${finalAmount.toFixed(2).replace('.', ',')}`,
                        targetInst.paidAt || targetInst.dueDate || new Date().toLocaleDateString('pt-BR'),
                        targetInst.paymentMethod || 'PIX / Asaas',
                        auth,
                        `${targetInst.product} (Parcela ${targetInst.installmentNumber}/${targetInst.totalInstallments})`
                      );
                    }}
                    className="h-11 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-white/10 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">visibility</span>
                    <span>Visualizar Recibo</span>
                  </button>
                </div>
              </div>
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
                      .reduce((acc, curr) => acc + (curr.originalAmount || curr.amount || 0), 0)
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

          {/* ABA 4: NOVO FORMATO TXT (BLOCO DE NOTAS / TEXTO PURO) */}
          {activeDocType === 'txt' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-4 rounded-2xl bg-purple-950/30 border border-purple-500/30 flex items-start gap-3">
                <span className="w-10 h-10 rounded-xl bg-purple-600/30 text-purple-300 border border-purple-400/30 flex items-center justify-center shrink-0 shadow-md">
                  <span className="material-symbols-outlined text-[22px]">text_snippet</span>
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-black text-sm text-purple-300">
                      Documentos em Formato TxT (Texto Puro .txt)
                    </h4>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-200 border border-purple-400/40 font-bold uppercase">
                      Formato .TXT
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Gere e baixe recibos e extratos em arquivo .TXT para compartilhamento rápido no WhatsApp, impressão direta ou abertura no Bloco de Notas.
                  </p>
                </div>
              </div>

              {/* Sub-Seletor TxT: Recibo vs Extrato */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-900 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setTxtSubDocType('recibo')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    txtSubDocType === 'recibo'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">verified</span>
                  <span>1. Recibo em TxT</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTxtSubDocType('extrato')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    txtSubDocType === 'extrato'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">receipt_long</span>
                  <span>2. Extrato em TxT</span>
                </button>
              </div>

              {/* Seletor de parcela quando em modo recibo TxT */}
              {txtSubDocType === 'recibo' && receiptInstallmentsList.length > 0 && (
                <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-900/60 rounded-xl border border-white/10 text-xs">
                  <span className="text-slate-300 font-bold text-[11px] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px] text-purple-400">tune</span>
                    <span>Parcela para o Recibo TxT:</span>
                  </span>
                  <select
                    value={selectedInstallmentId || activeReceiptInstallment?.id || ''}
                    onChange={(e) => setSelectedInstallmentId(e.target.value)}
                    className="h-8 px-2.5 rounded-lg bg-slate-950 border border-purple-500/40 text-purple-200 text-xs font-mono font-bold focus:outline-none focus:border-purple-400 cursor-pointer shadow-xs max-w-[220px] truncate"
                  >
                    {receiptInstallmentsList.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        Parc. #{inst.installmentNumber}/{inst.totalInstallments} • R$ {(inst.paidAmount || inst.amount || inst.originalAmount || 0).toFixed(2).replace('.', ',')} {inst.status === 'paid' ? '(Paga)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Caixa de Visualização Prévia do Arquivo TXT */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                  <span className="flex items-center gap-1 font-mono text-[11px] text-purple-300">
                    <span className="material-symbols-outlined text-[14px]">terminal</span>
                    <span>Prévia do Arquivo .TXT ({txtSubDocType === 'recibo' ? 'Recibo' : 'Extrato'}):</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    ASCII / UTF-8
                  </span>
                </div>

                <div className="relative rounded-2xl overflow-hidden border border-purple-500/30 bg-slate-950 shadow-inner">
                  <pre className="p-3 sm:p-4 text-[10.5px] sm:text-[11px] font-mono leading-relaxed text-emerald-300 max-h-56 overflow-y-auto overflow-x-auto custom-scrollbar select-text whitespace-pre">
                    {currentTxtPreview}
                  </pre>
                </div>
              </div>

              {/* Botões de Ação para o TXT */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (txtSubDocType === 'recibo') handleDownloadReceiptTxt();
                    else handleDownloadStatementTxt();
                  }}
                  className="h-11 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-900/40 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[19px]">download</span>
                  <span>Baixar Arquivo .TxT</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCopyTxtToClipboard(txtSubDocType)}
                  className="h-11 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 border border-purple-400/30 hover:border-purple-400 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px] text-purple-300">content_copy</span>
                  <span>Copiar Texto TxT</span>
                </button>
              </div>
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
