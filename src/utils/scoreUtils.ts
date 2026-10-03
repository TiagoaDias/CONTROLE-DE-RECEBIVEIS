import { Debtor, Installment, Purchase, ScoreTier } from '../types';

export const FIXED_LATE_FEE = 0.00; // Ausência de taxa administrativa arbitrária em auxílio entre particulares

export interface ScoreBreakdown {
  score: number;
  tier: ScoreTier;
  tierLabel: string;
  tierColor: string;
  tierBg: string;
  tierBorder: string;
  onTimeCount: number;
  justInTimeCount: number;
  lateCount: number;
  currentOverdueCount: number;
  totalDelayDays: number;
  reasons: string[];
}

/**
 * Calcula automaticamente o Score de Pontualidade (0 a 1000) do devedor
 * Baseado no histórico de pagamentos, atrasos atuais, pagamentos em cima da hora e pontualidade geral.
 */
export function calculateDebtorScore(
  debtor: Partial<Debtor>,
  debtorInstallments: Installment[],
  debtorPurchases?: Purchase[]
): ScoreBreakdown {
  // Pontuação base neutra para novos cadastros
  let score = 700;
  const reasons: string[] = [];

  const paidList = debtorInstallments.filter((i) => i.status === 'paid');
  const overdueList = debtorInstallments.filter((i) => i.status === 'overdue');
  
  let onTimeCount = 0;
  let justInTimeCount = 0;
  let lateCount = 0;
  let totalDelayDays = 0;

  // Analisa pagamentos quitados
  paidList.forEach((item) => {
    if (item.punctuality === 'late' || (item.delayDays && item.delayDays > 0)) {
      lateCount += 1;
      score -= 40;
    } else if (item.punctuality === 'just_in_time') {
      justInTimeCount += 1;
      score += 15;
    } else {
      // Pontual ou antecipado
      onTimeCount += 1;
      score += 45;
    }
  });

  if (onTimeCount > 0) {
    reasons.push(`+${onTimeCount * 45} pts: ${onTimeCount} parcelas pagas em dia`);
  }
  if (justInTimeCount > 0) {
    reasons.push(`+${justInTimeCount * 15} pts: ${justInTimeCount} pagamentos em cima da hora`);
  }
  if (lateCount > 0) {
    reasons.push(`-${lateCount * 40} pts: ${lateCount} parcelas pagas com atraso anterior`);
  }

  // Penalidade severa para atrasos ATUAIS em aberto
  overdueList.forEach((item) => {
    const days = item.delayDays || 9;
    totalDelayDays += days;
    score -= 140; // Penalidade por parcela vencida
    score -= Math.min(60, days * 5); // Penalidade proporcional aos dias de atraso
  });

  if (overdueList.length > 0) {
    reasons.push(
      `-${overdueList.length * 140 + Math.min(60, totalDelayDays * 5)} pts: ${overdueList.length} parcela(s) atualmente em atraso (${totalDelayDays} dias)`
    );
  }

  // Penalidade se o devedor acumular muitas compras ao mesmo tempo
  const activePurchasesCount = debtorPurchases
    ? debtorPurchases.filter((p) => p.pendingCount > 0).length
    : debtor.activePurchases || 0;

  if (activePurchasesCount >= 3) {
    score -= 50;
    reasons.push(`-50 pts: Risco de sobre-endividamento (${activePurchasesCount} compras ativas simultâneas)`);
  }

  // Normalização do score entre 0 e 1000
  score = Math.max(0, Math.min(1000, Math.round(score)));

  // Determinação da faixa (Tier)
  let tier: ScoreTier = 'bom';
  let tierLabel = 'Bom';
  let tierColor = 'text-blue-700';
  let tierBg = 'bg-blue-50';
  let tierBorder = 'border-blue-200';

  if (score >= 800) {
    tier = 'excelente';
    tierLabel = 'Excelente';
    tierColor = 'text-emerald-700';
    tierBg = 'bg-emerald-50';
    tierBorder = 'border-emerald-200';
  } else if (score >= 650) {
    tier = 'bom';
    tierLabel = 'Bom';
    tierColor = 'text-blue-700';
    tierBg = 'bg-blue-50';
    tierBorder = 'border-blue-200';
  } else if (score >= 450) {
    tier = 'regular';
    tierLabel = 'Regular';
    tierColor = 'text-amber-700';
    tierBg = 'bg-amber-50';
    tierBorder = 'border-amber-200';
  } else {
    tier = 'critico';
    tierLabel = 'Crítico';
    tierColor = 'text-red-700';
    tierBg = 'bg-red-50';
    tierBorder = 'border-red-200';
  }

  return {
    score,
    tier,
    tierLabel,
    tierColor,
    tierBg,
    tierBorder,
    onTimeCount,
    justInTimeCount,
    lateCount,
    currentOverdueCount: overdueList.length,
    totalDelayDays,
    reasons,
  };
}

