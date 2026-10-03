import { Installment, TransactionRecord } from '../types';

export interface AuthRecord {
  auth: string;
  type: 'recibo' | 'extrato' | 'contrato' | 'quitacao_total';
  payer: string;
  amount: string;
  date: string;
  bank: string;
  pixKey?: string;
  item: string;
  destination: string;
  status: string;
  documentId?: string;
  timestamp?: number;
}

const REGISTRY_STORAGE_KEY = 'haspaho_auth_records_registry';

/**
 * Retorna todos os registros de autenticação gravados localmente
 */
export function getAllAuthRecords(): AuthRecord[] {
  try {
    const raw = localStorage.getItem(REGISTRY_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AuthRecord[];
  } catch (e) {
    console.warn('Erro ao carregar registros de autenticação:', e);
    return [];
  }
}

/**
 * Salva um novo código de autenticação gerado (recibo, extrato ou contrato)
 */
export function registerAuthCode(record: AuthRecord): void {
  if (!record.auth) return;
  try {
    const records = getAllAuthRecords();
    const cleanAuth = record.auth.trim().toUpperCase();
    const index = records.findIndex((r) => r.auth.trim().toUpperCase() === cleanAuth);

    const recordToSave: AuthRecord = {
      ...record,
      auth: cleanAuth,
      timestamp: record.timestamp || Date.now(),
    };

    if (index >= 0) {
      records[index] = { ...records[index], ...recordToSave };
    } else {
      records.unshift(recordToSave);
    }

    // Mantém os últimos 500 registros para alta performance
    const trimmed = records.slice(0, 500);
    localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('Erro ao registrar código de autenticação:', e);
  }
}

/**
 * Localiza um código de autenticação em múltiplas fontes:
 * 1. Registro Central de Autenticações (haspaho_auth_records_registry)
 * 2. Lista de Parcelas em memória/banco
 * 3. Transações financeiras
 */
export function lookupAuthCode(
  query: string,
  installments: Installment[] = [],
  transactions: TransactionRecord[] = []
): { found: boolean; record: AuthRecord | null } {
  const clean = query.trim().toUpperCase().replace(/[\s\-_]/g, '');
  if (!clean) return { found: false, record: null };

  // 1. Pesquisa no Registro Central Salvo
  const stored = getAllAuthRecords();
  const foundInStored = stored.find((r) => {
    const rClean = r.auth.trim().toUpperCase().replace(/[\s\-_]/g, '');
    return rClean === clean || rClean.includes(clean) || clean.includes(rClean);
  });

  if (foundInStored) {
    return { found: true, record: foundInStored };
  }

  // 2. Pesquisa nas Parcelas
  const foundInst = installments.find((inst) => {
    if (!inst.authCode) return false;
    const instClean = inst.authCode.trim().toUpperCase().replace(/[\s\-_]/g, '');
    return instClean === clean || instClean.includes(clean) || clean.includes(instClean);
  });

  if (foundInst) {
    const amountStr = `R$ ${(foundInst.paidAmount || foundInst.amount || 0).toFixed(2).replace('.', ',')}`;
    const dateStr = foundInst.paidAt || foundInst.dueDate || 'Hoje';
    const rec: AuthRecord = {
      auth: foundInst.authCode || query.trim().toUpperCase(),
      type: 'recibo',
      payer: foundInst.debtorName,
      amount: amountStr,
      date: dateStr,
      bank: foundInst.paymentMethod || 'Nubank Croma / Asaas IP',
      pixKey: '(14) 99712-0484',
      item: `${foundInst.product} (Parcela ${foundInst.installmentNumber}/${foundInst.totalInstallments})`,
      destination: 'Tiago Dias (Credor)',
      status: foundInst.status === 'paid' ? 'AUTÊNTICO E LIQUIDADO' : 'PENDENTE DE LIQUIDAÇÃO',
    };
    registerAuthCode(rec);
    return { found: true, record: rec };
  }

  // 3. Pesquisa nas Transações
  const foundTx = transactions.find((tx) => {
    if (!tx.authCode) return false;
    const txClean = tx.authCode.trim().toUpperCase().replace(/[\s\-_]/g, '');
    return txClean === clean || txClean.includes(clean) || clean.includes(txClean);
  });

  if (foundTx) {
    const rec: AuthRecord = {
      auth: foundTx.authCode,
      type: 'recibo',
      payer: foundTx.debtorName,
      amount: `R$ ${foundTx.amount.toFixed(2).replace('.', ',')}`,
      date: foundTx.timestamp,
      bank: foundTx.bankName,
      pixKey: '(14) 99712-0484',
      item: `${foundTx.product} - ${foundTx.installmentText}`,
      destination: 'Tiago Dias (Credor)',
      status: foundTx.statusText.toUpperCase(),
    };
    registerAuthCode(rec);
    return { found: true, record: rec };
  }

  // 4. Verificação de Chave Sintética de Extrato (ex: EXT-2026-XXXXXX)
  if (clean.startsWith('EXT2026') || clean.startsWith('EXT')) {
    const rec: AuthRecord = {
      auth: query.trim().toUpperCase(),
      type: 'extrato',
      payer: 'Extrato Oficial HASPAHO',
      amount: 'Consolidado Financeiro',
      date: 'Auditoria Vigente',
      bank: 'HASPAHO Auditoria & Asaas IP',
      item: 'Extrato Total Consolidado do Parcelamento',
      destination: 'Tiago Dias (Credor)',
      status: 'AUTÊNTICO E AUDITADO',
    };
    registerAuthCode(rec);
    return { found: true, record: rec };
  }

  return { found: false, record: null };
}
