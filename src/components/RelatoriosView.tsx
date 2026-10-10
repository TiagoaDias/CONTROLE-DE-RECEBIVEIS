import React, { useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { ScreenTab, Debtor, Purchase, Installment } from '../types';
import { INITIAL_DEBTORS, INITIAL_PURCHASES, INITIAL_INSTALLMENTS } from '../data/mockData';
import { generateHaspahoLogoPngDataUrl } from '../utils/logoPdfHelper';
import { getCleanDebtorAvatar } from './DebtorsMasterSpreadsheet';

interface RelatoriosViewProps {
  debtors?: Debtor[];
  purchases?: Purchase[];
  installments?: Installment[];
  initialDebtorId?: string;
  onNavigate: (tab: ScreenTab) => void;
  onToast: (msg: string) => void;
}

const MONTH_NAMES = [
  { key: '01', short: 'Jan', full: 'Janeiro 2026' },
  { key: '02', short: 'Fev', full: 'Fevereiro 2026' },
  { key: '03', short: 'Mar', full: 'Março 2026' },
  { key: '04', short: 'Abr', full: 'Abril 2026' },
  { key: '05', short: 'Mai', full: 'Maio 2026' },
  { key: '06', short: 'Jun', full: 'Junho 2026' },
  { key: '07', short: 'Jul', full: 'Julho 2026' },
  { key: '08', short: 'Ago', full: 'Agosto 2026' },
  { key: '09', short: 'Set', full: 'Setembro 2026', isCurrent: true },
  { key: '10', short: 'Out', full: 'Outubro 2026' },
  { key: '11', short: 'Nov', full: 'Novembro 2026' },
  { key: '12', short: 'Dez', full: 'Dezembro 2026' },
];

export const RelatoriosView: React.FC<RelatoriosViewProps> = ({
  debtors = [],
  purchases = [],
  installments = [],
  initialDebtorId,
  onNavigate,
  onToast,
}) => {
  // Seletor de Devedor: ID do devedor individual
  const [selectedDebtorId, setSelectedDebtorId] = useState<string>(
    initialDebtorId !== undefined ? initialDebtorId : 'all'
  );
  const [reportPeriod, setReportPeriod] = useState<'2026' | 'q3' | 'sept' | 'all'>('2026');
  const [activeChartTab, setActiveChartTab] = useState<'comparative' | 'surplus'>('comparative');
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>('09'); // Setembro
  const [downloadingType, setDownloadingType] = useState<'pdf' | 'excel' | 'csv' | null>(null);

  // Estados para a janela inteligente interativa de detalhes (Regra A, B, C)
  const [reportModalData, setReportModalData] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    type: 'faturado' | 'liquidado' | 'a_vencer' | 'atrasado' | 'mes_serie' | null;
    monthKey?: string;
  }>({
    isOpen: false,
    title: '',
    description: '',
    type: null,
  });

  const [modalSearch, setModalSearch] = useState('');
  const [modalStatusFilter, setModalStatusFilter] = useState<'all' | 'paid' | 'overdue' | 'ontime'>('all');
  const [modalSortOrder, setModalSortOrder] = useState<'date_desc' | 'amount_desc' | 'name_asc'>('date_desc');

  // Estados de expansão para a árvore ramificada interativa de fluxo de caixa
  const [treeExpandedNodes, setTreeExpandedNodes] = useState<{ [key: string]: boolean }>({
    root: true,
    paid: false,
    open: false,
    ontime: false,
    late: false
  });

  const toggleTreeNode = (nodeKey: string) => {
    setTreeExpandedNodes(prev => ({
      ...prev,
      [nodeKey]: !prev[nodeKey]
    }));
  };

  // Devedor selecionado
  const selectedDebtor = useMemo(() => {
    if (selectedDebtorId === 'all') return null;
    return debtors.find((d) => d.id === selectedDebtorId) || null;
  }, [debtors, selectedDebtorId]);

  // Parcelas filtradas conforme o devedor selecionado
  const filteredInstallments = useMemo(() => {
    if (!selectedDebtor) return installments;
    const currentName = (selectedDebtor.name || '').toLowerCase();
    return installments.filter(
      (inst) =>
        inst.debtorId === selectedDebtor.id ||
        (inst.debtorName && (inst.debtorName || '').toLowerCase() === currentName)
    );
  }, [installments, selectedDebtor]);

  const modalFilteredInstallments = useMemo(() => {
    let items = filteredInstallments;

    if (reportModalData.type === 'liquidado') {
      items = items.filter(i => i.status === 'paid');
    } else if (reportModalData.type === 'atrasado') {
      items = items.filter(i => i.status === 'overdue');
    } else if (reportModalData.type === 'a_vencer') {
      items = items.filter(i => i.status !== 'paid' && i.status !== 'overdue');
    } else if (reportModalData.type === 'mes_serie' && reportModalData.monthKey) {
      items = items.filter(i => getMonthPart(i.dueDate) === reportModalData.monthKey);
    }

    if (modalStatusFilter !== 'all') {
      if (modalStatusFilter === 'paid') items = items.filter(i => i.status === 'paid');
      if (modalStatusFilter === 'overdue') items = items.filter(i => i.status === 'overdue');
      if (modalStatusFilter === 'ontime') items = items.filter(i => i.status !== 'paid' && i.status !== 'overdue');
    }

    if (modalSearch.trim()) {
      const q = modalSearch.toLowerCase();
      items = items.filter(i => 
        (i.debtorName && i.debtorName.toLowerCase().includes(q)) ||
        (i.product && i.product.toLowerCase().includes(q)) ||
        (i.dueDate && i.dueDate.includes(q)) ||
        (i.authCode && i.authCode.toLowerCase().includes(q))
      );
    }

    return [...items].sort((a, b) => {
      if (modalSortOrder === 'amount_desc') return b.amount - a.amount;
      if (modalSortOrder === 'name_asc') return (a.debtorName || '').localeCompare(b.debtorName || '');
      return (b.dueDate || '').localeCompare(a.dueDate || '');
    });
  }, [filteredInstallments, reportModalData, modalStatusFilter, modalSearch, modalSortOrder]);

  // Compras filtradas conforme o devedor selecionado
  const filteredPurchases = useMemo(() => {
    if (!selectedDebtor) return purchases;
    const currentName = (selectedDebtor.name || '').toLowerCase();
    return purchases.filter(
      (p) =>
        p.debtorId === selectedDebtor.id ||
        (p.debtorName && (p.debtorName || '').toLowerCase() === currentName)
    );
  }, [purchases, selectedDebtor]);

  // Cálculos financeiros dinâmicos (individuais ou globais)
  const totalInvoiced = useMemo(() => {
    if (selectedDebtor) {
      const sumInst = filteredInstallments.reduce((acc, curr) => acc + (curr.amount || curr.originalAmount || 0), 0);
      return sumInst > 0 ? sumInst : selectedDebtor.totalOwed + selectedDebtor.totalPaid;
    }
    return installments.reduce((acc, curr) => acc + (curr.amount || curr.originalAmount || 0), 0);
  }, [selectedDebtor, filteredInstallments, installments]);

  const totalPaid = useMemo(() => {
    if (selectedDebtor) {
      const sumPaid = filteredInstallments
        .filter((i) => i.status === 'paid')
        .reduce((acc, curr) => acc + (curr.paidAmount || curr.amount || curr.originalAmount || 0), 0);
      return sumPaid > 0 ? sumPaid : selectedDebtor.totalPaid;
    }
    return installments
      .filter((i) => i.status === 'paid')
      .reduce((acc, curr) => acc + (curr.paidAmount || curr.amount || curr.originalAmount || 0), 0);
  }, [selectedDebtor, filteredInstallments, installments]);

  const totalOverdue = useMemo(() => {
    if (selectedDebtor) {
      return filteredInstallments
        .filter((i) => i.status === 'overdue')
        .reduce((acc, curr) => acc + (curr.amount || curr.originalAmount || 0), 0);
    }
    return installments
      .filter((i) => i.status === 'overdue')
      .reduce((acc, curr) => acc + (curr.amount || curr.originalAmount || 0), 0);
  }, [selectedDebtor, filteredInstallments, installments]);

  const totalOntime = Math.max(0, totalInvoiced - totalPaid - totalOverdue);

  const punctualityPercent = useMemo(() => {
    if (selectedDebtor) {
      if (selectedDebtor.score) return Math.min(100, Math.round(selectedDebtor.score / 10));
      return Math.round(((totalPaid + totalOntime) / (totalInvoiced || 1)) * 100);
    }
    return Math.round(((totalPaid + totalOntime) / (totalInvoiced || 1)) * 100);
  }, [selectedDebtor, totalPaid, totalOntime, totalInvoiced]);

  // Helper seguro para extrair mês da data
  const getMonthPart = (dueDate?: string) => {
    if (!dueDate || typeof dueDate !== 'string') return '';
    const parts = dueDate.includes('/') ? dueDate.split('/') : dueDate.split('-');
    return parts.length > 1 ? parts[1] : '';
  };

  // Série mensal calculada especificamente para este devedor (ou global)
  const monthlyDataSeries = useMemo(() => {
    return MONTH_NAMES.slice(4, 12).map((m) => {
      // Filtrar parcelas cujo vencimento seja neste mês
      const monthInsts = filteredInstallments.filter((inst) => {
        return getMonthPart(inst.dueDate) === m.key;
      });

      const totalMonth = monthInsts.reduce((acc, curr) => acc + (curr.amount || 0), 0);
      const paidMonth = monthInsts
        .filter((i) => i.status === 'paid')
        .reduce((acc, curr) => acc + (curr.amount || 0), 0);
      const pendingMonth = totalMonth - paidMonth;

      const simulatedTotal = totalMonth;
      const outflowEstimated = totalMonth > 0 ? Math.round(simulatedTotal * 0.88) : 0;
      const surplus = Math.max(0, simulatedTotal - outflowEstimated);

      return {
        month: m.short,
        key: m.key,
        fullName: m.full,
        isCurrent: m.isCurrent,
        inflow: simulatedTotal,
        paid: paidMonth,
        pending: pendingMonth,
        outflow: outflowEstimated,
        surplus: surplus,
        installmentsCount: monthInsts.length,
      };
    });
  }, [filteredInstallments, selectedDebtor, totalInvoiced]);

  // Série dos últimos 6 meses (Abril a Setembro de 2026) comparando Previstos vs. Realizados
  const last6MonthsData = useMemo(() => {
    // Meses 04 a 09: Abr, Mai, Jun, Jul, Ago, Set
    const sixMonths = MONTH_NAMES.slice(3, 9);

    return sixMonths.map((m) => {
      // Buscar parcelas vinculadas a este mês de vencimento
      const monthInsts = filteredInstallments.filter((inst) => {
        return getMonthPart(inst.dueDate) === m.key;
      });

      const previstoInst = monthInsts.reduce((acc, curr) => acc + (curr.amount || curr.originalAmount || 0), 0);
      const realizadoInst = monthInsts
        .filter((i) => i.status === 'paid')
        .reduce((acc, curr) => acc + (curr.paidAmount || curr.amount || curr.originalAmount || 0), 0);

      const previsto = previstoInst;
      const realizado = realizadoInst;

      const pendente = Math.max(0, previsto - realizado);
      const taxaRealizacao = previsto > 0 ? Math.min(100, Math.round((realizado / previsto) * 100)) : 100;

      return {
        monthKey: m.key,
        monthLabel: m.short,
        fullName: m.full,
        isCurrent: !!m.isCurrent,
        previsto: Math.round(previsto * 100) / 100,
        realizado: Math.round(realizado * 100) / 100,
        pendente: Math.round(pendente * 100) / 100,
        taxaRealizacao,
        installmentsCount: monthInsts.length,
        hasOverdue: monthInsts.some((i) => i.status === 'overdue'),
      };
    });
  }, [filteredInstallments, selectedDebtor, filteredPurchases]);

  // Totais consolidados dos últimos 6 meses
  const sixMonthsMetrics = useMemo(() => {
    const totalPrevisto = last6MonthsData.reduce((acc, curr) => acc + curr.previsto, 0);
    const totalRealizado = last6MonthsData.reduce((acc, curr) => acc + curr.realizado, 0);
    const totalPendente = Math.max(0, totalPrevisto - totalRealizado);
    const taxaGlobal = totalPrevisto > 0 ? Math.round((totalRealizado / totalPrevisto) * 100) : 100;
    return {
      totalPrevisto,
      totalRealizado,
      totalPendente,
      taxaGlobal,
    };
  }, [last6MonthsData]);

  const selected6MonthsItem = useMemo(() => {
    return (
      last6MonthsData.find((m) => m.monthKey === selectedMonthKey) ||
      last6MonthsData[last6MonthsData.length - 1]
    );
  }, [last6MonthsData, selectedMonthKey]);

  const currentSelectedMonthData =
    monthlyDataSeries.find((m) => m.key === selectedMonthKey) || monthlyDataSeries[4];

  // Métricas do Mês Corrente (Previsto vs. Realizado) para o Resumo de Recebimentos
  const currentMonthMetrics = useMemo(() => {
    const monthInsts = filteredInstallments.filter((inst) => {
      if (!inst.dueDate) return false;
      const parts = inst.dueDate.includes('/') ? inst.dueDate.split('/') : inst.dueDate.split('-');
      const monthPart = parts.length > 1 ? parts[1] : '';
      return monthPart === '09';
    });

    const calcPrevisto = monthInsts.reduce(
      (acc, curr) => acc + (curr.amount || curr.originalAmount || 0),
      0
    );
    const calcRealizado = monthInsts
      .filter((i) => i.status === 'paid')
      .reduce((acc, curr) => acc + (curr.paidAmount || curr.amount || curr.originalAmount || 0), 0);

    const totalPrevisto = calcPrevisto;
    const totalRealizado = calcRealizado;
    const totalPendente = Math.max(0, totalPrevisto - totalRealizado);
    const taxaRealizacao = totalPrevisto > 0 ? Math.round((totalRealizado / totalPrevisto) * 100) : 0;

    const chartData = [
      {
        name: 'Sem 1 (01-07)',
        previsto: Math.round(totalPrevisto * 0.22),
        realizado: Math.round(totalRealizado * 0.26),
      },
      {
        name: 'Sem 2 (08-14)',
        previsto: Math.round(totalPrevisto * 0.36),
        realizado: Math.round(totalRealizado * 0.34),
      },
      {
        name: 'Sem 3 (15-21)',
        previsto: Math.round(totalPrevisto * 0.24),
        realizado: Math.round(totalRealizado * 0.25),
      },
      {
        name: 'Sem 4 (22-30)',
        previsto: Math.round(totalPrevisto * 0.18),
        realizado: Math.round(totalRealizado * 0.15),
      },
    ];

    const totalParc = monthInsts.length;
    const totalPagas = monthInsts.filter((i) => i.status === 'paid').length;

    return {
      totalPrevisto,
      totalRealizado,
      totalPendente,
      taxaRealizacao,
      chartData,
      totalParc,
      totalPagas,
    };
  }, [filteredInstallments]);

  // Utilitário para acionar download de arquivo Blob no navegador
  const triggerBrowserDownload = (blob: Blob, filename: string) => {
    try {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(url), 2000);
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        const link = document.createElement('a');
        link.href = reader.result as string;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      };
      reader.readAsDataURL(blob);
    }
  };

  // =========================================================================
  // 1. GERADOR E DOWNLOAD REAL DE EXTRATO PDF INDIVIDUAL DO DEVEDOR (jsPDF)
  // =========================================================================
  const handleDownloadPdf = async () => {
    try {
      setDownloadingType('pdf');
      const debtorLabel = selectedDebtor ? selectedDebtor.name : 'Consolidado_Geral';
      onToast(`Gerando Extrato PDF Individual para ${selectedDebtor ? selectedDebtor.name : 'todos os devedores'}...`);

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
      const margin = 14;

      // Inserir Logo HASPAHO
      try {
        const logoDataUrl = await generateHaspahoLogoPngDataUrl();
        doc.addImage(logoDataUrl, 'PNG', margin, 12, 46, 20);
      } catch (err) {
        console.warn('Logo no PDF não carregada:', err);
      }

      // Cabeçalho institucional do relatório
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      if (selectedDebtor) {
        doc.text('HASPAHO • EXTRATO FINANCEIRO INDIVIDUAL DO DEVEDOR', margin + 50, 17);
      } else {
        doc.text('HASPAHO • RELATÓRIO FINANCEIRO CONSOLIDADO', margin + 50, 17);
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      if (selectedDebtor) {
        doc.text(`Demonstrativo Oficial de Quitação, Parcelas & Conciliação de Dívida`, margin + 50, 22.5);
        doc.text(`Devedor: ${selectedDebtor.name} • WhatsApp: ${selectedDebtor.phone || 'Não informado'}`, margin + 50, 27.5);
        doc.text(`Emissão: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • Exercício: 2026`, margin + 50, 32);
      } else {
        doc.text('Auditoria Geral de Recebíveis, Liquidações e Projeção de Faturas de Cartão', margin + 50, 23);
        doc.text(`Emissão: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • Exercício: 2026`, margin + 50, 28.5);
      }

      // Linha divisória
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(margin, 36, pageWidth - margin, 36);

      // Caixa 1: Dados do Devedor (se selecionado)
      let currentY = 40;
      if (selectedDebtor) {
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(margin, currentY, pageWidth - margin * 2, 22, 2, 2, 'F');
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(margin, currentY, pageWidth - margin * 2, 22, 2, 2, 'S');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text('NOME COMPLETO DO DEVEDOR', margin + 5, currentY + 6);
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(selectedDebtor.name, margin + 5, currentY + 12);
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text(`Vínculo: ${selectedDebtor.relation || 'Cliente'} • Chave PIX: ${selectedDebtor.pixKey || selectedDebtor.phone}`, margin + 5, currentY + 17.5);

        // Score & Status no lado direito
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text('SCORE DE PONTUALIDADE', margin + 115, currentY + 6);
        doc.setFontSize(11);
        doc.setTextColor(selectedDebtor.overdueCount > 0 ? 220 : 5, selectedDebtor.overdueCount > 0 ? 38 : 150, selectedDebtor.overdueCount > 0 ? 38 : 105);
        doc.text(`${selectedDebtor.score || 850} pts (${selectedDebtor.scoreTier || 'Regular'})`, margin + 115, currentY + 12);
        doc.setFontSize(7.5);
        doc.setTextColor(selectedDebtor.overdueCount > 0 ? 220 : 5, selectedDebtor.overdueCount > 0 ? 38 : 150, selectedDebtor.overdueCount > 0 ? 38 : 105);
        doc.text(selectedDebtor.statusLabel || 'Situação Regular', margin + 115, currentY + 17.5);

        currentY += 26;
      }

      // Caixa 2: Indicadores Chave (KPIs)
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, currentY, pageWidth - margin * 2, 24, 2, 2, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(margin, currentY, pageWidth - margin * 2, 24, 2, 2, 'S');

      // Coluna 1 KPI: Total Faturado
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(selectedDebtor ? 'TOTAL CONTRATADO' : 'TOTAL GERAL FATURADO', margin + 5, currentY + 6);
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text(`R$ ${totalInvoiced.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin + 5, currentY + 14);
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text(selectedDebtor ? 'Volume total em compras' : '100% dos Contratos', margin + 5, currentY + 19.5);

      // Coluna 2 KPI: Total Liquidado
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('TOTAL LIQUIDADO (PAGO)', margin + 52, currentY + 6);
      doc.setFontSize(12);
      doc.setTextColor(5, 150, 105);
      doc.text(`R$ ${totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin + 52, currentY + 14);
      doc.setFontSize(7);
      doc.text(`${Math.round((totalPaid / (totalInvoiced || 1)) * 100)}% Liquidado em Conta`, margin + 52, currentY + 19.5);

      // Coluna 3 KPI: A Vencer
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('SALDO A VENCER', margin + 104, currentY + 6);
      doc.setFontSize(12);
      doc.setTextColor(37, 99, 235);
      doc.text(`R$ ${totalOntime.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin + 104, currentY + 14);
      doc.setFontSize(7);
      doc.text('Dentro do Prazo Legal', margin + 104, currentY + 19.5);

      // Coluna 4 KPI: Em Atraso
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('EM ATRASO (VENCIDO)', margin + 146, currentY + 6);
      doc.setFontSize(12);
      doc.setTextColor(totalOverdue > 0 ? 220 : 100, totalOverdue > 0 ? 38 : 116, totalOverdue > 0 ? 38 : 139);
      doc.text(`R$ ${totalOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin + 146, currentY + 14);
      doc.setFontSize(7);
      doc.text(totalOverdue > 0 ? 'Sujeito a juros e multa' : 'Nenhuma pendência', margin + 146, currentY + 19.5);

      currentY += 29;

      // Seção 3: Tabela Detalhada de Parcelas do Devedor
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      if (selectedDebtor) {
        doc.text(`CRONOGRAMA DE PARCELAS INDIVIDUAL: ${selectedDebtor.name.toUpperCase()}`, margin, currentY);
      } else {
        doc.text('CONCILIAÇÃO GERAL DE PARCELAS', margin, currentY);
      }

      currentY += 4;
      doc.setFillColor(15, 23, 42);
      doc.rect(margin, currentY, pageWidth - margin * 2, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7.5);
      doc.text('PARCELA', margin + 3, currentY + 4.8);
      doc.text('PRODUTO / CONTRATO', margin + 30, currentY + 4.8);
      doc.text('VENCIMENTO', margin + 85, currentY + 4.8);
      doc.text('VALOR (R$)', margin + 115, currentY + 4.8);
      doc.text('STATUS', margin + 142, currentY + 4.8);
      doc.text('AUTENTICAÇÃO BANCÁRIA', margin + 163, currentY + 4.8);

      currentY += 7;
      doc.setFont('helvetica', 'normal');

      const installmentsToPrint = filteredInstallments.slice(0, 24);
      installmentsToPrint.forEach((inst, idx) => {
        const bg = idx % 2 === 0 ? 255 : 249;
        doc.setFillColor(bg, bg, bg);
        doc.rect(margin, currentY, pageWidth - margin * 2, 6.2, 'F');
        doc.setDrawColor(241, 245, 249);
        doc.line(margin, currentY + 6.2, pageWidth - margin, currentY + 6.2);

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(7);
        doc.text(`#${inst.installmentNumber}/${inst.totalInstallments}`, margin + 3, currentY + 4.3);
        doc.text(inst.product.slice(0, 30), margin + 30, currentY + 4.3);
        doc.text(inst.dueDate, margin + 85, currentY + 4.3);
        doc.text(`R$ ${(Number(inst?.amount) || 0).toFixed(2).replace('.', ',')}`, margin + 115, currentY + 4.3);

        if (inst.status === 'paid') {
          doc.setTextColor(5, 150, 105);
          doc.setFont('helvetica', 'bold');
          doc.text('PAGO', margin + 142, currentY + 4.3);
        } else if (inst.status === 'overdue') {
          doc.setTextColor(220, 38, 38);
          doc.setFont('helvetica', 'bold');
          doc.text(`ATRASO (${inst.delayDays || 9}d)`, margin + 142, currentY + 4.3);
        } else {
          doc.setTextColor(100, 116, 139);
          doc.setFont('helvetica', 'normal');
          doc.text('EM DIA', margin + 142, currentY + 4.3);
        }

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        doc.text(inst.authCode ? inst.authCode.slice(0, 12) : 'E182361282...', margin + 163, currentY + 4.3);

        currentY += 6.2;
      });

      // Termo de Declaração / Quitação
      currentY += 8;
      if (currentY < 265) {
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(margin, currentY, pageWidth - margin * 2, 16, 1.5, 1.5, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(margin, currentY, pageWidth - margin * 2, 16, 1.5, 1.5, 'S');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text('DECLARAÇÃO DE CONCILIAÇÃO & AUTENTICIDADE:', margin + 4, currentY + 5);
        doc.text(
          `Este documento individual reflete a posição fiduciária de ${selectedDebtor ? selectedDebtor.name : 'todos os devedores'} na presente data. ` +
          `Os pagamentos identificados como "PAGO" possuem autenticação eletrônica via Asaas IP / BACEN. ` +
          `Para quitação de parcelas vincendas ou em atraso, utilize a chave PIX informada.`,
          margin + 4,
          currentY + 9,
          { maxWidth: pageWidth - margin * 2 - 8 }
        );
      }

      // Rodapé
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, 283, pageWidth - margin, 283);
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `HASPAHO • Extrato Individual Gerado Eletronicamente • Validação Asaas IP • ID: ${selectedDebtor?.id || 'GLOBAL'}`,
        margin,
        287
      );
      doc.text('Página 1 de 1', pageWidth - margin - 18, 287);

      // Disparar Download
      const safeName = (selectedDebtor?.name || 'Consolidado_Geral').replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `Extrato_Individual_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`;
      const pdfBlob = doc.output('blob');
      triggerBrowserDownload(pdfBlob, filename);

      onToast(`Download do PDF individual (${selectedDebtor?.name || 'Geral'}) concluído com sucesso!`);
    } catch (error) {
      console.error('Erro ao gerar PDF individual:', error);
      onToast('Erro ao processar o arquivo PDF. Tente novamente.');
    } finally {
      setDownloadingType(null);
    }
  };

  // =========================================================================
  // 2. GERADOR E DOWNLOAD REAL DE PLANILHA EXCEL INDIVIDUAL (.xlsx)
  // =========================================================================
  const handleDownloadExcel = () => {
    try {
      setDownloadingType('excel');
      const debtorLabel = selectedDebtor ? selectedDebtor.name : 'Todos';
      onToast(`Criando planilha Excel individual para ${debtorLabel}...`);

      const workbook = XLSX.utils.book_new();

      // Aba 1: Resumo Individual do Devedor
      const resumoData = [
        [`HASPAHO - EXTRATO FINANCEIRO INDIVIDUAL: ${selectedDebtor ? selectedDebtor.name.toUpperCase() : 'CONSOLIDADO'}`],
        ['Data de Emissão:', new Date().toLocaleString('pt-BR')],
        ['Exercício Fiscal:', '2026'],
        [''],
        ['DADOS DO DEVEDOR'],
        ['Nome Completo:', selectedDebtor ? selectedDebtor.name : 'Consolidado Todos os Devedores'],
        ['CPF / CNPJ:', selectedDebtor?.documentNumber || 'Não informado'],
        ['WhatsApp / Telefone:', selectedDebtor?.phone || 'Não informado'],
        ['Grau de Vínculo:', selectedDebtor?.relation || 'Cliente'],
        ['Score de Pontualidade:', selectedDebtor ? `${selectedDebtor.score} pts` : '950 pts'],
        ['Situação Cadastral:', selectedDebtor?.statusLabel || 'Regular'],
        [''],
        ['POSIÇÃO FINANCEIRA DO DEVEDOR', 'VALOR (R$)', 'STATUS'],
        ['Total Contratado / Compras', totalInvoiced, '100% da carteira'],
        ['Total Liquidado (Pago)', totalPaid, 'Creditado em conta'],
        ['Saldo Aberto a Vencer', totalOntime, 'Dentro do prazo legal'],
        ['Saldo em Atraso (Vencido)', totalOverdue, totalOverdue > 0 ? 'Cobrança Ativa' : 'Sem atrasos'],
      ];
      const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
      XLSX.utils.book_append_sheet(workbook, wsResumo, 'Resumo do Devedor');

      // Aba 2: Cronograma Individual de Parcelas
      const parcelasRows = filteredInstallments.map((inst) => ({
        'ID Parcela': inst.id,
        'Devedor': inst.debtorName,
        'Produto / Aquisição': inst.product,
        'Cartão Emissor': inst.cardName,
        'Nº Parcela': `${inst.installmentNumber}/${inst.totalInstallments}`,
        'Data Vencimento': inst.dueDate,
        'Valor da Parcela (R$)': inst.amount,
        'Status Atual':
          inst.status === 'paid'
            ? 'PAGO'
            : inst.status === 'overdue'
            ? `EM ATRASO (${inst.delayDays || 0} dias)`
            : 'EM DIA',
        'Dias de Atraso': inst.delayDays || 0,
        'Autenticação Bancária (Asaas)': inst.authCode || 'E182361282...',
      }));
      const wsParcelas = XLSX.utils.json_to_sheet(parcelasRows);
      XLSX.utils.book_append_sheet(workbook, wsParcelas, 'Cronograma de Parcelas');

      // Aba 3: Compras & Contratos
      const comprasRows = filteredPurchases.map((p) => ({
        'ID Compra': p.id,
        'Devedor': p.debtorName,
        'Produto / Aquisição': p.product,
        'Loja / Estabelecimento': p.store,
        'Valor Total (R$)': p.totalAmount,
        'Total de Parcelas': p.installmentsTotal,
        'Valor da Parcela (R$)': p.installmentValue,
        'Parcelas Pagas': p.paidCount,
        'Parcelas Pendentes': p.pendingCount,
        'Próximo Vencimento': p.nextDueDate,
        'Cartão Utilizado': p.cardName,
        'Status': p.overdueCount > 0 ? 'EM ATRASO' : p.pendingCount === 0 ? 'QUITADO' : 'ATIVO',
      }));
      const wsCompras = XLSX.utils.json_to_sheet(comprasRows);
      XLSX.utils.book_append_sheet(workbook, wsCompras, 'Contratos e Compras');

      // Gerar arquivo XLSX binário
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const safeName = (selectedDebtor?.name || 'Consolidado_Geral').replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `Extrato_Individual_${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      triggerBrowserDownload(blob, filename);

      onToast(`Download do Excel individual (${selectedDebtor?.name || 'Geral'}) concluído com sucesso!`);
    } catch (error) {
      console.error('Erro ao gerar Excel:', error);
      onToast('Erro ao exportar planilha Excel individual.');
    } finally {
      setDownloadingType(null);
    }
  };

  // =========================================================================
  // 3. GERADOR E DOWNLOAD REAL DE ARQUIVO CSV INDIVIDUAL (.csv)
  // =========================================================================
  const handleDownloadCsv = () => {
    try {
      setDownloadingType('csv');
      onToast(`Exportando CSV individual para ${selectedDebtor ? selectedDebtor.name : 'todos'}...`);

      const headers = [
        'ID Parcela',
        'Devedor',
        'Produto',
        'Cartao',
        'Nº Parcela',
        'Vencimento',
        'Valor (R$)',
        'Status',
        'Dias Atraso',
        'Autenticacao Bancaria',
      ];

      const rows = filteredInstallments.map((inst) => [
        inst.id,
        inst.debtorName,
        inst.product,
        inst.cardName,
        `${inst.installmentNumber}/${inst.totalInstallments}`,
        inst.dueDate,
        (Number(inst?.amount) || 0).toFixed(2).replace('.', ','),
        inst.status === 'paid' ? 'PAGO' : inst.status === 'overdue' ? 'ATRASADO' : 'EM DIA',
        inst.delayDays || 0,
        inst.authCode || '',
      ]);

      const csvContent =
        '\uFEFF' +
        [headers, ...rows]
          .map((row) =>
            row
              .map((val) => `"${String(val).replace(/"/g, '""')}"`)
              .join(';')
          )
          .join('\r\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const safeName = (selectedDebtor?.name || 'Consolidado_Geral').replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `Extrato_Individual_${safeName}_${new Date().toISOString().slice(0, 10)}.csv`;
      triggerBrowserDownload(blob, filename);

      onToast(`Download do CSV individual (${selectedDebtor?.name || 'Geral'}) concluído com sucesso!`);
    } catch (error) {
      console.error('Erro ao gerar CSV individual:', error);
      onToast('Erro ao exportar arquivo CSV.');
    } finally {
      setDownloadingType(null);
    }
  };

  // Altura máxima para barras do gráfico
  const maxBarValue = useMemo(() => {
    const maxVal = Math.max(...monthlyDataSeries.map((m) => m.inflow), 100);
    return Math.max(1200, Math.ceil(maxVal * 1.25));
  }, [monthlyDataSeries]);

  return (
    <div className="flex flex-col w-full pb-36 gap-5 animate-in fade-in">
      {/* ========================================================================= */}
      {/* CARD CENTRALIZADO: RESUMO DE RECEBIMENTOS (PREVISTO VS. REALIZADO RECHARTS) */}
      {/* ========================================================================= */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-4 sm:p-6 border border-white/60 shadow-md transition-all">
        {/* Cabeçalho do Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-2xs shrink-0">
              <span className="material-symbols-outlined text-[20px]">query_stats</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                  Resumo de Recebimentos &amp; Eficácia
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60 text-[10px] font-extrabold uppercase tracking-wide">
                  Mês Corrente
                </span>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                <span className="material-symbols-outlined text-[14px] text-blue-600">calendar_today</span>
                Setembro de 2026 • Total Previsto vs. Realizado
              </p>
            </div>
          </div>

          {/* Badge de Eficácia do Mês */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-semibold text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{currentMonthMetrics.taxaRealizacao}% Concluído</span>
            </div>
          </div>
        </div>

        {/* Corpo do Card: Grid com Métricas e Gráfico Recharts */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Lado Esquerdo: Mini Cards de Indicadores do Mês */}
          <div className="lg:col-span-4 flex flex-col justify-between gap-3">
            {/* 1. Total Previsto */}
            <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-100 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
                  Total Previsto
                </span>
                <div className="text-lg sm:text-xl font-black text-blue-900 tracking-tight mt-0.5">
                  R$ {currentMonthMetrics.totalPrevisto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <span className="text-[10px] text-blue-600 font-medium">
                  {currentMonthMetrics.totalParc} parcelas faturadas
                </span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <span className="material-symbols-outlined text-[18px]">calendar_month</span>
              </div>
            </div>

            {/* 2. Total Realizado */}
            <div className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-100 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                  Total Realizado
                </span>
                <div className="text-lg sm:text-xl font-black text-emerald-900 tracking-tight mt-0.5">
                  R$ {currentMonthMetrics.totalRealizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <span className="text-[10px] text-emerald-600 font-medium">
                  {currentMonthMetrics.totalPagas} quitadas em dia
                </span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
              </div>
            </div>

            {/* 3. Saldo Pendente */}
            <div className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-100 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                  Saldo Pendente
                </span>
                <div className="text-lg sm:text-xl font-black text-amber-950 tracking-tight mt-0.5">
                  R$ {currentMonthMetrics.totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <span className="text-[10px] text-amber-700 font-medium">
                  {Math.max(0, currentMonthMetrics.totalParc - currentMonthMetrics.totalPagas)} a vencer / em aberto
                </span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <span className="material-symbols-outlined text-[18px]">pending</span>
              </div>
            </div>

            {/* Barra de Progresso de Realização */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-600 text-[11px]">Eficácia de Cobrança</span>
                <span className="font-black text-slate-900 text-xs">{currentMonthMetrics.taxaRealizacao}%</span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, currentMonthMetrics.taxaRealizacao)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Lado Direito: Gráfico de Barras Recharts (Previsto vs. Realizado) */}
          <div className="lg:col-span-8 flex flex-col justify-between bg-slate-50/50 rounded-xl p-3 sm:p-4 border border-slate-200/60">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <span className="material-symbols-outlined text-[17px] text-blue-600">bar_chart</span>
                <span>Evolução por Semanas (Setembro 2026)</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-xs bg-blue-600 inline-block" />
                  Previsto
                </span>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
                  Realizado
                </span>
              </div>
            </div>

            {/* Container Recharts */}
            <div className="w-full h-56 sm:h-64 pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={currentMonthMetrics.chartData}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                  barGap={6}
                  barCategoryGap="25%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickFormatter={(val: number) => `R$ ${val}`}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      const prevVal = Number(payload.find((p) => p.dataKey === 'previsto')?.value || 0);
                      const realVal = Number(payload.find((p) => p.dataKey === 'realizado')?.value || 0);
                      return (
                        <div className="bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-xl shadow-xl border border-slate-700/80 text-xs min-w-[200px]">
                          <div className="font-bold text-slate-200 border-b border-slate-700 pb-1.5 mb-2 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[15px] text-blue-400">calendar_month</span>
                            <span>{label}</span>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-3">
                              <span className="flex items-center gap-1.5 text-slate-300">
                                <span className="w-2.5 h-2.5 rounded-xs bg-blue-500 shrink-0" />
                                Previsto:
                              </span>
                              <span className="font-bold text-white">
                                R$ {prevVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="flex items-center gap-1.5 text-slate-300">
                                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 shrink-0" />
                                Realizado:
                              </span>
                              <span className="font-bold text-emerald-400">
                                R$ {realVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-800 text-[11px]">
                              <span className="text-slate-400">Taxa do Período:</span>
                              <span className="font-extrabold text-blue-300">
                                {prevVal > 0 ? Math.round((realVal / prevVal) * 100) : 0}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="previsto"
                    name="Previsto"
                    fill="#2563eb"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                  <Bar
                    dataKey="realizado"
                    name="Realizado"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* 1. SELETOR DE DEVEDOR & CONTROLE DE ESCOPO */}
      <div className="bg-white/80 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        
        {/* Cabeçalho do Seletor */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                Extratos &amp; Relatórios Individuais
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Selecione um devedor para visualizar métricas, cronograma de parcelas e gerar o extrato individual
            </p>
          </div>

          {/* Seletor dropdown para troca rápida */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-bold text-slate-500 hidden sm:inline">Devedor:</span>
            <select
              value={selectedDebtorId}
              onChange={(e) => setSelectedDebtorId(e.target.value)}
              className="w-full sm:w-auto bg-slate-50 text-xs font-bold text-slate-900 px-3.5 py-2.5 rounded-xl border border-slate-300 shadow-2xs outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
            >
              <option value="all">🌐 Consolidado Geral (Todos os Devedores)</option>
              {debtors.map((deb) => (
                <option key={deb.id} value={deb.id}>
                  👤 {deb.name} • {(Number(deb.overdueCount) || 0) > 0 ? `(1 atrasada)` : `(R$ ${(Number(deb.totalOwed) || 0).toFixed(0)} pendente)`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Linha de Cartões / Chips Quadrados dos Devedores para clique imediato */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Escolha Rápida por Devedor
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              Toque no contato para abrir o extrato individual
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {/* Devedores individuais */}
            {debtors.map((deb) => {
              const isSelected = selectedDebtorId === deb.id;
              const hasOverdue = deb.overdueCount > 0;
              return (
                <button
                  key={deb.id}
                  type="button"
                  onClick={() => setSelectedDebtorId(deb.id)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? hasOverdue
                        ? 'bg-red-50/70 border-red-500 ring-2 ring-red-400/20 shadow-xs'
                        : 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-400/20 shadow-xs'
                      : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/80 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="relative shrink-0 flex items-center justify-center p-0.5 rounded-xl border border-cyan-400/40 bg-[#091a36]/60 shadow-xs">
                      <img
                        src={getCleanDebtorAvatar(deb.name, deb.avatar)}
                        alt={deb.name}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-full object-cover border-2 border-white ring-1 ring-slate-200 shadow-2xs shrink-0"
                        onError={(e) => {
                          const fb = getCleanDebtorAvatar(deb.name);
                          if (e.currentTarget.src !== fb) e.currentTarget.src = fb;
                        }}
                      />
                      {hasOverdue ? (
                        <span className="absolute -bottom-1 -right-0.5 w-4 h-4 rounded-full bg-red-600 flex items-center justify-center text-white ring-1.5 ring-white text-[9px] font-black shadow-xs z-10">
                          <span className="material-symbols-outlined text-[10px]">priority_high</span>
                        </span>
                      ) : (
                        <span className="absolute -bottom-1 -right-0.5 w-4 h-4 rounded-full bg-white flex items-center justify-center ring-1.5 ring-emerald-500 text-emerald-600 shadow-2xs z-10">
                          <span className="material-symbols-outlined text-[11px] block font-black">check</span>
                        </span>
                      )}
                    </div>
                    {hasOverdue ? (
                      <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[9px] font-black uppercase">
                        Atraso
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase">
                        Em dia
                      </span>
                    )}
                  </div>
                  <div className="mt-2">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-black text-slate-900 block truncate">
                        {deb.name}
                      </span>
                      <span className="w-3.5 h-3.5 rounded-full bg-[#1d9bf0] text-white flex items-center justify-center text-[8px] font-black shrink-0" title="Verificado Oficial">
                        ✓
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 block truncate font-medium mt-0.5">
                      {hasOverdue ? `${Number(deb.overdueCount) || 0} em atraso` : `${deb.relation || 'Cliente'} • R$ ${(Number(deb.totalOwed) || 0).toFixed(0)}`}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Card Resumo do Devedor Selecionado (Perfil Ativo) */}
        {selectedDebtor ? (
          <div className="bg-slate-50/90 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <img
                  src={getCleanDebtorAvatar(selectedDebtor.name, selectedDebtor.avatar)}
                  alt={selectedDebtor.name}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-cover border-2 border-white ring-1 ring-slate-200 shadow-xs shrink-0"
                  onError={(e) => {
                    const fb = getCleanDebtorAvatar(selectedDebtor.name);
                    if (e.currentTarget.src !== fb) e.currentTarget.src = fb;
                  }}
                />
                {selectedDebtor.overdueCount > 0 ? (
                  <span className="absolute -bottom-1 -right-0.5 w-5 h-5 rounded-full bg-red-600 flex items-center justify-center text-white ring-2 ring-white text-[10px] font-black z-10 shadow-xs">
                    <span className="material-symbols-outlined text-[12px]">priority_high</span>
                  </span>
                ) : (
                  <span className="absolute -bottom-1 -right-0.5 w-5 h-5 rounded-full bg-white flex items-center justify-center ring-1 ring-slate-100 text-emerald-600 shadow-xs z-10">
                    <span className="material-symbols-outlined text-[15px] block">check_circle</span>
                  </span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-black text-slate-900 text-base">
                    {selectedDebtor.name}
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                    {selectedDebtor.relation || 'Cliente'}
                  </span>
                  {selectedDebtor.overdueCount > 0 ? (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                      {selectedDebtor.overdueCount} {selectedDebtor.overdueCount === 1 ? 'Parcela Vencida' : 'Parcelas Vencidas'}
                    </span>
                  ) : (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Em Dia com os Pagamentos
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  WhatsApp: <strong className="text-slate-700">{selectedDebtor.phone}</strong> • Chave PIX: <strong className="text-slate-700">{selectedDebtor.pixKey || selectedDebtor.phone}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Score Pontualidade</span>
                <span className={`font-black text-sm ${selectedDebtor.overdueCount > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                  {selectedDebtor.score || 850} pontos ({selectedDebtor.scoreTier || 'Regular'})
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-200 text-xs text-blue-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 text-[18px]">info</span>
            <span>Exibindo visão consolidada de todos os devedores. Clique em um devedor acima para emitir o extrato individual dele.</span>
          </div>
        )}

      </div>

      {/* 2. Bento-Grid: 4 Cartões de Métricas (Individuais ou Globais) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total Contratado / Faturado */}
        <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between min-h-[145px] group hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {selectedDebtor ? 'Total Contratado' : 'Total Geral'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">payments</span>
            </div>
          </div>
          <div className="my-auto py-1">
            <span className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight block">
              R$ {totalInvoiced.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] sm:text-[11px] text-slate-500 font-semibold mt-0.5 block truncate">
              {selectedDebtor ? `${filteredPurchases.length || 1} compra(s) registrada(s)` : '100% dos contratos'}
            </span>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center gap-1 text-[10px] font-bold text-blue-600">
            <span className="material-symbols-outlined text-[14px]">receipt_long</span>
            <span>{selectedDebtor?.name ? selectedDebtor.name.split(' ')[0] : 'Todos Devedores'}</span>
          </div>
        </div>

        {/* Card 2: Total Liquidado (Pago) */}
        <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between min-h-[145px] group hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Liquidado
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
            </div>
          </div>
          <div className="my-auto py-1">
            <span className="text-lg sm:text-2xl font-black text-emerald-700 tracking-tight block">
              R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] sm:text-[11px] text-slate-500 font-semibold mt-0.5 block">
              {Math.round((totalPaid / (totalInvoiced || 1)) * 100)}% quitado em conta
            </span>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center gap-1 text-[10px] font-bold text-emerald-600">
            <span className="material-symbols-outlined text-[14px]">verified</span>
            <span>Pago pelo cliente</span>
          </div>
        </div>

        {/* Card 3: Saldo Aberto / A Vencer */}
        <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between min-h-[145px] group hover:border-indigo-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Saldo a Vencer
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">schedule</span>
            </div>
          </div>
          <div className="my-auto py-1">
            <span className="text-lg sm:text-2xl font-black text-slate-800 tracking-tight block">
              R$ {totalOntime.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] sm:text-[11px] text-slate-500 font-semibold mt-0.5 block">
              Parcelas no prazo legal
            </span>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center gap-1 text-[10px] font-bold text-indigo-600">
            <span className="material-symbols-outlined text-[14px]">event_repeat</span>
            <span>Próximas faturas</span>
          </div>
        </div>

        {/* Card 4: Inadimplência / Atraso */}
        <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between min-h-[145px] group hover:border-red-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Em Atraso
            </span>
            <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">warning</span>
            </div>
          </div>
          <div className="my-auto py-1">
            <span className="text-lg sm:text-2xl font-black text-red-600 tracking-tight block">
              R$ {totalOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] sm:text-[11px] text-slate-500 font-semibold mt-0.5 block">
              {totalOverdue > 0 ? '1 parcela pendente' : 'Sem atrasos'}
            </span>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center gap-1 text-[10px] font-bold text-red-600">
            <span className="material-symbols-outlined text-[14px]">notification_important</span>
            <span>{totalOverdue > 0 ? 'Multa diária' : 'Em conformidade'}</span>
          </div>
        </div>
      </div>

      {/* 3. GRÁFICO RECHARTS: Volume de Recebimentos Previstos vs. Realizados (Últimos 6 Meses) */}
      <div className="bg-white/80 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs flex flex-col gap-4">
        
        {/* Cabeçalho do Gráfico com KPIs Resumidos */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">bar_chart</span>
              </span>
              <h3 className="font-black text-slate-900 text-sm sm:text-base">
                Volume de Recebimentos: Previstos vs. Realizados
              </h3>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                Últimos 6 Meses
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {selectedDebtor
                ? `Comparativo mensal de parcelas faturadas vs. liquidadas por ${selectedDebtor.name} (Abril a Setembro de 2026)`
                : 'Comparativo mensal consolidado de recebíveis previstos vs. realizados em conta bancária (Abril a Setembro de 2026)'}
            </p>
          </div>

          {/* Cards Rápidos de Indicadores do Semestre */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="bg-blue-50/80 border border-blue-200/80 px-3 py-1.5 rounded-xl text-left">
              <span className="text-[9.5px] font-bold text-blue-700 block uppercase tracking-wider">Previsto (6M)</span>
              <span className="text-xs sm:text-sm font-black text-blue-950">
                R$ {sixMonthsMetrics.totalPrevisto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="bg-emerald-50/80 border border-emerald-200/80 px-3 py-1.5 rounded-xl text-left">
              <span className="text-[9.5px] font-bold text-emerald-700 block uppercase tracking-wider">Realizado (6M)</span>
              <span className="text-xs sm:text-sm font-black text-emerald-900">
                R$ {sixMonthsMetrics.totalRealizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-left">
              <span className="text-[9.5px] font-bold text-slate-500 block uppercase tracking-wider">Efetivação</span>
              <span className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-1">
                {sixMonthsMetrics.taxaGlobal}%
                <span className="material-symbols-outlined text-[14px] text-emerald-600">verified</span>
              </span>
            </div>

            {sixMonthsMetrics.totalPendente > 0 && (
              <div className="bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl text-left">
                <span className="text-[9.5px] font-bold text-red-600 block uppercase tracking-wider">Pendente</span>
                <span className="text-xs sm:text-sm font-black text-red-700">
                  R$ {sixMonthsMetrics.totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Seletor rápido de mês para navegação */}
        <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            <span className="text-[11px] font-bold text-slate-500 mr-1 hidden sm:inline">Mês em foco:</span>
            {last6MonthsData.map((m) => {
              const isSelected = selectedMonthKey === m.monthKey;
              return (
                <button
                  key={m.monthKey}
                  type="button"
                  onClick={() => setSelectedMonthKey(m.monthKey)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-2xs ring-2 ring-blue-400/30'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{m.monthLabel}</span>
                  {m.isCurrent && (
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-blue-600'}`} />
                  )}
                </button>
              );
            })}
          </div>

          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">touch_app</span>
            Toque nas barras ou botões para detalhar
          </span>
        </div>

        {/* Container do Gráfico Recharts */}
        <div className="w-full h-72 sm:h-80 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={last6MonthsData}
              margin={{ top: 15, right: 10, left: -5, bottom: 0 }}
              barGap={6}
              barCategoryGap="22%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="monthLabel"
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
                tick={{ fill: '#475569', fontSize: 12, fontWeight: 700 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickFormatter={(val: number) => {
                  const num = Number(val) || 0;
                  return num >= 1000 ? `R$ ${(num / 1000).toFixed(1)}k` : `R$ ${num}`;
                }}
              />
              <Tooltip
                cursor={{ fill: 'rgba(241, 245, 249, 0.7)' }}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const item = payload[0].payload;
                  return (
                    <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-xl shadow-xl border border-slate-700/80 text-xs min-w-[220px] animate-in fade-in">
                      <div className="flex items-center justify-between gap-2 border-b border-slate-700 pb-2 mb-2.5">
                        <div className="flex items-center gap-1.5 font-black text-sm">
                          <span className="material-symbols-outlined text-[16px] text-blue-400">calendar_month</span>
                          <span>{item.fullName}</span>
                        </div>
                        {item.isCurrent && (
                          <span className="px-1.5 py-0.2 rounded bg-blue-500/30 text-blue-300 text-[9px] font-black border border-blue-400/40">
                            Mês Atual
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                            <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 shrink-0" />
                            Previsto:
                          </span>
                          <span className="font-black text-white">
                            R$ {item.previsto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 shrink-0" />
                            Realizado:
                          </span>
                          <span className="font-black text-emerald-400">
                            R$ {item.realizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between gap-2 text-[11px]">
                          <span className="text-slate-400">Taxa de Realização:</span>
                          <span
                            className={`font-black px-1.5 py-0.5 rounded ${
                              item.taxaRealizacao === 100
                                ? 'bg-emerald-900/60 text-emerald-300'
                                : 'bg-amber-900/60 text-amber-300'
                            }`}
                          >
                            {item.taxaRealizacao}%
                          </span>
                        </div>

                        {item.pendente > 0 && (
                          <div className="flex items-center justify-between gap-2 text-[10.5px] text-red-400 font-bold bg-red-950/40 p-1.5 rounded-lg border border-red-800/40">
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px]">warning</span>
                              Pendente / Em atraso:
                            </span>
                            <span>
                              R$ {item.pendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }}
              />
              <Legend
                content={() => (
                  <div className="flex flex-wrap items-center justify-center gap-6 pt-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-sm bg-blue-500 shadow-2xs" />
                      <span className="font-bold text-slate-700">Recebimentos Previstos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-sm bg-emerald-500 shadow-2xs" />
                      <span className="font-bold text-slate-700">Recebimentos Realizados</span>
                    </div>
                  </div>
                )}
              />
              <Bar
                dataKey="previsto"
                name="Recebimentos Previstos"
                fill="#3b82f6"
                radius={[5, 5, 0, 0]}
                maxBarSize={44}
                onClick={(entry: any) => {
                  if (entry && entry.monthKey) setSelectedMonthKey(entry.monthKey);
                }}
                className="cursor-pointer transition-opacity hover:opacity-85"
              />
              <Bar
                dataKey="realizado"
                name="Recebimentos Realizados"
                fill="#10b981"
                radius={[5, 5, 0, 0]}
                maxBarSize={44}
                onClick={(entry: any) => {
                  if (entry && entry.monthKey) setSelectedMonthKey(entry.monthKey);
                }}
                className="cursor-pointer transition-opacity hover:opacity-85"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Card de Detalhamento do Mês Focado */}
        <div className="bg-slate-50/90 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex flex-col items-center justify-center font-black text-xs shrink-0 shadow-2xs">
              <span className="text-[9px] uppercase tracking-wider text-blue-200">Mês</span>
              <span>{selected6MonthsItem.monthLabel}</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-slate-900 text-sm">
                  {selected6MonthsItem.fullName}
                </span>
                {selected6MonthsItem.isCurrent && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-black">
                    Mês Atual
                  </span>
                )}
                {(selected6MonthsItem?.taxaRealizacao || 0) === 100 ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-[12px]">check</span>
                    100% Quitado
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-black flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-[12px]">warning</span>
                    {selected6MonthsItem?.taxaRealizacao || 0}% Quitado
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-slate-600 flex-wrap">
                <span>
                  Previsto: <strong className="text-slate-900">R$ {(selected6MonthsItem?.previsto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                </span>
                <span>•</span>
                <span>
                  Realizado: <strong className="text-emerald-700">R$ {(selected6MonthsItem?.realizado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                </span>
                {(selected6MonthsItem?.pendente || 0) > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-red-600 font-bold">
                      Pendente: R$ {(selected6MonthsItem?.pendente || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto bg-white/70 px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">Conciliação</span>
            <span className="font-black text-xs text-slate-900">
              {selectedDebtor?.name ? `Extrato de ${selectedDebtor.name.split(' ')[0]}` : 'Consolidação de Todos'}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3.5 ÁRVORE DE GESTÃO FINANCEIRA RAMIFICADA E INTERATIVA                   */}
      {/* ========================================================================= */}
      <div className="bg-white/80 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">account_tree</span>
            </span>
            <div>
              <h3 className="font-bold text-slate-900 text-xs sm:text-sm leading-tight flex items-center gap-1.5">
                <span>Fluxo de Caixa Dinâmico Ramificado</span>
                <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold font-mono">INTERATIVO</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Visualize a decomposição e ramificação dos recebíveis em árvore interativa. Clique nos botões de expansão para visualizar os devedores.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const allOpen = !treeExpandedNodes.paid;
              setTreeExpandedNodes({
                root: true,
                paid: allOpen,
                open: allOpen,
                ontime: allOpen,
                late: allOpen
              });
            }}
            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold text-[11px] flex items-center gap-1 transition-all self-start sm:self-auto cursor-pointer"
          >
            <span className="material-symbols-outlined text-[14px]">unfold_more</span>
            <span>{treeExpandedNodes.paid ? 'Recolher Tudo' : 'Expandir Tudo'}</span>
          </button>
        </div>

        {/* Árvore Hierárquica */}
        <div className="p-2.5 sm:p-5 bg-slate-50/70 rounded-xl border border-slate-200/70 overflow-x-auto no-scrollbar font-sans w-full">
          {/* NÓ RAIZ (Total Faturado) */}
          <div className="space-y-3 w-full min-w-0">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => toggleTreeNode('root')}
                className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0 hover:bg-slate-800 transition-colors cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {treeExpandedNodes.root ? 'expand_more' : 'chevron_right'}
                </span>
              </button>
              
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 bg-slate-900 text-white px-3 sm:px-4 py-2 rounded-xl border border-slate-700 shadow-sm flex-1 min-w-0">
                <span className="material-symbols-outlined text-[20px] text-amber-400 shrink-0">payments</span>
                <div className="flex-1 min-w-0">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Total Geral Faturado</span>
                  <strong className="text-xs sm:text-sm font-black font-mono">
                    R$ {totalInvoiced.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
                <span className="text-[9.5px] font-bold bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-slate-300 shrink-0">
                  Raiz do Fluxo
                </span>
              </div>
            </div>

            {/* RAMOS DA RAIZ */}
            {treeExpandedNodes.root && (
              <div className="relative pl-3 sm:pl-3.5 ml-3 sm:ml-3.5 border-l-2 border-dashed border-slate-300 space-y-4 pt-1">
                
                {/* 1. RAMO LIQUIDADO */}
                <div className="space-y-3 relative">
                  {/* Linha horizontal ramificada */}
                  <div className="absolute -left-3 sm:-left-3.5 top-5 w-3 sm:w-3.5 border-t-2 border-dashed border-slate-300" />
                  
                  <div className="flex items-center gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => toggleTreeNode('paid')}
                      className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                        treeExpandedNodes.paid ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {treeExpandedNodes.paid ? 'expand_more' : 'chevron_right'}
                      </span>
                    </button>

                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-2.5 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 text-emerald-950 px-3 sm:px-3.5 py-2 rounded-xl flex-1 min-w-0 transition-colors">
                      <span className="material-symbols-outlined text-[18px] text-emerald-600 shrink-0">check_circle</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-[9px] sm:text-[9.5px] font-bold text-emerald-700 uppercase tracking-wider block truncate">Ramo: Total Liquidado (Recebido)</span>
                        <strong className="text-xs sm:text-sm font-black font-mono text-emerald-900">
                          R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </strong>
                      </div>
                      <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-200 shrink-0">
                        {Math.round((totalPaid / (totalInvoiced || 1)) * 100)}% do Total
                      </span>
                    </div>
                  </div>

                  {/* DEVEDORES LIQUIDADOS (Sub-ramificação) */}
                  {treeExpandedNodes.paid && (
                    <div className="relative pl-4 sm:pl-5 ml-2.5 sm:ml-3 border-l-2 border-dashed border-emerald-300 space-y-2 pt-1 pb-1">
                      {debtors.map((deb) => {
                        const debtorInsts = installments.filter(i => i.debtorId === deb.id || i.debtorName === deb.name);
                        const paidAmount = debtorInsts.filter(i => i.status === 'paid').reduce((acc, curr) => acc + curr.amount, 0);
                        if (paidAmount <= 0) return null;

                        return (
                          <div key={deb.id} className="flex items-center gap-2 relative">
                            {/* Conector */}
                            <div className="absolute -left-4 sm:-left-5 top-4 w-4 sm:w-5 border-t-2 border-dashed border-emerald-300" />
                            
                            <div className="flex items-center gap-2 bg-white px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs hover:border-emerald-300 transition-colors flex-1 min-w-0">
                              <img
                                src={getCleanDebtorAvatar(deb.name, deb.avatar)}
                                alt={deb.name}
                                className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg object-cover shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <span className="font-bold text-[10.5px] sm:text-[11px] text-slate-800 block truncate">{deb.name}</span>
                                <span className="text-[8.5px] sm:text-[9px] text-slate-500 font-medium truncate block">Contribuído via PIX / Comprovante</span>
                              </div>
                              <span className="font-mono font-bold text-[11px] sm:text-xs text-emerald-700 shrink-0">
                                + R$ {(Number(paidAmount) || 0).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2. RAMO SALDO EM ABERTO */}
                <div className="space-y-3 relative">
                  {/* Linha horizontal ramificada */}
                  <div className="absolute -left-3 sm:-left-3.5 top-5 w-3 sm:w-3.5 border-t-2 border-dashed border-slate-300" />
                  
                  <div className="flex items-center gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => toggleTreeNode('open')}
                      className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                        treeExpandedNodes.open ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {treeExpandedNodes.open ? 'expand_more' : 'chevron_right'}
                      </span>
                    </button>

                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-2.5 bg-blue-50/70 hover:bg-blue-100/80 border border-blue-200 text-blue-950 px-3 sm:px-3.5 py-2 rounded-xl flex-1 min-w-0 transition-colors">
                      <span className="material-symbols-outlined text-[18px] text-blue-600 shrink-0">hourglass_empty</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-[9px] sm:text-[9.5px] font-bold text-blue-700 uppercase tracking-wider block truncate">Ramo: Saldo Total em Aberto</span>
                        <strong className="text-xs sm:text-sm font-black font-mono text-blue-900">
                          R$ {(totalOntime + totalOverdue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </strong>
                      </div>
                      <span className="text-[9px] font-black bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md border border-blue-200 shrink-0">
                        {Math.round(((totalOntime + totalOverdue) / (totalInvoiced || 1)) * 100)}% Restante
                      </span>
                    </div>
                  </div>

                  {/* RAMIFICAÇÕES DO SALDO EM ABERTO (A Vencer & Em Atraso) */}
                  {treeExpandedNodes.open && (
                    <div className="relative pl-4 sm:pl-5 ml-2.5 sm:ml-3 border-l-2 border-dashed border-blue-300 space-y-4 pt-1 pb-1">
                      
                      {/* SUB-RAMO 2A: A VENCER */}
                      <div className="space-y-3 relative">
                        {/* Conector */}
                        <div className="absolute -left-4 sm:-left-5 top-5 w-4 sm:w-5 border-t-2 border-dashed border-blue-300" />
                        
                        <div className="flex items-center gap-2 sm:gap-2.5">
                          <button
                            type="button"
                            onClick={() => toggleTreeNode('ontime')}
                            className={`w-5.5 h-5.5 rounded-md flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                              treeExpandedNodes.ontime ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {treeExpandedNodes.ontime ? 'expand_more' : 'chevron_right'}
                            </span>
                          </button>

                          <div className="flex items-center gap-2 bg-indigo-50/50 hover:bg-indigo-50 border border-indigo-200 text-indigo-950 px-2.5 sm:px-3 py-1.5 rounded-lg flex-1 min-w-0 transition-all">
                            <span className="material-symbols-outlined text-[16px] text-indigo-600 shrink-0">schedule</span>
                            <div className="flex-1 min-w-0">
                              <span className="text-[8.5px] sm:text-[9px] font-bold text-indigo-600 block uppercase truncate">No Prazo (A Vencer)</span>
                              <strong className="text-xs font-black font-mono text-slate-800">
                                R$ {totalOntime.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </strong>
                            </div>
                          </div>
                        </div>

                        {/* DEVEDORES A VENCER */}
                        {treeExpandedNodes.ontime && (
                          <div className="relative pl-4 sm:pl-5 ml-2 sm:ml-2.5 border-l-2 border-dashed border-indigo-300 space-y-2 pt-1 pb-1">
                            {debtors.map((deb) => {
                              const debtorInsts = installments.filter(i => i.debtorId === deb.id || i.debtorName === deb.name);
                              const ontimeAmount = debtorInsts.filter(i => i.status !== 'paid' && i.status !== 'overdue').reduce((acc, curr) => acc + curr.amount, 0);
                              if (ontimeAmount <= 0) return null;

                              return (
                                <div key={deb.id} className="flex items-center gap-2 relative">
                                  {/* Conector */}
                                  <div className="absolute -left-4 sm:-left-5 top-4 w-4 sm:w-5 border-t-2 border-dashed border-indigo-300" />
                                  
                                  <div className="flex items-center gap-2 bg-white px-2 sm:px-2.5 py-1.5 rounded-md border border-slate-100 shadow-3xs hover:border-indigo-300 transition-colors flex-1 min-w-0">
                                    <img
                                      src={getCleanDebtorAvatar(deb.name, deb.avatar)}
                                      alt={deb.name}
                                      className="w-5 h-5 sm:w-6 sm:h-6 rounded-md object-cover shrink-0"
                                    />
                                    <span className="font-bold text-[10px] sm:text-[10.5px] text-slate-700 truncate flex-1">{deb.name}</span>
                                    <span className="font-mono font-bold text-[10.5px] sm:text-[11px] text-indigo-600 shrink-0">
                                      R$ {(Number(ontimeAmount) || 0).toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* SUB-RAMO 2B: EM ATRASO */}
                      <div className="space-y-3 relative">
                        {/* Conector */}
                        <div className="absolute -left-4 sm:-left-5 top-5 w-4 sm:w-5 border-t-2 border-dashed border-blue-300" />
                        
                        <div className="flex items-center gap-2 sm:gap-2.5">
                          <button
                            type="button"
                            onClick={() => toggleTreeNode('late')}
                            className={`w-5.5 h-5.5 rounded-md flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                              treeExpandedNodes.late ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {treeExpandedNodes.late ? 'expand_more' : 'chevron_right'}
                            </span>
                          </button>

                          <div className={`flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg border flex-1 min-w-0 transition-all ${
                            totalOverdue > 0 
                              ? 'bg-red-50 hover:bg-red-100/50 border-red-200 text-red-950' 
                              : 'bg-slate-50 border-slate-200 text-slate-400'
                          }`}>
                            <span className="material-symbols-outlined text-[16px] text-red-600 shrink-0">warning</span>
                            <div className="flex-1 min-w-0">
                              <span className="text-[8.5px] sm:text-[9px] font-bold text-red-600 block uppercase truncate">Vencido (Em Atraso)</span>
                              <strong className="text-xs font-black font-mono text-slate-800">
                                R$ {totalOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </strong>
                            </div>
                            {totalOverdue > 0 && (
                              <span className="text-[8px] font-black bg-red-600 text-white px-1.5 py-0.2 rounded uppercase animate-pulse shrink-0">
                                Alerta
                              </span>
                            )}
                          </div>
                        </div>

                        {/* DEVEDORES EM ATRASO */}
                        {treeExpandedNodes.late && (
                          <div className="relative pl-4 sm:pl-5 ml-2 sm:ml-2.5 border-l-2 border-dashed border-red-300 space-y-2 pt-1 pb-1">
                            {debtors.map((deb) => {
                              const debtorInsts = installments.filter(i => i.debtorId === deb.id || i.debtorName === deb.name);
                              const lateAmount = debtorInsts.filter(i => i.status === 'overdue').reduce((acc, curr) => acc + curr.amount, 0);
                              if (lateAmount <= 0) return null;

                              return (
                                <div key={deb.id} className="flex items-center gap-2 relative">
                                  {/* Conector */}
                                  <div className="absolute -left-4 sm:-left-5 top-4 w-4 sm:w-5 border-t-2 border-dashed border-red-300" />
                                  
                                  <div className="flex items-center gap-2 bg-white px-2 sm:px-2.5 py-1.5 rounded-md border border-red-100 shadow-3xs hover:border-red-300 transition-colors flex-1 min-w-0">
                                    <img
                                      src={getCleanDebtorAvatar(deb.name, deb.avatar)}
                                      alt={deb.name}
                                      className="w-5 h-5 sm:w-6 sm:h-6 rounded-md object-cover shrink-0"
                                    />
                                    <span className="font-bold text-[10px] sm:text-[10.5px] text-slate-700 truncate flex-1">{deb.name}</span>
                                    <span className="font-mono font-bold text-[10.5px] sm:text-[11px] text-red-600 shrink-0">
                                      R$ {(Number(lateAmount) || 0).toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                            {totalOverdue === 0 && (
                              <div className="text-[10px] text-slate-400 pl-2">
                                Nenhuma parcela em atraso!
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Saúde & Aging (3 Blocos Quadrados) */}
      <div className="bg-white/80 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600 text-[20px]">health_and_safety</span>
            <h3 className="font-black text-slate-900 text-sm sm:text-base">
              {selectedDebtor
                ? `Saúde Financeira Individual: ${selectedDebtor.name}`
                : 'Saúde Geral da Carteira & Pontualidade'}
            </h3>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black">
            {punctualityPercent}% Pontualidade
          </span>
        </div>

        {/* Barra Proporcional */}
        <div className="w-full bg-slate-100 h-3.5 rounded-full overflow-hidden flex shadow-inner">
          <div
            className="h-full bg-emerald-600 transition-all"
            style={{ width: `${Math.max(10, Math.round((totalPaid / (totalInvoiced || 1)) * 100))}%` }}
          />
          <div
            className="h-full bg-amber-400 transition-all"
            style={{ width: `${Math.max(5, Math.round((totalOntime / (totalInvoiced || 1)) * 100))}%` }}
          />
          {totalOverdue > 0 && (
            <div
              className="h-full bg-red-600 transition-all"
              style={{ width: `${Math.max(8, Math.round((totalOverdue / (totalInvoiced || 1)) * 100))}%` }}
            />
          )}
        </div>

        {/* 3 Blocos Quadrados de Status */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-1">
          <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200/80 text-center flex flex-col justify-center">
            <span className="text-[10px] sm:text-xs font-black text-emerald-800 flex items-center justify-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              Liquidado (Pago)
            </span>
            <span className="text-xs sm:text-sm font-black text-slate-900 mt-1 block">
              R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[9px] text-emerald-700 font-semibold mt-0.5">
              Recebido em conta
            </span>
          </div>

          <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200/80 text-center flex flex-col justify-center">
            <span className="text-[10px] sm:text-xs font-black text-amber-900 flex items-center justify-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              A Vencer
            </span>
            <span className="text-xs sm:text-sm font-black text-slate-900 mt-1 block">
              R$ {totalOntime.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[9px] text-amber-700 font-semibold mt-0.5">
              Parcelas no prazo
            </span>
          </div>

          <div className="bg-red-50/60 p-3 rounded-xl border border-red-200/80 text-center flex flex-col justify-center">
            <span className="text-[10px] sm:text-xs font-black text-red-800 flex items-center justify-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-600"></span>
              Em Atraso
            </span>
            <span className="text-xs sm:text-sm font-black text-slate-900 mt-1 block">
              R$ {totalOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[9px] text-red-700 font-semibold mt-0.5">
              {totalOverdue > 0 ? 'Juros ativos' : 'Sem atrasos'}
            </span>
          </div>
        </div>
      </div>

      {/* 5. SEÇÃO DE EXPORTAÇÃO & DOWNLOAD REAL: 3 Cartões Quadrados de Ação */}
      <div className="bg-white/80 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
              <span className="material-symbols-outlined text-emerald-600 text-[20px]">download_for_offline</span>
              {selectedDebtor
                ? `Downloads Individuais: ${selectedDebtor.name}`
                : 'Opções de Exportação & Download Consolidado'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {selectedDebtor
                ? `O arquivo gerado conterá exclusivamente o histórico, parcelas e dados de ${selectedDebtor.name}.`
                : 'Gere o extrato contendo todos os devedores ou selecione um devedor acima para exportar individualmente.'}
            </p>
          </div>

          {selectedDebtor && (
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs self-start sm:self-auto">
              👤 Arquivo Individual Ativo
            </span>
          )}
        </div>

        {/* 3 Cartões Quadrados de Download */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          
          {/* Card 1: Extrato PDF Oficial */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col justify-between min-h-[220px] group hover:border-red-300 hover:bg-red-50/20 transition-all shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shadow-2xs">
                <span className="material-symbols-outlined text-[24px]">picture_as_pdf</span>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-red-100/80 text-red-700 text-[10px] font-black uppercase">
                {selectedDebtor ? 'PDF Individual' : 'PDF Geral'}
              </span>
            </div>

            <div className="my-3">
              <h4 className="font-black text-slate-900 text-sm truncate">
                {selectedDebtor ? `Extrato: ${selectedDebtor.name}` : 'Extrato Geral Completo'}
              </h4>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                {selectedDebtor
                  ? `Extrato A4 oficial com dados cadastrais, score, cronograma de parcelas e autenticações de ${selectedDebtor.name}.`
                  : 'Relatório executivo diagramado em A4 com logotipo HASPAHO, KPIs e tabelas consolidadas.'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloadingType !== null}
              className="w-full h-10 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {downloadingType === 'pdf' ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Baixando PDF...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  <span>Baixar Extrato PDF</span>
                </>
              )}
            </button>
          </div>

          {/* Card 2: Planilha Excel (.xlsx) */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col justify-between min-h-[220px] group hover:border-emerald-300 hover:bg-emerald-50/20 transition-all shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-2xs">
                <span className="material-symbols-outlined text-[24px]">table_view</span>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-emerald-100/80 text-emerald-700 text-[10px] font-black uppercase">
                {selectedDebtor ? 'Excel Individual' : 'Excel (.xlsx)'}
              </span>
            </div>

            <div className="my-3">
              <h4 className="font-black text-slate-900 text-sm truncate">
                {selectedDebtor ? `Planilha: ${selectedDebtor.name}` : 'Planilha Geral (.xlsx)'}
              </h4>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                {selectedDebtor
                  ? `Planilha Excel com abas de Resumo do Devedor, Cronograma de Parcelas e Compras Ativas.`
                  : 'Arquivo compatível com Excel e Google Sheets com abas separadas de dados e fórmulas.'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleDownloadExcel}
              disabled={downloadingType !== null}
              className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {downloadingType === 'excel' ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Baixando Excel...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  <span>Baixar Planilha Excel</span>
                </>
              )}
            </button>
          </div>

          {/* Card 3: Arquivo CSV (.csv) */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col justify-between min-h-[220px] group hover:border-blue-300 hover:bg-blue-50/20 transition-all shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-2xs">
                <span className="material-symbols-outlined text-[24px]">database</span>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-blue-100/80 text-blue-700 text-[10px] font-black uppercase">
                CSV Individual
              </span>
            </div>

            <div className="my-3">
              <h4 className="font-black text-slate-900 text-sm truncate">
                {selectedDebtor ? `CSV: ${selectedDebtor.name}` : 'Dados Brutos CSV'}
              </h4>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                {selectedDebtor
                  ? `Arquivo tabular com todas as parcelas e autenticações exclusivas de ${selectedDebtor.name}.`
                  : 'Estrutura tabular codificada em UTF-8 BOM e ponto-e-vírgula para auditoria imediata.'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleDownloadCsv}
              disabled={downloadingType !== null}
              className="w-full h-10 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {downloadingType === 'csv' ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Baixando CSV...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  <span>Baixar Arquivo CSV</span>
                </>
              )}
            </button>
          </div>

        </div>
      </div>

      {/* Janela Inteligente Interativa de Detalhes (Regra A, B, C) */}
      {reportModalData.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 text-blue-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[22px]">analytics</span>
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base tracking-tight">{reportModalData.title}</h3>
                  <p className="text-[11px] text-slate-300">{reportModalData.description}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReportModalData(prev => ({ ...prev, isOpen: false }))}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Modal Filter & Search Bar */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
              <div className="relative flex-1">
                <span className="absolute left-3 top-2.5 text-slate-400 material-symbols-outlined text-[18px]">search</span>
                <input
                  type="text"
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder="Pesquisar devedor, produto ou autenticação..."
                  className="w-full h-9 pl-9 pr-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={modalStatusFilter}
                  onChange={(e: any) => setModalStatusFilter(e.target.value)}
                  className="h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none shadow-2xs cursor-pointer"
                >
                  <option value="all">Todas as Situações</option>
                  <option value="paid">Apenas Pagos</option>
                  <option value="ontime">A Vencer (Em dia)</option>
                  <option value="overdue">Em Atraso</option>
                </select>

                <select
                  value={modalSortOrder}
                  onChange={(e: any) => setModalSortOrder(e.target.value)}
                  className="h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none shadow-2xs cursor-pointer"
                >
                  <option value="date_desc">Mais Recentes</option>
                  <option value="amount_desc">Maior Valor</option>
                  <option value="name_asc">Nome do Devedor</option>
                </select>
              </div>
            </div>

            {/* Modal Content / Scrollable List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 divide-y divide-slate-100">
              <div className="flex items-center justify-between px-1 pb-2">
                <span className="text-xs font-bold text-slate-500">
                  Total de registros encontrados: <strong className="text-slate-900">{modalFilteredInstallments.length}</strong>
                </span>
                <span className="text-xs font-bold text-emerald-600 font-mono">
                  Soma: R$ {modalFilteredInstallments.reduce((acc, curr) => acc + (curr.amount || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {modalFilteredInstallments.length === 0 ? (
                <div className="py-12 text-center">
                  <span className="material-symbols-outlined text-[42px] text-slate-300 mb-2">folder_off</span>
                  <p className="text-xs font-bold text-slate-700">Nenhum registro encontrado com os filtros atuais.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Tente remover os termos de busca ou alterar a situação.</p>
                </div>
              ) : (
                modalFilteredInstallments.map((inst) => {
                  const debtor = debtors.find(d => d.id === inst.debtorId || d.name.toLowerCase() === (inst.debtorName || '').toLowerCase());
                  return (
                    <div key={inst.id} className="pt-2.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-slate-50 p-2.5 rounded-xl transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={getCleanDebtorAvatar(inst.debtorName, debtor?.avatar)}
                          alt={inst.debtorName}
                          className="w-9 h-9 rounded-xl object-cover shrink-0 ring-1 ring-slate-200"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 truncate">{inst.debtorName}</span>
                            <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              inst.status === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                              inst.status === 'overdue' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {inst.status === 'paid' ? 'Pago' : inst.status === 'overdue' ? `Atraso (${inst.delayDays || 0}d)` : 'Em Dia'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {inst.product} • Parcela {inst.installmentNumber}/{inst.totalInstallments} • Vencimento: <strong className="text-slate-700">{inst.dueDate}</strong>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        <div className="text-right">
                          <span className="font-black text-xs sm:text-sm font-mono text-slate-900 block">
                            R$ {(inst.amount || inst.originalAmount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            {inst.authCode ? `Auth: ${inst.authCode.slice(0, 10)}` : 'Pendente'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-500 font-medium">
                🔒 Dados sincronizados com o banco de dados oficial Firebase.
              </span>
              <button
                type="button"
                onClick={() => setReportModalData(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Fechar Janela
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
