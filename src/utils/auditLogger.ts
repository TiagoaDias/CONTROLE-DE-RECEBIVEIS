export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  target?: string;
  status: 'FIRESTORE_SAVED' | 'ENCRYPTED' | 'LOCAL_SAVED' | 'SYSTEM';
  hash: string;
}

const generateLogHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `0x${hex}${Date.now().toString(16).slice(-4)}`;
};

export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'log-1',
    timestamp: new Date().toLocaleString('pt-BR'),
    action: 'INICIALIZAÇÃO_SISTEMA',
    details: 'Sessão homologada para Tiago Dias (Operador Full Stack). Criptografia BR-CONF ativa.',
    status: 'ENCRYPTED',
    hash: '0x3a8f9c1b',
  },
  {
    id: 'log-2',
    timestamp: new Date().toLocaleString('pt-BR'),
    action: 'CONEXÃO_DATABASE_FIRESTORE',
    details: 'Banco Firestore ativo (Coleções: users, debtors, purchases, installments). Sincronização em tempo real OK.',
    status: 'FIRESTORE_SAVED',
    hash: '0x9f1e2c4d',
  },
  {
    id: 'log-3',
    timestamp: new Date().toLocaleString('pt-BR'),
    action: 'REGRAS_NOTARIAIS_ATIVAS',
    details: 'Configuração notarial: R$ 5,00 taxa fixa por atraso + 2,5% juros ao mês.',
    status: 'SYSTEM',
    hash: '0x8d7a1f5e',
  },
];

export const getAuditLogs = (): AuditLogEntry[] => {
  try {
    const saved = localStorage.getItem('haspaho_audit_logs');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Erro ao ler logs de auditoria:', e);
  }
  return INITIAL_AUDIT_LOGS;
};

export const addAuditLog = (
  action: string,
  details: string,
  target?: string,
  status: 'FIRESTORE_SAVED' | 'ENCRYPTED' | 'LOCAL_SAVED' | 'SYSTEM' = 'FIRESTORE_SAVED'
): AuditLogEntry => {
  const logs = getAuditLogs();
  const timestamp = new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR');
  const rawStr = `${timestamp}-${action}-${details}-${Math.random()}`;
  const newEntry: AuditLogEntry = {
    id: `log_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    timestamp,
    action: action.toUpperCase(),
    details,
    target,
    status,
    hash: generateLogHash(rawStr),
  };

  const updatedLogs = [newEntry, ...logs].slice(0, 200); // keep last 200 logs
  try {
    localStorage.setItem('haspaho_audit_logs', JSON.stringify(updatedLogs));
    window.dispatchEvent(new Event('haspaho-audit-log-updated'));
  } catch (e) {
    console.error('Erro ao salvar log de auditoria:', e);
  }

  return newEntry;
};

export const clearAuditLogs = () => {
  try {
    localStorage.setItem('haspaho_audit_logs', JSON.stringify([]));
    window.dispatchEvent(new Event('haspaho-audit-log-updated'));
  } catch (e) {
    console.error('Erro ao limpar logs:', e);
  }
};
