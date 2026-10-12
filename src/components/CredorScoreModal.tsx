import React, { useState } from 'react';
import { Debtor, Installment, Purchase } from '../types';
import { safeFormatCurrency, safeToFixed } from '../utils/numberUtils';
import { playAppSound } from '../utils/soundUtils';

interface CredorScoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  debtors: Debtor[];
  installments: Installment[];
  purchases: Purchase[];
  isDarkMode?: boolean;
  onToast?: (msg: string) => void;
}

export const CredorScoreModal: React.FC<CredorScoreModalProps> = ({
  isOpen,
  onClose,
  debtors = [],
  installments = [],
  purchases = [],
  isDarkMode = true,
  onToast,
}) => {
  if (!isOpen) return null;

  // Limite Total (Valor X) - customizável pelo credor
  const [valorX, setValorX] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('haspaho_creditor_valor_x');
      if (saved) return parseFloat(saved) || 15000;
    } catch {}
    return 15000;
  });

  const [isEditingValorX, setIsEditingValorX] = useState(false);
  const [tempValorX, setTempValorX] = useState(valorX.toString());

  // Estado interativo para simulação dinâmica e divertida
  const [simulationBonus, setSimulationBonus] = useState<number>(0);
  const [simulationMode, setSimulationMode] = useState<'none' | 'receive' | 'grant'>('none');

  const handleSaveValorX = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(tempValorX);
    if (!isNaN(val) && val > 0) {
      setValorX(val);
      try {
        localStorage.setItem('haspaho_creditor_valor_x', val.toString());
      } catch {}
      if (onToast) onToast(`✨ Valor X (Limite Total) atualizado para R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      playAppSound('success');
    }
    setIsEditingValorX(false);
  };

  // Cálculos financeiros reais
  const totalComprometidoBase = debtors.reduce((acc, d) => acc + (d.totalOwed || 0), 0);
  const totalComprometido = Math.max(0, totalComprometidoBase + (simulationMode === 'grant' ? simulationBonus : 0));

  const totalRecebidoBase = installments
    .filter((i) => i.status === 'paid')
    .reduce((acc, i) => acc + (i.amount || 0), 0);
  const totalRecebido = totalRecebidoBase + (simulationMode === 'receive' ? simulationBonus : 0);
  
  const totalPendenteParcelas = installments
    .filter((i) => i.status !== 'paid')
    .reduce((acc, i) => acc + (i.amount || 0), 0);

  const limiteDisponivel = Math.max(0, valorX - totalComprometido);
  const percentualUtilizacao = valorX > 0 ? Math.min(100, (totalComprometido / valorX) * 100) : 0;
  
  const totalTodasParcelas = totalRecebido + totalPendenteParcelas;
  const percentualRecuperacao = totalTodasParcelas > 0 ? (totalRecebido / totalTodasParcelas) * 100 : 100;

  // Análise de inadimplência e atrasos na carteira
  const overdueInstallments = installments.filter((i) => i.status === 'overdue');
  const overdueCount = overdueInstallments.length;
  const overdueTotalValue = overdueInstallments.reduce((acc, i) => acc + (i.amount || 0), 0);

  // Concentração de risco por devedor
  const maxConcentrationDebtor = debtors.reduce((max, d) => {
    const owed = d.totalOwed || 0;
    return owed > (max.owed || 0) ? { name: d.name, owed } : max;
  }, { name: 'Nenhum', owed: 0 });

  const concentrationRatio = totalComprometido > 0 ? (maxConcentrationDebtor.owed / totalComprometido) * 100 : 0;

  // Cálculo do Score do Credor (0 a 1000)
  let creditorScore = 820;
  
  if (percentualRecuperacao >= 80) creditorScore += 100;
  else if (percentualRecuperacao >= 50) creditorScore += 40;
  else creditorScore -= 120;

  if (overdueCount > 0) {
    creditorScore -= overdueCount * 45;
  }

  if (concentrationRatio > 40) {
    creditorScore -= 65;
  }

  if (totalComprometido > valorX) {
    creditorScore -= 150;
  }

  if (simulationMode === 'receive') creditorScore += Math.min(120, Math.round(simulationBonus / 50));
  if (simulationMode === 'grant') creditorScore -= Math.min(100, Math.round(simulationBonus / 60));

  creditorScore = Math.max(100, Math.min(1000, Math.round(creditorScore)));

  // Tier e Classificação do Credor
  let tierTitle = 'Guardião Master';
  let riskLevel = 'Baixo Risco';
  let riskColor = 'text-emerald-300 bg-emerald-500/20 border-emerald-500/40';
  let tierEmoji = '👑';

  if (creditorScore >= 900) {
    tierTitle = 'Lenda do Crédito (Diamante)';
    tierEmoji = '💎';
  } else if (creditorScore >= 750) {
    tierTitle = 'Estrategista Sênior (Ouro)';
    tierEmoji = '🏆';
  } else if (creditorScore >= 600) {
    tierTitle = 'Gestor Prudente (Prata)';
    tierEmoji = '🛡️';
  } else {
    tierTitle = 'Em Alerta (Bronze)';
    tierEmoji = '⚠️';
  }

  if (creditorScore < 500 || overdueCount >= 4) {
    riskLevel = 'Risco Crítico';
    riskColor = 'text-rose-300 bg-rose-500/20 border-rose-500/40';
  } else if (creditorScore < 680 || overdueCount >= 2) {
    riskLevel = 'Risco Moderado/Elevado';
    riskColor = 'text-amber-300 bg-amber-500/20 border-amber-500/40';
  } else if (creditorScore < 800) {
    riskLevel = 'Risco Moderado';
    riskColor = 'text-blue-300 bg-blue-500/20 border-blue-500/40';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className={`relative w-full max-w-2xl max-h-[96vh] rounded-2xl sm:rounded-3xl shadow-2xl border flex flex-col overflow-hidden transition-all ${
        isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        {/* Header Compacto e Elegante */}
        <div className="relative bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 p-3.5 sm:p-5 text-white shrink-0">
          <div className="absolute top-2.5 right-2.5 sm:top-3.5 sm:right-3.5">
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors text-white cursor-pointer shadow-md"
              aria-label="Fechar"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 mb-1.5 pr-10">
            <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm flex items-center gap-1 shadow-sm">
              <span className="material-symbols-outlined text-[13px]">verified</span>
              Botão Mágico • Score
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border backdrop-blur-sm ${riskColor}`}>
              {riskLevel}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-200 text-[10px] font-bold uppercase tracking-wider border border-amber-400/30 flex items-center gap-1">
              <span>{tierEmoji}</span> {tierTitle}
            </span>
          </div>

          <h2 className="text-base sm:text-xl font-black tracking-tight flex items-center gap-1.5">
            <span>✨ Score do Credor & Controle</span>
          </h2>
          <p className="text-violet-100 text-[11px] sm:text-xs mt-0.5 max-w-lg leading-relaxed">
            Painel inteligente para monitorar seu capital emprestado (Valor X), saúde da carteira e liquidez.
          </p>
        </div>

        {/* Conteúdo com Scroll Suave e Organização Perfeita sem Cortes */}
        <div className="p-3 sm:p-5 space-y-3 sm:space-y-4 overflow-y-auto flex-1">
          {/* Card Principal: Score e Valor X em Destaque */}
          <div className={`grid grid-cols-1 sm:grid-cols-12 gap-3 p-3.5 sm:p-4 rounded-2xl border items-center shadow-sm ${
            isDarkMode ? 'bg-slate-800/70 border-slate-700/80' : 'bg-slate-50 border-slate-200'
          }`}>
            {/* Box do Score */}
            <div className="sm:col-span-5 flex flex-col items-center justify-center text-center p-3 rounded-xl bg-gradient-to-b from-violet-500/10 to-indigo-500/5 border border-violet-500/20">
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-violet-400 mb-0.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">speed</span> Score Geral do Credor
              </span>
              <div className="text-2xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400 my-0.5">
                {creditorScore}
              </div>
              <span className="text-[9px] text-slate-400 font-medium">Escala de 0 a 1.000 pontos</span>
              <div className="mt-2 w-full bg-slate-700/30 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-violet-500 via-indigo-500 to-purple-500 h-1.5 rounded-full transition-all duration-1000"
                  style={{ width: `${(creditorScore / 1000) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Box do Valor X e Totais */}
            <div className="sm:col-span-7 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2.5 border-b border-slate-700/30">
                <div>
                  <h3 className="text-xs font-bold flex items-center gap-1 text-violet-300">
                    <span className="material-symbols-outlined text-violet-400 text-[15px]">account_balance_wallet</span>
                    Limite Total (Valor X)
                  </h3>
                  <p className="text-[9px] text-slate-400">Teto de capital para recebíveis.</p>
                </div>
                <div>
                  {isEditingValorX ? (
                    <form onSubmit={handleSaveValorX} className="flex items-center gap-1.5">
                      <input
                        type="number"
                        value={tempValorX}
                        onChange={(e) => setTempValorX(e.target.value)}
                        className="w-24 px-2 py-1 text-xs rounded-lg bg-slate-700 border border-violet-500 text-white focus:outline-none"
                        autoFocus
                      />
                      <button type="submit" className="px-2 py-1 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-lg cursor-pointer">
                        Salvar
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm sm:text-lg font-black text-violet-400">
                        {safeFormatCurrency(valorX)}
                      </span>
                      <button
                        onClick={() => { setTempValorX(valorX.toString()); setIsEditingValorX(true); }}
                        className="p-1 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        title="Editar Valor X"
                      >
                        <span className="material-symbols-outlined text-[15px]">edit</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Grid 3 colunas de indicadores */}
              <div className="grid grid-cols-3 gap-2">
                <div className={`p-2 rounded-xl border ${isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Comprometido</span>
                  <span className="text-xs font-extrabold text-amber-400 truncate block">{safeFormatCurrency(totalComprometido)}</span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">{safeToFixed(percentualUtilizacao, 1)}% usado</span>
                </div>

                <div className={`p-2 rounded-xl border ${isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Disponível</span>
                  <span className="text-xs font-extrabold text-emerald-400 truncate block">{safeFormatCurrency(limiteDisponivel)}</span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">Livre</span>
                </div>

                <div className={`p-2 rounded-xl border ${isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Recebido</span>
                  <span className="text-xs font-extrabold text-cyan-400 truncate block">{safeFormatCurrency(totalRecebido)}</span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">{safeToFixed(percentualRecuperacao, 1)}% retorno</span>
                </div>
              </div>
            </div>
          </div>

          {/* Simulador Interativo & Divertido com Slider Personalizado */}
          <div className={`p-3 sm:p-4 rounded-2xl border ${isDarkMode ? 'bg-violet-950/20 border-violet-800/40' : 'bg-violet-50/70 border-violet-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-xs sm:text-sm flex items-center gap-1.5 text-violet-300 uppercase tracking-wider">
                <span className="material-symbols-outlined text-violet-400 text-[16px]">bolt</span>
                Simulador Interativo em Tempo Real
              </h4>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-semibold">
                Modo Divertido 🚀
              </span>
            </div>
            
            <p className="text-[11px] text-slate-300 mb-2.5">
              Escolha uma simulação ou ajuste o valor bônus para testar o impacto imediato no seu Score de Credor:
            </p>

            <div className="grid grid-cols-3 gap-2 mb-3">
              <button
                onClick={() => {
                  setSimulationMode('none');
                  setSimulationBonus(0);
                  if (onToast) onToast('🔄 Simulação reiniciada para os dados reais do Firestore.');
                  playAppSound('click');
                }}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border text-center ${
                  simulationMode === 'none'
                    ? 'bg-violet-600 text-white border-violet-500 shadow-md'
                    : isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                📊 Dados Reais
              </button>

              <button
                onClick={() => {
                  setSimulationMode('receive');
                  setSimulationBonus(2500);
                  if (onToast) onToast('✨ Simulação ativa: +R$ 2.500 recebidos!');
                  playAppSound('success');
                }}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border text-center flex items-center justify-center gap-1 ${
                  simulationMode === 'receive'
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                    : isDarkMode ? 'bg-slate-800 text-emerald-400 border-emerald-500/30 hover:bg-slate-700' : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-500/10'
                }`}
              >
                <span>💰 +R$ 2.5K Recebidos</span>
              </button>

              <button
                onClick={() => {
                  setSimulationMode('grant');
                  setSimulationBonus(3000);
                  if (onToast) onToast('⚠️ Simulação ativa: +R$ 3.000 concedidos.');
                  playAppSound('alert');
                }}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border text-center flex items-center justify-center gap-1 ${
                  simulationMode === 'grant'
                    ? 'bg-amber-600 text-white border-amber-500 shadow-md'
                    : isDarkMode ? 'bg-slate-800 text-amber-400 border-amber-500/30 hover:bg-slate-700' : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-500/10'
                }`}
              >
                <span>🚀 +R$ 3K Emprestados</span>
              </button>
            </div>

            {simulationMode !== 'none' && (
              <div className="space-y-1.5 pt-2 border-t border-violet-500/20">
                <div className="flex justify-between text-xs font-semibold text-violet-200">
                  <span>Valor da Simulação ({simulationMode === 'receive' ? 'Recebimento Extra' : 'Crédito Adicional'}):</span>
                  <span className="font-black text-amber-300">R$ {simulationBonus.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <input
                  type="range"
                  min="500"
                  max="10000"
                  step="500"
                  value={simulationBonus}
                  onChange={(e) => setSimulationBonus(Number(e.target.value))}
                  className="w-full accent-violet-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                />
              </div>
            )}
          </div>

          {/* Alertas e Insights em Grid Compacto */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className={`p-3 rounded-2xl border ${isDarkMode ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <h4 className="font-bold text-xs flex items-center gap-1 mb-1.5 text-slate-200 uppercase tracking-wider">
                <span className="material-symbols-outlined text-amber-400 text-[15px]">warning</span>
                Indicadores de Alerta
              </h4>
              <ul className="space-y-1.5 text-[11px] sm:text-xs text-slate-300">
                <li className="flex items-start gap-1">
                  <span className="material-symbols-outlined text-[13px] text-violet-400 shrink-0 mt-0.5">check_circle</span>
                  <span><strong>Maior devedor:</strong> {maxConcentrationDebtor.name} ({safeFormatCurrency(maxConcentrationDebtor.owed)} - {safeToFixed(concentrationRatio, 1)}%)</span>
                </li>
                {concentrationRatio > 35 && (
                  <li className="flex items-start gap-1 text-amber-300">
                    <span className="material-symbols-outlined text-[13px] shrink-0 mt-0.5">info</span>
                    <span>Alta concentração de crédito na carteira.</span>
                  </li>
                )}
                {overdueCount > 0 ? (
                  <li className="flex items-start gap-1 text-rose-300">
                    <span className="material-symbols-outlined text-[13px] shrink-0 mt-0.5">error</span>
                    <span>{overdueCount} parcela(s) vencida(s) ({safeFormatCurrency(overdueTotalValue)}).</span>
                  </li>
                ) : (
                  <li className="flex items-start gap-1 text-emerald-300">
                    <span className="material-symbols-outlined text-[13px] shrink-0 mt-0.5">thumb_up</span>
                    <span>Nenhum atraso crítico na carteira!</span>
                  </li>
                )}
              </ul>
            </div>

            <div className={`p-3 rounded-2xl border ${isDarkMode ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <h4 className="font-bold text-xs flex items-center gap-1 mb-1.5 text-slate-200 uppercase tracking-wider">
                <span className="material-symbols-outlined text-indigo-400 text-[15px]">insights</span>
                Dicas de Otimização
              </h4>
              <ul className="space-y-1.5 text-[11px] sm:text-xs text-slate-300">
                <li className="flex items-start gap-1">
                  <span className="material-symbols-outlined text-[13px] text-indigo-400 shrink-0 mt-0.5">tips_and_updates</span>
                  <span>Incentive pagamentos pontuais para subir ao Tier Diamante.</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="material-symbols-outlined text-[13px] text-indigo-400 shrink-0 mt-0.5">tips_and_updates</span>
                  <span>Mantenha o comprometimento abaixo de 70% do Valor X.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Rodapé Fixo */}
        <div className={`p-3 border-t flex flex-wrap items-center justify-between gap-2.5 shrink-0 ${
          isDarkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-slate-100 border-slate-200'
        }`}>
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[15px] text-emerald-400">cloud_done</span>
            Sincronizado com Firebase Firestore.
          </div>
          <button
            onClick={() => {
              playAppSound('click');
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs shadow-lg shadow-violet-600/30 transition-all cursor-pointer flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[15px]">check</span>
            Entendido & Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
