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
    id: 'inst-1',
    purchaseId: 'p1',
    debtorId: 'd1',
    debtorName: 'Renata Silveira',
    debtorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
    product: 'Smartphone Galaxy S24',
    cardName: 'Nubank Croma',
    installmentNumber: 3,
    totalInstallments: 10,
    amount: 360.00,
    originalAmount: 360.00,
    penaltyFee: 0,
    dueDate: '10/10/2026',
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
    <div className="flex flex-col max-w-5xl mx-auto w-full pb-14 sm:pb-4 gap-2.5 px-2 select-none animate-in fade-in duration-200">
      {/* 1. Top Bar Compacta */}
      <div className="flex items-center justify-between gap-2 py-0.5">
        <button
          type="button"
          onClick={onBack || (() => onNavigate('dashboard'))}
          className={`h-8 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95 ${
            effectiveDarkMode
              ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200'
              : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Voltar</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Botão de Alternar Modo Light / Dark */}
          <button
            type="button"
            onClick={handleToggleLocalTheme}
            className={`h-8 px-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95 ${
              effectiveDarkMode
                ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-amber-300'
                : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
            }`}
            title={effectiveDarkMode ? 'Mudar para Light Mode' : 'Mudar para Dark Mode'}
          >
            <span className="material-symbols-outlined text-[16px]">
              {effectiveDarkMode ? 'light_mode' : 'dark_mode'}
            </span>
            <span className="text-[11px] font-bold">
              {effectiveDarkMode ? 'Light Mode' : 'Dark Mode'}
            </span>
          </button>

          <div className="flex items-center gap-1 text-emerald-700 text-[11px] font-bold bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full shadow-2xs">
            <span className="material-symbols-outlined text-[13px]">verified_user</span>
            <span>Liquidação Segura</span>
          </div>
          <span className="hidden sm:inline-block bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full text-[10.5px] font-medium border border-slate-200">
            Fatura {inst.cardName || 'Nubank'}
          </span>
        </div>
      </div>

      {/* 2. Grid de 2 Colunas no Desktop para Ajuste Perfeito Sem Rolagem */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        {/* COLUNA ESQUERDA: Resumo do Devedor e da Parcela */}
        <section className={`lg:col-span-6 border rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col gap-3 transition-colors ${
          effectiveDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200/90 text-slate-900'
        }`}>
          {/* Cabeçalho do Devedor */}
          <div className="flex items-center gap-2.5">
            <div className="relative shrink-0 flex items-center justify-center p-1 rounded-2xl border border-cyan-500/40 bg-[#091a36]/80 shadow-md">
              {(() => {
                const currentAvatarSrc = getCleanDebtorAvatar(inst.debtorName, inst.debtorAvatar || debtor?.avatar);
                return !avatarError && currentAvatarSrc ? (
                  <img
                    src={currentAvatarSrc}
                    alt={inst.debtorName}
                    onError={() => setAvatarError(true)}
                    referrerPolicy="no-referrer"
                    className="w-11 h-11 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-white shadow-2xs"
                  />
                ) : (
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-xs flex items-center justify-center border-2 border-white shadow-2xs">
                    {initials}
                  </div>
                );
              })()}
              <span
                className={`absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full text-white flex items-center justify-center font-bold text-[9px] shadow-md ring-2 ring-white z-10 ${
                  isAlreadyPaid || confirmedAuthCode ? 'bg-emerald-600' : isOverdue ? 'bg-red-600' : 'bg-amber-500'
                }`}
              >
                {isAlreadyPaid || confirmedAuthCode ? '✓' : isOverdue ? '!' : '⏳'}
              </span>
            </div>

            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="font-extrabold text-slate-900 text-sm sm:text-base leading-tight truncate">
                  {inst.debtorName}
                </h2>
                <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded text-[9.5px] font-bold uppercase tracking-wider">
                  {debtor?.relation || 'Irmã'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-xs mt-0.5 flex-wrap">
                <span className="inline-flex items-center gap-1 text-[10.5px] text-blue-800 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded font-semibold">
                  <span className="material-symbols-outlined text-[11px] text-blue-600">calendar_today</span>
                  <span>
                    Venc: <strong className="font-mono text-slate-900">{inst.dueDate}</strong>
                  </span>
                </span>
                <span className="text-slate-500 text-[10.5px] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[11px] text-emerald-600">call</span>
                  {debtor?.phone || '(14) 99888-1122'}
                </span>
              </div>
            </div>
          </div>



          {/* Detalhes do Produto e Ciclo */}
          <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-2.5 flex flex-col gap-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium flex items-center gap-1 text-[11px]">
                <span className="material-symbols-outlined text-[14px] text-slate-400">devices</span>
                Item financiado
              </span>
              <span className="font-bold text-slate-900 truncate max-w-[180px]">{inst.product}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium flex items-center gap-1 text-[11px]">
                <span className="material-symbols-outlined text-[14px] text-slate-400">timelapse</span>
                Ciclo da parcela
              </span>
              <span className="font-bold text-slate-900 text-[11px]">
                {inst.installmentNumber} de {inst.totalInstallments} meses
              </span>
            </div>
          </div>

          {/* Valor Total a Liquidar */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-xl p-3 flex items-center justify-between gap-2 shadow-xs">
            <div>
              <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block">
                {isAlreadyPaid || confirmedAuthCode ? 'Valor Quitado' : 'Valor Total a Liquidar'}
              </span>
              <span className="text-2xl sm:text-3xl font-black text-amber-400 tracking-tight font-mono">
                R$ {netDue.toFixed(2).replace('.', ',')}
              </span>
            </div>

            <div className="text-right">
              {isAlreadyPaid || confirmedAuthCode ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10.5px] font-bold border border-emerald-400/30">
                  <span className="material-symbols-outlined text-[13px]">check_circle</span>
                  <span>QUITADO ✓</span>
                </span>
              ) : isOverdue ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/20 text-red-300 text-[10.5px] font-bold border border-red-400/30">
                  <span className="material-symbols-outlined text-[13px]">warning</span>
                  <span>{inst.delayDays || 9} dias de atraso</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10.5px] font-bold border border-emerald-400/30">
                  <span className="material-symbols-outlined text-[13px]">check_circle</span>
                  <span>Dentro do prazo</span>
                </span>
              )}
            </div>
          </div>

          {/* Score Slim Box */}
          <div className="px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-emerald-600 text-white font-black text-[10px] flex items-center justify-center">
                100
              </span>
              <div>
                <span className="font-bold text-slate-800 text-[11px] block leading-tight">
                  Score de Pontualidade: 1000/1000
                </span>
                <span className="text-[10px] text-slate-500">
                  Ao quitar: <b className="text-emerald-700">+{isOverdue ? '35' : '45'} pts</b>
                </span>
              </div>
            </div>
            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-extrabold text-[9px] uppercase">
              EXCELENTE
            </span>
          </div>
        </section>

        {/* COLUNA DIREITA: Formulário de Quitação ou Status de Já Quitado */}
        {isAlreadyPaid ? (
          <div
            className={`lg:col-span-6 border rounded-2xl p-4 shadow-xs flex flex-col gap-3 transition-colors ${
              effectiveDarkMode ? 'bg-slate-900 border-emerald-500/40 text-slate-100' : 'bg-white border-emerald-300 text-slate-900'
            }`}
          >
            <div className="flex items-center gap-2.5 pb-2 border-b border-emerald-500/20">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-xs">
                <span className="material-symbols-outlined text-[24px]">verified</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 block">Status Oficial</span>
                <h3 className="font-black text-base text-slate-900 dark:text-white leading-tight">
                  Parcela Já Quitada e Autenticada
                </h3>
              </div>
            </div>

            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 flex flex-col gap-1.5 text-xs text-slate-700 dark:text-slate-200">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Valor Liquidado:</span>
                <span className="font-mono font-bold text-emerald-700 text-sm">
                  R$ {(inst.paidAmount || inst.originalAmount || inst.amount).toFixed(2).replace('.', ',')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Data do Pagamento:</span>
                <span className="font-bold">{inst.paidAt || inst.dueDate}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Forma de Pagamento:</span>
                <span className="font-bold text-blue-600">{inst.paymentMethod || 'PIX'}</span>
              </div>
              <div className="pt-1.5 border-t border-emerald-200 flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase text-slate-500">Chave Criptográfica Registrada:</span>
                <div className="p-2 rounded-lg bg-white border border-emerald-300 flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-xs text-emerald-950 truncate select-all">
                    {inst.authCode || activeAuthCode || 'HASPAHO-AUTH-SECURE'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(inst.authCode || activeAuthCode || '');
                      onToast('Chave de autenticação copiada!');
                    }}
                    className="p-1 text-emerald-800 hover:text-emerald-950 active:scale-90 transition-all cursor-pointer shrink-0"
                    title="Copiar Chave"
                  >
                    <span className="material-symbols-outlined text-[16px]">content_copy</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleDownloadReceiptPdf}
                className="h-10 px-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <span className="material-symbols-outlined text-[17px]">picture_as_pdf</span>
                <span>Baixar PDF</span>
              </button>
              <button
                type="button"
                onClick={handleShareReceiptWhatsApp}
                className="h-10 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <span className="material-symbols-outlined text-[17px]">chat</span>
                <span>WhatsApp</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onBack || (() => onNavigate('dashboard'))}
              className="w-full h-10 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-200"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              <span>Concluir e Voltar ao Painel</span>
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleFormSubmit}
            className={`lg:col-span-6 border rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col gap-2.5 transition-colors ${
              effectiveDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200/90 text-slate-900'
            }`}
          >
            {/* 1. Valor Recebido */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label htmlFor="paidAmount" className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px] text-blue-600">payments</span>
                  <span>Valor Efetivamente Recebido</span>
                </label>
                <button
                  type="button"
                  onClick={() => setAmountPaidInput(netDue.toFixed(2))}
                  className="text-[10.5px] text-blue-600 font-bold hover:underline cursor-pointer"
                >
                  Valor Exato (R$ {netDue.toFixed(2).replace('.', ',')})
                </button>
              </div>

              <div className="relative flex items-center">
                <span className="absolute left-3 text-slate-400 font-black text-sm">R$</span>
                <input
                  id="paidAmount"
                  type="number"
                  step="0.01"
                  value={amountPaidInput}
                  onChange={(e) => setAmountPaidInput(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none"
                  required
                />
              </div>
            </div>

            {/* 2. Data do Pagamento + Forma de Pagamento em Linha Dupla Compacta */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Data */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="paymentDate" className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px] text-blue-600">calendar_today</span>
                    <span>Data Pagamento</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setPaymentDate(new Date().toISOString().split('T')[0])}
                    className="text-[10px] text-emerald-700 font-bold hover:underline cursor-pointer"
                  >
                    Hoje
                  </button>
                </div>
                <input
                  id="paymentDate"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none"
                  required
                />
              </div>

              {/* Forma de Pagamento */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-blue-600">account_balance_wallet</span>
                  <span>Forma</span>
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
                        className={`h-9 px-1 rounded-xl font-bold text-[10.5px] transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 3. Observações / Histórico */}
            <div className="flex flex-col gap-1">
              <label htmlFor="notes" className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px] text-slate-400">notes</span>
                <span>Observações / Histórico</span>
              </label>
              <input
                id="notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Pagamento recebido via PIX"
                className="w-full h-8.5 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none"
              />
            </div>

            {/* 4. Resumo de Auditoria & Chave Digital */}
            <div className="p-2.5 bg-emerald-50/60 border border-emerald-200/80 rounded-xl flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="material-symbols-outlined text-[16px] text-emerald-600 shrink-0">verified</span>
                <div className="min-w-0">
                  <span className="text-[10.5px] font-bold text-emerald-950 block leading-tight">
                    Chave de Autenticação Oficial
                  </span>
                  <span className="text-[9.5px] text-emerald-800 truncate block">
                    {activeAuthCode ? `Autenticação: ${activeAuthCode}` : 'Será gerada e gravada no recibo no ato da quitação'}
                  </span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold text-[9.5px] shrink-0">
                {activeAuthCode ? 'AUTENTICADO' : 'SEGURO'}
              </span>
            </div>

            {/* 5. Botões de Ação Principais */}
            <div className="flex flex-col gap-1.5 pt-1">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                ) : (
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                )}
                <span>Confirmar Pagamento e Autenticar</span>
              </button>

              <button
                type="button"
                onClick={onBack || (() => onNavigate('dashboard'))}
                className="w-full h-8.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs flex items-center justify-center transition-colors cursor-pointer"
              >
                Cancelar e Voltar
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
            className="bg-white rounded-2xl sm:rounded-3xl max-w-[380px] sm:max-w-sm w-full max-h-[90dvh] overflow-y-auto m-auto p-3 sm:p-4 flex flex-col gap-2 shadow-2xl animate-in zoom-in-95 border border-slate-200 scrollbar-thin text-slate-850"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-blue-600 text-[17px]">receipt</span>
                <h3 className="font-bold text-slate-800 text-xs sm:text-sm">Prévia do Comprovante</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsReceiptModalOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            <div className="bg-slate-50 rounded-xl p-2.5 border border-dashed border-slate-300 flex flex-col gap-1 text-[10.5px] sm:text-xs">
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
                <span className="text-xs sm:text-sm font-bold text-emerald-700 font-mono">
                  R$ {parsedPaidAmount.toFixed(2).replace('.', ',')}
                </span>
              </div>
              <div className="flex justify-between items-center text-[9.5px] text-slate-600 pt-1 border-t border-slate-200">
                <span className="font-bold">ID Autenticação:</span>
                <span className="font-mono font-bold text-emerald-800 truncate max-w-[170px]">
                  {activeAuthCode || 'Gerada no ato da quitação'}
                </span>
              </div>
            </div>

            {/* Botões de Ação do Comprovante: PDF e WhatsApp */}
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <button
                type="button"
                onClick={handleDownloadReceiptPdf}
                className="h-9 px-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <span className="material-symbols-outlined text-[15px]">picture_as_pdf</span>
                <span>Baixar PDF</span>
              </button>
              <button
                type="button"
                onClick={handleShareReceiptWhatsApp}
                className="h-9 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <span className="material-symbols-outlined text-[15px]">chat</span>
                <span>WhatsApp</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsReceiptModalOpen(false)}
              className="w-full h-8.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer transition-colors"
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
            className="bg-white rounded-2xl sm:rounded-3xl max-w-[380px] sm:max-w-sm w-full max-h-[90dvh] overflow-y-auto m-auto p-3 sm:p-4 flex flex-col items-center text-center gap-2 select-none shadow-2xl animate-in zoom-in-95 border border-slate-200 scrollbar-thin text-slate-850"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs shrink-0">
              <span className="material-symbols-outlined text-[22px] sm:text-[24px]">check_circle</span>
            </div>
            <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm leading-tight">
              Pagamento Baixado e Autenticado!
            </h3>

            <div className="text-[10.5px] sm:text-xs text-slate-600 leading-tight flex flex-col gap-1 bg-slate-50 p-2 sm:p-2.5 rounded-xl border border-slate-200 w-full text-left">
              <div className="flex justify-between pb-0.5 border-b border-slate-200">
                <span>Devedor:</span>
                <b className="text-slate-800 truncate max-w-[180px]">{inst.debtorName}</b>
              </div>
              <div className="flex justify-between pb-0.5 border-b border-slate-200">
                <span>Valor pago:</span>
                <b className="text-emerald-700 font-bold text-xs sm:text-sm font-mono">R$ {parsedPaidAmount.toFixed(2).replace('.', ',')}</b>
              </div>
              <div className="flex justify-between pb-0.5 border-b border-slate-200">
                <span>Parcela:</span>
                <b className="text-slate-800 truncate max-w-[180px]">#{inst.installmentNumber}/{inst.totalInstallments} ({inst.product})</b>
              </div>
              <div className="flex justify-between pb-0.5 border-b border-slate-200">
                <span>Data do Recebimento:</span>
                <b className="text-slate-800">{paymentDate}</b>
              </div>

              {/* Chave de Autenticação Gerada e Validada */}
              <div className="pt-1 border-t border-slate-200 flex flex-col gap-0.5">
                <div className="flex items-center justify-between text-[9px] text-slate-500 font-bold uppercase">
                  <span>Chave de Autenticação:</span>
                  <span className="text-emerald-700 font-black flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-[10px]">verified</span>
                    REGISTRADA
                  </span>
                </div>
                <div className="p-1 px-1.5 rounded-lg bg-emerald-50 border border-emerald-300/80 flex items-center justify-between gap-1">
                  <span className="font-mono font-bold text-[9.5px] sm:text-[10px] text-emerald-950 truncate select-all">
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
                    <span className="material-symbols-outlined text-[13px]">content_copy</span>
                  </button>
                </div>
              </div>

              <div className="flex justify-between text-blue-700 font-bold pt-0.5 border-t border-slate-200 text-[10.5px]">
                <span>⭐ Novo Score de {inst.debtorName}:</span>
                <span>{predictedScore} pts</span>
              </div>
            </div>

            {/* Ações pós-pagamento: Baixar PDF ou WhatsApp */}
            <div className="grid grid-cols-2 gap-2 w-full pt-0.5">
              <button
                type="button"
                onClick={handleDownloadReceiptPdf}
                className="h-9 px-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <span className="material-symbols-outlined text-[14px]">download</span>
                <span>Baixar PDF</span>
              </button>
              <button
                type="button"
                onClick={handleShareReceiptWhatsApp}
                className="h-9 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <span className="material-symbols-outlined text-[14px]">chat</span>
                <span>WhatsApp</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsSuccessModalOpen(false);
                onNavigate('dashboard');
              }}
              className="w-full h-9 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs cursor-pointer transition-colors"
            >
              Concluir e Voltar ao Painel
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Modal de Confirmação: "Você tem certeza?" (Portaled para Body com Enquadramento Perfeito) */}
      {isConfirmModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[200] bg-slate-950/85 backdrop-blur-md overflow-y-auto p-2 sm:p-4 flex items-center justify-center animate-in fade-in duration-200"
          onClick={() => setIsConfirmModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-[380px] sm:max-w-md max-h-[90dvh] overflow-y-auto m-auto rounded-2xl sm:rounded-3xl p-3 sm:p-4 flex flex-col items-center text-center gap-2 select-none transition-colors border-2 shadow-2xl animate-in zoom-in-95 duration-200 scrollbar-thin ${
              effectiveDarkMode
                ? 'bg-slate-900 border-cyan-500/50 text-white shadow-[0_20px_50px_rgba(6,182,212,0.4)]'
                : 'bg-white border-emerald-500/40 text-slate-900 shadow-[0_25px_60px_rgba(0,0,0,0.22)]'
            }`}
          >
            {/* Barra Superior do Modal com Badge e Botão de Alternar Modo */}
            <div className="w-full flex items-center justify-between text-xs pb-0.5 shrink-0">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[9.5px] sm:text-[10px] border ${
                effectiveDarkMode
                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}>
                <span className="material-symbols-outlined text-[11px]">verified_user</span>
                Confirmação de Baixa
              </span>

              {/* Botão de Alternar Light Mode e Dark Mode */}
              <button
                type="button"
                onClick={handleToggleLocalTheme}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9.5px] sm:text-[10px] font-bold border transition-all cursor-pointer active:scale-95 shadow-2xs ${
                  effectiveDarkMode
                    ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                }`}
                title={effectiveDarkMode ? 'Mudar para Light Mode' : 'Mudar para Dark Mode'}
              >
                <span className="material-symbols-outlined text-[12px]">
                  {effectiveDarkMode ? 'light_mode' : 'dark_mode'}
                </span>
                <span>{effectiveDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
            </div>

            {/* Ícone de Destaque Compacto */}
            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shadow-xs shrink-0 ${
              effectiveDarkMode
                ? 'bg-amber-500/20 text-amber-400 border border-amber-400/40'
                : 'bg-amber-100 text-amber-600 border border-amber-300'
            }`}>
              <span className="material-symbols-outlined text-[20px] sm:text-[22px]">help</span>
            </div>

            {/* Título e Pergunta */}
            <div className="space-y-0.5 shrink-0">
              <h3 className={`font-black text-sm sm:text-base leading-tight ${effectiveDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Você tem certeza?
              </h3>
              <p className={`text-[10px] sm:text-[11px] max-w-xs mx-auto leading-tight ${effectiveDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                Tem certeza que deseja confirmar o pagamento e autenticar a baixa desta parcela?
              </p>
            </div>

            {/* Card com Detalhes da Ação para Conferência */}
            <div className={`w-full rounded-xl sm:rounded-2xl p-2 sm:p-2.5 flex flex-col gap-1 text-left text-[10.5px] sm:text-[11.5px] border shrink-0 ${
              effectiveDarkMode
                ? 'bg-slate-950/70 border-cyan-500/30'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <div className={`flex justify-between items-center pb-0.5 border-b ${effectiveDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                <span className={effectiveDarkMode ? 'text-slate-400' : 'text-slate-500'}>Devedor:</span>
                <span className={`font-bold text-xs truncate max-w-[190px] ${effectiveDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {inst.debtorName}
                </span>
              </div>
              <div className={`flex justify-between items-center pb-0.5 border-b ${effectiveDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                <span className={effectiveDarkMode ? 'text-slate-400' : 'text-slate-500'}>Item / Parcela:</span>
                <span className={`font-semibold truncate max-w-[190px] ${effectiveDarkMode ? 'text-cyan-200' : 'text-blue-700'}`}>
                  {inst.product} (#{inst.installmentNumber}/{inst.totalInstallments})
                </span>
              </div>
              <div className={`flex justify-between items-center pb-0.5 border-b ${effectiveDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                <span className={effectiveDarkMode ? 'text-slate-400' : 'text-slate-500'}>Valor Recebido:</span>
                <span className={`font-black font-mono text-xs sm:text-sm ${effectiveDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                  R$ {parsedPaidAmount.toFixed(2).replace('.', ',')}
                </span>
              </div>
              <div className={`flex justify-between items-center pb-0.5 border-b ${effectiveDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                <span className={effectiveDarkMode ? 'text-slate-400' : 'text-slate-500'}>Data do Pagamento:</span>
                <span className={`font-bold ${effectiveDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{paymentDate}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className={effectiveDarkMode ? 'text-slate-400' : 'text-slate-500'}>Forma de Pagamento:</span>
                <span className={`font-bold ${effectiveDarkMode ? 'text-blue-300' : 'text-blue-600'}`}>{paymentMethod}</span>
              </div>
            </div>

            <p className={`text-[9.5px] sm:text-[10px] leading-tight shrink-0 ${effectiveDarkMode ? 'text-cyan-200/80' : 'text-slate-500'}`}>
              ⚡ Esta ação liquidará a parcela no sistema, atualizará o saldo e emitirá a chave criptográfica de autenticação.
            </p>

            {/* Botões de Ação */}
            <div className="grid grid-cols-2 gap-2 w-full pt-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className={`w-full h-9 sm:h-10 px-2 rounded-xl font-bold text-xs border cursor-pointer transition-all active:scale-95 flex items-center justify-center ${
                  effectiveDarkMode
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                }`}
              >
                Não, Voltar
              </button>

              <button
                type="button"
                onClick={handleExecutePayment}
                disabled={isSubmitting}
                className="w-full h-9 sm:h-10 px-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-black text-xs shadow-md border border-emerald-400/40 cursor-pointer transition-all flex items-center justify-center gap-1"
              >
                {isSubmitting ? (
                  <span className="material-symbols-outlined text-[15px] animate-spin">sync</span>
                ) : (
                  <span className="material-symbols-outlined text-[15px]">check_circle</span>
                )}
                <span>Sim, Confirmar</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
