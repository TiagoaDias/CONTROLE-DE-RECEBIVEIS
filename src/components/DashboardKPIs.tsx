import React from 'react';
import { Installment } from '../types';
import { CardMeteor } from './CardMeteor';

interface DashboardKPIsProps {
  installments: Installment[];
  totalOpenAmount: number;
  totalPaidAmount: number;
  overdueTotal: number;
  overdueInstallments: Installment[];
  soonTotal: number;
  currentMonthCount: number;
  currentMonthName: string;
  onNavigate: (tab: any) => void;
  setActiveSection: (section: any) => void;
  selectedDebtorName?: string;
}

export const DashboardKPIs: React.FC<DashboardKPIsProps> = ({
  installments,
  totalOpenAmount,
  totalPaidAmount,
  overdueTotal,
  overdueInstallments,
  soonTotal,
  currentMonthCount,
  currentMonthName,
  onNavigate,
  setActiveSection,
  selectedDebtorName,
}) => {
  const debtorLabel = selectedDebtorName || 'Todos os Clientes';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
      {/* Total em Aberto */}
      <button
        type="button"
        onClick={() => setActiveSection('parcelas')}
        className="w-full text-left relative overflow-hidden bg-gradient-to-br from-[#0c1933]/90 via-[#102347]/85 to-[#091326]/90 backdrop-blur-xl p-3 rounded-2xl border border-cyan-500/40 shadow-md flex flex-col justify-between hover:border-cyan-400 hover:shadow-cyan-500/20 transition-all text-white cursor-pointer active:scale-95 group select-none"
        title={`Parcelas em aberto de ${debtorLabel}`}
      >
        <CardMeteor variant="cyan" showSparkles={false} />
        <div className="relative z-1 flex items-center justify-between">
          <span className="text-[10px] sm:text-xs font-bold text-cyan-300 uppercase tracking-wider transition-colors truncate">
            Total em Aberto
          </span>
          <div className="w-7 h-7 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center shrink-0 border border-cyan-400/30 group-hover:bg-cyan-500/30 transition-colors">
            <span className="material-symbols-outlined text-[16px]">account_balance_wallet</span>
          </div>
        </div>

        {/* Babadinho com o Nome da Pessoa */}
        <div className="relative z-1 mt-1 mb-0.5 flex items-center gap-1 bg-cyan-950/80 border border-cyan-400/40 px-2 py-0.5 rounded-lg text-[9.5px] font-bold text-cyan-200 max-w-full">
          <span className="material-symbols-outlined text-[12px] text-cyan-400 shrink-0">person</span>
          <span className="truncate">{debtorLabel}</span>
        </div>

        <div className="relative z-1 my-1">
          <div className="text-base sm:text-lg font-black text-white tracking-tight leading-tight font-mono">
            R$ {totalOpenAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-cyan-200/70 font-medium truncate block">
            {installments.filter((i) => i.status !== 'paid').length} parcelas pendentes
          </span>
        </div>
      </button>

      {/* Total Quitado */}
      <button
        type="button"
        onClick={() => setActiveSection('parcelas')}
        className="w-full text-left relative overflow-hidden bg-gradient-to-br from-[#09261d]/90 via-[#0d3327]/85 to-[#061c15]/90 backdrop-blur-xl p-3 rounded-2xl border border-emerald-500/40 shadow-md flex flex-col justify-between hover:border-emerald-400 hover:shadow-emerald-500/20 transition-all text-white cursor-pointer active:scale-95 group select-none"
        title={`Parcelas quitadas de ${debtorLabel}`}
      >
        <CardMeteor variant="cyan" showSparkles={false} />
        <div className="relative z-1 flex items-center justify-between">
          <span className="text-[10px] sm:text-xs font-bold text-emerald-300 uppercase tracking-wider truncate">
            Total Quitado
          </span>
          <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-400/30 group-hover:bg-emerald-500/30 transition-colors">
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
          </div>
        </div>

        {/* Babadinho com o Nome da Pessoa */}
        <div className="relative z-1 mt-1 mb-0.5 flex items-center gap-1 bg-emerald-950/80 border border-emerald-400/40 px-2 py-0.5 rounded-lg text-[9.5px] font-bold text-emerald-200 max-w-full">
          <span className="material-symbols-outlined text-[12px] text-emerald-400 shrink-0">person</span>
          <span className="truncate">{debtorLabel}</span>
        </div>

        <div className="relative z-1 my-1">
          <div className="text-base sm:text-lg font-black text-emerald-400 tracking-tight leading-tight font-mono">
            R$ {totalPaidAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-emerald-200/70 font-medium truncate block">
            {installments.filter((i) => i.status === 'paid').length} parcelas liquidadas
          </span>
        </div>
      </button>

      {/* Em Atraso */}
      <button
        type="button"
        onClick={() => onNavigate('detalhe-atraso')}
        className="w-full text-left relative overflow-hidden bg-gradient-to-br from-[#2a0e14]/90 via-[#36131c]/85 to-[#1f090e]/90 backdrop-blur-xl p-3 rounded-2xl border border-red-500/40 shadow-md flex flex-col justify-between hover:border-red-400 hover:shadow-red-500/20 transition-all text-white cursor-pointer active:scale-95 group select-none"
        title={`Parcelas em atraso de ${debtorLabel}`}
      >
        <CardMeteor variant="amber" showSparkles={false} />
        <div className="relative z-1 flex items-center justify-between">
          <span className="text-[10px] sm:text-xs font-bold text-red-300 uppercase tracking-wider truncate">
            Total em Atraso
          </span>
          <div className="w-7 h-7 rounded-xl bg-red-500/20 text-red-300 flex items-center justify-center shrink-0 border border-red-400/30 group-hover:bg-red-500/30 transition-colors">
            <span className="material-symbols-outlined text-[16px] animate-pulse">warning</span>
          </div>
        </div>

        {/* Babadinho com o Nome da Pessoa */}
        <div className="relative z-1 mt-1 mb-0.5 flex items-center gap-1 bg-red-950/80 border border-red-400/40 px-2 py-0.5 rounded-lg text-[9.5px] font-bold text-red-200 max-w-full">
          <span className="material-symbols-outlined text-[12px] text-red-400 shrink-0">person</span>
          <span className="truncate">{debtorLabel}</span>
        </div>

        <div className="relative z-1 my-1">
          <div className="text-base sm:text-lg font-black text-red-400 tracking-tight leading-tight font-mono">
            R$ {overdueTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-red-200/70 font-medium truncate block">
            {overdueInstallments.length} parcela(s) vencida(s)
          </span>
        </div>
      </button>

      {/* Mês Atual */}
      <button
        type="button"
        onClick={() => setActiveSection('parcelas')}
        className="w-full text-left relative overflow-hidden bg-gradient-to-br from-[#281a07]/90 via-[#36230a]/85 to-[#1c1204]/90 backdrop-blur-xl p-3 rounded-2xl border border-amber-500/40 shadow-md flex flex-col justify-between hover:border-amber-400 hover:shadow-amber-500/20 transition-all text-white cursor-pointer active:scale-95 group select-none"
        title={`Parcelas deste mês de ${debtorLabel}`}
      >
        <CardMeteor variant="amber" showSparkles={false} />
        <div className="relative z-1 flex items-center justify-between">
          <span className="text-[10px] sm:text-xs font-bold text-amber-300 uppercase tracking-wider truncate">
            Mês Atual ({currentMonthName.slice(0, 3)})
          </span>
          <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 border border-amber-400/30 group-hover:bg-amber-500/30 transition-colors">
            <span className="material-symbols-outlined text-[16px]">calendar_month</span>
          </div>
        </div>

        {/* Babadinho com o Nome da Pessoa */}
        <div className="relative z-1 mt-1 mb-0.5 flex items-center gap-1 bg-amber-950/80 border border-amber-400/40 px-2 py-0.5 rounded-lg text-[9.5px] font-bold text-amber-200 max-w-full">
          <span className="material-symbols-outlined text-[12px] text-amber-400 shrink-0">person</span>
          <span className="truncate">{debtorLabel}</span>
        </div>

        <div className="relative z-1 my-1">
          <div className="text-base sm:text-lg font-black text-amber-300 tracking-tight leading-tight font-mono">
            R$ {soonTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-amber-200/70 font-medium truncate block">
            {currentMonthCount} parcela(s) neste mês
          </span>
        </div>
      </button>
    </div>
  );
};
