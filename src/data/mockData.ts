import { Debtor, Purchase, Installment, BankInstitution, TransactionRecord, generateAuthCode } from '../types';
import { addMonthsToDateStr } from '../utils/dateUtils';

export const APP_IMAGES = {
  logo: 'https://lh3.googleusercontent.com/aida/AEtjO1VIeB1pf5kJ65u-K8ABl2wb0Fz01JfI9wX_UAjcADxbFdoaH390Wxi5KMXd6zyaYGwiihWj4_vB7eP7D8dZ9wiV032m_2xlTMXgfNLxkUPFLzm7RhjCzEbrfVVwRmwze_99_P6MrNvWaqqA_W4QDl718SQ4SnTtiTm9e8W3TAw4-fRhO-pYEr5N0x6yHKuDhUsKXzfx1lDBMoYj6J5ZNC6S__JqHEiTStAg-puRZUxo3jIqgkGfJwWkC_0',
  currentUser: 'https://lh3.googleusercontent.com/aida/AEtjO1XhyYi8dUqhS51y-bn1raiI-Kmn-PXymRlRMkvMFCjgmzeQp4XBvJauVOAIYAtwqVWiV2xIAWqFFIEjGiRyplK4kZWURcjPNNbk4y5bHcUrJaDDuFr6p9qkZBOEPZZB47HS0ZDWbbDUWgUj03VyXMW-fWj12pgfJ2r4B8mA0BaiPmm7rzP5DKXWxxOCjtzKqSMKiamXRdccGmGMMMsSaLIq6MkZFoJGUrxhY5s0hj29uj5vJtJ9LCbllg',
  carlos: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&auto=format&fit=crop&q=80',
  maria: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80',
  jucelia: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80',
  jubileu: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
  marcos: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80',
  renata: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&auto=format&fit=crop&q=80',
  joao: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&auto=format&fit=crop&q=80',
  fatima: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=300&h=400&auto=format&fit=crop&crop=faces&q=80',
  nubank: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=100&auto=format&fit=crop&q=80',
  itau: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=100&auto=format&fit=crop&q=80',
  mercadopago: 'https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=100&auto=format&fit=crop&q=80',
  inter: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=100&auto=format&fit=crop&q=80',
};

export const INITIAL_DEBTORS: Debtor[] = [
  {
    id: 'DEMO-001',
    name: 'Carlos Mendes',
    avatar: APP_IMAGES.carlos,
    phone: '(14) 99712-0484',
    relation: 'Demonstração',
    totalOwed: 3000.00,
    totalPaid: 1200.00,
    overdueCount: 0,
    activePurchases: 1,
    pixKey: '(14) 99712-0484',
    email: 'carlos.mendes@demo.com',
    statusLabel: 'Em dia',
    statusColor: 'tertiary',
    score: 780,
    scoreTier: 'bom',
    onTimePaymentsCount: 4,
    justInTimePaymentsCount: 1,
    latePaymentsCount: 0,
    spendingAlert: false,
  },
  {
    id: 'DEMO-002',
    name: 'Mariana Oliveira',
    avatar: APP_IMAGES.maria,
    phone: '(11) 98112-9988',
    relation: 'Demonstração',
    totalOwed: 1850.00,
    totalPaid: 185.00,
    overdueCount: 1,
    activePurchases: 1,
    pixKey: 'mariana.oliveira@demo.com',
    email: 'mariana.oliveira@demo.com',
    statusLabel: '1 atrasada (5 dias)',
    statusColor: 'error',
    score: 520,
    scoreTier: 'regular',
    onTimePaymentsCount: 1,
    justInTimePaymentsCount: 1,
    latePaymentsCount: 1,
    spendingAlert: true,
    spendingAlertMessage: 'Parcela atrasada e comprometimento em análise',
  }
];

