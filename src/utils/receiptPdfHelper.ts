import jsPDF from 'jspdf';
import { generateHaspahoFullHeaderPngDataUrl, generateHaspahoWatermarkDataUrl } from './logoPdfHelper';
import { generatePixQrCodeDataUrl } from './pixQrCodeHelper';
import { valorPorExtenso } from './numberToWordsPtBr';

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
  doc.roundedRect(15, y, 180, 26, 2, 2, 'FD');

  try {
    const pixQrDataUrl = await generatePixQrCodeDataUrl(creditorPix, numericAmount, creditorName);
    if (pixQrDataUrl) {
      doc.addImage(pixQrDataUrl, 'PNG', 19, y + 3, 20, 20, undefined, 'FAST');
    }
  } catch (err) {
    console.warn('QR Code generation error in individual receipt:', err);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(15, 23, 42);
  doc.text('DADOS OFICIAIS PARA LIQUIDAÇÃO DE PARCELAS:', 44, y + 7);

  doc.setFontSize(7.2);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Chave PIX Oficial: ${creditorPix}`, 44, y + 12);
  doc.text(`Titular: ${creditorName} • ${creditorCompany}`, 44, y + 16.5);
  doc.text(`Identificação: Quitação de Recebíveis HASPAHO`, 44, y + 21);

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

  // Trigger download as blob
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
}
