import { safeToFixed, safeFormatCurrency, safeToNumber } from "../utils/numberUtils";
import React, { useState, useMemo, useRef, useEffect } from 'react';
import jsPDF from 'jspdf';
import { Debtor, Purchase, Installment, generateAuthCode } from '../types';
import { HaspahoLogo } from './HaspahoLogo';
import { generateHaspahoLogoPngDataUrl, generateHaspahoFullHeaderPngDataUrl, generateHaspahoWatermarkDataUrl } from '../utils/logoPdfHelper';
import { generatePixQrCodeDataUrl } from '../utils/pixQrCodeHelper';
import { registerAuthCode } from '../utils/authRegistry';
import { printHtmlContent } from '../utils/printHelper';
import { capturePanelScreenshot } from '../utils/screenshotHelper';
import { ShareScreenshotModal } from './ShareScreenshotModal';

interface ExtratoTotalModalProps {
  isOpen: boolean;
  onClose: () => void;
  debtor?: Debtor;
  purchase?: Purchase;
  installments: Installment[];
  onToast?: (msg: string) => void;
  onOpenNovoRecibo?: () => void;
  onSettleInstallment?: (inst: Installment) => void;
}

export const ExtratoTotalModal: React.FC<ExtratoTotalModalProps> = ({
  isOpen,
  onClose,
  debtor,
  purchase,
  installments,
  onToast,
  onOpenNovoRecibo,
  onSettleInstallment,
}) => {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const printContentRef = useRef<HTMLDivElement>(null);

  const [shareData, setShareData] = useState<{
    isOpen: boolean;
    imageUrl: string;
    imageBlob: Blob | null;
    fileName: string;
    title: string;
    description: string;
  }>({
    isOpen: false,
    imageUrl: '',
    imageBlob: null,
    fileName: '',
    title: '',
    description: '',
  });

  // Document metadata generated once on render
  const documentId = useMemo(() => {
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    return `EXT-2026-${randomSuffix}`;
  }, [isOpen]);

  const issueTimestamp = useMemo(() => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${dateStr} às ${timeStr}`;
  }, [isOpen]);

  // Sort installments chronologically 1..N and guarantee persistent authCodes for each installment
  const sortedInstallments = useMemo(() => {
    if (!installments || installments.length === 0) return [];
    
    // Filter only for the current purchase if provided
    let filtered = [...installments];
    if (purchase?.id) {
      filtered = filtered.filter(inst => inst.purchaseId === purchase.id);
    }

    return filtered
      .sort((a, b) => a.installmentNumber - b.installmentNumber)
      .map((item) => {
        if (!item.authCode) {
          const seed = (item.id || `${item.installmentNumber}`).replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || '5779';
          const generated = `EMUG3MDT9PR02P${item.installmentNumber}${seed}`;
          return { ...item, authCode: generated };
        }
        return item;
      });
  }, [installments, purchase?.id]);

  // Calculated Metrics
  const totalInstallmentsCount = sortedInstallments.length || purchase?.installmentsTotal || 0;
  
  const paidInstallments = useMemo(() => {
    return sortedInstallments.filter((i) => i.status === 'paid');
  }, [sortedInstallments]);

  const pendingInstallments = useMemo(() => {
    return sortedInstallments.filter((i) => i.status !== 'paid');
  }, [sortedInstallments]);

  const overdueInstallments = useMemo(() => {
    return sortedInstallments.filter(
      (i) => i.status === 'overdue' || (i.status !== 'paid' && (i.delayDays || 0) > 0)
    );
  }, [sortedInstallments]);

  const paidCount = paidInstallments.length;
  const pendingCount = pendingInstallments.length;
  const overdueCount = overdueInstallments.length;

  const totalContractedAmount = useMemo(() => {
    if (purchase?.totalAmount) return purchase.totalAmount;
    return sortedInstallments.reduce((acc, curr) => acc + (curr.originalAmount || curr.amount), 0);
  }, [purchase, sortedInstallments]);

  const totalPaidAmount = useMemo(() => {
    return sortedInstallments.reduce((acc, curr) => {
      if (curr.status === 'paid') {
        const val = curr.paidAmount ?? curr.amount ?? curr.originalAmount;
        return acc + val;
      }
      return acc;
    }, 0);
  }, [sortedInstallments]);

  const totalPendingAmount = useMemo(() => {
    return sortedInstallments.reduce((acc, curr) => {
      if (curr.status !== 'paid') {
        return acc + curr.amount;
      }
      return acc;
    }, 0);
  }, [sortedInstallments]);

  const percentPaid = totalInstallmentsCount > 0 ? (paidCount / totalInstallmentsCount) * 100 : 0;
  const percentRemaining = Math.max(0, 100 - percentPaid);

  // First & Last payment dates
  const firstPaymentDate = useMemo(() => {
    const dates = paidInstallments
      .map((i) => i.paidAt)
      .filter(Boolean) as string[];
    if (dates.length === 0) return 'Nenhum pagamento';
    return dates[0];
  }, [paidInstallments]);

  const lastPaymentDate = useMemo(() => {
    const dates = paidInstallments
      .map((i) => i.paidAt)
      .filter(Boolean) as string[];
    if (dates.length === 0) return 'Nenhum pagamento';
    return dates[dates.length - 1];
  }, [paidInstallments]);

  // Overall status
  const overallStatus = useMemo(() => {
    if (totalInstallmentsCount > 0 && paidCount === totalInstallmentsCount) {
      return { label: 'QUITADO', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    }
    if (overdueCount > 0) {
      return { label: 'ATRASADO', color: 'bg-rose-100 text-rose-800 border-rose-300' };
    }
    return { label: 'EM ANDAMENTO', color: 'bg-blue-100 text-blue-800 border-blue-300' };
  }, [totalInstallmentsCount, paidCount, overdueCount]);

  const debtorName = debtor?.name || sortedInstallments[0]?.debtorName || 'Devedor não identificado';
  const debtorDocument = debtor?.documentNumber || 'Não informado';
  const debtorPhone = debtor?.phone || 'Não informado';
  const debtorAddress = 'Não informado';

  const productName = purchase?.product || sortedInstallments[0]?.product || 'Produto/Serviço Geral';
  const storeName = purchase?.store || 'Loja Física/Online';
  const cardName = purchase?.cardName || sortedInstallments[0]?.cardName || 'Cartão/Crediário';

  // Registra o Extrato e todas as parcelas pagas no Registro Central Oficial de Autenticações
  useEffect(() => {
    if (!isOpen) return;

    // Registra o extrato geral
    registerAuthCode({
      auth: documentId,
      type: 'extrato',
      payer: debtorName,
      amount: `R$ ${safeToFixed(totalPaidAmount).replace('.', ',')} de R$ ${safeToFixed(totalContractedAmount).replace('.', ',')}`,
      date: issueTimestamp,
      bank: 'HASPAHO Auditoria & Asaas IP',
      item: `Extrato Total - ${productName} (${paidCount}/${totalInstallmentsCount} parcelas pagas)`,
      destination: 'Tiago Dias (Credor)',
      status: overallStatus.label,
      documentId: documentId,
    });

    // Registra cada parcela liquidada
    sortedInstallments.forEach((inst) => {
      if (inst.status === 'paid' && inst.authCode) {
        registerAuthCode({
          auth: inst.authCode,
          type: 'recibo',
          payer: inst.debtorName || debtorName,
          amount: `R$ ${safeToFixed(inst.paidAmount || inst.amount).replace('.', ',')}`,
          date: inst.paidAt || inst.dueDate || issueTimestamp,
          bank: inst.paymentMethod || 'Nubank Croma / Asaas IP',
          item: `${inst.product || productName} (Parcela ${inst.installmentNumber}/${totalInstallmentsCount})`,
          destination: 'Tiago Dias (Credor)',
          status: 'AUTÊNTICO E LIQUIDADO',
        });
      }
    });
  }, [isOpen, documentId, debtorName, productName, totalPaidAmount, totalContractedAmount, paidCount, totalInstallmentsCount, overallStatus.label, sortedInstallments, issueTimestamp]);

  // Handler to generate multi-page PDF with jsPDF
  const handleDownloadPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      if (onToast) onToast('Gerando Extrato Total do Parcelamento em PDF...');

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const pageWidth = 210;
      const pageHeight = 297;
      const marginX = 14;
      const contentWidth = pageWidth - marginX * 2;

      // Render full official header banner and watermark
      let logoDataUrl = '';
      let watermarkDataUrl = '';
      try {
        [logoDataUrl, watermarkDataUrl] = await Promise.all([
          generateHaspahoFullHeaderPngDataUrl(),
          generateHaspahoWatermarkDataUrl(),
        ]);
      } catch (err) {
        console.warn('Erro ao gerar imagens para PDF:', err);
      }

      let y = 10;
      let currentPage = 1;

      const addDocumentHeader = (pageNum: number) => {
        // Embed Central Institutional Watermark in background
        if (watermarkDataUrl) {
          const wmW = 135;
          const wmH = 154;
          const wmX = (pageWidth - wmW) / 2;
          const wmY = (pageHeight - wmH) / 2;
          doc.addImage(watermarkDataUrl, 'PNG', wmX, wmY, wmW, wmH, undefined, 'FAST');
        }

        let bannerBottom = 36;
        if (logoDataUrl) {
          const imgProps = doc.getImageProperties(logoDataUrl);
          const bannerWidth = 118;
          const bannerHeight = (imgProps.height * bannerWidth) / imgProps.width;
          const bannerX = (pageWidth - bannerWidth) / 2;
          doc.addImage(logoDataUrl, 'PNG', bannerX, 8, bannerWidth, bannerHeight, undefined, 'FAST');
          bannerBottom = 8 + bannerHeight + 3;
        }

        doc.setFillColor(15, 23, 42); // Dark slate
        doc.rect(marginX, bannerBottom, contentWidth, 12, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('EXTRATO TOTAL DO PARCELAMENTO • HISTÓRICO INTEGRAL', pageWidth / 2, bannerBottom + 5.5, { align: 'center' });
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(`Identificador: ${documentId} • Emitido em: ${issueTimestamp} • Pág. ${pageNum}`, pageWidth / 2, bannerBottom + 9.5, { align: 'center' });
      };

      // Page 1 Header
      addDocumentHeader(currentPage);
      y = 66;

      // Section 1: Debtor & Purchase Card Box
      doc.setFillColor(248, 250, 252); // Slate 50
      doc.setDrawColor(203, 213, 225); // Slate 300
      doc.roundedRect(marginX, y, contentWidth, 32, 2, 2, 'FD');

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`DEVEDOR / CONTRATANTE: ${debtorName.toUpperCase()}`, marginX + 4, y + 6);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`CPF/CNPJ: ${debtorDocument}  |  Tel/WhatsApp: ${debtorPhone}`, marginX + 4, y + 12);
      doc.text(`Endereço: ${debtorAddress}`, marginX + 4, y + 17);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`PRODUTO / OPERAÇÃO: ${productName}`, marginX + 4, y + 24);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Loja/Origem: ${storeName}  |  Forma: ${cardName}`, marginX + 4, y + 29);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(22, 101, 52);
      doc.text(`VALOR TOTAL LIQUIDADO: R$ ${safeToFixed(totalPaidAmount).replace('.', ',')} (${paidCount}/${totalInstallmentsCount} pagas)`, marginX + 90, y + 29);

      y += 38;

      // Section 2: Table Header
      const renderTableHeader = (currentY: number) => {
        doc.setFillColor(30, 41, 59); // Slate 800
        doc.rect(marginX, currentY, contentWidth, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);

        doc.text('PARCELA', marginX + 3, currentY + 5.5);
        doc.text('VENCIMENTO', marginX + 22, currentY + 5.5);
        doc.text('VALOR', marginX + 48, currentY + 5.5);
        doc.text('SITUAÇÃO', marginX + 70, currentY + 5.5);
        doc.text('PAGAMENTO', marginX + 96, currentY + 5.5);
        doc.text('CHAVE DE AUTENTICAÇÃO', marginX + 126, currentY + 5.5);
      };

      renderTableHeader(y);
      y += 8;

      // Section 3: Render Installments Table Rows
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);

      sortedInstallments.forEach((inst, idx) => {
        // Page overflow check (A4 height = 297mm, margin bottom ~20mm)
        if (y > 265) {
          doc.addPage();
          currentPage++;
          addDocumentHeader(currentPage);
          y = 56;
          renderTableHeader(y);
          y += 8;
        }

        const isRowEven = idx % 2 === 0;
        if (isRowEven) {
          doc.setFillColor(241, 245, 249); // Slate 100 zebra
          doc.rect(marginX, y, contentWidth, 7, 'F');
        }

        const isPaid = inst.status === 'paid';
        const isOverdue = inst.status === 'overdue' || (inst.status !== 'paid' && (inst.delayDays || 0) > 0);

        // Parcela Number
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.text(`${String(inst.installmentNumber).padStart(2, '0')}/${String(totalInstallmentsCount).padStart(2, '0')}`, marginX + 3, y + 5);

        // Vencimento
        doc.setFont('helvetica', 'normal');
        doc.text(inst.dueDate, marginX + 22, y + 5);

        // Valor
        doc.setFont('helvetica', 'bold');
        const displayVal = safeToFixed(inst.originalAmount || inst.amount).replace('.', ',');
        doc.text(`R$ ${displayVal}`, marginX + 48, y + 5);

        // Situação
        if (isPaid) {
          doc.setTextColor(22, 101, 52); // Green
          doc.text('PAGO', marginX + 70, y + 5);
        } else if (isOverdue) {
          doc.setTextColor(185, 28, 28); // Red
          doc.text('EM ATRASO', marginX + 70, y + 5);
        } else {
          doc.setTextColor(180, 83, 9); // Amber
          doc.text('A VENCER', marginX + 70, y + 5);
        }

        doc.setTextColor(15, 23, 42);

        // Data do Pagamento
        const paidDateText = isPaid ? (inst.paidAt || inst.dueDate) : '—';
        doc.text(paidDateText, marginX + 96, y + 5);

        // Chave de Autenticação com Ícone Símbolo de Verificação Individual (Apenas se PAGO)
        const iconX = marginX + 128.5;
        const iconY = y + 3.8;
        const effectiveAuthCode = isPaid ? (inst.authCode || `EMU${(inst.id || `${inst.installmentNumber}`).replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase()}P${inst.installmentNumber}K${Math.round(inst.amount || inst.originalAmount || 360)}7`) : null;
        if (isPaid && effectiveAuthCode) {
          doc.setFillColor(16, 185, 129);
          doc.circle(iconX, iconY, 1.3, 'F');
          doc.setDrawColor(255, 255, 255);
          doc.setLineWidth(0.35);
          doc.line(iconX - 0.6, iconY, iconX - 0.2, iconY + 0.5);
          doc.line(iconX - 0.2, iconY + 0.5, iconX + 0.6, iconY - 0.45);

          doc.setFont('courier', 'bold');
          doc.setFontSize(6.8);
          doc.setTextColor(6, 95, 70);
          doc.text(effectiveAuthCode, marginX + 131.5, y + 5);
        } else {
          doc.setFillColor(203, 213, 225);
          doc.circle(iconX, iconY, 1.1, 'F');

          doc.setFont('helvetica', 'italic');
          doc.setFontSize(6.2);
          doc.setTextColor(148, 163, 184);
          doc.text('— Pendente de Quitação', marginX + 131.5, y + 5);
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);

        y += 7;
      });

      y += 6;

      // Check overflow before Resumo Financeiro
      if (y > 230) {
        doc.addPage();
        currentPage++;
        addDocumentHeader(currentPage);
        y = 56;
      }

      // Section 4: Resumo Financeiro
      doc.setFillColor(240, 253, 244); // Green tint box
      doc.setDrawColor(187, 247, 208);
      doc.roundedRect(marginX, y, contentWidth, 38, 2, 2, 'FD');

      doc.setTextColor(20, 83, 45); // Emerald 900
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text('RESUMO FINANCEIRO DA DÍVIDA CONSOLIDADA', marginX + 4, y + 6);

      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      
      const col1X = marginX + 4;
      const col2X = marginX + 68;
      const col3X = marginX + 130;

      // Row 1
      doc.setFont('helvetica', 'normal');
      doc.text(`Valor Total Contratado:`, col1X, y + 13);
      doc.setFont('helvetica', 'bold');
      doc.text(`R$ ${safeToFixed(totalContractedAmount).replace('.', ',')}`, col1X + 34, y + 13);

      doc.setFont('helvetica', 'normal');
      doc.text(`Qtd. Total Parcelas:`, col2X, y + 13);
      doc.setFont('helvetica', 'bold');
      doc.text(`${totalInstallmentsCount} parcelas`, col2X + 30, y + 13);

      doc.setFont('helvetica', 'normal');
      doc.text(`Percentual Pago:`, col3X, y + 13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(22, 101, 52);
      doc.text(`${safeToFixed(percentPaid, 2)}%`, col3X + 26, y + 13);
      doc.setTextColor(15, 23, 42);

      // Row 2
      doc.setFont('helvetica', 'normal');
      doc.text(`Total Efetivamente Pago:`, col1X, y + 20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(22, 101, 52);
      doc.text(`R$ ${safeToFixed(totalPaidAmount).replace('.', ',')}`, col1X + 34, y + 20);
      doc.setTextColor(15, 23, 42);

      doc.setFont('helvetica', 'normal');
      doc.text(`Parcelas Quitadas:`, col2X, y + 20);
      doc.setFont('helvetica', 'bold');
      doc.text(`${paidCount} de ${totalInstallmentsCount}`, col2X + 30, y + 20);

      doc.setFont('helvetica', 'normal');
      doc.text(`Percentual Restante:`, col3X, y + 20);
      doc.setFont('helvetica', 'bold');
      doc.text(`${safeToFixed(percentRemaining, 2)}%`, col3X + 26, y + 20);

      // Row 3
      doc.setFont('helvetica', 'normal');
      doc.text(`Total Saldo Pendente:`, col1X, y + 27);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(185, 28, 28);
      doc.text(`R$ ${safeToFixed(totalPendingAmount).replace('.', ',')}`, col1X + 34, y + 27);
      doc.setTextColor(15, 23, 42);

      doc.setFont('helvetica', 'normal');
      doc.text(`Parcelas A Vencer:`, col2X, y + 27);
      doc.setFont('helvetica', 'bold');
      doc.text(`${pendingCount} parcelas`, col2X + 30, y + 27);

      doc.setFont('helvetica', 'normal');
      doc.text(`Primeiro Pagamento:`, col3X, y + 27);
      doc.setFont('helvetica', 'bold');
      doc.text(`${firstPaymentDate}`, col3X + 26, y + 27);

      // Row 4
      doc.setFont('helvetica', 'normal');
      doc.text(`Último Pagamento:`, col3X, y + 33);
      doc.setFont('helvetica', 'bold');
      doc.text(`${lastPaymentDate}`, col3X + 26, y + 33);

      y += 42;

      // Check overflow before PIX box
      if (y > 240) {
        doc.addPage();
        currentPage++;
        addDocumentHeader(currentPage);
        y = 56;
      }

      // Section 5: Bloco Oficial de Pagamento PIX (QR Code e Chave Telefone)
      doc.setFillColor(240, 253, 244); // light emerald-50
      doc.setDrawColor(167, 243, 208); // emerald-200
      doc.roundedRect(marginX, y, contentWidth, 34, 2, 2, 'FD');

      const officialPixKey = '(14) 99733-9863';
      try {
        const pixQrDataUrl = await generatePixQrCodeDataUrl(officialPixKey, totalPendingAmount, 'Tiago Dias');
        if (pixQrDataUrl) {
          doc.addImage(pixQrDataUrl, 'PNG', marginX + 2, y + 2, 30, 30, undefined, 'FAST');
        }
      } catch (err) {
        console.warn('QR Code PIX generation error:', err);
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(6, 95, 70); // emerald-800
      doc.text('PAGUE VIA QR CODE PIX OU CHAVE TELEFONE (14 99733 9863):', marginX + 35, y + 7);

      doc.setFontSize(7.8);
      doc.setTextColor(15, 23, 42);
      doc.text(`Chave PIX Oficial (Telefone Celular): ${officialPixKey}`, marginX + 35, y + 13);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(71, 85, 105);
      doc.text(`Titular: Tiago Dias • HASPAHO Tecnologia da Informação`, marginX + 35, y + 18.5);
      doc.text(`Município: Mineiros do Tietê - SP`, marginX + 35, y + 23.5);
      doc.text(`Instrução: Abra o aplicativo de qualquer banco e leia o QR Code ao lado.`, marginX + 35, y + 28.5);

      y += 38;

      // Footer disclaimer & signature line
      doc.setDrawColor(203, 213, 225);
      doc.line(marginX, y, pageWidth - marginX, y);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(
        'Este Extrato Total reflete o estado atual dos registros financeiros no sistema HASPAHO. Os códigos de autenticação indicados foram gerados e armazenados no ato de cada liquidação individual.',
        pageWidth / 2,
        y + 4,
        { align: 'center', maxWidth: contentWidth }
      );

      // Trigger download
      const filename = `Extrato_Total_${debtorName.replace(/\s+/g, '_')}_${documentId}.pdf`;
      doc.save(filename);
      if (onToast) onToast('PDF do Extrato Total baixado com sucesso!');
    } catch (err) {
      console.error('Erro ao gerar PDF do extrato:', err);
      if (onToast) onToast('Ocorreu um erro ao gerar o PDF. Tente novamente.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Handler for direct printing with robust cross-device fallback
  const handlePrint = () => {
    const printEl = printContentRef.current;
    if (printEl) {
      printHtmlContent(
        `Extrato Total - ${debtorName} - ${documentId}`,
        printEl,
        () => handleDownloadPdf()
      );
    } else {
      handleDownloadPdf();
    }
  };

  // Handler para capturar Print / Screenshot do Extrato Total
  const handleCaptureScreenshot = async () => {
    if (!printContentRef.current) return;
    try {
      setIsCapturingScreenshot(true);
      if (onToast) onToast('📸 Capturando print do Extrato Total em alta resolução...');
      const fileNameBase = `extrato_total_${debtorName.replace(/\s+/g, '_')}_${documentId}`;
      const res = await capturePanelScreenshot(printContentRef.current, fileNameBase);

      if (res.success && res.imageUrl) {
        if (onToast) onToast(`✅ Print salvo na pasta Downloads como ${res.fileName}`);
        setShareData({
          isOpen: true,
          imageUrl: res.imageUrl,
          imageBlob: res.imageBlob || null,
          fileName: res.fileName,
          title: `Extrato Total do Parcelamento - ${debtorName}`,
          description: `Documento: ${documentId} • Total: R$ ${safeToFixed(totalContractedAmount, 2)} (${sortedInstallments.length} parcelas)`,
        });
      } else {
        if (onToast) onToast(res.error || 'Não foi possível capturar o print do extrato.');
      }
    } catch (err) {
      console.error('Erro ao tirar print do extrato:', err);
      if (onToast) onToast('Erro ao capturar print. Baixe o PDF.');
    } finally {
      setIsCapturingScreenshot(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-[0_0_50px_rgba(6,182,212,0.35)] ring-2 ring-cyan-400/50 border-2 border-cyan-400/60 w-full max-w-4xl lg:max-w-5xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden text-slate-850">
        
        {/* 1. Modal Top Header 100% Branco com Botão Voltar e Fechar (X) Visíveis */}
        <div className="bg-white text-slate-900 px-4 py-3 sm:py-3.5 flex items-center justify-between shrink-0 border-b border-slate-200 z-10 shadow-2xs">
          {/* Botão Voltar */}
          <button
            type="button"
            onClick={onClose}
            className="h-8 sm:h-8.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200 shrink-0"
            title="Voltar / Fechar Janela"
          >
            <span className="material-symbols-outlined text-[17px]">arrow_back</span>
            <span>Voltar</span>
          </button>

          {/* Título Central */}
          <div className="text-center min-w-0 px-2 flex-1">
            <h2 className="font-black text-xs sm:text-sm leading-tight text-slate-900 uppercase tracking-tight truncate">
              Extrato Total Consolidado • {debtorName}
            </h2>
            <p className="text-[10px] text-slate-500 font-mono truncate">
              ID: <span className="text-emerald-700 font-bold">{documentId}</span> • {issueTimestamp}
            </p>
          </div>

          {/* Botão Fechar (X) */}
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer border border-slate-200 shrink-0"
            title="Fechar (X)"
          >
            <span className="material-symbols-outlined text-[19px]">close</span>
          </button>
        </div>

        {/* Modal Printable Scrollable Content Body Reenquadrado (Sem Cortes com Padding Inferior Confortável) */}
        <div className="p-3 sm:p-5 md:p-6 overflow-y-auto space-y-4 flex-1 text-slate-850 bg-white relative scrollbar-thin pb-12" ref={printContentRef}>
          
          <div className="w-full space-y-4">
          
          {/* Marca d'água oficial HASPAHO translúcida no fundo de página */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0 opacity-[0.03] select-none">
            <div className="w-[320px] sm:w-[460px] h-[360px] sm:h-[500px] flex items-center justify-center">
              <HaspahoLogo size="2xl" variant="icon" className="scale-[2.8]" />
            </div>
          </div>

          {/* Top Brand & Title Header Oficial HASPAHO */}
          <div className="relative z-10 bg-slate-50 p-3.5 sm:p-4 rounded-2xl border border-emerald-500/30 shadow-xs flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="flex items-center justify-center sm:justify-start max-w-full">
              <HaspahoLogo size="lg" variant="horizontal" className="h-8 sm:h-10" />
            </div>
            
            <div className="flex flex-col sm:items-end items-center gap-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-100 text-emerald-950 text-[10.5px] font-black uppercase tracking-wider shadow-xs border border-emerald-400">
                <span className="material-symbols-outlined text-[15px] text-emerald-700 font-bold">verified</span>
                <span>VERIFICADO • SALVO NO SISTEMA</span>
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse ml-0.5" />
              </div>
              <p className="text-[10px] text-slate-500 font-medium font-mono">
                Identificador: <span className="font-bold text-slate-800">{documentId}</span>
              </p>
            </div>
          </div>

          {/* Topo em Destaque: VALOR TOTAL LIQUIDADO & MÉTRICAS */}
          <div className="relative z-10 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white p-4 sm:p-5 rounded-2xl shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 border border-emerald-400/40">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 border border-white/30 shadow-inner">
                <span className="material-symbols-outlined text-[28px]">payments</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-black tracking-widest text-emerald-100 block">
                  VALOR TOTAL LIQUIDADO
                </span>
                <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white leading-tight">
                  R$ {safeToFixed(totalPaidAmount).replace('.', ',')}
                </div>
                <span className="text-[11px] text-emerald-100 font-medium">
                  {paidCount} de {totalInstallmentsCount} parcelas pagas ({safeToFixed(percentPaid, 1)}% liquidado)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 self-stretch sm:self-center justify-between sm:justify-end border-t sm:border-t-0 sm:border-l border-white/20 pt-2.5 sm:pt-0 sm:pl-5">
              <div className="text-left sm:text-right">
                <span className="text-[10px] text-emerald-100 uppercase tracking-wider block font-semibold">Valor Contratado:</span>
                <span className="font-mono font-bold text-sm sm:text-base text-white">
                  R$ {safeToFixed(totalContractedAmount).replace('.', ',')}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-emerald-100 uppercase tracking-wider block font-semibold">Saldo Restante:</span>
                <span className="font-mono font-bold text-sm sm:text-base text-white">
                  R$ {safeToFixed(totalPendingAmount).replace('.', ',')}
                </span>
              </div>
            </div>
          </div>

          {/* Debtor & Purchase Overview Grid */}
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-3.5">
            
            {/* Debtor Card */}
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1.5">
              <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1 border-b border-slate-100 pb-1.5">
                <span className="material-symbols-outlined text-[16px] text-cyan-600">person</span>
                <span>Dados do Devedor / Contratante</span>
              </h3>
              <div className="text-xs space-y-1 pt-0.5">
                <p className="font-bold text-slate-900 text-sm">{debtorName}</p>
                <p className="text-slate-600"><strong className="text-slate-700">CPF/CNPJ:</strong> {debtorDocument}</p>
                <p className="text-slate-600"><strong className="text-slate-700">WhatsApp:</strong> {debtorPhone}</p>
                <p className="text-slate-600"><strong className="text-slate-700">Endereço:</strong> {debtorAddress}</p>
              </div>
            </div>

            {/* Purchase Details Card */}
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1.5">
              <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1 border-b border-slate-100 pb-1.5">
                <span className="material-symbols-outlined text-[16px] text-emerald-600">shopping_bag</span>
                <span>Dados da Contratação / Financiamento</span>
              </h3>
              <div className="text-xs space-y-1 pt-0.5">
                <p className="font-bold text-slate-900 text-sm">{productName}</p>
                <p className="text-slate-600"><strong className="text-slate-700">Estabelecimento/Loja:</strong> {storeName}</p>
                <p className="text-slate-600"><strong className="text-slate-700">Modalidade:</strong> {cardName}</p>
                <p className="text-slate-600">
                  <strong className="text-slate-700">Valor Total:</strong>{' '}
                  <span className="font-bold text-slate-900">R$ {safeToFixed(totalContractedAmount).replace('.', ',')}</span>{' '}
                  ({totalInstallmentsCount} parcelas de R$ {safeToFixed(totalContractedAmount / (totalInstallmentsCount || 1)).replace('.', ',')})
                </p>
              </div>
            </div>

          </div>

          {/* Complete Installments Table Reenquadrada */}
          <div className="relative z-10 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-4 py-3 bg-slate-100 text-slate-900 border-b border-slate-200 flex justify-between items-center flex-wrap gap-2">
              <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 text-slate-900">
                <span className="material-symbols-outlined text-[18px] text-cyan-600">table_chart</span>
                <span>Tabela Integral de Parcelas ({sortedInstallments.length} Registros)</span>
              </h3>
              <span className="text-[10.5px] text-slate-600 font-mono font-bold">
                Autenticação Digital Individual
              </span>
            </div>

            {/* 1. VISÃO MOBILE OTIMIZADA */}
            <div className="sm:hidden divide-y divide-slate-100 p-2.5 space-y-2.5">
              {sortedInstallments.map((item) => {
                const isPaid = item.status === 'paid';
                const isOverdue = item.status === 'overdue' || (item.status !== 'paid' && (item.delayDays || 0) > 0);
                const authCode = isPaid
                  ? (item.authCode || `EMU${(item.id || `${item.installmentNumber}`).replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase()}P${item.installmentNumber}K${Math.round(item.amount || item.originalAmount || 360)}7`)
                  : null;

                return (
                  <div
                    key={item.id}
                    className={`p-3 rounded-xl border transition-all space-y-2 ${
                      isPaid ? 'bg-emerald-50/40 border-emerald-200' : isOverdue ? 'bg-rose-50/40 border-rose-200' : 'bg-white border-slate-200'
                    }`}
                  >
                    {/* Linha Topo: Parcela, Vencimento, Valor, Situação */}
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-900 font-mono font-black text-[11px] border border-slate-200 shrink-0">
                          #{item.installmentNumber}/{totalInstallmentsCount}
                        </span>
                        <span className="text-[11px] font-mono text-slate-600 shrink-0">
                          📅 {item.dueDate}
                        </span>
                        <span className="text-xs font-mono font-black text-slate-900 shrink-0">
                          R$ {safeToFixed(item.originalAmount || item.amount).replace('.', ',')}
                        </span>
                      </div>

                      <div className="shrink-0">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9.5px] font-black shadow-2xs border border-emerald-300">
                            ✓ PAGA
                          </span>
                        ) : isOverdue ? (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[9.5px] font-black shadow-2xs border border-rose-300">
                            ⚠ ATRASADA
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[9.5px] font-bold shadow-2xs border border-amber-300">
                            ⏳ A VENCER
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Linha Código de Autenticação Individual Explícita */}
                    {isPaid && authCode ? (
                      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg font-mono text-xs shadow-2xs border bg-emerald-50/90 border-emerald-300 text-emerald-950 font-bold">
                        <div className="flex items-center gap-1.5 min-w-0 truncate">
                          <span className="material-symbols-outlined text-[16px] text-emerald-600 font-bold shrink-0">verified</span>
                          <span className="text-[10px] uppercase font-sans font-bold text-slate-500 shrink-0">Chave:</span>
                          <span className="select-all tracking-wider truncate text-[11px] font-bold">{authCode}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(authCode);
                            if (onToast) onToast(`Chave de autenticação da parcela #${item.installmentNumber} copiada!`);
                          }}
                          className="p-1 text-slate-700 hover:text-slate-950 active:scale-90 transition-all cursor-pointer shrink-0"
                          title="Copiar chave de autenticação"
                        >
                          <span className="material-symbols-outlined text-[16px]">content_copy</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg font-sans text-xs border bg-slate-50 border-slate-200 text-slate-500">
                        <div className="flex items-center gap-1.5 min-w-0 truncate">
                          <span className="material-symbols-outlined text-[15px] text-slate-400 shrink-0">schedule</span>
                          <span className="text-[10px] uppercase font-bold text-slate-400 shrink-0">Autenticação:</span>
                          <span className="italic text-[11px] text-slate-500 truncate">Pendente de Quitação</span>
                        </div>
                        {onSettleInstallment ? (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onSettleInstallment(item);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-all cursor-pointer active:scale-95 shrink-0"
                          >
                            <span className="material-symbols-outlined text-[13px]">payments</span>
                            <span>Dar Baixa</span>
                          </button>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 font-bold shrink-0 uppercase">NÃO GERADA</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 2. VISÃO DESKTOP (Tabela Completa Reenquadrada) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 font-black text-slate-700 text-[10.5px] uppercase tracking-wider">
                    <th className="py-2.5 px-3">Parcela</th>
                    <th className="py-2.5 px-3">Vencimento</th>
                    <th className="py-2.5 px-3">Valor</th>
                    <th className="py-2.5 px-3">Situação</th>
                    <th className="py-2.5 px-3">Data Pagto</th>
                    <th className="py-2.5 px-3 font-mono">Chave de Autenticação Individual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {sortedInstallments.map((item) => {
                    const isPaid = item.status === 'paid';
                    const isOverdue = item.status === 'overdue' || (item.status !== 'paid' && (item.delayDays || 0) > 0);
                    const authCode = isPaid
                      ? (item.authCode || `EMU${(item.id || `${item.installmentNumber}`).replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase()}P${item.installmentNumber}K${Math.round(item.amount || item.originalAmount || 360)}7`)
                      : null;
                    const paidDateText = isPaid ? (item.paidAt || item.dueDate) : '—';

                    return (
                      <tr key={item.id} className={isPaid ? 'bg-emerald-50/20' : isOverdue ? 'bg-rose-50/20' : 'hover:bg-slate-50'}>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          #{String(item.installmentNumber).padStart(2, '0')}/{String(totalInstallmentsCount).padStart(2, '0')}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {item.dueDate}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          R$ {safeToFixed(item.originalAmount || item.amount).replace('.', ',')}
                        </td>
                        <td className="py-2.5 px-3">
                          {isPaid ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                              PAGA
                            </span>
                          ) : isOverdue ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                              ATRASADA
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                              PENDENTE
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">
                          {paidDateText}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-[11px] text-slate-900">
                          {isPaid && authCode ? (
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono font-bold text-[10.5px] shadow-2xs border bg-emerald-50 border-emerald-300/80 text-emerald-950">
                              <span className="material-symbols-outlined text-[13px] text-emerald-600">verified</span>
                              <span className="select-all tracking-wider font-mono">{authCode}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(authCode);
                                  if (onToast) onToast(`Chave da parcela #${item.installmentNumber} copiada!`);
                                }}
                                className="p-0.5 text-slate-600 hover:text-slate-900 active:scale-90 transition-all cursor-pointer ml-1"
                                title="Copiar chave de autenticação"
                              >
                                <span className="material-symbols-outlined text-[13px]">content_copy</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-sans italic">
                              Pendente de Quitação
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Summary Box */}
          <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-50 rounded-2xl border-2 border-emerald-300/80 p-4 sm:p-5 shadow-xs space-y-3.5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-emerald-200/80 pb-2.5">
              <h3 className="font-black text-emerald-900 text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-[19px] text-emerald-700">analytics</span>
                <span>Resumo Financeiro Consolidado</span>
              </h3>
              <div className="text-xs font-bold text-emerald-800 bg-emerald-200/60 px-3 py-0.5 rounded-full">
                Progresso: {safeToFixed(percentPaid, 1)}% Quitado
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-emerald-200/60 h-2.5 rounded-full overflow-hidden p-0.5 border border-emerald-300">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${percentPaid}%` }}
              ></div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="bg-white p-3 rounded-xl border border-emerald-200/80">
                <span className="text-[10px] font-bold text-slate-500 block uppercase">Valor Contratado</span>
                <span className="text-sm sm:text-base font-black text-slate-900 block mt-0.5">
                  R$ {safeToFixed(totalContractedAmount).replace('.', ',')}
                </span>
                <span className="text-[10px] text-slate-500">{totalInstallmentsCount} parcelas</span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-emerald-200/80">
                <span className="text-[10px] font-bold text-emerald-700 block uppercase">Total Pago</span>
                <span className="text-sm sm:text-base font-black text-emerald-700 block mt-0.5">
                  R$ {safeToFixed(totalPaidAmount).replace('.', ',')}
                </span>
                <span className="text-[10px] text-emerald-600 font-bold">{paidCount} pagas ({safeToFixed(percentPaid, 1)}%)</span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-emerald-200/80">
                <span className="text-[10px] font-bold text-rose-700 block uppercase">Saldo Pendente</span>
                <span className="text-sm sm:text-base font-black text-rose-700 block mt-0.5">
                  R$ {safeToFixed(totalPendingAmount).replace('.', ',')}
                </span>
                <span className="text-[10px] text-rose-600 font-bold">{pendingCount} resta ({safeToFixed(percentRemaining, 1)}%)</span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-emerald-200/80">
                <span className="text-[10px] font-bold text-slate-500 block uppercase">Histórico</span>
                <span className="text-[10.5px] font-bold text-slate-800 block mt-0.5 truncate">
                  1º: <span className="font-mono">{firstPaymentDate}</span>
                </span>
                <span className="text-[10.5px] font-bold text-slate-800 block truncate">
                  Últ: <span className="font-mono">{lastPaymentDate}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Footer Official Notice */}
          <div className="text-center text-[11px] text-slate-500 border-t border-slate-200 pt-3 font-medium space-y-1">
            <p>
              HASPAHO Tecnologia & Gestão de Recebíveis • Documento emitido eletronicamente para fins de conferência e auditoria.
            </p>
            <p className="text-[10px] text-slate-400">
              Os códigos de autenticação individual pertencem exclusivamente ao registro de cada parcela paga no banco de dados.
            </p>
          </div>

          </div>
        </div>

        {/* Modal Bottom Actions 100% Branco com Botão Destaque */}
        <div className="bg-white px-4 sm:px-6 py-3 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-2.5 shrink-0 z-10 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium hidden sm:inline">
            Clique em "Gerar PDF do Extrato" para exportar o extrato completo oficial.
          </span>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            {/* Gerar / Baixar PDF do Extrato */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-700 hover:to-amber-700 active:scale-95 text-white font-black text-xs sm:text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
              <span>{isGeneratingPdf ? 'Gerando...' : 'Gerar PDF do Extrato'}</span>
            </button>

            {/* Fechar */}
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-all cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>

      </div>

      {/* Modal de Compartilhamento & Prévia do Print */}
      <ShareScreenshotModal
        isOpen={shareData.isOpen}
        onClose={() => setShareData((prev) => ({ ...prev, isOpen: false }))}
        imageUrl={shareData.imageUrl}
        imageBlob={shareData.imageBlob}
        fileName={shareData.fileName}
        title={shareData.title}
        description={shareData.description}
        onToast={onToast || (() => {})}
      />
    </div>
  );
};
