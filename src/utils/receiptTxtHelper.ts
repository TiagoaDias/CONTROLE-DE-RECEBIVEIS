import { valorPorExtenso } from './numberToWordsPtBr';
import { Debtor, Installment, Purchase } from '../types';

export interface ReceiptTxtData {
  payerName: string;
  payerCpf?: string;
  payerPhone?: string;
  creditorName?: string;
  creditorCompany?: string;
  creditorPix?: string;
  creditorPhone?: string;
  productName: string;
  installmentNumber: number;
  totalInstallments: number;
  amount: number | string;
  paymentDate: string;
  paymentMethod?: string;
  authCode: string;
}

/**
 * Gera um comprovante de quitação em formato TXT limpo, profissional e legível.
 */
export function generateReceiptTxt(data: ReceiptTxtData): string {
  const numericAmount = typeof data.amount === 'number'
    ? data.amount
    : parseFloat(String(data.amount).replace('R$', '').replace(/\s+/g, '').replace(/\./g, '').replace(',', '.')) || 0;

  const formattedAmount = `R$ ${numericAmount.toFixed(2).replace('.', ',')}`;
  const amountWords = valorPorExtenso(numericAmount);
  const now = new Date().toLocaleString('pt-BR');

  const sep = '='.repeat(54);
  const subSep = '-'.repeat(54);

  return `${sep}
           HASPAHO GESTÃO FINANCEIRA
       COMPROVANTE OFICIAL DE QUITAÇÃO (TXT)
${sep}

DOCUMENTO DE AUTENTICIDADE DIGITAL (ART. 320 CC)
Emissão: ${now}
Código de Autenticação: ${data.authCode || 'AUT-' + Date.now().toString(36).toUpperCase()}

${subSep}
DADOS DO PAGADOR:
${subSep}
Nome: ${data.payerName}
Documento (CPF/CNPJ): ${data.payerCpf || 'Não informado'}
Telefone/WhatsApp: ${data.payerPhone || 'Não informado'}

${subSep}
DADOS DO CREDOR / DESTINATÁRIO:
${subSep}
Favorecido: ${data.creditorName || 'Tiago Dias'}
Empresa: ${data.creditorCompany || 'HASPAHO Tecnologia da Informação'}
Chave PIX: ${data.creditorPix || '(14) 99733-9863'}
Contato: ${data.creditorPhone || '(14) 99733-9863'}

${subSep}
DETALHES DO PAGAMENTO:
${subSep}
Produto / Descrição: ${data.productName}
Parcela Quitada: #${data.installmentNumber} de ${data.totalInstallments}
Data da Liquidação: ${data.paymentDate || new Date().toLocaleDateString('pt-BR')}
Forma de Pagamento: ${data.paymentMethod || 'PIX / Dinheiro'}
VALOR PAGO: ${formattedAmount}
VALOR POR EXTENSO:
${amountWords}

${subSep}
DECLARAÇÃO DE QUITAÇÃO:
Declaramos para os devidos fins que recebemos a quantia
acima discriminada, dando plena e rasa quitação da referida
parcela do compromisso assumido.
${sep}
             HASPAHO SISTEMAS FINANCEIROS
       Autenticado com validade jurídica (Lei 14.063/2020)
${sep}
`;
}

/**
 * Gera um extrato financeiro completo em formato TXT para o devedor.
 */
