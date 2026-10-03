import React, { useState, useEffect, useMemo } from 'react';
import jsPDF from 'jspdf';
import { UserAccount } from '../types';
import { generateHaspahoLogoPngDataUrl } from '../utils/logoPdfHelper';

export interface PersonalFixedExpense {
  id: string;
  name: string;
  category: 'energia' | 'agua' | 'internet' | 'telefone' | 'streaming' | 'veiculo' | 'cartao' | 'outros';
  amount: number;
  dueDay: number;
  paid: boolean;
  notes?: string;
}

export interface PersonalVariableExpense {
  id: string;
  name: string;
  category: 'combustivel' | 'comida' | 'farmacia' | 'manutencao' | 'lazer' | 'outros';
  amount: number;
  date: string;
  paymentMethod: string;
}

export interface PersonalDailyExpense {
  id: string;
  description: string;
  category: string;
  amount: number;
  date: string;
  paymentMethod: string;
}

interface MeuGerenciamentoPessoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: UserAccount | null;
  onToast?: (msg: string) => void;
}

const DEFAULT_FIXED_EXPENSES: PersonalFixedExpense[] = [
  { id: 'fix-1', name: 'CPFL (Energia Elétrica / Luz)', category: 'energia', amount: 220.0, dueDay: 15, paid: false },
  { id: 'fix-2', name: 'Conta de Água (SABESP / DAE)', category: 'agua', amount: 85.0, dueDay: 18, paid: false },
  { id: 'fix-3', name: 'Internet Residencial (Fibra)', category: 'internet', amount: 119.9, dueDay: 10, paid: false },
  { id: 'fix-4', name: 'Telefonia Celular (Vivo / Claro)', category: 'telefone', amount: 69.9, dueDay: 20, paid: false },
  { id: 'fix-5', name: 'Netflix & Assinaturas Streaming', category: 'streaming', amount: 55.9, dueDay: 5, paid: false },
  { id: 'fix-6', name: 'Carro (Parcela / Seguro / Manutenção)', category: 'veiculo', amount: 450.0, dueDay: 25, paid: false },
  { id: 'fix-7', name: 'Cartão de Crédito Pessoal', category: 'cartao', amount: 1200.0, dueDay: 12, paid: false },
];

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const MeuGerenciamentoPessoalModal: React.FC<MeuGerenciamentoPessoalModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onToast,
}) => {
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonthIndex, setCurrentMonthIndex] = useState(() => new Date().getMonth());
  const [activeTab, setActiveTab] = useState<'fixos' | 'variaveis' | 'diarios'>('fixos');

  // Chaves de armazenamento isoladas para Tiago Dias
  const storageKey = useMemo(() => {
    return `haspaho_personal_finance_${currentYear}_${currentMonthIndex + 1}`;
  }, [currentYear, currentMonthIndex]);

  // Estados dos gastos
  const [fixedExpenses, setFixedExpenses] = useState<PersonalFixedExpense[]>(() => {
    try {
      const saved = localStorage.getItem(`haspaho_personal_fixed_master`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_FIXED_EXPENSES;
  });

  const [variableExpenses, setVariableExpenses] = useState<PersonalVariableExpense[]>([]);
  const [dailyExpenses, setDailyExpenses] = useState<PersonalDailyExpense[]>([]);

  // Formulário rápido de Gasto Diário
  const [dailyDesc, setDailyDesc] = useState('');
  const [dailyAmount, setDailyAmount] = useState('');
  const [dailyCategory, setDailyCategory] = useState('Alimentação');
  const [dailyMethod, setDailyMethod] = useState('PIX');
  const [dailyDate, setDailyDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Formulário de Nova Despesa Fixa
  const [isAddingFixed, setIsAddingFixed] = useState(false);
  const [newFixedName, setNewFixedName] = useState('');
  const [newFixedAmount, setNewFixedAmount] = useState('');
  const [newFixedDueDay, setNewFixedDueDay] = useState('10');

  // Formulário de Nova Despesa Variável
  const [isAddingVariable, setIsAddingVariable] = useState(false);
  const [newVarName, setNewVarName] = useState('');
  const [newVarCategory, setNewVarCategory] = useState<'combustivel' | 'comida' | 'farmacia' | 'manutencao' | 'lazer' | 'outros'>('combustivel');
  const [newVarAmount, setNewVarAmount] = useState('');
  const [newVarMethod, setNewVarMethod] = useState('Cartão de Débito');

  // Estados para edição inline de valor
  const [editingFixedId, setEditingFixedId] = useState<string | null>(null);
  const [editingAmountText, setEditingAmountText] = useState<string>('');

  // Carregar dados salvos do mês
  useEffect(() => {
    try {
      const monthData = localStorage.getItem(storageKey);
      if (monthData) {
        const parsed = JSON.parse(monthData);
        if (Array.isArray(parsed.variableExpenses)) setVariableExpenses(parsed.variableExpenses);
        else setVariableExpenses([]);
        if (Array.isArray(parsed.dailyExpenses)) setDailyExpenses(parsed.dailyExpenses);
        else setDailyExpenses([]);
        if (Array.isArray(parsed.fixedExpenses)) setFixedExpenses(parsed.fixedExpenses);
      } else {
        // Carrega despesas fixas mestras se o mês ainda não tem dados
        const savedFixed = localStorage.getItem('haspaho_personal_fixed_master');
        if (savedFixed) {
          setFixedExpenses(JSON.parse(savedFixed));
        } else {
          setFixedExpenses(DEFAULT_FIXED_EXPENSES);
        }
        setVariableExpenses([]);
        setDailyExpenses([]);
      }
    } catch (e) {
      console.warn('Erro ao carregar dados pessoais:', e);
    }
  }, [storageKey]);

  // Salvar no LocalStorage automaticamente quando houver alterações
  const saveMonthData = (
    fixed: PersonalFixedExpense[],
    vars: PersonalVariableExpense[],
    daily: PersonalDailyExpense[]
  ) => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          fixedExpenses: fixed,
          variableExpenses: vars,
          dailyExpenses: daily,
          updatedAt: new Date().toISOString(),
        })
      );
      // Salva modelo mestre de despesas fixas para pré-preencher futuros meses
      localStorage.setItem('haspaho_personal_fixed_master', JSON.stringify(fixed));
    } catch (e) {
      console.warn('Erro ao salvar dados pessoais:', e);
    }
  };

  // Cálculos de Totais
  const totalFixed = useMemo(() => {
    return fixedExpenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  }, [fixedExpenses]);

  const totalFixedPaid = useMemo(() => {
    return fixedExpenses.filter((e) => e.paid).reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  }, [fixedExpenses]);

  const totalVariable = useMemo(() => {
    return variableExpenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  }, [variableExpenses]);

  const totalDaily = useMemo(() => {
    return dailyExpenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  }, [dailyExpenses]);

  const grandTotal = totalFixed + totalVariable + totalDaily;

  // Handlers para Despesas Fixas
  const handleToggleFixedPaid = (id: string) => {
    const updated = fixedExpenses.map((item) =>
      item.id === id ? { ...item, paid: !item.paid } : item
    );
    setFixedExpenses(updated);
    saveMonthData(updated, variableExpenses, dailyExpenses);
    if (onToast) onToast('Status do gasto fixo atualizado!');
  };

  const handleUpdateFixedAmount = (id: string, newAmount: number) => {
    const updated = fixedExpenses.map((item) =>
      item.id === id ? { ...item, amount: newAmount } : item
    );
    setFixedExpenses(updated);
    saveMonthData(updated, variableExpenses, dailyExpenses);
    if (onToast) onToast('Valor do gasto fixo atualizado!');
  };

  const handleDeleteFixed = (id: string) => {
    const updated = fixedExpenses.filter((item) => item.id !== id);
    setFixedExpenses(updated);
    saveMonthData(updated, variableExpenses, dailyExpenses);
    if (onToast) onToast('Gasto fixo removido!');
  };

  const handleAddFixedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFixedName.trim() || !newFixedAmount) return;
    const parsedAmt = parseFloat(newFixedAmount.replace(',', '.')) || 0;
    const newExp: PersonalFixedExpense = {
      id: `fix-${Date.now()}`,
      name: newFixedName.trim(),
      category: 'outros',
      amount: parsedAmt,
      dueDay: parseInt(newFixedDueDay, 10) || 10,
      paid: false,
    };
    const updated = [...fixedExpenses, newExp];
    setFixedExpenses(updated);
    saveMonthData(updated, variableExpenses, dailyExpenses);
    setNewFixedName('');
    setNewFixedAmount('');
    setIsAddingFixed(false);
    if (onToast) onToast(`Gasto fixo "${newExp.name}" adicionado!`);
  };

  // Handlers para Despesas Variáveis
  const handleAddVariableSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVarName.trim() || !newVarAmount) return;
    const parsedAmt = parseFloat(newVarAmount.replace(',', '.')) || 0;
    const newExp: PersonalVariableExpense = {
      id: `var-${Date.now()}`,
      name: newVarName.trim(),
      category: newVarCategory,
      amount: parsedAmt,
      date: new Date().toISOString().split('T')[0],
      paymentMethod: newVarMethod,
    };
    const updated = [newExp, ...variableExpenses];
    setVariableExpenses(updated);
    saveMonthData(fixedExpenses, updated, dailyExpenses);
    setNewVarName('');
    setNewVarAmount('');
    setIsAddingVariable(false);
    if (onToast) onToast(`Despesa variável "${newExp.name}" registrada!`);
  };

  const handleDeleteVariable = (id: string) => {
    const updated = variableExpenses.filter((item) => item.id !== id);
    setVariableExpenses(updated);
    saveMonthData(fixedExpenses, updated, dailyExpenses);
    if (onToast) onToast('Despesa variável removida!');
  };

  // Handlers para Gastos Diários
  const handleAddDailySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dailyDesc.trim() || !dailyAmount) return;
    const parsedAmt = parseFloat(dailyAmount.replace(',', '.')) || 0;
    const newDaily: PersonalDailyExpense = {
      id: `day-${Date.now()}`,
      description: dailyDesc.trim(),
      category: dailyCategory,
      amount: parsedAmt,
      date: dailyDate,
      paymentMethod: dailyMethod,
    };
    const updated = [newDaily, ...dailyExpenses];
    setDailyExpenses(updated);
    saveMonthData(fixedExpenses, variableExpenses, updated);
    setDailyDesc('');
    setDailyAmount('');
    if (onToast) onToast(`Gasto de R$ ${parsedAmt.toFixed(2).replace('.', ',')} adicionado!`);
  };

  const handleDeleteDaily = (id: string) => {
    const updated = dailyExpenses.filter((item) => item.id !== id);
    setDailyExpenses(updated);
    saveMonthData(fixedExpenses, variableExpenses, updated);
    if (onToast) onToast('Gasto diário removido!');
  };

  // Navegação de Mês
  const handlePrevMonth = () => {
    if (currentMonthIndex === 0) {
      setCurrentMonthIndex(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonthIndex((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonthIndex === 11) {
      setCurrentMonthIndex(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonthIndex((m) => m + 1);
    }
  };

  // Exportar Relatório em PDF
  const handleExportPdf = async () => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const monthLabel = `${MONTH_NAMES[currentMonthIndex]} de ${currentYear}`;
      const userName = currentUser?.name || 'Tiago Dias';

      // Load brand logo PNG
      let logoDataUrl = '';
      try {
        logoDataUrl = await generateHaspahoLogoPngDataUrl();
      } catch (logoErr) {
        console.warn('Erro ao carregar logo no PDF:', logoErr);
      }

      // Add giant, faint brand logo watermark in the center background
      if (logoDataUrl) {
        doc.saveGraphicsState();
        // Set opacity for watermark (very faint)
        doc.setGState(new (doc as any).GState({ opacity: 0.08 }));
        doc.addImage(logoDataUrl, 'PNG', 45, 110, 120, 45);
        doc.restoreGraphicsState();
      }

      // Top brand logo
      if (logoDataUrl) {
        doc.addImage(logoDataUrl, 'PNG', 85, 4, 40, 15);
      }

      // Header
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(14, 22, 182, 18, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('MEU GERENCIAMENTO PESSOAL • CONTROLE DE GASTOS', 105, 29, { align: 'center' });
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Titular: ${userName} • Competência: ${monthLabel} • Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 105, 35, { align: 'center' });

      let y = 45;

      // Resumo Geral
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, y, 182, 22, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text('RESUMO GERAL DO MÊS:', 18, y + 6);

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`Total Gastos Fixos: R$ ${totalFixed.toFixed(2).replace('.', ',')}`, 18, y + 12);
      doc.text(`Total Variáveis: R$ ${totalVariable.toFixed(2).replace('.', ',')}`, 70, y + 12);
      doc.text(`Total Diários: R$ ${totalDaily.toFixed(2).replace('.', ',')}`, 125, y + 12);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(5, 150, 105);
      doc.text(`TOTAL GERAL: R$ ${grandTotal.toFixed(2).replace('.', ',')}`, 18, y + 18);

      y += 28;

      // Seção 1: Gastos Fixos
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(`1. GASTOS FIXOS PRÉ-PREENCHIDOS (${fixedExpenses.length} itens):`, 14, y);
      y += 4;

      doc.setFillColor(241, 245, 249);
      doc.rect(14, y, 182, 5, 'F');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text('DESPESA FIXA', 16, y + 3.5);
      doc.text('DIA VENC.', 110, y + 3.5);
      doc.text('STATUS', 140, y + 3.5);
      doc.text('VALOR (R$)', 175, y + 3.5, { align: 'right' });
      y += 5.5;

      fixedExpenses.forEach((item) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        doc.text(item.name.substring(0, 45), 16, y + 3.5);
        doc.text(`Dia ${item.dueDay}`, 110, y + 3.5);
        doc.text(item.paid ? 'PAGO ✓' : 'PENDENTE', 140, y + 3.5);
        doc.setFont('helvetica', 'bold');
        doc.text(`R$ ${item.amount.toFixed(2).replace('.', ',')}`, 175, y + 3.5, { align: 'right' });
        y += 5;
      });

      y += 6;

      // Seção 2: Despesas Variáveis
      if (variableExpenses.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text(`2. DESPESAS VARIÁVEIS DO MÊS (${variableExpenses.length} lançamentos):`, 14, y);
        y += 4;

        variableExpenses.forEach((item) => {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.text(`• ${item.name} (${item.category.toUpperCase()}) - ${item.paymentMethod}`, 16, y + 3.5);
          doc.setFont('helvetica', 'bold');
          doc.text(`R$ ${item.amount.toFixed(2).replace('.', ',')}`, 175, y + 3.5, { align: 'right' });
          y += 4.5;
        });
        y += 4;
      }

      // Seção 3: Gastos Diários
      if (dailyExpenses.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text(`3. GASTOS DIÁRIOS RECENTES (${dailyExpenses.length} registros):`, 14, y);
        y += 4;

        dailyExpenses.slice(0, 15).forEach((item) => {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.text(`[${item.date}] ${item.description} - ${item.category} (${item.paymentMethod})`, 16, y + 3);
          doc.setFont('helvetica', 'bold');
          doc.text(`R$ ${item.amount.toFixed(2).replace('.', ',')}`, 175, y + 3, { align: 'right' });
          y += 4;
        });
      }

      // Rodapé
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Documento confidencial de controle pessoal emitido por HASPAHO TI • Gestão de Gastos Tiago Dias`,
        105,
        286,
        { align: 'center' }
      );

      const filename = `meu_gerenciamento_pessoal_${currentYear}_${currentMonthIndex + 1}.pdf`;
      doc.save(filename);
      if (onToast) onToast('📄 PDF do Gerenciamento Pessoal baixado com sucesso!');
    } catch (err) {
      console.error('Erro ao gerar PDF pessoal:', err);
      if (onToast) onToast('Erro ao exportar PDF.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-slate-900 border-2 border-emerald-500/40 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-white my-auto">
        
        {/* ============================================================ */}
        {/* 1. CABEÇALHO DO MODAL                                        */}
        {/* ============================================================ */}
        <div className="shrink-0 bg-slate-950/90 border-b border-emerald-500/30 px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
              <span className="material-symbols-outlined text-[24px]">account_balance_wallet</span>
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-base sm:text-lg text-white leading-tight">
                  Meu Gerenciamento Pessoal
                </h3>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Exclusivo Tiago Dias
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Controle 100% privado de despesas fixas, variáveis e gastos do dia a dia (sem devedores).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Seletor do Mês */}
            <div className="flex items-center gap-1 bg-slate-800/90 border border-slate-700 rounded-xl px-2 py-1 text-xs">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="w-6 h-6 rounded-lg hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
                title="Mês Anterior"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              </button>
              <span className="font-bold font-mono px-1 text-emerald-300">
                {MONTH_NAMES[currentMonthIndex]} / {currentYear}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="w-6 h-6 rounded-lg hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
                title="Próximo Mês"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportPdf}
              className="h-8 sm:h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              title="Exportar Relatório Mensal em PDF"
            >
              <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
              <span className="hidden sm:inline">Baixar PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Fechar"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* 2. CARDS DE RESUMO DO MÊS                                     */}
        {/* ============================================================ */}
        <div className="shrink-0 p-3 sm:p-5 bg-slate-950/60 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Card 1: Gastos Fixos */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3 flex flex-col justify-between shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-cyan-400">home</span>
              Gastos Fixos
            </span>
            <div className="mt-1">
              <span className="text-lg sm:text-xl font-mono font-black text-cyan-300">
                R$ {totalFixed.toFixed(2).replace('.', ',')}
              </span>
              <span className="text-[9.5px] block text-slate-400 mt-0.5">
                Pago: R$ {totalFixedPaid.toFixed(2).replace('.', ',')}
              </span>
            </div>
          </div>

          {/* Card 2: Variáveis do Mês */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3 flex flex-col justify-between shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-amber-400">trending_up</span>
              Variáveis (Mês)
            </span>
            <div className="mt-1">
              <span className="text-lg sm:text-xl font-mono font-black text-amber-300">
                R$ {totalVariable.toFixed(2).replace('.', ',')}
              </span>
              <span className="text-[9.5px] block text-slate-400 mt-0.5">
                {variableExpenses.length} lançamentos
              </span>
            </div>
          </div>

          {/* Card 3: Gastos Diários */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3 flex flex-col justify-between shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-purple-400">today</span>
              Gastos Diários
            </span>
            <div className="mt-1">
              <span className="text-lg sm:text-xl font-mono font-black text-purple-300">
                R$ {totalDaily.toFixed(2).replace('.', ',')}
              </span>
              <span className="text-[9.5px] block text-slate-400 mt-0.5">
                {dailyExpenses.length} registros
              </span>
            </div>
          </div>

          {/* Card 4: Total Geral */}
          <div className="bg-gradient-to-br from-emerald-950 to-slate-900 border-2 border-emerald-500/60 rounded-2xl p-3 flex flex-col justify-between shadow-md">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">payments</span>
              Total Geral ({MONTH_NAMES[currentMonthIndex].slice(0, 3)})
            </span>
            <div className="mt-1">
              <span className="text-xl sm:text-2xl font-mono font-black text-emerald-300">
                R$ {grandTotal.toFixed(2).replace('.', ',')}
              </span>
              <span className="text-[9.5px] block text-emerald-400/80 mt-0.5">
                Despesas pessoais consolidadas
              </span>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* 3. ABAS DE NAVEGAÇÃO                                         */}
        {/* ============================================================ */}
        <div className="shrink-0 flex items-center gap-2 px-3 sm:px-6 pt-3 border-b border-slate-800 bg-slate-950/40">
          <button
            type="button"
            onClick={() => setActiveTab('fixos')}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'fixos'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">receipt_long</span>
            <span>1. Gastos Fixos Pré-Preenchidos</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300">
              {fixedExpenses.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('variaveis')}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'variaveis'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">tune</span>
            <span>2. Despesas Variáveis do Mês</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300">
              {variableExpenses.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('diarios')}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'diarios'
                ? 'border-purple-400 text-purple-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">add_circle</span>
            <span>3. Lançamentos Diários</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300">
              {dailyExpenses.length}
            </span>
          </button>
        </div>

        {/* ============================================================ */}
        {/* 4. CONTEÚDO DA ABA ATIVA                                     */}
        {/* ============================================================ */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-4 scrollbar-thin">
          
          {/* ---------------------------------------------------------- */}
          {/* ABA 1: GASTOS FIXOS (CPFL, Água, Internet, Carro, etc.)    */}
          {/* ---------------------------------------------------------- */}
          {activeTab === 'fixos' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-1 border-b border-slate-800">
                <div>
                  <h4 className="font-bold text-sm text-slate-200">
                    Contas Fixas &amp; Recorrentes Mensais
                  </h4>
                  <p className="text-xs text-slate-400">
                    Valores pré-preenchidos automaticamente com CPFL, Água, Telefonia, Internet, Carro e Netflix.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddingFixed(!isAddingFixed)}
                  className="px-3 py-1.5 rounded-xl bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-400/40 text-cyan-200 hover:text-white font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">
                    {isAddingFixed ? 'close' : 'add'}
                  </span>
                  <span>{isAddingFixed ? 'Fechar' : 'Novo Gasto Fixo'}</span>
                </button>
              </div>

              {/* Formulário de Adicionar Gasto Fixo */}
              {isAddingFixed && (
                <form
                  onSubmit={handleAddFixedSubmit}
                  className="bg-slate-800/90 border border-cyan-500/40 rounded-2xl p-3.5 flex flex-col sm:flex-row items-end gap-2.5 animate-in fade-in"
                >
                  <div className="flex-1 w-full flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-slate-300">Nome da Despesa Fixa</label>
                    <input
                      type="text"
                      placeholder="Ex: Condomínio, IPTU, Seguro Residencial..."
                      value={newFixedName}
                      onChange={(e) => setNewFixedName(e.target.value)}
                      className="w-full h-9 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400"
                      required
                    />
                  </div>
                  <div className="w-full sm:w-36 flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-slate-300">Valor Mensal (R$)</label>
                    <input
                      type="text"
                      placeholder="0,00"
                      value={newFixedAmount}
                      onChange={(e) => setNewFixedAmount(e.target.value)}
                      className="w-full h-9 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-white placeholder-slate-500 outline-none focus:border-cyan-400"
                      required
                    />
                  </div>
                  <div className="w-full sm:w-28 flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-slate-300">Dia Vencimento</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={newFixedDueDay}
                      onChange={(e) => setNewFixedDueDay(e.target.value)}
                      className="w-full h-9 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-white placeholder-slate-500 outline-none focus:border-cyan-400"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full sm:w-auto h-9 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-xs cursor-pointer shrink-0"
                  >
                    <span className="material-symbols-outlined text-[15px]">check</span>
                    <span>Salvar</span>
                  </button>
                </form>
              )}

              {/* Tabela / Cards de Gastos Fixos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {fixedExpenses.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      item.paid
                        ? 'bg-emerald-950/20 border-emerald-500/40 text-slate-200'
                        : 'bg-slate-800/70 border-slate-700/80 text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleToggleFixedPaid(item.id)}
                        className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all cursor-pointer shrink-0 border ${
                          item.paid
                            ? 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-xs'
                            : 'bg-slate-900 border-slate-600 text-slate-400 hover:border-slate-400'
                        }`}
                        title={item.paid ? 'Marcar como Pendente' : 'Marcar como Pago'}
                      >
                        <span className="material-symbols-outlined text-[17px]">
                          {item.paid ? 'check' : 'radio_button_unchecked'}
                        </span>
                      </button>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h5 className="font-bold text-xs sm:text-sm text-slate-100 truncate">
                            {item.name}
                          </h5>
                          {item.paid && (
                            <span className="text-[8.5px] font-black uppercase px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">
                              Pago
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400">
                          Vencimento: todo dia <b>{item.dueDay}</b>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        {editingFixedId === item.id ? (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="number"
                              step="0.01"
                              value={editingAmountText}
                              onChange={(e) => setEditingAmountText(e.target.value)}
                              className="w-20 h-7 px-1.5 bg-slate-800 text-white border border-slate-700 rounded text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const parsed = parseFloat(editingAmountText.replace(',', '.')) || item.amount;
                                handleUpdateFixedAmount(item.id, parsed);
                                setEditingFixedId(null);
                              }}
                              className="w-6 h-7 rounded bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center cursor-pointer shadow-2xs active:scale-90"
                              title="Salvar valor"
                            >
                              <span className="material-symbols-outlined text-[13px] font-bold">check</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingFixedId(null)}
                              className="w-6 h-7 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 flex items-center justify-center cursor-pointer shadow-2xs active:scale-90"
                              title="Cancelar edição"
                            >
                              <span className="material-symbols-outlined text-[13px] font-bold">close</span>
                            </button>
                          </div>
                        ) : (
                          <span className="font-mono font-black text-sm sm:text-base text-cyan-300 block">
                            R$ {item.amount.toFixed(2).replace('.', ',')}
                          </span>
                        )}
                      </div>

                      {editingFixedId !== item.id && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingFixedId(item.id);
                            setEditingAmountText(String(item.amount));
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors cursor-pointer"
                          title="Editar Valor"
                        >
                          <span className="material-symbols-outlined text-[15px]">edit</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Remover "${item.name}" das despesas fixas?`)) {
                            handleDeleteFixed(item.id);
                          }
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-300 hover:bg-red-500/20 transition-colors cursor-pointer"
                        title="Excluir"
                      >
                        <span className="material-symbols-outlined text-[15px]">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------- */}
          {/* ABA 2: DESPESAS VARIÁVEIS (Combustível, Comida, etc.)      */}
          {/* ---------------------------------------------------------- */}
          {activeTab === 'variaveis' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-1 border-b border-slate-800">
                <div>
                  <h4 className="font-bold text-sm text-slate-200">
                    Despesas Variáveis Mensais
                  </h4>
                  <p className="text-xs text-slate-400">
                    Combustível, supermercado, farmácia e gastos maiores adicionados manualmente mês a mês.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddingVariable(!isAddingVariable)}
                  className="px-3 py-1.5 rounded-xl bg-amber-600/30 hover:bg-amber-600/50 border border-amber-400/40 text-amber-200 hover:text-white font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">
                    {isAddingVariable ? 'close' : 'add'}
                  </span>
                  <span>{isAddingVariable ? 'Fechar' : 'Nova Despesa do Mês'}</span>
                </button>
              </div>

              {/* Formulário de Adicionar Despesa Variável */}
              {isAddingVariable && (
                <form
                  onSubmit={handleAddVariableSubmit}
                  className="bg-slate-800/90 border border-amber-500/40 rounded-2xl p-3.5 flex flex-col sm:flex-row items-end gap-2.5 animate-in fade-in"
                >
                  <div className="flex-1 w-full flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-slate-300">Descrição / Estabelecimento</label>
                    <input
                      type="text"
                      placeholder="Ex: Abastecimento Posto Shell, Compra no Supermercado..."
                      value={newVarName}
                      onChange={(e) => setNewVarName(e.target.value)}
                      className="w-full h-9 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400"
                      required
                    />
                  </div>

                  <div className="w-full sm:w-36 flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-slate-300">Categoria</label>
                    <select
                      value={newVarCategory}
                      onChange={(e) => setNewVarCategory(e.target.value as any)}
                      className="w-full h-9 px-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-amber-400"
                    >
                      <option value="combustivel">Combustível</option>
                      <option value="comida">Comida / Mercado</option>
                      <option value="farmacia">Farmácia</option>
                      <option value="manutencao">Manutenção Carro</option>
                      <option value="lazer">Lazer / Restaurante</option>
                      <option value="outros">Outros</option>
                    </select>
                  </div>

                  <div className="w-full sm:w-32 flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-slate-300">Valor (R$)</label>
                    <input
                      type="text"
                      placeholder="0,00"
                      value={newVarAmount}
                      onChange={(e) => setNewVarAmount(e.target.value)}
                      className="w-full h-9 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-white placeholder-slate-500 outline-none focus:border-amber-400"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full sm:w-auto h-9 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-xs cursor-pointer shrink-0"
                  >
                    <span className="material-symbols-outlined text-[15px]">check</span>
                    <span>Salvar</span>
                  </button>
                </form>
              )}

              {/* Lista de Despesas Variáveis */}
              {variableExpenses.length === 0 ? (
                <div className="p-8 text-center bg-slate-800/40 border border-slate-800 rounded-2xl">
                  <span className="material-symbols-outlined text-4xl text-slate-600 block mb-2">shopping_bag</span>
                  <p className="text-xs text-slate-400 font-semibold">
                    Nenhuma despesa variável lançada em {MONTH_NAMES[currentMonthIndex]}.
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Clique em "Nova Despesa do Mês" para registrar combustível, supermercado ou compras.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800 bg-slate-800/50 rounded-2xl border border-slate-800 overflow-hidden">
                  {variableExpenses.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 sm:p-3.5 flex items-center justify-between gap-3 hover:bg-slate-800/80 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 border border-amber-500/30">
                          <span className="material-symbols-outlined text-[16px]">
                            {item.category === 'combustivel' ? 'local_gas_station' : item.category === 'comida' ? 'restaurant' : 'receipt'}
                          </span>
                        </span>
                        <div className="min-w-0">
                          <h5 className="font-bold text-xs sm:text-sm text-slate-200 truncate">
                            {item.name}
                          </h5>
                          <span className="text-[10px] text-slate-400">
                            {item.category.toUpperCase()} • {item.paymentMethod} • {item.date}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-black text-sm sm:text-base text-amber-300">
                          R$ {item.amount.toFixed(2).replace('.', ',')}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteVariable(item.id)}
                          className="p-1 text-slate-500 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors cursor-pointer"
                          title="Remover"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ---------------------------------------------------------- */}
          {/* ABA 3: GASTOS DIÁRIOS (Lançamentos rápidos um por um)       */}
          {/* ---------------------------------------------------------- */}
          {activeTab === 'diarios' && (
            <div className="space-y-4">
              {/* Formulário Rápido de Lançamento */}
              <div className="bg-gradient-to-r from-purple-950/50 via-slate-900 to-purple-950/50 border border-purple-500/40 rounded-2xl p-3.5 sm:p-4 shadow-sm">
                <div className="flex items-center gap-2 pb-2 border-b border-purple-500/30 text-xs font-bold text-purple-300">
                  <span className="material-symbols-outlined text-[16px]">bolt</span>
                  <span>Lançamento Rápido no Dia a Dia (Um por Um)</span>
                </div>

                <form onSubmit={handleAddDailySubmit} className="mt-3 grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <div className="sm:col-span-4 flex flex-col gap-1">
                    <label className="text-[10.5px] font-semibold text-slate-300">O que você comprou / gastou?</label>
                    <input
                      type="text"
                      placeholder="Ex: Almoço, Café, Padaria, Farmácia..."
                      value={dailyDesc}
                      onChange={(e) => setDailyDesc(e.target.value)}
                      className="w-full h-9 px-3 bg-slate-900/90 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-purple-400"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2 flex flex-col gap-1">
                    <label className="text-[10.5px] font-semibold text-slate-300">Valor (R$)</label>
                    <input
                      type="text"
                      placeholder="0,00"
                      value={dailyAmount}
                      onChange={(e) => setDailyAmount(e.target.value)}
                      className="w-full h-9 px-3 bg-slate-900/90 border border-slate-700 rounded-xl text-xs font-mono text-white placeholder-slate-500 outline-none focus:border-purple-400"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2 flex flex-col gap-1">
                    <label className="text-[10.5px] font-semibold text-slate-300">Categoria</label>
                    <select
                      value={dailyCategory}
                      onChange={(e) => setDailyCategory(e.target.value)}
                      className="w-full h-9 px-2 bg-slate-900/90 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-purple-400"
                    >
                      <option value="Alimentação">Alimentação</option>
                      <option value="Combustível">Combustível</option>
                      <option value="Transporte">Transporte</option>
                      <option value="Farmácia">Farmácia</option>
                      <option value="Lazer">Lazer</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2 flex flex-col gap-1">
                    <label className="text-[10.5px] font-semibold text-slate-300">Data</label>
                    <input
                      type="date"
                      value={dailyDate}
                      onChange={(e) => setDailyDate(e.target.value)}
                      className="w-full h-9 px-2 bg-slate-900/90 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-purple-400"
                    />
                  </div>

                  <div className="sm:col-span-2 flex items-end">
                    <button
                      type="submit"
                      className="w-full h-9 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-md cursor-pointer transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px]">add</span>
                      <span>Lançar</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Lista dos Gastos Diários */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 px-1 font-semibold">
                  <span>Histórico de Gastos Diários ({dailyExpenses.length} itens)</span>
                  <span className="font-mono font-bold text-purple-300">
                    Soma Diários: R$ {totalDaily.toFixed(2).replace('.', ',')}
                  </span>
                </div>

                {dailyExpenses.length === 0 ? (
                  <div className="p-8 text-center bg-slate-800/40 border border-slate-800 rounded-2xl">
                    <span className="material-symbols-outlined text-4xl text-slate-600 block mb-2">today</span>
                    <p className="text-xs text-slate-400 font-semibold">Nenhum gasto diário registrado neste mês.</p>
                    <p className="text-[11px] text-slate-500 mt-1">Use o formulário acima para registrar pequenos gastos do dia a dia.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/80 bg-slate-800/50 rounded-2xl border border-slate-800 overflow-hidden">
                    {dailyExpenses.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 sm:p-3.5 flex items-center justify-between gap-3 hover:bg-slate-800/80 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0 border border-purple-500/30">
                            <span className="material-symbols-outlined text-[16px]">shopping_cart</span>
                          </span>
                          <div className="min-w-0">
                            <h5 className="font-bold text-xs sm:text-sm text-slate-200 truncate">
                              {item.description}
                            </h5>
                            <span className="text-[10px] text-slate-400">
                              {item.category} • {item.date} • {item.paymentMethod}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono font-black text-sm text-purple-300">
                            R$ {item.amount.toFixed(2).replace('.', ',')}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteDaily(item.id)}
                            className="p-1 text-slate-500 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors cursor-pointer"
                            title="Excluir Gasto"
                          >
                            <span className="material-symbols-outlined text-[15px]">delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* ============================================================ */}
        {/* 5. RODAPÉ DO MODAL                                           */}
        {/* ============================================================ */}
        <div className="shrink-0 bg-slate-950 border-t border-slate-800 px-4 py-3 sm:px-6 flex items-center justify-between flex-wrap gap-2 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Dados salvos e sincronizados automaticamente na nuvem.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold cursor-pointer transition-colors"
          >
            Fechar Janela
          </button>
        </div>

      </div>
    </div>
  );
};
