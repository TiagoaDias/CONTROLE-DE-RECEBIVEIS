import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Installment, Debtor } from '../types';
import { parseDateParts } from '../utils/dateUtils';
import { safeFormatCurrency } from '../utils/numberUtils';
import { getCleanDebtorAvatar } from './DebtorsMasterSpreadsheet';
import { playBellChime, isSoundEnabled, setGlobalSoundEnabled } from '../utils/soundUtils';

interface PushNotificationManagerProps {
  installments: Installment[];
  debtors: Debtor[];
  onToast?: (msg: string) => void;
  onNavigateToParcelas?: () => void;
  onSettleInstallment?: (inst: Installment) => void;
  onNudgeWhatsApp?: (
    debtorName: string,
    amount: string,
    product: string,
    parcel: string,
    debtorPhone?: string,
    dueDate?: string
  ) => void;
  isDarkMode?: boolean;
}

export interface UrgentInstallment extends Installment {
  diffDays: number;
}

export interface UrgentLists {
  overdueList: UrgentInstallment[];
  dueTodayList: UrgentInstallment[];
  upcomingList: UrgentInstallment[];
}

export const PushNotificationManager: React.FC<PushNotificationManagerProps> = ({
  installments,
  debtors,
  onToast,
  onNavigateToParcelas,
  onSettleInstallment,
  onNudgeWhatsApp,
  isDarkMode = false,
}) => {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'overdue' | 'upcoming' | 'how_it_works'>('overdue');
  const [soundEnabled, setSoundEnabled] = useState(isSoundEnabled);
  const [isRinging, setIsRinging] = useState(false);
  const [isTipExpanded, setIsTipExpanded] = useState<boolean>(false);
  const [expandedBalloonInstId, setExpandedBalloonInstId] = useState<string | null>(null);
  const bellButtonRef = useRef<HTMLButtonElement>(null);
  const modalPanelRef = useRef<HTMLDivElement>(null);

  const [notifEnabled, setNotifEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('haspaho_push_enabled') === 'true';
    } catch {
      return false;
    }
  });

  // Fecha o modal ao clicar fora ou ao pressionar Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (!target) return;
      // Se clicou no painel do modal ou no próprio botão do sino, não fecha
      if (modalPanelRef.current?.contains(target) || bellButtonRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 150);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Cálculo das parcelas críticas, vencendo hoje e nos próximos 3 dias (48h/72h)
  const { overdueList, dueTodayList, upcomingList } = useMemo<UrgentLists>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdue: UrgentInstallment[] = [];
    const dueToday: UrgentInstallment[] = [];
    const upcoming: UrgentInstallment[] = [];

    installments.forEach((inst: Installment) => {
      if (inst.status === 'paid') return;
      if (!inst.dueDate) return;

      const { day, month, year } = parseDateParts(inst.dueDate);
      if (!day || !month || !year) return;

      const due = new Date(year, month - 1, day);
      due.setHours(0, 0, 0, 0);

      const diffTime = due.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0 || inst.status === 'overdue') {
        overdue.push({ ...inst, diffDays: Math.abs(diffDays) });
      } else if (diffDays === 0) {
        dueToday.push({ ...inst, diffDays: 0 });
      } else if (diffDays > 0 && diffDays <= 3) {
        upcoming.push({ ...inst, diffDays });
      }
    });

    return {
      overdueList: overdue.sort((a, b) => b.diffDays - a.diffDays),
      dueTodayList: dueToday,
      upcomingList: upcoming.sort((a, b) => a.diffDays - b.diffDays),
    };
  }, [installments]);

  const totalUrgentCount = overdueList.length + dueTodayList.length + upcomingList.length;

  // Atualiza aba padrão conforme a urgência
  useEffect(() => {
    if (overdueList.length > 0) {
      setActiveTab('overdue');
    } else if (dueTodayList.length > 0 || upcomingList.length > 0) {
      setActiveTab('upcoming');
    } else {
      setActiveTab('how_it_works');
    }
  }, [overdueList.length, dueTodayList.length, upcomingList.length]);

  // Função didática para solicitar permissão de push ao navegador
  const requestPermission = async () => {
    if (!('Notification' in window)) {
      if (onToast) onToast('⚠️ Este navegador não tem suporte nativo para notificações push.');
      return;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        setNotifEnabled(true);
        localStorage.setItem('haspaho_push_enabled', 'true');
        if (soundEnabled) playBellChime('success');
        if (onToast) onToast('🎉 Notificações push ativadas com sucesso!');

        // Dispara uma notificação de boas-vindas com som
        sendBrowserNotification(
          '🔔 Notificações Ativadas com Sucesso!',
          totalUrgentCount > 0
            ? `Você tem ${overdueList.length} parcelas em atraso e ${dueTodayList.length} vencendo hoje. Clique para agir!`
            : 'Perfeito! Avisaremos você 2 dias antes de cada vencimento direto na sua tela.'
        );
      } else if (result === 'denied') {
        setNotifEnabled(false);
        localStorage.setItem('haspaho_push_enabled', 'false');
        if (soundEnabled) playBellChime('alert');
        if (onToast) onToast('❌ Permissão negada no navegador. Desbloqueie no cadeado do endereço.');
      }
    } catch (e) {
      console.error(e);
      if (onToast) onToast('⚠️ Erro ao solicitar permissão de notificações.');
    }
  };

  // Disparo de notificação no navegador
  const sendBrowserNotification = (title: string, body: string) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      try {
        const notif = new Notification(title, {
          body,
          icon: '/favicon.ico',
          tag: 'recebiveis-parcelas-alert',
        });
        notif.onclick = () => {
          window.focus();
          setIsOpen(true);
        };
      } catch (e) {
        console.error('Push notification error:', e);
      }
    }
  };

  // Disparo de teste divertido
  const handleTestNotification = () => {
    if (soundEnabled) playBellChime('success');
    sendBrowserNotification(
      '🔔 Teste de Notificação • Recebíveis PRO',
      '✨ O sistema de alertas está 100% ativo! Você receberá avisos automáticos de parcelas a vencer e em atraso.'
    );
    if (onToast) onToast('🔔 Teste de Push enviado para o seu navegador!');
  };

  // Clique no sino: toca som, anima e abre
  const handleToggleBell = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      setIsRinging(true);
      if (soundEnabled) playBellChime(totalUrgentCount > 0 ? 'alert' : 'cheerful');
      setTimeout(() => setIsRinging(false), 600);
    }
  };

  const getDebtorInfo = (debtorId?: string, debtorNameFallback?: string) => {
    const d = debtors.find(
      (x) =>
        x.id === debtorId ||
        (debtorNameFallback && x.name?.toLowerCase().trim() === debtorNameFallback.toLowerCase().trim())
    );
    return {
      debtor: d,
      name: d ? d.name : debtorNameFallback || 'Cliente',
      phone: d?.phone,
      relation: d?.relation || 'Cliente',
      avatar: getCleanDebtorAvatar(d?.name || debtorNameFallback, d?.avatar),
    };
  };

  // Ação direta 1: WhatsApp (Garante fechamento imediato do modal e disparo sem bloqueio)
  const handleActionWhatsApp = (inst: Installment) => {
    const info = getDebtorInfo(inst.debtorId, inst.debtorName);
    const amountStr = safeFormatCurrency(inst.amount);
    const parcelStr = `${inst.installmentNumber}/${inst.totalInstallments}`;
    const prod = inst.product || 'Recebível';

    if (soundEnabled) playBellChime('cheerful');

    // FECHA O MODAL DO RADAR IMEDIATAMENTE para que o painel de WhatsApp fique visível e interativo
    setIsOpen(false);

    if (onNudgeWhatsApp) {
      onNudgeWhatsApp(info.name, amountStr, prod, parcelStr, info.phone, inst.dueDate);
      if (onToast) onToast(`💬 Abrindo lembrete WhatsApp para ${info.name}...`);
      return;
    }

    const cleanPhone = (info.phone || '').replace(/\D/g, '');
    const msg = encodeURIComponent(
      `Olá, ${info.name}! Tudo bem?\nPassando para lembrar da parcela #${parcelStr} de "${prod}" no valor de ${amountStr}, com vencimento em ${inst.dueDate}.\n\nChave PIX oficial para quitação: (14) 99733-9863 (Tiago Dias).\nQualquer dúvida estou à disposição!`
    );

    const waUrl = cleanPhone ? `https://wa.me/55${cleanPhone}?text=${msg}` : `https://wa.me/?text=${msg}`;
    try {
      const win = window.open(waUrl, '_blank', 'noopener,noreferrer');
      if (!win) {
        window.location.href = waUrl;
      }
    } catch {
      window.location.href = waUrl;
    }
    if (onToast) onToast(`💬 Mensagem WhatsApp preparada para ${info.name}!`);
  };

  // Ação direta 2: Quitar Parcela (Garante fechamento e redirecionamento instantâneo)
  const handleActionSettle = (inst: Installment) => {
    if (soundEnabled) playBellChime('success');
    setIsOpen(false);
    if (onSettleInstallment) {
      onSettleInstallment(inst);
    } else if (onNavigateToParcelas) {
      onNavigateToParcelas();
    }
    if (onToast) onToast(`⚡ Abrindo quitação da parcela #${inst.installmentNumber} de ${inst.debtorName}...`);
  };

  // Copiar resumo de cobrança do dia
  const handleCopySummary = () => {
    if (overdueList.length === 0 && dueTodayList.length === 0) {
      if (onToast) onToast('🎉 Nenhuma pendência para cobrar hoje!');
      return;
    }

    const lines = [
      '📋 *RESUMO DO RADAR DE COBRANÇAS - RECEBÍVEIS PRO*',
      `Data: ${new Date().toLocaleDateString('pt-BR')}`,
      '',
    ];

    if (overdueList.length > 0) {
      lines.push(`🚨 *EM ATRASO (${overdueList.length}):*`);
      overdueList.forEach((inst) => {
        const info = getDebtorInfo(inst.debtorId, inst.debtorName);
        lines.push(`• ${info.name}: ${safeFormatCurrency(inst.amount)} (Venc: ${inst.dueDate}) - #${inst.installmentNumber}`);
      });
      lines.push('');
    }

    if (dueTodayList.length > 0) {
      lines.push(`⚡ *VENCEM HOJE (${dueTodayList.length}):*`);
      dueTodayList.forEach((inst) => {
        const info = getDebtorInfo(inst.debtorId, inst.debtorName);
        lines.push(`• ${info.name}: ${safeFormatCurrency(inst.amount)} - #${inst.installmentNumber}`);
      });
      lines.push('');
    }

    lines.push('🔑 Chave PIX Oficial: (14) 99733-9863 (Tiago Dias)');

    const text = lines.join('\n');
    navigator.clipboard.writeText(text);
    if (soundEnabled) playBellChime('success');
    if (onToast) onToast('📋 Resumo de cobranças copiado para a área de transferência!');
  };

  // Renderizador unificado com Balão Fluente de Informações Interativo
  const renderInstallmentBalloonCard = (
    inst: UrgentInstallment,
    variant: 'overdue' | 'dueToday' | 'upcoming'
  ) => {
    const info = getDebtorInfo(inst.debtorId, inst.debtorName);
    const isExpanded = expandedBalloonInstId === inst.id;

    const borderColor =
      variant === 'overdue'
        ? 'border-red-400 dark:border-red-600 hover:border-red-500'
        : variant === 'dueToday'
        ? 'border-amber-400 dark:border-amber-600 hover:border-amber-500'
        : 'border-blue-400 dark:border-blue-600 hover:border-blue-500';

    const ringColor =
      variant === 'overdue'
        ? 'ring-red-400'
        : variant === 'dueToday'
        ? 'ring-amber-400'
        : 'ring-blue-400';

    const badgeBg =
      variant === 'overdue'
        ? 'bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-300 border-red-300 dark:border-red-800'
        : variant === 'dueToday'
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-300 dark:border-amber-800'
        : 'bg-blue-50 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border-blue-200 dark:border-blue-800';

    const statusText =
      variant === 'overdue'
        ? `${inst.diffDays}d atrasada`
        : variant === 'dueToday'
        ? 'Vence Hoje'
        : `Em ${inst.diffDays} ${inst.diffDays === 1 ? 'dia' : 'dias'}`;

    return (
      <div
        key={inst.id}
        className={`bg-white dark:bg-slate-800/90 border-2 ${borderColor} rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 shadow-sm hover:shadow-md transition-all flex flex-col gap-2 sm:gap-2.5`}
      >
        {/* Topo do Card clicável para abrir/fechar balão */}
        <div
          onClick={() => {
            playBellChime('click');
            setExpandedBalloonInstId(isExpanded ? null : inst.id);
          }}
          className="flex items-start justify-between gap-2 sm:gap-3 cursor-pointer select-none group"
          title="Toque para ver o Balão Fluente de Informações"
        >
          <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className="relative shrink-0">
              <img
                src={info.avatar}
                alt={info.name}
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl object-cover ring-2 ${ringColor} shadow-xs`}
              />
              {variant === 'overdue' && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-red-600 rounded-full border-2 border-white dark:border-slate-800 animate-ping" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                <h4 className="font-black text-xs sm:text-sm text-slate-900 dark:text-white break-words group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                  {info.name}
                </h4>
                <span className="text-[9px] sm:text-[9.5px] px-1.5 sm:px-2 py-0.2 sm:py-0.5 rounded-full font-black bg-slate-100 dark:bg-slate-700/80 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 shrink-0 font-mono">
                  #{inst.installmentNumber}/{inst.totalInstallments}
                </span>
              </div>
              <p className="text-[10.5px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium break-words mt-0.5">
                {inst.product || 'Recebível'} • Vence {variant === 'dueToday' ? <strong className="text-amber-600 dark:text-amber-400">Hoje!</strong> : <strong className="text-slate-700 dark:text-slate-300 font-mono">{inst.dueDate}</strong>}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0 flex flex-col items-end pl-1">
            <span className={`font-black font-mono text-xs sm:text-base block leading-tight ${variant === 'overdue' ? 'text-red-600 dark:text-red-400' : variant === 'dueToday' ? 'text-amber-700 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
              {safeFormatCurrency(inst.amount)}
            </span>
            <div className="flex items-center gap-1 mt-0.5 sm:mt-1">
              <span className={`text-[9px] sm:text-[9.5px] font-black border px-1.5 sm:px-2 py-0.2 sm:py-0.5 rounded-full inline-flex items-center gap-1 ${badgeBg}`}>
                {variant === 'overdue' && <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping shrink-0" />}
                {statusText}
              </span>
              <span className="material-symbols-outlined text-[15px] text-slate-400 group-hover:text-cyan-500 transition-transform duration-200">
                {isExpanded ? 'expand_less' : 'expand_more'}
              </span>
            </div>
          </div>
        </div>

        {/* BALÃO FLUENTE DE INFORMAÇÕES INTERATIVO (EXPANSÍVEL) */}
        {isExpanded && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-white border-2 border-cyan-400/90 shadow-2xl space-y-2 sm:space-y-2.5 animate-in zoom-in-95 fade-in duration-200 font-sans"
          >
            <div className="flex items-center justify-between pb-1 sm:pb-1.5 border-b border-slate-700">
              <span className="font-extrabold text-[10.5px] sm:text-[11px] text-cyan-300 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] sm:text-[16px] text-cyan-400">chat_bubble</span>
                <span>Balão Fluente de Informações</span>
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedBalloonInstId(null);
                }}
                className="w-5 h-5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-[10px] font-bold cursor-pointer"
                title="Fechar Balão"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5 sm:gap-2 text-[9.5px] sm:text-[10px] font-mono">
              <div className="bg-slate-800/90 p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-slate-700/80 text-left">
                <span className="text-slate-400 block text-[8px] sm:text-[8.5px] uppercase font-bold">Sacado / Devedor:</span>
                <strong className="text-white text-[11px] sm:text-xs truncate block">{info.name}</strong>
                <span className="text-cyan-300 text-[9px] sm:text-[9.5px] truncate block">{info.phone || 'Sem telefone'}</span>
              </div>

              <div className="bg-slate-800/90 p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-slate-700/80 text-left">
                <span className="text-slate-400 block text-[8px] sm:text-[8.5px] uppercase font-bold">Vencimento &amp; Prazo:</span>
                <strong className="text-amber-300 text-[11px] sm:text-xs block">{inst.dueDate}</strong>
                <span className={inst.diffDays > 0 ? "text-red-400 font-bold text-[9px] sm:text-[9.5px] block" : "text-emerald-400 font-bold text-[9px] sm:text-[9.5px] block"}>
                  {inst.diffDays > 0 ? `${inst.diffDays} dias em atraso` : 'Vence hoje'}
                </span>
              </div>
            </div>

            <div className="p-1.5 sm:p-2 bg-slate-800/80 rounded-lg sm:rounded-xl border border-slate-700/80 flex items-center justify-between text-[9.5px] sm:text-[10.5px]">
              <span className="text-slate-300 font-semibold">Chave PIX Oficial:</span>
              <strong className="text-emerald-400 font-mono font-black text-[10px] sm:text-[11px]">(14) 99733-9863 (Tiago Dias)</strong>
            </div>

            {/* Ações no Balão */}
            <div className="grid grid-cols-2 gap-1.5 sm:gap-2 pt-0.5 sm:pt-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleActionWhatsApp(inst);
                }}
                className="py-2 sm:py-2.5 px-2 sm:px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black flex items-center justify-center gap-1 sm:gap-1.5 shadow-md active:scale-95 cursor-pointer transition-all border border-emerald-400/60"
                title={`Enviar lembrete amigável no WhatsApp para ${info.name}`}
              >
                <span className="material-symbols-outlined text-[15px] sm:text-[17px]">chat</span>
                <span>Cobrar WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleActionSettle(inst);
                }}
                className="py-2 sm:py-2.5 px-2 sm:px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black flex items-center justify-center gap-1 sm:gap-1.5 shadow-md active:scale-95 cursor-pointer transition-all border border-blue-400/60"
                title="Abrir quitação / dar baixa contábil nesta parcela"
              >
                <span className="material-symbols-outlined text-[15px] sm:text-[17px]">check_circle</span>
                <span>Quitar Parcela</span>
              </button>
            </div>
          </div>
        )}

        {/* BOTÕES DE AÇÃO DIRETA NO CARD (SEMPRE FUNCIONAIS COM STOP-PROPAGATION) */}
        <div className="pt-1.5 sm:pt-2 border-t border-slate-100 dark:border-slate-750 flex items-center gap-1.5 sm:gap-2">
          {/* Ação 1: Cobrar no WhatsApp */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              playBellChime('pop');
              handleActionWhatsApp(inst);
            }}
            className="flex-1 py-1.5 sm:py-2 px-2.5 sm:px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black flex items-center justify-center gap-1 sm:gap-1.5 transition-all shadow-xs cursor-pointer border border-emerald-500/50"
            title={`Enviar lembrete amigável no WhatsApp para ${info.name}`}
          >
            <span className="material-symbols-outlined text-[15px] sm:text-[16px]">chat</span>
            <span>{variant === 'upcoming' ? 'Avisar Antecipado' : variant === 'dueToday' ? 'Lembrar WhatsApp' : 'Cobrar WhatsApp'}</span>
          </button>

          {/* Ação 2: Quitar / Dar Baixa Direto */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              playBellChime('coin');
              handleActionSettle(inst);
            }}
            className="py-1.5 sm:py-2 px-2.5 sm:px-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black flex items-center justify-center gap-1 sm:gap-1.5 transition-all shadow-xs cursor-pointer shrink-0 border border-blue-500/50"
            title="Dar baixa / quitar esta parcela"
          >
            <span className="material-symbols-outlined text-[15px] sm:text-[16px]">check_circle</span>
            <span>Quitar</span>
          </button>
        </div>
      </div>
    );
  };

  // Portal do Painel Flutuante renderizado direto no body para nunca ficar preso no header ou recortado
  const modalPortal =
    isOpen && typeof document !== 'undefined'
      ? createPortal(
          <>
            {/* Backdrop único, suave e com z-[9990] para cobrir a viewport inteira */}
            <div
              className="fixed inset-0 bg-black/65 backdrop-blur-xs z-[9990] animate-in fade-in duration-200"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />

            {/* PAINEL FLUTUANTE: ENQUADRADO, SUBIDO ATÉ O TOPO E SEM CORTAR BOTÕES */}
            <div
              ref={modalPanelRef}
              role="dialog"
              aria-label="Central de Alertas e Push"
              className={`fixed z-[9995] inset-x-1 sm:inset-x-auto top-1 sm:top-18 sm:right-6 bottom-1 sm:bottom-auto w-auto sm:w-[500px] max-w-none sm:max-w-[500px] rounded-2xl sm:rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.55)] border-2 overflow-hidden backdrop-blur-2xl transition-all animate-in fade-in zoom-in-95 duration-200 flex flex-col h-[calc(100dvh-10px)] sm:h-auto sm:max-h-[86vh] ${
                isDarkMode
                  ? 'bg-slate-900/98 border-slate-700 text-slate-100'
                  : 'bg-white/98 border-amber-300/80 text-slate-900'
              }`}
            >
            {/* CABEÇALHO DIVERTIDO & GUARDIÃO PUSH (RADAR CÓSMICO FUTURISTA) */}
            <div className="p-2 sm:p-3.5 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white shrink-0 relative overflow-hidden border-b border-cyan-500/30">
              <div className="absolute right-0 top-0 translate-x-3 -translate-y-2 opacity-15 pointer-events-none">
                <span className="material-symbols-outlined text-[100px] text-cyan-400">radar</span>
              </div>

              <div className="flex items-center justify-between gap-1.5 sm:gap-2 relative z-10">
                <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                  {/* Radar Scanner Giratório Futurista */}
                  <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-slate-900/90 border-2 border-cyan-400/80 flex items-center justify-center shrink-0 overflow-hidden shadow-[0_0_15px_rgba(6,182,212,0.4)]">
                    <div className="absolute inset-0 rounded-full border border-cyan-500/30"></div>
                    <div className="absolute inset-1.5 rounded-full border border-cyan-500/40"></div>
                    <div className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_0_280deg,rgba(6,182,212,0.75)_360deg)] animate-[spin_3s_linear_infinite] origin-center opacity-85 pointer-events-none"></div>
                    <span className="material-symbols-outlined text-[18px] sm:text-[20px] text-cyan-300 relative z-10 animate-pulse">radar</span>
                    <span className="absolute top-0.5 right-0.5 flex h-2 w-2 z-20">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-300" />
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                      <h3 className="font-black text-xs sm:text-sm tracking-tight text-white truncate flex items-center gap-1">
                        <span>Radar de Cobrança &amp; Push</span>
                      </h3>
                      <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 font-black text-[8px] sm:text-[8.5px] px-1.5 py-0.2 rounded-full uppercase tracking-wider backdrop-blur-xs">
                        Ativo 24h
                      </span>
                    </div>
                    <p className="text-[10px] sm:text-[11.5px] text-cyan-100/90 font-medium truncate">
                      {totalUrgentCount > 0
                        ? `⚡ ${totalUrgentCount} ${totalUrgentCount === 1 ? 'parcela requer' : 'parcelas requerem'} ação direta!`
                        : '🎉 Nenhuma parcela pendente ou atrasada!'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Botão de Som Mute/Unmute */}
                  <button
                    type="button"
                    onClick={() => {
                      const nextSound = !soundEnabled;
                      setSoundEnabled(nextSound);
                      setGlobalSoundEnabled(nextSound);
                      if (nextSound) playBellChime('cheerful');
                    }}
                    className="w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-xl bg-white/20 hover:bg-white/30 active:scale-90 text-white flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                    title={soundEnabled ? 'Silenciar sininho e efeitos' : 'Ativar som do sininho e efeitos'}
                  >
                    <span className="material-symbols-outlined text-[16px] sm:text-[17px]">
                      {soundEnabled ? 'volume_up' : 'volume_off'}
                    </span>
                  </button>

                  {/* Botão Fechar */}
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-xl bg-white/20 hover:bg-white/30 active:scale-90 text-white flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                    title="Fechar painel"
                  >
                    <span className="material-symbols-outlined text-[17px] sm:text-[18px]">close</span>
                  </button>
                </div>
              </div>

            {/* Balão Didático do Guardião com dica financeira (Otimizado e Recolhível no Mobile) */}
            <div className="mt-2 bg-black/20 backdrop-blur-md rounded-2xl p-2 sm:p-2.5 border border-white/20 flex flex-col gap-1 text-xs shadow-xs relative">
              <button
                type="button"
                onClick={() => setIsTipExpanded(!isTipExpanded)}
                className="w-full flex items-center justify-between text-left cursor-pointer select-none group"
                title="Toque para ver ou recolher a dica do Guardião"
              >
                <div className="flex items-center gap-1.5 text-[10px] uppercase font-black tracking-wider text-amber-200">
                  <span className="text-base shrink-0">🤖</span>
                  <span>Guardião do Radar</span>
                  <span className="w-1 h-1 rounded-full bg-amber-300" />
                  <span className="hidden sm:inline">Dica Inteligente</span>
                </div>
                <span className="text-[10px] text-amber-100 font-bold flex items-center gap-0.5 bg-white/10 px-2 py-0.5 rounded-lg group-hover:bg-white/20 transition-colors">
                  <span>{isTipExpanded ? 'Recolher' : 'Ver Dica'}</span>
                  <span className="material-symbols-outlined text-[14px]">
                    {isTipExpanded ? 'expand_less' : 'expand_more'}
                  </span>
                </span>
              </button>

              {isTipExpanded && (
                <p className="text-[11px] text-amber-50 leading-relaxed font-medium break-words pt-1.5 border-t border-white/15 animate-in fade-in duration-150">
                  {overdueList.length > 0
                    ? `⚠️ Você tem ${overdueList.length} ${overdueList.length === 1 ? 'parcela que merece atenção prioritária' : 'parcelas que merecem atenção prioritária'}. Toque em "Cobrar WhatsApp" para enviar a mensagem pronta com a chave PIX ou registre a baixa!`
                    : dueTodayList.length > 0
                    ? `🗓️ Confira os próximos vencimentos! Identificamos ${dueTodayList.length} ${dueTodayList.length === 1 ? 'fatura vencendo hoje' : 'faturas vencendo hoje'}. Dê baixa assim que receber o comprovante.`
                    : upcomingList.length > 0
                    ? `🗓️ Confira os próximos vencimentos! Identificamos ${upcomingList.length} ${upcomingList.length === 1 ? 'parcela programada para os próximos dias' : 'parcelas programadas para os próximos dias'}.`
                    : '✨ Tudo certo! Sua lista está organizada e todos os recebíveis estão em dia. Boa! Mais uma etapa concluída.'}
                </p>
              )}
            </div>
          </div>

          {/* STATUS DIDÁTICO DO PUSH NO NAVEGADOR COM BOTÕES DE AÇÃO */}
          <div
            className={`px-3 py-2 sm:py-2.5 border-b shrink-0 transition-colors ${
              permission === 'granted'
                ? isDarkMode
                  ? 'bg-emerald-950/35 border-emerald-800/40 text-emerald-200'
                  : 'bg-emerald-50/80 border-emerald-200/90 text-emerald-900'
                : isDarkMode
                ? 'bg-amber-950/35 border-amber-800/40 text-amber-200'
                : 'bg-amber-50/90 border-amber-200/90 text-amber-900'
            }`}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                <span
                  className={`material-symbols-outlined text-[18px] sm:text-[20px] shrink-0 ${
                    permission === 'granted' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {permission === 'granted' ? 'verified' : 'notifications_paused'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] sm:text-xs font-black truncate">
                      {permission === 'granted' ? 'Push Ativo' : 'Alertas Push'}
                    </span>
                    <span className={`text-[8.5px] sm:text-[9px] font-black px-1.5 py-0.2 rounded-md uppercase tracking-wider ${
                      permission === 'granted'
                        ? 'bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                        : 'bg-amber-200/60 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300'
                    }`}>
                      {permission === 'granted' ? 'Ativo' : 'Pendente'}
                    </span>
                  </div>
                  <p className="text-[10px] opacity-80 truncate hidden sm:block">
                    {permission === 'granted'
                      ? 'Você recebe notificações com som na sua tela'
                      : 'Autorize para receber avisos mesmo fora da aba'}
                  </p>
                </div>
              </div>

              {/* Botões de controle da permissão */}
              {permission !== 'granted' ? (
                <button
                  type="button"
                  onClick={requestPermission}
                  className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold text-[10.5px] sm:text-[11px] rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1 shrink-0"
                >
                  <span className="material-symbols-outlined text-[14px]">touch_app</span>
                  <span>Ativar Push</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleTestNotification}
                    className="px-2.5 py-1 bg-white hover:bg-slate-50 text-emerald-700 font-bold text-[10.5px] rounded-xl border border-emerald-300 shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                    title="Disparar notificação de teste no navegador"
                  >
                    <span className="material-symbols-outlined text-[13px]">play_circle</span>
                    <span>Testar</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ABAS INTERATIVAS PARA NAVEGAÇÃO DIDÁTICA */}
          <div className="px-2.5 sm:px-3 pt-1.5 sm:pt-2.5 pb-1 sm:pb-1.5 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex items-center gap-1.5 sm:gap-2 shrink-0 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => {
                playBellChime('click');
                setActiveTab('overdue');
              }}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 shrink-0 ${
                activeTab === 'overdue'
                  ? 'bg-red-600 text-white shadow-xs scale-102 ring-2 ring-red-400/40'
                  : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              <span>🚨 Em Atraso</span>
              <span
                className={`text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === 'overdue' ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-300'
                }`}
              >
                {overdueList.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                playBellChime('click');
                setActiveTab('upcoming');
              }}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 shrink-0 ${
                activeTab === 'upcoming'
                  ? 'bg-amber-500 text-white shadow-xs scale-102 ring-2 ring-amber-400/40'
                  : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              <span>⚡ Vencendo (48h)</span>
              <span
                className={`text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === 'upcoming'
                    ? 'bg-white/20 text-white'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                }`}
              >
                {dueTodayList.length + upcomingList.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                playBellChime('click');
                setActiveTab('how_it_works');
              }}
              className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 shrink-0 ml-auto ${
                activeTab === 'how_it_works'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Como funciona o sistema de push"
            >
              <span className="material-symbols-outlined text-[14px] sm:text-[15px]">help</span>
              <span className="hidden sm:inline">Como Funciona</span>
            </button>
          </div>

          {/* ============================================================ */}
          {/* CONTEÚDO ROLÁVEL COM AÇÕES DIRETAS (WHATSAPP, QUITAR, VER)   */}
          {/* ============================================================ */}
          <div className="flex-1 min-h-0 overflow-y-auto p-2 sm:p-3.5 space-y-2 sm:space-y-2.5 pb-3 sm:pb-4 sm:max-h-[50vh] scrollbar-thin bg-slate-50/50 dark:bg-slate-900/40">
            {/* ABA 1: PARCELAS EM ATRASO */}
            {activeTab === 'overdue' && (
              <>
                {overdueList.length === 0 ? (
                  <div className="py-8 px-4 text-center flex flex-col items-center justify-center gap-2 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <span className="text-3xl">🎉</span>
                    <h4 className="font-black text-sm text-slate-800 dark:text-white">Parabéns! Zero Atrasos</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
                      Nenhum devedor está com parcelas vencidas no momento. Todos os recebíveis estão no prazo!
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] font-black text-red-600 dark:text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-600 animate-ping shrink-0" />
                        Cobranças Prioritárias ({overdueList.length})
                      </span>
                      <button
                        type="button"
                        onClick={handleCopySummary}
                        className="text-[11px] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold flex items-center gap-1 cursor-pointer"
                        title="Copiar lista de atrasados"
                      >
                        <span className="material-symbols-outlined text-[14px]">content_copy</span>
                        <span>Copiar Lista</span>
                      </button>
                    </div>

                    {overdueList.map((inst) => renderInstallmentBalloonCard(inst, 'overdue'))}
                  </>
                )}
              </>
            )}

            {/* ABA 2: VENCENDO HOJE E NOS PRÓXIMOS DIAS (48H) */}
            {activeTab === 'upcoming' && (
              <>
                {dueTodayList.length === 0 && upcomingList.length === 0 ? (
                  <div className="py-8 px-4 text-center flex flex-col items-center justify-center gap-2 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <span className="text-3xl">☕</span>
                    <h4 className="font-black text-sm text-slate-800 dark:text-white">Tudo Tranquilo nas Próximas 48h!</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
                      Nenhuma fatura vence hoje ou nos próximos 2 dias. O radar avisará você automaticamente assim que uma data se aproximar!
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Vencem Hoje */}
                    {dueTodayList.length > 0 && (
                      <div className="space-y-2.5">
                        <span className="text-[11px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1 px-1">
                          <span className="material-symbols-outlined text-[15px]">today</span>
                          Vencem Hoje ({dueTodayList.length})
                        </span>

                        {dueTodayList.map((inst) => renderInstallmentBalloonCard(inst, 'dueToday'))}
                      </div>
                    )}

                    {/* Vencem em 48h / 72h */}
                    {upcomingList.length > 0 && (
                      <div className="space-y-2.5 mt-2.5">
                        <span className="text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1 px-1">
                          <span className="material-symbols-outlined text-[15px]">schedule</span>
                          Próximos Vencimentos (48h / 72h)
                        </span>

                        {upcomingList.map((inst) => renderInstallmentBalloonCard(inst, 'upcoming'))}
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {/* ABA 3: COMO FUNCIONA O PUSH (DIDÁTICA E EDUCATIVA) */}
            {activeTab === 'how_it_works' && (
              <div className="space-y-3 bg-white dark:bg-slate-800/90 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
                <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-750 pb-2.5">
                  <span className="text-2xl">🎓</span>
                  <div>
                    <h4 className="font-black text-sm text-slate-900 dark:text-white">Como Funciona o Alerta Push?</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Entenda como o Recebíveis PRO protege suas finanças
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5 text-slate-700 dark:text-slate-300">
                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-100 dark:border-slate-700">
                    <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                      1
                    </div>
                    <div>
                      <strong className="block text-slate-900 dark:text-white text-xs">Aviso 2 Dias Antes (48h)</strong>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                        O navegador dispara uma notificação na sua tela avisando quais parcelas vão vencer, para você preparar a cobrança.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-100 dark:border-slate-700">
                    <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs shrink-0">
                      2
                    </div>
                    <div>
                      <strong className="block text-slate-900 dark:text-white text-xs">Alerta no Dia do Vencimento</strong>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                        No dia do vencimento, o sino vibra e emite alerta sonoro para você confirmar o PIX ou o comprovante do devedor.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-100 dark:border-slate-700">
                    <div className="w-6 h-6 rounded-lg bg-red-100 text-red-700 flex items-center justify-center font-bold text-xs shrink-0">
                      3
                    </div>
                    <div>
                      <strong className="block text-slate-900 dark:text-white text-xs">Radar Contínuo de Atrasos</strong>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                        Se passar da data sem pagamento, a parcela entra em alerta vermelho e você pode cobrar no WhatsApp com 1 toque!
                      </p>
                    </div>
                  </div>
                </div>

                {/* Demonstração prática de teste */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-750">
                  <button
                    type="button"
                    onClick={handleTestNotification}
                    className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[17px]">notifications_active</span>
                    <span>Experimentar Notificação de Teste na Tela</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* RODAPÉ: AÇÕES GERAIS COM BALÕES E BOTÕES DE DESTAQUE (GARANTIDO E NUNCA CORTADO) */}
          <div className="p-2 sm:p-3.5 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between gap-1.5 sm:gap-2 shrink-0 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]">
            <button
              type="button"
              onClick={handleCopySummary}
              className="py-1.5 sm:py-2 px-2.5 sm:px-3 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-1 sm:gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
              title="Copiar resumo completo das cobranças"
            >
              <span className="material-symbols-outlined text-[15px] sm:text-[16px]">content_copy</span>
              <span>Copiar Resumo</span>
            </button>

            {onNavigateToParcelas && (
              <button
                type="button"
                onClick={() => {
                  playBellChime('click');
                  setIsOpen(false);
                  onNavigateToParcelas();
                }}
                className="py-1.5 sm:py-2 px-3 sm:px-4 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black flex items-center gap-1 sm:gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <span>Ver Todas as Parcelas</span>
                <span className="material-symbols-outlined text-[15px] sm:text-[16px]">arrow_forward</span>
              </button>
            )}
          </div>
        </div>
      </>,
      document.body
    )
  : null;

  return (
    <div className="relative inline-block">
      {/* ============================================================ */}
      {/* BOTÃO DO SINO: INTERATIVO, DIVERTIDO E ANIMADO               */}
      {/* ============================================================ */}
      <button
        ref={bellButtonRef}
        type="button"
        onClick={handleToggleBell}
        title="Central Interativa de Alertas Push & Cobranças"
        className={`relative p-2 sm:p-2.5 rounded-2xl transition-all flex items-center justify-center cursor-pointer shadow-xs active:scale-90 group select-none ${
          isDarkMode
            ? 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700/80 hover:border-amber-400/50'
            : 'bg-white hover:bg-amber-50/50 text-slate-700 border border-slate-200/90 hover:border-amber-300'
        } ${isOpen ? 'ring-2 ring-amber-400 shadow-md' : ''}`}
      >
        {/* Ícone com animação de balanço alegre */}
        <span
          className={`material-symbols-outlined text-[21px] transition-transform duration-300 ${
            totalUrgentCount > 0
              ? 'text-amber-500 group-hover:rotate-12'
              : 'text-slate-400 group-hover:text-amber-500 group-hover:rotate-6'
          } ${isRinging ? 'scale-125 rotate-[-18deg]' : ''}`}
          style={{
            transformOrigin: 'top center',
            animation:
              totalUrgentCount > 0 && !isOpen
                ? 'bellShake 2.5s infinite ease-in-out'
                : undefined,
          }}
        >
          {totalUrgentCount > 0 ? 'notifications_active' : 'notifications'}
        </span>

        {/* Badge vibrante com contador de urgência */}
        {totalUrgentCount > 0 ? (
          <span className="absolute -top-1.5 -right-1.5 bg-gradient-to-r from-red-600 to-rose-500 text-white text-[10px] font-black min-w-5 h-5 px-1 rounded-full flex items-center justify-center shadow-md animate-pulse border-2 border-white">
            {totalUrgentCount}
          </span>
        ) : (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
        )}
      </button>

      {/* Animação CSS inline do sino */}
      <style>{`
        @keyframes bellShake {
          0%, 100% { transform: rotate(0deg); }
          10%, 30% { transform: rotate(14deg); }
          20%, 40% { transform: rotate(-14deg); }
          50% { transform: rotate(8deg); }
          60% { transform: rotate(-8deg); }
          70% { transform: rotate(0deg); }
        }
      `}</style>

      {/* Modal Portaled para document.body */}
      {modalPortal}
    </div>
  );
};
