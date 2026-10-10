import React, { useState } from 'react';
import { Debtor } from '../types';

interface DeleteDebtorConfirmationModalProps {
  isOpen: boolean;
  debtor: Debtor | null;
  onClose: () => void;
  onConfirmDelete: (debtor: Debtor) => void;
}

export const DeleteDebtorConfirmationModal: React.FC<DeleteDebtorConfirmationModalProps> = ({
  isOpen,
  debtor,
  onClose,
  onConfirmDelete,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  if (!isOpen || !debtor) return null;

  const handleReset = () => {
    setStep(1);
    onClose();
  };

  const handleNextStep1 = () => setStep(2);
  const handleNextStep2 = () => setStep(3);

  const handleFinalConfirm = () => {
    onConfirmDelete(debtor);
    setStep(1);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="bg-[#0b162c] border-2 border-red-500/50 rounded-2xl sm:rounded-3xl p-4 sm:p-6 max-w-md w-full max-h-[85dvh] sm:max-h-[88vh] overflow-y-auto my-auto shadow-[0_0_50px_rgba(239,68,68,0.25)] text-white space-y-4 sm:space-y-5 relative scrollbar-thin">
        {/* Top Header Badge */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[22px]">delete_forever</span>
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">Excluir Devedor / Pessoa</h3>
              <p className="text-[11px] text-slate-400">
                {step === 1 && 'Confirmação Inicial (Etapa 1 de 3)'}
                {step === 2 && 'Confirmação de Segurança (Etapa 2 de 3)'}
                {step === 3 && 'Aviso Final & Lixeira (Etapa 3 de 3)'}
              </p>
            </div>
          </div>
          <button
            onClick={handleReset}
            type="button"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Target Debtor Card Preview */}
        <div className="bg-slate-900/80 rounded-2xl p-3.5 border border-white/10 flex items-center gap-3">
          <img
            src={debtor.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
            alt={debtor.name}
            className="w-11 h-11 rounded-full object-cover ring-2 ring-red-500/40 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <h4 className="font-extrabold text-white text-sm truncate">{debtor.name}</h4>
            <p className="text-xs text-slate-400 truncate">
              Vínculo: <strong className="text-slate-200">{debtor.relation || 'Cliente'}</strong> • Saldo: <strong className="text-amber-400 font-mono">R$ {debtor.totalOwed.toFixed(2)}</strong>
            </p>
          </div>
        </div>

        {/* STEP 1: PRIMEIRA PERGUNTA */}
        {step === 1 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-center">
              <span className="material-symbols-outlined text-4xl text-red-400 mb-2 block">warning</span>
              <p className="text-sm font-bold text-white">
                Deseja excluir este usuário, pessoa ou devedor do sistema?
              </p>
              <p className="text-xs text-slate-300 mt-1">
                Ao excluir, o devedor <strong className="text-red-300">{debtor.name}</strong> será movido para a lixeira temporária.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs transition-all cursor-pointer border border-slate-700"
              >
                Não, Cancelar
              </button>
              <button
                type="button"
                onClick={handleNextStep1}
                className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs transition-all shadow-lg hover:shadow-red-500/30 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Sim, Excluir</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: SEGUNDA PERGUNTA ("Tem certeza?") */}
        {step === 2 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-center">
              <span className="material-symbols-outlined text-4xl text-amber-400 mb-2 block">help_outline</span>
              <h4 className="text-lg font-black text-amber-300 uppercase tracking-wide">Tem certeza?</h4>
              <p className="text-xs text-slate-200 mt-1">
                Por favor, confirme se você realmente deseja mover <strong className="text-amber-200">{debtor.name}</strong> para a lixeira.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs transition-all cursor-pointer border border-slate-700"
              >
                Não, Voltar
              </button>
              <button
                type="button"
                onClick={handleNextStep2}
                className="flex-1 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-xs transition-all shadow-lg hover:shadow-amber-500/30 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Sim, Tenho Certeza</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: TERCEIRA ALERTA ("Não poderá ser mais desfeito") */}
        {step === 3 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-gradient-to-br from-red-950/80 to-red-900/60 border-2 border-red-500/60 rounded-2xl p-4 text-left space-y-2.5">
              <div className="flex items-center gap-2 text-red-400 font-black text-sm uppercase tracking-wide">
                <span className="material-symbols-outlined text-[22px]">gavel</span>
                <span>Não poderá ser mais desfeito!</span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed font-medium">
                Aviso: Para desfazer essa exclusão e recuperar este cadastrado, você deve entrar em <strong className="text-cyan-300 underline">Configurações</strong> e procurar a <strong className="text-cyan-300 underline">Lixeira</strong>.
              </p>
              <div className="bg-black/40 rounded-xl p-2.5 border border-red-400/30 text-[11px] text-amber-300 font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-amber-400 shrink-0">timer</span>
                <span>Automaticamente, a exclusão de um usuário ou devedor pode ser desfeita no máximo em 8 dias.</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs transition-all cursor-pointer border border-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleFinalConfirm}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs transition-all shadow-xl hover:shadow-red-500/40 cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                <span>Mover para Lixeira</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