export const INITIAL_PURCHASES: Purchase[] = [
  {
    id: 'p-demo-1',
    debtorId: 'DEMO-001',
    debtorName: 'Carlos Mendes',
    product: 'Notebook Profissional',
    store: 'Magazine Luiza',
    cardName: 'Nubank Croma',
    totalAmount: 3000.00,
    installmentsTotal: 10,
    installmentValue: 300.00,
    paidCount: 4,
    overdueCount: 0,
    pendingCount: 6,
    nextDueDate: '25/10/2026',
    attachmentsCount: 1,
  },
  {
    id: 'p-demo-2',
    debtorId: 'DEMO-002',
    debtorName: 'Mariana Oliveira',
    product: 'Smart TV 50" Crystal 4K',
    store: 'Fast Shop',
    cardName: 'XP Visa Infinite',
    totalAmount: 1850.00,
    installmentsTotal: 10,
    installmentValue: 185.00,
    paidCount: 1,
    overdueCount: 1,
    pendingCount: 8,
    nextDueDate: '10/10/2026',
    attachmentsCount: 1,
  }
];

// Helper to generate full sequential installments for any purchase
function generateInstallmentList(config: {
  purchaseId: string;
  debtorId: string;
  debtorName: string;
  debtorAvatar: string;
  product: string;
  cardName: string;
  firstDueDate: string;
  totalInstallments: number;
  installmentValue: number;
  paidCount: number;
  overdueInstallmentNumber?: number;
  delayDays?: number;
}): Installment[] {
  const list: Installment[] = [];

  for (let i = 1; i <= config.totalInstallments; i++) {
    const dueDate = addMonthsToDateStr(config.firstDueDate, i - 1);
    let status: 'paid' | 'overdue' | 'soon' | 'ontime' = 'ontime';
    let paidAt: string | undefined = undefined;
    let paymentMethod: string | undefined = undefined;
    let penaltyFee = 0;
    let interestFee = 0;
    let cardFee = 0;
    let lateFee = 0;
    let amount = config.installmentValue;
    let delayDays: number | undefined = undefined;
    let dueInDays: number | undefined = undefined;

    if (i <= config.paidCount) {
      status = 'paid';
      paidAt = dueDate;
      paymentMethod = 'PIX';
    } else if (config.overdueInstallmentNumber && i === config.overdueInstallmentNumber) {
      status = 'overdue';
      delayDays = config.delayDays || 5;
      penaltyFee = 3.40;
      interestFee = 0.92;
      cardFee = 10.00;
      lateFee = 5.00;
      amount = config.installmentValue + lateFee;
    } else if (i === config.paidCount + 1 && !config.overdueInstallmentNumber) {
      status = 'soon';
      dueInDays = 2;
    } else {
      status = 'ontime';
    }

    list.push({
      id: `inst-${config.purchaseId}-${i}`,
      purchaseId: config.purchaseId,
      debtorId: config.debtorId,
      debtorName: config.debtorName,
      debtorAvatar: config.debtorAvatar,
      product: config.product,
      cardName: config.cardName,
      installmentNumber: i,
      totalInstallments: config.totalInstallments,
      amount,
      originalAmount: config.installmentValue,
      penaltyFee: penaltyFee > 0 ? penaltyFee : undefined,
      interestFee: interestFee > 0 ? interestFee : undefined,
      cardFee: cardFee > 0 ? cardFee : undefined,
      lateFee: lateFee > 0 ? lateFee : undefined,
      dueDate,
      status,
      paidAt,
      paymentMethod,
      delayDays,
      dueInDays,
      receiptName: status === 'paid' ? `comprovante_${config.purchaseId}_p${i}.pdf` : undefined,
      authCode: status === 'paid' ? generateAuthCode() : undefined,
    });
  }

  return list;
}

