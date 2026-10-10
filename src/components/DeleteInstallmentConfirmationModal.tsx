import React, { useState } from 'react';
import { Installment } from '../types';

interface DeleteInstallmentConfirmationModalProps {
  isOpen: boolean;
  installment: Installment | null;
  onClose: () => void;
  onConfirmDelete: (installment: Installment) => void;
}

export const DeleteInstallmentConfirmationModal: React.FC<DeleteInstallmentConfirmationModalProps> = ({
  isOpen,
  installment,
  onClose,
  onConfirmDelete,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  if (!isOpen || !installment) return null;

  const handleReset = () => {
    setStep(1);
    onClose();
  };

  const handleNextStep1 = () => setStep(2);
  const handleNextStep2 = () => setStep(3);

  const handleFinalConfirm = () => {
    onConfirmDelete(installment);
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
              <h3 className="font-extrabold text-base text-white">Excluir Parcela</h3>
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

        {/* Target Installment Preview */}
        <div className="bg-slate-900/80 rounded-2xl p-3.5 border border-white/10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined">payments</span>
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-extrabold text-white text-sm truncate">{installment.product || 'Parcela'}</h4>
            <p className="text-xs text-slate-400 truncate">
              Vencimento: <strong className="text-slate-200">{installment.dueDate}</strong> • Valor: <strong className="text-amber-400 font-mono">R$ {(Number(installment.amount) || 0).toFixed(2)}</strong>
            </p>
          </div>
        </div>

        {/* STEP 1: PRIMEIRA PERGUNTA */}
        {step === 1 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-center">
              <span className="material-symbols-outlined text-4xl text-red-400 mb-2 block">warning</span>
              <p className="text-sm font-bold text-white">
                Deseja excluir permanentemente esta parcela?
              </p>
              <p className="text-xs text-slate-300 mt-1">
                Esta ação removerá a parcela do devedor e não poderá ser desfeita.
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
                className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-all cursor-pointer shadow-lg"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: SEGUNDA PERGUNTA */}
        {step === 2 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-center">
              <span className="material-symbols-outlined text-4xl text-amber-400 mb-2 block">security</span>
              <p className="text-sm font-bold text-white">
                Confirmação de Segurança
              </p>
              <p className="text-xs text-slate-300 mt-1">
                Você tem certeza absoluta? Dados financeiros serão permanentemente apagados.
              </p>
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
                onClick={handleNextStep2}
                className="flex-1 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition-all cursor-pointer shadow-lg"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: TERCEIRA PERGUNTA */}
        {step === 3 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 text-center">
              <span className="material-symbols-outlined text-4xl text-rose-400 mb-2 block">delete_sweep</span>
              <p className="text-sm font-bold text-white">
                Aviso Final
              </p>
              <p className="text-xs text-slate-300 mt-1">
                Esta ação é irreversível. Deseja prosseguir com a exclusão definitiva?
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
                onClick={handleFinalConfirm}
                className="flex-1 py-3 px-4 rounded-xl bg-red-700 hover:bg-red-600 text-white font-bold text-xs transition-all cursor-pointer shadow-lg"
              >
                Excluir Definitivamente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
