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

export async function sendGeminiAutomationCommand(
  params: SendAutomationCommandParams
): Promise<GeminiAutomationResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch('/api/gemini/automate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        command: params.command,
        forceConfirmed: Boolean(params.forceConfirmed),
        context: {
          currentUser: params.currentUser ? { id: params.currentUser.id, name: params.currentUser.name, email: params.currentUser.email } : null,
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
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData?.details || errorData?.error || 'Erro ao comunicar com a Automação Gemini.');
    }

    const data = await response.json();
    return data.result as GeminiAutomationResult;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('A requisição excedeu o tempo limite. Tente novamente em alguns segundos.');
    }
    throw err;
  }
}

export async function fetchAllClientHistories(): Promise<GeminiTxtFileInfo[]> {
  const response = await fetch('/api/txt-historico');
  if (!response.ok) return [];
  const data = await response.json();
  return (data.clients || []) as GeminiTxtFileInfo[];
}

export async function fetchClientTxtContent(
  folderName: string,
  fileName: string
): Promise<string> {
  const response = await fetch(`/api/txt-historico/${encodeURIComponent(folderName)}/${encodeURIComponent(fileName)}`);
  if (!response.ok) throw new Error('Arquivo não encontrado.');
  const data = await response.json();
  return data.content as string;
}

export async function syncAllTxtHistories(
  debtors: Debtor[],
  installments: Installment[]
): Promise<void> {
  await fetch('/api/txt-historico/sync-all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ debtors, installments }),
  });
}

export async function transcribeAudioWithGemini(audioBlob: Blob): Promise<string> {
  const reader = new FileReader();
  const base64Promise = new Promise<string>((resolve, reject) => {
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
  });
  reader.readAsDataURL(audioBlob);
  const dataUrl = await base64Promise;

  const response = await fetch('/api/gemini/transcribe-audio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audioBase64: dataUrl,
      mimeType: audioBlob.type || 'audio/webm',
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.details || errorData?.error || 'Erro ao transcrever áudio com Gemini.');
  }

  const data = await response.json();
  return data.transcript || '';
}

