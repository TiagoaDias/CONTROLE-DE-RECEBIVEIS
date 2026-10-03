import React, { useRef, useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import { Debtor, Installment, Purchase } from '../types';
import { valorPorExtenso } from '../utils/numberToWordsPtBr';
import { HaspahoLogo } from './HaspahoLogo';
import { generateHaspahoLogoPngDataUrl, generateHaspahoFullHeaderPngDataUrl, generateHaspahoWatermarkDataUrl } from '../utils/logoPdfHelper';
import { printHtmlContent } from '../utils/printHelper';
import { capturePanelScreenshot } from '../utils/screenshotHelper';
import { ShareScreenshotModal } from './ShareScreenshotModal';

interface DigitalContractModalProps {
  isOpen: boolean;
  debtor: Debtor | null;
  purchases: Purchase[];
  installments: Installment[];
  onClose: () => void;
  onSignContract: (debtorId: string, signatureUrl: string, signDate: string) => void;
  onToast: (msg: string) => void;
  onOpenGeminiScanner?: () => void;
  onUpdateDebtorData?: (debtorId: string, updatedData: Partial<Debtor>) => void;
}

export const DigitalContractModal: React.FC<DigitalContractModalProps> = ({
  isOpen,
  debtor,
  purchases,
  installments,
  onClose,
  onSignContract,
  onToast,
  onOpenGeminiScanner,
  onUpdateDebtorData,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contractContentRef = useRef<HTMLDivElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [signerDocument, setSignerDocument] = useState('');
  const [authHash, setAuthHash] = useState('');
  const [signDateStr, setSignDateStr] = useState('');

  // Modo Edição / Pré-Preenchimento
  const [isPreFillMode, setIsPreFillMode] = useState(false);
  const [customProduct, setCustomProduct] = useState('');

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
  const [customStore, setCustomStore] = useState('Loja / Estabelecimento Comercial');
  const [customPurchaseDate, setCustomPurchaseDate] = useState('');
  const [customTotalAmount, setCustomTotalAmount] = useState<number>(0);
  const [customInstallmentsCount, setCustomInstallmentsCount] = useState<number>(10);
  const [customOverdueCount, setCustomOverdueCount] = useState<number>(0);
  const [customOverdueAmount, setCustomOverdueAmount] = useState<number>(0);
  const [customCardName, setCustomCardName] = useState('Cartão de Crédito Próprio');
  const [isManualCard, setIsManualCard] = useState<boolean>(false);
  const [manualCardInput, setManualCardInput] = useState<string>('');
  const [customRelation, setCustomRelation] = useState('');
  const [customPhone, setCustomPhone] = useState('');

  // Sincronizar dados do devedor ao abrir
  useEffect(() => {
    if (debtor) {
      setSignerName(debtor.name || '');
      setSignerDocument(debtor.documentNumber || '');
      setCustomRelation(debtor.relation || 'Amigo(a)');
      setCustomPhone(debtor.phone || '');

      const now = new Date();
      const dateFormatted = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}`;
      setSignDateStr(dateFormatted);
      
      const todayStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
      setCustomPurchaseDate(todayStr);

      // Gerar hash aleatório determinístico para o documento se não existir
      const cleanId = (debtor.id + debtor.name).replace(/\s+/g, '').toUpperCase();
      const generatedHash = debtor.contractHash || `BR-REST-${cleanId.slice(0, 4)}-${Math.floor(100000 + Math.random() * 900000)}-${now.getFullYear()}`;
      setAuthHash(generatedHash);

      // Obter compras do devedor
      const debtorPurchases = purchases.filter((p) => p.debtorId === debtor.id);
      if (debtorPurchases.length > 0) {
        const firstP = debtorPurchases[0];
        setCustomProduct(firstP.product);
        setCustomStore(firstP.store || 'Estabelecimento Comercial');
        setCustomCardName(firstP.cardName || 'Nubank Croma');
        setCustomTotalAmount(firstP.totalAmount);
        setCustomInstallmentsCount(firstP.installmentsTotal);
      } else {
        setCustomProduct('Aquisição de Bem / Produto para Restituição');
        setCustomStore('Estabelecimento Comercial');
        setCustomTotalAmount(debtor.totalOwed > 0 ? debtor.totalOwed : 1800.0);
        setCustomInstallmentsCount(10);
      }

      if (debtor.contractSigned && debtor.contractSignatureUrl) {
        setHasSignature(true);
      } else {
        setHasSignature(false);
      }
    }
  }, [debtor, isOpen]);

  // Se já houver assinatura prévia, carrega no canvas
  useEffect(() => {
    if (isOpen && debtor?.contractSignatureUrl && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
        };
        img.src = debtor.contractSignatureUrl;
      }
    }
  }, [isOpen, debtor]);

  // Atualizar saldo devedor em atraso automaticamente
  useEffect(() => {
    if (customTotalAmount > 0 && customInstallmentsCount > 0 && customOverdueCount >= 0) {
      const installmentValue = customTotalAmount / customInstallmentsCount;
      const calculated = installmentValue * customOverdueCount;
      setCustomOverdueAmount(Math.round(calculated * 100) / 100);
    }
  }, [customOverdueCount, customTotalAmount, customInstallmentsCount]);

  if (!isOpen || !debtor) return null;

  // Filtrar compras e parcelas vinculadas a este devedor
  const debtorInstallments = installments.filter((i) => i.debtorId === debtor.id);

  // Valores calculados considerando edições do modo pré-preenchido
  const activeTotalDebt = isPreFillMode && customTotalAmount > 0
    ? customTotalAmount
    : debtor.totalOwed > 0
    ? debtor.totalOwed
    : debtorInstallments.reduce((acc, i) => acc + (i.status !== 'paid' ? i.amount : 0), customTotalAmount || 1800);

  const valorExtenso = valorPorExtenso(activeTotalDebt);
  const activeProduct = customProduct || 'Aquisição de Bem / Produto para Restituição';
  const activeInstallmentsCount = customInstallmentsCount || 10;
  const activeInstallmentValue = activeTotalDebt / activeInstallmentsCount;

  // Manipulação de desenho no Canvas
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null);

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(e);
    setIsDrawing(true);
    setLastPoint(point);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !lastPoint) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentPoint = getCanvasPoint(e);

    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';

    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(currentPoint.x, currentPoint.y);
    ctx.stroke();

    setLastPoint(currentPoint);
    setHasSignature(true);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDrawing(false);
    setLastPoint(null);
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
  };

  const generateCursiveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.font = 'italic 34px "Brush Script MT", "Caveat", "Dancing Script", "Segoe Script", cursive';
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const nameToDraw = signerName.trim() || debtor.name;
    ctx.fillText(nameToDraw, canvas.width / 2, canvas.height / 2 - 8);

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#0f172a';
    ctx.beginPath();
    const startX = Math.max(30, canvas.width / 2 - 130);
    const endX = Math.min(canvas.width - 30, canvas.width / 2 + 130);
    const y = canvas.height / 2 + 18;
    ctx.moveTo(startX, y);
    ctx.bezierCurveTo(startX + 80, y - 8, endX - 80, y + 10, endX, y);
    ctx.stroke();

    setHasSignature(true);
    onToast('Rubrica cursiva gerada com sucesso! Você também pode assinar manualmente.');
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSaveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!hasSignature) {
      onToast('Por favor, assine no campo indicado antes de salvar!');
      return;
    }

    const dataUrl = canvas.toDataURL('image/png');
    onSignContract(debtor.id, dataUrl, signDateStr);

    if (onUpdateDebtorData) {
      onUpdateDebtorData(debtor.id, {
        name: signerName,
        documentNumber: signerDocument,
        phone: customPhone,
        relation: customRelation,
        contractHash: authHash,
        contractPreFilled: isPreFillMode,
      });
    }

    onToast(`Instrumento de restituição de ${signerName || debtor.name} assinado e autenticado com sucesso!`);
    onClose();
  };

  // Gerar PDF oficial do Instrumento de Restituição com Marca d'Água A4
  const handleDownloadContractPdf = async () => {
    try {
      onToast('Gerando PDF oficial do Instrumento de Restituição com Marca d\'Água A4...');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const pageWidth = 210;
      const pageHeight = 297;
      
      // 0. Incorporar MARCA D'ÁGUA INSTITUCIONAL TAMANHO A4 CENTRALIZADA
      try {
        const watermarkDataUrl = await generateHaspahoWatermarkDataUrl();
        if (watermarkDataUrl) {
          const wmW = 135;
          const wmH = 154;
          const wmX = (pageWidth - wmW) / 2;
          const wmY = (pageHeight - wmH) / 2;
          doc.addImage(watermarkDataUrl, 'PNG', wmX, wmY, wmW, wmH, undefined, 'FAST');
        }
      } catch (wmErr) {
        console.warn('Erro ao carregar marca d\'água no PDF:', wmErr);
      }

      // 1. Incorporar CABEÇALHO OFICIAL COMPLETO HASPAHO (Logo + Tipografia + Selo Verificado em Cartão Padrão)
      let y = 8;
      try {
        const fullHeaderDataUrl = await generateHaspahoFullHeaderPngDataUrl();
        if (fullHeaderDataUrl) {
          const imgProps = doc.getImageProperties(fullHeaderDataUrl);
          const bannerWidth = 118; // Large and clear on the 210mm page
          const bannerHeight = (imgProps.height * bannerWidth) / imgProps.width; // 100% natural aspect ratio
          const bannerX = (pageWidth - bannerWidth) / 2; // Centered
          doc.addImage(fullHeaderDataUrl, 'PNG', bannerX, y, bannerWidth, bannerHeight, undefined, 'FAST');
          y += bannerHeight + 4;
        } else {
          const logoDataUrl = await generateHaspahoLogoPngDataUrl();
          doc.addImage(logoDataUrl, 'PNG', 65, 7, 80, 28, undefined, 'FAST');
          y = 38;
        }
      } catch (logoErr) {
        console.warn('Erro ao carregar logo no PDF:', logoErr);
        y = 38;
      }

      // 2. Banner de Identificação Oficial do Contrato
      doc.setFillColor(15, 23, 42); // Dark slate
      doc.roundedRect(15, y, 180, 13, 1.5, 1.5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('INSTRUMENTO PARTICULAR DE RECONHECIMENTO DE OBRIGAÇÃO DE RESTITUIÇÃO E REPASSE ENTRE PARTICULARES', 105, y + 5.5, { align: 'center' });
      doc.setFontSize(6.8);
      doc.setFont('helvetica', 'normal');
      doc.text(`OPERAÇÃO DE AUXÍLIO SEM FINALIDADE LUCRATIVA • CHAVE DIGITAL: ${authHash}`, 105, y + 10, { align: 'center' });

      // 3. Título Principal
      y += 18;
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text('TERMO DE AUXÍLIO DIRETO E COMPROMISSO DE RESTITUIÇÃO INTEGRAL', 15, y);

      // 4. Qualificação das Partes
      y += 6;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(15, y, 180, 24, 1.5, 1.5, 'FD');

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('1. QUALIFICAÇÃO DAS PARTES CONTRATANTES:', 18, y + 4.5);

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('DECLARANTE / FACILITADOR DO DESEMBOLSO: Tiago Dias • HASPAHO Tecnologia (Mineiros do Tietê - SP)', 18, y + 9);
      doc.text(`BENEFICIÁRIO(A) / PARTE RESTITUINTE: ${signerName || debtor.name} • Contato: ${customPhone || debtor.phone || 'Não informado'}`, 18, y + 13.5);
      doc.text(`DOCUMENTO / CPF: ${signerDocument || 'Preenchido no termo'} • VÍNCULO DECLARADO: ${customRelation || debtor.relation || 'Particular'}`, 18, y + 18);
      doc.text(`MEIO DO DESEMBOLSO: ${customCardName} • CHAVE PIX OFICIAL DE RESTITUIÇÃO: (14) 99733-9863`, 18, y + 22);

      // 5. Quadro de Discriminação Financeira Estrita (Transparência Total)
      y += 28;
      doc.setFillColor(240, 253, 244);
      doc.setDrawColor(187, 247, 208);
      doc.roundedRect(15, y, 180, 30, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(22, 101, 52);
      doc.text('2. DISCRIMINAÇÃO ECONÔMICA E AUSÊNCIA DE REMUNERAÇÃO:', 18, y + 5);

      doc.setFontSize(7);
      doc.setTextColor(15, 23, 42);
      doc.text(`VALOR EFETIVAMENTE DESEMBOLSADO: R$ ${activeTotalDebt.toFixed(2).replace('.', ',')}`, 18, y + 10.5);
      doc.text(`VALOR TOTAL A RESTITUIR: R$ ${activeTotalDebt.toFixed(2).replace('.', ',')}`, 105, y + 10.5);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(5, 150, 105);
      doc.text(`REMUNERAÇÃO PELO AUXÍLIO: R$ 0,00`, 18, y + 15.5);
      doc.text(`COMISSÃO: R$ 0,00`, 75, y + 15.5);
      doc.text(`TAXA ADMINISTRATIVA: R$ 0,00`, 125, y + 15.5);

      doc.text(`JUROS REMUNERATÓRIOS: R$ 0,00`, 18, y + 20.5);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'normal');
      doc.text(`PLANO DE RESTITUIÇÃO: ${activeInstallmentsCount} parcelas de R$ ${activeInstallmentValue.toFixed(2).replace('.', ',')} (Soma exata do valor desembolsado)`, 18, y + 25.5);

      // 6. Descrição da Operação
      y += 34;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text('3. DETALHAMENTO DO REPASSE / BEM OBJETO DO AUXÍLIO:', 15, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text(`Item / Objeto: ${activeProduct} • Estabelecimento: ${customStore} • Data da Operação: ${customPurchaseDate}`, 15, y + 4.5);
      doc.text(`Valor por Extenso: "${valorExtenso}"`, 15, y + 9);

      if (customOverdueCount > 0) {
        doc.setTextColor(185, 28, 28);
        doc.setFont('helvetica', 'bold');
        doc.text(`Registro de Ocorrência: ${customOverdueCount} parcela(s) atualmente vencida(s) aguardando restituição.`, 15, y + 13.5);
        y += 4.5;
      }

      // 7. Cláusulas Jurídicas Neutras e Verdadeiras
      y += 14;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text('4. CLÁUSULAS E BASES LEGAIS DO INSTRUMENTO:', 15, y);

      const clauses = [
        'CLÁUSULA PRIMEIRA (Do Objeto e da Finalidade de Auxílio): O presente instrumento formaliza o repasse de valores e/ou aquisição de bem realizada pelo DECLARANTE em benefício do(a) RESTITUINTE, a título de auxílio particular, assumindo este(a) a obrigação de restituição integral e sem qualquer acréscimo a título de juros remuneratórios, taxas de intermediação, comissões ou remuneração.',
        `CLÁUSULA SEGUNDA (Do Cronograma e Meio de Restituição): A restituição do valor total desembolsado ocorrerá de forma parcelada, em ${activeInstallmentsCount} parcelas mensais e sucessivas de R$ ${activeInstallmentValue.toFixed(2).replace('.', ',')} cada, com vencimentos nas datas pactuadas, preferencialmente via chave PIX oficial: (14) 99733-9863 (Tiago Dias).`,
        'CLÁUSULA TERCEIRA (Da Ausência de Lucro ou Remuneração): As partes declaram e reconhecem expressamente que a operação não possui qualquer finalidade lucrativa ou mercantil, consistindo em repasse entre particulares, registrando-se remuneração de R$ 0,00, taxa administrativa de R$ 0,00, comissão de R$ 0,00 e juros remuneratórios de R$ 0,00.',
        'CLÁUSULA QUARTA (Do Registro de Atraso e Mora): Em caso de atraso na restituição de qualquer parcela, o sistema registrará a parcela vencida, data do vencimento, data do efetivo pagamento e a quantidade de dias em atraso. Eventuais encargos decorrentes da mora serão observados estritamente conforme a legislação civil brasileira aplicável (Código Civil - Lei nº 10.406/2002 e Lei nº 14.905/2024), não havendo cobrança de taxas arbitrárias.',
        'CLÁUSULA QUINTA (Da Validade da Assinatura e Autenticação Eletrônica): As partes reconhecem a plena validade jurídica, integridade e autenticidade da assinatura digital e dos registros eletrônicos constantes neste instrumento, nos termos do Art. 10, § 2º da Medida Provisória nº 2.200-2/2001 e da Lei Federal nº 14.063/2020.'
      ];

      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(51, 65, 85);

      clauses.forEach((c) => {
        const splitText = doc.splitTextToSize(c, 180);
        doc.text(splitText, 15, y);
        y += splitText.length * 3.4 + 2;
      });

      // 8. Assinaturas
      y += 6;
      if (debtor.contractSignatureUrl) {
        try {
          doc.addImage(debtor.contractSignatureUrl, 'PNG', 15, y - 10, 45, 10, undefined, 'FAST');
        } catch { /* ignore */ }
      }

      doc.setDrawColor(148, 163, 184);
      doc.line(15, y, 95, y);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(15, 23, 42);
      doc.text(signerName || debtor.name, 15, y + 4);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text('Beneficiário(a) / Parte Restituinte', 15, y + 7.5);

      doc.line(115, y, 195, y);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(15, 23, 42);
      doc.text('Tiago Dias (HASPAHO TI)', 115, y + 4);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text('Declarante / Facilitador do Desembolso', 115, y + 7.5);

      // 9. Protocolo SHA-256 e Nota Orientativa
      y += 12;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(15, y, 180, 12, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(71, 85, 105);
      doc.text('PROTOCOLO DIGITAL DE AUTENTICAÇÃO (SHA-256):', 18, y + 4);

      doc.setFont('courier', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(30, 58, 138);
      doc.text(authHash, 18, y + 8.5);

      // Rodapé Regulatório
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(148, 163, 184);
      doc.text(
        'Nota Informativa: Instrumento destinado ao registro de auxílio entre particulares sem finalidade lucrativa. Operações exercidas com habitualidade ou finalidade mercantil demandam análise jurídica especializada.',
        105,
        288,
        { align: 'center' }
      );

      const filename = `instrumento_restituicao_${(signerName || debtor.name).replace(/\s+/g, '_')}_${authHash.slice(0, 8)}.pdf`;
      
      const pdfBlob = doc.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);

      onToast('PDF do instrumento de restituição baixado com sucesso!');
    } catch (err) {
      console.error('Erro ao gerar PDF do contrato:', err);
      onToast('Erro ao gerar PDF. Tente novamente.');
    }
  };

  // Salvar alterações de pré-preenchimento
  const handleSavePreFill = () => {
    if (onUpdateDebtorData) {
      onUpdateDebtorData(debtor.id, {
        name: signerName,
        documentNumber: signerDocument,
        phone: customPhone,
        relation: customRelation,
        contractHash: authHash,
        contractPreFilled: true,
      });
    }
    onToast('Dados do termo salvos com sucesso! O documento foi atualizado.');
    setIsPreFillMode(false);
  };

  // Copiar Link Exclusivo de Assinatura para Smartphone/Tablet
  const handleCopyMobileSignLink = () => {
    const link = `${window.location.origin}/?contract_sign=${debtor.id}&auth=${authHash}`;
    navigator.clipboard?.writeText(link);
    onToast('Link exclusivo de assinatura para celular copiado com sucesso!');
  };

  // Compartilhar no WhatsApp versão PRÉ-PREENCHIDA (sem taxas artificiais)
  const handleShareWhatsAppPreFilled = () => {
    const targetPhone = (customPhone || debtor.phone || '').replace(/\D/g, '');
    const textMsg = encodeURIComponent(
      `📄 *INSTRUMENTO DE RECONHECIMENTO DE OBRIGAÇÃO DE RESTITUIÇÃO E REPASSE*\n\n` +
      `Olá, *${signerName || debtor.name}*!\n` +
      `Para sua conferência e registro formal, segue o documento de restituição do auxílio particular realizado:\n\n` +
      `🛍️ *Objeto:* ${activeProduct}\n` +
      `🏢 *Estabelecimento:* ${customStore}\n` +
      `📅 *Data da Operação:* ${customPurchaseDate}\n` +
      `💳 *Meio de Desembolso:* ${customCardName}\n` +
      `💰 *Valor Efetivamente Desembolsado:* R$ ${activeTotalDebt.toFixed(2).replace('.', ',')}\n` +
      `📝 *Valor por Extenso:* "${valorExtenso}"\n` +
      `🔢 *Condições de Restituição:* ${activeInstallmentsCount} parcelas de R$ ${activeInstallmentValue.toFixed(2).replace('.', ',')}\n` +
      `✅ *Remuneração / Juros / Taxas:* R$ 0,00 (Sem cobrança de acréscimos)\n` +
      `📱 *Chave PIX para Restituição:* (14) 99733-9863\n` +
      `🔐 *Chave de Autenticação Digital:* ${authHash}\n` +
      `🕒 *Registro:* ${signDateStr}\n\n` +
      `Basta conferir os dados e assinar com o dedo na tela para validação.`
    );
    window.open(`https://wa.me/${targetPhone}?text=${textMsg}`, '_blank');
    onToast('Mensagem de restituição gerada para o WhatsApp!');
  };

  // Compartilhar no WhatsApp versão EM BRANCO
  const handleShareWhatsAppBlank = () => {
    const targetPhone = (customPhone || debtor.phone || '').replace(/\D/g, '');
    const textMsg = encodeURIComponent(
      `📄 *TERMO DE COMPROMISSO DE RESTITUIÇÃO E REPASSE ENTRE PARTICULARES*\n\n` +
      `Olá, *${signerName || debtor.name}*!\n` +
      `Segue o link do termo de compromisso de restituição referente ao auxílio particular com a HASPAHO TI / Tiago Dias.\n\n` +
      `Por favor, confira os dados da operação e desenhe sua assinatura digital para formalização do acordo:\n` +
      `🔐 *Chave de Validação:* ${authHash}\n\n` +
      `Após preencher e assinar, envie o documento assinado para arquivamento no sistema.`
    );
    window.open(`https://wa.me/${targetPhone}?text=${textMsg}`, '_blank');
    onToast('Link compartilhado no WhatsApp!');
  };

  // Disparar Impressão Direta / Abrir Diálogo de Impressora
  const handlePrintContract = () => {
    if (!contractContentRef.current) {
      if (typeof window !== 'undefined' && window.print) {
        window.print();
      }
      return;
    }
    printHtmlContent(
      `Contrato_Restituicao_${signerName || 'HASPAHO'}`,
      contractContentRef.current,
      () => {
        handleDownloadContractPdf();
      }
    );
  };

  // Tirar Print e Salvar Imagem em Alta Resolução
  const handleCaptureScreenshot = async () => {
    if (!contractContentRef.current) return;
    try {
      setIsCapturingScreenshot(true);
      onToast('📸 Capturando print do contrato em alta resolução...');
      const fileNameBase = `contrato_${(signerName || debtor?.name || 'haspaho').replace(/\s+/g, '_')}`;
      const res = await capturePanelScreenshot(contractContentRef.current, fileNameBase);

      if (res.success && res.imageUrl) {
        onToast(`✅ Print salvo na pasta Downloads como ${res.fileName}`);
        setShareData({
          isOpen: true,
          imageUrl: res.imageUrl,
          imageBlob: res.imageBlob || null,
          fileName: res.fileName,
          title: `Contrato Digital - ${signerName || debtor?.name || 'HASPAHO'}`,
          description: `Instrumento Particular de Confissão e Restituição • Validação: ${authHash}`,
        });
      } else {
        onToast(res.error || 'Erro ao capturar print do contrato.');
      }
    } catch (err) {
      console.error('Erro ao tirar print:', err);
      onToast('Erro ao capturar print do contrato. Baixe o PDF.');
    } finally {
      setIsCapturingScreenshot(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in my-0">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-3xl w-full shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[88vh] overflow-hidden my-auto border border-slate-200">
        
        {/* 1. Barra Superior Principal com Botão Voltar e Botão Fechar (X) Visíveis */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-slate-200 bg-slate-900 text-white shrink-0">
          {/* Botão Voltar (Mobile & Desktop) */}
          <button
            type="button"
            onClick={onClose}
            className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-white/10"
            title="Voltar / Fechar Janela"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            <span>Voltar</span>
          </button>

          {/* Título Central */}
          <div className="flex items-center gap-2 min-w-0 px-2 text-center">
            <span className="material-symbols-outlined text-indigo-400 text-[20px] hidden sm:inline">history_edu</span>
            <div className="min-w-0">
              <h2 className="font-bold text-white text-xs sm:text-base truncate">
                Instrumento de Restituição Particular
              </h2>
              <span className="text-[10px] text-slate-300 hidden sm:block">
                HASPAHO • Repasse &amp; Auxílio sem juros/taxas
              </span>
            </div>
            {debtor.contractSigned && (
              <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[9.5px] font-black uppercase flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">verified</span>
                Assinado
              </span>
            )}
          </div>

          {/* Botão Fechar (X) em Destaque */}
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/10 hover:bg-red-500/20 hover:text-red-300 text-slate-300 flex items-center justify-center transition-colors cursor-pointer border border-white/10"
            title="Fechar Janela (X)"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* 2. Barra de Ferramentas / Ações Rápidas do Documento */}
        <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar shrink-0">
          <div className="flex items-center gap-1.5">
            {/* Alternador de Modo Pré-Preenchimento */}
            <button
              type="button"
              onClick={() => setIsPreFillMode(!isPreFillMode)}
              className={`h-7 sm:h-8 px-2.5 rounded-lg text-[11px] sm:text-xs font-bold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
                isPreFillMode
                  ? 'bg-amber-500 text-white shadow-xs ring-2 ring-amber-400/30'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">
                {isPreFillMode ? 'edit_note' : 'tune'}
              </span>
              <span>{isPreFillMode ? 'Fechar Edição' : 'Pré-Preencher / Editar'}</span>
            </button>

            {/* Reconhecimento IA */}
            {onOpenGeminiScanner && (
              <button
                type="button"
                onClick={onOpenGeminiScanner}
                className="h-7 sm:h-8 px-2.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-[11px] sm:text-xs font-bold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap active:scale-95"
                title="Escanear e Reconhecer com Inteligência Artificial"
              >
                <span className="material-symbols-outlined text-[15px] text-purple-600">auto_awesome</span>
                <span>Scanner IA</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Tirar Print / Capturar Imagem */}
            <button
              type="button"
              onClick={handleCaptureScreenshot}
              disabled={isCapturingScreenshot}
              title="Tirar print do contrato e salvar imagem em alta resolução"
              className="h-7 sm:h-8 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-[11px] sm:text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs whitespace-nowrap disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[15px]">photo_camera</span>
              <span>{isCapturingScreenshot ? 'Capturando...' : 'Tirar Print'}</span>
            </button>

            {/* Imprimir Direto na Impressora */}
            <button
              type="button"
              onClick={handlePrintContract}
              title="Abrir impressora para imprimir o contrato"
              className="h-7 sm:h-8 px-2.5 rounded-lg bg-slate-700 hover:bg-slate-800 active:scale-95 text-white text-[11px] sm:text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-[15px]">print</span>
              <span>Imprimir</span>
            </button>

            {/* Baixar PDF Oficial */}
            <button
              type="button"
              onClick={handleDownloadContractPdf}
              title="Baixar PDF oficial com marca d'água A4"
              className="h-7 sm:h-8 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-[11px] sm:text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-[15px]">picture_as_pdf</span>
              <span>Baixar PDF (A4)</span>
            </button>
          </div>
        </div>

        {/* Scrollable Document Content com Marca d'Água Sutil Reenquadrado */}
        <div ref={contractContentRef} className="relative overflow-y-auto p-3.5 sm:p-6 space-y-4 text-slate-800 text-xs sm:text-sm font-sans leading-relaxed bg-white">
          <div className="w-full max-w-2xl mx-auto space-y-4">
          {/* Marca d'água oficial HASPAHO A4 translúcida no fundo */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0 opacity-[0.055] select-none">
            <div className="w-[320px] sm:w-[440px] h-[360px] sm:h-[480px] flex items-center justify-center">
              <HaspahoLogo size="2xl" variant="icon" className="scale-[2.6]" />
            </div>
          </div>
          
          {/* Painel do Modo Pré-Preencher */}
          {isPreFillMode && (
            <div className="p-4 bg-gradient-to-br from-amber-50/90 to-indigo-50/70 rounded-2xl border-2 border-amber-300 shadow-sm space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-600 text-[22px]">draw</span>
                  <div>
                    <h3 className="font-extrabold text-amber-950 text-xs sm:text-sm">
                      Modo de Edição / Pré-Preenchimento
                    </h3>
                    <p className="text-[11px] text-amber-900/80">
                      Ajuste os dados da operação de auxílio para visualização no documento.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSavePreFill}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">check</span>
                  <span>Salvar Dados</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Nome do Beneficiário(a)
                  </label>
                  <input
                    type="text"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    CPF / Documento
                  </label>
                  <input
                    type="text"
                    value={signerDocument}
                    onChange={(e) => setSignerDocument(e.target.value)}
                    placeholder="000.000.000-00"
                    className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    WhatsApp
                  </label>
                  <input
                    type="text"
                    value={customPhone}
                    onChange={(e) => setCustomPhone(e.target.value)}
                    className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Tipo de Vínculo
                  </label>
                  <input
                    type="text"
                    value={customRelation}
                    onChange={(e) => setCustomRelation(e.target.value)}
                    placeholder="Ex: Amigo, Família, Colega de Trabalho"
                    className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Objeto do Repasse / Bem
                  </label>
                  <input
                    type="text"
                    value={customProduct}
                    onChange={(e) => setCustomProduct(e.target.value)}
                    placeholder="Ex: Smartphone Galaxy, Notebook, Insumos"
                    className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Estabelecimento / Origem
                  </label>
                  <input
                    type="text"
                    value={customStore}
                    onChange={(e) => setCustomStore(e.target.value)}
                    placeholder="Ex: Magazine Luiza, Mercado Livre"
                    className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Data da Operação
                  </label>
                  <input
                    type="text"
                    value={customPurchaseDate}
                    onChange={(e) => setCustomPurchaseDate(e.target.value)}
                    placeholder="DD/MM/AAAA"
                    className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Valor Total Desembolsado (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={customTotalAmount || ''}
                    onChange={(e) => setCustomTotalAmount(parseFloat(e.target.value) || 0)}
                    className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Qtd. de Parcelas
                  </label>
                  <select
                    value={customInstallmentsCount || 1}
                    onChange={(e) => setCustomInstallmentsCount(parseInt(e.target.value, 10) || 1)}
                    className="w-full h-8 px-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none cursor-pointer"
                  >
                    {Array.from({ length: 48 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}x {n === 1 ? '(À vista)' : 'parcelas'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Meio de Desembolso / Cartão Utilizado
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={isManualCard ? 'OUTRO' : customCardName}
                      onChange={(e) => {
                        if (e.target.value === 'OUTRO') {
                          setIsManualCard(true);
                          setCustomCardName(manualCardInput || 'Outro Meio');
                        } else {
                          setIsManualCard(false);
                          setCustomCardName(e.target.value);
                        }
                      }}
                      className="w-full h-8 px-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-amber-500 outline-none"
                    >
                      <option value="Nubank Croma">Nubank Croma</option>
                      <option value="Itaú Mastercard Black">Itaú Mastercard Black</option>
                      <option value="Banco Inter Black">Banco Inter Black</option>
                      <option value="Mercado Pago Visa">Mercado Pago Visa</option>
                      <option value="Bradesco Visa Infinite">Bradesco Visa Infinite</option>
                      <option value="Santander Unlimited">Santander Unlimited</option>
                      <option value="C6 Bank Carbon">C6 Bank Carbon</option>
                      <option value="OUTRO">Outro (Digitar Manualmente)</option>
                    </select>

                    {isManualCard && (
                      <input
                        type="text"
                        placeholder="Digite o nome..."
                        value={manualCardInput}
                        onChange={(e) => {
                          setManualCardInput(e.target.value);
                          setCustomCardName(e.target.value);
                        }}
                        className="w-full h-8 px-2.5 bg-white border border-amber-400 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                    )}
                  </div>
                </div>

                <div className="sm:col-span-3 flex justify-end pt-2 border-t border-amber-200">
                  <button
                    type="button"
                    onClick={handleCopyMobileSignLink}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">smartphone</span>
                    <span>Copiar Link para Assinatura Eletrônica no Celular</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* CABEÇALHO DO CONTRATO - FORMA PADRÃO OFICIAL HASPAHO        */}
          {/* ============================================================ */}
          {/* 1. Top Brand Header Oficial HASPAHO com Logo Horizontal e Selo Verificado */}
          <div className="relative z-10 bg-white p-4 sm:p-5 rounded-2xl border-2 border-emerald-500/30 shadow-xs flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="flex items-center justify-center sm:justify-start max-w-full">
              <HaspahoLogo size="lg" variant="horizontal" className="h-10 sm:h-12" />
            </div>
            
            <div className="flex flex-col sm:items-end items-center gap-1.5">
              {/* Selo Oficial Combinado */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-950 text-[10.5px] font-black uppercase tracking-wider shadow-xs border-2 border-emerald-400">
                <span className="material-symbols-outlined text-[16px] text-emerald-700 font-bold">verified</span>
                <span>VERIFICADO • SALVO NO SISTEMA</span>
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse ml-0.5" />
              </div>
              <p className="text-[10px] text-slate-500 font-medium font-mono">
                Identificador Oficial: <span className="font-bold text-slate-700">{authHash}</span>
              </p>
            </div>
          </div>

          {/* 2. Banner Oficial do Instrumento Contratual */}
          <div className="relative z-10 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-md border border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 backdrop-blur-xs flex items-center justify-center text-indigo-300 shrink-0 border border-indigo-400/30 shadow-inner">
                <span className="material-symbols-outlined text-[28px]">history_edu</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-black tracking-widest text-indigo-300 block mb-0.5">
                  REPÚBLICA FEDERATIVA DO BRASIL • REPASSE &amp; RESTITUIÇÃO ENTRE PARTICULARES
                </span>
                <h1 className="text-sm sm:text-base md:text-lg font-black tracking-tight text-white leading-tight">
                  INSTRUMENTO PARTICULAR DE RECONHECIMENTO DE OBRIGAÇÃO DE RESTITUIÇÃO E REPASSE
                </h1>
                <span className="text-[10.5px] text-slate-300 font-medium block mt-1">
                  Operação Direta entre Particulares • Amparo Legal: MP nº 2.200-2/2001 e Lei Federal nº 14.063/2020
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 self-stretch sm:self-center justify-between sm:justify-end border-t sm:border-t-0 sm:border-l border-slate-700 pt-2.5 sm:pt-0 sm:pl-5">
              <div className="text-left sm:text-right">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Valor Contratado:</span>
                <span className="font-mono font-black text-sm sm:text-base text-emerald-400">
                  R$ {activeTotalDebt.toFixed(2).replace('.', ',')}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Plano Pactuado:</span>
                <span className="font-mono font-bold text-xs sm:text-sm text-slate-200">
                  {activeInstallmentsCount}x de R$ {activeInstallmentValue.toFixed(2).replace('.', ',')}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Chave Criptográfica de Validação Digital em Destaque */}
          <div className="relative z-10 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-300 rounded-xl p-3 flex flex-col gap-1.5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-emerald-950 uppercase tracking-wider flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-emerald-700">lock</span>
                Chave Criptográfica de Validação Digital do Contrato
              </span>
              <span className="text-[9.5px] font-bold text-emerald-800 bg-emerald-200/70 px-2 py-0.5 rounded-full">
                Auditado &amp; Registrado
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 bg-white border border-emerald-200 px-3 py-2 rounded-lg">
              <span className="font-mono font-black text-slate-900 text-xs sm:text-sm select-all tracking-wide break-all">
                {authHash}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(authHash);
                  onToast('Chave de validação do contrato copiada com sucesso!');
                }}
                className="shrink-0 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95"
                title="Copiar Chave do Contrato"
              >
                <span className="material-symbols-outlined text-[14px]">content_copy</span>
                <span>Copiar</span>
              </button>
            </div>
          </div>

          {/* Seção 1: Qualificação das Partes */}
          <div className="p-4 bg-slate-50/90 rounded-xl border border-slate-200/70 space-y-2">
            <h3 className="font-bold text-slate-900 uppercase text-xs tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-blue-600">groups</span>
              1. DAS PARTES CONTRATANTES
            </h3>
            <p className="text-xs text-slate-700">
              <b>DECLARANTE / FACILITADOR DO DESEMBOLSO:</b> <b>Tiago Dias</b> (HASPAHO Tecnologia da Informação, Mineiros do Tietê - SP), titular do meio de pagamento utilizado ({customCardName}), sem finalidade de intermediação financeira lucrativa.
            </p>
            <p className="text-xs text-slate-700">
              <b>BENEFICIÁRIO(A) / PARTE RESTITUINTE:</b> <b>{signerName || debtor.name}</b>, vínculo informado: <b>{customRelation || debtor.relation}</b>, telefone/WhatsApp: <b>{customPhone || debtor.phone}</b>, {signerDocument ? `portador(a) do CPF/Doc nº ${signerDocument}` : 'identificação documentada pelo termo'}.
            </p>
          </div>

          {/* Seção 2: Discriminação Econômica Estrita (Zero Lucro, Zero Taxa, Zero Comissão) */}
          <div className="p-5 bg-gradient-to-r from-emerald-50/80 via-teal-50/60 to-slate-50 rounded-xl border-2 border-emerald-300 shadow-2xs space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-black text-emerald-950 uppercase text-xs sm:text-sm tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-emerald-600">payments</span>
                2. DISCRIMINAÇÃO ECONÔMICA &amp; AUSÊNCIA DE REMUNERAÇÃO
              </h3>
              <div className="flex items-baseline gap-1 bg-white px-3 py-1 rounded-lg border border-emerald-200">
                <span className="text-xs text-emerald-800 font-semibold">Total a Restituir:</span>
                <span className="text-base sm:text-lg font-black text-slate-900">
                  R$ {activeTotalDebt.toFixed(2).replace('.', ',')}
                </span>
              </div>
            </div>

            {/* Grid de Valores Transparentes */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
              <div className="p-2.5 bg-white rounded-lg border border-emerald-100">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Desembolsado</span>
                <span className="font-black text-slate-900 text-xs sm:text-sm">R$ {activeTotalDebt.toFixed(2).replace('.', ',')}</span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-emerald-100">
                <span className="text-[10px] font-bold text-emerald-700 uppercase block">Remuneração Auxílio</span>
                <span className="font-black text-emerald-800 text-xs sm:text-sm">R$ 0,00</span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-emerald-100">
                <span className="text-[10px] font-bold text-emerald-700 uppercase block">Comissão / Taxa</span>
                <span className="font-black text-emerald-800 text-xs sm:text-sm">R$ 0,00</span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-emerald-100">
                <span className="text-[10px] font-bold text-emerald-700 uppercase block">Juros Remuneratórios</span>
                <span className="font-black text-emerald-800 text-xs sm:text-sm">R$ 0,00</span>
              </div>
            </div>

            {customOverdueCount > 0 && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900 font-bold">
                <span>⚠️ Registro de Ocorrência: {customOverdueCount} parcela(s) atualmente vencida(s)</span>
                <span>Saldo em Atraso: R$ {(customOverdueAmount > 0 ? customOverdueAmount : activeTotalDebt).toFixed(2).replace('.', ',')}</span>
              </div>
            )}

            {/* Destaque por extenso */}
            <div className="p-3 bg-white rounded-xl border border-emerald-200/90 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">
                Valor Total Expresso em Moeda Nacional (Por Extenso):
              </span>
              <p className="text-xs sm:text-sm font-bold text-emerald-950 italic">
                "{valorExtenso}"
              </p>
            </div>
          </div>

          {/* Seção 3: Objeto do Auxílio */}
          <div>
            <h3 className="font-bold text-slate-900 uppercase text-xs tracking-wider mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-blue-600">shopping_bag</span>
              3. DISCRIMINAÇÃO DA OPERAÇÃO DE AUXÍLIO
            </h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs overflow-x-auto table-scroll-container financial-table-container">
              <table className="w-full text-left text-xs border-collapse min-w-[620px]">
                <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Objeto / Bem Adquirido</th>
                    <th className="p-2.5">Estabelecimento</th>
                    <th className="p-2.5">Data da Operação</th>
                    <th className="p-2.5">Meio de Desembolso</th>
                    <th className="p-2.5 text-right">Plano de Restituição</th>
                    <th className="p-2.5 text-right">Valor Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50/60">
                    <td className="p-2.5 font-bold text-slate-900">{activeProduct}</td>
                    <td className="p-2.5 text-slate-600">{customStore}</td>
                    <td className="p-2.5 text-indigo-700 font-semibold">{customPurchaseDate}</td>
                    <td className="p-2.5 text-slate-600 font-medium">{customCardName}</td>
                    <td className="p-2.5 text-right font-medium text-slate-700">
                      {activeInstallmentsCount}x de R$ {activeInstallmentValue.toFixed(2).replace('.', ',')}
                    </td>
                    <td className="p-2.5 text-right font-black text-slate-900">
                      R$ {activeTotalDebt.toFixed(2).replace('.', ',')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Seção 4: Cláusulas Jurídicas Neutras e Verdadeiras */}
          <div className="space-y-3">
            <h3 className="font-bold text-slate-900 uppercase text-xs tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-blue-600">gavel</span>
              4. CLÁUSULAS CONTRATUAIS E OBRIGAÇÕES
            </h3>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2.5 text-slate-700 leading-relaxed">
              <p>
                <b>CLÁUSULA PRIMEIRA (Do Objeto e da Finalidade de Auxílio):</b> O presente instrumento formaliza o repasse de valor e/ou aquisição de bem realizada pelo DECLARANTE em benefício do(a) RESTITUINTE, a título de auxílio particular direto, assumindo este(a) a obrigação de restituição integral e sem qualquer acréscimo a título de juros remuneratórios, taxas de intermediação, comissões ou remuneração.
              </p>
              <p>
                <b>CLÁUSULA SEGUNDA (Do Cronograma e Meio de Restituição):</b> A restituição do valor total desembolsado ocorrerá de forma parcelada, em {activeInstallmentsCount} parcelas mensais e sucessivas de R$ {activeInstallmentValue.toFixed(2).replace('.', ',')} cada, com vencimentos nas datas pactuadas, preferencialmente via chave PIX oficial: <b>(14) 99733-9863 (Tiago Dias)</b>.
              </p>
              <p>
                <b>CLÁUSULA TERCEIRA (Da Ausência de Lucro ou Remuneração):</b> As partes declaram e reconhecem expressamente que a operação não possui qualquer finalidade lucrativa ou mercantil, consistindo em repasse entre particulares, registrando-se remuneração de R$ 0,00, taxa administrativa de R$ 0,00, comissão de R$ 0,00 e juros remuneratórios de R$ 0,00.
              </p>
              <p>
                <b>CLÁUSULA QUARTA (Do Registro de Atraso e Mora):</b> Em caso de atraso na restituição de qualquer parcela, o sistema registrará a parcela vencida, data do vencimento, data do efetivo pagamento e a quantidade de dias em atraso. Eventuais encargos decorrentes da mora serão observados estritamente conforme a legislação civil brasileira aplicável (Código Civil - Lei nº 10.406/2002 e Lei nº 14.905/2024), não havendo cobrança de taxas arbitrárias.
              </p>
              <p>
                <b>CLÁUSULA QUINTA (Da Validade da Assinatura e Autenticação Eletrônica):</b> As partes reconhecem a plena validade jurídica, integridade e autenticidade da assinatura digital e dos registros eletrônicos constantes neste instrumento, nos termos do Art. 10, § 2º da Medida Provisória nº 2.200-2/2001 e da Lei Federal nº 14.063/2020.
              </p>
            </div>
          </div>

          {/* Seção 5: Assinatura Digital Interativa (Canvas) */}
          <div className="p-4 sm:p-5 bg-gradient-to-br from-slate-50 to-indigo-50/40 rounded-2xl border border-slate-300 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-indigo-600 text-[18px]">draw</span>
                  5. CAMPO DE ASSINATURA DIGITAL DO(A) BENEFICIÁRIO(A)
                </h3>
                <p className="text-xs text-slate-500">
                  Desenhe sua assinatura com a ponta dos dedos ou mouse no quadro abaixo
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={generateCursiveSignature}
                  className="px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Gerar rubrica cursiva a partir do nome"
                >
                  <span className="material-symbols-outlined text-[14px]">history_edu</span>
                  <span>✍️ Gerar Rubrica</span>
                </button>

                <button
                  type="button"
                  onClick={clearCanvas}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">cleaning_services</span>
                  <span>Limpar</span>
                </button>
              </div>
            </div>

            {/* Canvas de Assinatura */}
            <div className="relative border-2 border-dashed border-indigo-300 rounded-xl bg-white overflow-hidden shadow-inner">
              <canvas
                ref={canvasRef}
                width={650}
                height={160}
                className="w-full h-36 cursor-crosshair block select-none"
                style={{ touchAction: 'none' }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              />
              {!hasSignature && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300 text-xs font-medium">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                    Assine com o dedo ou mouse aqui
                  </span>
                </div>
              )}
            </div>

            {/* Dados do Signatário e Selo de Autenticidade */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Nome do Signatário
                </label>
                <input
                  type="text"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="Nome Completo"
                  className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  CPF ou Registro de Identidade
                </label>
                <input
                  type="text"
                  value={signerDocument}
                  onChange={(e) => setSignerDocument(e.target.value)}
                  placeholder="000.000.000-00"
                  className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            {/* Carimbo de Certificação Digital */}
            <div className="p-3 bg-white rounded-xl border border-indigo-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[18px]">verified_user</span>
                </div>
                <div>
                  <span className="font-bold text-slate-900 block">
                    Carimbo de Autenticidade Eletrônica
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    Hash: {authHash}
                  </span>
                </div>
              </div>

              <div className="text-right text-[11px] text-slate-600 sm:self-center">
                <span>Registrado em: </span>
                <span className="font-bold text-slate-900">{signDateStr}</span>
              </div>
            </div>
          </div>

          {/* Nota Orientativa Legal de Habitualidade */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10.5px] text-slate-500 leading-relaxed">
            <strong>Nota Informativa:</strong> Este instrumento destina-se formalmente ao registro de auxílio entre particulares sem finalidade lucrativa. Operações exercidas com habitualidade ou que caracterizem intermediação profissional de recursos demandam assessoria jurídica especializada e conformidade regulatória específica.
          </div>
          </div>
        </div>

        {/* Action Buttons Footer - Estrutura Organizada e 100% Responsiva */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50 flex flex-col gap-2.5 shrink-0">
          {/* Linha Principal de Ações */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            {/* Bloco Esquerda: WhatsApp & Fechar */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-10 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-2xs"
                title="Fechar Janela e Voltar"
              >
                <span className="material-symbols-outlined text-[17px]">arrow_back</span>
                <span>Fechar</span>
              </button>

              <button
                type="button"
                onClick={handleShareWhatsAppPreFilled}
                title="Envia mensagem completa com os dados do auxílio para a pessoa assinar"
                className="flex-1 sm:flex-none h-10 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[17px]">send</span>
                <span>Enviar no WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={handleShareWhatsAppBlank}
                title="Envia link para preenchimento dos dados pelo próprio destinatário"
                className="hidden sm:flex h-10 px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-semibold text-xs items-center justify-center gap-1 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">edit_note</span>
                <span>Em Branco</span>
              </button>
            </div>

            {/* Bloco Direita: Print, Imprimir, PDF & Salvar Assinatura */}
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <button
                type="button"
                onClick={handleCaptureScreenshot}
                disabled={isCapturingScreenshot}
                title="Tirar print do contrato e salvar imagem"
                className="h-10 px-3 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[17px]">photo_camera</span>
                <span>{isCapturingScreenshot ? 'Capturando...' : 'Tirar Print'}</span>
              </button>

              <button
                type="button"
                onClick={handlePrintContract}
                title="Abrir diálogo de impressão"
                className="h-10 px-3 bg-slate-700 hover:bg-slate-800 active:scale-95 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[17px]">print</span>
                <span>Imprimir</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadContractPdf}
                title="Baixar PDF oficial do contrato com marca d'água A4"
                className="h-10 px-3 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[17px]">picture_as_pdf</span>
                <span>Baixar PDF</span>
              </button>

              <button
                type="button"
                onClick={handleSaveSignature}
                className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                <span>Salvar Assinatura</span>
              </button>
            </div>
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
        onToast={onToast}
      />
    </div>
  );
};
