import jsPDF from 'jspdf';
import { generateHaspahoFullHeaderPngDataUrl, generateHaspahoWatermarkDataUrl } from './logoPdfHelper';
import { generatePixQrCodeDataUrl } from './pixQrCodeHelper';
import { valorPorExtenso } from './numberToWordsPtBr';
import { triggerUniversalFileDownload } from './receiptTxtHelper';
import { Debtor, Installment, Purchase } from '../types';
import { safeToFixed } from './numberUtils';

export interface IndividualReceiptData {
  payerName: string;
  payerPhone?: string;
  payerCpf?: string;
  creditorName?: string;
  creditorCompany?: string;
  creditorPix?: string;
  creditorPhone?: string;
  creditorLocation?: string;
  productName: string;
  installmentNumber: number;
  totalInstallments: number;
  amount: number | string;
  paymentDate: string;
  paymentMethod?: string;
  authCode: string;
}

/**
 * Dispara o download direto do PDF oficial do Recibo Individual de Quitação da Parcela.
 * "O recibo ele é individual. Quando é algo total, aí não estamos falando de recibo, estamos falando de extrato."
 */
export async function downloadIndividualReceiptPdf(data: IndividualReceiptData): Promise<void> {
  const numericAmount = typeof data.amount === 'number'
    ? data.amount
    : parseFloat(String(data.amount).replace('R$', '').replace(/\s+/g, '').replace(/\./g, '').replace(',', '.')) || 0;

  const formattedAmount = `R$ ${numericAmount.toFixed(2).replace('.', ',')}`;
  const amountInWords = valorPorExtenso(numericAmount);

  const safePayer = (data.payerName || 'Pagador').trim().replace(/[^a-zA-Z0-9]/g, '_');
  const safeProduct = (data.productName || 'Produto').trim().replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `recibo_${safePayer}_${safeProduct}_parc_${data.installmentNumber}_de_${data.totalInstallments}.pdf`;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

  const creditorName = data.creditorName || 'Tiago Dias';
  const creditorCompany = data.creditorCompany || 'HASPAHO Tecnologia da Informação';
  const creditorPix = data.creditorPix || '(14) 99733-9863';
  const creditorLocation = data.creditorLocation || 'Mineiros do Tietê - SP';

  // 1. Marca d'água central de alta segurança
  try {
    const watermarkDataUrl = await generateHaspahoWatermarkDataUrl();
    if (watermarkDataUrl) {
      const wmW = 135;
      const wmH = 154;
      const wmX = (210 - wmW) / 2;
      const wmY = (297 - wmH) / 2;
      doc.addImage(watermarkDataUrl, 'PNG', wmX, wmY, wmW, wmH, undefined, 'FAST');
    }
  } catch (e) {
    console.warn('Watermark generation error:', e);
  }

  // 2. Banner oficial do cabeçalho
  let y = 10;
  try {
    const fullHeaderDataUrl = await generateHaspahoFullHeaderPngDataUrl();
    if (fullHeaderDataUrl) {
      const imgProps = doc.getImageProperties(fullHeaderDataUrl);
      const bannerWidth = 120;
      const bannerHeight = (imgProps.height * bannerWidth) / imgProps.width;
      const bannerX = (210 - bannerWidth) / 2;
      doc.addImage(fullHeaderDataUrl, 'PNG', bannerX, y, bannerWidth, bannerHeight, undefined, 'FAST');
      y += bannerHeight + 5;
    } else {
      y = 38;
    }
  } catch (e) {
    console.warn('Header banner error:', e);
    y = 38;
  }

  // 3. Título do Documento: RECIBO DE PAGAMENTO INDIVIDUAL
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('RECIBO DE PAGAMENTO INDIVIDUAL', 15, y);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(
    `COMPROVANTE INDIVIDUAL DA PARCELA • LEI FEDERAL Nº 14.063/2020 E ART. 320 DO CÓDIGO CIVIL`,
    15,
    y + 4.5
  );

  y += 9;

  // 4. Box de Autenticação Digital em Destaque
  doc.setFillColor(240, 253, 244); // emerald-50
  doc.setDrawColor(167, 243, 208); // emerald-200
  doc.setLineWidth(0.3);
  doc.roundedRect(15, y, 180, 14, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(6, 95, 70); // emerald-800
  doc.text('CÓDIGO DE AUTENTICAÇÃO DIGITAL (REGISTRO OFICIAL):', 19, y + 5);

  doc.setFont('courier', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(data.authCode, 19, y + 10.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(5, 150, 105);
  doc.text('SITUAÇÃO: AUTÊNTICO E LIQUIDADO', 135, y + 10.5);

  y += 18;

  // 5. Bloco 1: QUALIFICAÇÃO DAS PARTES
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(15, y, 180, 28, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text('1. QUALIFICAÇÃO DAS PARTES:', 19, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('CREDOR / TITULAR:', 19, y + 12);
  doc.setFont('helvetica', 'normal');
  doc.text(`${creditorName} • ${creditorCompany} (${creditorLocation})`, 54, y + 12);
  doc.text(`Chave PIX Oficial: ${creditorPix}`, 54, y + 16.5);

  doc.setFont('helvetica', 'bold');
  doc.text('PAGADOR(A) / DEVEDOR(A):', 19, y + 22);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.payerName}${data.payerPhone ? ` • Contato: ${data.payerPhone}` : ''}${data.payerCpf ? ` • CPF: ${data.payerCpf}` : ''}`, 65, y + 22);

  y += 33;

  // 6. Bloco 2: DISCRIMINAÇÃO DA PARCELA INDIVIDUAL
  doc.setFillColor(240, 253, 244); // light green
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(15, y, 180, 36, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(22, 101, 52); // emerald-800
  doc.text('2. DISCRIMINAÇÃO DA PARCELA QUITADA:', 19, y + 6);

  // Detalhes da Parcela em Duas Colunas
  doc.setFontSize(7.8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Parcela Identificada:`, 19, y + 12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`Parcela ${data.installmentNumber} de ${data.totalInstallments} (${data.installmentNumber}ª Parcela)`, 55, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Produto / Referência:`, 19, y + 17);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${data.productName}`, 55, y + 17);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Data do Pagamento:`, 19, y + 22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${data.paymentDate} • Forma: ${data.paymentMethod || 'PIX / Asaas'}`, 55, y + 22);

  // Valor com destaque visual amplo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(5, 150, 105); // emerald-600
  doc.text(`VALOR RECEBIDO: ${formattedAmount}`, 19, y + 30);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(71, 85, 105);
  doc.text(`("${amountInWords}")`, 19, y + 34.5);

  // Carimbo Redondo Oficial PAGO no PDF
  const stampX = 168;
  const stampY = y + 20;
  doc.setDrawColor(5, 150, 105);
  doc.setLineWidth(0.8);
  doc.circle(stampX, stampY, 12, 'D');
  doc.setLineWidth(0.3);
  doc.circle(stampX, stampY, 10.5, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5);
  doc.setTextColor(6, 95, 70);
  doc.text('★ QUITADO ★', stampX, stampY - 6.5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(5, 150, 105);
  doc.text('PAGO', stampX, stampY + 1.5, { align: 'center' });

  doc.setFontSize(4.5);
  doc.setTextColor(6, 95, 70);
  doc.text('100% LIQUIDADO', stampX, stampY + 6.5, { align: 'center' });

  y += 41;

  // 7. Bloco 3: DECLARAÇÃO FORMAL DE QUITAÇÃO INDIVIDUAL (Art. 320 do Código Civil)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(15, y, 180, 32, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text('3. DECLARAÇÃO DE QUITAÇÃO INDIVIDUAL (ART. 320 DO CÓDIGO CIVIL):', 19, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(71, 85, 105);
  const declarationText = `Declaramos para os devidos fins de direito que recebemos do(a) pagador(a) qualificado(a) neste recibo a importância de ${formattedAmount} (${amountInWords}), correspondente exclusivamente à quitação da PARCELA ${data.installmentNumber} de ${data.totalInstallments} referente a "${data.productName}". Damos plena, geral e irrevogável quitação única e especificamente quanto a esta parcela individual ora liquidada, servindo o presente recibo como comprovante legal e intransferível.`;
  const splitDeclaration = doc.splitTextToSize(declarationText, 172);
  doc.text(splitDeclaration, 19, y + 12);

  y += 37;

  // 8. Bloco 4: PAGAMENTOS FUTUROS & QR CODE PIX
  doc.setFillColor(250, 250, 250);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(15, y, 180, 36, 2, 2, 'FD');

  try {
    const pixQrDataUrl = await generatePixQrCodeDataUrl(creditorPix, numericAmount, creditorName);
    if (pixQrDataUrl) {
      doc.addImage(pixQrDataUrl, 'PNG', 18, y + 2, 32, 32, undefined, 'FAST');
    }
  } catch (err) {
    console.warn('QR Code generation error in individual receipt:', err);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('DADOS OFICIAIS PARA LIQUIDAÇÃO DE PARCELAS VIA PIX:', 54, y + 8);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Chave PIX Oficial (Telefone Celular): ${creditorPix}`, 54, y + 14);
  doc.text(`Titular: ${creditorName} • ${creditorCompany}`, 54, y + 19);
  doc.text(`Município: Mineiros do Tietê - SP`, 54, y + 24);
  doc.text(`Instrução: Escaneie o QR Code acima com o app do seu banco ou use a chave Pix.`, 54, y + 29);

  // 9. Rodapé Jurídico Oficial
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Documento emitido eletronicamente por HASPAHO TI • Válido como recibo individual nos termos do Art. 320 do Código Civil`,
    105,
    286,
    { align: 'center' }
  );

  // Trigger download via universal file download handler
  try {
    const pdfBlob = doc.output('blob');
    await triggerUniversalFileDownload(pdfBlob, filename);
  } catch {
    doc.save(filename);
  }
}

/**
 * Gera e baixa diretamente o PDF oficial do Extrato Total Consolidado de Parcelas (A4).
 */
export async function downloadStatementPdfDirect(
  debtor: Debtor,
  installments: Installment[],
  purchase?: Purchase
): Promise<void> {
  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  const documentId = `EXT-2026-${randomSuffix}`;
  const now = new Date();
  const issueTimestamp = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

  const sortedInstallments = [...installments].sort(
    (a, b) => (Number(a.installmentNumber) || 1) - (Number(b.installmentNumber) || 1)
  );

  const totalInstallmentsCount = sortedInstallments.length || purchase?.installmentsTotal || 1;
  const paidInstallments = sortedInstallments.filter((i) => i.status === 'paid');
  const pendingInstallments = sortedInstallments.filter((i) => i.status !== 'paid');
  const paidCount = paidInstallments.length;
  const pendingCount = pendingInstallments.length;

  const totalContractedAmount =
    purchase?.totalAmount ||
    sortedInstallments.reduce((acc, curr) => acc + (curr.originalAmount || curr.amount || 0), 0) ||
    debtor.totalOwed ||
    0;

  const totalPaidAmount = sortedInstallments.reduce((acc, curr) => {
    if (curr.status === 'paid') {
      return acc + (curr.paidAmount ?? curr.amount ?? curr.originalAmount ?? 0);
    }
    return acc;
  }, 0);

  const totalPendingAmount = sortedInstallments.reduce((acc, curr) => {
    if (curr.status !== 'paid') {
      return acc + (curr.amount || curr.originalAmount || 0);
    }
    return acc;
  }, 0);

  const percentPaid = totalInstallmentsCount > 0 ? (paidCount / totalInstallmentsCount) * 100 : 0;
  const percentRemaining = Math.max(0, 100 - percentPaid);

  const debtorName = debtor?.name || sortedInstallments[0]?.debtorName || 'Cliente';
  const debtorDocument = debtor?.cpfCnpj || debtor?.documentNumber || 'Não informado';
  const debtorPhone = debtor?.phone || 'Não informado';
  const productName = purchase?.product || sortedInstallments[0]?.product || 'Parcelamento Consolidado';
  const storeName = purchase?.store || 'Loja Parceira / Online';
  const cardName = purchase?.cardName || sortedInstallments[0]?.cardName || 'PIX / Cartão';

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;

  let logoDataUrl = '';
  let watermarkDataUrl = '';
  try {
    [logoDataUrl, watermarkDataUrl] = await Promise.all([
      generateHaspahoFullHeaderPngDataUrl(),
      generateHaspahoWatermarkDataUrl(),
    ]);
  } catch (err) {
    console.warn('Erro ao gerar imagens para PDF de extrato:', err);
  }

  let y = 10;
  let currentPage = 1;

  const addDocumentHeader = (pageNum: number) => {
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

    doc.setFillColor(15, 23, 42);
    doc.rect(marginX, bannerBottom, contentWidth, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('EXTRATO TOTAL DO PARCELAMENTO • HISTÓRICO INTEGRAL', pageWidth / 2, bannerBottom + 5.5, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`Identificador: ${documentId} • Emitido em: ${issueTimestamp} • Pág. ${pageNum}`, pageWidth / 2, bannerBottom + 9.5, { align: 'center' });
  };

  addDocumentHeader(currentPage);
  y = 66;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(marginX, y, contentWidth, 30, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`DEVEDOR / CONTRATANTE: ${debtorName.toUpperCase()}`, marginX + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`CPF/CNPJ: ${debtorDocument}  |  Tel/WhatsApp: ${debtorPhone}`, marginX + 4, y + 12);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`PRODUTO / OPERAÇÃO: ${productName}`, marginX + 4, y + 19);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Loja/Origem: ${storeName}  |  Forma: ${cardName}`, marginX + 4, y + 25);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52);
  doc.text(
    `VALOR TOTAL LIQUIDADO: R$ ${safeToFixed(totalPaidAmount).replace('.', ',')} (${paidCount}/${totalInstallmentsCount} pagas)`,
    marginX + 90,
    25 + y
  );

  y += 35;

  const renderTableHeader = (currentY: number) => {
    doc.setFillColor(30, 41, 59);
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

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  sortedInstallments.forEach((inst, idx) => {
    if (y > 265) {
      doc.addPage();
      currentPage++;
      addDocumentHeader(currentPage);
      y = 56;
      renderTableHeader(y);
      y += 8;
    }

    if (idx % 2 === 0) {
      doc.setFillColor(241, 245, 249);
      doc.rect(marginX, y, contentWidth, 7, 'F');
    }

    const isPaid = inst.status === 'paid';
    const isOverdue = inst.status === 'overdue' || (inst.status !== 'paid' && (inst.delayDays || 0) > 0);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `${String(inst.installmentNumber || idx + 1).padStart(2, '0')}/${String(inst.totalInstallments || totalInstallmentsCount).padStart(2, '0')}`,
      marginX + 3,
      y + 5
    );

    doc.setFont('helvetica', 'normal');
    doc.text(inst.dueDate || '—', marginX + 22, y + 5);

    doc.setFont('helvetica', 'bold');
    const displayVal = safeToFixed(inst.originalAmount || inst.amount || 0).replace('.', ',');
    doc.text(`R$ ${displayVal}`, marginX + 48, y + 5);

    if (isPaid) {
      doc.setTextColor(22, 101, 52);
      doc.text('PAGO', marginX + 70, y + 5);
    } else if (isOverdue) {
      doc.setTextColor(185, 28, 28);
      doc.text('EM ATRASO', marginX + 70, y + 5);
    } else {
      doc.setTextColor(180, 83, 9);
      doc.text('A VENCER', marginX + 70, y + 5);
    }

    doc.setTextColor(15, 23, 42);
    const paidDateText = isPaid ? (inst.paidAt || inst.dueDate || '—') : '—';
    doc.text(paidDateText, marginX + 96, y + 5);

    const effectiveAuthCode = isPaid
      ? inst.authCode || `EMU${(inst.id || `${inst.installmentNumber}`).replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase()}P${inst.installmentNumber}`
      : null;

    if (isPaid && effectiveAuthCode) {
      doc.setFont('courier', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(6, 95, 70);
      doc.text(effectiveAuthCode, marginX + 126, y + 5);
    } else {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6.2);
      doc.setTextColor(148, 163, 184);
      doc.text('— Pendente de Quitação', marginX + 126, y + 5);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    y += 7;
  });

  y += 6;
  if (y > 235) {
    doc.addPage();
    currentPage++;
    addDocumentHeader(currentPage);
    y = 56;
  }

  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(marginX, y, contentWidth, 30, 2, 2, 'FD');

  doc.setTextColor(20, 83, 45);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('RESUMO FINANCEIRO DA DÍVIDA CONSOLIDADA', marginX + 4, y + 6);

  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(`Valor Contratado: R$ ${safeToFixed(totalContractedAmount).replace('.', ',')}`, marginX + 4, y + 13);
  doc.text(`Total Pago: R$ ${safeToFixed(totalPaidAmount).replace('.', ',')} (${safeToFixed(percentPaid, 1)}%)`, marginX + 68, y + 13);
  doc.text(`Saldo Pendente: R$ ${safeToFixed(totalPendingAmount).replace('.', ',')} (${safeToFixed(percentRemaining, 1)}%)`, marginX + 130, y + 13);
  doc.text(`Parcelas Quitadas: ${paidCount} de ${totalInstallmentsCount}`, marginX + 4, y + 21);
  doc.text(`Parcelas a Vencer: ${pendingCount}`, marginX + 68, y + 21);
  doc.text(`Chave PIX Oficial: (14) 99733-9863`, marginX + 130, y + 21);

  const safePayer = debtorName.trim().replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Extrato_Total_${safePayer}_${documentId}.pdf`;

  try {
    const pdfBlob = doc.output('blob');
    await triggerUniversalFileDownload(pdfBlob, filename);
  } catch {
    doc.save(filename);
  }
}

