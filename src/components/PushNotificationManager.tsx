import React, { useState, useEffect, useMemo, useRef } from 'react';
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
    debtorPhone?: string
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
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [notifEnabled, setNotifEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('haspaho_push_enabled') === 'true';
    } catch {
      return false;
    }
  });

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
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
  const handleToggleBell = () => {
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

  // Ação direta 1: WhatsApp
  const handleActionWhatsApp = (inst: Installment) => {
    const info = getDebtorInfo(inst.debtorId, inst.debtorName);
    const amountStr = safeFormatCurrency(inst.amount);
    const parcelStr = `${inst.installmentNumber}/${inst.totalInstallments}`;
    const prod = inst.product || 'Recebível';

    if (soundEnabled) playBellChime('cheerful');

    if (onNudgeWhatsApp) {
      onNudgeWhatsApp(info.name, amountStr, prod, parcelStr, info.phone);
      if (onToast) onToast(`💬 Abrindo lembrete WhatsApp para ${info.name}...`);
      return;
    }

    const cleanPhone = (info.phone || '').replace(/\D/g, '');
    const msg = encodeURIComponent(
      `Olá, ${info.name}! Tudo bem?\nPassando para lembrar da parcela #${parcelStr} de "${prod}" no valor de ${amountStr}, com vencimento em ${inst.dueDate}.\n\nChave PIX oficial para quitação: (14) 99733-9863 (Tiago Dias).\nQualquer dúvida estou à disposição!`
    );

    if (cleanPhone) {
      window.open(`https://wa.me/55${cleanPhone}?text=${msg}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${msg}`, '_blank');
    }
    if (onToast) onToast(`💬 Mensagem preparada para ${info.name}!`);
  };

  // Ação direta 2: Quitar Parcela
  const handleActionSettle = (inst: Installment) => {
    if (soundEnabled) playBellChime('success');
    setIsOpen(false);
    if (onSettleInstallment) {
      onSettleInstallment(inst);
    } else if (onNavigateToParcelas) {
      onNavigateToParcelas();
    }
    if (onToast) onToast(`⚡ Abrindo quitação da parcela #${inst.installmentNumber}...`);
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

  return (
    <div className="relative" ref={dropdownRef}>
      {/* ============================================================ */}
      {/* BOTÃO DO SINO: INTERATIVO, DIVERTIDO E ANIMADO               */}
      {/* ============================================================ */}
      <button
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

      {/* Backdrop suave para fechar no toque em telas móveis */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-950/45 backdrop-blur-xs z-[590] sm:hidden animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ============================================================ */}
      {/* PAINEL FLUTUANTE: DIDÁTICO, INTUITIVO E COM AÇÕES DIRETAS    */}
      {/* ============================================================ */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Central de Alertas e Push"
          className={`fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 top-16 sm:top-full sm:mt-2.5 w-auto sm:w-[490px] max-w-none sm:max-w-[500px] rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.3)] border-2 z-[600] overflow-hidden backdrop-blur-2xl transition-all animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[86vh] sm:max-h-[84vh] ${
            isDarkMode
              ? 'bg-slate-900/98 border-slate-700 text-slate-100'
              : 'bg-white/98 border-amber-200/90 text-slate-900'
          }`}
        >
          {/* CABEÇALHO DIVERTIDO & GUARDIÃO PUSH */}
          <div className="p-3.5 sm:p-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shrink-0 relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-3 -translate-y-2 opacity-15 pointer-events-none">
              <span className="material-symbols-outlined text-[110px]">campaign</span>
            </div>

            <div className="flex items-center justify-between gap-2 relative z-10">
              <div className="flex items-center gap-2.5">
                <div className="relative flex items-center justify-center">
                  <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-xs text-white">
                    <span className="text-xl">🔔</span>
                  </div>
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-200 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-300" />
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-black text-sm tracking-tight text-white">
                      Radar de Cobrança & Push
                    </h3>
                    <span className="bg-white/25 text-white font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider backdrop-blur-xs">
                      Ativo 24h
                    </span>
                  </div>
                  <p className="text-[11.5px] text-white/95 font-medium">
                    {totalUrgentCount > 0
                      ? `⚡ ${totalUrgentCount} ${totalUrgentCount === 1 ? 'parcela requer' : 'parcelas requerem'} sua ação direta!`
                      : '🎉 Nenhuma parcela pendente ou atrasada no momento!'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Botão de Som Mute/Unmute */}
                <button
                  type="button"
                  onClick={() => {
                    const nextSound = !soundEnabled;
                    setSoundEnabled(nextSound);
                    setGlobalSoundEnabled(nextSound);
                    if (nextSound) playBellChime('cheerful');
                  }}
                  className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 active:scale-90 text-white flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                  title={soundEnabled ? 'Silenciar sininho e efeitos' : 'Ativar som do sininho e efeitos'}
                >
                  <span className="material-symbols-outlined text-[17px]">
                    {soundEnabled ? 'volume_up' : 'volume_off'}
                  </span>
                </button>

                {/* Botão Fechar */}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 active:scale-90 text-white flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                  title="Fechar painel"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>

            {/* Balão Didático do Guardião com dica financeira */}
            <div className="mt-2.5 bg-black/20 backdrop-blur-md rounded-2xl p-2.5 sm:p-3 border border-white/20 flex items-start gap-2.5 text-xs shadow-xs relative">
              <span className="text-xl shrink-0 p-1 bg-white/10 rounded-xl">🤖</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] uppercase font-black tracking-wider text-amber-200 mb-0.5">
                  <span>Guardião do Radar</span>
                  <span className="w-1 h-1 rounded-full bg-amber-300" />
                  <span>Dica Inteligente</span>
                </div>
                <p className="text-[11.5px] text-amber-50 leading-relaxed font-medium break-words">
                  {overdueList.length > 0
                    ? `⚠️ Você tem ${overdueList.length} ${overdueList.length === 1 ? 'parcela que merece atenção prioritária' : 'parcelas que merecem atenção prioritária'}. Toque em "Cobrar WhatsApp" para enviar a mensagem pronta com a chave PIX ou registre a baixa!`
                    : dueTodayList.length > 0
                    ? `🗓️ Confira os próximos vencimentos! Identificamos ${dueTodayList.length} ${dueTodayList.length === 1 ? 'fatura vencendo hoje' : 'faturas vencendo hoje'}. Dê baixa assim que receber o comprovante.`
                    : upcomingList.length > 0
                    ? `🗓️ Confira os próximos vencimentos! Identificamos ${upcomingList.length} ${upcomingList.length === 1 ? 'parcela programada para os próximos dias' : 'parcelas programadas para os próximos dias'}.`
                    : '✨ Tudo certo! Sua lista está organizada e todos os recebíveis estão em dia. Boa! Mais uma etapa concluída.'}
                </p>
              </div>
            </div>
          </div>

          {/* STATUS DIDÁTICO DO PUSH NO NAVEGADOR COM BOTÕES DE AÇÃO */}
          <div
            className={`px-3.5 py-2.5 border-b shrink-0 transition-colors ${
              permission === 'granted'
                ? isDarkMode
                  ? 'bg-emerald-950/35 border-emerald-800/40 text-emerald-200'
                  : 'bg-emerald-50/80 border-emerald-200/90 text-emerald-900'
                : isDarkMode
                ? 'bg-amber-950/35 border-amber-800/40 text-amber-200'
                : 'bg-amber-50/90 border-amber-200/90 text-amber-900'
            }`}
          >
            <div className="flex items-center justify-between gap-2.5 flex-wrap">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span
                  className={`material-symbols-outlined text-[20px] shrink-0 ${
                    permission === 'granted' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {permission === 'granted' ? 'verified' : 'notifications_paused'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black truncate">
                      {permission === 'granted' ? 'Push no Navegador Ativo' : 'Alertas Push Pendentes'}
                    </span>
                    <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-md uppercase tracking-wider ${
                      permission === 'granted'
                        ? 'bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                        : 'bg-amber-200/60 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300'
                    }`}>
                      {permission === 'granted' ? 'Ativo' : 'Pendente'}
                    </span>
                  </div>
                  <p className="text-[10.5px] opacity-80 break-words">
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
                  className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold text-[11px] rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <span className="material-symbols-outlined text-[15px]">touch_app</span>
                  <span>Ativar Push Agora</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleTestNotification}
                    className="px-3 py-1 bg-white hover:bg-slate-50 text-emerald-700 font-bold text-[11px] rounded-xl border border-emerald-300 shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                    title="Disparar notificação de teste no navegador"
                  >
                    <span className="material-symbols-outlined text-[14px]">play_circle</span>
                    <span>Testar Push</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ABAS INTERATIVAS PARA NAVEGAÇÃO DIDÁTICA */}
          <div className="px-3 pt-2.5 pb-1.5 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex items-center gap-2 shrink-0 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => {
                playBellChime('click');
                setActiveTab('overdue');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'overdue'
                  ? 'bg-red-600 text-white shadow-xs scale-102 ring-2 ring-red-400/40'
                  : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              <span>🚨 Em Atraso</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
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
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'upcoming'
                  ? 'bg-amber-500 text-white shadow-xs scale-102 ring-2 ring-amber-400/40'
                  : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              <span>⚡ Vencendo (48h)</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
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
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ml-auto ${
                activeTab === 'how_it_works'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Como funciona o sistema de push"
            >
              <span className="material-symbols-outlined text-[15px]">help</span>
              <span className="hidden sm:inline">Como Funciona</span>
            </button>
          </div>

          {/* ============================================================ */}
          {/* CONTEÚDO ROLÁVEL COM AÇÕES DIRETAS (WHATSAPP, QUITAR, VER)   */}
          {/* ============================================================ */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-3.5 space-y-3 max-h-[52vh] sm:max-h-[50vh] scrollbar-thin bg-slate-50/50 dark:bg-slate-900/40">
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

                    {overdueList.map((inst) => {
                      const info = getDebtorInfo(inst.debtorId, inst.debtorName);
                      return (
                        <div
                          key={inst.id}
                          className="bg-white dark:bg-slate-800/90 border-2 border-red-200/90 dark:border-red-900/60 hover:border-red-400 dark:hover:border-red-600 rounded-2xl p-3 sm:p-3.5 shadow-xs hover:shadow-md transition-all flex flex-col gap-3 group"
                        >
                          {/* Topo do Card da Parcela */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                              <img
                                src={info.avatar}
                                alt={info.name}
                                className="w-10 h-10 rounded-2xl object-cover ring-2 ring-red-400/60 shadow-xs shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h4 className="font-black text-xs sm:text-sm text-slate-900 dark:text-white break-words">
                                    {info.name}
                                  </h4>
                                  <span className="text-[9.5px] px-2 py-0.5 rounded-full font-black bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 shrink-0">
                                    #{inst.installmentNumber}/{inst.totalInstallments}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium break-words mt-0.5">
                                  {inst.product || 'Compra'} • Venceu em <strong className="text-slate-700 dark:text-slate-300 font-mono">{inst.dueDate}</strong>
                                </p>
                              </div>
                            </div>

                            <div className="text-right shrink-0 flex flex-col items-end pl-1">
                              <span className="font-black font-mono text-sm sm:text-base text-red-600 dark:text-red-400 block leading-tight">
                                {safeFormatCurrency(inst.amount)}
                              </span>
                              <span className="text-[9.5px] font-black text-red-700 bg-red-100 dark:bg-red-950/70 dark:text-red-300 border border-red-300 dark:border-red-800 px-2 py-0.5 rounded-full inline-flex items-center gap-1 mt-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping shrink-0" />
                                {inst.diffDays}d atrasada
                              </span>
                            </div>
                          </div>

                          {/* BOTÕES DE AÇÃO DIRETA (FÁCIL, DIVERTIDO E SEM CORTES) */}
                          <div className="pt-2.5 border-t border-slate-100 dark:border-slate-750 flex items-center gap-2">
                            {/* Ação 1: Cobrar no WhatsApp */}
                            <button
                              type="button"
                              onClick={() => {
                                playBellChime('pop');
                                handleActionWhatsApp(inst);
                              }}
                              className="flex-1 py-2 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                              title={`Enviar lembrete amigável no WhatsApp para ${info.name}`}
                            >
                              <span className="material-symbols-outlined text-[16px]">chat</span>
                              <span>Cobrar WhatsApp</span>
                            </button>

                            {/* Ação 2: Quitar / Dar Baixa Direto */}
                            <button
                              type="button"
                              onClick={() => {
                                playBellChime('coin');
                                handleActionSettle(inst);
                              }}
                              className="py-2 px-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0"
                              title="Dar baixa / quitar esta parcela"
                            >
                              <span className="material-symbols-outlined text-[16px]">check_circle</span>
                              <span>Quitar</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
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

                        {dueTodayList.map((inst) => {
                          const info = getDebtorInfo(inst.debtorId, inst.debtorName);
                          return (
                            <div
                              key={inst.id}
                              className="bg-white dark:bg-slate-800/90 border-2 border-amber-300 dark:border-amber-700/70 rounded-2xl p-3 sm:p-3.5 shadow-xs hover:shadow-md transition-all flex flex-col gap-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                                  <img
                                    src={info.avatar}
                                    alt={info.name}
                                    className="w-10 h-10 rounded-2xl object-cover ring-2 ring-amber-400 shadow-xs shrink-0"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <h4 className="font-black text-xs sm:text-sm text-slate-900 dark:text-white break-words">
                                        {info.name}
                                      </h4>
                                      <span className="text-[9.5px] px-2 py-0.5 rounded-full font-black bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0">
                                        #{inst.installmentNumber}/{inst.totalInstallments}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium break-words mt-0.5">
                                      {inst.product || 'Recebível'} • <strong className="text-amber-700 dark:text-amber-300">Vence Hoje!</strong>
                                    </p>
                                  </div>
                                </div>

                                <div className="text-right shrink-0 flex flex-col items-end pl-1">
                                  <span className="font-black font-mono text-sm sm:text-base text-amber-700 dark:text-amber-400 block leading-tight">
                                    {safeFormatCurrency(inst.amount)}
                                  </span>
                                  <span className="text-[9.5px] font-black text-amber-800 bg-amber-100 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-800 px-2 py-0.5 rounded-full inline-block mt-1">
                                    Vence Hoje
                                  </span>
                                </div>
                              </div>

                              <div className="pt-2.5 border-t border-slate-100 dark:border-slate-750 flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    playBellChime('pop');
                                    handleActionWhatsApp(inst);
                                  }}
                                  className="flex-1 py-2 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
                                  title={`Enviar lembrete gentil para ${info.name}`}
                                >
                                  <span className="material-symbols-outlined text-[16px]">chat</span>
                                  <span>Lembrar no WhatsApp</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    playBellChime('coin');
                                    handleActionSettle(inst);
                                  }}
                                  className="py-2 px-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer shrink-0"
                                >
                                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                                  <span>Quitar</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Vencem em 48h / 72h */}
                    {upcomingList.length > 0 && (
                      <div className="space-y-2.5 mt-2.5">
                        <span className="text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1 px-1">
                          <span className="material-symbols-outlined text-[15px]">schedule</span>
                          Próximos Vencimentos (48h / 72h)
                        </span>

                        {upcomingList.map((inst) => {
                          const info = getDebtorInfo(inst.debtorId, inst.debtorName);
                          return (
                            <div
                              key={inst.id}
                              className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 rounded-2xl p-3 sm:p-3.5 shadow-xs hover:shadow-md transition-all flex flex-col gap-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                                  <img
                                    src={info.avatar}
                                    alt={info.name}
                                    className="w-10 h-10 rounded-2xl object-cover ring-2 ring-blue-300 shadow-xs shrink-0"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <h4 className="font-black text-xs sm:text-sm text-slate-900 dark:text-white break-words">
                                        {info.name}
                                      </h4>
                                      <span className="text-[9.5px] px-2 py-0.5 rounded-full font-black bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 shrink-0">
                                        #{inst.installmentNumber}/{inst.totalInstallments}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium break-words mt-0.5">
                                      {inst.product || 'Recebível'} • Vence em <strong className="text-slate-700 dark:text-slate-300 font-mono">{inst.dueDate}</strong>
                                    </p>
                                  </div>
                                </div>

                                <div className="text-right shrink-0 flex flex-col items-end pl-1">
                                  <span className="font-black font-mono text-sm sm:text-base text-slate-900 dark:text-white block leading-tight">
                                    {safeFormatCurrency(inst.amount)}
                                  </span>
                                  <span className="text-[9.5px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-full inline-block mt-1">
                                    Em {inst.diffDays} {inst.diffDays === 1 ? 'dia' : 'dias'}
                                  </span>
                                </div>
                              </div>

                              <div className="pt-2.5 border-t border-slate-100 dark:border-slate-750 flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    playBellChime('pop');
                                    handleActionWhatsApp(inst);
                                  }}
                                  className="flex-1 py-2 px-3 bg-slate-100 dark:bg-slate-700/80 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                                  title="Avisar com antecedência pelo WhatsApp"
                                >
                                  <span className="material-symbols-outlined text-[15px] text-emerald-600">chat</span>
                                  <span>Avisar Antecipado</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    playBellChime('coin');
                                    handleActionSettle(inst);
                                  }}
                                  className="py-2 px-3.5 bg-slate-100 dark:bg-slate-700/80 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer active:scale-95 shrink-0"
                                >
                                  <span>Quitar</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
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

          {/* RODAPÉ: AÇÕES GERAIS COM BALÕES E BOTÕES DE DESTAQUE */}
          <div className="p-3 sm:p-3.5 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopySummary}
              className="py-2 px-3 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
              title="Copiar resumo completo das cobranças"
            >
              <span className="material-symbols-outlined text-[16px]">content_copy</span>
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
                className="py-2 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <span>Ver Todas as Parcelas</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
