import { Capacitor } from '@capacitor/core';
import {
  Debtor,
  Purchase,
  Installment,
  TransactionRecord,
  UserAccount,
  GeminiAutomationResult,
  GeminiTxtFileInfo,
} from '../types';

export interface SendAutomationCommandParams {
  command: string;
  debtors: Debtor[];
  purchases: Purchase[];
  installments: Installment[];
  transactions: TransactionRecord[];
  currentUser: UserAccount | null;
  forceConfirmed?: boolean;
}

const CLOUD_BACKEND_URLS = [
  'https://ais-pre-qoii7ra7qmo5bwgeuyvgrs-535464542726.us-west2.run.app',
  'https://ais-dev-qoii7ra7qmo5bwgeuyvgrs-535464542726.us-west2.run.app',
];

function isCapacitorOrStaticHost(): boolean {
  try {
    if (Capacitor.isNativePlatform()) return true;
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      const proto = window.location.protocol;
      if (proto === 'capacitor:' || proto === 'file:') return true;
      if (host === 'localhost' && !window.location.port) return true;
      if (host.includes('vercel.app')) return true;
    }
  } catch {}
  return false;
}

async function fetchJsonApi(endpoint: string, options?: RequestInit, timeoutMs: number = 12000): Promise<any> {
  const candidates: string[] = [];

  if (!isCapacitorOrStaticHost()) {
    candidates.push(endpoint);
  }
  for (const base of CLOUD_BACKEND_URLS) {
    candidates.push(`${base}${endpoint}`);
  }
  if (isCapacitorOrStaticHost()) {
    candidates.push(endpoint);
  }

  let lastError: any = null;

  for (const url of candidates) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timer);

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        continue;
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.details || data?.error || `Erro HTTP ${res.status}`);
      }
      return data;
    } catch (err: any) {
      clearTimeout(timer);
      lastError = err;
    }
  }

  throw lastError || new Error('Não foi possível conectar ao servidor Gemini.');
}

/**
 * Motor local de contingência para garantir que comandos de voz e texto no celular
 * funcionem mesmo quando o APK estiver offline ou sem acesso ao servidor Node.
 */
