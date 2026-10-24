import fs from 'fs';
import path from 'path';

// Diretório oficial para histórico em formato TXT conforme Seção 4
const BASE_HISTORICO_DIR = path.join(process.cwd(), 'historico_clientes');

// Garante que o diretório base existe
function ensureBaseDir() {
  if (!fs.existsSync(BASE_HISTORICO_DIR)) {
    fs.mkdirSync(BASE_HISTORICO_DIR, { recursive: true });
  }
}

// Normaliza o nome do cliente para a pasta: Ex "Fábio Dias" -> "FABIO_DIAS"
export function normalizeClientFolderName(name: string): string {
  if (!name) return 'CLIENTE_DESCONHECIDO';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

export function getClientHistoryDir(clientName: string): string {
  ensureBaseDir();
  const folder = normalizeClientFolderName(clientName);
  const clientDir = path.join(BASE_HISTORICO_DIR, folder);
  if (!fs.existsSync(clientDir)) {
    fs.mkdirSync(clientDir, { recursive: true });
  }
  return clientDir;
}

// 1. Atualiza ou cria cadastro.txt
export function syncCadastroTxt(debtor: any): string {
  const dir = getClientHistoryDir(debtor.name);
  const filePath = path.join(dir, 'cadastro.txt');
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR');

  const content = `================================================================================
HASPAHO TECNOLOGIA DA INFORMAÇÃO • CONTROLE DE RECEBÍVEIS
FICHA CADASTRAL DO CLIENTE / COMPRADOR
================================================================================
CLIENTE: ${debtor.name}
ID DO CADASTRO: ${debtor.id}
DOCUMENTO / CPF: ${debtor.documentNumber || debtor.cpfCnpj || 'Não informado'}
TELEFONE / WHATSAPP: ${debtor.phone || 'Não informado'}
VÍNCULO / RELAÇÃO: ${debtor.relation || 'Cliente'}
SCORE DE PONTUALIDADE: ${debtor.score || 850}/1000 (${debtor.scoreTier ? debtor.scoreTier.toUpperCase() : 'BOM'})
PONTUALIDADE: ${debtor.onTimePaymentsCount || 0} no prazo, ${debtor.latePaymentsCount || 0} em atraso
LIMITE CEDIDO: R$ ${(debtor.creditLimit || 3000).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
CHAVE PIX: ${debtor.pixKey || debtor.email || 'Não informada'}
DATA DE CADASTRO: ${debtor.createdAt ? new Date(debtor.createdAt).toLocaleDateString('pt-BR') : dateStr}
ÚLTIMA SINCRONIZAÇÃO: ${now.toLocaleString('pt-BR')}
OBSERVAÇÕES: ${debtor.notes || 'Sem observações adicionais'}
================================================================================
`;

  fs.writeFileSync(filePath, content, 'utf-8');
  return content;
}

// 2. Registra movimentação no movimentacoes.txt
export function appendMovimentacaoTxt(
  clientName: string,
  entry: {
    tipo: string;
    descricao: string;
    valor?: number;
    origem?: string;
    idMovimentacao?: string;
  }
): string {
  const dir = getClientHistoryDir(clientName);
  const filePath = path.join(dir, 'movimentacoes.txt');
  const now = new Date();
  const timeStr = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}`;

  const header = fs.existsSync(filePath)
    ? ''
    : `================================================================================
HASPAHO TECNOLOGIA DA INFORMAÇÃO • LIVRO DE MOVIMENTAÇÕES
CLIENTE: ${clientName}
================================================================================\n\n`;

  const line = `[${timeStr}] [${entry.tipo.toUpperCase()}]
ORIGEM: ${entry.origem || 'Comando enviado ao Gemini'}
ID: ${entry.idMovimentacao || 'MOV-' + Date.now()}
${entry.valor ? `VALOR: R$ ${entry.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` : ''}DETALHES: ${entry.descricao}
--------------------------------------------------------------------------------\n`;

  fs.appendFileSync(filePath, header + line, 'utf-8');
  return fs.readFileSync(filePath, 'utf-8');
}

// 3. Registra pagamento no pagamentos.txt
export function appendPagamentoTxt(
  clientName: string,
  payment: {
    valor: number;
    tipo: 'informado' | 'confirmado';
    status: string;
    origem?: string;
    idMovimentacao: string;
    observacao?: string;
    dataConfirmacao?: string;
    saldoAtualizado?: number;
    parcelaRef?: string;
  }
): string {
  const dir = getClientHistoryDir(clientName);
  const filePath = path.join(dir, 'pagamentos.txt');
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR');
  const timeStr = now.toLocaleString('pt-BR');

  const header = fs.existsSync(filePath)
    ? ''
    : `================================================================================
HASPAHO TECNOLOGIA DA INFORMAÇÃO • HISTÓRICO OFICIAL DE PAGAMENTOS
CLIENTE: ${clientName}
ESTRUTURA DE AUDITORIA CONFORME DIRETRIZES DO SISTEMA
================================================================================\n\n`;

  let block = '';
  if (payment.tipo === 'informado') {
    block = `CLIENTE: ${clientName}
DATA DO REGISTRO: ${dateStr}
VALOR INFORMADO: R$ ${payment.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
TIPO DE MOVIMENTAÇÃO: Pagamento
STATUS: ${payment.status || 'Aguardando confirmação'}
ORIGEM: ${payment.origem || 'Comando enviado ao Gemini'}
ID DA MOVIMENTAÇÃO: ${payment.idMovimentacao}
OBSERVAÇÃO: ${payment.observacao || 'Pagamento informado pelo usuário.'}
${payment.parcelaRef ? `PARCELA REFERÊNCIA: ${payment.parcelaRef}\n` : ''}--------------------------------------------------------------------------------\n\n`;
  } else {
    // Pagamento confirmado e validado
    block = `CLIENTE: ${clientName}
DATA DO REGISTRO: ${dateStr}
TIPO DE MOVIMENTAÇÃO: Pagamento
STATUS: Pagamento confirmado
VALOR CONFIRMADO: R$ ${payment.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
DATA DA CONFIRMAÇÃO: ${payment.dataConfirmacao || timeStr}
SALDO ATUALIZADO: R$ ${(payment.saldoAtualizado ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
ORIGEM: ${payment.origem || 'Comando enviado ao Gemini'}
ID DA MOVIMENTAÇÃO: ${payment.idMovimentacao}
OBSERVAÇÃO: ${payment.observacao || 'Pagamento validado e registrado oficialmente.'}
--------------------------------------------------------------------------------\n\n`;
  }

  fs.appendFileSync(filePath, header + block, 'utf-8');
  return fs.readFileSync(filePath, 'utf-8');
}

// 4. Atualiza status_financeiro.txt
export function syncStatusFinanceiroTxt(debtor: any, stats?: {
  totalOwed: number;
  totalPaid: number;
  totalInstallments?: number;
  paidInstallments?: number;
  pendingInstallments?: number;
  overdueInstallments?: number;
  nextDueDate?: string;
  lastPaymentDate?: string;
}): string {
  const dir = getClientHistoryDir(debtor.name);
  const filePath = path.join(dir, 'status_financeiro.txt');
  const now = new Date();

  const totalOwed = stats?.totalOwed ?? debtor.totalOwed ?? 0;
  const totalPaid = stats?.totalPaid ?? debtor.totalPaid ?? 0;
  const totalContratado = totalOwed + totalPaid;

  const content = `================================================================================
HASPAHO TECNOLOGIA DA INFORMAÇÃO • STATUS FINANCEIRO CONSOLIDADO
CLIENTE: ${debtor.name}
DATA DA CONFERÊNCIA: ${now.toLocaleString('pt-BR')}
================================================================================
VALOR TOTAL CONTRATADO: R$ ${totalContratado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
TOTAL EFETIVAMENTE PAGO: R$ ${totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
SALDO DEVEDOR ATUALIZADO: R$ ${totalOwed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

SITUAÇÃO DAS PARCELAS:
- Total de parcelas: ${stats?.totalInstallments ?? 'Verificar contrato'}
- Parcelas quitadas: ${stats?.paidInstallments ?? 0}
- Parcelas pendentes: ${stats?.pendingInstallments ?? 0}
- Parcelas em atraso: ${stats?.overdueInstallments ?? (debtor.overdueCount || 0)}
- Próximo vencimento: ${stats?.nextDueDate || debtor.nextDueDate || 'Sem parcelas pendentes'}

CLASSIFICAÇÃO DE RISCO / SCORE:
- Pontuação de Pontualidade: ${debtor.score || 850}/1000
- Classificação: ${debtor.scoreTier ? debtor.scoreTier.toUpperCase() : 'BOM'}
- Situação Geral: ${totalOwed <= 0 ? 'DÍVIDA INTEGRALMENTE QUITADA' : (debtor.overdueCount > 0 ? 'EM ATRASO' : 'REGULAR / EM DIA')}

AUDITORIA & INTEGRIDADE:
- Registro sincronizado entre banco de dados oficial e arquivos TXT
- Registros mantidos para fins de auditoria e exportação
================================================================================
`;

  fs.writeFileSync(filePath, content, 'utf-8');
  return content;
}

// Lista todas as pastas de histórico de clientes e seus arquivos
export function listAllClientHistories(): Array<{
  clientName: string;
  folderName: string;
  files: Array<{ name: string; size: number; updatedAt: string }>;
}> {
  ensureBaseDir();
  const folders = fs.readdirSync(BASE_HISTORICO_DIR);
  const result: any[] = [];

  for (const folder of folders) {
    const fullFolderPath = path.join(BASE_HISTORICO_DIR, folder);
    if (!fs.statSync(fullFolderPath).isDirectory()) continue;

    const files = fs.readdirSync(fullFolderPath);
    const fileList: any[] = [];

    for (const f of files) {
      const fullFilePath = path.join(fullFolderPath, f);
      const stat = fs.statSync(fullFilePath);
      fileList.push({
        name: f,
        size: stat.size,
        updatedAt: stat.mtime.toISOString(),
      });
    }

    result.push({
      clientName: folder.replace(/_/g, ' '),
      folderName: folder,
      files: fileList,
    });
  }

  return result;
}

// Lê um arquivo TXT de um cliente específico
export function readClientTxtFile(folderName: string, fileName: string): string | null {
  ensureBaseDir();
  const safeFolder = path.basename(folderName);
  const safeFile = path.basename(fileName);
  const targetPath = path.join(BASE_HISTORICO_DIR, safeFolder, safeFile);

  if (!fs.existsSync(targetPath)) return null;
  return fs.readFileSync(targetPath, 'utf-8');
}
