import { playLevelUpSound, playSuccessSound, triggerCelebrationConfetti } from './soundEffects';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  xpReward: number;
  unlocked: boolean;
  unlockedAt?: string;
  category: 'iniciante' | 'vendas' | 'cobranca' | 'mestre';
}

export interface DailyQuest {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  targetCount: number;
  currentCount: number;
  completed: boolean;
  icon: string;
}

export interface GamificationState {
  totalXp: number;
  level: number;
  levelTitle: string;
  levelIcon: string;
  xpForCurrentLevel: number;
  xpForNextLevel: number;
  progressPercent: number;
  achievements: Achievement[];
  dailyQuests: DailyQuest[];
  questDate: string;
  streaks: number;
  lastActiveDate: string;
}

const GAMIFICATION_STORAGE_KEY = 'haspaho_gamification_state_v1';

export const LEVEL_TIERS = [
  { level: 1, title: 'Iniciante nos Recebíveis', icon: '🌱', minXp: 0, maxXp: 120 },
  { level: 2, title: 'Organizador Financeiro', icon: '📋', minXp: 120, maxXp: 300 },
  { level: 3, title: 'Cobrador Veloz', icon: '⚡', minXp: 300, maxXp: 600 },
  { level: 4, title: 'Guardião do Caixa', icon: '🛡️', minXp: 600, maxXp: 1100 },
  { level: 5, title: 'Mestre das Parcelas', icon: '🎯', minXp: 1100, maxXp: 1800 },
  { level: 6, title: 'Barão do PIX', icon: '💎', minXp: 1800, maxXp: 2800 },
  { level: 7, title: 'Tubarão Financeiro', icon: '🦈', minXp: 2800, maxXp: 4200 },
  { level: 8, title: 'Lenda do ERP', icon: '👑', minXp: 4200, maxXp: 6000 },
  { level: 9, title: 'Magnata dos Recebíveis', icon: '🚀', minXp: 6000, maxXp: 99999 },
];

export const INITIAL_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_payment',
    title: 'Primeiro PIX na Conta',
    description: 'Liquidou sua primeira parcela no sistema com chave de autenticação.',
    icon: '🎯',
    xpReward: 80,
    unlocked: false,
    category: 'iniciante',
  },
  {
    id: 'whatsapp_nudge',
    title: 'Cobrança Relâmpago',
    description: 'Enviou um lembrete amigável com 1 clique direto para o WhatsApp.',
    icon: '⚡',
    xpReward: 50,
    unlocked: false,
    category: 'cobranca',
  },
  {
    id: 'three_debtors',
    title: 'Carteira em Expansão',
    description: 'Cadastrou 3 ou mais clientes ativos na sua carteira de recebíveis.',
    icon: '💼',
    xpReward: 100,
    unlocked: false,
    category: 'vendas',
  },
  {
    id: 'ten_payments',
    title: 'Mestre do Fluxo de Caixa',
    description: 'Acumulou 10 parcelas recebidas e auditadas com sucesso.',
    icon: '💎',
    xpReward: 250,
    unlocked: false,
    category: 'mestre',
  },
  {
    id: 'authentic_receipt',
    title: 'Recibo Blindado',
    description: 'Gerou comprovante ou extrato oficial autenticado com QR Code.',
    icon: '📜',
    xpReward: 70,
    unlocked: false,
    category: 'iniciante',
  },
  {
    id: 'radar_master',
    title: 'Inadimplência Zero',
    description: 'Manteve todas as parcelas em dia sem atrasos pendentes no radar.',
    icon: '🛡️',
    xpReward: 200,
    unlocked: false,
    category: 'cobranca',
  },
];

export const BUSINESS_TIPS = [
  '☕ Dica de Ouro: Cobrar no WhatsApp pela manhã (entre 9h e 11h) aumenta o pagamento no mesmo dia em até 40%!',
  '🎯 Quanto mais rápido você registra uma venda, menor a chance de esquecer parcelas futuras.',
  '💬 Cobrança amigável e com comprovante profissional gera respeito e fideliza o cliente.',
  '🚀 Ao liquidar parcelas, o score do cliente sobe e seu fluxo de caixa fica transparente.',
  '💎 Use o Extrato Total com QR Code para passar total credibilidade e evitar contestações.',
  '🛡️ O Radar de Cobrança avisa antes do vencimento para você não passar sufoco no fim do mês.',
  '⚡ 1 clique no botão de WhatsApp já monta a mensagem com valor, chave PIX e data certinha!',
];