function executeClientSideAutomationFallback(params: SendAutomationCommandParams): GeminiAutomationResult {
  const { command, debtors, installments, forceConfirmed } = params;
  const cmd = command.toLowerCase();
  const todayStr = new Date().toLocaleDateString('pt-BR');
  const operationId = `OP-${Date.now().toString(36).toUpperCase()}`;

  // 1. Extrair valor monetário (ex: R$ 150,00 ou 150 reais)
  let extractedAmount = 0;
  const valMatch =
    command.match(/R\$\s*([0-9.,]+)/i) ||
    command.match(/([0-9]+(?:[.,][0-9]{1,2})?)\s*(?:reais|real|conto|pila)/i) ||
    command.match(/(?:pagou|pagamento de|valor de|transferiu|quitou)\s*R?\$\s*([0-9.,]+)/i) ||
    command.match(/\b([1-9][0-9]{1,4}(?:[.,][0-9]{2})?)\b/);

  if (valMatch && valMatch[1]) {
    const rawVal = valMatch[1];
    const clean = rawVal.includes(',') ? rawVal.replace(/\./g, '').replace(',', '.') : rawVal;
    const num = parseFloat(clean);
    if (!isNaN(num) && num > 0) extractedAmount = num;
  }

  // 2. Identificar cliente pelo nome
  let matchedDebtor: Debtor | null = null;
  const normalize = (str: string) =>
    (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const normCmd = normalize(command);
  for (const d of debtors) {
    const dNorm = normalize(d.name);
    const firstPart = dNorm.split(' ')[0];
    if (dNorm && (normCmd.includes(dNorm) || (firstPart.length >= 3 && normCmd.includes(firstPart)))) {
      matchedDebtor = d;
      break;
    }
  }

  // Resumo geral do sistema
  if (
    !matchedDebtor &&
    (normCmd.includes('resumo') || normCmd.includes('geral') || normCmd.includes('todos') || normCmd.includes('relatorio'))
  ) {
    const totalOwedAll = debtors.reduce((acc, d) => acc + (d.totalOwed || 0), 0);
    const totalPaidAll = debtors.reduce((acc, d) => acc + (d.totalPaid || 0), 0);
    const overdueCountAll = installments.filter((i) => i.status === 'overdue').length;
    return {
      reply: `📊 Resumo Geral HASPAHO:\n• Clientes ativos: ${debtors.length}\n• Total a Receber: R$ ${totalOwedAll.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n• Total Já Recebido: R$ ${totalPaidAll.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n• Parcelas em Atraso: ${overdueCountAll}`,
      intent: 'G_CONSULTA',
      intentLabel: 'G. Resumo Financeiro Geral',
    };
  }

  const isConfirmation =
    normCmd.includes('confirmar') ||
    normCmd.includes('confirmado') ||
    normCmd.includes('baixa') ||
    Boolean(forceConfirmed);
  const isPayment =
    normCmd.includes('pagou') ||
    normCmd.includes('pagamento') ||
    normCmd.includes('quitou') ||
    normCmd.includes('pix') ||
    normCmd.includes('transferiu');
  const isPromise =
    normCmd.includes('prometeu') ||
    normCmd.includes('vai pagar') ||
    normCmd.includes('combinou') ||
    normCmd.includes('amanha');
  const isQuery =
    normCmd.includes('quanto') ||
    normCmd.includes('deve') ||
    normCmd.includes('saldo') ||
    normCmd.includes('consulte') ||
    normCmd.includes('extrato') ||
    normCmd.includes('situacao');

  if (matchedDebtor) {
    if (isQuery && !isPayment) {
      const debtorInst = installments.filter((i) => i.debtorId === matchedDebtor!.id);
      const pending = debtorInst.filter((i) => i.status !== 'paid').length;
      const overdue = debtorInst.filter((i) => i.status === 'overdue').length;
      return {
        reply: `Cliente localizado: ${matchedDebtor.name}.\n• Saldo Devedor: R$ ${(matchedDebtor.totalOwed || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n• Total Pago: R$ ${(matchedDebtor.totalPaid || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n• Parcelas Pendentes: ${pending} (${overdue} em atraso)\n• Score: ${matchedDebtor.score || 850}/1000.`,
        intent: 'G_CONSULTA',
        intentLabel: 'G. Consulta de Saldo',
        clientIdentified: {
          id: matchedDebtor.id,
          name: matchedDebtor.name,
          phone: matchedDebtor.phone,
          totalOwed: matchedDebtor.totalOwed,
          totalPaid: matchedDebtor.totalPaid,
        },
      };
    }

    if (isPayment && extractedAmount > 0) {
      if (isConfirmation) {
        const newPaid = (matchedDebtor.totalPaid || 0) + extractedAmount;
        const newOwed = Math.max(0, (matchedDebtor.totalOwed || 0) - extractedAmount);
        const updatedDebtor: Debtor = {
          ...matchedDebtor,
          totalPaid: newPaid,
          totalOwed: newOwed,
        };
        return {
          reply: `✅ Pagamento de R$ ${extractedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} confirmado para ${matchedDebtor.name}. Novo saldo devedor: R$ ${newOwed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
          intent: 'D_PAGAMENTO_CONFIRMADO',
          intentLabel: 'D. Pagamento Confirmado',
          clientIdentified: {
            id: matchedDebtor.id,
            name: matchedDebtor.name,
            phone: matchedDebtor.phone,
            totalOwed: newOwed,
            totalPaid: newPaid,
          },
          operation: {
            type: 'Pagamento Confirmado',
            amount: extractedAmount,
            date: todayStr,
            status: 'Confirmado',
            description: command,
            operationId,
          },
          mutations: {
            updatedDebtor,
          },
        };
      }

      const updatedDebtor: Debtor = {
        ...matchedDebtor,
        notes: matchedDebtor.notes
          ? `${matchedDebtor.notes} | [${todayStr}] Pagamento informado: R$ ${extractedAmount.toFixed(2)}`
          : `[${todayStr}] Pagamento informado: R$ ${extractedAmount.toFixed(2)}`,
      };
      return {
        reply: `📝 Pagamento de R$ ${extractedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} registrado como informado para ${matchedDebtor.name} (aguardando confirmação). Saldo devedor atual: R$ ${(matchedDebtor.totalOwed || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
        intent: 'C_PAGAMENTO_INFORMADO',
        intentLabel: 'C. Pagamento Informado',
        clientIdentified: {
          id: matchedDebtor.id,
          name: matchedDebtor.name,
          phone: matchedDebtor.phone,
          totalOwed: matchedDebtor.totalOwed,
          totalPaid: matchedDebtor.totalPaid,
        },
        operation: {
          type: 'Pagamento Informado',
          amount: extractedAmount,
          date: todayStr,
          status: 'Aguardando confirmação',
          description: command,
          operationId,
        },
        mutations: {
          updatedDebtor,
        },
      };
    }

    if (isPromise) {
      const updatedDebtor: Debtor = {
        ...matchedDebtor,
        notes: matchedDebtor.notes
          ? `${matchedDebtor.notes} | [${todayStr}] Promessa: ${command}`
          : `[${todayStr}] Promessa: ${command}`,
      };
      return {
        reply: `📅 Promessa de pagamento registrada na ficha de ${matchedDebtor.name}: "${command}".`,
        intent: 'B_PROMESSA',
        intentLabel: 'B. Promessa de Pagamento',
        clientIdentified: {
          id: matchedDebtor.id,
          name: matchedDebtor.name,
          phone: matchedDebtor.phone,
          totalOwed: matchedDebtor.totalOwed,
          totalPaid: matchedDebtor.totalPaid,
        },
        mutations: {
          updatedDebtor,
        },
      };
    }

    const updatedDebtor: Debtor = {
      ...matchedDebtor,
      notes: matchedDebtor.notes
        ? `${matchedDebtor.notes} | [${todayStr}] Obs: ${command}`
        : `[${todayStr}] Obs: ${command}`,
    };
    return {
      reply: `📌 Observação anotada para ${matchedDebtor.name}: "${command}".`,
      intent: 'A_OBSERVACAO',
      intentLabel: 'A. Observação Registrada',
      clientIdentified: {
        id: matchedDebtor.id,
        name: matchedDebtor.name,
        phone: matchedDebtor.phone,
        totalOwed: matchedDebtor.totalOwed,
        totalPaid: matchedDebtor.totalPaid,
      },
      mutations: {
        updatedDebtor,
      },
    };
  }

  return {
    reply: `Recebi seu comando: "${command}". Diga o nome de um cliente cadastrado (ex: "${debtors[0]?.name || 'Fábio Dias'} pagou R$ 150" ou "Quanto ${debtors[0]?.name || 'Fábio'} deve?") para consultar ou atualizar os registros.`,
    intent: 'OUTRO',
    intentLabel: 'Comando Recebido',
  };
}

export async function sendGeminiAutomationCommand(
  params: SendAutomationCommandParams
): Promise<GeminiAutomationResult> {
  try {
    const data = await fetchJsonApi(
      '/api/gemini/automate',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command: params.command,
          forceConfirmed: Boolean(params.forceConfirmed),
          context: {
            currentUser: params.currentUser
              ? { id: params.currentUser.id, name: params.currentUser.name, email: params.currentUser.email }
              : null,
            debtors: params.debtors.map((d) => ({
              id: d.id,
              name: d.name,
              phone: d.phone,
              relation: d.relation,
              totalOwed: d.totalOwed,
              totalPaid: d.totalPaid,
              overdueCount: d.overdueCount,
              score: d.score,
              scoreTier: d.scoreTier,
              notes: d.notes,
              nextDueDate: d.nextDueDate,
            })),
            purchases: params.purchases.map((p) => ({
              id: p.id,
              debtorId: p.debtorId,
              debtorName: p.debtorName,
              product: p.product,
              totalAmount: p.totalAmount,
              installmentValue: p.installmentValue,
            })),
            installments: params.installments.map((i) => ({
              id: i.id,
              debtorId: i.debtorId,
              debtorName: i.debtorName,
              product: i.product,
              amount: i.amount,
              status: i.status,
              dueDate: i.dueDate,
              installmentNumber: i.installmentNumber,
              totalInstallments: i.totalInstallments,
            })),
            transactions: (params.transactions || []).slice(0, 50).map((t) => ({
              id: t.id,
              debtorName: t.debtorName,
              amount: t.amount,
              timestamp: t.timestamp,
              statusText: t.statusText,
            })),
          },
        }),
      },
      12000
    );

    if (data?.result) {
      return data.result as GeminiAutomationResult;
    }
    return executeClientSideAutomationFallback(params);
  } catch (err) {
    console.warn('[GeminiAutomationClient] Usando motor local de contingência:', err);
    return executeClientSideAutomationFallback(params);
  }
}

export async function fetchAllClientHistories(): Promise<GeminiTxtFileInfo[]> {
  try {
    const data = await fetchJsonApi('/api/txt-historico', undefined, 8000);
    return (data.clients || []) as GeminiTxtFileInfo[];
  } catch {
    return [];
  }
}

export async function fetchClientTxtContent(
  folderName: string,
  fileName: string
): Promise<string> {
  const data = await fetchJsonApi(
    `/api/txt-historico/${encodeURIComponent(folderName)}/${encodeURIComponent(fileName)}`,
    undefined,
    8000
  );
  return data.content as string;
}

export async function syncAllTxtHistories(
  debtors: Debtor[],
  installments: Installment[]
): Promise<void> {
  try {
    await fetchJsonApi(
      '/api/txt-historico/sync-all',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ debtors, installments }),
      },
      10000
    );
  } catch {}
}

export async function transcribeAudioWithGemini(audioBlob: Blob): Promise<string> {
  const reader = new FileReader();
  const base64Promise = new Promise<string>((resolve, reject) => {
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
  });
  reader.readAsDataURL(audioBlob);
  const dataUrl = await base64Promise;

  const data = await fetchJsonApi(
    '/api/gemini/transcribe-audio',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioBase64: dataUrl,
        mimeType: audioBlob.type || 'audio/webm',
      }),
    },
    15000
  );

  return data.transcript || '';
}