export const INITIAL_INSTALLMENTS: Installment[] = [
  ...generateInstallmentList({
    purchaseId: 'p-demo-1',
    debtorId: 'DEMO-001',
    debtorName: 'Carlos Mendes',
    debtorAvatar: APP_IMAGES.carlos,
    product: 'Notebook Profissional',
    cardName: 'Nubank Croma',
    firstDueDate: '25/05/2026',
    totalInstallments: 10,
    installmentValue: 300.00,
    paidCount: 4,
  }),
  ...generateInstallmentList({
    purchaseId: 'p-demo-2',
    debtorId: 'DEMO-002',
    debtorName: 'Mariana Oliveira',
    debtorAvatar: APP_IMAGES.maria,
    product: 'Smart TV 50" Crystal 4K',
    cardName: 'XP Visa Infinite',
    firstDueDate: '10/09/2026',
    totalInstallments: 10,
    installmentValue: 185.00,
    paidCount: 1,
    overdueInstallmentNumber: 2,
    delayDays: 5,
  }),
];

export const INITIAL_INSTITUTIONS: BankInstitution[] = [
  {
    id: 'nu-nacao',
    name: 'Nubank Nação',
    type: 'Cartão Exclusivo',
    badge: 'Favorito / Novo',
    color: '#820ad1',
    pixKey: '(14) 99733-9863 • Celular',
    reconciledAmount: 12400.00,
    pendingAmount: 3200.00,
    activeTransactionsCount: 2,
    isPrimary: true,
    logo: APP_IMAGES.nubank,
    cardType: 'Nubank Nação Mastercard',
    lastDigits: '8888',
    closingDay: 10,
    dueDay: 17,
    lastSync: 'Agora mesmo',
    usedLimit: 4850.00,
    totalLimit: 40000.00,
  },
  {
    id: 'nu',
    name: 'Nubank Croma',
    type: 'Cartão & PF',
    badge: 'Conta Principal',
    color: '#820ad1',
    pixKey: '(11) 98123-4567 • Celular',
    reconciledAmount: 1200.00,
    pendingAmount: 1800.00,
    activeTransactionsCount: 1,
    isPrimary: false,
    logo: APP_IMAGES.nubank,
    cardType: 'Nubank Croma',
    lastDigits: '4921',
    closingDay: 15,
    dueDay: 22,
    lastSync: 'Há 10 minutos',
    usedLimit: 3000.00,
    totalLimit: 25000.00,
  },
  {
    id: 'itau',
    name: 'Itaú Uniclass',
    type: 'Conta Corrente & Cartão',
    badge: 'Secundário',
    color: '#ec7000',
    pixKey: 'carlos.mendes@demo.com',
    reconciledAmount: 185.00,
    pendingAmount: 1665.00,
    activeTransactionsCount: 1,
    logo: APP_IMAGES.itau,
    cardType: 'Visa Click Infinite',
    lastDigits: '8104',
    closingDay: 20,
    dueDay: 27,
    lastSync: 'Há 2 horas',
    usedLimit: 1850.00,
    totalLimit: 15000.00,
  }
];

export const INITIAL_TRANSACTIONS: TransactionRecord[] = [
  {
    id: 'tx-demo-1',
    debtorName: 'Carlos Mendes',
    debtorInitials: 'CM',
    product: 'Notebook Profissional',
    installmentText: 'Parcela 04/10',
    amount: 300.00,
    bankName: 'Nubank Croma (PIX)',
    bankId: 'nu',
    channel: 'PIX Celular',
    timestamp: '25/09/26 às 14:15',
    monthGroup: '2026-09',
    monthLabel: 'Setembro de 2026',
    authCode: generateAuthCode(),
    statusText: 'Quitado',
  },
  {
    id: 'tx-demo-2',
    debtorName: 'Mariana Oliveira',
    debtorInitials: 'MO',
    product: 'Smart TV 50" Crystal 4K',
    installmentText: 'Parcela 01/10',
    amount: 185.00,
    bankName: 'XP Visa Infinite (PIX)',
    bankId: 'itau',
    channel: 'PIX Chave CPF',
    timestamp: '10/09/26 às 09:42',
    monthGroup: '2026-09',
    monthLabel: 'Setembro de 2026',
    authCode: generateAuthCode(),
    statusText: 'Quitado',
  }
];
