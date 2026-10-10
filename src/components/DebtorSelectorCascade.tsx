import React, { useState, useMemo, useEffect } from 'react';
import { Debtor, Installment } from '../types';
import { SafeDebtorAvatar } from './DebtorsMasterSpreadsheet';
import { HaspahoLogo } from './HaspahoLogo';

interface DebtorSelectorCascadeProps {
  debtors: Debtor[];
  installments: Installment[];
  activeDebtorId: string | null;
  onSelectDebtor: (debtorId: string | null) => void;
  onOpenNewDebtor?: () => void;
  onEditDebtor?: (debtor: Debtor) => void;
  defaultViewMode?: 'list' | 'columns';
}

export const DebtorSelectorCascade: React.FC<DebtorSelectorCascadeProps> = ({
  debtors,
  installments,
  activeDebtorId,
  onSelectDebtor,
  onOpenNewDebtor,
  onEditDebtor,
  defaultViewMode = 'list',
}) => {
  // Modal de Janela com Nomes
  const [isWindowOpen, setIsWindowOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'adimplente' | 'inadimplente' | 'quitado'>('all');
  const [windowViewMode, setWindowViewMode] = useState<'list' | 'columns'>('list');

  // Devedor atualmente selecionado
  const selectedDebtor = useMemo(() => {
    if (!activeDebtorId) return null;
    return debtors.find((d) => d.id === activeDebtorId) || null;
  }, [debtors, activeDebtorId]);

  // Total geral em aberto
  const totalOpenGeneral = useMemo(() => {
    return installments
      .filter((i) => i.status !== 'paid')
      .reduce((acc, curr) => acc + (curr.amount || curr.originalAmount || 0), 0);
  }, [installments]);

  // Lista filtrada por status para a Janela / Lista
  const filteredDebtors = useMemo(() => {
    return debtors.filter((d) => {
      const hasOverdue = (d.overdueCount || 0) > 0;
      const isPaidOff = d.totalOwed <= 0;

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'adimplente' && !hasOverdue && !isPaidOff) ||
        (statusFilter === 'inadimplente' && hasOverdue) ||
        (statusFilter === 'quitado' && isPaidOff);

      return matchesStatus;
    });
  }, [debtors, statusFilter]);

  // Fechar janela com tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsWindowOpen(false);
      }
    };
    if (isWindowOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isWindowOpen]);

  const handleSelectAndClose = (debtorId: string | null) => {
    onSelectDebtor(debtorId);
    setIsWindowOpen(false);
  };

  return (
    <div className="w-full space-y-3 relative z-20">
      {/* ========================================================================= */}
      {/* 1. CAMPO SELETOR (ESTILO PAÍS/REGIÃO: CLICA E ABRE JANELA COM NOMES)     */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-[#0b1933]/95 via-[#0e244d]/90 to-[#09152b]/95 border-2 border-cyan-500/40 hover:border-cyan-400 rounded-3xl p-3 sm:p-4 shadow-xl backdrop-blur-xl transition-all">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Campo Interativo Tipo Dropdown / Seletor de Região */}
          <button
            type="button"
            onClick={() => {
              setIsWindowOpen(true);
            }}
            className="flex-1 text-left flex items-center gap-3 sm:gap-4 p-2 sm:p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-400/50 transition-all cursor-pointer group active:scale-[0.99] select-none"
            title="Clique para abrir a lista com os nomes de todas as pessoas"
          >
            {/* Ícone ou Foto Oficial da pessoa selecionada (moldura quadrada ciano + foto circular) */}
            <div className="relative shrink-0 flex items-center justify-center">
              {selectedDebtor ? (
                <>
                  <div className="absolute -inset-1 rounded-2xl bg-cyan-400/40 blur-[4px]" />
                  <SafeDebtorAvatar
                    name={selectedDebtor.name}
                    avatar={selectedDebtor.avatar}
                    size="md"
                    status={(selectedDebtor.overdueCount || 0) > 0 ? 'late' : 'ok'}
                    className="relative z-10 shadow-md"
                  />
                </>
              ) : (
                <div className="w-13 h-13 rounded-2xl bg-[#091a36]/80 border border-cyan-400/50 p-1 flex items-center justify-center shadow-md">
                  <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-600 via-indigo-700 to-cyan-700 flex items-center justify-center text-white border-2 border-white/80 shadow-xs">
                    <span className="material-symbols-outlined text-[20px]">person</span>
                  </div>
                </div>
              )}
            </div>

            {/* Texto do Campo (Pergunta/Rótulo + Pessoa Atual) */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-cyan-300">
                <span className="material-symbols-outlined text-[14px]">person_search</span>
                <span>Seletor de Pessoa / Devedor</span>
                <span className="text-white/40">•</span>
                <span className="text-slate-300 font-medium lowercase">toque para abrir lista</span>
              </div>

              <div className="flex items-center gap-2 mt-0.5">
                <h3 className="text-sm sm:text-base font-black text-white truncate leading-tight group-hover:text-cyan-200 transition-colors">
                  {selectedDebtor ? selectedDebtor.name : (debtors[0]?.name || 'Pessoa')}
                </h3>
                {selectedDebtor && (
                  <span className="w-4 h-4 rounded-full bg-[#1d9bf0] text-white flex items-center justify-center text-[9px] font-black shrink-0" title="Verificado Oficial">
                    ✓
                  </span>
                )}
              </div>

              <div className="text-[11px] text-slate-300 flex items-center gap-2 truncate mt-0.5 font-medium">
                {selectedDebtor ? (
                  <>
                    <span className="text-cyan-300 font-bold">{selectedDebtor.relation || 'Cliente'}</span>
                    <span className="text-white/30">•</span>
                    <span className="font-mono text-amber-300 font-bold">
                      Aberto: R$ {selectedDebtor.totalOwed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    {(selectedDebtor.overdueCount || 0) > 0 ? (
                      <span className="text-red-300 font-bold">({selectedDebtor.overdueCount} atrasada(s))</span>
                    ) : (
                      <span className="text-emerald-300 font-bold">(Em dia)</span>
                    )}
                  </>
                ) : (
                  <span>
                    Consolidado de <strong className="text-cyan-300">{debtors.length} pessoas</strong> • Total: <strong className="font-mono text-amber-300">R$ {totalOpenGeneral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Botão Indicador Visual de Dropdown / Abrir Janela */}
            <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/20 group-hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 text-xs font-bold transition-all shadow-xs">
              <span className="hidden sm:inline">Ver Nomes</span>
              <span className="material-symbols-outlined text-[18px] group-hover:translate-y-0.5 transition-transform">
                keyboard_arrow_down
              </span>
            </div>
          </button>

          {/* Botão Novo Devedor */}
          {onOpenNewDebtor && (
            <button
              type="button"
              onClick={onOpenNewDebtor}
              className="h-8.5 px-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-1 shadow-md transition-all active:scale-95 cursor-pointer shrink-0"
              title="Cadastrar Nova Pessoa / Devedor"
            >
              <span className="material-symbols-outlined text-[16px]">person_add</span>
              <span className="hidden sm:inline">Nova Pessoa</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. JANELA MODAL COM NOMES (ABERTA QUANDO CLICADO NO CAMPO SELETOR)       */}
      {/* ========================================================================= */}
      {isWindowOpen && (
        <div className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div
            className="w-full max-w-2xl bg-gradient-to-b from-[#0d1e3d] via-[#10274f] to-[#0a162b] border-2 border-cyan-400/80 rounded-3xl shadow-[0_20px_50px_rgba(6,182,212,0.4)] flex flex-col max-h-[calc(100vh-100px)] sm:max-h-[calc(100vh-120px)] overflow-hidden text-white relative animate-in zoom-in-95 duration-200 my-auto shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Topo da Janela com z-index e padding seguro */}
            <div className="p-3.5 sm:p-4 border-b border-white/10 bg-[#09152b]/95 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 flex items-center justify-center shrink-0 shadow-xs">
                  <span className="material-symbols-outlined text-[20px] sm:text-[22px]">groups</span>
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-sm sm:text-base text-white leading-tight truncate">
                    Lista de Pessoas / Devedores ({debtors.length})
                  </h3>
                  <p className="text-[10.5px] sm:text-[11px] text-cyan-200/80 font-medium truncate mt-0.5">
                    Toque na pessoa para selecionar e abrir o card detalhado
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Alternador de Layout dentro da Janela */}
                <div className="flex items-center bg-white/10 border border-white/15 rounded-xl p-0.5">
                  <button
                    type="button"
                    onClick={() => setWindowViewMode('list')}
                    className={`h-7 px-2 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      windowViewMode === 'list'
                        ? 'bg-cyan-500 text-slate-950 shadow-xs'
                        : 'text-slate-300 hover:text-white'
                    }`}
                    title="Formato lista / planilha (um de baixo do outro)"
                  >
                    <span className="material-symbols-outlined text-[14px]">table_rows</span>
                    <span className="text-[10px] hidden sm:inline">Planilha</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWindowViewMode('columns')}
                    className={`h-7 px-2 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      windowViewMode === 'columns'
                        ? 'bg-cyan-500 text-slate-950 shadow-xs'
                        : 'text-slate-300 hover:text-white'
                    }`}
                    title="Formato de colunas sobrepostas"
                  >
                    <span className="material-symbols-outlined text-[14px]">view_column</span>
                    <span className="text-[10px] hidden sm:inline">Colunas</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsWindowOpen(false)}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-white/10"
                  title="Fechar Janela (ESC)"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>

            {/* Conteúdo Principal: A LISTA DE PESSOAS É EXIBIDA IMEDIATAMENTE EM DESTAQUE */}
            <div className="overflow-y-auto p-2.5 sm:p-4 space-y-2 flex-1 scrollbar-thin bg-black/10">
              {filteredDebtors.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Nenhuma pessoa encontrada com os filtros informados.
                </div>
              ) : windowViewMode === 'columns' ? (
                /* MODO COLUNAS SOBREPOSTAS DENTRO DA JANELA */
                <div className="py-2 overflow-x-auto scrollbar-thin">
                  <div className="flex items-stretch pb-3 pt-2 px-1">
                    {filteredDebtors.map((debtor, idx) => {
                      const isSelected = activeDebtorId === debtor.id;
                      const hasOverdue = (debtor.overdueCount || 0) > 0;
                      const isPaidOff = debtor.totalOwed <= 0;
                      const debtorInsts = installments.filter((i) => i.debtorId === debtor.id);
                      const paidInstsCount = debtorInsts.filter((i) => i.status === 'paid').length;

                      return (
                        <div
                          key={debtor.id}
                          onClick={() => handleSelectAndClose(debtor.id)}
                          style={{ zIndex: isSelected ? 35 : 25 - (idx % 20) }}
                          className={`w-38 sm:w-44 shrink-0 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between transition-all duration-300 cursor-pointer border select-none -ml-4 sm:-ml-5 relative group ${
                            isSelected
                              ? 'bg-gradient-to-b from-[#0f2c59]/95 via-[#133d7a]/90 to-[#0c1f3d]/95 border-cyan-400 text-white shadow-[0_12px_30px_rgba(6,182,212,0.45)] ring-2 ring-cyan-400 -translate-y-1.5 scale-[1.02]'
                              : 'bg-gradient-to-b from-[#0b1b36]/90 via-[#0e2447]/85 to-[#081326]/90 hover:from-[#112d59]/90 hover:to-[#0d1e38]/90 border-slate-700/80 hover:border-cyan-400/80 text-white shadow-lg hover:-translate-y-1 hover:shadow-xl hover:scale-[1.01]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1.5">
                            <div className="relative shrink-0 flex items-center justify-center">
                              <SafeDebtorAvatar
                                name={debtor.name}
                                avatar={debtor.avatar}
                                size="sm"
                                status={hasOverdue ? 'late' : 'ok'}
                                className="relative z-10 shrink-0"
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="w-4 h-4 rounded-full bg-[#1d9bf0] text-white flex items-center justify-center text-[9px] font-black shrink-0 shadow-xs ring-1 ring-white/20">
                                ✓
                              </span>
                              {hasOverdue ? (
                                <span className="text-[8.5px] font-black px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
                                  {debtor.overdueCount} atr.
                                </span>
                              ) : isPaidOff ? (
                                <span className="text-[8.5px] font-black px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                  Quitado
                                </span>
                              ) : (
                                <span className="text-[8.5px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  Em dia
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="my-1">
                            <h4 className="text-xs sm:text-sm font-black text-white leading-tight group-hover:text-cyan-200 transition-colors line-clamp-2" title={debtor.name}>
                              {debtor.name}
                            </h4>
                            <p className="text-[10px] text-blue-200/70 truncate mt-0.5">
                              {debtor.relation || 'Cliente'} • {paidInstsCount}/{debtorInsts.length} pagas
                            </p>
                          </div>

                          <div className="pt-1.5 border-t border-white/10 flex items-center justify-between text-[10.5px] font-mono mt-1">
                            <span className="text-[9px] text-slate-400 uppercase font-sans">Aberto:</span>
                            <span className={`font-black ${hasOverdue ? 'text-red-300' : 'text-cyan-300'}`}>
                              R$ {(Number(debtor.totalOwed) || 0).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* MODO LISTA / PLANILHA UM DE BAIXO DO OUTRO */
                filteredDebtors.map((debtor) => {
                  const isSelected = activeDebtorId === debtor.id;
                  const hasOverdue = (debtor.overdueCount || 0) > 0;
                  const isPaidOff = debtor.totalOwed <= 0;
                  const debtorInsts = installments.filter((i) => i.debtorId === debtor.id);
                  const paidInstsCount = debtorInsts.filter((i) => i.status === 'paid').length;

                  return (
                    <div
                      key={debtor.id}
                      onClick={() => handleSelectAndClose(debtor.id)}
                      className={`w-full p-2.5 sm:p-3 rounded-2xl border text-left flex items-center justify-between gap-2.5 transition-all cursor-pointer group select-none ${
                        isSelected
                          ? 'bg-gradient-to-r from-[#123163]/90 to-[#184285]/90 border-cyan-400 ring-2 ring-cyan-400/80 shadow-[0_0_20px_rgba(6,182,212,0.35)]'
                          : 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-cyan-400/50'
                      }`}
                    >
                      {/* Lado Esquerdo: Avatar Oficial Aprovado + Nome + Vínculo / WhatsApp */}
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                        <div className="relative shrink-0 flex items-center justify-center">
                          <SafeDebtorAvatar
                            name={debtor.name}
                            avatar={debtor.avatar}
                            size="sm"
                            status={hasOverdue ? 'late' : 'ok'}
                            className="ring-2 ring-cyan-400/70"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs sm:text-sm font-black text-white truncate group-hover:text-cyan-200 transition-colors">
                              {debtor.name}
                            </span>
                            <span className="w-3.5 h-3.5 rounded-full bg-[#1d9bf0] text-white flex items-center justify-center text-[8px] font-black shrink-0">
                              ✓
                            </span>
                            <span className="px-1.5 py-0.2 rounded-md bg-white/10 text-cyan-200 text-[9.5px] font-bold">
                              {debtor.relation || 'Cliente'}
                            </span>
                          </div>

                          <div className="text-[10.5px] text-slate-300 flex items-center gap-1.5 mt-0.5 truncate font-medium">
                            {debtor.phone && (
                              <span>Tel: {debtor.phone}</span>
                            )}
                            <span className="text-white/20">•</span>
                            <span className="text-slate-300">
                              {paidInstsCount}/{debtorInsts.length} pagas
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Lado Direito: Status + Valor Total em Aberto + Ação */}
                      <div className="flex items-center gap-2.5 shrink-0">
                        <div className="text-right">
                          <div className="mb-0.5">
                            {hasOverdue ? (
                              <span className="text-[9.5px] font-black px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40">
                                {debtor.overdueCount} atraso(s)
                              </span>
                            ) : isPaidOff ? (
                              <span className="text-[9.5px] font-black px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40">
                                Quitado
                              </span>
                            ) : (
                              <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                Em dia
                              </span>
                            )}
                          </div>
                          <span className={`font-mono font-black text-xs sm:text-sm block ${hasOverdue ? 'text-red-300' : 'text-cyan-300'}`}>
                            R$ {(Number(debtor.totalOwed) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        {/* Botão / Visto de Seleção */}
                        <div
                          className={`w-6.5 h-6.5 sm:w-7 sm:h-7 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${
                            isSelected
                              ? 'bg-cyan-400 text-slate-950 font-black shadow-xs'
                              : 'bg-white/10 group-hover:bg-cyan-500 group-hover:text-slate-950 text-slate-300'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[15px]">
                            {isSelected ? 'check' : 'arrow_forward'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Rodapé da Janela Limpo (Sem busca por filtro) */}
            <div className="p-3 sm:p-3.5 bg-[#081224] border-t border-white/10 flex items-center justify-between gap-2 shrink-0">
              <div className="text-[11px] text-slate-300 font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-cyan-400">group</span>
                <span>{debtors.length} devedor(es) cadastrado(s)</span>
              </div>

              <div className="flex items-center gap-2 ml-auto shrink-0">
                {onOpenNewDebtor && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsWindowOpen(false);
                      onOpenNewDebtor();
                    }}
                    className="h-8 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[15px]">add</span>
                    <span>Adicionar Pessoa</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsWindowOpen(false)}
                  className="h-8 px-3.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-xs transition-all cursor-pointer border border-white/10"
                >
                  Concluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
