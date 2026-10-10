import React, { useState } from 'react';
import { Installment, ScreenTab } from '../types';

interface DetalheAtrasoViewProps {
  installment: Installment | null;
  onNavigate: (tab: ScreenTab, targetId?: string) => void;
  onBack?: () => void;
  onNudgeWhatsApp: (name: string, amount: string, item: string, parcel: string) => void;
  onEditDebtor?: (debtorId: string) => void;
  onOpenContract?: (debtorId: string) => void;
  onOpenExtratoTotal?: (purchaseId?: string, debtorId?: string) => void;
  onToast: (msg: string) => void;
}

export const DetalheAtrasoView: React.FC<DetalheAtrasoViewProps> = ({
  installment,
  onNavigate,
  onBack,
  onNudgeWhatsApp,
  onEditDebtor,
  onOpenContract,
  onOpenExtratoTotal,
}) => {
  const [customDelayDays] = useState(installment?.delayDays || 9);

  const inst = installment || {
    id: 'inst-1',
    purchaseId: 'p1',
    debtorId: 'd1',
    debtorName: 'Fátima Santos',
    debtorAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80',
    product: 'Micro-ondas Electrolux',
    cardName: 'Nubank Croma',
    installmentNumber: 1,
    totalInstallments: 6,
    amount: 95.00,
    originalAmount: 95.00,
    penaltyFee: 0,
    interestFee: 0,
    cardFee: 0,
    dueDate: '15/08/2026',
    status: 'overdue' as const,
    delayDays: 9,
  };

  const [avatarError, setAvatarError] = useState(false);
  const initials = (inst.debtorName || 'FS')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  const totalCalculated = inst.originalAmount;

  return (
    <div className="flex flex-col max-w-2xl mx-auto w-full pb-16 sm:pb-8 gap-2.5 px-1 sm:px-0 select-none animate-in fade-in duration-200">
      
      {/* 1. Barra Superior Compacta */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack || (() => onNavigate('dashboard'))}
          className="h-8 sm:h-8.5 px-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Voltar</span>
        </button>

        <span className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full flex items-center gap-1 shadow-2xs">
          <span className="material-symbols-outlined text-[14px]">warning</span>
          <span>Registro de Parcela Vencida</span>
        </span>
      </div>

      {/* 2. Card Principal Unificado do Devedor e Status de Atraso */}
      <section className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-sm flex flex-col gap-3">
        {/* Linha do Perfil */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative shrink-0 flex items-center justify-center p-1 rounded-2xl border border-red-400/40 bg-[#091a36]/80 shadow-md">
              {!avatarError && inst.debtorAvatar ? (
                <img
                  src={inst.debtorAvatar}
                  alt={inst.debtorName}
                  onError={() => setAvatarError(true)}
                  referrerPolicy="no-referrer"
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-white shadow-2xs"
                />
              ) : (
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-red-600 to-rose-700 text-white font-black text-xs flex items-center justify-center border-2 border-white shadow-2xs">
                  {initials}
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full bg-red-600 text-white ring-2 ring-white flex items-center justify-center font-black text-[9px] shadow-md z-10">
                !
              </span>
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="font-extrabold text-slate-900 text-sm sm:text-base leading-tight truncate">
                  {inst.debtorName}
                </h2>
                <span className="px-1.5 py-0.2 rounded bg-red-100 text-red-700 text-[10px] font-bold">
                  {inst.delayDays || customDelayDays} dias de atraso
                </span>
                {onEditDebtor && (
                  <button
                    type="button"
                    onClick={() => onEditDebtor(inst.debtorId)}
                    className="w-5 h-5 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600 flex items-center justify-center transition-colors cursor-pointer"
                    title="Editar devedor"
                  >
                    <span className="material-symbols-outlined text-[13px]">edit</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs mt-0.5 flex-wrap">
                <span className="inline-flex items-center gap-1 font-semibold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.2 rounded text-[10.5px]">
                  <span className="material-symbols-outlined text-[12px]">calendar_today</span>
                  <span>Venceu em: <strong className="font-mono">{inst.dueDate}</strong></span>
                </span>
                <span className="text-slate-500 text-[11px] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px] text-emerald-600">call</span>
                  (14) 99712-0484 • Família
                </span>
              </div>
            </div>
          </div>

          {/* Botões de Ação Rápida no Topo */}
          <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
            {onOpenContract && (
              <button
                type="button"
                onClick={() => onOpenContract(inst.debtorId)}
                className="h-8 px-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer active:scale-95"
                title="Abrir Contrato Digital"
              >
                <span className="material-symbols-outlined text-[15px]">history_edu</span>
                <span>Contrato</span>
              </button>
            )}
            {onOpenExtratoTotal && (
              <button
                type="button"
                onClick={() => onOpenExtratoTotal(inst.purchaseId, inst.debtorId)}
                className="h-8 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs active:scale-95"
                title="Gerar Extrato Total"
              >
                <span className="material-symbols-outlined text-[15px]">description</span>
                <span>Extrato Total</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onNudgeWhatsApp(inst.debtorName, `R$ ${totalCalculated.toFixed(2)}`, inst.product, `${inst.installmentNumber}/${inst.totalInstallments}`)}
              className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 hover:bg-emerald-200 flex items-center justify-center transition-colors shadow-2xs cursor-pointer active:scale-95"
              title="Cobrar pelo WhatsApp"
            >
              <span className="material-symbols-outlined text-[16px]">chat</span>
            </button>
          </div>
        </div>

        {/* Bloco de Valor e Identificação da Parcela */}
        <div className="bg-gradient-to-br from-red-50/80 via-rose-50/50 to-red-50/80 border border-red-200/80 rounded-xl p-3 flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1 text-[10px] font-bold text-red-800 uppercase tracking-wide">
              <span className="material-symbols-outlined text-[14px]">warning</span>
              <span>VENCEU EM {inst.dueDate} • PARCELA {inst.installmentNumber} DE {inst.totalInstallments}</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-red-600 tracking-tight mt-0.5 font-mono">
              R$ {(Number(inst.originalAmount || inst.amount) || 0).toFixed(2).replace('.', ',')}
            </div>
          </div>

          <div className="text-right">
            <span className="inline-block text-[9.5px] px-2 py-0.5 rounded-md bg-white text-red-700 font-bold border border-red-200 shadow-2xs mb-1">
              Pendente de Pagamento
            </span>
            <div className="text-[10px] text-slate-500">Produto / Auxílio</div>
            <div className="text-xs font-bold text-slate-900 truncate max-w-[160px] sm:max-w-[220px]">
              {inst.product}
            </div>
          </div>
        </div>

        {/* Grade de Detalhes da Cobrança */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">Parcela</span>
            <span className="font-extrabold text-slate-900 mt-0.5 block">{inst.installmentNumber}ª de {inst.totalInstallments}</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">Vencimento</span>
            <span className="font-extrabold text-slate-900 mt-0.5 block font-mono">{inst.dueDate}</span>
          </div>
          <div className="p-2 rounded-xl bg-red-50/60 border border-red-200/80">
            <span className="text-[10px] text-red-700 font-bold uppercase block">Dias em Atraso</span>
            <span className="font-black text-red-600 mt-0.5 block">{inst.delayDays || customDelayDays} dias</span>
          </div>
          <div className="p-2 rounded-xl bg-amber-50/60 border border-amber-200/80">
            <span className="text-[10px] text-amber-800 font-bold uppercase block">Situação</span>
            <span className="font-bold text-amber-700 mt-0.5 block truncate">Aguardando Restituição</span>
          </div>
        </div>

        {/* Nota Legal Slim */}
        <div className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-[10.5px] flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px] text-slate-400 shrink-0">gavel</span>
          <span>Encargos de mora em conformidade com o Código Civil Brasileiro (arts. 389 e 395).</span>
        </div>

        {/* Botões de Ação Primários Integrados sem Fixação que cause Rolagem */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-100">
          <button
            type="button"
            onClick={() => onNudgeWhatsApp(inst.debtorName, `R$ ${totalCalculated.toFixed(2)}`, inst.product, `${inst.installmentNumber}/${inst.totalInstallments}`)}
            className="h-10 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[17px]">chat</span>
            <span>Cobrar WhatsApp</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('detalhe-parcela', inst.id)}
            className="h-10 px-3 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[17px]">done_all</span>
            <span>Dar Baixa Agora</span>
          </button>
        </div>
      </section>
    </div>
  );
};
