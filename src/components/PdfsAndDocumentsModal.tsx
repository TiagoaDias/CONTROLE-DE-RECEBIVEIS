import React, { useState, useMemo } from 'react';
import { Debtor, Purchase, Installment, UserAccount } from '../types';
import { SafeDebtorAvatar } from './DebtorsMasterSpreadsheet';
import { ExtratoTotalModal } from './ExtratoTotalModal';
import { DigitalContractModal } from './DigitalContractModal';
import { ProofModal } from './ProofModal';
import { safeToFixed, safeFormatCurrency } from '../utils/numberUtils';

interface PdfsAndDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  debtor: Debtor;
  purchases?: Purchase[];
  installments?: Installment[];
  onOpenExtratoTotal?: (purchaseId?: string, debtorId?: string) => void;
  onOpenContract?: (debtorId: string) => void;
  onShowProof?: (payer: string, amount: string, date: string, dest: string, auth: string, item: string) => void;
  onToast?: (msg: string) => void;
  currentUser?: UserAccount | null;
  userPixKey?: string;
  onSignContract?: (debtorId: string, signatureUrl: string, signDate: string) => void;
}

export const PdfsAndDocumentsModal: React.FC<PdfsAndDocumentsModalProps> = ({
  isOpen,
  onClose,
  debtor,
  purchases = [],
  installments = [],
  onToast,
  currentUser,
  userPixKey,
  onSignContract,
}) => {
  // Controle de janelas filhas (Navegação em pilha: Voltar sempre retorna à tela anterior)
  const [activeSubModal, setActiveSubModal] = useState<'none' | 'extrato' | 'contrato' | 'recibo'>('none');

  // Parcelas do devedor atual
  const debtorInstallments = useMemo(() => {
    return installments
      .filter((i) => i.debtorId === debtor.id)
      .sort((a, b) => (Number(a.installmentNumber) || 0) - (Number(b.installmentNumber) || 0));
  }, [installments, debtor.id]);

  const paidInstallments = useMemo(() => {
    return debtorInstallments.filter((i) => i.status === 'paid');
  }, [debtorInstallments]);

  // Compra principal associada
  const primaryPurchase = useMemo(() => {
    return purchases.find((p) => p.debtorId === debtor.id) || purchases[0];
  }, [purchases, debtor.id]);

  // Seletor de qual parcela abrir o recibo (padrão: última paga ou primeira)
  const [selectedReceiptInstallmentId, setSelectedReceiptInstallmentId] = useState<string>(() => {
    if (paidInstallments.length > 0) return paidInstallments[paidInstallments.length - 1].id;
    return debtorInstallments[0]?.id || '';
  });

  // Dados calculados para o Recibo
  const targetReceiptInstallment = useMemo(() => {
    if (selectedReceiptInstallmentId) {
      const found = debtorInstallments.find((i) => i.id === selectedReceiptInstallmentId);
      if (found) return found;
    }
    if (paidInstallments.length > 0) return paidInstallments[paidInstallments.length - 1];
    return debtorInstallments[0] || null;
  }, [debtorInstallments, paidInstallments, selectedReceiptInstallmentId]);

  const receiptData = useMemo(() => {
    if (targetReceiptInstallment) {
      const amountVal = targetReceiptInstallment.paidAmount || targetReceiptInstallment.amount || targetReceiptInstallment.originalAmount || 0;
      return {
        payer: debtor.name,
        amount: `R$ ${safeToFixed(amountVal)}`,
        date: targetReceiptInstallment.paidAt || targetReceiptInstallment.dueDate || new Date().toLocaleDateString('pt-BR'),
        dest: 'HASPAHO TI / Tiago Dias',
        auth: targetReceiptInstallment.authCode || `AUT-HASPAHO-${debtor.id.slice(-4).toUpperCase()}`,
        item: targetReceiptInstallment.product || primaryPurchase?.product || 'Parcela do Acordo',
        debtorId: debtor.id,
      };
    }
    return {
      payer: debtor.name,
      amount: `R$ ${safeToFixed(debtor.totalOwed > 0 ? debtor.totalOwed : 100)}`,
      date: new Date().toLocaleDateString('pt-BR'),
      dest: 'HASPAHO TI / Tiago Dias',
      auth: `AUT-HASPAHO-${debtor.id.slice(-4).toUpperCase()}`,
      item: primaryPurchase?.product || 'Termo de Quitação & Acordo',
      debtorId: debtor.id,
    };
  }, [debtor, targetReceiptInstallment, primaryPurchase]);

  if (!isOpen) return null;

  return (
    <>
      {/* 1. JANELA FILHA: EXTRATO FINANCEIRO */}
      {activeSubModal === 'extrato' && (
        <ExtratoTotalModal
          isOpen={true}
          onClose={() => setActiveSubModal('none')}
          debtor={debtor}
          purchase={primaryPurchase}
          installments={debtorInstallments}
          onToast={onToast}
          onOpenNovoRecibo={() => setActiveSubModal('recibo')}
        />
      )}

      {/* 2. JANELA FILHA: CONTRATO DIGITAL */}
      {activeSubModal === 'contrato' && (
        <DigitalContractModal
          isOpen={true}
          debtor={debtor}
          purchases={purchases.filter((p) => p.debtorId === debtor.id)}
          installments={debtorInstallments}
          onClose={() => setActiveSubModal('none')}
          onSignContract={onSignContract || (() => {})}
          onToast={onToast || (() => {})}
        />
      )}

      {/* 3. JANELA FILHA: RECIBO OFICIAL */}
      {activeSubModal === 'recibo' && (
        <ProofModal
          isOpen={true}
          onClose={() => setActiveSubModal('none')}
          data={receiptData}
          installments={debtorInstallments}
          onToast={onToast || (() => {})}
          currentUser={currentUser}
          debtors={[debtor]}
        />
      )}

      {/* JANELA PRINCIPAL: PDFs DE DOCUMENTOS (100% BRANCO COM LUZ) */}
      {activeSubModal === 'none' && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200"
          onClick={onClose}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-white border-2 border-cyan-400/60 ring-2 ring-cyan-400/40 rounded-3xl shadow-[0_0_50px_rgba(6,182,212,0.35)] overflow-hidden flex flex-col text-slate-850 animate-in zoom-in-95 duration-200 max-h-[92vh]"
          >
            {/* Cabeçalho Oficial com Botão Voltar Navegável */}
            <div className="bg-white p-4 border-b border-slate-200 flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200 shrink-0"
                  title="Voltar para o Encarte / Tela Anterior"
                >
                  <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                  <span>Voltar</span>
                </button>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-black text-sm sm:text-base text-slate-900 truncate">
                      PDFs de Documentos • {debtor.name}
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">
                    Selecione o documento que deseja abrir e fazer o download
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-all cursor-pointer border border-slate-200 shrink-0"
                title="Fechar Janela"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Identificação do Devedor */}
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <SafeDebtorAvatar
                  name={debtor.name}
                  avatar={debtor.avatar}
                  size="sm"
                  status={debtor.overdueCount && debtor.overdueCount > 0 ? 'late' : 'ok'}
                  className="ring-2 ring-cyan-400/40"
                />
                <div>
                  <span className="font-bold text-xs sm:text-sm text-slate-900 block leading-tight">
                    {debtor.name}
                  </span>
                  <span className="text-[10.5px] text-slate-500 font-mono">
                    {debtor.cpfCnpj ? `Doc: ${debtor.cpfCnpj} • ` : ''}{debtor.relation || 'Cliente'} • {debtorInstallments.length} parcelas
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Saldo Restante</span>
                <span className="text-sm font-black font-mono text-cyan-700">
                  R$ {safeFormatCurrency(debtor.totalOwed)}
                </span>
              </div>
            </div>

            {/* Corpo: As 3 Opções Solicitadas (Extrato, Contrato, Recibo) */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1 scrollbar-thin bg-slate-50/50">
              {/* 1. Opção: ABRIR EXTRATO */}
              <div className="bg-white hover:bg-slate-50 border-2 border-amber-300/80 hover:border-amber-400 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 transition-all shadow-xs group">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0 shadow-2xs group-hover:bg-amber-100 transition-colors">
                    <span className="material-symbols-outlined text-[22px]">receipt_long</span>
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-black text-sm text-slate-900 leading-tight flex items-center gap-1.5">
                      <span>Extrato Total do Parcelamento</span>
                      <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300">
                        PDF
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      Histórico completo com somatório de parcelas, datas, valores e opção de download em PDF e impressão direta.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveSubModal('extrato')}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer shrink-0"
                  title="Abrir Extrato e Fazer Download"
                >
                  <span className="material-symbols-outlined text-[17px]">visibility</span>
                  <span>Abrir Extrato</span>
                </button>
              </div>

              {/* 2. Opção: ABRIR CONTRATO */}
              <div className="bg-white hover:bg-slate-50 border-2 border-indigo-200 hover:border-indigo-400 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 transition-all shadow-xs group">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center shrink-0 shadow-2xs group-hover:bg-indigo-100 transition-colors">
                    <span className="material-symbols-outlined text-[22px]">history_edu</span>
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-black text-sm text-slate-900 leading-tight flex items-center gap-1.5">
                      <span>Contrato Digital & Restituição</span>
                      <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-900 border border-indigo-300">
                        PDF
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      Termo formal de compromisso e restituição com assinaturas digitais, hash de integridade e download em PDF oficial A4.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveSubModal('contrato')}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer shrink-0"
                  title="Abrir Contrato e Fazer Download"
                >
                  <span className="material-symbols-outlined text-[17px]">description</span>
                  <span>Abrir Contrato</span>
                </button>
              </div>

              {/* 3. Opção: ABRIR RECIBO */}
              <div className="bg-white hover:bg-slate-50 border-2 border-emerald-200 hover:border-emerald-400 p-4 rounded-2xl flex flex-col justify-between gap-3.5 transition-all shadow-xs group">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0 shadow-2xs group-hover:bg-emerald-100 transition-colors">
                      <span className="material-symbols-outlined text-[22px]">verified</span>
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-black text-sm text-slate-900 leading-tight flex items-center gap-1.5">
                        <span>Recibo Oficial de Pagamento</span>
                        <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
                          PDF
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                        Recibo oficial com valor por extenso, autenticação digital, QR Code Pix e download individual em PDF.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveSubModal('recibo')}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer shrink-0"
                    title="Abrir Recibo e Fazer Download"
                  >
                    <span className="material-symbols-outlined text-[17px]">download_done</span>
                    <span>Abrir Recibo</span>
                  </button>
                </div>

                {/* Seletor rápido de parcela quando houver mais de uma */}
                {debtorInstallments.length > 1 && (
                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap text-xs">
                    <label className="text-[10.5px] text-emerald-800 font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">tune</span>
                      <span>Selecione a parcela p/ o recibo:</span>
                    </label>
                    <select
                      value={selectedReceiptInstallmentId}
                      onChange={(e) => setSelectedReceiptInstallmentId(e.target.value)}
                      className="h-8 px-2.5 rounded-lg bg-white border border-emerald-300 text-emerald-900 text-xs font-mono font-bold focus:outline-none focus:border-emerald-500 cursor-pointer shadow-2xs"
                    >
                      {debtorInstallments.map((inst) => (
                        <option key={inst.id} value={inst.id} className="bg-white text-slate-900">
                          #{String(inst.installmentNumber).padStart(2, '0')}/{String(inst.totalInstallments).padStart(2, '0')} • R$ {safeFormatCurrency(inst.amount || inst.originalAmount)} {inst.status === 'paid' ? '✓ Paga' : '(Pendente)'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Rodapé Seguro com Botão Voltar */}
            <div className="p-3.5 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span className="hidden sm:inline text-[11px] text-slate-500">
                Ao abrir qualquer documento, você poderá fazer o download em PDF e imprimir.
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200"
                >
                  <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                  <span>Voltar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
