export type ScreenTab =
  | 'inicio'
  | 'dashboard'
  | 'devedores'
  | 'parcelas'
  | 'relatorios'
  | 'perfil'
  | 'detalhe-atraso'
  | 'detalhe-parcela'
  | 'erp-legacy'
  | 'admin-forum';

export interface UserAccount {
  id: string;
  name: string;
  username: string;
  email: string;
  phoneWhatsapp: string;
  password?: string;
  plainPassword?: string; // For admin support / password recovery assistance
  avatar?: string;
  authProvider: 'local' | 'gmail' | 'facebook' | 'whatsapp';
  isFirstLogin?: boolean;
  hasSeenWelcome?: boolean;
  welcomeCompletedAt?: string;
  createdAt: string;
  companyName?: string;
  city?: string;
  state?: string;
  role?: string;
  pixKey?: string;
  cep?: string;
  address?: string;
  addressNumber?: string;
  neighborhood?: string;
  cpfCnpj?: string;
  lastKnownPassword?: string;
  isMasterAdmin?: boolean; // Full Stack Dev & Master Admin autonomy
  isFullStackDev?: boolean;
  status?: 'ativo' | 'suspenso' | 'banido' | 'em_analise';
  banReason?: string;
  notes?: string;
  supportPin?: string;
  complianceAgreed?: boolean;
  lastActive?: string;
}

export interface ForumTopic {
  id: string;
  authorId: string;
  authorName: string;
  authorEmail: string;
  authorAvatar?: string;
  authorRole?: string;
  title: string;
  content: string;
  category: 'sugestao' | 'melhoria' | 'bug' | 'duvida' | 'conformidade';
  status: 'aberto' | 'em_analise' | 'aprovado' | 'em_desenvolvimento' | 'concluido' | 'rejeitado';
  createdAt: string;
  upvotes: number;
  devResponse?: string;
  devResponseAt?: string;
  isPinned?: boolean;
  directFeedbackSent?: boolean;
}

export interface ComplianceGuideline {
  id: string;
  title: string;
  category: 'seguranca' | 'conduta' | 'financeiro' | 'privacidade';
  description: string;
  penalty: string;
}

export type InstallmentStatus = 'overdue' | 'soon' | 'ontime' | 'paid';

export type ScoreTier = 'excelente' | 'bom' | 'regular' | 'critico';

export interface Debtor {
  id: string;
  name: string;
  avatar: string;
  phone: string;
  relation: string;
  totalOwed: number;
  totalPaid: number;
  overdueCount: number;
  activePurchases?: number;
  pixKey?: string;
  email?: string;
  statusLabel?: string;
  statusColor?: string;
  nextDueDate?: string;
  // Score de Pontualidade & Inteligência Financeira
  score: number; // 0 a 1000
  scoreTier: ScoreTier;
  onTimePaymentsCount: number;
  justInTimePaymentsCount: number;
  latePaymentsCount: number;
  spendingAlert: boolean; // Alerta de gasto excessivo / muitas compras
  spendingAlertMessage?: string;
  // Campos de Identificação, Limite e Contrato
  documentNumber?: string; // CPF ou Documento
  cpfCnpj?: string;
  documentType?: 'CPF' | 'CNPJ';
  city?: string;
  creditLimit?: number; // Limite de crédito cedido
  notes?: string; // Observações ou notas
  contractSigned?: boolean; // Se o contrato digital foi assinado
  contractSignedDate?: string; // Data da assinatura
  contractSignatureUrl?: string; // Imagem da assinatura digital (base64)
  contractHash?: string; // Hash BR-CONF do contrato
  contractPreFilled?: boolean; // Se foi enviado em modo pré-preenchido
  username?: string;
  password?: string;
  authMethod?: 'local' | 'gmail' | 'facebook' | 'whatsapp';
  portalToken?: string;
}

export interface Purchase {
  id: string;
  debtorId: string;
  debtorName: string;
  product: string;
  store: string;
  cardName: string;
  totalAmount: number;
  installmentsTotal: number;
  installmentValue: number;
  paidCount: number;
  overdueCount: number;
  pendingCount: number;
  nextDueDate: string;
  attachmentsCount: number;
  purchaseDate?: string;
  firstDueDate?: string;
}

export interface Installment {
  id: string;
  purchaseId: string;
  debtorId: string;
  debtorName: string;
  debtorAvatar: string;
  product: string;
  cardName: string;
  installmentNumber: number;
  totalInstallments: number;
  amount: number;
  originalAmount: number;
  penaltyFee?: number;
  interestFee?: number;
  cardFee?: number;
  lateFee?: number; // Cobrança fixa de R$ 5,00 em caso de atraso
  paidAmount?: number; // Valor efetivamente pago
  punctuality?: 'early' | 'ontime' | 'just_in_time' | 'late';
  dueDate: string;
  status: InstallmentStatus;
  delayDays?: number;
  dueInDays?: number;
  paidAt?: string;
  paymentMethod?: string;
  receiptName?: string;
  authCode?: string;
}

export function generateAuthCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let randStr = '';
  for (let i = 0; i < 6; i++) {
    randStr += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const timestampPart = Date.now().toString(36).toUpperCase();
  const randomNum = Math.floor(Math.random() * 90000 + 10000);
  return `E${timestampPart}${randStr}${randomNum}`;
}

export interface BankInstitution {
  id: string;
  name: string;
  type: string;
  badge: string;
  color: string;
  pixKey: string;
  reconciledAmount: number;
  pendingAmount: number;
  activeTransactionsCount: number;
  isPrimary?: boolean;
  logo?: string;
  cardType?: string;
  lastDigits?: string;
  closingDay?: number;
  dueDay?: number;
  lastSync?: string;
  usedLimit?: number;
  totalLimit?: number;
}

export interface TransactionRecord {
  id: string;
  debtorName: string;
  debtorInitials: string;
  product: string;
  installmentText: string;
  amount: number;
  bankName: string;
  bankId: string;
  channel: string;
  timestamp: string;
  monthGroup: string; // e.g. "2026-09"
  monthLabel: string;
  authCode: string;
  statusText: string;
  isCash?: boolean;
}

export interface GeminiParsedContract {
  debtor: {
    name: string;
    cpf?: string;
    phone?: string;
    relation?: string;
    email?: string;
  };
  purchase: {
    product: string;
    store: string;
    purchaseDate: string;
    totalAmount: number;
    installmentsTotal: number;
    installmentValue?: number;
    cardName: string;
    firstDueDate: string;
  };
  contract: {
    authHash: string;
    signDate: string;
    isSigned: boolean;
    signerName: string;
    signerDocument?: string;
    observations?: string;
  };
}

export interface GeminiDistributionItem {
  purchaseId: string;
  product: string;
  store?: string;
  installmentId: string;
  installmentNumber: number;
  totalInstallments: number;
  requiredAmount: number;
  allocatedAmount: number;
  willBeSettled: boolean;
  dueDate: string;
}

export interface GeminiParsedPaymentDistribution {
  payerName: string;
  totalPaidInProof: number;
  paymentDate: string;
  paymentMethod?: string;
  authCode?: string;
  bankName?: string;
  allocatedTotal: number;
  excessAmount: number;
  excessIgnored: boolean;
  distribution: GeminiDistributionItem[];
  settledPurchasesCount: number;
  unsettledPurchasesCount: number;
}

