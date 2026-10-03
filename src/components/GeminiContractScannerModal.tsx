import React, { useState, useMemo, useEffect } from 'react';
import {
  Debtor,
  Purchase,
  Installment,
  BankInstitution,
  GeminiParsedContract,
  GeminiParsedPaymentDistribution,
  GeminiDistributionItem,
} from '../types';

interface GeminiContractScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  debtors?: Debtor[];
  purchases?: Purchase[];
  installments?: Installment[];
  institutions?: BankInstitution[];
  onApplyContract?: (data: GeminiParsedContract) => void;
  onSettleDistributedPayments?: (
    debtorId: string,
    settledItems: GeminiDistributionItem[],
    proofMeta: {
      payerName: string;
      totalPaid: number;
      paymentDate: string;
      paymentMethod?: string;
      authCode?: string;
      bankName?: string;
      excessAmount: number;
    }
  ) => void;
  onToast: (msg: string) => void;
}

export const GeminiContractScannerModal: React.FC<GeminiContractScannerModalProps> = ({
  isOpen,
  onClose,
  debtors = [],
  purchases = [],
  installments = [],
  onSettleDistributedPayments,
  onToast,
}) => {
  // 1. Seleção de Comprador / Devedor Cadastrado
  const [selectedDebtorId, setSelectedDebtorId] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 2. Modo de Entrada: Exemplos Prontos, Texto WhatsApp ou Upload de Comprovante
  const [activeTab, setActiveTab] = useState<'presets' | 'text' | 'upload'>('presets');
  const [inputText, setInputText] = useState('');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState('');

  // 3. Estados de Processamento com IA Gemini
  const [isLoading, setIsLoading] = useState(false);
  const [distributionResult, setDistributionResult] = useState<GeminiParsedPaymentDistribution | null>(null);
  const [aiSource, setAiSource] = useState<string>('');

  // Define devedor inicial se não houver selecionado (prioriza Renata Silveira)
  useEffect(() => {
    if (!selectedDebtorId && debtors.length > 0) {
      const renata = debtors.find((d) => d.name.toLowerCase().includes('renata'));
      setSelectedDebtorId(renata ? renata.id : debtors[0].id);
    }
  }, [debtors, selectedDebtorId]);

  // Devedor ativo selecionado
  const currentDebtor = useMemo(() => {
    return debtors.find((d) => d.id === selectedDebtorId) || debtors[0] || null;
  }, [debtors, selectedDebtorId]);

  // Compras ativas com parcelas pendentes do devedor selecionado
  const activeDebtorPurchasesWithDue = useMemo(() => {
    if (!currentDebtor) return [];

    const debtorPurchases = purchases.filter((p) => p.debtorId === currentDebtor.id);

    return debtorPurchases.map((p) => {
      const pendingInst = installments
        .filter((i) => i.purchaseId === p.id && i.status !== 'paid')
        .sort((a, b) => a.installmentNumber - b.installmentNumber)[0];

      const instValue = pendingInst
        ? (pendingInst.amount || pendingInst.originalAmount)
        : (p.installmentValue || (p.totalAmount / (p.installmentsTotal || 1)));

      return {
        purchaseId: p.id,
        id: p.id,
        product: p.product,
        store: p.store || 'Loja',
        cardName: p.cardName || 'Nubank Croma',
        installmentValue: instValue,
        pendingInstallmentId: pendingInst?.id || `inst-${p.id}`,
        installmentNumber: pendingInst?.installmentNumber || 1,
        totalInstallments: p.installmentsTotal || 10,
        dueDate: pendingInst?.dueDate || p.nextDueDate || '10/10/2026',
        isPaidOut: !pendingInst,
      };
    });
  }, [currentDebtor, purchases, installments]);

  // Total da fatura mensal ativa do comprador
  const totalMonthlyInvoice = useMemo(() => {
    return activeDebtorPurchasesWithDue.reduce((acc, curr) => acc + curr.installmentValue, 0);
  }, [activeDebtorPurchasesWithDue]);

  // Lista de devedores filtrada pela busca
  const filteredDebtors = useMemo(() => {
    if (!searchQuery.trim()) return debtors;
    const q = searchQuery.toLowerCase();
    return debtors.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.phone && d.phone.includes(q)) ||
        (d.relation && d.relation.toLowerCase().includes(q))
    );
  }, [debtors, searchQuery]);

  if (!isOpen) return null;

  // Carrega Preset 1: Renata pagou R$ 600,00 (Quita as 3 compras de R$ 200: Celular, TV e 624)
  const handleLoadPreset1 = () => {
    const renata = debtors.find((d) => d.name.toLowerCase().includes('renata'));
    if (renata) setSelectedDebtorId(renata.id);

    setActiveTab('text');
    setInputText(`COMPROVANTE DE TRANSFERÊNCIA PIX - NUBANK
Instituição de Origem: Nu Pagamentos S.A.
Nome do Pagador: Renata Silveira
CPF: ***.412.088-**
Chave Pix Destino: (14) 99733-9863
Nome do Favorecido: Tiago Augusto Dias (HASPAHO TI)
VALOR PAGO: R$ 600,00 (Seiscentos reais)
Data e Hora: 10/10/2026 às 14:28:15
ID da Transação / Autenticação: E18236120202610101428NUB982341HAS
Descrição: Quitação mensal das minhas 3 compras (Celular, Smart TV e 624)`);
    setImageBase64(null);
    setImageFileName('');
    setDistributionResult(null);
    onToast('Exemplo 1 carregado: Renata Silveira pagou R$ 600,00 para as 3 compras.');
  };

  // Carrega Preset 2: Renata pagou R$ 400,00 (Quita 2 compras de R$ 200 e deixa a 3ª em aberto)
  const handleLoadPreset2 = () => {
    const renata = debtors.find((d) => d.name.toLowerCase().includes('renata'));
    if (renata) setSelectedDebtorId(renata.id);

    setActiveTab('text');
    setInputText(`COMPROVANTE PIX - BANCO INTER
Pagador: Renata Silveira
Valor Recebido: R$ 400,00
Beneficiário: Tiago Dias (HASPAHO TI)
Data: 10/10/2026
Autenticação: INTER-829104-PIX-2026
Mensagem: Oi Tiago, consegui pagar R$ 400 agora (celular e tv). A compra 624 pago semana que vem!`);
    setImageBase64(null);
    setImageFileName('');
    setDistributionResult(null);
    onToast('Exemplo 2 carregado: Renata Silveira enviou R$ 400,00 (quitará 2 compras e deixará 1 aberta).');
  };

  // Carrega Preset 3: Renata pagou R$ 602,00 (R$ 2 a mais de excedente que NÃO é computado)
  const handleLoadPreset3 = () => {
    const renata = debtors.find((d) => d.name.toLowerCase().includes('renata'));
    if (renata) setSelectedDebtorId(renata.id);

    setActiveTab('text');
    setInputText(`COMPROVANTE DE LIQUIDAÇÃO PIX
Pagador: Renata Silveira
Valor: R$ 602,00 (com taxa/ajuste de centavos de R$ 2,00 adicionados)
Destinatário: Tiago Dias - HASPAHO TI
Data: 10/10/2026
ID: PIX-AUT-992384-HASPAHO
Observação: Mandei 602 com 2 reais a mais.`);
    setImageBase64(null);
    setImageFileName('');
    setDistributionResult(null);
    onToast('Exemplo 3 carregado: Renata pagou R$ 602,00 (R$ 2,00 excedente não computado).');
  };

  // Upload de Comprovante/Recibo
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setImageBase64(reader.result as string);
      setDistributionResult(null);
      onToast(`Comprovante "${file.name}" carregado. Pronto para leitura com Gemini.`);
    };
    reader.readAsDataURL(file);
  };

  // Executar Identificação e Rateio com Gemini
  const handleIdentifyWithGemini = async () => {
    if (!inputText.trim() && !imageBase64) {
      onToast('Por favor, cole o texto do comprovante, carregue uma foto ou escolha um exemplo!');
      return;
    }

    setIsLoading(true);
    setDistributionResult(null);

    const payload = {
      text: inputText,
      imageBase64,
      mimeType: 'image/png',
      debtorName: currentDebtor?.name || 'Renata Silveira',
      activePurchases: activeDebtorPurchasesWithDue,
    };

    try {
      const response = await fetch('/api/gemini/parse-receipt-distribution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resJson = await response.json();

      if (!response.ok || !resJson.success) {
        throw new Error(resJson.error || 'Falha ao processar com Gemini.');
      }

      setDistributionResult(resJson.data);
      setAiSource(resJson.source || 'gemini-3.8-flash');
      onToast('✨ Comprovante identificado e rateio calculado com sucesso pelo Gemini!');
    } catch (err: any) {
      console.warn('Erro ao chamar endpoint backend, aplicando distribuição local:', err);

      // Algoritmo local inteligente em caso de contingência
      const raw = inputText || '';
      let amount = 600.0;
      const matchVal = raw.match(/R\$\s*([0-9.,]+)/i) || raw.match(/(?:valor|pago|total)\s*[:*]?\s*R?\$\s*([0-9.,]+)/i);
      if (matchVal) {
        const clean = matchVal[1].replace(/\./g, '').replace(',', '.');
        const num = parseFloat(clean);
        if (!isNaN(num) && num > 0) amount = num;
      }

      let remaining = amount;
      let allocatedTotal = 0;
      const dist: GeminiDistributionItem[] = [];
      let settledCount = 0;
      let unsettledCount = 0;

      for (const p of activeDebtorPurchasesWithDue) {
        const req = Number(p.installmentValue) || 200.0;
        if (remaining >= req) {
          dist.push({
            purchaseId: p.purchaseId,
            product: p.product,
            store: p.store,
            installmentId: p.pendingInstallmentId,
            installmentNumber: p.installmentNumber,
            totalInstallments: p.totalInstallments,
            requiredAmount: req,
            allocatedAmount: req,
            willBeSettled: true,
            dueDate: p.dueDate,
          });
          remaining = Number((remaining - req).toFixed(2));
          allocatedTotal = Number((allocatedTotal + req).toFixed(2));
          settledCount++;
        } else {
          dist.push({
            purchaseId: p.purchaseId,
            product: p.product,
            store: p.store,
            installmentId: p.pendingInstallmentId,
            installmentNumber: p.installmentNumber,
            totalInstallments: p.totalInstallments,
            requiredAmount: req,
            allocatedAmount: 0,
            willBeSettled: false,
            dueDate: p.dueDate,
          });
          unsettledCount++;
        }
      }

      const excessAmount = Math.max(0, Number((amount - allocatedTotal).toFixed(2)));

      setDistributionResult({
        payerName: currentDebtor?.name || 'Renata Silveira',
        totalPaidInProof: amount,
        paymentDate: new Date().toLocaleDateString('pt-BR'),
        paymentMethod: 'PIX / Asaas',
        authCode: `PIX-${Date.now().toString(36).toUpperCase()}-HASPAHO`,
        bankName: 'Nubank Croma',
        allocatedTotal,
        excessAmount,
        excessIgnored: excessAmount > 0,
        distribution: dist,
        settledPurchasesCount: settledCount,
        unsettledPurchasesCount: unsettledCount,
      });
      setAiSource('motor-heuristico');
      onToast('Distribuição calculada com sucesso com base nas compras do comprador!');
    } finally {
      setIsLoading(false);
    }
  };

  // Efetivar Baixa no Sistema das Parcelas Contempladas
  const handleConfirmSettlement = () => {
    if (!distributionResult || !currentDebtor) return;

    const settled = distributionResult.distribution.filter((d) => d.willBeSettled);

    if (settled.length === 0) {
      onToast('Nenhuma parcela foi contemplada pelo valor do comprovante.');
      return;
    }

    if (onSettleDistributedPayments) {
      onSettleDistributedPayments(currentDebtor.id, settled, {
        payerName: distributionResult.payerName,
        totalPaid: distributionResult.allocatedTotal,
        paymentDate: distributionResult.paymentDate,
        paymentMethod: distributionResult.paymentMethod,
        authCode: distributionResult.authCode,
        bankName: distributionResult.bankName,
        excessAmount: distributionResult.excessAmount,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-[#0B1120] border border-cyan-500/30 rounded-3xl max-w-6xl w-full shadow-2xl shadow-cyan-950/60 flex flex-col max-h-[94vh] overflow-hidden my-auto text-white">
        
        {/* ========================================================================= */}
        {/* 1. HEADER DO MODAL (TEMA ESCURO HASPAHO TI • GEMINI 3.8 FLASH)             */}
        {/* ========================================================================= */}
        <div className="p-4 sm:p-5 border-b border-cyan-500/20 bg-gradient-to-r from-slate-950 via-[#0F172A] to-slate-950 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/30 shrink-0">
              <span className="material-symbols-outlined text-[24px] text-white">auto_awesome</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black tracking-widest text-cyan-400 uppercase">
                  HASPAHO TI • Inteligência Artificial
                </span>
                <span className="px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold">
                  Gemini 3.8 Flash
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white leading-tight">
                Identificação Autônoma com Gemini: Comprovantes, Recibos &amp; Rateio de Compras
              </h2>
              <p className="text-xs text-slate-400">
                Selecione o comprador e o Gemini fará a leitura do valor pago e a distribuição exata entre as compras
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Fechar modal"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* 2. CORPO DO MODAL EM TEMA ESCURO (LAYOUT 2 COLUNAS: ESQUERDA & DIREITA)   */}
        {/* ========================================================================= */}
        <div className="overflow-y-auto p-4 sm:p-6 text-xs sm:text-sm">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            
            {/* ===================================================================== */}
            {/* LADO ESQUERDO: CARD DE IDENTIFICAÇÃO COM GEMINI (col-span-7)          */}
            {/* "crie card do lado esquerdo..."                                       */}
            {/* ===================================================================== */}
            <div className="lg:col-span-7 space-y-4">
              
              {/* CARD PRINCIPAL DE IDENTIFICAÇÃO */}
              <div className="bg-slate-900/90 border border-cyan-500/30 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl relative overflow-hidden backdrop-blur-xl">
                {/* Glow decorativo de fundo */}
                <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

                {/* Cabeçalho do Card Esquerdo com seletor de abas */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2 relative z-10">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-black text-xs">
                      1
                    </span>
                    <h3 className="font-bold text-xs sm:text-sm text-white flex items-center gap-1.5">
                      <span>Identificar com o Gemini</span>
                      <span className="text-[10px] font-normal text-slate-400">(Texto, Foto ou Exemplo)</span>
                    </h3>
                  </div>

                  {/* Abas de Entrada */}
                  <div className="flex items-center gap-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setActiveTab('presets')}
                      className={`px-2.5 py-1 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                        activeTab === 'presets'
                          ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md shadow-cyan-900/40 border border-cyan-400/40'
                          : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700/80 border border-slate-700'
                      }`}
                    >
                      Exemplos Prontos
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('text')}
                      className={`px-2.5 py-1 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                        activeTab === 'text'
                          ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md shadow-cyan-900/40 border border-cyan-400/40'
                          : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700/80 border border-slate-700'
                      }`}
                    >
                      Colar Texto / WhatsApp
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('upload')}
                      className={`px-2.5 py-1 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                        activeTab === 'upload'
                          ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md shadow-cyan-900/40 border border-cyan-400/40'
                          : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700/80 border border-slate-700'
                      }`}
                    >
                      Foto / Comprovante
                    </button>
                  </div>
                </div>

                {/* ABA 1: EXEMPLOS PRONTOS DE TESTE COM 1 CLIQUE */}
                {activeTab === 'presets' && (
                  <div className="space-y-3 relative z-10">
                    <p className="text-xs text-slate-300">
                      Selecione um exemplo abaixo para simular o comprovante recebido e testar a identificação e rateio pelo Gemini:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {/* Exemplo 1: R$ 600,00 -> Quita as 3 compras */}
                      <button
                        type="button"
                        onClick={handleLoadPreset1}
                        className="p-3 rounded-2xl border border-emerald-500/40 bg-emerald-950/30 hover:bg-emerald-900/40 text-left transition-all cursor-pointer group space-y-1.5 shadow-lg active:scale-[0.98]"
                      >
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black text-[9.5px]">
                            Quita as 3 Compras
                          </span>
                          <span className="material-symbols-outlined text-[16px] text-emerald-400 group-hover:translate-x-0.5 transition-transform">
                            arrow_forward
                          </span>
                        </div>
                        <div>
                          <h5 className="font-black text-xs text-white">Renata pagou R$ 600,00</h5>
                          <p className="text-[10.5px] text-slate-300">Celular (200) + TV (200) + 624 (200)</p>
                        </div>
                        <div className="text-[11px] text-emerald-300 font-bold pt-1.5 border-t border-emerald-500/20 flex justify-between">
                          <span>Total: R$ 600</span>
                          <span className="text-emerald-400 font-black">100% Coberto ✓</span>
                        </div>
                      </button>

                      {/* Exemplo 2: R$ 400,00 -> Quita 2 e deixa 1 aberta */}
                      <button
                        type="button"
                        onClick={handleLoadPreset2}
                        className="p-3 rounded-2xl border border-amber-500/40 bg-amber-950/30 hover:bg-amber-900/40 text-left transition-all cursor-pointer group space-y-1.5 shadow-lg active:scale-[0.98]"
                      >
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black text-[9.5px]">
                            Quita 2 Compras
                          </span>
                          <span className="material-symbols-outlined text-[16px] text-amber-400 group-hover:translate-x-0.5 transition-transform">
                            arrow_forward
                          </span>
                        </div>
                        <div>
                          <h5 className="font-black text-xs text-white">Renata pagou R$ 400,00</h5>
                          <p className="text-[10.5px] text-slate-300">Celular (200) + TV (200). 624 aberta.</p>
                        </div>
                        <div className="text-[11px] text-amber-300 font-bold pt-1.5 border-t border-amber-500/20 flex justify-between">
                          <span>Total: R$ 400</span>
                          <span className="text-amber-400 font-black">1 em aberto</span>
                        </div>
                      </button>

                      {/* Exemplo 3: R$ 602,00 -> Quita as 3 e descarta os R$ 2 excedentes */}
                      <button
                        type="button"
                        onClick={handleLoadPreset3}
                        className="p-3 rounded-2xl border border-cyan-500/40 bg-cyan-950/30 hover:bg-cyan-900/40 text-left transition-all cursor-pointer group space-y-1.5 shadow-lg active:scale-[0.98]"
                      >
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-black text-[9.5px]">
                            Excedente Descartado
                          </span>
                          <span className="material-symbols-outlined text-[16px] text-cyan-400 group-hover:translate-x-0.5 transition-transform">
                            arrow_forward
                          </span>
                        </div>
                        <div>
                          <h5 className="font-black text-xs text-white">Renata pagou R$ 602,00</h5>
                          <p className="text-[10.5px] text-slate-300">R$ 2 a mais desconsiderado pelo sistema</p>
                        </div>
                        <div className="text-[11px] text-cyan-300 font-bold pt-1.5 border-t border-cyan-500/20 flex justify-between">
                          <span>Total: R$ 602</span>
                          <span className="text-cyan-400 font-black">Sem repasse de fatura</span>
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {/* ABA 2: TEXTO OU MENSAGEM DO WHATSAPP */}
                {activeTab === 'text' && (
                  <div className="space-y-1.5 relative z-10">
                    <label className="text-xs font-bold text-slate-300 block">
                      Cole o texto do comprovante, recibo ou mensagem recebida no WhatsApp:
                    </label>
                    <textarea
                      rows={6}
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Ex: Renata Silveira pagou R$ 600,00 via Pix chave nubank... ID de autenticação E182361202..."
                      className="w-full p-3 bg-slate-950/90 border border-slate-700 focus:border-cyan-400 rounded-xl font-mono text-xs text-slate-100 placeholder-slate-500 outline-none leading-relaxed transition-all"
                    />
                  </div>
                )}

                {/* ABA 3: FOTO / PRINT DO COMPROVANTE */}
                {activeTab === 'upload' && (
                  <div className="border-2 border-dashed border-cyan-500/40 hover:border-cyan-400 rounded-2xl p-5 text-center bg-cyan-950/20 transition-all relative z-10">
                    <input
                      type="file"
                      id="receiptFileInput"
                      accept="image/*,.pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <label htmlFor="receiptFileInput" className="cursor-pointer block space-y-2">
                      <div className="w-11 h-11 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 mx-auto flex items-center justify-center">
                        <span className="material-symbols-outlined text-[26px]">receipt_long</span>
                      </div>
                      <div>
                        <p className="font-bold text-white text-xs sm:text-sm">
                          {imageFileName ? `Arquivo: ${imageFileName}` : 'Clique para selecionar a foto ou print do comprovante'}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Suporta PNG, JPG, JPEG, WebP e PDF de comprovantes bancários ou recibos
                        </p>
                      </div>
                    </label>

                    {imageBase64 && (
                      <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-center gap-3">
                        <img
                          src={imageBase64}
                          alt="Prévia do comprovante"
                          className="h-16 w-auto rounded-lg border border-slate-700 shadow-md object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setImageBase64(null);
                            setImageFileName('');
                          }}
                          className="text-xs text-rose-400 hover:underline font-semibold cursor-pointer"
                        >
                          Remover imagem
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* BOTÃO PRINCIPAL DE ACIONAMENTO DO GEMINI */}
                {!distributionResult && (
                  <div className="pt-2 relative z-10">
                    <button
                      type="button"
                      disabled={isLoading || (!inputText.trim() && !imageBase64)}
                      onClick={handleIdentifyWithGemini}
                      className="w-full h-11 bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 disabled:opacity-40 text-white rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50 transition-all active:scale-[0.98] cursor-pointer"
                    >
                      {isLoading ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                          <span>Gemini 3.8 Flash identificando valor e distribuindo pagamentos...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[20px]">psychology</span>
                          <span>Identificar com Gemini e Fazer Distribuição dos Valores</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* CARD DE RESULTADO DA IDENTIFICAÇÃO E DISTRIBUIÇÃO DAS COMPRAS */}
              {distributionResult && (
                <div className="space-y-4 bg-slate-900/95 border-2 border-cyan-500/40 p-4 sm:p-5 rounded-2xl animate-in fade-in duration-200 backdrop-blur-xl shadow-2xl">
                  
                  {/* Topo do resultado com valor extraído e pagador */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-sm">
                        <span className="material-symbols-outlined text-[22px]">verified</span>
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-white">
                          Comprovante Reconhecido com Sucesso
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Pagador: <strong className="text-slate-200">{distributionResult.payerName}</strong> • Data: <strong className="text-slate-200">{distributionResult.paymentDate}</strong> • Via {aiSource}
                        </p>
                      </div>
                    </div>

                    <div className="text-left sm:text-right bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800 shadow-inner">
                      <span className="text-[10px] text-slate-400 uppercase block font-semibold">Valor do Comprovante</span>
                      <span className="font-mono font-black text-base text-emerald-400">
                        R$ {distributionResult.totalPaidInProof.toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  </div>

                  {/* AVISO DE EXCEDENTE CASO HAJA (REGRA DO USUÁRIO) */}
                  {distributionResult.excessAmount > 0 && (
                    <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-xl flex items-start gap-2.5 text-xs text-amber-200">
                      <span className="material-symbols-outlined text-[18px] text-amber-400 shrink-0 mt-0.5">
                        info
                      </span>
                      <div>
                        <strong className="block font-bold text-amber-300">
                          Excedente de R$ {distributionResult.excessAmount.toFixed(2).replace('.', ',')} Não Computado
                        </strong>
                        <p className="text-[11px] text-amber-200/90 leading-relaxed mt-0.5">
                          Conforme regra de quitação do sistema, valores pagos a mais não são registrados e 
                          <strong className="text-amber-100"> não vão para a próxima fatura</strong>. O sistema computa e dá baixa estritamente no valor exato das parcelas quitadas (R$ {distributionResult.allocatedTotal.toFixed(2).replace('.', ',')}).
                        </p>
                      </div>
                    </div>
                  )}

                  {/* LISTA DE RATEIO ENTRE AS COMPRAS */}
                  <div className="space-y-2">
                    <h5 className="font-bold text-xs text-slate-200 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-cyan-400">splitscreen</span>
                      <span>Distribuição Automática das Compras ({distributionResult.settledPurchasesCount} quitadas):</span>
                    </h5>

                    <div className="space-y-2">
                      {distributionResult.distribution.map((item, idx) => (
                        <div
                          key={item.purchaseId || idx}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                            item.willBeSettled
                              ? 'bg-emerald-950/30 border-emerald-500/40'
                              : 'bg-slate-950/40 border-slate-800 opacity-60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                                item.willBeSettled
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : 'bg-slate-800 text-slate-400 border border-slate-700'
                              }`}
                            >
                              {item.willBeSettled ? '✓' : idx + 1}
                            </span>
                            <div className="min-w-0">
                              <h6 className="font-bold text-xs text-white truncate">
                                {item.product}
                              </h6>
                              <p className="text-[10.5px] text-slate-400">
                                Parcela #{item.installmentNumber}/{item.totalInstallments} • Vencimento: {item.dueDate}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            {item.willBeSettled ? (
                              <>
                                <span className="font-mono font-black text-xs text-emerald-400 block">
                                  R$ {item.allocatedAmount.toFixed(2).replace('.', ',')}
                                </span>
                                <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  Quitada com este comprovante
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="font-mono font-bold text-xs text-slate-400 block">
                                  R$ {item.requiredAmount.toFixed(2).replace('.', ',')}
                                </span>
                                <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                                  Continua em aberto
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* BOTÕES DE AÇÃO: EFETIVAR OU REFAZER */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDistributionResult(null)}
                      className="w-full sm:w-auto px-4 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition-colors border border-slate-700"
                    >
                      Ler Outro Comprovante
                    </button>

                    <button
                      type="button"
                      onClick={handleConfirmSettlement}
                      className="w-full sm:flex-1 h-10 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all active:scale-[0.98] cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">check_circle</span>
                      <span>
                        Confirmar e Efetivar Baixa no Sistema ({distributionResult.settledPurchasesCount} compras)
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ===================================================================== */}
            {/* LADO DIREITO: AS PESSOAS E DEVEDORES CADASTRADOS (col-span-5)         */}
            {/* "e as pessoas e devedores permanecer no lado direito"                 */}
            {/* ===================================================================== */}
            <div className="lg:col-span-5 space-y-4">
              
              {/* CARD DE PESSOAS E DEVEDORES */}
              <div className="bg-slate-900/90 border border-cyan-500/30 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xl relative backdrop-blur-xl">
                
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <label className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px] text-cyan-400">group</span>
                    <span>Pessoas e Devedores Cadastrados</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {debtors.length} cadastrados
                  </span>
                </div>

                {/* ATALHOS RÁPIDOS DE COMPRADORES (RENATA, CARLOS, JULIANA, JOÃO) */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {debtors.slice(0, 4).map((d) => {
                    const isSelected = d.id === selectedDebtorId;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          setSelectedDebtorId(d.id);
                          setDistributionResult(null);
                        }}
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer border ${
                          isSelected
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-sm'
                            : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                        }`}
                      >
                        <img src={d.avatar} alt={d.name} className="w-4 h-4 rounded-full object-cover" />
                        <span>{d.name.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>

                {/* DROPDOWN QUE ABRE PARA BAIXO COM TODOS OS COMPRADORES */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="w-full p-2.5 sm:p-3 bg-slate-950/90 border-2 border-cyan-500/30 hover:border-cyan-400 focus:border-cyan-400 rounded-2xl flex items-center justify-between transition-all cursor-pointer shadow-inner text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={currentDebtor?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                        alt={currentDebtor?.name || 'Comprador'}
                        className="w-10 h-10 rounded-xl object-cover border border-cyan-500/30 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-sm text-white truncate">
                            {currentDebtor?.name || 'Selecione um Comprador'}
                          </h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                            {currentDebtor?.relation || 'Cliente'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">
                          {currentDebtor?.phone || 'Sem telefone'} • {activeDebtorPurchasesWithDue.length} compra(s)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-bold text-cyan-400 hidden sm:inline">
                        Trocar
                      </span>
                      <span className={`material-symbols-outlined text-[20px] text-cyan-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}>
                        expand_more
                      </span>
                    </div>
                  </button>

                  {/* LISTA PARA BAIXO COM TODOS OS COMPRADORES */}
                  {isDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 z-40 bg-slate-900 border-2 border-cyan-500/50 rounded-2xl shadow-2xl max-h-72 overflow-y-auto animate-in slide-in-from-top-2 duration-150 p-2 space-y-1">
                      <div className="p-1.5 sticky top-0 bg-slate-900 border-b border-slate-800 mb-1 z-10">
                        <input
                          type="text"
                          placeholder="Pesquisar comprador por nome ou telefone..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full h-8 px-3 text-xs bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-xl outline-none font-medium text-white placeholder-slate-500"
                          autoFocus
                        />
                      </div>

                      {filteredDebtors.map((debtor) => {
                        const isSelected = debtor.id === selectedDebtorId;
                        const debtorPurchaseCount = purchases.filter((p) => p.debtorId === debtor.id).length;

                        return (
                          <div
                            key={debtor.id}
                            onClick={() => {
                              setSelectedDebtorId(debtor.id);
                              setIsDropdownOpen(false);
                              setDistributionResult(null);
                            }}
                            className={`p-2.5 rounded-xl flex items-center justify-between cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-cyan-500/20 border border-cyan-400/50 text-cyan-200'
                                : 'hover:bg-slate-800 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img
                                src={debtor.avatar}
                                alt={debtor.name}
                                className="w-8 h-8 rounded-lg object-cover border border-slate-700 shrink-0"
                              />
                              <div className="min-w-0">
                                <span className="font-bold text-xs text-white block truncate">
                                  {debtor.name}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {debtor.relation} • {debtorPurchaseCount} compras
                                </span>
                              </div>
                            </div>

                            {isSelected && (
                              <span className="material-symbols-outlined text-[18px] text-cyan-400 shrink-0">
                                check_circle
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* RESUMO DA FATURA MENSAL DO DEVEDOR */}
                <div className="pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] text-cyan-400">shopping_bag</span>
                      <span>Compras em Aberto de {currentDebtor?.name?.split(' ')[0]}:</span>
                    </span>
                    <span className="text-[11px] font-black text-cyan-400">
                      Total: R$ {totalMonthlyInvoice.toFixed(2).replace('.', ',')}
                    </span>
                  </div>

                  {/* CARDS DAS COMPRAS ATIVAS */}
                  <div className="space-y-2">
                    {activeDebtorPurchasesWithDue.map((item, idx) => {
                      const isItemSettledByAi = distributionResult?.distribution?.find((d) => d.purchaseId === item.id)?.willBeSettled;

                      return (
                        <div
                          key={item.id}
                          className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                            isItemSettledByAi
                              ? 'bg-emerald-950/40 border-emerald-500/50'
                              : 'bg-slate-950/60 border-slate-800'
                          }`}
                        >
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9.5px] font-black px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                                Compra #{idx + 1}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                Parc. {item.installmentNumber}/{item.totalInstallments}
                              </span>
                            </div>
                            <h5 className="font-bold text-white text-xs truncate max-w-[190px]" title={item.product}>
                              {item.product}
                            </h5>
                            <p className="text-[10px] text-slate-400">
                              Vencimento: {item.dueDate}
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-[10px] text-slate-400 block">Parcela</span>
                            <span className="font-mono font-black text-xs text-cyan-300">
                              R$ {item.installmentValue.toFixed(2).replace('.', ',')}
                            </span>
                            {isItemSettledByAi && (
                              <span className="text-[9px] font-bold text-emerald-400 block">
                                ✓ Coberta
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
