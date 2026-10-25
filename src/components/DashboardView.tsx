import React, { useState, useMemo, useEffect } from 'react';
import { Debtor, Installment, Purchase, ScreenTab } from '../types';
import { SafeDebtorAvatar } from './DebtorsMasterSpreadsheet';
import { parseDateParts } from '../utils/dateUtils';
import { safeToFixed } from '../utils/numberUtils';
import { CardMeteor } from './CardMeteor';
import { DebtorUnitaryItemsModal } from './DebtorUnitaryItemsModal';
import { DebtorKpiDetailModal, DebtorKpiType } from './DebtorKpiDetailModal';
import { ParcelasView } from './ParcelasView';
import { playAppSound } from '../utils/soundUtils';

interface DashboardViewProps {
  debtors: Debtor[];
  purchases: Purchase[];
  installments: Installment[];
  onNavigate: (tab: ScreenTab, targetId?: string, extraId?: string) => void;
  onOpenNewPurchase: () => void;
  onOpenNewDebtor: () => void;
  onOpenGeminiScanner?: () => void;
  onNudgeWhatsApp: (name: string, amount: string, item: string, parcel: string, phone?: string) => void;
  onSettleInstallment: (inst: Installment) => void;
  onShowProof?: (
    payer: string,
    amount: string,
    date: string,
    dest: string,
    auth: string,
    item: string
  ) => void;
  onOpenNewPurchaseForDebtor?: (debtorId: string) => void;
  onEditDebtor?: (debtor: Debtor) => void;
  onOpenContract?: (debtorId: string) => void;
  onOpenExtratoTotal?: (purchaseId?: string, debtorId?: string) => void;
  onOpenPdfHub?: (debtorId?: string) => void;
  searchQuery: string;
  initialDebtorId?: string;
  initialPurchaseFilter?: string;
  onSelectDebtor?: (debtorId: string) => void;
  onToast?: (msg: string) => void;
  onUpdateInstallment?: (inst: Installment) => void;
  userPixKey?: string;
  initialSection?: 'visao_clara' | 'dark' | 'visao_geral' | 'devedores' | 'parcelas';
  onRequestDeleteDebtor?: (debtor: Debtor) => void;
  onRestoreAllData?: () => void;
  onDeleteInstallment?: (id: string) => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  debtors,
  purchases,
  installments,
  onNavigate,
  onOpenNewPurchase,
  onOpenNewDebtor,
  onOpenGeminiScanner,
  onNudgeWhatsApp,
  onSettleInstallment,
  onDeleteInstallment,
  onShowProof,
  onOpenNewPurchaseForDebtor = () => {},
  onEditDebtor,
  onOpenContract,
  onOpenExtratoTotal,
  onOpenPdfHub,
  searchQuery = '',
  initialDebtorId,
  initialPurchaseFilter,
  onSelectDebtor,
  onToast,
  onUpdateInstallment,
  userPixKey,
  initialSection = 'visao_geral',
  onRequestDeleteDebtor,
  onRestoreAllData,
  theme = 'light',
  onToggleTheme,
}) => {
  const [activeSection, setActiveSection] = useState<'visao_geral' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('haspaho_dashboard_mode');
      if (saved === 'dark' || saved === 'visao_geral') return saved;
    } catch {}
    if (theme === 'dark') return 'dark';
    return initialSection === 'dark' ? 'dark' : 'visao_geral';
  });

  const handleSetSection = (mode: 'visao_geral' | 'dark') => {
    setActiveSection(mode);
    try {
      localStorage.setItem('haspaho_dashboard_mode', mode);
      localStorage.setItem('haspaho_theme', mode === 'dark' ? 'dark' : 'light');
    } catch {}
    if (mode === 'dark' && theme !== 'dark' && onToggleTheme) {
      onToggleTheme();
    } else if (mode === 'visao_geral' && theme === 'dark' && onToggleTheme) {
      onToggleTheme();
    }
  };

  useEffect(() => {
    if (theme === 'dark' && activeSection !== 'dark') {
      setActiveSection('dark');
    } else if (theme === 'light' && activeSection === 'dark') {
      setActiveSection('visao_geral');
    }
  }, [theme]);

  const today = new Date();
  const currentMonthNum = today.getMonth() + 1;
  const currentYearNum = today.getFullYear();
  const monthAbbrs = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  const currentMonthAbbr = monthAbbrs[currentMonthNum - 1];

  const [localSearch, setLocalSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'adimplente' | 'inadimplente' | 'quitado'>('all');
  
  // O devedor ativo raiz (Root Active Debtor)
  const [activeDebtorId, setActiveDebtorId] = useState<string>(
    () => initialDebtorId || 'all'
  );
  const [activeKpiModal, setActiveKpiModal] = useState<DebtorKpiType | null>(null);

  useEffect(() => {
    if (initialDebtorId && initialDebtorId !== activeDebtorId) {
      setActiveDebtorId(initialDebtorId);
    }
  }, [initialDebtorId]);

  const [isUnitaryModalOpen, setIsUnitaryModalOpen] = useState(false);
  const [selectedDebtorForUnitary, setSelectedDebtorForUnitary] = useState<Debtor | null>(null);
  const [initialUnitaryItemId, setInitialUnitaryItemId] = useState<string | undefined>(undefined);

  // Modal interativo de seleção de devedor
  const [isDebtorSelectModalOpen, setIsDebtorSelectModalOpen] = useState(false);
  const [debtorSearchTerm, setDebtorSearchTerm] = useState('');

  const isInstallmentInCurrentMonth = (dateStr: string) => {
    if (!dateStr) return false;
    const { month, year } = parseDateParts(dateStr);
    return month === currentMonthNum && year === currentYearNum;
  };

  const filteredDebtors = useMemo(() => {
    const q = (searchQuery || localSearch).trim().toLowerCase();

    return debtors.filter((d) => {
      const matchesSearch =
        !q ||
        d.name.toLowerCase().includes(q) ||
        (d.cpfCnpj && d.cpfCnpj.includes(q)) ||
        (d.phone && d.phone.includes(q));

      const hasOverdue = d.overdueCount && d.overdueCount > 0;
      const isPaidOff = d.totalOwed <= 0;

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'adimplente' && !hasOverdue && !isPaidOff) ||
        (statusFilter === 'inadimplente' && hasOverdue) ||
        (statusFilter === 'quitado' && isPaidOff);

      return matchesSearch && matchesStatus;
    });
  }, [debtors, searchQuery, localSearch, statusFilter]);

  // Enraizamento rigoroso no devedor ativo (ou null para Visão Geral / Consolidado)
  const selectedPrimaryDebtor = useMemo(() => {
    if (activeDebtorId && activeDebtorId !== 'all') {
      const found = debtors.find((d) => d.id === activeDebtorId);
      if (found) return found;
    }
    return null;
  }, [debtors, activeDebtorId]);

  // Parcelas estritamente enraizadas no devedor selecionado
  const targetInstallments = useMemo(() => {
    if (selectedPrimaryDebtor) {
      return installments.filter(
        (i) =>
          i.debtorId === selectedPrimaryDebtor.id ||
          (i.debtorName && i.debtorName.toLowerCase().trim() === selectedPrimaryDebtor.name.toLowerCase().trim())
      );
    }
    return installments;
  }, [installments, selectedPrimaryDebtor]);

  // 1. Total em Aberto do Devedor Ativo
  const totalOpenAmount = useMemo(() => {
    return targetInstallments
      .filter((i) => i.status !== 'paid')
      .reduce((acc, curr) => acc + (curr.amount || curr.originalAmount || 0), 0);
  }, [targetInstallments]);

  const pendingCount = useMemo(() => {
    return targetInstallments.filter((i) => i.status !== 'paid').length;
  }, [targetInstallments]);

  // 2. Total Quitado do Devedor Ativo
  const totalPaidAmount = useMemo(() => {
    return targetInstallments
      .filter((i) => i.status === 'paid')
      .reduce((acc, curr) => acc + (curr.paidAmount || curr.amount || curr.originalAmount || 0), 0);
  }, [targetInstallments]);

  const paidCount = useMemo(() => {
    return targetInstallments.filter((i) => i.status === 'paid').length;
  }, [targetInstallments]);

  // 3. Total em Atraso do Devedor Ativo
  const overdueInstallments = useMemo(() => {
    return targetInstallments.filter((i) => i.status === 'overdue' || (i.delayDays || 0) > 0);
  }, [targetInstallments]);

  const overdueTotal = useMemo(() => {
    return overdueInstallments.reduce((acc, curr) => acc + (curr.amount || curr.originalAmount || 0), 0);
  }, [overdueInstallments]);

  // 4. Mês Atual do Devedor Ativo
  const soonInstallments = useMemo(() => {
    return targetInstallments.filter((i) => isInstallmentInCurrentMonth(i.dueDate));
  }, [targetInstallments, currentMonthNum, currentYearNum]);

  const soonTotal = useMemo(() => {
    return soonInstallments.reduce((acc, curr) => acc + (curr.amount || curr.originalAmount || 0), 0);
  }, [soonInstallments]);

  const isDarkMode = activeSection === 'dark';
  const debtorFullName = selectedPrimaryDebtor ? selectedPrimaryDebtor.name : 'Todos os Clientes (Consolidado)';
  const debtorFirstName = selectedPrimaryDebtor ? selectedPrimaryDebtor.name.split(' ')[0] : 'Geral';

  // Devedor ativo garantido para o modal detalhado (enraizado ou consolidado)
  const activeModalDebtor = useMemo(() => {
    if (selectedPrimaryDebtor) return selectedPrimaryDebtor;
    return {
      id: 'general',
      name: 'Todos os Clientes (Consolidado)',
      phone: '',
      totalOwed: totalOpenAmount,
      totalPaid: totalPaidAmount,
      status: 'active',
      relation: 'Todos os Recebíveis',
      purchasesCount: purchases.length,
      overdueCount: overdueInstallments.length,
      createdAt: new Date().toISOString(),
    } as unknown as Debtor;
  }, [selectedPrimaryDebtor, totalOpenAmount, totalPaidAmount, purchases.length, overdueInstallments.length]);

  return (
    <>
      <div className={`flex flex-col w-full gap-2 sm:gap-2.5 pb-16 transition-colors duration-300 animate-in fade-in slide-in-from-bottom-2 ${
        isDarkMode ? 'text-white' : 'text-slate-850'
      }`}>
        
        {/* ============================================================ */}
        {/* 1. PAINEL OPERACIONAL ENRAIZADO NO DEVEDOR ATIVO (COM LUZ)   */}
        {/* ============================================================ */}
        <div className="financial-container relative overflow-hidden bg-slate-900/95 backdrop-blur-xl rounded-xl sm:rounded-2xl p-2 sm:p-3 text-white shadow-[0_0_24px_rgba(6,182,212,0.22)] border-2 border-cyan-400/60 ring-1 ring-cyan-400/40 flex flex-col gap-1.5 sm:gap-2 animate-in fade-in zoom-in-95 duration-300">
          <CardMeteor variant="multi" />
          <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#22d3ee_1px,transparent_1px)] [background-size:16px_16px]"></div>
          
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 sm:gap-2 animate-in fade-in duration-300">
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <h2 className="text-xs sm:text-sm font-black text-white leading-tight flex items-center gap-1.5 flex-wrap">
                <span className="animate-nome-badge px-1.5 py-0.5 rounded-md bg-white/5 border border-cyan-400/30">Painel Operacional</span>
                <span className="animate-parcela-badge text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-cyan-500/25 text-cyan-300 border border-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                  Oficial
                </span>
                <span className="animate-quitado-badge text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-emerald-500/25 text-emerald-300 border border-emerald-400/50 shadow-[0_0_10px_rgba(16,185,129,0.3)] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  100% Interativo
                </span>
                {selectedPrimaryDebtor && (
                  <span className="animate-nome-badge text-[10px] font-bold text-cyan-200 bg-cyan-950/90 px-2 py-0.5 rounded-full border border-cyan-400/50 shadow-[0_0_12px_rgba(6,182,212,0.35)] flex items-center gap-1 truncate">
                    <span className="material-symbols-outlined text-[12px] text-cyan-400">person</span>
                    <span>{selectedPrimaryDebtor.name}</span>
                  </span>
                )}
              </h2>
              <p className="text-slate-300 text-[10px] sm:text-[11px] max-w-xl leading-tight">
                Dados e métricas enraizados em <strong>{debtorFullName}</strong>.
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
              {/* Seletor rápido de devedor diretamente no Painel via Modal Personalizado */}
              {debtors.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    playAppSound('pop');
                    setIsDebtorSelectModalOpen(true);
                  }}
                  className="animate-nome-badge flex items-center gap-1.5 bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 border-2 border-cyan-400/80 hover:border-cyan-300 rounded-xl px-2.5 py-1 text-[11px] font-black text-white shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all cursor-pointer active:scale-95 group"
                  title="Toque para abrir a lista interativa de clientes"
                >
                  <span className="material-symbols-outlined text-[15px] text-cyan-400 group-hover:scale-110 transition-transform animate-foto-motion">person_search</span>
                  <span className="text-[10px] text-cyan-200 font-bold uppercase tracking-wider hidden sm:inline">Cliente:</span>
                  <span className="text-white font-extrabold max-w-[125px] sm:max-w-[170px] truncate">
                    {selectedPrimaryDebtor ? selectedPrimaryDebtor.name : 'Todos os Clientes'}
                  </span>
                  <span className="material-symbols-outlined text-[16px] text-cyan-400 group-hover:translate-y-0.5 transition-transform">keyboard_arrow_down</span>
                </button>
              )}

              {/* Botão Oficial ERP Corporativo / Delphi Desktop (Ao lado de Todos os Clientes) */}
              <button
                type="button"
                onClick={() => {
                  try { playAppSound('pop'); } catch {}
                  onNavigate('erp-legacy');
                }}
                className="animate-data-badge px-2.5 py-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-[0_0_14px_rgba(245,158,11,0.4)] active:scale-95 shrink-0 border border-amber-300/80 group"
                title="Abrir Sistema ERP Corporativo / Delphi Desktop"
              >
                <span className="material-symbols-outlined text-[15px] text-slate-950 group-hover:scale-110 transition-transform">desktop_windows</span>
                <span className="font-black tracking-wide">ERP</span>
              </button>
            </div>
          </div>

          {/* 4 BOTÕES INTERATIVOS BRANCOS ENRAIZADOS NO DEVEDOR ATIVO (GRADE COMPACTA 2x2 NO MOBILE COM ANIMATE-IN E MOVIMENTO) */}
          <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-2 w-full">
            {/* 1. Total em Aberto */}
            <button
              type="button"
              onClick={() => {
                playAppSound('pop');
                setActiveKpiModal('open');
              }}
              className="animate-kpi-card animate-kpi-delay-1 indicator-card financial-container w-full text-left relative overflow-hidden bg-white/95 backdrop-blur-md p-2 sm:p-2.5 rounded-xl border-2 border-cyan-400/80 shadow-[0_0_14px_rgba(6,182,212,0.2)] ring-1 ring-cyan-400/30 flex flex-col justify-between gap-1 text-slate-850 select-none hover:border-cyan-400 hover:ring-2 hover:ring-cyan-400/60 hover:shadow-[0_0_24px_rgba(6,182,212,0.45)] hover:scale-[1.01] active:scale-95 transition-all duration-300 cursor-pointer group"
              title={`Toque para ver o total em aberto de ${debtorFullName}`}
            >
              {/* Animação de brilho suave e halo radial */}
              <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-cyan-400/30" />
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none bg-gradient-to-r from-transparent via-cyan-300/30 to-transparent skew-x-12" />

              <div className="relative z-10 flex items-center justify-between gap-1">
                <span className="animate-parcela-badge inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-cyan-600 text-white text-[8.5px] sm:text-[9.5px] font-black uppercase tracking-wider truncate">
                  EM ABERTO
                </span>
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-cyan-50 text-cyan-700 flex items-center justify-center shrink-0 border border-cyan-200 group-hover:bg-cyan-500 group-hover:text-white transition-all animate-foto-motion">
                  <span className="material-symbols-outlined text-[13px]">account_balance_wallet</span>
                </div>
              </div>

              {/* Babadinho de Identificação da Pessoa */}
              <div className="animate-nome-badge relative z-10 flex items-center gap-1 bg-gradient-to-r from-cyan-50 to-cyan-100/90 border border-cyan-300/90 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold text-cyan-900 max-w-full">
                <span className="material-symbols-outlined text-[11px] text-cyan-600 shrink-0">person</span>
                <span className="truncate">{debtorFullName}</span>
              </div>

              <div className="relative z-10">
                <div className="text-sm sm:text-base font-black text-slate-900 font-mono tracking-tight leading-tight group-hover:text-cyan-950 transition-colors truncate">
                  R$ {safeToFixed(totalOpenAmount)}
                </div>
                <span className="text-[9px] sm:text-[10px] text-slate-600 font-medium truncate block">
                  {pendingCount} pendente(s) • <strong className="text-cyan-800 font-bold">{debtorFirstName}</strong>
                </span>
              </div>
              <div className="relative z-10 pt-1 border-t border-cyan-100/80 flex items-center justify-between text-[9px] font-bold text-cyan-700 group-hover:text-cyan-900 transition-colors">
                <span className="flex items-center gap-0.5 truncate">
                  <span className="material-symbols-outlined text-[11px] text-cyan-600 animate-icon-receipt">touch_app</span>
                  <span className="truncate">Ver faturas</span>
                </span>
                <span className="material-symbols-outlined text-[11px] group-hover:translate-x-0.5 transition-transform text-cyan-500 shrink-0">chevron_right</span>
              </div>
            </button>

            {/* 2. Total Quitado */}
            <button
              type="button"
              onClick={() => {
                playAppSound('success');
                setActiveKpiModal('paid');
              }}
              className="animate-kpi-card animate-kpi-delay-2 indicator-card financial-container w-full text-left relative overflow-hidden bg-white/95 backdrop-blur-md p-2 sm:p-2.5 rounded-xl border-2 border-emerald-400/80 shadow-[0_0_14px_rgba(16,185,129,0.2)] ring-1 ring-emerald-400/30 flex flex-col justify-between gap-1 text-slate-850 select-none hover:border-emerald-400 hover:ring-2 hover:ring-emerald-400/60 hover:shadow-[0_0_24px_rgba(16,185,129,0.45)] hover:scale-[1.01] active:scale-95 transition-all duration-300 cursor-pointer group"
              title={`Toque para ver o total quitado de ${debtorFullName}`}
            >
              {/* Animação de brilho suave e halo radial */}
              <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-emerald-400/30" />
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none bg-gradient-to-r from-transparent via-emerald-300/30 to-transparent skew-x-12" />

              <div className="relative z-10 flex items-center justify-between gap-1">
                <span className="animate-quitado-badge inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[8.5px] sm:text-[9.5px] font-black uppercase tracking-wider truncate">
                  TOTAL QUITADO
                </span>
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                  <span className="material-symbols-outlined text-[13px] animate-icon-check">check_circle</span>
                </div>
              </div>

              {/* Babadinho de Identificação da Pessoa */}
              <div className="animate-nome-badge relative z-10 flex items-center gap-1 bg-gradient-to-r from-emerald-50 to-emerald-100/90 border border-emerald-300/90 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold text-emerald-900 max-w-full">
                <span className="material-symbols-outlined text-[11px] text-emerald-600 shrink-0">person</span>
                <span className="truncate">{debtorFullName}</span>
              </div>

              <div className="relative z-10">
                <div className="text-sm sm:text-base font-black text-emerald-700 font-mono tracking-tight leading-tight group-hover:text-emerald-800 transition-colors truncate">
                  R$ {safeToFixed(totalPaidAmount)}
                </div>
                <span className="text-[9px] sm:text-[10px] text-slate-600 font-medium truncate block">
                  {paidCount} liquidada(s) • <strong className="text-emerald-800 font-bold">{debtorFirstName}</strong>
                </span>
              </div>
              <div className="relative z-10 pt-1 border-t border-emerald-100/80 flex items-center justify-between text-[9px] font-bold text-emerald-700 group-hover:text-emerald-900 transition-colors">
                <span className="flex items-center gap-0.5 truncate">
                  <span className="material-symbols-outlined text-[11px] text-emerald-600 animate-icon-receipt">touch_app</span>
                  <span className="truncate">Ver liquidadas</span>
                </span>
                <span className="material-symbols-outlined text-[11px] group-hover:translate-x-0.5 transition-transform text-emerald-500 shrink-0">chevron_right</span>
              </div>
            </button>

            {/* 3. Total em Atraso */}
            <button
              type="button"
              onClick={() => {
                playAppSound('alert');
                setActiveKpiModal('overdue');
              }}
              className="animate-kpi-card animate-kpi-delay-3 indicator-card financial-container w-full text-left relative overflow-hidden bg-white/95 backdrop-blur-md p-2 sm:p-2.5 rounded-xl border-2 border-red-400/80 shadow-[0_0_14px_rgba(239,68,68,0.2)] ring-1 ring-red-400/30 flex flex-col justify-between gap-1 text-slate-850 select-none hover:border-red-400 hover:ring-2 hover:ring-red-400/60 hover:shadow-[0_0_24px_rgba(239,68,68,0.45)] hover:scale-[1.01] active:scale-95 transition-all duration-300 cursor-pointer group"
              title={`Toque para ver o total em atraso de ${debtorFullName}`}
            >
              {/* Animação de brilho suave e halo radial */}
              <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-red-400/30" />
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none bg-gradient-to-r from-transparent via-red-300/30 to-transparent skew-x-12" />

              <div className="relative z-10 flex items-center justify-between gap-1">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-50 text-red-800 border border-red-200 text-[8.5px] sm:text-[9.5px] font-black uppercase tracking-wider truncate">
                  EM ATRASO
                </span>
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-red-50 text-red-700 flex items-center justify-center shrink-0 border border-red-200 group-hover:bg-red-500 group-hover:text-white transition-all">
                  <span className="material-symbols-outlined text-[13px] animate-bounce">warning</span>
                </div>
              </div>

              {/* Babadinho de Identificação da Pessoa */}
              <div className="animate-nome-badge relative z-10 flex items-center gap-1 bg-gradient-to-r from-red-50 to-red-100/90 border border-red-300/90 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold text-red-900 max-w-full">
                <span className="material-symbols-outlined text-[11px] text-red-600 shrink-0">person</span>
                <span className="truncate">{debtorFullName}</span>
              </div>

              <div className="relative z-10">
                <div className="text-sm sm:text-base font-black text-red-700 font-mono tracking-tight leading-tight group-hover:text-red-800 transition-colors truncate">
                  R$ {safeToFixed(overdueTotal)}
                </div>
                <span className="text-[9px] sm:text-[10px] text-slate-600 font-medium truncate block">
                  {overdueInstallments.length} vencida(s) • <strong className="text-red-800 font-bold">{debtorFirstName}</strong>
                </span>
              </div>
              <div className="relative z-10 pt-1 border-t border-red-100/80 flex items-center justify-between text-[9px] font-bold text-red-700 group-hover:text-red-900 transition-colors">
                <span className="flex items-center gap-0.5 truncate">
                  <span className="material-symbols-outlined text-[11px] text-red-600 animate-icon-receipt">touch_app</span>
                  <span className="truncate">Ver atrasos</span>
                </span>
                <span className="material-symbols-outlined text-[11px] group-hover:translate-x-0.5 transition-transform text-red-500 shrink-0">chevron_right</span>
              </div>
            </button>

            {/* 4. Mês Atual */}
            <button
              type="button"
              onClick={() => {
                playAppSound('cheerful');
                setActiveKpiModal('month');
              }}
              className="animate-kpi-card animate-kpi-delay-4 indicator-card financial-container w-full text-left relative overflow-hidden bg-white/95 backdrop-blur-md p-2 sm:p-2.5 rounded-xl border-2 border-amber-400/80 shadow-[0_0_14px_rgba(245,158,11,0.2)] ring-1 ring-amber-400/30 flex flex-col justify-between gap-1 text-slate-850 select-none hover:border-amber-400 hover:ring-2 hover:ring-amber-400/60 hover:shadow-[0_0_24px_rgba(245,158,11,0.45)] hover:scale-[1.01] active:scale-95 transition-all duration-300 cursor-pointer group"
              title={`Toque para ver as faturas do mês atual de ${debtorFullName}`}
            >
              {/* Animação de brilho suave e halo radial */}
              <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-amber-400/30" />
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none bg-gradient-to-r from-transparent via-amber-300/30 to-transparent skew-x-12" />

              <div className="relative z-10 flex items-center justify-between gap-1">
                <span className="animate-data-badge inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[8.5px] sm:text-[9.5px] font-black uppercase tracking-wider truncate">
                  MÊS ({currentMonthAbbr})
                </span>
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200 group-hover:bg-amber-500 group-hover:text-white transition-all">
                  <span className="material-symbols-outlined text-[13px] animate-icon-calendar">calendar_month</span>
                </div>
              </div>

              {/* Babadinho de Identificação da Pessoa */}
              <div className="animate-nome-badge relative z-10 flex items-center gap-1 bg-gradient-to-r from-amber-50 to-amber-100/90 border border-amber-300/90 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold text-amber-900 max-w-full">
                <span className="material-symbols-outlined text-[11px] text-amber-600 shrink-0">person</span>
                <span className="truncate">{debtorFullName}</span>
              </div>

              <div className="relative z-10">
                <div className="text-sm sm:text-base font-black text-amber-700 font-mono tracking-tight leading-tight group-hover:text-amber-800 transition-colors truncate">
                  R$ {safeToFixed(soonTotal)}
                </div>
                <span className="text-[9px] sm:text-[10px] text-slate-600 font-medium truncate block">
                  {soonInstallments.length} em {currentMonthAbbr} • <strong className="text-amber-800 font-bold">{debtorFirstName}</strong>
                </span>
              </div>
              <div className="relative z-10 mt-1 pt-1 border-t border-amber-100/80 flex items-center justify-between text-[9px] font-bold text-amber-700 group-hover:text-amber-900 transition-colors">
                <span className="flex items-center gap-0.5 truncate">
                  <span className="material-symbols-outlined text-[11px] text-amber-600 animate-icon-receipt">touch_app</span>
                  <span className="truncate">Ver faturas</span>
                </span>
                <span className="material-symbols-outlined text-[11px] group-hover:translate-x-0.5 transition-transform text-amber-500 shrink-0">chevron_right</span>
              </div>
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* 2. PLANILHA FINANCEIRA UNIFICADA COM O CARD DO DEVEDOR       */}
        {/* ============================================================ */}
        <ParcelasView
          key={(activeDebtorId || 'all') + (isDarkMode ? '-dark' : '-light')}
          installments={installments}
          debtors={debtors}
          purchases={purchases}
          onNavigate={(tab: ScreenTab, targetId?: string) => {
            if (tab === 'dashboard') handleSetSection('visao_geral');
            else onNavigate(tab, targetId);
          }}
          onNudgeWhatsApp={onNudgeWhatsApp}
          onSettleInstallment={onSettleInstallment}
          onDeleteInstallment={onDeleteInstallment}
          onShowProof={onShowProof || (() => {})}
          onEditDebtor={onEditDebtor}
          onOpenContract={onOpenContract}
          onOpenExtratoTotal={onOpenExtratoTotal}
          onOpenGeminiScanner={onOpenGeminiScanner}
          onOpenNewPurchase={(debtorId) => {
            if (onOpenNewPurchaseForDebtor && debtorId) {
              onOpenNewPurchaseForDebtor(debtorId);
            } else {
              onOpenNewPurchase();
            }
          }}
          onOpenNewDebtor={onOpenNewDebtor}
          searchQuery={searchQuery}
          initialDebtorId={activeDebtorId === 'all' ? (selectedPrimaryDebtor?.id || 'all') : activeDebtorId}
          initialPurchaseFilter={initialPurchaseFilter}
          onSelectDebtor={(newDebtorId) => {
            setActiveDebtorId(newDebtorId);
            if (onSelectDebtor) onSelectDebtor(newDebtorId);
          }}
          onToast={onToast}
          onUpdateInstallment={onUpdateInstallment}
          userPixKey={userPixKey}
          onRequestDeleteDebtor={onRequestDeleteDebtor}
        />
      </div>

      {/* MODAL DE DETALHES DE KPIS ENRAIZADO NO DEVEDOR ATIVO */}
      <DebtorKpiDetailModal
          isOpen={activeKpiModal !== null}
          onClose={() => setActiveKpiModal(null)}
          type={activeKpiModal || 'open'}
          debtor={activeModalDebtor}
          installments={targetInstallments}
          onSettleInstallment={onSettleInstallment}
          onShowProof={onShowProof}
          onNudgeWhatsApp={(inst, msg) => {
            if (onNudgeWhatsApp && inst) {
              onNudgeWhatsApp(
                inst.debtorName,
                `R$ ${safeToFixed(inst.amount || inst.originalAmount || 0)}`,
                inst.product,
                `${inst.installmentNumber}/${inst.totalInstallments}`
              );
            }
          }}
          onToast={onToast}
        />

        {/* MODAL DE DETALHES DOS ITENS UNITÁRIOS */}
        <DebtorUnitaryItemsModal
          isOpen={isUnitaryModalOpen}
          onClose={() => setIsUnitaryModalOpen(false)}
          debtor={selectedDebtorForUnitary || selectedPrimaryDebtor}
          purchases={purchases}
          installments={installments}
          initialSelectedItemId={initialUnitaryItemId}
          onNudgeWhatsApp={onNudgeWhatsApp}
          onSettleInstallment={onSettleInstallment}
          onShowProof={onShowProof}
          onOpenNewPurchaseForDebtor={onOpenNewPurchaseForDebtor}
          onOpenExtratoTotal={onOpenExtratoTotal}
        />

        {/* MODAL INTERATIVO DE SELEÇÃO DE CLIENTE / DEVEDOR */}
        {isDebtorSelectModalOpen && (
          <div 
            className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
            onClick={() => setIsDebtorSelectModalOpen(false)}
          >
            <div
              className="w-full max-w-lg bg-gradient-to-b from-[#0b1b36] via-[#0f274d] to-[#081326] border-2 border-cyan-400/90 rounded-2xl sm:rounded-3xl shadow-[0_0_50px_rgba(6,182,212,0.4)] flex flex-col max-h-[85vh] overflow-hidden text-white relative animate-in zoom-in-95 duration-200 my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Topo do Modal */}
              <div className="p-2.5 sm:p-3.5 border-b border-cyan-500/20 bg-slate-950/80 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-300 shadow-xs shrink-0">
                    <span className="material-symbols-outlined text-[19px]">groups</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-sm sm:text-base text-white leading-tight truncate">
                      Selecionar Cliente / Devedor
                    </h3>
                    <p className="text-[10.5px] text-cyan-200/80 font-medium truncate">
                      Escolha quem deseja visualizar no painel
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsDebtorSelectModalOpen(false)}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-white/10 shrink-0"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>

              {/* Campo de Busca Rápida */}
              <div className="p-2 sm:p-2.5 bg-slate-900/60 border-b border-cyan-500/10 shrink-0">
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined text-cyan-400 text-[16px] absolute left-2.5 pointer-events-none">
                    search
                  </span>
                  <input
                    type="text"
                    value={debtorSearchTerm}
                    onChange={(e) => setDebtorSearchTerm(e.target.value)}
                    placeholder="Buscar por nome, telefone ou CPF..."
                    className="w-full bg-slate-950/80 border border-cyan-500/30 focus:border-cyan-400 rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder-slate-400 outline-none transition-all"
                  />
                  {debtorSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setDebtorSearchTerm('')}
                      className="absolute right-2 text-slate-400 hover:text-white text-xs cursor-pointer p-1"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Lista de Opções Compacta */}
              <div className="p-2 sm:p-2.5 overflow-y-auto space-y-1.5 flex-1 scrollbar-thin">
                {/* Opção 1: Todos os Clientes (Geral) */}
                {!debtorSearchTerm && (
                  <button
                    type="button"
                    onClick={() => {
                      playAppSound('pop');
                      setActiveDebtorId('all');
                      if (onSelectDebtor) onSelectDebtor('all');
                      setIsDebtorSelectModalOpen(false);
                    }}
                    className={`w-full p-2 sm:p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-all cursor-pointer group ${
                      activeDebtorId === 'all'
                        ? 'bg-gradient-to-r from-cyan-950/90 to-blue-950/90 border-cyan-400 ring-2 ring-cyan-400/60 shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                        : 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-cyan-400/40'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md shrink-0">
                        <span className="material-symbols-outlined text-[18px]">groups</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-xs sm:text-sm text-white group-hover:text-cyan-200 transition-colors truncate">
                            Todos os Clientes (Geral)
                          </span>
                          <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 text-[9px] font-bold">
                            Consolidado
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-300 truncate font-medium">
                          Visão geral unificada de todos os {debtors.length} devedores
                        </p>
                      </div>
                    </div>

                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 ${
                      activeDebtorId === 'all' ? 'bg-cyan-400 text-slate-950 font-black' : 'border border-white/30 text-transparent'
                    }`}>
                      ✓
                    </div>
                  </button>
                )}

                {/* Clientes Filtrados */}
                {debtors
                  .filter((d) => {
                    if (!debtorSearchTerm) return true;
                    const q = debtorSearchTerm.toLowerCase().trim();
                    return (
                      d.name.toLowerCase().includes(q) ||
                      (d.phone && d.phone.includes(q)) ||
                      (d.cpfCnpj && d.cpfCnpj.includes(q))
                    );
                  })
                  .map((d) => {
                    const isSelected = activeDebtorId === d.id;
                    const hasOverdue = (d.overdueCount || 0) > 0;
                    const isPaidOff = d.totalOwed <= 0;

                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          playAppSound('pop');
                          setActiveDebtorId(d.id);
                          if (onSelectDebtor) onSelectDebtor(d.id);
                          setIsDebtorSelectModalOpen(false);
                        }}
                        className={`w-full p-2 sm:p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-all cursor-pointer group ${
                          isSelected
                            ? 'bg-gradient-to-r from-cyan-950/90 to-blue-950/90 border-cyan-400 ring-2 ring-cyan-400/60 shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                            : 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-cyan-400/40'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <SafeDebtorAvatar
                            name={d.name}
                            avatar={d.avatar}
                            size="sm"
                            status={hasOverdue ? 'late' : 'ok'}
                            className="ring-2 ring-cyan-400/50 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="font-black text-xs sm:text-sm text-white group-hover:text-cyan-200 transition-colors truncate">
                                {d.name}
                              </span>
                              <span className="w-3 h-3 rounded-full bg-[#1d9bf0] text-white flex items-center justify-center text-[7px] font-black shrink-0">
                                ✓
                              </span>
                              {d.relation && (
                                <span className="px-1.5 py-0.2 rounded bg-white/10 text-cyan-200 text-[9px] font-bold">
                                  {d.relation}
                                </span>
                              )}
                            </div>

                            <div className="text-[10.5px] text-slate-300 flex items-center gap-1.5 truncate font-medium">
                              <span>Em aberto: <strong className="text-amber-300 font-mono">R$ {safeToFixed(d.totalOwed)}</strong></span>
                              {hasOverdue && (
                                <span className="text-red-400 font-bold">({d.overdueCount} atraso)</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {hasOverdue ? (
                            <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 text-[9px] font-bold">
                              Atrasado
                            </span>
                          ) : isPaidOff ? (
                            <span className="px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[9px] font-bold">
                              Quitado
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold">
                              Em dia
                            </span>
                          )}

                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 ${
                            isSelected ? 'bg-cyan-400 text-slate-950 font-black' : 'border border-white/30 text-transparent'
                          }`}>
                            ✓
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>

              {/* Rodapé do Modal */}
              <div className="p-2.5 bg-slate-950/80 border-t border-cyan-500/20 flex items-center justify-between gap-2 shrink-0">
                <span className="text-[10.5px] text-slate-300 font-medium">
                  Total de {debtors.length} clientes cadastrados
                </span>
                <button
                  type="button"
                  onClick={() => setIsDebtorSelectModalOpen(false)}
                  className="px-3.5 py-1 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs transition-all cursor-pointer shadow-md"
                >
                  Concluir
                </button>
              </div>
            </div>
          </div>
        )}
    </>
  );
};
