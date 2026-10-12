import React, { useState, useMemo } from 'react';
import { Debtor, Purchase, Installment } from '../types';

interface ArpDocumentPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  debtors: Debtor[];
  installments: Installment[];
  purchases: Purchase[];
  initialDebtorId?: string;
  onToast: (msg: string) => void;
}

export const ArpDocumentPrintModal: React.FC<ArpDocumentPrintModalProps> = ({
  isOpen,
  onClose,
  debtors,
  installments,
  purchases,
  initialDebtorId,
  onToast,
}) => {
  const [selectedDebtorId, setSelectedDebtorId] = useState<string>(
    initialDebtorId || (debtors[0]?.id ?? '')
  );
  const [documentType, setDocumentType] = useState<'carne' | 'ficha' | 'promissoria' | 'extrato'>('carne');

  // Active Debtor
  const debtor = useMemo(() => {
    return debtors.find((d) => d.id === selectedDebtorId) || debtors[0];
  }, [debtors, selectedDebtorId]);

  // Active Debtor Installments
  const debtorInstallments = useMemo(() => {
    if (!debtor) return [];
    return installments
      .filter((i) => i.debtorId === debtor.id)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [installments, debtor]);

  // Active Debtor Purchases
  const debtorPurchases = useMemo(() => {
    if (!debtor) return [];
    return purchases.filter((p) => p.debtorId === debtor.id);
  }, [purchases, debtor]);

  if (!isOpen || !debtor) return null;

  const totalOwed = Number(debtor.totalOwed) || 0;
  const totalPaid = Number(debtor.totalPaid) || 0;

  // Format Helper
  const formatCurrency = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '15/10/2026';
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  const handleTriggerPrint = () => {
    onToast(`🖨️ Enviando ${documentType.toUpperCase()} de "${debtor.name}" para a impressora...`);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  return (
    <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto font-sans animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-900 dark:text-slate-100">
        
        {/* Header do Modal */}
        <div className="px-4 py-3 bg-gradient-to-r from-blue-900 via-slate-900 to-blue-950 text-white flex items-center justify-between shrink-0 select-none border-b border-blue-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
              <span className="material-symbols-outlined text-[22px]">print</span>
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold leading-tight tracking-wide flex items-center gap-1.5">
                <span>Impressão de Documentos Oficiais ARP</span>
                <span className="px-1.5 py-0.2 bg-blue-500/30 text-blue-200 border border-blue-400/40 rounded text-[9px] font-mono">
                  SISTEMA ARP
                </span>
              </h3>
              <p className="text-[11px] text-blue-200">
                Selecione o tipo de documento, visualize em tempo real e imprima o documento do cliente.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white flex items-center justify-center font-bold text-sm transition-colors cursor-pointer"
            title="Fechar (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Barra de Controles: Seleção do Cliente e Seleção do Tipo de Documento */}
        <div className="p-3 sm:p-4 bg-slate-100 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          {/* Seletor de Devedor */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase shrink-0 font-mono">
              Cliente ARP:
            </span>
            <select
              value={selectedDebtorId}
              onChange={(e) => setSelectedDebtorId(e.target.value)}
              className="flex-1 h-9 px-2.5 bg-white dark:bg-slate-900 border-2 border-blue-400 dark:border-blue-500 rounded-xl text-xs font-extrabold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs truncate cursor-pointer"
            >
              {debtors.map((d, idx) => (
                <option key={d.id} value={d.id}>
                  #{String(idx + 1).padStart(2, '0')} - {d.name} ({formatCurrency(Number(d.totalOwed) || 0)} dev.)
                </option>
              ))}
            </select>
          </div>

          {/* Seleção de Tipos de Documentos ARP */}
          <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-900 p-1 rounded-xl shrink-0 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setDocumentType('carne')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
                documentType === 'carne'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">style</span>
              <span>1. Carnê de Parcelas</span>
            </button>

            <button
              type="button"
              onClick={() => setDocumentType('ficha')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
                documentType === 'ficha'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">badge</span>
              <span>2. Ficha Cadastral</span>
            </button>

            <button
              type="button"
              onClick={() => setDocumentType('promissoria')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
                documentType === 'promissoria'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">description</span>
              <span>3. Nota Promissória</span>
            </button>

            <button
              type="button"
              onClick={() => setDocumentType('extrato')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
                documentType === 'extrato'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">receipt_long</span>
              <span>4. Extrato Contábil</span>
            </button>
          </div>
        </div>

        {/* Área Visual de Pré-visualização do Documento Impresso */}
        <div className="flex-1 p-3 sm:p-6 overflow-y-auto bg-slate-200 dark:bg-slate-950 flex justify-center">
          <div
            id="arp-printable-document"
            className="w-full max-w-2xl bg-white text-slate-900 p-5 sm:p-8 rounded-xl shadow-lg border border-slate-300 font-mono text-xs relative select-text"
          >
            {/* Cabeçalho Oficial do Documento ARP */}
            <div className="border-b-2 border-slate-900 pb-3 mb-4 flex items-center justify-between">
              <div>
                <div className="text-base sm:text-lg font-black tracking-tight text-slate-900 uppercase">
                  HASPAHO SISTEMAS ARP • RECEBÍVEIS & COBRANÇA
                </div>
                <div className="text-[10px] text-slate-600">
                  Documento Emitido Via Módulo de Impressão ERP/ARP | Data de Emissão: {new Date().toLocaleDateString('pt-BR')}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold text-blue-900 uppercase">
                  CÓDIGO CLIENTE: #{debtor.id.slice(-6).toUpperCase()}
                </div>
                <div className="text-[9px] text-slate-500 font-bold">
                  SITUAÇÃO: {totalOwed > 0 ? 'DÍVIDA EM ABERTO' : 'LIQUIDADO'}
                </div>
              </div>
            </div>

            {/* DOCUMENTO 1: CARNÊ DE PAGAMENTO COM CUPONS */}
            {documentType === 'carne' && (
              <div className="space-y-4">
                <div className="bg-slate-100 p-2.5 border border-slate-300 rounded text-center font-bold text-sm uppercase tracking-wider text-slate-900">
                  🏷️ CARNÊ DE RECEBÍVEIS / CUPONS DE PARCELAS ARP
                </div>

                <div className="p-2.5 border border-slate-300 rounded bg-slate-50 text-[10.5px] space-y-1">
                  <div><strong>NOME DO DEVEDOR:</strong> {debtor.name}</div>
                  <div><strong>DOCUMENTO / CPF:</strong> {debtor.documentNumber || debtor.cpfCnpj || '000.000.000-00'}</div>
                  <div><strong>TELEFONE:</strong> {debtor.phone || 'Sem telefone'}</div>
                  <div><strong>TOTAL DA DÍVIDA:</strong> {formatCurrency(totalOwed)}</div>
                </div>

                <div className="text-[10px] font-bold text-slate-500 text-center uppercase tracking-widest my-2">
                  ─── CUPONS PARA DESTACAR E PAGAR ───
                </div>

                {debtorInstallments.length > 0 ? (
                  <div className="space-y-3">
                    {debtorInstallments.map((inst, i) => (
                      <div
                        key={inst.id}
                        className="border-2 border-dashed border-slate-400 p-3 rounded-lg bg-amber-50/40 relative font-mono"
                      >
                        <div className="absolute -top-2.5 right-3 bg-white px-2 py-0.5 border border-slate-300 text-[8px] font-bold text-slate-500 rounded">
                          ✂️ CORTE AQUI
                        </div>

                        <div className="flex justify-between items-center border-b border-slate-300 pb-1 mb-2">
                          <span className="font-extrabold text-blue-900 text-xs">
                            CUPOM Nº {inst.installmentNumber}/{inst.totalInstallments}
                          </span>
                          <span className="font-black text-red-700 text-xs">
                            VALOR: {formatCurrency(inst.amount)}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div>
                            <span className="text-slate-500">Vencimento:</span>{' '}
                            <strong>{formatDate(inst.dueDate)}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500">Status:</span>{' '}
                            <strong className={inst.status === 'paid' ? 'text-emerald-700' : 'text-red-600'}>
                              {inst.status === 'paid' ? 'LIQUIDADO' : 'EM ABERTO'}
                            </strong>
                          </div>
                          <div className="col-span-2 text-[9px] text-slate-600">
                            <strong>Instruções ao caixa:</strong> Receber até o vencimento. Após o vencimento cobrar multa de 2.0% e juros de 1.0% ao mês.
                          </div>
                        </div>

                        <div className="mt-2 pt-1 border-t border-slate-200 flex items-center justify-between text-[8px] text-slate-500">
                          <span>CANHOTO DE QUITAÇÃO ARP</span>
                          <span>AUTENTICAÇÃO MECÂNICA</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-100 rounded text-center italic text-slate-600">
                    Nenhuma parcela pendente individual encontrada. Valor total unificado: {formatCurrency(totalOwed)}.
                  </div>
                )}
              </div>
            )}

            {/* DOCUMENTO 2: FICHA CADASTRAL E CONTRATO */}
            {documentType === 'ficha' && (
              <div className="space-y-3 text-[10.5px]">
                <div className="bg-slate-100 p-2 border border-slate-300 rounded text-center font-bold text-sm uppercase text-slate-900">
                  📋 FICHA CADASTRAL DO DEVEDOR & TERMO DE CRÉDITO
                </div>

                <div className="grid grid-cols-2 gap-2 p-3 border border-slate-300 rounded bg-slate-50">
                  <div><strong>NOME COMPLETO:</strong> {debtor.name}</div>
                  <div><strong>CPF / CNPJ:</strong> {debtor.documentNumber || debtor.cpfCnpj || '000.000.000-00'}</div>
                  <div><strong>RELAÇÃO COMERCIAL:</strong> {debtor.relation || 'Cliente Comercial'}</div>
                  <div><strong>TELEFONE CONTATO:</strong> {debtor.phone || 'Sem contato'}</div>
                  <div><strong>CHAVE PIX:</strong> {debtor.pixKey || debtor.phone || 'Não cadastrado'}</div>
                  <div><strong>LIMITE DE CRÉDITO:</strong> {formatCurrency(debtor.creditLimit || 5000)}</div>
                  <div><strong>SCORE CRED IÁRIO:</strong> {debtor.score || 800}/1000</div>
                  <div><strong>CLASSIFICAÇÃO:</strong> {debtor.scoreTier ? debtor.scoreTier.toUpperCase() : 'BOM'}</div>
                </div>

                <div className="p-3 border border-slate-300 rounded bg-white">
                  <div className="font-bold text-slate-900 mb-1">RESUMO FINANCEIRO CONTÁBIL:</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-red-50 border border-red-200 rounded">
                      <div className="text-[9px] text-red-600 font-bold">SALDO DEVEDOR ATUAL:</div>
                      <div className="text-sm font-black text-red-700">{formatCurrency(totalOwed)}</div>
                    </div>
                    <div className="p-2 bg-emerald-50 border border-emerald-200 rounded">
                      <div className="text-[9px] text-emerald-600 font-bold">TOTAL JÁ LIQUIDADO:</div>
                      <div className="text-sm font-black text-emerald-700">{formatCurrency(totalPaid)}</div>
                    </div>
                  </div>
                </div>

                <div className="p-3 border border-slate-300 rounded text-[9.5px] leading-relaxed text-slate-700 bg-slate-50">
                  <strong>DECLARAÇÃO E RECONHECIMENTO DE DÍVIDA:</strong> Reconheço e declaro a exatidão dos dados acima informados e comprometo-me a efetuar o pagamento das parcelas vincendas nas datas pactuadas conforme os títulos emitidos no sistema ARP.
                </div>

                <div className="pt-8 grid grid-cols-2 gap-8 text-center text-[9px] uppercase font-bold text-slate-700">
                  <div className="border-t border-slate-800 pt-1">{debtor.name} (DEVEDOR)</div>
                  <div className="border-t border-slate-800 pt-1">HASPAHO SISTEMAS ARP (CREDOR)</div>
                </div>
              </div>
            )}

            {/* DOCUMENTO 3: NOTA PROMISSÓRIA */}
            {documentType === 'promissoria' && (
              <div className="space-y-4">
                <div className="border-4 border-double border-slate-800 p-4 rounded-xl bg-amber-50/30">
                  <div className="flex justify-between items-center border-b-2 border-slate-800 pb-2 mb-3">
                    <span className="font-black text-base text-slate-900 uppercase">
                      📜 NOTA PROMISSÓRIA
                    </span>
                    <span className="font-bold text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded border border-red-300">
                      VALOR: {formatCurrency(totalOwed > 0 ? totalOwed : 118.09)}
                    </span>
                  </div>

                  <div className="text-[11px] leading-relaxed space-y-2 text-justify">
                    <p>
                      No dia <strong>15 DE OUTUBRO DE 2026</strong> pagarei por esta <strong>ÚNICA VIA DE NOTA PROMISSÓRIA</strong> a <strong>HASPAHO SISTEMAS ARP & RECEBÍVEIS</strong> ou à sua ordem, a quantia de <strong>{formatCurrency(totalOwed > 0 ? totalOwed : 118.09)}</strong> em moeda corrente deste país.
                    </p>
                    <p>
                      Pagável em <strong>Mineiros do Tietê - SP</strong>.
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-300 grid grid-cols-2 gap-2 text-[10px]">
                    <div><strong>EMITENTE / DEVEDOR:</strong> {debtor.name}</div>
                    <div><strong>CPF / CNPJ:</strong> {debtor.documentNumber || debtor.cpfCnpj || '000.000.000-00'}</div>
                    <div><strong>ENDEREÇO:</strong> Rua do Comércio, Centro</div>
                    <div><strong>CIDADE/UF:</strong> Mineiros do Tietê - SP</div>
                  </div>

                  <div className="mt-8 pt-6 border-t-2 border-slate-800 text-center text-[10px] font-bold uppercase">
                    <div>__________________________________________________________</div>
                    <div>{debtor.name} (ASSINATURA DO EMITENTE)</div>
                  </div>
                </div>
              </div>
            )}

            {/* DOCUMENTO 4: EXTRATO CONTÁBIL */}
            {documentType === 'extrato' && (
              <div className="space-y-3">
                <div className="bg-slate-100 p-2 border border-slate-300 rounded text-center font-bold text-sm uppercase text-slate-900">
                  📄 EXTRATO CONTÁBIL ANALÍTICO DE PARCELAS ARP
                </div>

                <div className="text-[10px] space-y-0.5">
                  <div><strong>CLIENTE:</strong> {debtor.name}</div>
                  <div><strong>DATA DO EXTRATO:</strong> {new Date().toLocaleDateString('pt-BR')}</div>
                  <div><strong>TOTAL PAGO:</strong> <span className="text-emerald-700 font-bold">{formatCurrency(totalPaid)}</span></div>
                  <div><strong>SALDO DEVEDOR:</strong> <span className="text-red-700 font-bold">{formatCurrency(totalOwed)}</span></div>
                </div>

                <table className="w-full text-left border-collapse text-[9.5px] mt-2">
                  <thead>
                    <tr className="bg-slate-200 border-b border-slate-400 font-bold">
                      <th className="p-1">PARCELA</th>
                      <th className="p-1">VENCIMENTO</th>
                      <th className="p-1 text-right">VALOR</th>
                      <th className="p-1 text-center">SITUAÇÃO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {debtorInstallments.length > 0 ? (
                      debtorInstallments.map((i) => (
                        <tr key={i.id}>
                          <td className="p-1 font-bold">#{i.installmentNumber}/{i.totalInstallments}</td>
                          <td className="p-1">{formatDate(i.dueDate)}</td>
                          <td className="p-1 text-right font-bold">{formatCurrency(i.amount)}</td>
                          <td className={`p-1 text-center font-bold ${i.status === 'paid' ? 'text-emerald-700' : 'text-red-600'}`}>
                            {i.status === 'paid' ? 'LIQUIDADO' : 'EM ABERTO'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="p-2 text-center text-slate-500 italic">
                          Sem parcelas discriminadas. Saldo consolidado: {formatCurrency(totalOwed)}.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Rodapé Fixo do Impresso */}
            <div className="mt-6 pt-3 border-t border-slate-300 text-[8.5px] text-slate-500 flex justify-between items-center">
              <span>Haspaho ARP © 2026 - Documento Válido para Simulação Contábil</span>
              <span>Página 1 de 1</span>
            </div>
          </div>
        </div>

        {/* Rodapé de Ações do Modal */}
        <div className="p-3 sm:p-4 bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition-all cursor-pointer"
          >
            Cancelar / Sair
          </button>

          <button
            type="button"
            onClick={handleTriggerPrint}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-extrabold text-xs shadow-md active:scale-95 transition-all cursor-pointer flex items-center gap-2 uppercase tracking-wide"
          >
            <span className="material-symbols-outlined text-[18px]">print</span>
            <span>🖨️ Imprimir Documento ARP</span>
          </button>
        </div>

      </div>
    </div>
  );
};