/**
 * Verifica se a pessoa está acumulando muitas compras e acende o sinal de alerta
 * "gastando mais do que ganha / risco de comprometimento da renda"
 */
export function evaluateSpendingAlert(
  debtor: Debtor,
  purchases: Purchase[],
  installments: Installment[]
): {
  isAlert: boolean;
  message: string;
  activeCount: number;
  monthlyCommitment: number;
} {
  const debtorPurchases = purchases.filter(
    (p) => p.debtorId === debtor.id && p.pendingCount > 0
  );
  const activeCount = debtorPurchases.length;

  // Calcula quanto essa pessoa precisa pagar por mês somando todas as parcelas ativas
  const monthlyCommitment = debtorPurchases.reduce(
    (acc, p) => acc + (p.installmentValue || 0),
    0
  );

  // Regra: Alerta se tiver 3 ou mais compras ativas OU dívida total > R$ 2.500,00 OU parcela mensal acima de R$ 500,00
  const totalOwedNum = debtor.totalOwed || 0;
  const overdueCountNum = debtor.overdueCount || 0;
  const isAlert =
    activeCount >= 2 ||
    totalOwedNum >= 2500 ||
    monthlyCommitment >= 400 ||
    overdueCountNum > 0;

  let message = '';
  if (activeCount >= 3) {
    message = `⚠️ Sinal de Alerta: ${activeCount} compras ativas simultâneas! Comprometimento financeiro elevado.`;
  } else if (overdueCountNum > 0 && activeCount >= 2) {
    message = `⚠️ Sinal de Alerta: Gastando mais do que ganha (atraso registrado + ${activeCount} compras acumuladas).`;
  } else if (totalOwedNum >= 3000) {
    message = `⚠️ Sinal de Alerta: Dívida acumulada de R$ ${totalOwedNum.toFixed(2).replace('.', ',')} acima do teto recomendado.`;
  } else if (isAlert) {
    message = `⚠️ Sinal de Alerta: Comprometimento mensal de R$ ${monthlyCommitment.toFixed(2).replace('.', ',')} em compras ativas.`;
  }

  return {
    isAlert,
    message,
    activeCount,
    monthlyCommitment,
  };
}

/**
 * Calcula o valor total a ser pago de uma parcela, incluindo
 * a cobrança obrigatória de R$ 5,00 caso esteja em atraso.
 */
export function calculateInstallmentTotalWithLateFee(
  installment: Installment,
  applyLateFeeIfOverdue = true
): {
  originalAmount: number;
  lateFee: number;
  totalToPay: number;
  isOverdue: boolean;
} {
  const isOverdue = installment.status === 'overdue' || (installment.delayDays || 0) > 0;
  const lateFee = isOverdue && applyLateFeeIfOverdue ? FIXED_LATE_FEE : 0;
  const totalToPay = installment.originalAmount + lateFee;

  return {
    originalAmount: installment.originalAmount,
    lateFee,
    totalToPay,
    isOverdue,
  };
}


/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
export function evaluateCashbackFromPayment(
  amountDue: number,
  amountPaid: number
): {
  isOverpaid: boolean;
  cashbackAmount: number;
  message: string;
} {
  return {
    isOverpaid: false,
    cashbackAmount: 0,
    message: '',
  };
}