export function generateStatementTxt(
  debtor: Debtor,
  installments: Installment[],
  purchases: Purchase[] = []
): string {
  const now = new Date().toLocaleString('pt-BR');
  const sep = '='.repeat(64);
  const subSep = '-'.repeat(64);

  const totalOwed = installments
    .filter((i) => i.status !== 'paid')
    .reduce((acc, curr) => acc + (curr.amount || curr.originalAmount || 0), 0);

  const totalPaid = installments
    .filter((i) => i.status === 'paid')
    .reduce((acc, curr) => acc + (curr.paidAmount || curr.amount || curr.originalAmount || 0), 0);

  const totalGeneral = totalOwed + totalPaid;

  let text = `${sep}
               HASPAHO GESTÃO FINANCEIRA
       EXTRATO TOTAL CONSOLIDADO DE PARCELAS (TXT)
${sep}

Emissão: ${now}
Cliente / Sacado: ${debtor.name}
Documento: ${debtor.cpfCnpj || debtor.documentNumber || 'Não informado'}
Telefone: ${debtor.phone || 'Não informado'}
Status da Conta: ${totalOwed <= 0 ? 'TOTALMENTE QUITADO' : 'EM ABERTO'}

${subSep}
RESUMO FINANCEIRO:
${subSep}
Total Geral do Compromisso: R$ ${totalGeneral.toFixed(2).replace('.', ',')}
Total Já Quitado (Pago):   R$ ${totalPaid.toFixed(2).replace('.', ',')}
Saldo Devedor Pendente:     R$ ${totalOwed.toFixed(2).replace('.', ',')}
Quantidade de Parcelas:     ${installments.length}

${subSep}
GRADE DETALHADA DE PARCELAS:
${subSep}
`;

  installments.forEach((inst, idx) => {
    const statusLabel = inst.status === 'paid' ? '[QUITADA]' : inst.status === 'overdue' ? '[EM ATRASO]' : '[PENDENTE]';
    const amountVal = (inst.amount || inst.originalAmount || 0).toFixed(2).replace('.', ',');
    const due = inst.dueDate || 'A combinar';
    const paidAt = inst.paidAt ? ` (Paga em: ${inst.paidAt})` : '';

    text += `${String(idx + 1).padStart(2, '0')}. Parcela #${inst.installmentNumber}/${inst.totalInstallments} | ${inst.product}\n`;
    text += `    Valor: R$ ${amountVal} | Vencimento: ${due} | ${statusLabel}${paidAt}\n`;
    if (inst.authCode) {
      text += `    Autenticação: ${inst.authCode}\n`;
    }
    text += `\n`;
  });

  text += `${sep}
             HASPAHO SISTEMAS FINANCEIROS
       Autenticado com validade jurídica (Lei 14.063/2020)
${sep}
`;

  return text;
}

/**
 * Dispara o download universal (Web, Mobile e Android WebView/Capacitor) de qualquer Blob/Arquivo.
 * Nunca revoga o Blob URL sincronicamente (evita falha silenciosa no Chrome Mobile / Android).
 */
export async function triggerUniversalFileDownload(
  blob: Blob,
  filename: string
): Promise<void> {
  try {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    const isAndroidWebView =
      typeof window !== 'undefined' &&
      (/wv|Android.*Version\/[0-9.]+|Haspaho/i.test(ua) ||
        Boolean((window as any).Capacitor?.isNativePlatform?.()));
    const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(ua);

    // 1. Em WebViews Android ou dispositivos móveis com Web Share API de arquivo, tenta compartilhar/salvar nativamente
    if ((isAndroidWebView || isMobileDevice) && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
        if (!navigator.canShare || navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: filename,
          });
          return;
        }
      } catch (shareErr) {
        if ((shareErr as Error)?.name === 'AbortError') return;
        // Prossegue para o download direto caso o Web Share não esteja disponível ou falhe
      }
    }

    // 2. Em Android WebView onde blob: URLs são ignoradas pelo DownloadListener nativo, usa data: URI via FileReader
    if (isAndroidWebView) {
      const dataUrl = await new Promise<string>((resolve) => {
        try {
          const reader = new FileReader();
          reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '');
          reader.onerror = () => resolve('');
          reader.readAsDataURL(blob);
        } catch {
          resolve('');
        }
      });

      if (dataUrl) {
        const dataLink = document.createElement('a');
        dataLink.href = dataUrl;
        dataLink.download = filename;
        dataLink.style.display = 'none';
        document.body.appendChild(dataLink);
        dataLink.click();
        setTimeout(() => {
          try {
            if (dataLink.parentNode) document.body.removeChild(dataLink);
          } catch {
            // ignore
          }
        }, 1500);
        return;
      }
    }

    // 3. Download padrão via Object URL (Web e navegadores mobile padrão)
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      try {
        if (link.parentNode) {
          document.body.removeChild(link);
        }
      } catch {
        // ignore
      }
    }, 1500);

    setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    }, 60000);
  } catch (err) {
    console.error('Erro ao baixar arquivo:', err);
  }
}

/**
 * Dispara o download de um arquivo .TXT no navegador e no Android.
 */
export function downloadTxtFile(filename: string, content: string): void {
  const safeName = filename.endsWith('.txt') ? filename : `${filename}.txt`;
  const blob = new Blob(['\uFEFF' + content], { type: 'text/plain;charset=utf-8' });
  triggerUniversalFileDownload(blob, safeName).catch(console.warn);
}