export function getGamificationState(): GamificationState {
  const today = new Date().toISOString().slice(0, 10);
  let state: GamificationState = {
    totalXp: 150, // Começa com um incentivo inicial positivo
    level: 2,
    levelTitle: 'Organizador Financeiro',
    levelIcon: '📋',
    xpForCurrentLevel: 120,
    xpForNextLevel: 300,
    progressPercent: 16,
    achievements: INITIAL_ACHIEVEMENTS,
    dailyQuests: [
      {
        id: 'q_radar',
        title: 'Checar o Radar de Cobrança',
        description: 'Verifique quais parcelas vencem nos próximos dias.',
        xpReward: 30,
        targetCount: 1,
        currentCount: 1,
        completed: true,
        icon: ' radar',
      },
      {
        id: 'q_whatsapp',
        title: 'Enviar Lembrete Amigável',
        description: 'Dispare uma notificação de cobrança pelo WhatsApp.',
        xpReward: 40,
        targetCount: 1,
        currentCount: 0,
        completed: false,
        icon: '💬',
      },
      {
        id: 'q_settle',
        title: 'Receber ou Registrar Pagamento',
        description: 'Liquide uma parcela ou registre um recebimento.',
        xpReward: 60,
        targetCount: 1,
        currentCount: 0,
        completed: false,
        icon: '💰',
      },
    ],
    questDate: today,
    streaks: 3,
    lastActiveDate: today,
  };

  try {
    const raw = localStorage.getItem(GAMIFICATION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = { ...state, ...parsed };
      // Se virou o dia, reseta missões diárias
      if (state.questDate !== today) {
        state.questDate = today;
        state.dailyQuests = state.dailyQuests.map((q) => ({
          ...q,
          currentCount: 0,
          completed: false,
        }));
        state.streaks = (state.streaks || 1) + 1;
      }
    }
  } catch {}

  return calculateLevelInfo(state);
}

function calculateLevelInfo(state: GamificationState): GamificationState {
  const currentTier = LEVEL_TIERS.find((t) => state.totalXp >= t.minXp && state.totalXp < t.maxXp) || LEVEL_TIERS[LEVEL_TIERS.length - 1];
  const nextTier = LEVEL_TIERS.find((t) => t.level === currentTier.level + 1) || currentTier;

  const xpInTier = Math.max(0, state.totalXp - currentTier.minXp);
  const tierSpan = Math.max(1, currentTier.maxXp - currentTier.minXp);
  const progressPercent = Math.min(100, Math.round((xpInTier / tierSpan) * 100));

  return {
    ...state,
    level: currentTier.level,
    levelTitle: currentTier.title,
    levelIcon: currentTier.icon,
    xpForCurrentLevel: currentTier.minXp,
    xpForNextLevel: currentTier.maxXp,
    progressPercent,
  };
}

export function saveGamificationState(state: GamificationState): void {
  try {
    localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify(state));
    // Dispara evento customizado para reatividade instantânea na UI
    window.dispatchEvent(new CustomEvent('haspaho_gamification_updated', { detail: state }));
  } catch {}
}

export function addXp(amount: number, reason: string): { newXp: number; leveledUp: boolean; newLevel?: number } {
  const current = getGamificationState();
  const oldLevel = current.level;
  const nextXp = current.totalXp + amount;

  current.totalXp = nextXp;
  const updated = calculateLevelInfo(current);

  const leveledUp = updated.level > oldLevel;

  saveGamificationState(updated);

  if (leveledUp) {
    playLevelUpSound();
    triggerCelebrationConfetti();
  } else {
    playSuccessSound();
  }

  return {
    newXp: nextXp,
    leveledUp,
    newLevel: updated.level,
  };
}

export function completeDailyQuest(questId: string): void {
  const state = getGamificationState();
  const quest = state.dailyQuests.find((q) => q.id === questId);
  if (!quest || quest.completed) return;

  quest.currentCount = quest.targetCount;
  quest.completed = true;
  state.totalXp += quest.xpReward;

  const updated = calculateLevelInfo(state);
  saveGamificationState(updated);

  playSuccessSound();
  triggerCelebrationConfetti();
}

export function unlockAchievement(achievementId: string): boolean {
  const state = getGamificationState();
  const ach = state.achievements.find((a) => a.id === achievementId);
  if (!ach || ach.unlocked) return false;

  ach.unlocked = true;
  ach.unlockedAt = new Date().toISOString();
  state.totalXp += ach.xpReward;

  const updated = calculateLevelInfo(state);
  saveGamificationState(updated);

  playLevelUpSound();
  triggerCelebrationConfetti();

  return true;
}
