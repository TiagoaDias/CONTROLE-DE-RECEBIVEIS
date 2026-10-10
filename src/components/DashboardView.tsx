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
    () => initialDebtorId || (debtors.length > 0 ? debtors[0].id : 'all')
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

  // Enraizamento rigoroso no devedor ativo
  const selectedPrimaryDebtor = useMemo(() => {
    if (activeDebtorId && activeDebtorId !== 'all') {
      const found = debtors.find((d) => d.id === activeDebtorId);
      if (found) return found;
    }
    return filteredDebtors.length > 0 ? filteredDebtors[0] : (debtors.length > 0 ? debtors[0] : null);
  }, [filteredDebtors, debtors, activeDebtorId]);

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
  const debtorFirstName = selectedPrimaryDebtor ? selectedPrimaryDebtor.name.split(' ')[0] : 'Geral';

  // Devedor ativo garantido para o modal detalhado (enraizado ou consolidado)
  const activeModalDebtor = useMemo(() => {
    if (selectedPrimaryDebtor) return selectedPrimaryDebtor;
    if (debtors.length > 0) return debtors[0];
    return {
      id: 'general',
      name: 'Consolidado Geral',
      phone: '',
      totalOwed: totalOpenAmount,
      totalPaid: totalPaidAmount,
      status: 'active',
      relation: 'Todos os Recebíveis',
      purchasesCount: purchases.length,
      overdueCount: overdueInstallments.length,
      createdAt: new Date().toISOString(),
    } as unknown as Debtor;
  }, [selectedPrimaryDebtor, debtors, totalOpenAmount, totalPaidAmount, purchases.length, overdueInstallments.length]);

  return (
    <>
      <div className={`flex flex-col w-full gap-3.5 sm:gap-4 pb-20 transition-colors duration-300 ${
        isDarkMode ? 'text-white' : 'text-slate-850'
      }`}>
        
        {/* ============================================================ */}
        {/* 1. PAINEL OPERACIONAL ENRAIZADO NO DEVEDOR ATIVO (COM LUZ)   */}
        {/* ============================================================ */}
        <div className="financial-container relative overflow-hidden bg-slate-900/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 text-white shadow-[0_0_28px_rgba(6,182,212,0.25)] border-2 border-cyan-400/60 ring-1 ring-cyan-400/40 flex flex-col gap-3">
          <CardMeteor variant="multi" />
          <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#22d3ee_1px,transparent_1px)] [background-size:16px_16px]"></div>
          
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="flex flex-col gap-0.5 min-w-0">
              <h2 className="text-sm sm:text-base font-black text-white leading-tight flex items-center gap-2 flex-wrap">
                <span>Painel Operacional</span>
                <span className="text-[9.5px] font-black uppercase px-2 py-0.5 rounded-full bg-cyan-500/25 text-cyan-300 border border-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                  Oficial
                </span>
                <span className="text-[9.5px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/25 text-emerald-300 border border-emerald-400/50 shadow-[0_0_10px_rgba(16,185,129,0.3)] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  100% Interativo
                </span>
                {selectedPrimaryDebtor && (
                  <span className="text-[11px] font-bold text-cyan-200 bg-cyan-950/90 px-2.5 py-0.5 rounded-full border border-cyan-400/50 shadow-[0_0_12px_rgba(6,182,212,0.35)] flex items-center gap-1.5 truncate">
                    <span className="material-symbols-outlined text-[13px] text-cyan-400">person</span>
                    <span>{selectedPrimaryDebtor.name}</span>
                  </span>
                )}
              </h2>
              <p className="text-slate-300 text-[11px] max-w-xl leading-snug">
                Dados e métricas enraizados em {selectedPrimaryDebtor ? selectedPrimaryDebtor.name : 'todos os devedores'}.
              </p>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('erp-legacy')}
              className="px-3 py-1.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_0_14px_rgba(245,158,11,0.4)] active:scale-95 shrink-0 border border-amber-400/60"
              title="Abrir Sistema ERP Corporativo / Delphi Desktop"
            >
              <span className="material-symbols-outlined text-[16px]">desktop_windows</span>
              <span>ERP</span>
            </button>
          </div>

          {/* 4 BOTÕES INTERATIVOS BRANCOS ENRAIZADOS NO DEVEDOR ATIVO (COM LUZ E BRILHO SUAVE) */}
          <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 w-full">
            {/* 1. Total em Aberto */}
            <button
              type="button"
              onClick={() => {
                playAppSound('pop');
                setActiveKpiModal('open');
              }}
              className="indicator-card financial-container w-full text-left relative overflow-hidden bg-white/95 backdrop-blur-md p-3.5 rounded-2xl border-2 border-cyan-400/80 shadow-[0_0_16px_rgba(6,182,212,0.22)] ring-1 ring-cyan-400/30 flex flex-col justify-between text-slate-850 select-none hover:border-cyan-400 hover:ring-2 hover:ring-cyan-400/60 hover:shadow-[0_0_28px_rgba(6,182,212,0.5)] hover:scale-[1.015] active:scale-95 transition-all duration-300 cursor-pointer group"
              title={`Toque para ver o total em aberto de ${selectedPrimaryDebtor?.name || 'Devedor'}`}
            >
              {/* Animação de brilho suave e halo radial */}
              <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-cyan-400/30" />
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none bg-gradient-to-r from-transparent via-cyan-300/30 to-transparent skew-x-12" />

              <div className="relative z-10 flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[10px] font-black text-cyan-800 uppercase tracking-wider truncate group-hover:text-cyan-950 transition-colors">
                    TOTAL EM ABERTO
                  </span>
                  <span className="text-[8.5px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-cyan-100 text-cyan-800 border border-cyan-300 shadow-2xs flex items-center gap-1 shrink-0 group-hover:bg-cyan-200/90 transition-colors">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span>
                    Interativo
                  </span>
                </div>
                <div className="w-6 h-6 rounded-lg bg-cyan-50 text-cyan-700 flex items-center justify-center shrink-0 border border-cyan-200 group-hover:bg-cyan-500 group-hover:text-white group-hover:shadow-[0_0_12px_rgba(6,182,212,0.5)] transition-all shadow-2xs">
                  <span className="material-symbols-outlined text-[14px]">account_balance_wallet</span>
                </div>
              </div>
              <div className="relative z-10 my-1">
                <div className="text-base sm:text-lg font-black text-slate-900 font-mono tracking-tight leading-tight group-hover:text-cyan-950 transition-colors">
                  R$ {safeToFixed(totalOpenAmount)}
                </div>
                <span className="text-[10px] text-slate-500 font-medium truncate block">
                  {pendingCount} parcelas pendentes
                </span>
              </div>
              <div className="relative z-10 mt-1.5 pt-1.5 border-t border-cyan-100/80 flex items-center justify-between text-[9.5px] font-bold text-cyan-700 group-hover:text-cyan-900 transition-colors">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px] text-cyan-600 group-hover:scale-110 transition-transform">touch_app</span>
                  <span>Interativo • Ver detalhes</span>
                </span>
                <span className="material-symbols-outlined text-[12px] group-hover:translate-x-1 transition-transform text-cyan-500">chevron_right</span>
              </div>
            </button>

            {/* 2. Total Quitado */}
            <button
              type="button"
              onClick={() => {
                playAppSound('success');
                setActiveKpiModal('paid');
              }}
              className="indicator-card financial-container w-full text-left relative overflow-hidden bg-white/95 backdrop-blur-md p-3.5 rounded-2xl border-2 border-emerald-400/80 shadow-[0_0_16px_rgba(16,185,129,0.22)] ring-1 ring-emerald-400/30 flex flex-col justify-between text-slate-850 select-none hover:border-emerald-400 hover:ring-2 hover:ring-emerald-400/60 hover:shadow-[0_0_28px_rgba(16,185,129,0.5)] hover:scale-[1.015] active:scale-95 transition-all duration-300 cursor-pointer group"
              title={`Toque para ver o total quitado de ${selectedPrimaryDebtor?.name || 'Devedor'}`}
            >
              {/* Animação de brilho suave e halo radial */}
              <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-emerald-400/30" />
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none bg-gradient-to-r from-transparent via-emerald-300/30 to-transparent skew-x-12" />

              <div className="relative z-10 flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider truncate group-hover:text-emerald-950 transition-colors">
                    TOTAL QUITADO
                  </span>
                  <span className="text-[8.5px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs flex items-center gap-1 shrink-0 group-hover:bg-emerald-200/90 transition-colors">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Interativo
                  </span>
                </div>
                <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200 group-hover:bg-emerald-500 group-hover:text-white group-hover:shadow-[0_0_12px_rgba(16,185,129,0.5)] transition-all shadow-2xs">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                </div>
              </div>
              <div className="relative z-10 my-1">
                <div className="text-base sm:text-lg font-black text-emerald-700 font-mono tracking-tight leading-tight group-hover:text-emerald-800 transition-colors">
                  R$ {safeToFixed(totalPaidAmount)}
                </div>
                <span className="text-[10px] text-slate-500 font-medium truncate block">
                  {paidCount} liquidadas com sucesso
                </span>
              </div>
              <div className="relative z-10 mt-1.5 pt-1.5 border-t border-emerald-100/80 flex items-center justify-between text-[9.5px] font-bold text-emerald-700 group-hover:text-emerald-900 transition-colors">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px] text-emerald-600 group-hover:scale-110 transition-transform">touch_app</span>
                  <span>Interativo • Ver detalhes</span>
                </span>
                <span className="material-symbols-outlined text-[12px] group-hover:translate-x-1 transition-transform text-emerald-500">chevron_right</span>
              </div>
            </button>

            {/* 3. Total em Atraso */}
            <button
              type="button"
              onClick={() => {
                playAppSound('alert');
                setActiveKpiModal('overdue');
              }}
              className="indicator-card financial-container w-full text-left relative overflow-hidden bg-white/95 backdrop-blur-md p-3.5 rounded-2xl border-2 border-red-400/80 shadow-[0_0_16px_rgba(239,68,68,0.22)] ring-1 ring-red-400/30 flex flex-col justify-between text-slate-850 select-none hover:border-red-400 hover:ring-2 hover:ring-red-400/60 hover:shadow-[0_0_28px_rgba(239,68,68,0.5)] hover:scale-[1.015] active:scale-95 transition-all duration-300 cursor-pointer group"
              title={`Toque para ver o total em atraso de ${selectedPrimaryDebtor?.name || 'Devedor'}`}
            >
              {/* Animação de brilho suave e halo radial */}
              <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-red-400/30" />
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none bg-gradient-to-r from-transparent via-red-300/30 to-transparent skew-x-12" />

              <div className="relative z-10 flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[10px] font-black text-red-800 uppercase tracking-wider truncate group-hover:text-red-950 transition-colors">
                    TOTAL EM ATRASO
                  </span>
                  <span className="text-[8.5px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300 shadow-2xs flex items-center gap-1 shrink-0 group-hover:bg-red-200/90 transition-colors">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                    Interativo
                  </span>
                </div>
                <div className="w-6 h-6 rounded-lg bg-red-50 text-red-700 flex items-center justify-center shrink-0 border border-red-200 group-hover:bg-red-500 group-hover:text-white group-hover:shadow-[0_0_12px_rgba(239,68,68,0.5)] transition-all shadow-2xs">
                  <span className="material-symbols-outlined text-[14px]">warning</span>
                </div>
              </div>
              <div className="relative z-10 my-1">
                <div className="text-base sm:text-lg font-black text-red-700 font-mono tracking-tight leading-tight group-hover:text-red-800 transition-colors">
                  R$ {safeToFixed(overdueTotal)}
                </div>
                <span className="text-[10px] text-slate-500 font-medium truncate block">
                  {overdueInstallments.length} vencida(s) no período
                </span>
              </div>
              <div className="relative z-10 mt-1.5 pt-1.5 border-t border-red-100/80 flex items-center justify-between text-[9.5px] font-bold text-red-700 group-hover:text-red-900 transition-colors">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px] text-red-600 group-hover:scale-110 transition-transform">touch_app</span>
                  <span>Interativo • Ver detalhes</span>
                </span>
                <span className="material-symbols-outlined text-[12px] group-hover:translate-x-1 transition-transform text-red-500">chevron_right</span>
              </div>
            </button>

            {/* 4. Mês Atual */}
            <button
              type="button"
              onClick={() => {
                playAppSound('cheerful');
                setActiveKpiModal('month');
              }}
              className="indicator-card financial-container w-full text-left relative overflow-hidden bg-white/95 backdrop-blur-md p-3.5 rounded-2xl border-2 border-amber-400/80 shadow-[0_0_16px_rgba(245,158,11,0.22)] ring-1 ring-amber-400/30 flex flex-col justify-between text-slate-850 select-none hover:border-amber-400 hover:ring-2 hover:ring-amber-400/60 hover:shadow-[0_0_28px_rgba(245,158,11,0.5)] hover:scale-[1.015] active:scale-95 transition-all duration-300 cursor-pointer group"
              title={`Toque para ver as faturas do mês atual de ${selectedPrimaryDebtor?.name || 'Devedor'}`}
            >
              {/* Animação de brilho suave e halo radial */}
              <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-amber-400/30" />
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none bg-gradient-to-r from-transparent via-amber-300/30 to-transparent skew-x-12" />

              <div className="relative z-10 flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider truncate group-hover:text-amber-950 transition-colors">
                    MÊS ATUAL ({currentMonthAbbr})
                  </span>
                  <span className="text-[8.5px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs flex items-center gap-1 shrink-0 group-hover:bg-amber-200/90 transition-colors">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                    Interativo
                  </span>
                </div>
                <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200 group-hover:bg-amber-500 group-hover:text-white group-hover:shadow-[0_0_12px_rgba(245,158,11,0.5)] transition-all shadow-2xs">
                  <span className="material-symbols-outlined text-[14px]">calendar_month</span>
                </div>
              </div>
              <div className="relative z-10 my-1">
                <div className="text-base sm:text-lg font-black text-amber-700 font-mono tracking-tight leading-tight group-hover:text-amber-800 transition-colors">
                  R$ {safeToFixed(soonTotal)}
                </div>
                <span className="text-[10px] text-slate-500 font-medium truncate block">
                  {soonInstallments.length} faturas do mês
                </span>
              </div>
              <div className="relative z-10 mt-1.5 pt-1.5 border-t border-amber-100/80 flex items-center justify-between text-[9.5px] font-bold text-amber-700 group-hover:text-amber-900 transition-colors">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px] text-amber-600 group-hover:scale-110 transition-transform">touch_app</span>
                  <span>Interativo • Ver detalhes</span>
                </span>
                <span className="material-symbols-outlined text-[12px] group-hover:translate-x-1 transition-transform text-amber-500">chevron_right</span>
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
        />

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
      </div>
    </>
  );
};
