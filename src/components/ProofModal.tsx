import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { HaspahoLogo } from './HaspahoLogo';
import { registerAuthCode } from '../utils/authRegistry';
import { printHtmlContent } from '../utils/printHelper';
import { Installment, Debtor, UserAccount } from '../types';
import { valorPorExtenso } from '../utils/numberToWordsPtBr';
import { downloadIndividualReceiptPdf } from '../utils/receiptPdfHelper';
import { generatePixQrCodeDataUrl } from '../utils/pixQrCodeHelper';

interface ProofModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: {
    payer: string;
    amount: string;
    date: string;
    dest: string;
    auth: string;
    item: string;
    debtorId?: string;
  } | null;
  installments?: Installment[];
  onToast: (msg: string) => void;
  currentUser?: UserAccount | null;
  debtors?: Debtor[];
  onSettleInstallment?: (inst: Installment) => void;
  onConfirmPayment?: (
    installmentId: string,
    method: string,
    paidDate: string,
    actualPaidAmount?: number
  ) => string | void;
  onOpenExtratoTotal?: (purchaseId?: string, debtorId?: string) => void;
}

const CONFETTI_PARTICLES = Array.from({ length: 28 }, (_, idx) => {
  const colors = [
    '#10b981', // emerald-500
    '#34d399', // emerald-400
    '#fbbf24', // amber-400
    '#f59e0b', // amber-500
    '#06b6d4', // cyan-500
    '#2dd4bf', // teal-400
    '#a7f3d0', // emerald-200
  ];
  return {
    id: idx,
    left: `${(idx * 3.7 + (idx % 3) * 2.1) % 98}%`,
    delay: `${(idx % 7) * 0.08}s`,
    duration: `${1.8 + (idx % 5) * 0.35}s`,
    color: colors[idx % colors.length],
    rotation: (idx * 47) % 360,
    isCircle: idx % 4 === 0,
  };
});

/**
 * ProofModal - RECIBO DE PAGAMENTO INDIVIDUAL
 * "O recibo ele é individual. Quando é algo total, aí não estamos falando de recibo, estamos falando de extrato."
 */
