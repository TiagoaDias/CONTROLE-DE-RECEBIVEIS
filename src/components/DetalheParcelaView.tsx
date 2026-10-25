import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { jsPDF } from 'jspdf';
import { Installment, ScreenTab, Debtor, generateAuthCode } from '../types';
import { generateHaspahoLogoPngDataUrl } from '../utils/logoPdfHelper';
import { getCleanDebtorAvatar } from './DebtorsMasterSpreadsheet';

interface DetalheParcelaViewProps {
  installment: Installment | null;
  debtor?: Debtor;
  onNavigate: (tab: ScreenTab) => void;
  onBack?: () => void;
  onConfirmPayment: (
    installmentId: string,
    method: string,
    paidDate: string,
    actualPaidAmount?: number
  ) => string | void;
  onToast: (msg: string) => void;
  onOpenExtratoTotal?: (purchaseId?: string, debtorId?: string) => void;
  onShowProof?: (
    payer: string,
    amount: string,
    date: string,
    dest: string,
    auth: string,
    item: string
  ) => void;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
}

export const DetalheParcelaView: React.FC<DetalheParcelaViewProps> = ({
  installment,
  debtor,
  onNavigate,
  onBack,
  onConfirmPayment,
  onToast,
  onOpenExtratoTotal,
  onShowProof,
  isDarkMode,
  onToggleTheme,
}) => {
  const [internalDarkMode, setInternalDarkMode] = useState<boolean>(() => {
    if (typeof isDarkMode === 'boolean') return isDarkMode;
    return localStorage.getItem('haspaho_theme') === 'dark';
  });

  const effectiveDarkMode = typeof isDarkMode === 'boolean' ? isDarkMode : internalDarkMode;

  const handleToggleLocalTheme = () => {
    if (onToggleTheme) {
      onToggleTheme();
    } else {
      setInternalDarkMode((prev) => {
        const next = !prev;
        localStorage.setItem('haspaho_theme', next ? 'dark' : 'light');
        return next;
      });
    }
  };
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [notes, setNotes] = useState('Pagamento recebido via chave PIX Nubank.');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [confirmedAuthCode, setConfirmedAuthCode] = useState<string | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // Fallback defaults if null
  const inst = installment || {
    id: 'inst-p-demo-1-4',
    purchaseId: 'p-demo-1',
    debtorId: 'DEMO-001',
    debtorName: 'Carlos Mendes (Demonstração)',
    debtorAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&auto=format&fit=crop&q=80',
    product: 'Notebook Profissional',
    cardName: 'Nubank Croma',
    installmentNumber: 4,
    totalInstallments: 10,
    amount: 300.00,
    originalAmount: 300.00,
    penaltyFee: 0,
    dueDate: '25/10/2026',
    status: 'soon' as const,
    delayDays: 0,
  };

  const isAlreadyPaid = inst.status === 'paid';
  const isOverdue = !isAlreadyPaid && (inst.status === 'overdue' || (inst.delayDays || 0) > 0);
  const basePayable = inst.originalAmount || inst.amount || 360;
  const netDue = basePayable;

  const [amountPaidInput, setAmountPaidInput] = useState<string>(basePayable.toFixed(2));
  const [avatarError, setAvatarError] = useState(false);

  const parsedPaidAmount = parseFloat(amountPaidInput.replace(',', '.')) || 0;

  // Score calculation preview
  const currentScore = debtor?.score || 1000;
  const predictedScore = Math.min(1000, currentScore + (isOverdue ? 35 : 45));

  const activeAuthCode = confirmedAuthCode || inst.authCode || (isAlreadyPaid ? generateAuthCode() : null);

  const initials = (inst.debtorName || 'RS')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  const handleOpenOfficialProof = () => {
    const authToUse = confirmedAuthCode || inst.authCode || generateAuthCode();
    if (onShowProof) {
      onShowProof(
        inst.debtorName,
        `R$ ${parsedPaidAmount.toFixed(2).replace('.', ',')}`,
        paymentDate,
        paymentMethod || 'PIX / Nubank',
        authToUse,
        `${inst.product} (Parcela ${inst.installmentNumber}/${inst.totalInstallments})`
      );
    } else {
      setIsReceiptModalOpen(true);
    }
  };

  const handleDownloadReceiptPdf = async () => {
    try {
      onToast('Gerando documento oficial de quitação com Logo e Autenticação...');
      const doc = new jsPDF();
      const currentAuth = confirmedAuthCode || inst.authCode || generateAuthCode();
      const filename = `recibo_quitacao_${inst.debtorName.replace(/\s+/g, '_')}_parc${inst.installmentNumber}.pdf`;

      // 1. Incorporar LOGO HASPAHO
      try {
        const logoDataUrl = await generateHaspahoLogoPngDataUrl();
        if (logoDataUrl) {
          doc.addImage(logoDataUrl, 'PNG', 75, 10, 60, 24);
        }
      } catch (logoErr) {
        console.warn('Erro ao carregar logo no PDF:', logoErr);
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text('RECIBO OFICIAL DE LIQUIDAÇÃO DE PARCELA', 105, 42, { align: 'center' });
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('HASPAHO • Sistema de Gestão Financeira, Cobranças e Recebíveis', 105, 47, { align: 'center' });
      
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(15, 51, 195, 51);

      // Caixa de Destaque da Quitação
      doc.setFillColor(240, 253, 244); // emerald-50
      doc.setDrawColor(167, 243, 208); // emerald-200
      doc.roundedRect(15, 55, 180, 20, 2, 2, 'FD');

      // Selo Verde
      doc.setFillColor(16, 185, 129);
      doc.circle(23, 65, 4, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('✓', 22, 66.5);

      doc.setTextColor(6, 95, 70);
      doc.setFontSize(11);
      doc.text('PAGAMENTO CONFIRMADO E AUTENTICADO', 32, 63);

      doc.setFont('courier', 'bold');
      doc.setFontSize(8.5);
      doc.text(`CHAVE DE AUTENTICAÇÃO: ${currentAuth}`, 32, 70);

      // Detalhes em Grid
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(15, 80, 180, 52, 2, 2, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text('DADOS DO PAGAMENTO / QUITAÇÃO', 20, 87);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text(`Pagador / Devedor:`, 20, 95);
      doc.setFont('helvetica', 'bold');
      doc.text(`${inst.debtorName}`, 70, 95);

      doc.setFont('helvetica', 'normal');
      doc.text(`Produto / Item Financiado:`, 20, 102);
      doc.setFont('helvetica', 'bold');
      doc.text(`${inst.product}`, 70, 102);

      doc.setFont('helvetica', 'normal');
      doc.text(`Parcela Liquidada:`, 20, 109);
      doc.setFont('helvetica', 'bold');
      doc.text(`Parcela ${inst.installmentNumber} de ${inst.totalInstallments}`, 70, 109);

      doc.setFont('helvetica', 'normal');
      doc.text(`Valor Liquidado:`, 20, 116);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(6, 95, 70);
      doc.text(`R$ ${parsedPaidAmount.toFixed(2).replace('.', ',')}`, 70, 116);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(`Data do Pagamento:`, 20, 123);
      doc.setFont('helvetica', 'bold');
      doc.text(`${paymentDate}`, 70, 123);

      doc.setFont('helvetica', 'normal');
      doc.text(`Canal de Liquidação:`, 120, 123);
      doc.setFont('helvetica', 'bold');
      doc.text(`${paymentMethod}`, 155, 123);

      // Bloco de Auditoria e Legalidade
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(15, 137, 180, 16, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text('VALIDAÇÃO DIGITAL E AUDITORIA CRIPTOGRÁFICA:', 18, 143);
      doc.setFont('courier', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(`${currentAuth} • REGISTRO CONCLUÍDO E VÁLIDO`, 18, 149);

      // Rodapé
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        'Documento emitido pelo Sistema HASPAHO TI • Válido para todos os efeitos de quitação (Art. 320 do Código Civil)',
        105,
        160,
        { align: 'center' }
      );

      try {
        const pdfBlob = doc.output('blob');
        const blobUrl = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
      } catch {
        doc.save(filename);
      }
      onToast('PDF oficial do comprovante com chave baixado com sucesso!');
    } catch (e) {
      console.error(e);
      onToast('Erro ao gerar PDF');
    }
  };

  const handleShareReceiptWhatsApp = () => {
    const currentAuth = confirmedAuthCode || inst.authCode || generateAuthCode();
    const text =
      `*COMPROVANTE DE PAGAMENTO - HASPAHO*\n\n` +
      `Olá *${inst.debtorName}*, confirmamos o recebimento da sua parcela.\n\n` +
      `📦 *Item:* ${inst.product} (${inst.installmentNumber}/${inst.totalInstallments})\n` +
      `💵 *Valor Liquidado:* R$ ${parsedPaidAmount.toFixed(2).replace('.', ',')}\n` +
      `🏦 *Método:* ${paymentMethod}\n` +
      `📅 *Data:* ${paymentDate}\n` +
      `🔐 *Autenticação:* \`${currentAuth}\`\n\n` +
      `_Obrigado por manter seu compromisso em dia!_`;
    const encoded = encodeURIComponent(text);
    const url = `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    onToast('Abrindo WhatsApp...');
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedPaidAmount <= 0) {
      onToast('Informe um valor de pagamento válido.');
      return;
    }
    // Abre modal de confirmação "Você tem certeza?"
    setIsConfirmModalOpen(true);
  };

  const handleExecutePayment = () => {
    setIsConfirmModalOpen(false);
    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      const generatedAuth = onConfirmPayment(inst.id, paymentMethod, paymentDate, parsedPaidAmount);
      const persistentCode = (typeof generatedAuth === 'string' && generatedAuth) ? generatedAuth : (inst.authCode || generateAuthCode());
      setConfirmedAuthCode(persistentCode);
      setIsSuccessModalOpen(true);
    }, 400);
  };

  return (
    <div className="flex flex-col max-w-4xl mx-auto w-full pb-12 sm:pb-3 gap-1.5 px-1.5 sm:px-2 select-none animate-in fade-in duration-200">
      {/* 1. Top Bar Ultra-Compacta */}
      <div className="flex items-center justify-between gap-1.5 py-0.5">
        <button
          type="button"
          onClick={onBack || (() => onNavigate('dashboard'))}
          className={`h-7 px-2.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition-all shadow-2xs cursor-pointer active:scale-95 ${
            effectiveDarkMode
              ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200'
              : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">arrow_back</span>
          <span>Voltar</span>
        </button>

        <div className="flex items-center gap-1.5">
          {/* Título centralizado/compacto */}
          <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-700/50 px-2 py-0.5 rounded-full shadow-2xs">
            <span className="material-symbols-outlined text-[12px]">verified_user</span>
            <span>Dar Baixa em Parcela</span>
          </div>

          {/* Botão de Alternar Modo Light / Dark */}
          <button
            type="button"
            onClick={handleToggleLocalTheme}
            className={`h-7 px-2 rounded-lg border text-[10px] font-bold flex items-center gap-1 transition-all shadow-2xs cursor-pointer active:scale-95 ${
              effectiveDarkMode
                ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-amber-300'
                : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
            }`}
            title={effectiveDarkMode ? 'Mudar para Light Mode' : 'Mudar para Dark Mode'}
          >
            <span className="material-symbols-outlined text-[13px]">
              {effectiveDarkMode ? 'light_mode' : 'dark_mode'}
            </span>
            <span className="hidden xs:inline text-[10px] font-bold">
              {effectiveDarkMode ? 'Light' : 'Dark'}
            </span>
          </button>

          <span className="hidden sm:inline-block bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-slate-200 dark:border-slate-700">
            Fatura {inst.cardName || 'Nubank'}
          </span>
        </div>
      </div>

      {/* 2. Grid Compacto de 2 Colunas no Desktop / Empilhado Denso no Mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-start">
        {/* COLUNA ESQUERDA: Resumo Compacto do Devedor, Produto e Valor */}
        <section className={`lg:col-span-5 border rounded-xl p-2.5 sm:p-3 shadow-xs flex flex-col gap-2 transition-colors ${
          effectiveDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200/90 text-slate-900'
        }`}>
          {/* Cabeçalho Compacto do Devedor + Parcela + Vencimento + Item embaixo */}
          <div className="flex items-start gap-2">
            <div className="relative shrink-0 flex items-center justify-center p-0.5 rounded-xl border border-cyan-500/40 bg-[#091a36]/80 shadow-sm">
              {(() => {
                const currentAvatarSrc = getCleanDebtorAvatar(inst.debtorName, inst.debtorAvatar || debtor?.avatar);
                return !avatarError && currentAvatarSrc ? (
                  <img
                    src={currentAvatarSrc}
                    alt={inst.debtorName}
                    onError={() => setAvatarError(true)}
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border border-white shadow-2xs animate-foto-motion"
                  />
                ) : (
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-[11px] flex items-center justify-center border border-white shadow-2xs animate-foto-motion">
                    {initials}
                  </div>
                );
              })()}
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full text-white flex items-center justify-center font-bold text-[8px] shadow-xs ring-1 ring-white z-10 ${
                  isAlreadyPaid || confirmedAuthCode ? 'bg-emerald-600' : isOverdue ? 'bg-red-600' : 'bg-amber-500'
                }`}
              >
                {isAlreadyPaid || confirmedAuthCode ? '✓' : isOverdue ? '!' : '⏳'}
              </span>
            </div>

            <div className="flex flex-col min-w-0 flex-1 gap-1">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1 min-w-0">
                  <h2 className={`font-extrabold text-xs sm:text-sm leading-tight truncate px-1.5 py-0.5 rounded-md animate-nome-badge ${
                    effectiveDarkMode ? 'text-white bg-slate-800/90' : 'text-slate-900 bg-slate-100/80'
                  }`}>
                    {inst.debtorName}
                  </h2>
                  <span className={`px-1.5 py-0.2 rounded text-[8.5px] font-bold uppercase tracking-wider shrink-0 ${
                    effectiveDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {debtor?.relation || 'Familiar'}
                  </span>
                </div>
                <span className={`text-[9.5px] flex items-center gap-0.5 shrink-0 ${
                  effectiveDarkMode ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  <span className="material-symbols-outlined text-[10px] text-emerald-500">call</span>
                  {debtor?.phone || '(14) 99888-1122'}
                </span>
              </div>

              {/* Linha de Parcela + Vencimento */}
              <div className="flex items-center gap-1 flex-wrap">
                <span className="inline-flex items-center gap-0.5 text-[9.5px] font-black text-indigo-900 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-md font-mono animate-parcela-badge">
                  #{inst.installmentNumber}/{inst.totalInstallments}
                </span>
                <span className="inline-flex items-center gap-0.5 text-[9.5px] text-blue-900 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-md font-semibold animate-data-badge">
                  <span className="material-symbols-outlined text-[10px] text-blue-600">calendar_today</span>
                  <span>
                    Venc: <strong className="font-mono text-slate-950">{inst.dueDate}</strong>
                  </span>
                </span>
              </div>

              {/* Item do Produto debaixo da parcela e do vencimento */}
              <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold w-fit max-w-full ${
                effectiveDarkMode
                  ? 'bg-slate-800/90 border-slate-700 text-cyan-300'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}>
                <span className="material-symbols-outlined text-[11px] text-blue-500 shrink-0">shopping_bag</span>
                <span className="truncate">{inst.product}</span>
              </div>
            </div>
          </div>

          {/* Valor Total a Liquidar + Score Integrado */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-xs border border-slate-700/60">
            <div>
              <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider block leading-tight">
                {isAlreadyPaid || confirmedAuthCode ? 'Valor Quitado' : 'Total a Liquidar'}
              </span>
              <span className="text-lg sm:text-xl font-black text-amber-400 tracking-tight font-mono leading-tight">
                R$ {netDue.toFixed(2).replace('.', ',')}
              </span>
            </div>

            <div className="flex flex-col items-end gap-1">
              {isAlreadyPaid || confirmedAuthCode ? (
                <span className="animate-quitado-badge inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-emerald-500/25 text-emerald-300 text-[9.5px] font-bold border border-emerald-400/40">
                  <span className="material-symbols-outlined text-[11px] animate-icon-check">check_circle</span>
                  <span>QUITADO ✓</span>
                </span>
              ) : isOverdue ? (
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[9.5px] font-bold border border-red-400/30">
                  <span className="material-symbols-outlined text-[11px]">warning</span>
                  <span>{inst.delayDays || 9}d atraso</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[9.5px] font-bold border border-emerald-400/30 animate-vencer-badge">
                  <span className="material-symbols-outlined text-[11px]">check_circle</span>
                  <span>No prazo</span>
                </span>
              )}
              <span className="animate-score-badge inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-600/80 border border-violet-400/50 text-[8.5px] text-white font-bold">
                <span className="material-symbols-outlined text-[10px] text-amber-300 animate-icon-sparkle">auto_awesome</span>
                <span>Score: <b className="text-amber-300">+{isOverdue ? '35' : '45'} pts</b></span>
              </span>
            </div>
          </div>
        </section>

        {/* COLUNA DIREITA: Formulário Compacto de Baixa ou Status de Já Quitado */}
        {isAlreadyPaid ? (
          <div
            className={`lg:col-span-7 border rounded-xl p-2.5 sm:p-3 shadow-xs flex flex-col gap-2 transition-colors ${
              effectiveDarkMode ? 'bg-slate-900 border-emerald-500/40 text-slate-100' : 'bg-white border-emerald-300 text-slate-900'
            }`}
          >
            <div className="flex items-center gap-2 pb-1.5 border-b border-emerald-500/20">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-2xs">
                <span className="material-symbols-outlined text-[18px]">verified</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold tracking-wider text-emerald-600 block leading-none">Status Oficial</span>
                <h3 className={`font-black text-xs sm:text-sm leading-tight ${effectiveDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  Parcela Já Quitada e Autenticada
                </h3>
              </div>
            </div>

            <div className={`rounded-xl p-2.5 flex flex-col gap-1 text-[11px] border ${
              effectiveDarkMode ? 'bg-slate-800/70 border-emerald-500/30 text-slate-200' : 'bg-emerald-50/70 border-emerald-200 text-slate-700'
            }`}>
              <div className="flex justify-between items-center">
                <span className={effectiveDarkMode ? 'text-slate-400' : 'text-slate-500'}>Valor Liquidado:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                  R$ {(inst.paidAmount || inst.originalAmount || inst.amount).toFixed(2).replace('.', ',')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className={effectiveDarkMode ? 'text-slate-400' : 'text-slate-500'}>Data do Pagamento:</span>
                <span className="font-bold">{inst.paidAt || inst.dueDate}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className={effectiveDarkMode ? 'text-slate-400' : 'text-slate-500'}>Forma de Pagamento:</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">{inst.paymentMethod || 'PIX'}</span>
              </div>
              <div className="pt-1 border-t border-emerald-200/60 dark:border-slate-700 flex items-center justify-between gap-2">
                <span className="text-[9.5px] font-bold uppercase text-slate-500 shrink-0">Autenticação:</span>
                <div className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1 min-w-0">
                  <span className="font-mono font-bold text-[10px] text-emerald-950 dark:text-emerald-300 truncate select-all">
                    {inst.authCode || activeAuthCode || 'HASPAHO-AUTH-SECURE'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(inst.authCode || activeAuthCode || '');
                      onToast('Chave de autenticação copiada!');
                    }}
                    className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-950 active:scale-90 transition-all cursor-pointer shrink-0"
                    title="Copiar Chave"
                  >
                    <span className="material-symbols-outlined text-[13px]">content_copy</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={handleDownloadReceiptPdf}
                className="h-8.5 px-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95 animate-recibo-btn"
              >
                <span className="material-symbols-outlined text-[14px]">picture_as_pdf</span>
                <span>PDF</span>
              </button>
              <button
                type="button"
                onClick={handleShareReceiptWhatsApp}
                className="h-8.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95"
              >
                <span className="material-symbols-outlined text-[14px]">chat</span>
                <span>WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={onBack || (() => onNavigate('dashboard'))}
                className={`h-8.5 px-2 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer border ${
                  effectiveDarkMode
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">arrow_back</span>
                <span>Painel</span>
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleFormSubmit}
            className={`lg:col-span-7 border rounded-xl p-2.5 sm:p-3 shadow-xs flex flex-col gap-2 transition-colors ${
              effectiveDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200/90 text-slate-900'
            }`}
          >
            {/* 1. Linha Dupla Compacta: Valor Recebido + Data do Pagamento */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Valor Recebido */}
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="paidAmount" className={`text-[10.5px] font-bold flex items-center gap-1 ${
                    effectiveDarkMode ? 'text-slate-200' : 'text-slate-800'
                  }`}>
                    <span className="material-symbols-outlined text-[13px] text-blue-500">payments</span>
                    <span>Valor Recebido</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setAmountPaidInput(netDue.toFixed(2))}
                    className="text-[9.5px] text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                  >
                    Exato (R$ {netDue.toFixed(2).replace('.', ',')})
                  </button>
                </div>

                <div className="relative flex items-center">
                  <span className="absolute left-2.5 text-slate-400 font-black text-xs">R$</span>
                  <input
                    id="paidAmount"
                    type="number"
                    step="0.01"
                    value={amountPaidInput}
                    onChange={(e) => setAmountPaidInput(e.target.value)}
                    className={`w-full h-8.5 pl-8 pr-2.5 border rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none ${
                      effectiveDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white focus:bg-slate-800'
                        : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white'
                    }`}
                    required
                  />
                </div>
              </div>

              {/* Data do Pagamento */}
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="paymentDate" className={`text-[10.5px] font-bold flex items-center gap-1 ${
                    effectiveDarkMode ? 'text-slate-200' : 'text-slate-800'
                  }`}>
                    <span className="material-symbols-outlined text-[13px] text-blue-500">calendar_today</span>
                    <span>Data da Baixa</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setPaymentDate(new Date().toISOString().split('T')[0])}
                    className="text-[9.5px] text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                  >
                    Hoje
                  </button>
                </div>
                <input
                  id="paymentDate"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className={`w-full h-8.5 px-2.5 border rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500/20 outline-none ${
                    effectiveDarkMode
                      ? 'bg-slate-800 border-slate-700 text-white focus:bg-slate-800'
                      : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white'
                  }`}
                  required
                />
              </div>
            </div>

            {/* 2. Forma de Pagamento + Observações em Grid Compacto */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Forma de Pagamento */}
              <div className="flex flex-col gap-0.5">
                <label className={`text-[10.5px] font-bold flex items-center gap-1 ${
                  effectiveDarkMode ? 'text-slate-200' : 'text-slate-800'
                }`}>
                  <span className="material-symbols-outlined text-[13px] text-blue-500">account_balance_wallet</span>
                  <span>Forma de Pagamento</span>
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { key: 'PIX', label: '⚡ PIX' },
                    { key: 'Dinheiro', label: '💵 Din.' },
                    { key: 'Transferência', label: '💳 TED' },
                  ].map((m) => {
                    const isSelected = paymentMethod === m.key;
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setPaymentMethod(m.key)}
                        className={`h-8 px-1 rounded-lg font-bold text-[10px] transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : effectiveDarkMode
                            ? 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
                            : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Observações / Histórico */}
              <div className="flex flex-col gap-0.5">
                <label htmlFor="notes" className={`text-[10.5px] font-bold flex items-center gap-1 ${
                  effectiveDarkMode ? 'text-slate-200' : 'text-slate-700'
                }`}>
                  <span className="material-symbols-outlined text-[13px] text-slate-400">notes</span>
                  <span>Observações (Opcional)</span>
                </label>
                <input
                  id="notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Pago via PIX"
                  className={`w-full h-8 px-2.5 border rounded-lg text-[11px] focus:ring-2 focus:ring-blue-500/20 outline-none ${
                    effectiveDarkMode
                      ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500'
                      : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                />
              </div>
            </div>

            {/* 3. Barra Slim de Autenticação + Botões de Ação Lado a Lado */}
            <div className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between gap-2 ${
              effectiveDarkMode
                ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-200'
                : 'bg-emerald-50/70 border-emerald-200/80 text-emerald-950'
            }`}>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="material-symbols-outlined text-[14px] text-emerald-500 shrink-0">verified</span>
                <span className="text-[9.5px] font-semibold truncate">
                  {activeAuthCode ? `Chave: ${activeAuthCode}` : 'Chave criptográfica gerada no ato da baixa'}
                </span>
              </div>
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white font-bold text-[8.5px] shrink-0">
                {activeAuthCode ? 'AUTENTICADO' : 'SEGURO'}
              </span>
            </div>

            {/* 4. Botões de Ação Compactos */}
            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={onBack || (() => onNavigate('dashboard'))}
                className={`h-9 px-3 rounded-xl font-bold text-xs flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                  effectiveDarkMode
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 h-9 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer animate-quitar-btn"
              >
                {isSubmitting ? (
                  <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                ) : (
                  <span className="material-symbols-outlined text-[16px]">bolt</span>
                )}
                <span>Confirmar Baixa (R$ {parsedPaidAmount.toFixed(2).replace('.', ',')})</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Lightbox Modal for Receipt (Portaled para Body) */}
      {isReceiptModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-md overflow-y-auto p-2 sm:p-4 flex items-center justify-center animate-in fade-in duration-200"
          onClick={() => setIsReceiptModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-[350px] w-full max-h-[90dvh] overflow-y-auto m-auto p-3 flex flex-col gap-2 shadow-2xl animate-in zoom-in-95 border border-slate-200 scrollbar-thin text-slate-850"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-1">
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-blue-600 text-[15px]">receipt</span>
                <h3 className="font-bold text-slate-800 text-xs">Prévia do Comprovante</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsReceiptModalOpen(false)}
                className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </div>

            <div className="bg-slate-50 rounded-xl p-2 border border-dashed border-slate-300 flex flex-col gap-1 text-[10.5px]">
              <div className="flex justify-between items-center text-slate-500 pb-0.5 border-b border-slate-200">
                <span>Banco Transferidor</span>
                <span className="font-bold text-slate-800">Nubank Pagamentos S.A.</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Beneficiário</span>
                <span className="font-semibold text-slate-800">Tiago Dias (HASPAHO TI)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Pagador</span>
                <span className="font-semibold text-slate-800">{inst.debtorName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Valor Liquidado</span>
                <span className="text-xs font-bold text-emerald-700 font-mono">
                  R$ {parsedPaidAmount.toFixed(2).replace('.', ',')}
                </span>
              </div>
              <div className="flex justify-between items-center text-[9px] text-slate-600 pt-1 border-t border-slate-200">
                <span className="font-bold">ID Autenticação:</span>
                <span className="font-mono font-bold text-emerald-800 truncate max-w-[160px]">
                  {activeAuthCode || 'Gerada no ato da quitação'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={handleDownloadReceiptPdf}
                className="h-8 px-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95"
              >
                <span className="material-symbols-outlined text-[14px]">picture_as_pdf</span>
                <span>Baixar PDF</span>
              </button>
              <button
                type="button"
                onClick={handleShareReceiptWhatsApp}
                className="h-8 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95"
              >
                <span className="material-symbols-outlined text-[14px]">chat</span>
                <span>WhatsApp</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsReceiptModalOpen(false)}
              className="w-full h-8 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[11px] cursor-pointer transition-colors"
            >
              Fechar Prévia
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Success Celebration Modal (Portaled para Body) */}
      {isSuccessModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[200] bg-slate-950/85 backdrop-blur-md overflow-y-auto p-2 sm:p-4 flex items-center justify-center animate-in fade-in duration-200"
          onClick={() => {
            setIsSuccessModalOpen(false);
            onNavigate('dashboard');
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-[350px] w-full max-h-[90dvh] overflow-y-auto m-auto p-3 flex flex-col items-center text-center gap-2 select-none shadow-2xl animate-in zoom-in-95 border border-slate-200 scrollbar-thin text-slate-850"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-2xs shrink-0">
              <span className="material-symbols-outlined text-[20px]">check_circle</span>
            </div>
            <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm leading-tight">
              Pagamento Baixado e Autenticado!
            </h3>

            <div className="text-[10.5px] text-slate-600 leading-tight flex flex-col gap-1 bg-slate-50 p-2 rounded-xl border border-slate-200 w-full text-left">
              <div className="flex justify-between pb-0.5 border-b border-slate-200">
                <span>Devedor:</span>
                <b className="text-slate-800 truncate max-w-[170px]">{inst.debtorName}</b>
              </div>
              <div className="flex justify-between pb-0.5 border-b border-slate-200">
                <span>Valor pago:</span>
                <b className="text-emerald-700 font-bold text-xs font-mono">R$ {parsedPaidAmount.toFixed(2).replace('.', ',')}</b>
              </div>
              <div className="flex justify-between pb-0.5 border-b border-slate-200">
                <span>Parcela:</span>
                <b className="text-slate-800 truncate max-w-[170px]">#{inst.installmentNumber}/{inst.totalInstallments} ({inst.product})</b>
              </div>
              <div className="flex justify-between pb-0.5 border-b border-slate-200">
                <span>Data:</span>
                <b className="text-slate-800">{paymentDate}</b>
              </div>

              <div className="pt-0.5 flex flex-col gap-0.5">
                <div className="flex items-center justify-between text-[8.5px] text-slate-500 font-bold uppercase">
                  <span>Chave de Autenticação:</span>
                  <span className="text-emerald-700 font-black flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-[10px]">verified</span>
                    REGISTRADA
                  </span>
                </div>
                <div className="p-1 px-1.5 rounded-lg bg-emerald-50 border border-emerald-300/80 flex items-center justify-between gap-1">
                  <span className="font-mono font-bold text-[9.5px] text-emerald-950 truncate select-all">
                    {confirmedAuthCode || activeAuthCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirmedAuthCode || activeAuthCode) {
                        navigator.clipboard.writeText(confirmedAuthCode || activeAuthCode || '');
                        onToast('Chave de autenticação copiada!');
                      }
                    }}
                    className="p-0.5 text-emerald-800 hover:text-emerald-950 active:scale-90 transition-all cursor-pointer shrink-0"
                    title="Copiar Chave"
                  >
                    <span className="material-symbols-outlined text-[12px]">content_copy</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 w-full">
              <button
                type="button"
                onClick={handleDownloadReceiptPdf}
                className="h-8 px-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95"
              >
                <span className="material-symbols-outlined text-[13px]">download</span>
                <span>Baixar PDF</span>
              </button>
              <button
                type="button"
                onClick={handleShareReceiptWhatsApp}
                className="h-8 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95"
              >
                <span className="material-symbols-outlined text-[13px]">chat</span>
                <span>WhatsApp</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsSuccessModalOpen(false);
                onNavigate('dashboard');
              }}
              className="w-full h-8 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold text-[11px] cursor-pointer transition-colors"
            >
              Concluir e Voltar ao Painel
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Modal de Confirmação Compacto: "Tem certeza?" */}
      {isConfirmModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[200] bg-slate-950/85 backdrop-blur-md overflow-y-auto p-2 flex items-center justify-center animate-in fade-in duration-150"
          onClick={() => setIsConfirmModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-[340px] rounded-2xl p-3 flex flex-col items-center text-center gap-2 select-none transition-colors border-2 shadow-2xl animate-in zoom-in-95 duration-150 ${
              effectiveDarkMode
                ? 'bg-slate-900 border-cyan-500/50 text-white'
                : 'bg-white border-emerald-500/40 text-slate-900'
            }`}
          >
            <div className="w-full flex items-center justify-between text-xs shrink-0">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[9.5px] border ${
                effectiveDarkMode
                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}>
                <span className="material-symbols-outlined text-[11px]">verified_user</span>
                Confirmação de Baixa
              </span>

              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-0.5">
              <h3 className={`font-black text-sm leading-tight ${effectiveDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Tem certeza que deseja dar baixa?
              </h3>
              <p className={`text-[10px] leading-tight ${effectiveDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                Confirme os dados abaixo antes de liquidar a parcela:
              </p>
            </div>

            <div className={`w-full rounded-xl p-2 flex flex-col gap-1 text-left text-[10.5px] border ${
              effectiveDarkMode
                ? 'bg-slate-950/70 border-cyan-500/30'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <div className={`flex justify-between items-center pb-0.5 border-b ${effectiveDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                <span className={effectiveDarkMode ? 'text-slate-400' : 'text-slate-500'}>Devedor:</span>
                <span className={`font-bold truncate max-w-[170px] ${effectiveDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {inst.debtorName}
                </span>
              </div>
              <div className={`flex justify-between items-center pb-0.5 border-b ${effectiveDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                <span className={effectiveDarkMode ? 'text-slate-400' : 'text-slate-500'}>Parcela / Item:</span>
                <span className={`font-semibold truncate max-w-[170px] ${effectiveDarkMode ? 'text-cyan-200' : 'text-blue-700'}`}>
                  #{inst.installmentNumber}/{inst.totalInstallments} • {inst.product}
                </span>
              </div>
              <div className={`flex justify-between items-center pb-0.5 border-b ${effectiveDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                <span className={effectiveDarkMode ? 'text-slate-400' : 'text-slate-500'}>Valor Recebido:</span>
                <span className={`font-black font-mono text-xs ${effectiveDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                  R$ {parsedPaidAmount.toFixed(2).replace('.', ',')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className={effectiveDarkMode ? 'text-slate-400' : 'text-slate-500'}>Pagamento:</span>
                <span className={`font-bold ${effectiveDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                  {paymentMethod} • {paymentDate}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 w-full pt-0.5">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className={`w-full h-8.5 px-2 rounded-xl font-bold text-xs border cursor-pointer transition-all active:scale-95 flex items-center justify-center ${
                  effectiveDarkMode
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                }`}
              >
                Não
              </button>

              <button
                type="button"
                onClick={handleExecutePayment}
                disabled={isSubmitting}
                className="w-full h-8.5 px-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-black text-xs shadow-sm cursor-pointer transition-all flex items-center justify-center gap-1 animate-quitar-btn"
              >
                {isSubmitting ? (
                  <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                ) : (
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                )}
                <span>Sim, Quitar</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
