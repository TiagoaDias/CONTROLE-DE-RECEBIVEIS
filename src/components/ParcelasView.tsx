import React, { useState, useMemo, useEffect } from 'react';
import { Installment, Debtor, Purchase, ScreenTab, generateAuthCode } from '../types';
import { getItemIcon, SafeDebtorAvatar } from './DebtorsMasterSpreadsheet';
import { parseDateParts } from '../utils/dateUtils';
import { DebtorUnitaryItemsModal } from './DebtorUnitaryItemsModal';
import { ProductPurchasePrintModal } from './ProductPurchasePrintModal';
import { PdfsAndDocumentsModal } from './PdfsAndDocumentsModal';
import { getDebtorUnitaryItems, getProductCategory } from '../utils/debtorItemsUtils';
import { CardMeteor } from './CardMeteor';
import { CosmicMoonRocket } from './CosmicMoonRocket';
import { SearchableDropdown, DropdownItem } from './SearchableDropdown';
import { WhatsAppIcon } from './WhatsAppIcon';
import { safeToNumber, safeToFixed, safeFormatCurrency } from '../utils/numberUtils';
import { DebtorKpiDetailModal, DebtorKpiType } from './DebtorKpiDetailModal';
import { playAppSound } from '../utils/soundUtils';

// Configuração de Posicionamento Interativo dos Botões
export interface ActionButtonsLayoutConfig {
  offsetX: number;
  offsetY: number;
  layoutDirection: 'row' | 'col';
  alignment: 'right' | 'center' | 'left';
  buttonGap: number;
  quitarOrderFirst: boolean;
}

const DEFAULT_LAYOUT_CONFIG: ActionButtonsLayoutConfig = {
  offsetX: 0,
  offsetY: 0,
  layoutDirection: 'row',
  alignment: 'right',
  buttonGap: 4,
  quitarOrderFirst: true,
};

interface ParcelasViewProps {
  installments: Installment[];
  debtors: Debtor[];
  purchases?: Purchase[];
  onNavigate: (tab: ScreenTab, targetId?: string) => void;
  onNudgeWhatsApp: (name: string, amount: string, item: string, parcel: string, phone?: string) => void;
  onSettleInstallment: (inst: Installment) => void;
  onShowProof: (payer: string, amount: string, date: string, dest: string, auth: string, item: string) => void;
  onEditDebtor?: (debtor: Debtor) => void;
  onOpenContract?: (debtorId: string) => void;
  onOpenExtratoTotal?: (purchaseId?: string, debtorId?: string) => void;
  onOpenGeminiScanner?: () => void;
  onOpenNewPurchase?: (debtorId?: string) => void;
  onOpenNewDebtor?: () => void;
  searchQuery: string;
  initialDebtorId?: string;
  initialPurchaseFilter?: string;
  onSelectDebtor?: (debtorId: string) => void;
  onToast?: (msg: string) => void;
  onUpdateInstallment?: (inst: Installment) => void;
  userPixKey?: string;
  onDeleteInstallment?: (id: string) => void;
}

// Helper para abreviar data no mobile (ex: 10/08/2026 -> 10/08)
export const formatDueDateShort = (d: string) => {
  if (!d) return '';
  if (d.includes('/')) {
    const parts = d.split('/');
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }
  }
  return d;
};

// Helper para abreviar nome do item/produto no mobile
export const formatProductShort = (name: string) => {
  if (!name) return '';
  if (/celular/i.test(name) || /smartphone/i.test(name) || /galaxy/i.test(name) || /iphone/i.test(name)) return 'Celular';
  if (/smart\s*tv/i.test(name)) return 'Smart TV';
  if (/notebook/i.test(name)) return 'Notebook';
  if (/ar\s*condicionado/i.test(name)) return 'Ar Cond.';
  if (/geladeira/i.test(name)) return 'Geladeira';
  if (/curso/i.test(name)) return 'Curso';
  return name.length > 12 ? name.substring(0, 11) + '…' : name;
};

// Helper para identificação visual e estilo do Cartão / Forma de Pagamento
export const getCardBadgeInfo = (cardName?: string) => {
  const name = (cardName || '').toLowerCase().trim();
  if (name.includes('nubank')) {
    return {
      brand: 'Nubank',
      colorClass: 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100',
      icon: 'credit_card',
      dotColor: 'bg-purple-600',
    };
  }
  if (name.includes('inter')) {
    return {
      brand: 'Inter',
      colorClass: 'bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100',
      icon: 'credit_card',
      dotColor: 'bg-orange-600',
    };
  }
  if (name.includes('c6')) {
    return {
      brand: 'C6 Bank',
      colorClass: 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700',
      icon: 'credit_card',
      dotColor: 'bg-amber-400',
    };
  }
  if (name.includes('itau') || name.includes('itaú')) {
    return {
      brand: 'Itaú',
      colorClass: 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100',
      icon: 'credit_card',
      dotColor: 'bg-amber-600',
    };
  }
  if (name.includes('bradesco') || name.includes('santander')) {
    return {
      brand: name.includes('bradesco') ? 'Bradesco' : 'Santander',
      colorClass: 'bg-red-50 text-red-800 border-red-200 hover:bg-red-100',
      icon: 'credit_card',
      dotColor: 'bg-red-600',
    };
  }
  if (name.includes('pix') || name.includes('boleto')) {
    return {
      brand: 'Boleto / Pix',
      colorClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100',
      icon: 'account_balance_wallet',
      dotColor: 'bg-emerald-600',
    };
  }
  return {
    brand: cardName || 'Cartão Cadastrado',
    colorClass: 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200',
    icon: 'credit_card',
    dotColor: 'bg-slate-500',
  };
};