export const ProofModal: React.FC<ProofModalProps> = ({
  isOpen,
  onClose,
  data,
  installments = [],
  onToast,
  currentUser,
  debtors = [],
  onSettleInstallment,
  onConfirmPayment,
  onOpenExtratoTotal,
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isGlowActive, setIsGlowActive] = useState(false);
  const [showCelebrationBanner, setShowCelebrationBanner] = useState(false);
  const [confettiBurstKey, setConfettiBurstKey] = useState(0);
  const [celebrationMessage, setCelebrationMessage] = useState<string>(
    'Parcela marcada como paga com sucesso! Quitação autenticada.'
  );
  const [localDisplayData, setLocalDisplayData] = useState<ProofModalProps['data']>(data);
  const [isConfirmingNextQuitar, setIsConfirmingNextQuitar] = useState(false);

  useEffect(() => {
    setLocalDisplayData(data);
    setIsConfirmingNextQuitar(false);
  }, [data, isOpen]);

  const activeData = localDisplayData || data;

  // Dispara a animação combinada de Confetti + Glow de celebração de parcela paga
  const triggerPaymentSuccessCelebration = useCallback((customMsg?: string) => {
    if (customMsg) {
      setCelebrationMessage(customMsg);
    } else {
      setCelebrationMessage('Parcela marcada como paga com sucesso! Quitação autenticada.');
    }
    setIsGlowActive(true);
    setShowCelebrationBanner(true);
    setConfettiBurstKey((prev) => prev + 1);

    try {
      confetti({
        particleCount: 75,
        spread: 80,
        origin: { y: 0.58 },
        colors: ['#10b981', '#34d399', '#fbbf24', '#06b6d4', '#f59e0b', '#a7f3d0'],
        zIndex: 9999,
        disableForReducedMotion: true,
      });

      setTimeout(() => {
        try {
          confetti({
            particleCount: 40,
            angle: 60,
            spread: 55,
            origin: { x: 0.12, y: 0.65 },
            colors: ['#10b981', '#fbbf24', '#06b6d4', '#34d399'],
            zIndex: 9999,
            disableForReducedMotion: true,
          });
          confetti({
            particleCount: 40,
            angle: 120,
            spread: 55,
            origin: { x: 0.88, y: 0.65 },
            colors: ['#10b981', '#fbbf24', '#06b6d4', '#34d399'],
            zIndex: 9999,
            disableForReducedMotion: true,
          });
        } catch {
          // fallback visual CSS confetti permanece ativo
        }
      }, 200);
    } catch {
      // fallback visual CSS confetti permanece ativo
    }
  }, []);

  // Dispara automaticamente o feedback visual positivo (Confetti + Glow) quando o comprovante de parcela paga é aberto
  useEffect(() => {
    if (!isOpen || !activeData) {
      setIsGlowActive(false);
      setShowCelebrationBanner(false);
      return;
    }

    triggerPaymentSuccessCelebration(
      `Parcela quitada com sucesso (${activeData.amount})! Comprovante individual autenticado.`
    );

    const glowTimer = setTimeout(() => {
      setIsGlowActive(false);
    }, 4500);

    return () => clearTimeout(glowTimer);
  }, [isOpen, activeData?.auth, activeData?.item, activeData?.amount, triggerPaymentSuccessCelebration]);

  // Registra automaticamente o código de autenticação no Registro Central Oficial
  useEffect(() => {
    if (isOpen && activeData && activeData.auth) {
      registerAuthCode({
        auth: activeData.auth,
        type: 'recibo',
        payer: activeData.payer,
        amount: activeData.amount,
        date: activeData.date,
        bank: 'Nubank Croma / Asaas IP',
        item: activeData.item,
        destination: activeData.dest,
        status: 'AUTÊNTICO E LIQUIDADO',
      });
    }
  }, [isOpen, activeData]);

  // Parser dos detalhes da parcela quitada
  const parsedInstallment = useMemo(() => {
    if (!activeData || !activeData.item) {
      return { product: 'Parcela', current: '1', total: '1', didacticText: 'Parcela 1 de 1' };
    }
    const raw = String(activeData.item).trim();

    // Formato 1: Item (Parcela 3/10) ou Item (Parcela #3/10) ou Item (Parcela 3 de 10)
    const match1 = raw.match(/(.*?)\s*\(\s*(?:Parcela\s*#?)?\s*(\d+)\s*(?:\/|\s+de\s+)\s*(\d+)\s*\)/i);
    if (match1) {
      const current = match1[2];
      const total = match1[3];
      const product = match1[1].trim();
      return {
        product: product || 'Produto',
        current: current || '1',
        total: total || '1',
        didacticText: `Parcela ${current} de ${total} (${current}ª Parcela)`,
      };
    }

    // Formato 2: Item - Parcela 3/10 ou Item - 3/10
    const match2 = raw.match(/(.*?)(?:[-–—]\s*|\s+)(?:Parcela\s*#?)?(\d+)\s*(?:\/|\s+de\s+)\s*(\d+)/i);
    if (match2) {
      const current = match2[2];
      const total = match2[3];
      const product = match2[1].replace(/[\(\[\-–—]/g, '').trim();
      return {
        product: product || 'Produto',
        current: current || '1',
        total: total || '1',
        didacticText: `Parcela ${current} de ${total} (${current}ª Parcela)`,
      };
    }

    return {
      product: raw || 'Produto',
      current: '1',
      total: '1',
      didacticText: raw || 'Parcela Individual',
    };
  }, [activeData]);

  // Devedor identificado
  const currentDebtor = useMemo(() => {
    if (!activeData) return null;
    if (activeData.debtorId) {
      const found = debtors.find((d) => d && d.id === activeData.debtorId);
      if (found) return found;
    }
    const cleanPayer = (activeData.payer || '').toLowerCase().trim();
    if (!cleanPayer) return null;
    return (
      debtors.find((d) => {
        if (!d || !d.name) return false;
        const dName = String(d.name).toLowerCase().trim();
        return dName && (dName === cleanPayer || cleanPayer.includes(dName) || dName.includes(cleanPayer));
      }) || null
    );
  }, [activeData, debtors]);

  // Próxima parcela em aberto do mesmo devedor/produto para permitir baixa rápida com animação diretamente no modal
  const nextPendingInstallment = useMemo(() => {
    if (!activeData || !installments || installments.length === 0) return null;
    const cleanPayer = (activeData.payer || '').toLowerCase().trim();
    const cleanProd = (parsedInstallment.product || '').toLowerCase().trim();

    const debtorPending = installments
      .filter((inst) => {
        if (!inst || inst.status === 'paid') return false;
        if (currentDebtor && inst.debtorId === currentDebtor.id) return true;
        const iName = (inst.debtorName || '').toLowerCase().trim();
        return Boolean(cleanPayer && iName && (iName === cleanPayer || cleanPayer.includes(iName) || iName.includes(cleanPayer)));
      })
      .sort((a, b) => a.installmentNumber - b.installmentNumber);

    if (debtorPending.length === 0) return null;
    const sameProduct = debtorPending.find(
      (i) => cleanProd && (i.product || '').toLowerCase().trim().includes(cleanProd)
    );
    return sameProduct || debtorPending[0];
  }, [activeData, installments, currentDebtor, parsedInstallment.product]);

  // Valor numérico e conversão oficial por extenso
  const numericAmount = useMemo(() => {
    if (!activeData?.amount) return 0;
    const str = String(activeData.amount).replace('R$', '').trim();
    if (str.includes(',')) {
      const clean = str.replace(/\./g, '').replace(',', '.');
      return parseFloat(clean) || 0;
    }
    return parseFloat(str) || 0;
  }, [activeData]);

  const amountInWords = useMemo(() => {
    return valorPorExtenso(numericAmount || 0);
  }, [numericAmount]);

  const creditorName = currentUser?.name || 'Tiago Dias';
  const creditorCompany = currentUser?.companyName || 'HASPAHO Tecnologia da Informação';
  const creditorPix = currentUser?.pixKey || '(14) 99733-9863';
  const creditorLocation = `${currentUser?.city || 'Mineiros do Tietê'} - ${currentUser?.state || 'SP'}`;

  // Gera o QR Code PIX
  useEffect(() => {
    if (isOpen && creditorPix && numericAmount > 0) {
      generatePixQrCodeDataUrl(creditorPix, numericAmount, creditorName)
        .then((url) => setQrCodeDataUrl(url))
        .catch(() => setQrCodeDataUrl(''));
    }
  }, [isOpen, creditorPix, numericAmount, creditorName]);

  if (!isOpen || !activeData) return null;

  const handleQuickMarkNextAsPaid = () => {
    if (!nextPendingInstallment) return;
    setIsConfirmingNextQuitar(false);
    const todayStr = new Date().toLocaleDateString('pt-BR');
    const amountFormatted = `R$ ${(nextPendingInstallment.originalAmount || nextPendingInstallment.amount || 0)
      .toFixed(2)
      .replace('.', ',')}`;

    if (onConfirmPayment) {
      const newAuth = onConfirmPayment(
        nextPendingInstallment.id,
        activeData.dest || 'PIX',
        todayStr,
        nextPendingInstallment.originalAmount || nextPendingInstallment.amount
      );
      const resolvedAuth =
        typeof newAuth === 'string' && newAuth ? newAuth : `AUTH-${Date.now().toString(36).toUpperCase()}`;

      setLocalDisplayData({
        payer: nextPendingInstallment.debtorName || activeData.payer,
        amount: amountFormatted,
        date: todayStr,
        dest: activeData.dest || 'PIX',
        auth: resolvedAuth,
        item: `${nextPendingInstallment.product} (Parcela ${nextPendingInstallment.installmentNumber}/${nextPendingInstallment.totalInstallments})`,
        debtorId: nextPendingInstallment.debtorId || activeData.debtorId,
      });

      triggerPaymentSuccessCelebration(
        `🎉 Parcela #${nextPendingInstallment.installmentNumber}/${nextPendingInstallment.totalInstallments} (${amountFormatted}) marcada como paga com sucesso!`
      );
    } else if (onSettleInstallment) {
      triggerPaymentSuccessCelebration(
        `Abrindo liquidação da Parcela #${nextPendingInstallment.installmentNumber}/${nextPendingInstallment.totalInstallments}...`
      );
      onClose();
      onSettleInstallment(nextPendingInstallment);
    }
  };

  const handleCopyProtocol = () => {
    navigator.clipboard?.writeText(activeData.auth);
    onToast('Código de autenticação individual copiado com sucesso!');
  };

  // Disparar o download direto do PDF do Recibo Individual
  const handleDownloadPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      onToast(`📄 Baixando recibo individual da Parcela #${parsedInstallment.current}/${parsedInstallment.total}...`);

      await downloadIndividualReceiptPdf({
        payerName: currentDebtor?.name || activeData.payer,
        payerPhone: currentDebtor?.phone,
        creditorName,
        creditorCompany,
        creditorPix,
        creditorLocation,
        productName: parsedInstallment.product,
        installmentNumber: Number(parsedInstallment.current) || 1,
        totalInstallments: Number(parsedInstallment.total) || 1,
        amount: numericAmount,
        paymentDate: activeData.date,
        paymentMethod: activeData.dest,
        authCode: activeData.auth,
      });

      onToast('✅ Recibo individual em PDF baixado com sucesso!');
    } catch (err) {
      console.error('Erro ao baixar recibo em PDF:', err);
      onToast('Erro ao baixar recibo em PDF. Tente novamente.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Enviar Recibo Individual no WhatsApp
  const handleShareWhatsApp = () => {
    const text = `*RECIBO DE PAGAMENTO INDIVIDUAL*
*${creditorCompany.toUpperCase()}*

Confirmamos o recebimento e liquidação com plena quitação jurídica da parcela discriminada abaixo:

━━━━━━━━━━━━━━━━━━━━━━━━━━
🏛️ *QUALIFICAÇÃO:*
• *Credor / Titular:* ${creditorName} (${creditorCompany})
• *Chave PIX:* ${creditorPix}
• *Pagador(a) / Devedor(a):* ${currentDebtor?.name || activeData.payer}
• *Contato:* ${currentDebtor?.phone || '(14) 99712-0484'}

━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 *DISCRIMINAÇÃO DA PARCELA QUITADA:*
• *Produto / Referência:* ${parsedInstallment.product}
• *Parcela:* ${parsedInstallment.current} de ${parsedInstallment.total} (${parsedInstallment.current}ª Parcela)
• *Valor Quitado:* *${activeData.amount}*
• *Valor por Extenso:* _"${amountInWords}"_
• *Data da Liquidação:* ${activeData.date}
• *Forma de Pagamento:* ${activeData.dest}
• *Situação:* *AUTÊNTICO E LIQUIDADO (PARCELA QUITADA)*

━━━━━━━━━━━━━━━━━━━━━━━━━━
📜 *DECLARAÇÃO DE QUITAÇÃO:*
_Recebemos a quantia supra de ${activeData.amount}, conferindo quitação exclusiva e integral da referida parcela individual, nos termos do Art. 320 do Código Civil._

━━━━━━━━━━━━━━━━━━━━━━━━━━
🔐 *Chave de Validação Digital SHA-256:*
\`${activeData.auth}\`

_Recibo emitido com eficácia probatória plena de quitação nos termos do Artigo 320 do Código Civil e Lei Federal nº 14.063/2020._`;

    const encoded = encodeURIComponent(text);
    const url = `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    onToast('Abrindo WhatsApp com o recibo individual da parcela!');
  };

  // Imprimir Recibo Individual
  const handlePrint = () => {
    if (!receiptRef.current) {
      handleDownloadPdf();
      return;
    }
    const success = printHtmlContent(
      `Recibo Individual - Parcela ${parsedInstallment.current} de ${parsedInstallment.total} - ${activeData.payer}`,
      receiptRef.current,
      () => handleDownloadPdf()
    );
    if (!success) {
      handleDownloadPdf();
    }
  };

  return (
    <div className="fixed inset-0 z-[900] bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <style>{`
        @keyframes proofConfettiFall {
          0% {
            transform: translate3d(0, -24px, 0) rotate(0deg) scale(0.9);
            opacity: 1;
          }
          70% {
            opacity: 0.95;
          }
          100% {
            transform: translate3d(14px, 340px, 0) rotate(320deg) scale(0.6);
            opacity: 0;
          }
        }
        @keyframes proofSuccessGlowPulse {
          0%, 100% {
            box-shadow: 0 0 45px rgba(16, 185, 129, 0.55), 0 0 90px rgba(251, 191, 36, 0.35), 0 0 25px rgba(6, 182, 212, 0.45);
          }
          50% {
            box-shadow: 0 0 75px rgba(16, 185, 129, 0.85), 0 0 130px rgba(251, 191, 36, 0.55), 0 0 45px rgba(6, 182, 212, 0.7);
          }
        }
        @keyframes proofStampPop {
          0% {
            transform: scale(0.75) rotate(-18deg);
          }
          55% {
            transform: scale(1.08) rotate(-8deg);
          }
          100% {
            transform: scale(1) rotate(-12deg);
          }
        }
      `}</style>

      {/* Halo Luminoso Radial de Celebração atrás do Modal */}
      {isGlowActive && (
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none flex items-center justify-center z-0 transition-opacity duration-500"
        >
          <div className="w-[380px] h-[380px] sm:w-[620px] sm:h-[620px] rounded-full bg-gradient-to-tr from-emerald-500/35 via-amber-400/25 to-cyan-400/35 blur-3xl animate-pulse" />
        </div>
      )}

      {/* Modal Card com Foco Exclusivo no Recibo Individual Reenquadrado + Glow Celebrativo */}
      <div
        style={
          isGlowActive
            ? { animation: 'proofSuccessGlowPulse 1.8s ease-in-out infinite' }
            : undefined
        }
        className={`relative z-10 w-full max-w-xl sm:max-w-2xl bg-white rounded-3xl flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200 transition-all ${
          isGlowActive
            ? 'ring-4 ring-emerald-400 border-2 border-amber-300 shadow-[0_0_70px_rgba(16,185,129,0.7)]'
            : 'shadow-[0_0_50px_rgba(6,182,212,0.35)] ring-2 ring-cyan-400/50 border-2 border-cyan-400/60'
        }`}
      >
        {/* Camada Interna de Confetti Visual para Feedback Positivo Garantido */}
        {isGlowActive && (
          <div
            key={confettiBurstKey}
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-80 overflow-hidden z-50"
          >
            {CONFETTI_PARTICLES.map((p) => (
              <span
                key={p.id}
                style={{
                  left: p.left,
                  backgroundColor: p.color,
                  animationName: 'proofConfettiFall',
                  animationDuration: p.duration,
                  animationDelay: p.delay,
                  animationTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
                  animationFillMode: 'forwards',
                  transform: `rotate(${p.rotation}deg)`,
                }}
                className={`absolute -top-4 ${
                  p.isCircle ? 'w-2.5 h-2.5 rounded-full' : 'w-2 h-3.5 rounded-xs'
                } shadow-xs`}
              />
            ))}
          </div>
        )}

        {/* ============================================================ */}
        {/* 1. TOPO FIXO DO MODAL                                        */}
        {/* ============================================================ */}
        <div
          className={`shrink-0 border-b px-4 py-3 sm:px-5 sm:py-3.5 flex items-center justify-between z-10 transition-colors duration-500 ${
            isGlowActive
              ? 'bg-gradient-to-r from-emerald-50 via-amber-50/60 to-emerald-50 border-emerald-300'
              : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="h-8 sm:h-8.5 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200 shrink-0"
              title="Voltar para a tela anterior"
            >
              <span className="material-symbols-outlined text-[17px]">arrow_back</span>
              <span>Voltar</span>
            </button>
            <span
              className={`w-8.5 h-8.5 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 ${
                isGlowActive
                  ? 'bg-emerald-500 text-white border border-emerald-300 shadow-[0_0_18px_rgba(16,185,129,0.7)] scale-105'
                  : 'bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-2xs'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">
                {isGlowActive ? 'celebration' : 'download_done'}
              </span>
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-slate-900 text-sm sm:text-base leading-tight">
                  Recibo de Pagamento Individual
                </h3>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {parsedInstallment.didacticText}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                Comprovante exclusivo desta parcela • Eficácia probatória plena (Art. 320 CC)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() =>
                triggerPaymentSuccessCelebration(
                  `🎉 Quitação da ${parsedInstallment.didacticText} (${activeData.amount}) celebrada com sucesso!`
                )
              }
              className={`h-8 px-2.5 rounded-xl text-[11px] font-extrabold flex items-center gap-1 transition-all cursor-pointer active:scale-95 border ${
                isGlowActive
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
              }`}
              title="Disparar animação de celebração de pagamento"
            >
              <span className="material-symbols-outlined text-[15px]">celebration</span>
              <span className="hidden sm:inline">Celebrar</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Fechar"
              aria-label="Fechar comprovante"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* 2. CORPO ROLÁVEL COM O RECIBO ESTRITAMENTE INDIVIDUAL         */}
        {/* ============================================================ */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 overscroll-contain bg-slate-50/70">
          {/* Banner de Feedback Visual Positivo (Glow + Confetti) ao Marcar Parcela como Paga */}
          {showCelebrationBanner && (
            <div
              className={`w-full max-w-lg mx-auto rounded-2xl p-3 sm:p-3.5 border-2 transition-all duration-500 flex items-center justify-between gap-3 ${
                isGlowActive
                  ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 text-white border-amber-300 shadow-[0_0_30px_rgba(16,185,129,0.45)]'
                  : 'bg-emerald-50 text-emerald-950 border-emerald-300 shadow-xs'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    isGlowActive
                      ? 'bg-white/20 text-amber-300 ring-2 ring-amber-300/60 animate-bounce'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">verified</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`text-xs sm:text-sm font-black tracking-tight ${
                        isGlowActive ? 'text-white' : 'text-emerald-950'
                      }`}
                    >
                      Pagamento Confirmado com Sucesso!
                    </span>
                    <span
                      className={`text-[9.5px] font-black uppercase px-2 py-0.5 rounded-full ${
                        isGlowActive
                          ? 'bg-amber-300 text-slate-950'
                          : 'bg-emerald-200 text-emerald-900'
                      }`}
                    >
                      100% Quitado
                    </span>
                  </div>
                  <p
                    className={`text-[11px] leading-snug truncate ${
                      isGlowActive ? 'text-emerald-50' : 'text-emerald-800'
                    }`}
                  >
                    {celebrationMessage}
                  </p>
                </div>
              </div>

              {nextPendingInstallment && (onConfirmPayment || onSettleInstallment) && (
                <button
                  type="button"
                  onClick={() => setIsConfirmingNextQuitar(true)}
                  className={`shrink-0 px-2.5 py-1.5 rounded-xl font-black text-[10.5px] flex items-center gap-1 cursor-pointer active:scale-95 transition-all shadow-xs ${
                    isGlowActive
                      ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                  title={`Quitar próxima parcela (#${nextPendingInstallment.installmentNumber}/${nextPendingInstallment.totalInstallments})`}
                >
                  <span className="material-symbols-outlined text-[14px]">bolt</span>
                  <span>Quitar #{nextPendingInstallment.installmentNumber}</span>
                </button>
              )}
            </div>
          )}

          {/* Caixa de Confirmação Obrigatória ("Tem certeza? Sim ou Não") ao clicar em Quitar #N */}
          {isConfirmingNextQuitar && nextPendingInstallment && (
            <div className="w-full max-w-lg mx-auto rounded-2xl p-3.5 sm:p-4 bg-white border-2 border-amber-400 shadow-[0_10px_30px_rgba(245,158,11,0.28)] ring-2 ring-amber-300/60 animate-in zoom-in-95 duration-150 flex flex-col gap-3">
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-300 text-amber-700 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">help</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-tight">
                    Tem certeza que deseja quitar a Parcela #{nextPendingInstallment.installmentNumber}/{nextPendingInstallment.totalInstallments}?
                  </h4>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                    Produto: <strong className="text-slate-900">{nextPendingInstallment.product}</strong> • Valor:{' '}
                    <strong className="text-emerald-700 font-mono">
                      R${' '}
                      {(nextPendingInstallment.originalAmount || nextPendingInstallment.amount || 0)
                        .toFixed(2)
                        .replace('.', ',')}
                    </strong>{' '}
                    (Venc: {nextPendingInstallment.dueDate})
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsConfirmingNextQuitar(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 font-black text-xs border border-slate-300 cursor-pointer transition-all flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[15px] text-red-600">close</span>
                  <span>Não</span>
                </button>
                <button
                  type="button"
                  onClick={handleQuickMarkNextAsPaid}
                  className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-black text-xs shadow-sm border border-emerald-500 cursor-pointer transition-all flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[15px]">check_circle</span>
                  <span>Sim, Quitar #{nextPendingInstallment.installmentNumber}</span>
                </button>
              </div>
            </div>
          )}

          {/* Container Capturável do Recibo Oficial Reenquadrado */}
          <div
            ref={receiptRef}
            className={`w-full max-w-lg mx-auto bg-white rounded-2xl p-4 sm:p-6 flex flex-col gap-3.5 relative overflow-hidden transition-all duration-500 ${
              isGlowActive
                ? 'border-2 border-emerald-400 shadow-[0_0_35px_rgba(16,185,129,0.28)] ring-2 ring-emerald-300/60'
                : 'border-2 border-emerald-500/30 shadow-sm'
            }`}
          >
            {/* Marca d'água oficial HASPAHO A4 translúcida no fundo */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0 opacity-[0.045] select-none">
              <div className="w-[300px] sm:w-[420px] h-[340px] sm:h-[460px] flex items-center justify-center">
                <HaspahoLogo size="2xl" variant="icon" className="scale-[2.5]" />
              </div>
            </div>

            {/* Top Brand Header do Recibo com Carimbo Redondo PAGO */}
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 flex-wrap gap-2 relative z-10">
              <div className="flex items-center gap-2">
                <HaspahoLogo size="lg" variant="horizontal" className="h-9 sm:h-11" />
              </div>

              <div className="flex items-center gap-3">
                {/* Carimbo Redondo Notarial Ultra Visível "PAGO" */}
                <div
                  onClick={() =>
                    triggerPaymentSuccessCelebration(
                      `✨ Selo de Quitação Autenticado: ${parsedInstallment.didacticText} (${activeData.amount})`
                    )
                  }
                  style={
                    isGlowActive
                      ? { animation: 'proofStampPop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' }
                      : undefined
                  }
                  className="inline-flex items-center justify-center select-none rotate-[-12deg] hover:rotate-0 transition-transform duration-200 shrink-0 cursor-pointer"
                  title="Clique para celebrar a quitação"
                >
                  <div
                    className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full border-[3.5px] sm:border-[4px] border-emerald-600 border-dashed bg-emerald-500/20 flex flex-col items-center justify-center p-0.5 transition-shadow duration-500 ${
                      isGlowActive
                        ? 'shadow-[0_0_28px_rgba(16,185,129,0.75)] ring-4 ring-amber-400/70'
                        : 'shadow-lg shadow-emerald-700/20 ring-4 ring-emerald-500/30'
                    }`}
                  >
                    <div className="w-full h-full rounded-full border-2 border-emerald-600 flex flex-col items-center justify-center text-center p-1 bg-white/90 backdrop-blur-xs">
                      <span className="text-[7.5px] sm:text-[8.5px] font-black uppercase tracking-widest text-emerald-950 leading-none">
                        ★ COMPROVADO ★
                      </span>
                      <span className="text-xl sm:text-2xl font-black tracking-widest text-emerald-700 font-mono drop-shadow-sm my-0.5 leading-none">
                        PAGO
                      </span>
                      <div className="flex items-center gap-0.5 text-[6.5px] sm:text-[7.5px] font-black text-emerald-900 uppercase tracking-tight leading-none">
                        <span className="material-symbols-outlined text-[9px] sm:text-[11px] text-emerald-700 font-black">verified</span>
                        <span>100% QUITADO</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-950 text-[10.5px] font-black uppercase tracking-wider shadow-xs border-2 border-emerald-400">
                  <span className="material-symbols-outlined text-[16px] text-emerald-700 font-bold">verified</span>
                  <span>RECIBO INDIVIDUAL AUTÊNTICO</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse ml-0.5" />
                </div>
              </div>
            </div>

            {/* Chave de Autenticação Digital em Destaque */}
            <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-300 rounded-xl p-3 flex flex-col gap-1.5 shadow-xs relative z-10">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-emerald-950 uppercase tracking-wider flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px] text-emerald-700">lock</span>
                  Código Criptográfico de Autenticação da Parcela
                </span>
                <span className="text-[9.5px] font-bold text-emerald-800 bg-emerald-200/70 px-2 py-0.5 rounded-full">
                  Registro Central Oficial
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 bg-white border border-emerald-200 px-3 py-2 rounded-lg">
                <span className="font-mono font-black text-slate-900 text-xs sm:text-sm select-all tracking-wide break-all">
                  {activeData.auth}
                </span>
                <button
                  type="button"
                  onClick={handleCopyProtocol}
                  className="shrink-0 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95"
                  title="Copiar Chave"
                >
                  <span className="material-symbols-outlined text-[14px]">content_copy</span>
                  <span>Copiar</span>
                </button>
              </div>
            </div>

            {/* ============================================================ */}
            {/* SEÇÃO 1: QUALIFICAÇÃO DAS PARTES                             */}
            {/* ============================================================ */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5 relative z-10">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                <span className="text-[11px] font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[17px] text-blue-600">groups</span>
                  1. Qualificação das Partes Contratantes
                </span>
                <span className="text-[9.5px] font-bold text-slate-500">
                  Relação de Repasse e Financiamento
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                {/* PARTE CREDORA (Tiago Dias - Credor Oficial) */}
                <div className="p-3 bg-white rounded-lg border border-slate-200/90 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9.5px] font-bold uppercase tracking-wider text-blue-700">
                      Credor / Titular
                    </span>
                    <span className="material-symbols-outlined text-[15px] text-blue-600">verified_user</span>
                  </div>
                  <h4 className="font-black text-slate-900 text-xs sm:text-sm">
                    {creditorName}
                  </h4>
                  <p className="text-[11px] text-slate-600 font-medium leading-tight">
                    <b>Instituição:</b> {creditorCompany}
                  </p>
                  <p className="text-[10.5px] text-slate-500 leading-tight">
                    <b>Domicílio:</b> {creditorLocation}
                  </p>
                  <p className="text-[10.5px] text-slate-700 font-mono font-semibold pt-1 border-t border-slate-100 truncate">
                    <b>PIX Oficial:</b> {creditorPix}
                  </p>
                </div>

                {/* PARTE DEVEDORA / PAGADORA */}
                <div className="p-3 bg-white rounded-lg border border-slate-200/90 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9.5px] font-bold uppercase tracking-wider text-emerald-700">
                      Pagador(a) / Devedor(a)
                    </span>
                    <span className="material-symbols-outlined text-[15px] text-emerald-600">person</span>
                  </div>
                  <h4 className="font-black text-slate-900 text-xs sm:text-sm truncate">
                    {currentDebtor?.name || activeData.payer}
                  </h4>
                  <p className="text-[11px] text-slate-600 font-medium leading-tight">
                    <b>Vínculo:</b> {currentDebtor?.relation || 'Titular da Compra / Plano Parcelado'}
                  </p>
                  <p className="text-[10.5px] text-slate-500 leading-tight">
                    <b>Contato/WhatsApp:</b> {currentDebtor?.phone || '(14) 99712-0484'}
                  </p>
                  <p className="text-[10.5px] text-slate-700 font-mono font-semibold pt-1 border-t border-slate-100 truncate">
                    <b>Chave Informada:</b> {currentDebtor?.pixKey || 'Cadastro Interno'}
                  </p>
                </div>
              </div>
            </div>

            {/* ============================================================ */}
            {/* SEÇÃO 2: DISCRIMINAÇÃO DA PARCELA INDIVIDUAL QUITADA          */}
            {/* ============================================================ */}
            <div
              className={`bg-gradient-to-r from-emerald-50/80 via-teal-50/60 to-emerald-50/80 border-2 rounded-xl p-3.5 sm:p-5 space-y-3.5 relative z-10 transition-all duration-500 ${
                isGlowActive
                  ? 'border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.3)]'
                  : 'border-emerald-300 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
                <span className="text-[11px] font-black text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[17px] text-emerald-700">payments</span>
                  2. Discriminação da Parcela Individual Quitada
                </span>
                <span className="text-[9.5px] font-extrabold text-emerald-800 bg-emerald-200 px-2.5 py-0.5 rounded-full">
                  Quitação Exclusiva Desta Parcela
                </span>
              </div>

              {/* Destaque do Valor Confirmado com Carimbo Redondo PAGO */}
              <div
                className={`flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-xl border-2 relative overflow-hidden transition-all duration-500 ${
                  isGlowActive
                    ? 'border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.25)] ring-2 ring-amber-300/50'
                    : 'border-emerald-300 shadow-2xs'
                }`}
              >
                <div className="flex-1 min-w-0 text-center sm:text-left">
                  <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest block">
                    VALOR LIQUIDADO DESTA PARCELA (INDIVIDUAL)
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    {parsedInstallment.product} • Parcela {parsedInstallment.current} de {parsedInstallment.total}
                  </span>
                  <div className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono tracking-tight mt-1">
                    {activeData.amount}
                  </div>
                </div>

                {/* Carimbo Redondo Oficial "PAGO" Gigante */}
                <div className="inline-flex items-center justify-center select-none rotate-[-10deg] hover:rotate-0 transition-transform duration-200 shrink-0">
                  <div
                    className={`w-22 h-22 sm:w-26 sm:h-26 rounded-full border-[3.5px] border-dashed border-emerald-600 bg-emerald-500/15 flex flex-col items-center justify-center p-1 transition-all duration-500 ${
                      isGlowActive
                        ? 'shadow-[0_0_24px_rgba(16,185,129,0.65)] ring-4 ring-amber-400/60 scale-105'
                        : 'shadow-md shadow-emerald-600/20 ring-4 ring-emerald-500/20'
                    }`}
                  >
                    <div className="w-full h-full rounded-full border-2 border-emerald-600 flex flex-col items-center justify-center text-center p-1 bg-white/80">
                      <span className="text-[7.5px] sm:text-[8.5px] font-black uppercase tracking-widest text-emerald-900 leading-none">
                        ★ QUITADO ★
                      </span>
                      <span className="text-2xl sm:text-3xl font-black tracking-widest text-emerald-700 font-mono drop-shadow-xs my-0.5 leading-none">
                        PAGO
                      </span>
                      <div className="flex items-center gap-0.5 text-[7px] sm:text-[8px] font-black text-emerald-900 uppercase tracking-tight leading-none">
                        <span className="material-symbols-outlined text-[10px] text-emerald-700 font-black">verified</span>
                        <span>100% LIQUIDADO</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Valor por Extenso em Destaque */}
              <div className="p-3 bg-white/90 rounded-xl border border-emerald-200 text-xs">
                <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                  Valor Expresso em Moeda Nacional (Por Extenso):
                </span>
                <p className="text-xs sm:text-sm font-bold text-emerald-950 italic">
                  "{amountInWords}"
                </p>
              </div>

              {/* Detalhes Específicos Desta Parcela */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="bg-white p-2.5 rounded-lg border border-emerald-200/80 shadow-2xs">
                  <span className="text-[9.5px] font-bold text-slate-500 uppercase block">Parcela</span>
                  <span className="font-black text-slate-900 text-xs sm:text-sm">
                    {parsedInstallment.current} de {parsedInstallment.total}
                  </span>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-emerald-200/80 shadow-2xs">
                  <span className="text-[9.5px] font-bold text-slate-500 uppercase block">Data e Hora</span>
                  <span className="font-black text-slate-900 text-xs sm:text-sm">
                    {activeData.date}
                  </span>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-emerald-200/80 shadow-2xs col-span-2 sm:col-span-1">
                  <span className="text-[9.5px] font-bold text-slate-500 uppercase block">Forma / Canal</span>
                  <span className="font-black text-emerald-700 text-xs sm:text-sm truncate block">
                    {activeData.dest}
                  </span>
                </div>
              </div>
            </div>

            {/* ============================================================ */}
            {/* SEÇÃO 3: DECLARAÇÃO FORMAL DE QUITAÇÃO INDIVIDUAL             */}
            {/* ============================================================ */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-slate-700 text-xs relative z-10">
              <span className="text-[10.5px] font-black text-slate-900 uppercase tracking-wider block">
                3. Declaração Formal de Quitação Individual (Art. 320 do Código Civil)
              </span>
              <p className="text-[11px] leading-relaxed text-slate-600">
                Pelo presente recibo oficial, o <b>CREDOR</b> qualificado declara haver recebido do(a) <b>PAGADOR(A)</b> a importância líquida e certa de <b>{activeData.amount} ({amountInWords})</b>, conferindo-lhe plena, geral e irrevogável quitação <b>exclusivamente e restritamente da Parcela {parsedInstallment.current} de {parsedInstallment.total}</b> referente à aquisição de <b>"{parsedInstallment.product}"</b>, nos termos dos Artigos 319 e 320 do Código Civil Brasileiro e Lei Federal nº 14.063/2020.
              </p>
              <div className="pt-2 flex items-center justify-between border-t border-slate-200/80 text-[10px] text-slate-500 font-mono flex-wrap gap-1">
                <span>Data do Registro: {activeData.date}</span>
                <span>Assinatura Digital: {creditorName} ({creditorCompany})</span>
              </div>
            </div>

            {/* ============================================================ */}
            {/* SEÇÃO 4: PAGAMENTOS FUTUROS E CHAVE PIX                       */}
            {/* ============================================================ */}
            <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3 flex items-center gap-3 relative z-10">
              {qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt="QR Code PIX"
                  className="w-14 h-14 rounded-lg border border-emerald-300 bg-white p-1 shrink-0 shadow-2xs"
                />
              ) : (
                <div className="w-14 h-14 rounded-lg border border-slate-200 bg-white flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-slate-400 text-[24px]">qr_code_2</span>
                </div>
              )}
              <div className="min-w-0 text-xs space-y-0.5">
                <span className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider block">
                  Chave PIX Oficial para Próximas Quitações:
                </span>
                <p className="font-mono font-bold text-slate-900 text-xs sm:text-sm truncate">
                  {creditorPix}
                </p>
                <p className="text-[10px] text-slate-500">
                  Titular: {creditorName} • {creditorCompany}
                </p>
              </div>
            </div>

            {/* Rodapé de auditoria dentro do recibo */}
            <div className="pt-1 border-t border-dashed border-slate-200 text-center relative z-10">
              <span className="text-[9.5px] text-slate-400 font-medium">
                HASPAHO TI • Comprovante de Pagamento Individual de Parcela • Desenvolvido por Tiago Dias
              </span>
            </div>
          </div>

          {/* ============================================================ */}
          {/* BANNER INFORMATIVO: DISTINÇÃO ENTRE RECIBO E EXTRATO         */}
          {/* "Quando é algo total, aí estamos falando de extrato."        */}
          {/* ============================================================ */}
          {onOpenExtratoTotal && (
            <div className="p-3 sm:p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-amber-950 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-700 text-[20px] shrink-0">receipt_long</span>
                <div>
                  <span className="font-bold block text-amber-900">
                    Deseja consultar o total consolidado de todas as parcelas pagas?
                  </span>
                  <p className="text-[11px] text-amber-800">
                    O recibo é individual desta parcela. Para ver a soma e o histórico de todas as parcelas, acesse o <b>Extrato Total</b>.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenExtratoTotal(undefined, currentDebtor?.id || activeData.debtorId);
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs inline-flex items-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-[15px]">receipt_long</span>
                <span>Ver Extrato Total</span>
              </button>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* 3. RODAPÉ FIXO DE AÇÕES (WhatsApp, Baixar PDF, Imprimir)      */}
        {/* ============================================================ */}
        <div className="shrink-0 bg-slate-50 border-t border-slate-200 p-3 sm:p-4 z-10">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Botão Baixar PDF Funcional e em Destaque */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="h-10 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              <span>{isGeneratingPdf ? 'Baixando...' : 'Baixar Recibo (PDF)'}</span>
            </button>

            {/* Botão Imprimir */}
            <button
              type="button"
              onClick={handlePrint}
              className="h-10 px-3 rounded-xl bg-slate-800 hover:bg-slate-900 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              <span>Imprimir Recibo</span>
            </button>

            {/* Botão WhatsApp */}
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="h-10 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">send</span>
              <span>WhatsApp</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