export const ParcelasView: React.FC<ParcelasViewProps> = ({
  installments,
  debtors,
  purchases = [],
  onNavigate,
  onNudgeWhatsApp,
  onSettleInstallment,
  onShowProof,
  onEditDebtor,
  onOpenContract,
  onOpenExtratoTotal,
  onOpenGeminiScanner,
  onOpenNewPurchase,
  onOpenNewDebtor,
  searchQuery = '',
  initialDebtorId,
  initialPurchaseFilter,
  onSelectDebtor,
  onToast,
  onUpdateInstallment,
  userPixKey,
  onDeleteInstallment,
}) => {
  // Modal de Detalhes dos Itens Unitários
  const [isUnitaryModalOpen, setIsUnitaryModalOpen] = useState(false);
  const [selectedDebtorForUnitary, setSelectedDebtorForUnitary] = useState<Debtor | null>(null);
  const [initialUnitaryItemId, setInitialUnitaryItemId] = useState<string | undefined>(undefined);

  const handleOpenUnitaryModal = (debtor: Debtor, initialItemId?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedDebtorForUnitary(debtor);
    setInitialUnitaryItemId(initialItemId);
    setIsUnitaryModalOpen(true);
  };

  // Estado do Devedor selecionado (pesquisa e visualização individual)
  const [selectedDebtorId, setSelectedDebtorId] = useState<string>(() => {
    if (initialDebtorId && initialDebtorId !== 'all' && debtors.some((d) => d.id === initialDebtorId)) {
      return initialDebtorId;
    }
    return debtors[0]?.id || '';
  });

  useEffect(() => {
    if (initialDebtorId && initialDebtorId !== 'all' && debtors.some((d) => d.id === initialDebtorId)) {
      setSelectedDebtorId(initialDebtorId);
    } else if (selectedDebtorId === 'all' && debtors.length > 0) {
      setSelectedDebtorId(debtors[0].id);
    }
  }, [initialDebtorId, debtors, selectedDebtorId]);

  // Rolar suavemente até a aba do devedor selecionado
  useEffect(() => {
    if (selectedDebtorId && selectedDebtorId !== 'all') {
      const el = document.getElementById(`debtor-tab-${selectedDebtorId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [selectedDebtorId]);

  const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | 'ontime' | 'paid'>('all');
  const [cardFilter, setCardFilter] = useState<string>('all');
  const [localSearch, setLocalSearch] = useState<string>('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Estado exclusivo para controlar dropdown aberto (nunca dois abertos ao mesmo tempo)
  const [activeDropdown, setActiveDropdown] = useState<'debtor' | 'product' | null>(null);

  // Modo de exibição do Seletor de Devedores (Formato Planilha vs Formato Devedores)
  const [miniCardsDeckLayout, setMiniCardsDeckLayout] = useState<'planilha' | 'devedores'>('planilha');
  const deckScrollContainerRef = React.useRef<HTMLDivElement>(null);

  // Modal de Recálculo de Juros por Atraso Diário
  const [recalcModalItem, setRecalcModalItem] = useState<Installment | null>(null);
  const [recalcDays, setRecalcDays] = useState<number>(9);
  const [recalcIncludePenalty, setRecalcIncludePenalty] = useState<boolean>(true);
  const [recalcIncludeFixedFee, setRecalcIncludeFixedFee] = useState<boolean>(true);
  const [recalcIncludeDailyInterest, setRecalcIncludeDailyInterest] = useState<boolean>(true);

  // Modal / Drawer de Detalhes da Parcela no Mobile
  const [selectedInstallmentForDetail, setSelectedInstallmentForDetail] = useState<Installment | null>(null);

  // Feedback do botão de cópia rápida
  const [copiedInstallmentId, setCopiedInstallmentId] = useState<string | null>(null);

  // Modal de Print da Compra do Produto (Smart TV, etc.)
  const [productPrintModalState, setProductPrintModalState] = useState<{
    isOpen: boolean;
    productName: string;
    debtorName: string;
    purchase?: Purchase;
  }>({
    isOpen: false,
    productName: '',
    debtorName: '',
  });

  // Modal de PDFs e Documentos
  const [isPdfsAndDocsModalOpen, setIsPdfsAndDocsModalOpen] = useState(false);

  // Modal Interativo de Detalhes Individuais dos 4 Quadradinhos (Aberto, Quitado, Atraso, Mês Atual)
  const [activeKpiModal, setActiveKpiModal] = useState<DebtorKpiType | null>(null);

  const handleOpenProductPrint = (productName: string, debtorName?: string, purchaseId?: string) => {
    const matchedPurchase = purchases?.find(
      (p) => p.id === purchaseId || (p.debtorName === debtorName && p.product === productName)
    );
    setProductPrintModalState({
      isOpen: true,
      productName,
      debtorName: debtorName || (activeDebtor ? activeDebtor.name : 'Cliente'),
      purchase: matchedPurchase,
    });
  };

  const handleOpenWhatsDirect = (phone?: string, name?: string) => {
    if (!phone) {
      if (onToast) onToast('Nenhum número de telefone cadastrado para esta pessoa.');
      return;
    }
    const clean = phone.replace(/\D/g, '');
    const waNumber = clean.length <= 11 ? `55${clean}` : clean;
    if (onToast) onToast(`Abrindo WhatsApp de ${name || 'contato'}...`);
    window.open(`https://wa.me/${waNumber}`, '_blank');
  };

  // Modo de Posicionamento e Ajuste Fino dos Botões (Arrastar e Mover)
  const [isPositionModeActive, setIsPositionModeActive] = useState<boolean>(false);
  const [layoutConfig, setLayoutConfig] = useState<ActionButtonsLayoutConfig>(() => {
    try {
      const saved = localStorage.getItem('haspaho_buttons_layout_config');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_LAYOUT_CONFIG;
  });

  const handleSaveLayout = () => {
    try {
      localStorage.setItem('haspaho_buttons_layout_config', JSON.stringify(layoutConfig));
      if (onToast) onToast('Posição dos botões salva! Você pode tirar print da tela.');
    } catch {}
  };

  const handleResetLayout = () => {
    setLayoutConfig(DEFAULT_LAYOUT_CONFIG);
    try {
      localStorage.removeItem('haspaho_buttons_layout_config');
      if (onToast) onToast('Posição dos botões restaurada para o padrão.');
    } catch {}
  };

  // Drag handling para reposicionamento interativo ao tocar e arrastar
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = React.useRef<{ x: number; y: number; origX: number; origY: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isPositionModeActive) return;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      origX: layoutConfig.offsetX,
      origY: layoutConfig.offsetY,
    };
    setIsDragging(true);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragStartRef.current) return;
    const deltaX = Math.round(e.clientX - dragStartRef.current.x);
    const deltaY = Math.round(e.clientY - dragStartRef.current.y);
    setLayoutConfig((prev) => ({
      ...prev,
      offsetX: dragStartRef.current!.origX + deltaX,
      offsetY: dragStartRef.current!.origY + deltaY,
    }));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      dragStartRef.current = null;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // Touch handlers específicos para celular (evita scroll indesejado e arrasta com precisão)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isPositionModeActive) return;
    const touch = e.touches[0];
    dragStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      origX: layoutConfig.offsetX,
      origY: layoutConfig.offsetY,
    };
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !dragStartRef.current) return;
    const touch = e.touches[0];
    const deltaX = Math.round(touch.clientX - dragStartRef.current.x);
    const deltaY = Math.round(touch.clientY - dragStartRef.current.y);
    setLayoutConfig((prev) => ({
      ...prev,
      offsetX: dragStartRef.current!.origX + deltaX,
      offsetY: dragStartRef.current!.origY + deltaY,
    }));
  };

  const handleTouchEnd = () => {
    if (isDragging) {
      setIsDragging(false);
      dragStartRef.current = null;
    }
  };

  // Devedor selecionado ou null (quando em modo 'all')
  const currentDebtor = useMemo(() => {
    if (selectedDebtorId === 'all') return null;
    return debtors.find((d) => d.id === selectedDebtorId) || null;
  }, [debtors, selectedDebtorId]);

  const [selectedPurchaseFilter, setSelectedPurchaseFilter] = useState<string>(() => {
    return initialPurchaseFilter || '';
  });

  useEffect(() => {
    if (initialPurchaseFilter !== undefined && initialPurchaseFilter !== '') {
      setSelectedPurchaseFilter(initialPurchaseFilter);
    }
  }, [initialPurchaseFilter]);

  const handleSelectDebtor = (id: string) => {
    setSelectedDebtorId(id);
    setSelectedPurchaseFilter('');
    if (onSelectDebtor) {
      onSelectDebtor(id);
    }
  };

  // Filtragem de parcelas pelo devedor - com fallback inteligente se houver busca específica
  const debtorInstallments = useMemo(() => {
    const q = (searchQuery || localSearch).trim().toLowerCase();
    // Se o usuário digitou uma busca (ex: "renata") e ela bate com parcelas fora do devedor atual, busca globalmente
    if (q) {
      const matchesAnotherDebtor = installments.some(
        (inst) =>
          (inst.debtorName || '').toLowerCase().includes(q) ||
          (inst.product || '').toLowerCase().includes(q) ||
          (inst.cardName && inst.cardName.toLowerCase().includes(q))
      );
      if (matchesAnotherDebtor && (!currentDebtor || !(currentDebtor.name || '').toLowerCase().includes(q))) {
        return installments;
      }
    }

    if (selectedDebtorId === 'all') {
      return installments;
    }
    return installments.filter(
      (inst) =>
        inst.debtorId === selectedDebtorId ||
        (currentDebtor && (inst.debtorName || '').toLowerCase() === (currentDebtor.name || '').toLowerCase())
    );
  }, [installments, selectedDebtorId, currentDebtor, searchQuery, localSearch]);

  // Lista de compras/itens distintos com métricas completas para a órbita e abas
  const debtorPurchases = useMemo(() => {
    const map = new Map<string, {
      id: string;
      product: string;
      debtorName: string;
      debtorId?: string;
      total: number;
      count: number;
      active: number;
      totalAmount: number;
      paidAmount: number;
      remainingAmount: number;
      installmentValue: number;
      nextDueDate: string;
      cardName: string;
      installments: Installment[];
    }>();

    debtorInstallments.forEach((inst) => {
      const pKey = inst.purchaseId || `${inst.debtorName || 'd'}-${inst.product || 'p'}`;
      if (!map.has(pKey)) {
        map.set(pKey, {
          id: inst.purchaseId || inst.product || 'item',
          product: inst.product || 'Item',
          debtorName: inst.debtorName || 'Devedor',
          debtorId: inst.debtorId,
          total: inst.totalInstallments || 1,
          count: 0,
          active: 0,
          totalAmount: 0,
          paidAmount: 0,
          remainingAmount: 0,
          installmentValue: inst.originalAmount || inst.amount || 0,
          nextDueDate: inst.dueDate || '',
          cardName: (inst.cardName || 'Boleto / Pix').trim(),
          installments: [],
        });
      }
      const entry = map.get(pKey)!;
      entry.count++;
      entry.installments.push(inst);
      const val = inst.amount || inst.originalAmount || 0;
      entry.totalAmount += val;
      if (inst.status === 'paid') {
        entry.paidAmount += (inst.paidAmount || val);
      } else {
        entry.active++;
        entry.remainingAmount += val;
        if (!entry.nextDueDate || inst.status === 'overdue' || inst.status === 'soon') {
          entry.nextDueDate = inst.dueDate;
        }
      }
    });

    // Ordenar as parcelas de cada compra cronologicamente
    map.forEach((entry) => {
      entry.installments.sort((a, b) => (a.installmentNumber || 1) - (b.installmentNumber || 1));
      if (!entry.nextDueDate && entry.installments.length > 0) {
        entry.nextDueDate = entry.installments[0].dueDate;
      }
    });

    return Array.from(map.values());
  }, [debtorInstallments]);

  // Lista de cartões disponíveis para filtro
  const availableCards = useMemo(() => {
    const map = new Map<string, number>();
    debtorInstallments.forEach((inst) => {
      const card = (inst.cardName || 'Boleto / Pix').trim();
      map.set(card, (map.get(card) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [debtorInstallments]);

  // Helper para converter data em timestamp para ordenação precisa
  const getInstallmentTimestamp = (dateStr: string): number => {
    const parts = parseDateParts(dateStr);
    return new Date(parts.year, parts.month - 1, parts.day).getTime();
  };

  // Devedor ativo em foco para o card lateral da planilha e a barra superior
  const activeDebtor = useMemo(() => {
    if (currentDebtor) return currentDebtor;
    if (selectedDebtorId && selectedDebtorId !== 'all') {
      const match = debtors.find((d) => d.id === selectedDebtorId);
      if (match) return match;
    }
    return debtors[0] || null;
  }, [currentDebtor, selectedDebtorId, debtors]);

  const activeDebtorStats = useMemo(() => {
    if (!activeDebtor) return null;
    const dInsts = installments.filter(
      (i) =>
        i.debtorId === activeDebtor.id ||
        (activeDebtor.name && i.debtorName && i.debtorName.toLowerCase() === activeDebtor.name.toLowerCase())
    );
    const totalCount = dInsts.length;
    const paidCount = dInsts.filter((i) => i.status === 'paid').length;
    const overdueCount = dInsts.filter((i) => i.status === 'overdue' || (i.delayDays || 0) > 0).length;
    const pendingCount = Math.max(0, totalCount - paidCount);

    const totalPaid = dInsts
      .filter((i) => i.status === 'paid')
      .reduce((acc, curr) => acc + (curr.amount || curr.originalAmount || 0), 0);
    const totalDevido = dInsts
      .filter((i) => i.status !== 'paid')
      .reduce((acc, curr) => acc + (curr.amount || curr.originalAmount || 0), 0);
    const totalGeral = totalPaid + totalDevido;
    const percentPaid = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;

    const unitaryItems = getDebtorUnitaryItems(activeDebtor.id, activeDebtor.name, purchases, installments);
    const hasOverdue = overdueCount > 0 || (activeDebtor.overdueCount || 0) > 0;
    const isPaidOff = totalDevido <= 0 && totalCount > 0;

    return {
      totalCount,
      paidCount,
      overdueCount,
      pendingCount,
      totalPaid,
      totalDevido,
      totalGeral,
      percentPaid,
      unitaryItems,
      hasOverdue,
      isPaidOff,
    };
  }, [activeDebtor, installments, purchases]);

  const currentMonthNum = new Date().getMonth() + 1;
  const currentYearNum = new Date().getFullYear();
  const monthAbbrs = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  const currentMonthAbbr = monthAbbrs[currentMonthNum - 1];

  const currentMonthStats = useMemo(() => {
    if (!activeDebtor) return { total: 0, count: 0 };
    const dInsts = installments.filter(
      (i) =>
        i.debtorId === activeDebtor.id ||
        (activeDebtor.name && i.debtorName && i.debtorName.toLowerCase() === activeDebtor.name.toLowerCase())
    );
    const monthInsts = dInsts.filter((i) => {
      if (!i.dueDate) return false;
      const { month, year } = parseDateParts(i.dueDate);
      return month === currentMonthNum && year === currentYearNum;
    });
    const total = monthInsts.reduce((acc, curr) => acc + (curr.amount || curr.originalAmount || 0), 0);
    return { total, count: monthInsts.length };
  }, [activeDebtor, installments, currentMonthNum, currentYearNum]);

  const overdueStats = useMemo(() => {
    if (!activeDebtor) return { total: 0, count: 0 };
    const dInsts = installments.filter(
      (i) =>
        i.debtorId === activeDebtor.id ||
        (activeDebtor.name && i.debtorName && i.debtorName.toLowerCase() === activeDebtor.name.toLowerCase())
    );
    const overdueInsts = dInsts.filter((i) => i.status === 'overdue' || (i.delayDays || 0) > 0);
    const total = overdueInsts.reduce((acc, curr) => acc + (curr.amount || curr.originalAmount || 0), 0);
    return { total, count: overdueInsts.length };
  }, [activeDebtor, installments]);

  // Produtos/compras estritamente do devedor ativo que POSSUEM parcelas dele (elimina 0x e itens de outros devedores)
  const activeDebtorValidProducts = useMemo(() => {
    if (!activeDebtor) return [];
    const dId = activeDebtor.id;
    const dNameLower = (activeDebtor.name || '').toLowerCase().trim();

    // 1. Parcelas reais desse devedor
    const dInsts = installments.filter(
      (i) =>
        i.debtorId === dId ||
        (i.debtorName && i.debtorName.toLowerCase().trim() === dNameLower)
    );

    // 2. Compras reais desse devedor
    const dPurchases = (purchases || []).filter(
      (p) =>
        p.debtorId === dId ||
        (p.debtorName && p.debtorName.toLowerCase().trim() === dNameLower)
    );

    // 3. Obter itens unitários
    const items = getDebtorUnitaryItems(dId, activeDebtor.name, dPurchases, dInsts);

    // 4. Garantir estritamente que só apareçam itens com parcelas reais deste devedor
    return items.filter((it) => it.installments && it.installments.length > 0);
  }, [activeDebtor, purchases, installments]);

  // Se o usuário selecionou uma compra/item, foca nela; senão, exibe todas ('all')
  const isCategoryFilter = Boolean(selectedPurchaseFilter && selectedPurchaseFilter.startsWith('cat:'));
  const activeCategoryKey = isCategoryFilter ? selectedPurchaseFilter.replace('cat:', '') : null;

  const effectivePurchaseFilter = useMemo(() => {
    if (selectedPurchaseFilter === 'all' || !selectedPurchaseFilter || isCategoryFilter) return 'all';
    const match = activeDebtorValidProducts.find(
      (p) =>
        p.id === selectedPurchaseFilter ||
        p.productName.toLowerCase().trim() === selectedPurchaseFilter.toLowerCase().trim() ||
        (p.purchaseId && p.purchaseId === selectedPurchaseFilter)
    );
    if (match) return match.productName;
    return selectedPurchaseFilter;
  }, [selectedPurchaseFilter, activeDebtorValidProducts, isCategoryFilter]);

  // Parcelas filtradas por busca, status e cartão com ordenação matemática estrita
  const filteredInstallments = useMemo(() => {
    const list = debtorInstallments.filter((item) => {
      const q = (searchQuery || localSearch).trim().toLowerCase();
      const debtorNameClean = (item.debtorName || '').toLowerCase();
      const productClean = (item.product || '').toLowerCase();
      const cardNameClean = (item.cardName || '').toLowerCase();
      const authCodeClean = (item.authCode || '').toLowerCase();
      const dueDateClean = String(item.dueDate || '');

      const matchesSearch =
        !q ||
        debtorNameClean.includes(q) ||
        productClean.includes(q) ||
        cardNameClean.includes(q) ||
        authCodeClean.includes(q) ||
        dueDateClean.includes(q);

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'paid' && item.status === 'paid') ||
        (statusFilter === 'ontime' && (item.status === 'soon' || item.status === 'ontime')) ||
        (statusFilter === 'overdue' && (item.status === 'overdue' || (item.delayDays || 0) > 0));

      const itemCardName = (item.cardName || 'Boleto / Pix').trim();
      const matchesCard =
        cardFilter === 'all' || itemCardName.toLowerCase() === cardFilter.toLowerCase();

      const matchesPurchase = isCategoryFilter
        ? getProductCategory(item.product) === activeCategoryKey
        : effectivePurchaseFilter === 'all' ||
          !effectivePurchaseFilter ||
          item.purchaseId === effectivePurchaseFilter ||
          (item.product || '').toLowerCase().trim() === effectivePurchaseFilter.toLowerCase().trim() ||
          `${item.debtorName || 'd'}-${item.product || 'p'}` === effectivePurchaseFilter ||
          (activeDebtorValidProducts.some((p) =>
            (p.id === effectivePurchaseFilter ||
              p.purchaseId === effectivePurchaseFilter ||
              p.productName.toLowerCase().trim() === effectivePurchaseFilter.toLowerCase().trim()) &&
            p.installments.some((pi) => pi.id === item.id)
          ));

      return matchesSearch && matchesStatus && matchesCard && matchesPurchase;
    });

    // Ordenação estrita: 1º por Devedor, 2º por Compra/Produto, 3º por Número da Parcela (1, 2, 3... 12)
    return list.sort((a, b) => {
      // 1. Agrupar estritamente por Devedor (todos do mesmo devedor juntos)
      const nameA = a.debtorName || '';
      const nameB = b.debtorName || '';
      const nameDiff = nameA.localeCompare(nameB, 'pt-BR', { sensitivity: 'base' });
      if (nameDiff !== 0) return nameDiff;

      // 2. Agrupar por Compra/Produto dentro do mesmo devedor (ex: Smart TV vs Notebook)
      const prodA = a.purchaseId || a.product || '';
      const prodB = b.purchaseId || b.product || '';
      const prodDiff = prodA.localeCompare(prodB, 'pt-BR', { sensitivity: 'base' });
      if (prodDiff !== 0) return prodDiff;

      // 3. Ordem matemática sequencial das parcelas: 1 de 12, 2 de 12, 3 de 12, ..., 12 de 12
      return (a.installmentNumber || 1) - (b.installmentNumber || 1);
    });
  }, [debtorInstallments, searchQuery, localSearch, statusFilter, cardFilter, effectivePurchaseFilter, activeDebtorValidProducts, isCategoryFilter, activeCategoryKey]);

  // Itens para o Dropdown "Nome do Devedor" (apenas devedores individuais)
  const debtorDropdownItems = useMemo((): DropdownItem<string>[] => {
    return debtors.map((d) => {
      const isPaid = (d.totalOwed || 0) <= 0;
      const hasOverdue = (d.overdueCount || 0) > 0;
      return {
        id: d.id,
        label: d.name,
        sublabel: d.relation || 'Cliente',
        avatar: d.avatar,
        badge: `R$ ${(d.totalOwed || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`,
        badgeType: isPaid ? 'success' : hasOverdue ? 'danger' : 'default',
        value: d.id,
      };
    });
  }, [debtors]);

  const selectedDebtorItem = useMemo((): DropdownItem<string> | null => {
    const debtorToShow = activeDebtor || debtors.find((d) => d.id === selectedDebtorId) || debtors[0];
    if (!debtorToShow) return null;
    return {
      id: debtorToShow.id,
      label: debtorToShow.name,
      sublabel: debtorToShow.relation || 'Cliente',
      avatar: debtorToShow.avatar,
      badge: `R$ ${(debtorToShow.totalOwed || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`,
      badgeType: (debtorToShow.totalOwed || 0) <= 0 ? 'success' : (debtorToShow.overdueCount || 0) > 0 ? 'danger' : 'default',
      value: debtorToShow.id,
    };
  }, [selectedDebtorId, activeDebtor, debtors]);

  // Itens para o Dropdown "Produto" (estritamente dependente do devedor selecionado)
  const productDropdownItems = useMemo((): DropdownItem<string>[] => {
    if (!activeDebtor || selectedDebtorId === 'all') return [];

    const totalOwed = debtorInstallments
      .filter((i) => i.status !== 'paid')
      .reduce((sum, i) => sum + (i.amount || i.originalAmount || 0), 0);

    const allItem: DropdownItem<string> = {
      id: 'all',
      label: 'Item e Serviços',
      sublabel: `${debtorInstallments.length} parcelas registradas`,
      icon: 'grid_view',
      badge: totalOwed > 0 ? `R$ ${totalOwed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Quitado',
      badgeType: totalOwed <= 0 ? 'success' : 'default',
      value: 'all',
    };

    const productItems: DropdownItem<string>[] = activeDebtorValidProducts.map((prod) => {
      const paidCount = prod.paidInstallments ?? prod.installments.filter((i) => i.status === 'paid').length;
      const totalCount = prod.totalInstallments || prod.installments.length;
      const isPaidOff = prod.isPaidOff || paidCount >= totalCount;
      const remAmount = prod.remainingAmount;

      return {
        id: prod.id,
        label: prod.productName,
        sublabel: `${prod.cardName || 'Cartão'} • ${totalCount} parcelas`,
        icon: getItemIcon(prod.productName),
        badge: isPaidOff ? 'Quitado' : `R$ ${remAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        badgeType: isPaidOff ? 'success' : (prod.overdueInstallments || 0) > 0 ? 'danger' : 'default',
        value: prod.productName,
      };
    });

    return [allItem, ...productItems];
  }, [activeDebtor, selectedDebtorId, debtorInstallments, activeDebtorValidProducts]);

  const selectedProductItem = useMemo((): DropdownItem<string> | null => {
    if (selectedDebtorId === 'all' || !activeDebtor) return null;
    if (!selectedPurchaseFilter || selectedPurchaseFilter === 'all') {
      return {
        id: 'all',
        label: 'Item e Serviços',
        sublabel: 'Consolidado',
        icon: 'grid_view',
        value: 'all',
      };
    }
    const match = productDropdownItems.find(
      (p) => p.id === selectedPurchaseFilter || p.value === selectedPurchaseFilter || p.label === selectedPurchaseFilter
    );
    if (match) return match;
    return {
      id: selectedPurchaseFilter,
      label: selectedPurchaseFilter,
      icon: 'shopping_bag',
      value: selectedPurchaseFilter,
    };
  }, [selectedPurchaseFilter, productDropdownItems, selectedDebtorId, activeDebtor]);

  // Métricas dinâmicas do conjunto atual (refletem fielmente quando filtrado por um item em órbita)
  const countAll = filteredInstallments.length;
  const countOverdue = filteredInstallments.filter(
    (i) => i.status === 'overdue' || (i.delayDays || 0) > 0
  ).length;
  const countOntime = filteredInstallments.filter(
    (i) => i.status === 'soon' || i.status === 'ontime'
  ).length;
  const countPaid = filteredInstallments.filter((i) => i.status === 'paid').length;

  const totalOwedAmount = useMemo(() => {
    return filteredInstallments
      .filter((i) => i.status !== 'paid')
      .reduce((acc, curr) => acc + (curr.amount || curr.originalAmount), 0);
  }, [filteredInstallments]);

  const totalOverdueAmount = useMemo(() => {
    return filteredInstallments
      .filter((i) => i.status === 'overdue' || (i.delayDays || 0) > 0)
      .reduce((acc, curr) => acc + (curr.amount || curr.originalAmount), 0);
  }, [filteredInstallments]);

  const totalPaidAmount = useMemo(() => {
    return filteredInstallments
      .filter((i) => i.status === 'paid')
      .reduce((acc, curr) => acc + (curr.paidAmount || curr.amount || curr.originalAmount), 0);
  }, [filteredInstallments]);

  // Métricas completas e dados gráficos para cada devedor (Modo Relatório Gráfico)
  const debtorsReportData = useMemo(() => {
    // Total consolidado de todos os devedores para cálculo percentual
    const totalAllOwed = installments
      .filter((i) => i.status !== 'paid')
      .reduce((sum, i) => sum + (i.amount || i.originalAmount || 0), 0);
    const totalAllPaid = installments
      .filter((i) => i.status === 'paid')
      .reduce((sum, i) => sum + (i.paidAmount || i.amount || i.originalAmount || 0), 0);
    const totalAllOverdue = installments
      .filter((i) => i.status === 'overdue' || (i.delayDays || 0) > 0)
      .reduce((sum, i) => sum + (i.amount || i.originalAmount || 0), 0);
    const totalAllCombined = totalAllOwed + totalAllPaid;

    const list = debtors.map((d) => {
      const dName = (d.name || '').toLowerCase();
      const dInsts = installments.filter(
        (i) => i.debtorId === d.id || (i.debtorName && i.debtorName.toLowerCase() === dName)
      );

      const owed = dInsts
        .filter((i) => i.status !== 'paid')
        .reduce((sum, i) => sum + (i.amount || i.originalAmount || 0), 0);
      const paid = dInsts
        .filter((i) => i.status === 'paid')
        .reduce((sum, i) => sum + (i.paidAmount || i.amount || i.originalAmount || 0), 0);
      const overdue = dInsts
        .filter((i) => i.status === 'overdue' || (i.delayDays || 0) > 0)
        .reduce((sum, i) => sum + (i.amount || i.originalAmount || 0), 0);
      const ontime = dInsts
        .filter((i) => i.status === 'soon' || i.status === 'ontime')
        .reduce((sum, i) => sum + (i.amount || i.originalAmount || 0), 0);

      const totalDebt = owed + paid;
      const paidPct = totalDebt > 0 ? Math.round((paid / totalDebt) * 100) : 100;
      const overduePct = totalDebt > 0 ? Math.round((overdue / totalDebt) * 100) : 0;
      const ontimePct = totalDebt > 0 ? Math.max(0, 100 - paidPct - overduePct) : 0;
      const shareOfTotal = totalAllOwed > 0 ? Math.round((owed / totalAllOwed) * 100) : 0;

      const overdueCount = dInsts.filter(
        (i) => i.status === 'overdue' || (i.delayDays || 0) > 0
      ).length;
      const paidCount = dInsts.filter((i) => i.status === 'paid').length;
      const ontimeCount = dInsts.filter((i) => i.status === 'soon' || i.status === 'ontime').length;

      return {
        ...d,
        owedAmount: owed,
        paidAmount: paid,
        overdueAmount: overdue,
        ontimeAmount: ontime,
        totalDebt,
        paidPct,
        overduePct,
        ontimePct,
        shareOfTotal,
        overdueCount,
        paidCount,
        ontimeCount,
        totalInstsCount: dInsts.length,
      };
    });

    return {
      debtorsList: list,
      totalAllOwed,
      totalAllPaid,
      totalAllOverdue,
      totalAllCombined,
      paidAllPct: totalAllCombined > 0 ? Math.round((totalAllPaid / totalAllCombined) * 100) : 0,
      overdueAllPct: totalAllCombined > 0 ? Math.round((totalAllOverdue / totalAllCombined) * 100) : 0,
    };
  }, [debtors, installments]);

  // Handler de Cópia Rápida para Cobrança
  const handleCopyBillingData = (item: Installment, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const isOverdue = item.status === 'overdue' || (item.delayDays || 0) > 0;
    const finalAmount = isOverdue
      ? item.originalAmount + 5.0
      : (item.amount || item.originalAmount);
    const debtor = debtors.find((d) => d.id === item.debtorId) || currentDebtor;
    const pixKeyToUse = debtor?.pixKey || userPixKey || 'tiagodias8888@gmail.com';

    const message = `*HASPAHO • Cobrança de Parcela*
Olá, ${item.debtorName}!
Segue os dados para conferência e pagamento da sua parcela:

📦 *Item:* ${item.product} (Parcela ${item.installmentNumber}/${item.totalInstallments})
📅 *Vencimento:* ${item.dueDate}
💰 *Valor:* R$ ${finalAmount.toFixed(2).replace('.', ',')}
${isOverdue ? '⚠️ *Situação:* ATRASADA (+R$ 5,00 taxa de atraso inclusa)\n' : ''}💳 *Forma/Cartão:* ${item.cardName || 'Boleto / Pix'}
🔑 *Chave PIX:* ${pixKeyToUse}

Por gentileza, após a transferência, envie o comprovante por aqui. Muito obrigado!`;

    navigator.clipboard.writeText(message);
    setCopiedInstallmentId(item.id);
    setTimeout(() => {
      setCopiedInstallmentId((prev) => (prev === item.id ? null : prev));
    }, 2500);

    if (onToast) {
      onToast(`Dados de cobrança da parcela #${item.installmentNumber} copiados!`);
    }
  };

  // Se não houver devedores cadastrados
  if (debtors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 sm:p-14 bg-white rounded-2xl border-2 border-dashed border-slate-200 shadow-2xs text-center my-6 space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
          <span className="material-symbols-outlined text-[36px]">receipt_long</span>
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">
            Nenhuma parcela encontrada
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
            Cadastre seu primeiro devedor ou lance uma nova compra para gerar a grade de parcelas.
          </p>
        </div>
        {onOpenNewDebtor && (
          <button
            type="button"
            onClick={onOpenNewDebtor}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-xs"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            <span>+ Cadastrar Devedor</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full gap-3 sm:gap-4 pb-24 text-slate-900">



      {/* ============================================================ */}
      {/* 5. VISÃO EM PLANILHA PADRONIZADA (COM CARD LATERAL DO DEVEDOR) */}
      {/* ============================================================ */}
      {viewMode === 'table' ? (
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* ============================================================ */}
          {/* COLUNA ESQUERDA: BARRA DE SELEÇÃO + CARD DO DEVEDOR          */}
          {/* ============================================================ */}
          {activeDebtor && activeDebtorStats && (
            <div className="lg:col-span-4 xl:col-span-4 flex flex-col gap-3.5 sticky top-4">
              
              {/* BARRINHA DE SELEÇÃO POR DROPDOWN (MENU SUSPENSO INTERATIVO) */}
              <div className="w-full flex flex-col gap-2 relative">
                {/* A Barra com Dropdown de Devedor e Dropdown de Produto (Sem Lupa) */}
                <div className="bg-white/95 p-2 sm:p-2.5 rounded-2xl border border-cyan-300/80 shadow-xs grid grid-cols-1 sm:grid-cols-2 gap-2 w-full select-none">
                  {/* 1. DROPDOWN "Pessoa" (Somente o nome da pessoa) */}
                  <SearchableDropdown
                    placeholder="Nome da Pessoa"
                    selectedItem={selectedDebtorItem}
                    items={debtorDropdownItems}
                    isOpen={activeDropdown === 'debtor'}
                    onToggle={() =>
                      setActiveDropdown((prev) => (prev === 'debtor' ? null : 'debtor'))
                    }
                    onClose={() => setActiveDropdown(null)}
                    onSelect={(item) => {
                      handleSelectDebtor(item.value);
                      setSelectedPurchaseFilter('all');
                      setActiveDropdown(null);
                    }}
                    showSearch={false}
                    accentColor="cyan"
                    dropdownAlign="left"
                    displayMode="inline"
                  />

                  {/* 2. DROPDOWN "Item e Serviços" (Somente Item e Serviços) */}
                  <SearchableDropdown
                    placeholder="Item e Serviços"
                    selectedItem={selectedProductItem}
                    items={productDropdownItems}
                    isOpen={activeDropdown === 'product'}
                    onToggle={() =>
                      setActiveDropdown((prev) => (prev === 'product' ? null : 'product'))
                    }
                    onClose={() => setActiveDropdown(null)}
                    onSelect={(item) => {
                      setSelectedPurchaseFilter(item.value);
                      setActiveDropdown(null);
                    }}
                    disabled={selectedDebtorId === 'all' || !activeDebtor}
                    disabledMessage="Selecione primeiro um devedor"
                    showSearch={false}
                    accentColor="cyan"
                    dropdownAlign="right"
                    displayMode="inline"
                  />
                </div>
              </div>

              {/* Card Principal com Todas as Informações do Devedor (COM LUZ) */}
              <div className="bg-white/95 rounded-3xl border-2 border-cyan-400/70 ring-2 ring-cyan-400/40 shadow-[0_0_28px_rgba(6,182,212,0.22)] p-4 sm:p-5 flex flex-col gap-4 select-none relative overflow-hidden text-slate-900">
                {/* Topo do Card */}
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                  <span className="text-[11px] font-black uppercase tracking-wider text-cyan-800 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-cyan-600">badge</span>
                    <span>Card do Devedor</span>
                  </span>
                  
                  {activeDebtorStats.hasOverdue ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-bold text-[10.5px] animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      <span>{activeDebtorStats.overdueCount} atrasada(s)</span>
                    </span>
                  ) : activeDebtorStats.isPaidOff ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[10.5px]">
                      <span>Quitado</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10.5px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>Em dia</span>
                    </span>
                  )}
                </div>

                {/* Identificação Principal (Avatar, Nome, Relação) */}
                <div className="flex items-center gap-3.5">
                  <div className="relative shrink-0">
                    <SafeDebtorAvatar
                      name={activeDebtor.name}
                      avatar={activeDebtor.avatar}
                      size="md"
                      status={activeDebtorStats.hasOverdue ? 'late' : 'ok'}
                      className="ring-2 ring-cyan-400 shadow-sm"
                    />
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#1d9bf0] text-white flex items-center justify-center text-[9px] font-black ring-1 ring-white shadow-xs">
                      ✓
                    </span>
                  </div>

                  <div className="flex flex-col min-w-0 leading-tight">
                    <h3 className="font-black text-slate-900 text-base sm:text-lg truncate">
                      {activeDebtor.name}
                    </h3>
                    <span className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                      {activeDebtor.relation || 'Cliente'} • Cadastrado(a)
                    </span>
                  </div>
                </div>

                {/* Dados de Contato e Documentos */}
                <div className="bg-slate-50/90 p-3 rounded-2xl border border-slate-200/80 flex flex-col gap-2 text-xs">
                  {activeDebtor.phone ? (
                    <div className="flex items-center justify-between gap-1 text-slate-700">
                      <span className="flex items-center gap-1 text-slate-500 font-medium text-[11px]">
                        <span className="material-symbols-outlined text-[15px] text-emerald-600">phone</span>
                        <span>WhatsApp / Tel:</span>
                      </span>
                      <span className="font-mono font-bold text-slate-800 text-[11.5px]">{activeDebtor.phone}</span>
                    </div>
                  ) : null}

                  {activeDebtor.cpfCnpj ? (
                    <div className="flex items-center justify-between gap-1 text-slate-700">
                      <span className="flex items-center gap-1 text-slate-500 font-medium text-[11px]">
                        <span className="material-symbols-outlined text-[15px] text-slate-500">fingerprint</span>
                        <span>CPF / CNPJ:</span>
                      </span>
                      <span className="font-mono font-bold text-slate-800 text-[11.5px]">{activeDebtor.cpfCnpj}</span>
                    </div>
                  ) : null}

                  {activeDebtor.city ? (
                    <div className="flex items-center justify-between gap-1 text-slate-700">
                      <span className="flex items-center gap-1 text-slate-500 font-medium text-[11px]">
                        <span className="material-symbols-outlined text-[15px] text-slate-500">location_on</span>
                        <span>Localidade:</span>
                      </span>
                      <span className="font-medium text-slate-800 text-[11.5px]">{activeDebtor.city}</span>
                    </div>
                  ) : null}
                </div>

                {/* Métricas Financeiras Completas */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      playAppSound('pop');
                      setActiveKpiModal('open');
                    }}
                    className="indicator-card financial-container p-3 rounded-2xl bg-amber-50/70 hover:bg-amber-100/90 border-2 border-amber-200/90 hover:border-amber-400 hover:ring-2 hover:ring-amber-400/50 hover:shadow-[0_0_24px_rgba(245,158,11,0.45)] text-left transition-all duration-300 active:scale-95 cursor-pointer group shadow-2xs relative overflow-hidden"
                    title={`Toque para ver o detalhamento do total em aberto de ${activeDebtor.name}`}
                  >
                    {/* Animação de brilho suave e halo radial */}
                    <div className="absolute -top-8 -right-8 w-20 h-20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-amber-400/30" />
                    <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none bg-gradient-to-r from-transparent via-amber-300/30 to-transparent skew-x-12" />

                    <div className="relative z-10 flex items-center justify-between gap-1">
                      <span className="text-[10px] uppercase font-bold text-amber-800 block truncate group-hover:text-amber-950 transition-colors">Total em Aberto</span>
                      <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full bg-amber-200/90 text-amber-900 border border-amber-300 shrink-0 flex items-center gap-0.5 group-hover:bg-amber-300/90 transition-colors">
                        <span className="w-1 h-1 rounded-full bg-amber-600 animate-pulse"></span>
                        Interativo
                      </span>
                    </div>
                    <span className="relative z-10 text-base font-black font-mono text-amber-700 block mt-0.5 group-hover:text-amber-800 transition-colors">
                      R$ {activeDebtorStats.totalDevido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="relative z-10 text-[10px] text-amber-600 font-medium block">
                      {activeDebtorStats.pendingCount} parcela(s) pendente(s)
                    </span>
                    <div className="relative z-10 mt-1 pt-1 border-t border-amber-200/60 flex items-center justify-between text-[9px] font-bold text-amber-700 group-hover:text-amber-900">
                      <span>Ver faturas</span>
                      <span className="material-symbols-outlined text-[11px] group-hover:translate-x-0.5 transition-transform">chevron_right</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      playAppSound('success');
                      setActiveKpiModal('paid');
                    }}
                    className="indicator-card financial-container p-3 rounded-2xl bg-emerald-50/70 hover:bg-emerald-100/90 border-2 border-emerald-200/90 hover:border-emerald-400 hover:ring-2 hover:ring-emerald-400/50 hover:shadow-[0_0_24px_rgba(16,185,129,0.45)] text-left transition-all duration-300 active:scale-95 cursor-pointer group shadow-2xs relative overflow-hidden"
                    title={`Toque para ver o detalhamento do total quitado de ${activeDebtor.name}`}
                  >
                    {/* Animação de brilho suave e halo radial */}
                    <div className="absolute -top-8 -right-8 w-20 h-20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-emerald-400/30" />
                    <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none bg-gradient-to-r from-transparent via-emerald-300/30 to-transparent skew-x-12" />

                    <div className="relative z-10 flex items-center justify-between gap-1">
                      <span className="text-[10px] uppercase font-bold text-emerald-800 block truncate group-hover:text-emerald-950 transition-colors">Total Quitado</span>
                      <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full bg-emerald-200/90 text-emerald-900 border border-emerald-300 shrink-0 flex items-center gap-0.5 group-hover:bg-emerald-300/90 transition-colors">
                        <span className="w-1 h-1 rounded-full bg-emerald-600 animate-pulse"></span>
                        Interativo
                      </span>
                    </div>
                    <span className="relative z-10 text-base font-black font-mono text-emerald-700 block mt-0.5 group-hover:text-emerald-800 transition-colors">
                      R$ {activeDebtorStats.totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="relative z-10 text-[10px] text-emerald-600 font-medium block">
                      {activeDebtorStats.paidCount} parcela(s) liquidada(s)
                    </span>
                    <div className="relative z-10 mt-1 pt-1 border-t border-emerald-200/60 flex items-center justify-between text-[9px] font-bold text-emerald-700 group-hover:text-emerald-900">
                      <span>Ver faturas</span>
                      <span className="material-symbols-outlined text-[11px] group-hover:translate-x-0.5 transition-transform">chevron_right</span>
                    </div>
                  </button>
                </div>

                {/* Barra de Progresso Geral de Quitação (Interativa com Brilho Suave) */}
                <button
                  type="button"
                  onClick={() => {
                    playAppSound('success');
                    setActiveKpiModal('paid');
                  }}
                  className="indicator-card financial-container flex flex-col gap-1.5 p-2 rounded-xl bg-slate-50/80 hover:bg-cyan-50/60 border border-slate-200 hover:border-cyan-300 hover:shadow-[0_0_18px_rgba(6,182,212,0.3)] transition-all duration-300 cursor-pointer text-left group relative overflow-hidden"
                  title="Toque para ver o histórico e percentual detalhado de quitação"
                >
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none bg-gradient-to-r from-transparent via-cyan-300/20 to-transparent skew-x-12" />
                  <div className="relative z-10 flex items-center justify-between text-[11px] font-bold">
                    <span className="text-slate-600 group-hover:text-slate-900 flex items-center gap-1">
                      <span>Progresso Geral</span>
                      <span className="text-[8px] font-black uppercase px-1 py-0.2 rounded bg-cyan-100 text-cyan-800">Interativo</span>
                    </span>
                    <span className="font-mono text-cyan-700 group-hover:text-cyan-800 font-black">{activeDebtorStats.percentPaid}% pago</span>
                  </div>
                  <div className="relative z-10 w-full h-2.5 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full transition-all duration-300 group-hover:brightness-110"
                      style={{ width: `${Math.min(100, activeDebtorStats.percentPaid)}%` }}
                    />
                  </div>
                </button>

                {/* Itens / Produtos Vinculados */}
                {activeDebtorStats.unitaryItems.length > 0 && (
                  <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Produtos Vinculados ({activeDebtorStats.unitaryItems.length}):
                      </span>
                      {selectedPurchaseFilter && selectedPurchaseFilter !== 'all' && (
                        <button
                          type="button"
                          onClick={() => setSelectedPurchaseFilter('all')}
                          className="text-[10px] text-blue-600 hover:underline font-bold cursor-pointer"
                        >
                          Limpar filtro
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {activeDebtorStats.unitaryItems.map((item) => {
                        const isSelected = selectedPurchaseFilter === item.productName || selectedPurchaseFilter === item.purchaseId;
                        return (
                          <div
                            key={item.id}
                            className={`inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-xl font-bold text-[11px] border transition-all ${
                              isSelected
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs scale-102'
                                : 'bg-slate-100/90 hover:bg-slate-200 text-slate-800 border-slate-200'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setSelectedPurchaseFilter(isSelected ? 'all' : item.productName)}
                              className="inline-flex items-center gap-1.5 cursor-pointer text-left"
                              title={`Filtrar planilha por ${item.productName}`}
                            >
                              <span className="material-symbols-outlined text-[14px]">{item.icon}</span>
                              <span className="truncate max-w-[110px]">{item.shortName || item.productName}</span>
                              <span className="text-[9.5px] opacity-80 font-mono">({item.installments.length}x)</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenProductPrint(item.productName, activeDebtor.name, item.purchaseId);
                              }}
                              className={`p-0.5 rounded hover:bg-black/10 active:scale-95 transition-all cursor-pointer ${
                                isSelected ? 'text-white' : 'text-blue-600'
                              }`}
                              title={`Ver ou carregar print da compra de ${item.productName}`}
                            >
                              <span className="material-symbols-outlined text-[13px]">photo_camera</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Ações Rápidas no Card */}
                <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                  <div className="grid grid-cols-2 gap-2">
                    {/* Opção Whats: Abre direto o WhatsApp da pessoa sem mensagem pronta */}
                    <button
                      type="button"
                      onClick={() => handleOpenWhatsDirect(activeDebtor.phone, activeDebtor.name)}
                      className="py-2 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer"
                      title={`Abrir WhatsApp de ${activeDebtor.name}`}
                    >
                      <WhatsAppIcon className="w-4 h-4 text-white" size={15} />
                      <span>Whats</span>
                    </button>

                    {/* Linha Extrato substituída por PDFs de documentos */}
                    <button
                      type="button"
                      onClick={() => setIsPdfsAndDocsModalOpen(true)}
                      className="py-2 px-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer"
                      title="Abrir PDFs de documentos da pessoa (Extrato, Contrato e Recibo)"
                    >
                      <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
                      <span>PDFs de documentos</span>
                    </button>
                  </div>

                  {onEditDebtor && (
                    <button
                      type="button"
                      onClick={() => onEditDebtor(activeDebtor)}
                      className="w-full py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-200 transition-all cursor-pointer shadow-2xs"
                      title="Editar cadastro da pessoa"
                    >
                      <span className="material-symbols-outlined text-[15px]">edit</span>
                      <span>Editar Cadastro</span>
                    </button>
                  )}
                 </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* COLUNA DIREITA: PLANILHA FINANCEIRA (COM LUZ)                */}
          {/* ============================================================ */}
          <div className={`${activeDebtor && activeDebtorStats ? 'lg:col-span-8 xl:col-span-8' : 'lg:col-span-12'} flex flex-col gap-3 min-w-0 w-full`}>
            <div id="parcelas-spreadsheet-table" className="bg-white/90 backdrop-blur-md rounded-xl sm:rounded-2xl border-2 border-cyan-400/60 ring-2 ring-cyan-400/30 shadow-[0_0_28px_rgba(6,182,212,0.2)] overflow-hidden w-full">
          {/* Barra de Informação da Planilha Compacta - TEMA BRANCO PADRONIZADO */}
          <div className="px-3.5 py-2.5 bg-white/95 backdrop-blur-md border-b border-slate-200 text-slate-850 flex items-center justify-between font-bold flex-wrap gap-2 shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-cyan-50 text-cyan-700 border border-cyan-200/80 flex items-center justify-center shrink-0 shadow-2xs">
                <span className="material-symbols-outlined text-[17px]">table_chart</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider">
                  Planilha Financeira de Parcelas
                </h3>
                <span className="text-cyan-600 font-extrabold text-sm sm:text-base">•</span>
                <span className="text-cyan-700 font-black text-xs sm:text-sm uppercase tracking-wider">
                  {activeDebtor?.name || 'Jubileu'}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-800 border border-cyan-200 text-[10px] font-mono font-bold ml-1">
                  {filteredInstallments.length} {filteredInstallments.length === 1 ? 'item' : 'itens'}
                </span>
              </div>
            </div>
          </div>

          <div className="w-full overflow-x-auto scrollbar-thin">
            <table className="w-full text-center text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/95 text-slate-700 font-extrabold uppercase text-[9px] sm:text-[10px] tracking-wider border-b border-slate-200/80 select-none shadow-2xs">
                  {/* Col 1: PARCELAS / VENC. */}
                  <th className="py-2.5 px-2 text-center w-[20%] sm:w-28 whitespace-nowrap text-cyan-800">
                    <span className="sm:hidden">PARC. / VENC.</span>
                    <span className="hidden sm:inline">PARCELAS / VENC.</span>
                  </th>
                  {/* Col 2: DEVEDOR */}
                  <th className="py-2.5 px-2 text-center w-[22%] sm:w-36 whitespace-nowrap text-slate-800">
                    DEVEDOR
                  </th>
                  {/* Col 3: ITEM */}
                  <th className="py-2.5 px-2 text-center w-[26%] sm:w-40 whitespace-nowrap text-cyan-800">
                    <span className="sm:hidden">ITENS/SERV.</span>
                    <span className="hidden sm:inline">ITENS E SERVIÇOS</span>
                  </th>
                  {/* Col 4: CARTÃO (Desktop) */}
                  <th className="hidden md:table-cell py-2.5 px-2 text-center md:w-36 whitespace-nowrap text-slate-700">
                    CARTÃO / FORMA
                  </th>
                  {/* Col 5: VALOR */}
                  <th className="py-2.5 px-2 text-center w-[32%] sm:w-36 whitespace-nowrap text-amber-800 font-black">
                    <span>VALOR</span>
                  </th>
                  {/* Col 6: SITUAÇÃO (Desktop) */}
                  <th className="hidden sm:table-cell py-2.5 px-2 text-center sm:w-28 whitespace-nowrap text-slate-700">
                    SITUAÇÃO
                  </th>
                  {/* Col 7: AÇÕES (Desktop) */}
                  <th className="hidden sm:table-cell py-2.5 px-2 text-center sm:w-32 whitespace-nowrap text-cyan-800">
                    AÇÕES
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {filteredInstallments.map((item, idx) => {
                  const prevItem = idx > 0 ? filteredInstallments[idx - 1] : null;
                  const itemDebtorName = (item.debtorName || '').toLowerCase();
                  const prevDebtorName = (prevItem?.debtorName || '').toLowerCase();
                  const isNewDebtor = !prevItem || prevDebtorName !== itemDebtorName;
                  const isOverdue = item.status === 'overdue' || (item.delayDays || 0) > 0;
                  const isPaid = item.status === 'paid';
                  const isSoon = item.status === 'soon';
                  const finalAmount = item.amount || item.originalAmount;
                  const itemIconName = getItemIcon(item.product);
                  const cardBadge = getCardBadgeInfo(item.cardName);
                  const authCode = item.authCode || generateAuthCode();

                  return (
                    <React.Fragment key={item.id}>
                      {isNewDebtor && selectedDebtorId === 'all' && (
                        <tr className="bg-slate-100 text-slate-800 font-bold select-none border-t border-slate-200">
                          <td colSpan={7} className="py-1.5 px-2 sm:px-3 text-left">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[15px] text-amber-600">person</span>
                                <span className="font-extrabold text-xs sm:text-sm uppercase tracking-wide text-slate-900">
                                  {item.debtorName || 'Devedor'}
                                </span>
                                <span className="text-[9.5px] sm:text-[10px] bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full font-mono font-bold">
                                  {filteredInstallments.filter((i) => (i.debtorName || '').toLowerCase() === itemDebtorName).length} parcelas sequenciais
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const d = debtors.find(
                                    (deb) =>
                                      (deb.name && deb.name.toLowerCase() === itemDebtorName) ||
                                      deb.id === item.debtorId
                                  );
                                  if (d) handleSelectDebtor(d.id);
                                }}
                                className="text-[10px] sm:text-xs text-blue-300 hover:text-white underline cursor-pointer font-bold"
                              >
                                Ver só {item.debtorName.split(' ')[0]} →
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                      <tr
                        onClick={() => setSelectedInstallmentForDetail(item)}
                        className={`transition-all duration-150 cursor-pointer border-b border-slate-200/70 relative hover:z-10 hover:shadow-xs ${
                          isPaid
                            ? idx % 2 === 1
                              ? 'bg-gradient-to-r from-slate-100/75 via-emerald-50/30 to-slate-100/75 hover:from-slate-150 hover:via-emerald-50 hover:to-slate-150'
                              : 'bg-gradient-to-r from-white via-emerald-50/20 to-white hover:from-emerald-50/30 hover:to-white'
                            : isOverdue
                            ? idx % 2 === 1
                              ? 'bg-gradient-to-r from-slate-100/80 via-rose-50/35 to-slate-100/80 hover:from-slate-150 hover:via-rose-50 hover:to-slate-150'
                              : 'bg-gradient-to-r from-white via-rose-50/25 to-white hover:from-rose-50/30 hover:to-white'
                            : idx % 2 === 1
                            ? 'bg-gradient-to-r from-slate-100/80 via-slate-50/90 to-slate-100/80 hover:from-slate-150 hover:via-slate-50 hover:to-slate-150'
                            : 'bg-gradient-to-r from-white via-slate-50/40 to-white hover:from-slate-50 hover:to-white'
                        }`}
                      >
                        {/* Coluna 1: PARCELAS E VENCIMENTO com linha de ramificação */}
                        <td className="py-2 pl-3 pr-1 sm:px-2 text-center align-middle whitespace-nowrap">
                          <div className="flex items-center gap-2 justify-center">
                            {/* Linha de ramificação interligando os elementos (Estilo Ramificado) */}
                            <div className="relative w-4 self-stretch min-h-[36px] flex items-center justify-center shrink-0">
                              {/* Linha vertical tracejada */}
                              <div className="absolute top-0 bottom-0 left-2 w-[1.5px] border-l-2 border-dashed border-cyan-400/40" />
                              {/* Linha horizontal tracejada para conectar ao card */}
                              <div className="absolute top-1/2 left-2 w-2 h-[1.5px] border-t-2 border-dashed border-cyan-400/40" />
                              {/* Ponto focal de junção iluminado */}
                              <div className="absolute top-1/2 left-2 -translate-x-[2px] -translate-y-[2px] w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee] z-10" />
                            </div>

                            <div className="flex flex-col items-center justify-center leading-tight gap-1">
                              {/* Número da parcela */}
                              <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200/90 font-mono text-[9px] sm:text-[10px] font-bold leading-none shadow-2xs">
                                {item.installmentNumber}/{item.totalInstallments}
                              </span>
                              {/* Data do vencimento */}
                              <div className="inline-flex items-center justify-center gap-0.5 px-1.5 py-0.5 rounded-md bg-slate-50 text-slate-700 border border-slate-200/90 font-mono text-[8.5px] sm:text-[9.5px] font-semibold leading-none shadow-2xs">
                                <span className="material-symbols-outlined text-[9px] sm:text-[10px] text-slate-500 shrink-0">
                                  calendar_today
                                </span>
                                <span className="sm:hidden">{formatDueDateShort(item.dueDate)}</span>
                                <span className="hidden sm:inline">{item.dueDate}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Coluna 2: DEVEDOR */}
                        <td className="py-2.5 px-1 sm:px-2 text-center align-middle whitespace-nowrap">
                          <div className="flex flex-col items-center justify-center leading-tight gap-1 min-w-0">
                            <SafeDebtorAvatar
                              name={item.debtorName}
                              size="md"
                              status={isOverdue ? 'late' : 'ok'}
                              className="shrink-0 shadow-xs"
                            />
                            <div
                              className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-md bg-slate-50 text-slate-900 border border-slate-200/90 font-bold text-[9px] sm:text-[10px] shadow-2xs leading-none truncate max-w-[75px] sm:max-w-[100px]"
                              title={item.debtorName}
                            >
                              {item.debtorName.trim().split(/\s+/)[0]}
                            </div>
                          </div>
                        </td>

                        {/* Coluna 3: ITEM */}
                        <td className="py-2.5 px-1 sm:px-2 text-center align-middle whitespace-nowrap">
                          <div className="flex flex-col items-center justify-center leading-tight gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenProductPrint(item.product, item.debtorName, item.purchaseId);
                              }}
                              className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50/90 hover:bg-blue-100 text-blue-900 border border-blue-200/90 font-bold text-[9.5px] sm:text-[11px] shadow-2xs leading-tight max-w-[110px] sm:max-w-[150px] transition-all cursor-pointer group active:scale-95"
                              title={`Clique para visualizar o print da compra de ${item.product}`}
                            >
                              <span className="material-symbols-outlined text-[13px] sm:text-[14px] text-blue-600 group-hover:scale-110 transition-transform shrink-0">
                                {itemIconName}
                              </span>
                              <span className="truncate">{item.product}</span>
                              <span className="material-symbols-outlined text-[11px] text-blue-400 group-hover:text-blue-700 shrink-0 ml-0.5" title="Ver print da compra">
                                photo_camera
                              </span>
                            </button>

                            {/* Situação compacta visível no mobile */}
                            <div className="sm:hidden">
                              {isPaid ? (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[8px] font-bold">
                                  <span className="material-symbols-outlined text-[9px]">check_circle</span>
                                  <span>PAGO</span>
                                </span>
                              ) : isOverdue ? (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-red-100 text-red-700 text-[8px] font-bold">
                                  <span className="material-symbols-outlined text-[9px]">warning</span>
                                  <span>ATRASO</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[8px] font-bold">
                                  <span>A VENCER</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Coluna 4: CARTÃO (Desktop) */}
                        <td className="hidden md:table-cell py-2.5 px-2 text-center align-middle whitespace-nowrap">
                          <span
                            className={`inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${cardBadge.colorClass}`}
                          >
                            <span className="material-symbols-outlined text-[13px]">{cardBadge.icon}</span>
                            <span className="truncate max-w-[110px]">{item.cardName || 'Boleto / Pix'}</span>
                          </span>
                        </td>

                        {/* Coluna 5: VALOR */}
                        <td className="py-2.5 px-1 sm:px-2 text-center align-middle whitespace-nowrap">
                          <div className="flex items-center justify-center">
                            {/* Valor formatado */}
                            <div className="inline-flex items-center justify-center">
                              {isPaid ? (
                                <span className="font-mono text-[10px] sm:text-xs font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200 shadow-2xs">
                                  R$ {safeFormatCurrency(finalAmount)}
                                </span>
                              ) : isOverdue ? (
                                <div className="flex flex-col items-center leading-none">
                                  <span className="font-mono text-[10px] sm:text-xs font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-md border border-red-200 shadow-2xs flex items-center gap-0.5">
                                    <span className="material-symbols-outlined text-[11px] text-red-500 animate-pulse font-bold">warning</span>
                                    R$ {safeFormatCurrency(finalAmount)}
                                  </span>
                                  <span className="text-[7.5px] font-bold text-red-600 mt-0.5">+R$5 taxa</span>
                                </div>
                              ) : (
                                <span className="font-mono text-[10px] sm:text-xs font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-200 shadow-2xs">
                                  R$ {safeFormatCurrency(finalAmount)}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Coluna 6: SITUAÇÃO (Desktop) */}
                        <td className="hidden sm:table-cell py-2.5 px-2 text-center align-middle whitespace-nowrap">
                          {isPaid ? (
                            <span className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                              <span className="material-symbols-outlined text-[12px]">check_circle</span>
                              <span>PAGO</span>
                            </span>
                          ) : isOverdue ? (
                            <span className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-300 text-[10px] font-black animate-pulse">
                              <span className="material-symbols-outlined text-[12px]">warning</span>
                              <span>ATRASADA</span>
                            </span>
                          ) : isSoon ? (
                            <span className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-300 text-[10px] font-bold">
                              <span className="material-symbols-outlined text-[12px]">schedule</span>
                              <span>A VENCER</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              <span>EM DIA</span>
                            </span>
                          )}
                        </td>

                        {/* Coluna 7: AÇÕES EXTRAS NO DESKTOP */}
                        <td className="hidden sm:table-cell py-2.5 px-2 text-center align-middle whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {isOverdue && !isPaid && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRecalcModalItem(item);
                                  setRecalcDays(item.delayDays || 9);
                                }}
                                className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-colors cursor-pointer shadow-2xs flex items-center justify-center"
                                title="Recalcular juros diários de mora e multa CDC"
                              >
                                <span className="material-symbols-outlined text-[15px]">calculate</span>
                              </button>
                            )}

                             {!isPaid && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyBillingData(item, e);
                                  onNudgeWhatsApp(
                                    item.debtorName,
                                    `R$ ${safeFormatCurrency(finalAmount)}`,
                                    item.product,
                                    `${item.installmentNumber}/${item.totalInstallments}`
                                  );
                                }}
                                className={`px-2 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1 ${
                                  copiedInstallmentId === item.id
                                    ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-200'
                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300'
                                }`}
                                title="Enviar cobrança via WhatsApp (e copiar dados)"
                              >
                                <WhatsAppIcon className="w-4 h-4 text-emerald-600" size={16} />
                                <span className="text-[11px] font-bold">WhatsApp</span>
                              </button>
                            )}

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedInstallmentForDetail(item);
                                }}
                                className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 flex items-center justify-center transition-colors cursor-pointer shadow-2xs active:scale-95 shrink-0"
                                title="Ver detalhes da situação e ações da parcela"
                              >
                                <span className="material-symbols-outlined text-[18px]">visibility</span>
                              </button>

                              {onDeleteInstallment && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteInstallment(item.id);
                                  }}
                                  className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 flex items-center justify-center transition-colors cursor-pointer shadow-2xs active:scale-95 shrink-0"
                                  title="Excluir parcela permanentemente"
                                >
                                  <span className="material-symbols-outlined text-[18px]">delete</span>
                                </button>
                              )}
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}

                {filteredInstallments.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto px-4">
                        <span className="material-symbols-outlined text-[36px] text-slate-300">
                          search_off
                        </span>
                        <h4 className="font-bold text-slate-800 text-sm">
                          {currentDebtor
                            ? `Nenhuma parcela encontrada para ${currentDebtor.name} com os filtros atuais.`
                            : 'Nenhuma parcela encontrada com os filtros selecionados.'}
                        </h4>
                        <p className="text-xs text-slate-500">
                          {currentDebtor && debtorInstallments.length > 0
                            ? `Existem ${debtorInstallments.length} parcelas de ${currentDebtor.name} cadastradas no sistema.`
                            : 'Tente alterar os termos de busca ou limpar os filtros de situação e banco.'}
                        </p>

                        <div className="flex items-center gap-2 flex-wrap justify-center mt-2">
                          {(localSearch || statusFilter !== 'all' || cardFilter !== 'all' || selectedPurchaseFilter !== 'all') && (
                            <button
                              type="button"
                              onClick={() => {
                                setLocalSearch('');
                                setStatusFilter('all');
                                setCardFilter('all');
                                setSelectedPurchaseFilter('all');
                              }}
                              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[15px]">filter_alt_off</span>
                              <span>Limpar Filtros e Ver Todas</span>
                            </button>
                          )}

                          {currentDebtor && onOpenNewPurchase && (
                            <button
                              type="button"
                              onClick={() => onOpenNewPurchase(currentDebtor.id)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs border border-emerald-200 transition-all cursor-pointer flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[15px]">add_circle</span>
                              <span>+ Nova Compra para {currentDebtor.name ? currentDebtor.name.split(' ')[0] : 'Devedor'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>

              {filteredInstallments.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100/90 font-bold text-slate-800 text-[10px] sm:text-xs border-t border-slate-200">
                    <td colSpan={2} className="py-2 px-2 sm:px-3 text-left">
                      <span className="font-mono font-bold">Total: {filteredInstallments.length} parcelas</span>
                    </td>
                    <td className="py-2 px-2 text-left text-[10px] text-slate-500">
                      <span>Soma Geral:</span>
                    </td>
                    <td className="hidden md:table-cell" />
                    <td className="py-2 px-2 text-right">
                      <span className="font-mono text-xs sm:text-sm font-black text-slate-900 leading-none block">
                        R${' '}
                        {filteredInstallments
                          .reduce((acc, curr) => acc + (curr.amount || curr.originalAmount), 0)
                          .toFixed(2)
                          .replace('.', ',')}
                      </span>
                    </td>
                    <td className="hidden sm:table-cell" />
                    <td className="hidden sm:table-cell py-2 px-2 sm:px-3 text-right text-[9px] sm:text-[11px] text-slate-500">
                      Haspaho Grid
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* ============================================================ */}
          {/* BOTÃO DE EXTRATO TOTAL AMPLO E DESTACADO NO FINAL DA TABELA  */}
          {/* ============================================================ */}
          <div className="p-3 sm:p-4 bg-gradient-to-r from-amber-50 via-amber-100/60 to-amber-50 border-t-2 border-amber-300/80 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-slate-800">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <span className="material-symbols-outlined text-[22px]">receipt_long</span>
              </div>
              <div className="min-w-0">
                <span className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900 block truncate">
                  Extrato Consolidado • {activeDebtor?.name || 'Devedor'}
                </span>
                <span className="text-[10.5px] text-slate-600 block">
                  Visualização unificada de faturas, quitações e exportação oficial em PDF
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (onOpenExtratoTotal) {
                  onOpenExtratoTotal(undefined, activeDebtor?.id || currentDebtor?.id);
                }
              }}
              className="w-full sm:w-auto h-11 px-6 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-700 hover:to-amber-700 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-95 transition-all cursor-pointer tracking-wide uppercase shrink-0"
              title="Abrir Extrato Total Consolidado em PDF"
            >
              <span className="material-symbols-outlined text-[20px]">description</span>
              <span>Abrir Extrato Total (PDF)</span>
            </button>
          </div>
            </div>
          </div>
        </div>
      ) : (
        /* ============================================================ */
        /* MODO CARTÕES (ORGANIZADO, LIMPO E SEM SOBREPOSIÇÃO)          */
        /* ============================================================ */
        filteredInstallments.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 shadow-2xs">
            <span className="material-symbols-outlined text-4xl text-slate-300 block mb-2">search_off</span>
            <h4 className="font-bold text-slate-800 text-sm">
              {currentDebtor
                ? `Nenhuma parcela encontrada para ${currentDebtor.name} com os filtros atuais.`
                : 'Nenhuma parcela encontrada com os filtros selecionados.'}
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              {currentDebtor && debtorInstallments.length > 0
                ? `Existem ${debtorInstallments.length} parcelas de ${currentDebtor.name} registradas. Limpe os filtros para visualizá-las.`
                : 'Tente alterar os termos da busca ou selecionar outro devedor.'}
            </p>
            <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setLocalSearch('');
                  setStatusFilter('all');
                  setCardFilter('all');
                }}
                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 cursor-pointer shadow-xs"
              >
                Limpar filtros e ver todas
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 w-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {filteredInstallments.map((item, idx) => {
              const prevItem = idx > 0 ? filteredInstallments[idx - 1] : null;
              const itemDebtorName = (item.debtorName || '').toLowerCase();
              const prevDebtorName = (prevItem?.debtorName || '').toLowerCase();
              const isNewDebtor = !prevItem || prevDebtorName !== itemDebtorName;
              const isOverdue = item.status === 'overdue' || (item.delayDays || 0) > 0;
              const isPaid = item.status === 'paid';
              const isSoon = item.status === 'soon';
              const finalAmount = item.amount || item.originalAmount;
              const itemIconName = getItemIcon(item.product);
              const cardBadge = getCardBadgeInfo(item.cardName);
              const authCode = item.authCode || generateAuthCode();

              const debtorObj = debtors.find(
                (d) => d.id === item.debtorId || (d.name && d.name.toLowerCase() === itemDebtorName)
              );

              return (
                <React.Fragment key={item.id}>
                  {isNewDebtor && selectedDebtorId === 'all' && (
                    <div className="col-span-full bg-slate-900 text-white rounded-xl p-2.5 sm:p-3 flex items-center justify-between border border-slate-700 shadow-xs mt-3 first:mt-0">
                      <div className="flex items-center gap-2">
                        <SafeDebtorAvatar
                          name={item.debtorName || 'Devedor'}
                          avatar={item.debtorAvatar || debtorObj?.avatar}
                          size="xs"
                          status={isOverdue ? 'late' : 'ok'}
                        />
                        <h3 className="font-extrabold text-xs sm:text-sm uppercase tracking-wide text-white truncate max-w-[160px] sm:max-w-none">
                          {item.debtorName || 'Devedor'}
                        </h3>
                        <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-full font-mono font-bold shrink-0">
                          {filteredInstallments.filter((i) => (i.debtorName || '').toLowerCase() === itemDebtorName).length} parc.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (debtorObj) handleSelectDebtor(debtorObj.id);
                        }}
                        className="text-[10px] sm:text-xs text-blue-300 hover:text-white underline font-bold cursor-pointer shrink-0"
                      >
                        Ver só {item.debtorName.split(' ')[0]} →
                      </button>
                    </div>
                  )}

                  {/* Card Compacto, Estruturado e Sobreposto Suavemente */}
                  <div className={`bg-white/95 backdrop-blur-md rounded-2xl p-2.5 sm:p-3 border shadow-xs hover:shadow-md -mt-2 sm:-mt-2.5 first:mt-0 relative hover:z-10 hover:-translate-y-0.5 transition-all flex flex-col justify-between gap-2 ${
                    isOverdue ? 'border-red-300/80 bg-red-50/25' : isPaid ? 'border-emerald-300/80 bg-emerald-50/20' : 'border-slate-200/90'
                  }`}>
                    
                    {/* Bloco 1: Devedor (Foto + Nome) + Status da Parcela */}
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                      {/* Foto e Nome do Devedor */}
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <SafeDebtorAvatar
                          name={item.debtorName}
                          avatar={item.debtorAvatar || debtorObj?.avatar}
                          size="sm"
                          status={isOverdue ? 'late' : 'ok'}
                          className="shrink-0 ring-1 ring-slate-200"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-slate-900 truncate leading-tight" title={item.debtorName}>
                            {item.debtorName}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium truncate">
                            {debtorObj?.relation || 'Beneficiário'}
                          </span>
                        </div>
                      </div>

                      {/* Status da Parcela */}
                      <div className="flex flex-col items-end shrink-0 gap-0.5">
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200 font-mono text-[10.5px] font-bold leading-none">
                          #{item.installmentNumber}/{item.totalInstallments}
                        </span>
                        {isPaid ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[9px] leading-none">
                            <span className="material-symbols-outlined text-[10px]">check_circle</span>
                            <span>PAGO</span>
                          </span>
                        ) : isOverdue ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold text-[9px] leading-none">
                            <span className="material-symbols-outlined text-[10px]">warning</span>
                            <span>ATRASADA</span>
                          </span>
                        ) : isSoon ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[9px] leading-none">
                            <span className="material-symbols-outlined text-[10px]">schedule</span>
                            <span>A VENCER</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[9px] leading-none">
                            EM DIA
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bloco 2: Produto / Auxílio + Data de Vencimento + Cartão */}
                    <div className="flex flex-col gap-1.5 bg-slate-50/80 p-2 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenProductPrint(item.product, item.debtorName, item.purchaseId);
                          }}
                          className="flex items-center gap-1.5 min-w-0 text-left hover:text-blue-600 transition-colors cursor-pointer group"
                          title={`Clique para visualizar o print da compra de ${item.product}`}
                        >
                          <span className="material-symbols-outlined text-[15px] text-blue-600 group-hover:scale-110 transition-transform shrink-0">
                            {itemIconName}
                          </span>
                          <span className="text-xs font-bold text-slate-800 group-hover:text-blue-600 truncate underline decoration-dotted decoration-blue-400" title={item.product}>
                            {item.product}
                          </span>
                          <span className="material-symbols-outlined text-[12px] text-blue-500">
                            photo_camera
                          </span>
                        </button>
                        <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-slate-700 shrink-0">
                          <span className="material-symbols-outlined text-[12px] text-slate-400">event</span>
                          <span>{item.dueDate}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-200/60">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold border ${cardBadge.colorClass}`}>
                          <span className="material-symbols-outlined text-[11px]">{cardBadge.icon}</span>
                          <span className="truncate max-w-[120px]">{item.cardName || 'Boleto / Pix'}</span>
                        </span>
                        {isOverdue && (
                          <span className="text-red-600 font-bold">
                            {item.delayDays || 9} dias de atraso
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bloco 3: Valor da Parcela & Ações Compactas */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                      {/* Valor Monetário */}
                      <div className="flex flex-col">
                        <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                          Valor da Parcela
                        </span>
                        <span className={`font-mono text-sm sm:text-base font-black leading-tight ${
                          isPaid ? 'text-emerald-700' : isOverdue ? 'text-red-600' : 'text-slate-900'
                        }`}>
                          R$ {finalAmount.toFixed(2).replace('.', ',')}
                        </span>
                      </div>

                      {/* Botões de Ação Compactos */}
                      <div className="flex items-center gap-1">
                        {/* Se pago: Botão de Ver Detalhes / Ações (Olhinho) */}
                        {isPaid ? (
                          <button
                            type="button"
                            onClick={() => setSelectedInstallmentForDetail(item)}
                            className="h-8 w-8 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center active:scale-95 shadow-2xs transition-all cursor-pointer"
                            title="Ver detalhes da situação e ações da parcela"
                          >
                            <span className="material-symbols-outlined text-[18px]">visibility</span>
                          </button>
                        ) : (
                          <>
                            {/* Botão Quitar */}
                            <button
                              type="button"
                              onClick={() => onSettleInstallment(item)}
                              className={`h-8 px-2.5 rounded-lg text-white font-bold text-[11px] flex items-center gap-1 shadow-2xs active:scale-95 transition-all cursor-pointer ${
                                isOverdue ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                              }`}
                              title="Quitar parcela"
                            >
                              <span className="material-symbols-outlined text-[13px]">check</span>
                              <span>Quitar</span>
                            </button>

                            {/* Botão WhatsApp */}
                            <button
                              type="button"
                              onClick={(e) => {
                                handleCopyBillingData(item, e);
                                onNudgeWhatsApp(
                                  item.debtorName,
                                  `R$ ${finalAmount.toFixed(2).replace('.', ',')}`,
                                  item.product,
                                  `${item.installmentNumber}/${item.totalInstallments}`
                                );
                              }}
                              className="px-2.5 h-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-2xs"
                              title="Enviar no WhatsApp"
                            >
                              <WhatsAppIcon className="w-4 h-4 text-emerald-600" size={15} />
                              <span className="text-[10.5px] font-bold">WhatsApp</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* Botão de Extrato Total no final da visualização em cartões */}
          <div className="mt-3 p-3 sm:p-4 bg-gradient-to-r from-amber-50 via-amber-100/60 to-amber-50 border-2 border-amber-300/80 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5 text-slate-800">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <span className="material-symbols-outlined text-[22px]">receipt_long</span>
              </div>
              <div className="min-w-0">
                <span className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900 block truncate">
                  Extrato Consolidado • {activeDebtor?.name || 'Devedor'}
                </span>
                <span className="text-[10.5px] text-slate-600 block">
                  Visualização unificada de faturas, quitações e exportação oficial em PDF
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (onOpenExtratoTotal) {
                  onOpenExtratoTotal(undefined, activeDebtor?.id || currentDebtor?.id);
                }
              }}
              className="w-full sm:w-auto h-11 px-6 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-700 hover:to-amber-700 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-95 transition-all cursor-pointer tracking-wide uppercase shrink-0"
              title="Abrir Extrato Total Consolidado em PDF"
            >
              <span className="material-symbols-outlined text-[20px]">description</span>
              <span>Abrir Extrato Total (PDF)</span>
            </button>
          </div>
        </div>
        )
      )}

      {/* ============================================================ */}
      {/* PAINEL FLUTUANTE DE POSICIONAMENTO INTERATIVO DOS BOTÕES      */}
      {/* ============================================================ */}
      {isPositionModeActive && (
        <div className="fixed bottom-16 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[96%] max-w-xl bg-slate-900/95 text-white p-3 sm:p-4 rounded-2xl shadow-2xl border-2 border-amber-400 backdrop-blur-md animate-in slide-in-from-bottom duration-200">
          {/* Topo do Painel */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700/80">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-[16px]">touch_app</span>
              </span>
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-amber-300 leading-tight">
                  Ajuste de Posição dos Botões (Mobile & Desktop)
                </h4>
                <p className="text-[9.5px] sm:text-[10px] text-slate-300">
                  Deslize no Trackpad ou use os sliders. Tire o print quando estiver perfeito!
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsPositionModeActive(false)}
              className="w-6 h-6 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          </div>

          {/* Badges de Coordenadas Atuais para o Print */}
          <div className="grid grid-cols-3 gap-1.5 text-center mb-2.5">
            <div className="bg-slate-800/80 rounded-lg p-1 border border-slate-700">
              <span className="text-[8px] sm:text-[9px] text-slate-400 block font-semibold uppercase">Posição X</span>
              <span className="text-xs font-mono font-bold text-amber-300">
                {layoutConfig.offsetX > 0 ? `+${layoutConfig.offsetX}` : layoutConfig.offsetX}px
              </span>
            </div>
            <div className="bg-slate-800/80 rounded-lg p-1 border border-slate-700">
              <span className="text-[8px] sm:text-[9px] text-slate-400 block font-semibold uppercase">Posição Y</span>
              <span className="text-xs font-mono font-bold text-amber-300">
                {layoutConfig.offsetY > 0 ? `+${layoutConfig.offsetY}` : layoutConfig.offsetY}px
              </span>
            </div>
            <div className="bg-slate-800/80 rounded-lg p-1 border border-slate-700">
              <span className="text-[8px] sm:text-[9px] text-slate-400 block font-semibold uppercase">Ordem</span>
              <span className="text-xs font-mono font-bold text-emerald-300">
                {layoutConfig.quitarOrderFirst ? 'Quitar ➔ Recibo' : 'Recibo ➔ Quitar'}
              </span>
            </div>
          </div>

          {/* Sliders Rápidos de Deslocamento X e Y (Arrasto Fluido no Mobile) */}
          <div className="space-y-1.5 bg-slate-800/50 p-2 rounded-xl border border-slate-700/60 mb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[9.5px] font-bold text-slate-300 w-16 shrink-0">X (Horizontal):</span>
              <input
                type="range"
                min={-100}
                max={100}
                value={layoutConfig.offsetX}
                onChange={(e) => setLayoutConfig((prev) => ({ ...prev, offsetX: Number(e.target.value) }))}
                className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
              />
              <span className="text-[10px] font-mono text-amber-300 font-bold w-10 text-right shrink-0">
                {layoutConfig.offsetX}px
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[9.5px] font-bold text-slate-300 w-16 shrink-0">Y (Vertical):</span>
              <input
                type="range"
                min={-50}
                max={50}
                value={layoutConfig.offsetY}
                onChange={(e) => setLayoutConfig((prev) => ({ ...prev, offsetY: Number(e.target.value) }))}
                className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
              />
              <span className="text-[10px] font-mono text-amber-300 font-bold w-10 text-right shrink-0">
                {layoutConfig.offsetY}px
              </span>
            </div>
          </div>

          {/* Trackpad Tátil e Controles Rápidos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2.5">
            {/* Trackpad Tátil (Área para deslizar o dedo) */}
            <div
              style={{ touchAction: 'none' }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="h-14 sm:h-16 bg-slate-800 hover:bg-slate-750 active:bg-slate-700 rounded-xl border border-dashed border-amber-400/80 flex flex-col items-center justify-center cursor-move select-none p-1 transition-colors"
            >
              <div className="flex items-center gap-1 text-amber-300 font-bold text-[10px]">
                <span className="material-symbols-outlined text-[15px] animate-pulse">pan_tool</span>
                <span>Trackpad: Deslize o dedo aqui para arrastar</span>
              </div>
              <span className="text-[8px] text-slate-400 mt-0.5">
                Mova em qualquer direção com resposta suave
              </span>
            </div>

            {/* Teclado Direcional e Ações Rápidas */}
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setLayoutConfig((prev) => ({ ...prev, offsetX: prev.offsetX - 2 }))}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center border border-slate-700 cursor-pointer active:scale-90 shadow-2xs"
                  title="Esquerda -2px"
                >
                  ←
                </button>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => setLayoutConfig((prev) => ({ ...prev, offsetY: prev.offsetY - 2 }))}
                    className="w-8 h-4 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold text-[9px] flex items-center justify-center border border-slate-700 cursor-pointer active:scale-90"
                    title="Cima -2px"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => setLayoutConfig((prev) => ({ ...prev, offsetY: prev.offsetY + 2 }))}
                    className="w-8 h-4 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold text-[9px] flex items-center justify-center border border-slate-700 cursor-pointer active:scale-90"
                    title="Baixo +2px"
                  >
                    ↓
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setLayoutConfig((prev) => ({ ...prev, offsetX: prev.offsetX + 2 }))}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center border border-slate-700 cursor-pointer active:scale-90 shadow-2xs"
                  title="Direita +2px"
                >
                  →
                </button>
              </div>

              <button
                type="button"
                onClick={() => setLayoutConfig((prev) => ({ ...prev, quitarOrderFirst: !prev.quitarOrderFirst }))}
                className="px-2 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                title="Inverter ordem dos botões"
              >
                <span className="material-symbols-outlined text-[13px]">swap_horiz</span>
                <span>Inverter</span>
              </button>
            </div>
          </div>

          {/* Rodapé com Botões de Ação */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={handleResetLayout}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-bold cursor-pointer transition-colors"
            >
              ↺ Resetar
            </button>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSaveLayout}
                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-xs active:scale-95"
              >
                <span className="material-symbols-outlined text-[12px]">save</span>
                <span>Salvar</span>
              </button>
              <button
                type="button"
                onClick={() => setIsPositionModeActive(false)}
                className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] flex items-center gap-1 cursor-pointer shadow-xs active:scale-95"
              >
                <span className="material-symbols-outlined text-[12px]">done</span>
                <span>Concluir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 6. MODAL DRAWER DE DETALHES DA PARCELA (100% BRANCO COM LUZ)  */}
      {/* ============================================================ */}
      {selectedInstallmentForDetail && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[400] flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedInstallmentForDetail(null);
          }}
        >
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-[0_0_40px_rgba(6,182,212,0.3)] ring-2 ring-cyan-400/50 border-2 border-cyan-400/60 w-full max-w-md max-h-[88dvh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 m-auto text-slate-850">
            {/* Header do Drawer 100% Branco com Luz */}
            <div className="bg-white text-slate-900 px-3.5 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2 border-b border-slate-200 shrink-0">
              {/* Botão Voltar */}
              <button
                type="button"
                onClick={() => setSelectedInstallmentForDetail(null)}
                className="h-8 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer border border-slate-200 shrink-0"
                title="Voltar"
              >
                <span className="material-symbols-outlined text-[17px]">arrow_back</span>
                <span>Voltar</span>
              </button>

              <div className="min-w-0 flex-1 text-center px-1">
                <h3 className="font-black text-xs sm:text-sm leading-tight truncate text-slate-900">
                  Parcela #{selectedInstallmentForDetail.installmentNumber}/{selectedInstallmentForDetail.totalInstallments}
                </h3>
                <p className="text-[11px] text-cyan-700 font-bold truncate max-w-[200px] mx-auto">
                  {selectedInstallmentForDetail.product}
                </p>
              </div>

              {/* Botão X */}
              <button
                type="button"
                onClick={() => setSelectedInstallmentForDetail(null)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-600 hover:text-slate-900 flex items-center justify-center cursor-pointer border border-slate-200 shrink-0"
                title="Fechar (X)"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Conteúdo do Drawer */}
            <div className="p-3 sm:p-4 space-y-2.5 text-xs flex-1 overflow-y-auto scrollbar-thin bg-slate-50/50">
              {/* Devedor info */}
              <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <SafeDebtorAvatar name={selectedInstallmentForDetail.debtorName} size="sm" />
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Devedor</span>
                    <span className="font-bold text-slate-900 text-sm block truncate">{selectedInstallmentForDetail.debtorName}</span>
                    <span className="text-[11px] font-mono text-slate-600 flex items-center gap-1 mt-0.5 font-semibold">
                      <span className="material-symbols-outlined text-[13px] text-slate-400">calendar_today</span>
                      <span>Vencimento: <strong className="text-slate-900">{selectedInstallmentForDetail.dueDate}</strong></span>
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const d = debtors.find((x) => x.id === selectedInstallmentForDetail.debtorId);
                    const ph = d?.phone;
                    const finalAmt = (selectedInstallmentForDetail.amount || selectedInstallmentForDetail.originalAmount).toFixed(2).replace('.', ',');
                    onNudgeWhatsApp(selectedInstallmentForDetail.debtorName, `R$ ${finalAmt}`, selectedInstallmentForDetail.product, `${selectedInstallmentForDetail.installmentNumber}/${selectedInstallmentForDetail.totalInstallments}`, ph);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-bold flex items-center gap-1 active:scale-95 cursor-pointer shadow-2xs shrink-0"
                >
                  <WhatsAppIcon className="w-3.5 h-3.5 text-emerald-600" size={14} />
                  <span>WhatsApp</span>
                </button>
              </div>

              {/* Detalhes Financeiros */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Vencimento</span>
                  <span className="font-mono font-bold text-slate-900 text-xs block mt-0.5">
                    {selectedInstallmentForDetail.dueDate}
                  </span>
                  {(selectedInstallmentForDetail.status === 'overdue' || (selectedInstallmentForDetail.delayDays || 0) > 0) ? (
                    <span className="text-[10px] font-bold text-red-600 block mt-0.5">
                      Vencida (-{selectedInstallmentForDetail.delayDays || 1}d)
                    </span>
                  ) : selectedInstallmentForDetail.status === 'paid' ? (
                    <span className="text-[10px] font-bold text-emerald-600 block mt-0.5">
                      Liquidada
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-slate-500 block mt-0.5">
                      No prazo
                    </span>
                  )}
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Cartão / Forma</span>
                  <span className="font-bold text-slate-900 text-xs block mt-0.5 truncate">
                    {selectedInstallmentForDetail.cardName || 'Boleto / Pix'}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Registrado na compra
                  </span>
                </div>
              </div>

              {/* Valor Total */}
              {(() => {
                const isPaid = selectedInstallmentForDetail.status === 'paid';
                const isOverdue = !isPaid && (selectedInstallmentForDetail.status === 'overdue' || (selectedInstallmentForDetail.delayDays || 0) > 0);
                const finalAmt = isOverdue ? selectedInstallmentForDetail.originalAmount + 5.0 : (selectedInstallmentForDetail.amount || selectedInstallmentForDetail.originalAmount);
                return (
                  <div className={`p-3 border rounded-xl flex items-center justify-between shadow-2xs ${
                    isPaid
                      ? 'bg-emerald-50/80 border-emerald-300'
                      : 'bg-white border-slate-200'
                  }`}>
                    <div>
                      <span className={`text-[10px] uppercase font-bold block ${isPaid ? 'text-emerald-800' : 'text-slate-700'}`}>
                        {isPaid ? 'Valor Quitado (Verificado)' : 'Valor da Parcela'}
                      </span>
                      {isPaid ? (
                        <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1 mt-0.5">
                          <span className="material-symbols-outlined text-[13px] text-emerald-700 font-bold">verified</span>
                          <span>Pagamento Liquidado</span>
                        </span>
                      ) : isOverdue ? (
                        <span className="text-[10px] text-red-600 font-semibold block">
                          Inclui R$ 5,00 taxa de atraso
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 font-medium block">
                          No prazo normal de pagamento
                        </span>
                      )}
                    </div>
                    {isPaid ? (
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-950 border border-emerald-300 shadow-2xs">
                        <span className="material-symbols-outlined text-[14px] text-emerald-700 font-bold">verified</span>
                        <span className="font-mono text-base sm:text-lg font-black text-emerald-900">
                          R$ {finalAmt.toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                    ) : (
                      <span className="font-mono text-base sm:text-lg font-black text-slate-900">
                        R$ {finalAmt.toFixed(2).replace('.', ',')}
                      </span>
                    )}
                  </div>
                );
              })()}

              {/* Chave PIX Oficial para Recebimento (Tema Claro Padronizado) */}
              <div className="p-3 bg-white text-slate-800 rounded-xl border border-slate-200 shadow-2xs flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5 text-[11.5px]">
                    <span className="material-symbols-outlined text-[16px] text-emerald-600">qr_code_2</span>
                    <span>Chave PIX Oficial para Recebimento</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Telefone</span>
                </div>
                <div className="flex items-center justify-between bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                  <span className="font-mono font-black text-slate-900 text-xs select-all">
                    (14) 99733-9863
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText('14997339863');
                      if (onToast) onToast('Chave PIX copiada: (14) 99733-9863!');
                    }}
                    className="text-[11px] text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer active:scale-95 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shadow-2xs"
                  >
                    <span className="material-symbols-outlined text-[13px]">content_copy</span>
                    <span>Copiar</span>
                  </button>
                </div>
                <p className="text-[9.5px] text-slate-500">
                  Titular: Tiago Dias • HASPAHO Tecnologia da Informação
                </p>
              </div>

              {/* Ações Otimizadas e Reenquadradas */}
              <div className="space-y-2 pt-1">
                {selectedInstallmentForDetail.status !== 'paid' && (
                  <button
                    type="button"
                    onClick={() => {
                      onSettleInstallment(selectedInstallmentForDetail);
                      setSelectedInstallmentForDetail(null);
                    }}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer active:scale-95 transition-all"
                  >
                    <span className="material-symbols-outlined text-[17px]">check_circle</span>
                    <span>Quitar Parcela</span>
                  </button>
                )}

                {(selectedInstallmentForDetail.status === 'overdue' || (selectedInstallmentForDetail.delayDays || 0) > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setRecalcModalItem(selectedInstallmentForDetail);
                      setRecalcDays(selectedInstallmentForDetail.delayDays || 9);
                      setSelectedInstallmentForDetail(null);
                    }}
                    className="w-full py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-800 font-bold text-xs border border-red-200 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">calculate</span>
                    <span>Recalcular Juros por Atraso (CDC)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedInstallmentForDetail(null)}
                  className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-slate-200 active:scale-95"
                >
                  <span className="material-symbols-outlined text-[17px]">done</span>
                  <span>Concluir</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 7. MODAL DE RECÁLCULO DE JUROS POR ATRASO DIÁRIO              */}
      {/* ============================================================ */}
      {recalcModalItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-[0_0_40px_rgba(6,182,212,0.3)] ring-2 ring-cyan-400/50 border-2 border-cyan-400/60 w-full max-w-lg overflow-hidden my-auto text-slate-850">
            {/* Cabeçalho do Modal 100% Branco com Luz */}
            <div className="bg-white text-slate-900 px-5 py-4 flex items-center justify-between border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-100 text-red-600 border border-red-200 flex items-center justify-center shadow-2xs">
                  <span className="material-symbols-outlined text-[20px]">calculate</span>
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base leading-tight text-slate-900">
                    Recálculo de Juros por Atraso Diário
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Parcela #{recalcModalItem.installmentNumber}/{recalcModalItem.totalInstallments} • {recalcModalItem.product}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRecalcModalItem(null)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer border border-slate-200"
                title="Fechar"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Conteúdo do Cálculo */}
            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Devedor</span>
                  <span className="font-bold text-slate-900 text-sm">{recalcModalItem.debtorName}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Vencimento Original</span>
                  <span className="font-mono font-bold text-slate-800">{recalcModalItem.dueDate}</span>
                </div>
              </div>

              {/* Ajuste dos Dias de Atraso */}
              <div className="p-3 bg-red-50/70 border border-red-200/80 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="recalc-days-input" className="font-bold text-red-900 text-xs flex items-center gap-1.5 cursor-pointer">
                    <span className="material-symbols-outlined text-[16px] text-red-600">event_busy</span>
                    <span>Dias Corridos de Atraso:</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      id="recalc-days-input"
                      type="number"
                      min={1}
                      max={365}
                      value={recalcDays}
                      onChange={(e) => setRecalcDays(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 h-7 px-2 bg-white border border-red-300 rounded-lg text-center font-bold text-xs text-red-900 outline-none focus:ring-2 focus:ring-red-400"
                    />
                    <span className="font-bold text-red-800">dias</span>
                  </div>
                </div>
                <p className="text-[11px] text-red-700 leading-relaxed">
                  Juros de mora diários calculados com base na taxa de 1% ao mês (0,0333% ao dia) pro-rata temporis conforme Código Civil.
                </p>
              </div>

              {/* Opções de Encargos */}
              <div className="space-y-2 border-y border-slate-100 py-3">
                <span className="font-bold text-slate-800 block text-xs">Composição dos Encargos:</span>

                <label className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={recalcIncludePenalty}
                      onChange={(e) => setRecalcIncludePenalty(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                    />
                    <div>
                      <span className="font-bold text-slate-800 block">Multa Moratória (2%)</span>
                      <span className="text-[10px] text-slate-500">Art. 52, § 1º do Código de Defesa do Consumidor</span>
                    </div>
                  </div>
                  <span className={`font-bold font-mono ${recalcIncludePenalty ? 'text-slate-900' : 'text-slate-400 line-through'}`}>
                    + R$ {(recalcModalItem.originalAmount * 0.02).toFixed(2).replace('.', ',')}
                  </span>
                </label>

                <label className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={recalcIncludeDailyInterest}
                      onChange={(e) => setRecalcIncludeDailyInterest(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                    />
                    <div>
                      <span className="font-bold text-slate-800 block">Juros de Mora Diários (0,033%/dia)</span>
                      <span className="text-[10px] text-slate-500">
                        {recalcDays} dias x R$ {(recalcModalItem.originalAmount * (0.01 / 30)).toFixed(2).replace('.', ',')}/dia
                      </span>
                    </div>
                  </div>
                  <span className={`font-bold font-mono ${recalcIncludeDailyInterest ? 'text-slate-900' : 'text-slate-400 line-through'}`}>
                    + R$ {(recalcModalItem.originalAmount * (0.01 / 30) * recalcDays).toFixed(2).replace('.', ',')}
                  </span>
                </label>

                <label className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={recalcIncludeFixedFee}
                      onChange={(e) => setRecalcIncludeFixedFee(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                    />
                    <div>
                      <span className="font-bold text-slate-800 block">Taxa Fixa de Cobrança</span>
                      <span className="text-[10px] text-slate-500">Taxa padrão de R$ 5,00 por inadimplência</span>
                    </div>
                  </div>
                  <span className={`font-bold font-mono ${recalcIncludeFixedFee ? 'text-slate-900' : 'text-slate-400 line-through'}`}>
                    + R$ 5,00
                  </span>
                </label>
              </div>

              {/* Total Recalculado */}
              {(() => {
                const baseOrig = recalcModalItem.originalAmount;
                const multa = recalcIncludePenalty ? baseOrig * 0.02 : 0;
                const juros = recalcIncludeDailyInterest ? baseOrig * (0.01 / 30) * recalcDays : 0;
                const taxa = recalcIncludeFixedFee ? 5.0 : 0;
                const totalAtual = Number((baseOrig + multa + juros + taxa).toFixed(2));

                return (
                  <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-300 rounded-xl p-3.5 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-black text-emerald-800 block tracking-wider">
                        Valor Total Atualizado
                      </span>
                      <span className="text-[11px] text-emerald-700">
                        Original: R$ {baseOrig.toFixed(2).replace('.', ',')} + R${' '}
                        {(multa + juros + taxa).toFixed(2).replace('.', ',')} encargos
                      </span>
                    </div>
                    <span className="text-xl font-black text-emerald-900 font-mono">
                      R$ {totalAtual.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* Ações do Modal */}
            <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex items-center justify-between gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  const baseOrig = recalcModalItem.originalAmount;
                  const multa = recalcIncludePenalty ? baseOrig * 0.02 : 0;
                  const juros = recalcIncludeDailyInterest ? baseOrig * (0.01 / 30) * recalcDays : 0;
                  const taxa = recalcIncludeFixedFee ? 5.0 : 0;
                  const totalAtual = Number((baseOrig + multa + juros + taxa).toFixed(2));
                  const debtor = debtors.find((d) => d.id === recalcModalItem.debtorId) || currentDebtor;
                  const pixKeyToUse = debtor?.pixKey || userPixKey || 'tiagodias8888@gmail.com';

                  const text = `*HASPAHO • Demonstrativo de Recálculo de Juros*
Olá, ${recalcModalItem.debtorName}!
Segue o demonstrativo de atualização da sua parcela em atraso:

📦 *Item:* ${recalcModalItem.product} (Parcela #${recalcModalItem.installmentNumber}/${recalcModalItem.totalInstallments})
📅 *Vencimento Original:* ${recalcModalItem.dueDate} (${recalcDays} dias de atraso)
• Valor Original: R$ ${baseOrig.toFixed(2).replace('.', ',')}
${recalcIncludePenalty ? `• Multa Moratória (2%): +R$ ${multa.toFixed(2).replace('.', ',')}\n` : ''}${recalcIncludeDailyInterest ? `• Juros de Mora (0,033%/dia x ${recalcDays}d): +R$ ${juros.toFixed(2).replace('.', ',')}\n` : ''}${recalcIncludeFixedFee ? `• Taxa de Cobrança: +R$ 5,00\n` : ''}-----------------------------------
*TOTAL ATUALIZADO: R$ ${totalAtual.toFixed(2).replace('.', ',')}*
🔑 *Chave PIX:* ${pixKeyToUse}

Por favor, realize a transferência e envie o comprovante para liquidação no sistema.`;

                  navigator.clipboard.writeText(text);
                  if (onToast) {
                    onToast('Demonstrativo de juros copiado para o WhatsApp!');
                  }
                }}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              >
                <span className="material-symbols-outlined text-[15px]">content_copy</span>
                <span>Copiar Demonstrativo</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRecalcModalItem(null)}
                  className="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-300 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const baseOrig = recalcModalItem.originalAmount;
                    const multa = recalcIncludePenalty ? baseOrig * 0.02 : 0;
                    const juros = recalcIncludeDailyInterest ? baseOrig * (0.01 / 30) * recalcDays : 0;
                    const taxa = recalcIncludeFixedFee ? 5.0 : 0;
                    const totalAtual = Number((baseOrig + multa + juros + taxa).toFixed(2));

                    const updatedItem: Installment = {
                      ...recalcModalItem,
                      amount: totalAtual,
                      penaltyFee: Number((multa + taxa).toFixed(2)),
                      interestFee: Number(juros.toFixed(2)),
                      delayDays: recalcDays,
                    };

                    if (onUpdateInstallment) {
                      onUpdateInstallment(updatedItem);
                    }
                    if (onToast) {
                      onToast(
                        `Parcela #${recalcModalItem.installmentNumber} atualizada para R$ ${totalAtual.toFixed(2).replace('.', ',')}!`
                      );
                    }
                    setRecalcModalItem(null);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span>Aplicar à Parcela</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

            {/* Modal de Detalhes dos Itens Unitários (TV, Celular, etc.) */}
      <DebtorUnitaryItemsModal
        isOpen={isUnitaryModalOpen}
        onClose={() => setIsUnitaryModalOpen(false)}
        debtor={selectedDebtorForUnitary}
        purchases={purchases}
        installments={installments}
        initialSelectedItemId={initialUnitaryItemId}
        onNudgeWhatsApp={onNudgeWhatsApp}
        onSettleInstallment={onSettleInstallment}
        onShowProof={onShowProof}
        onOpenNewPurchaseForDebtor={onOpenNewPurchase}
        onOpenExtratoTotal={onOpenExtratoTotal}
      />

      {/* Janelinha do Print da Compra do Produto (Smart TV, etc.) */}
      <ProductPurchasePrintModal
        isOpen={productPrintModalState.isOpen}
        onClose={() => setProductPrintModalState((prev) => ({ ...prev, isOpen: false }))}
        productName={productPrintModalState.productName}
        debtorName={productPrintModalState.debtorName}
        purchase={productPrintModalState.purchase}
        installments={installments.filter((i) => i.product === productPrintModalState.productName)}
        onToast={onToast}
      />

      {/* Modal de PDFs e Documentos do Devedor */}
      {activeDebtor && (
        <PdfsAndDocumentsModal
          isOpen={isPdfsAndDocsModalOpen}
          onClose={() => setIsPdfsAndDocsModalOpen(false)}
          debtor={activeDebtor}
          purchases={purchases?.filter((p) => p.debtorId === activeDebtor.id)}
          installments={installments.filter((i) => i.debtorId === activeDebtor.id)}
          onOpenExtratoTotal={onOpenExtratoTotal}
          onOpenContract={onOpenContract}
          onToast={onToast}
          userPixKey={userPixKey}
        />
      )}

      {/* Modal Interativo de Detalhes Individuais dos 4 Quadradinhos (Aberto, Quitado, Atraso, Mês Atual) */}
      {activeKpiModal && activeDebtor && (
        <DebtorKpiDetailModal
          isOpen={true}
          onClose={() => setActiveKpiModal(null)}
          type={activeKpiModal}
          debtor={activeDebtor}
          installments={installments}
          onSettleInstallment={onSettleInstallment}
          onShowProof={onShowProof}
          onNudgeWhatsApp={(inst) => {
            if (onNudgeWhatsApp) {
              onNudgeWhatsApp(
                activeDebtor.name,
                `R$ ${safeToFixed(inst.amount || inst.originalAmount || 0)}`,
                inst.product,
                `#${inst.installmentNumber}/${inst.totalInstallments}`,
                activeDebtor.phone
              );
            }
          }}
          onToast={onToast}
        />
      )}
    </div>
  );
};
