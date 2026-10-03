import React, { useState, useMemo, useEffect } from 'react';
import { Debtor, Installment, Purchase, ScreenTab, generateAuthCode } from '../types';
import { APP_IMAGES } from '../data/mockData';
import { getProductCategory, getProductIcon } from '../utils/debtorItemsUtils';
import { WhatsAppIcon } from './WhatsAppIcon';
import { safeToFixed, safeFormatCurrency, safeToNumber } from '../utils/numberUtils';

export const getCleanDebtorAvatar = (name?: string, currentAvatar?: string): string => {
  const n = (name || '').toLowerCase();
  if (n.includes('jucelia')) return APP_IMAGES.jucelia;
  if (n.includes('marcos')) return APP_IMAGES.marcos;
  if (n.includes('renata')) return APP_IMAGES.renata;
  if (n.includes('jubileu')) return APP_IMAGES.jubileu;
  if (n.includes('joão') || n.includes('joao')) return APP_IMAGES.joao;
  if (n.includes('maria')) return APP_IMAGES.maria;
  if (n.includes('fátima') || n.includes('fatima')) return APP_IMAGES.fatima;
  if (n.includes('carlos')) return APP_IMAGES.carlos;
  if (currentAvatar && !currentAvatar.includes('aida-public') && currentAvatar.length > 15) {
    return currentAvatar;
  }
  return APP_IMAGES.marcos;
};

interface DebtorsMasterSpreadsheetProps {
  debtors: Debtor[];
  installments: Installment[];
  purchases: Purchase[];
  onNavigate: (tab: ScreenTab, targetId?: string) => void;
  onNudgeWhatsApp: (name: string, amount: string, item: string, parcel: string, phone?: string) => void;
  onSettleInstallment: (inst: Installment) => void;
  onShowProof?: (
    payer: string,
    amount: string,
    date: string,
    dest: string,
    auth: string,
    item: string
  ) => void;
  onOpenNewPurchaseForDebtor: (debtorId: string) => void;
  onOpenNewDebtor: () => void;
  onOpenGeminiScanner?: () => void;
  onEditDebtor?: (debtor: Debtor) => void;
  onOpenContract?: (debtorId: string) => void;
  onOpenExtratoTotal?: (purchaseId?: string, debtorId?: string) => void;
  searchQuery?: string;
  initialSelectedDebtorId?: string;
  onSelectDebtor?: (debtorId: string) => void;
}

// Helper para abreviar datas no mobile (ex: 10/07/2026 -> 10/07/26)
const formatDueDateShort = (d: string) => {
  if (!d) return '';
  if (d.includes('/')) {
    const parts = d.split('/');
    if (parts.length === 3 && parts[2].length === 4) {
      return `${parts[0]}/${parts[1]}/${parts[2].slice(2)}`;
    }
  }
  return d;
};

// Helper para abreviar produtos no mobile (ex: Smart TV 55 polegadas -> Smart TV)
const formatProductShort = (name: string) => {
  if (!name) return '';
  if (/smart\s*tv/i.test(name)) {
    return 'Smart TV';
  }
  return name;
};

// Helper para formatar nome do cartão (ex: Nubank Ultravioleta -> Nubank Croma)
const formatCardShort = (cardName: string) => {
  if (!cardName) return '';
  if (/ultravioleta/i.test(cardName)) {
    return 'Nubank Croma';
  }
  return cardName;
};

// Componente oficial de exibição de avatar do devedor idêntico à imagem aprovada (moldura quadrada ciano + foto circular com borda branca e visto verde)
export const SafeDebtorAvatar: React.FC<{
  name: string;
  avatar?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  status?: 'ok' | 'late' | 'none';
  className?: string;
}> = ({ name, avatar, size = 'sm', status = 'none', className = '' }) => {
  const [hasError, setHasError] = useState(false);
  const avatarSrc = useMemo(() => getCleanDebtorAvatar(name, avatar), [name, avatar]);

  const initials = useMemo(() => {
    if (!name) return 'D';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [name]);

  const sizeConfig = {
    xs: {
      container: 'w-7 h-9 p-0.5 rounded-t-full rounded-b-full border border-cyan-400/40 bg-[#091a36]/60',
      badge: 'w-3 h-3 -bottom-0.5 -right-0.5 text-[8px] ring-1 ring-emerald-500',
      badgeIcon: 'text-[9px]',
      font: 'text-[9px]',
    },
    sm: {
      container: 'w-9 h-11 p-0.5 sm:p-1 rounded-t-full rounded-b-full border border-cyan-400/40 bg-[#091a36]/60',
      badge: 'w-4 h-4 -bottom-0.5 -right-0.5 text-[10px] ring-1.5 ring-emerald-500',
      badgeIcon: 'text-[11px]',
      font: 'text-xs',
    },
    md: {
      container: 'w-12 h-15 p-1 rounded-t-full rounded-b-full border border-cyan-400/50 bg-[#091a36]/60',
      badge: 'w-5 h-5 -bottom-1 -right-1 text-xs ring-2 ring-emerald-500',
      badgeIcon: 'text-[13px]',
      font: 'text-sm',
    },
    lg: {
      container: 'w-[70px] h-[86px] sm:w-[78px] sm:h-[96px] p-1 sm:p-1.5 rounded-t-full rounded-b-full border border-cyan-400/50 bg-[#091a36]/80 shadow-md',
      badge: 'w-6 h-6 -bottom-1 -right-1 text-sm ring-2 ring-emerald-500 shadow-md',
      badgeIcon: 'text-[15px]',
      font: 'text-base font-black',
    },
    xl: {
      container: 'w-22 h-28 p-1.5 rounded-t-full rounded-b-full border border-cyan-400/60 bg-[#091a36]/80 shadow-lg',
      badge: 'w-7 h-7 -bottom-1.5 -right-1.5 text-base ring-2 ring-emerald-500 shadow-md',
      badgeIcon: 'text-[18px]',
      font: 'text-lg font-black',
    },
  }[size];

  return (
    <div className={`relative shrink-0 flex items-center justify-center ${sizeConfig.container} ${className}`}>
      {!avatarSrc || hasError ? (
        <div
          title={name}
          className={`w-full h-full rounded-t-full rounded-b-full bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-700 text-white font-black flex items-center justify-center border-2 border-white ring-1 ring-slate-200/50 shadow-2xs select-none ${sizeConfig.font}`}
        >
          {initials}
        </div>
      ) : (
        <img
          src={avatarSrc}
          alt={name}
          title={name}
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
          className="w-full h-full rounded-t-full rounded-b-full border-2 border-white ring-1 ring-slate-200/50 object-cover shadow-2xs"
        />
      )}

      {status === 'ok' && (
        <span
          className={`absolute bg-white text-emerald-600 rounded-full flex items-center justify-center font-black shadow-md z-10 ${sizeConfig.badge}`}
          title="Dentro do prazo / Situação Regular"
        >
          <span className={`material-symbols-outlined font-black ${sizeConfig.badgeIcon}`}>
            check
          </span>
        </span>
      )}
      {status === 'late' && (
        <span
          className={`absolute bg-red-600 text-white ring-2 ring-white rounded-full flex items-center justify-center font-black z-10 shadow-xs ${sizeConfig.badge}`}
          title="Em atraso"
        >
          <span className={`material-symbols-outlined font-black ${sizeConfig.badgeIcon}`}>
            priority_high
          </span>
        </span>
      )}
    </div>
  );
};

// Tipos e Paletas de Cores Clarinhas e Neutras para as Caixinhas
export type BoxColorTheme = 'neutral' | 'sky' | 'stone' | 'sage' | 'lavender' | 'amber';
export type BoxScaleLevel = 1 | 2 | 3 | 4;

export const BOX_COLOR_THEMES: Record<
  BoxColorTheme,
  {
    id: BoxColorTheme;
    label: string;
    swatch: string;
    itemBox: string;
    parcelBox: string;
    dateBox: string;
    accentText: string;
  }
> = {
  neutral: {
    id: 'neutral',
    label: 'Neutro Claro',
    swatch: 'bg-slate-100 border-slate-300 text-slate-700',
    itemBox: 'bg-slate-50 border-slate-200 text-slate-900',
    parcelBox: 'bg-slate-100 text-slate-800 border-slate-300/80',
    dateBox: 'bg-slate-50 border-slate-200 text-slate-800',
    accentText: 'text-slate-700',
  },
  sky: {
    id: 'sky',
    label: 'Azul Neve',
    swatch: 'bg-sky-100 border-sky-300 text-sky-800',
    itemBox: 'bg-sky-50/80 border-sky-200 text-sky-950',
    parcelBox: 'bg-sky-100/70 text-sky-900 border-sky-200',
    dateBox: 'bg-sky-50/80 border-sky-200 text-sky-950',
    accentText: 'text-sky-700',
  },
  stone: {
    id: 'stone',
    label: 'Linho Areia',
    swatch: 'bg-stone-100 border-stone-300 text-stone-800',
    itemBox: 'bg-stone-50 border-stone-200 text-stone-900',
    parcelBox: 'bg-stone-100 text-stone-800 border-stone-300/80',
    dateBox: 'bg-stone-50 border-stone-200 text-stone-900',
    accentText: 'text-stone-700',
  },
  sage: {
    id: 'sage',
    label: 'Menta Suave',
    swatch: 'bg-emerald-100 border-emerald-300 text-emerald-800',
    itemBox: 'bg-emerald-50/70 border-emerald-200 text-emerald-950',
    parcelBox: 'bg-emerald-100/70 text-emerald-900 border-emerald-200',
    dateBox: 'bg-emerald-50/70 border-emerald-200 text-emerald-950',
    accentText: 'text-emerald-700',
  },
  lavender: {
    id: 'lavender',
    label: 'Lavanda Névoa',
    swatch: 'bg-indigo-100 border-indigo-300 text-indigo-800',
    itemBox: 'bg-indigo-50/60 border-indigo-200 text-indigo-950',
    parcelBox: 'bg-indigo-100/70 text-indigo-900 border-indigo-200',
    dateBox: 'bg-indigo-50/60 border-indigo-200 text-indigo-950',
    accentText: 'text-indigo-700',
  },
  amber: {
    id: 'amber',
    label: 'Creme Suave',
    swatch: 'bg-amber-100 border-amber-300 text-amber-800',
    itemBox: 'bg-amber-50/60 border-amber-200 text-amber-950',
    parcelBox: 'bg-amber-100/70 text-amber-900 border-amber-200',
    dateBox: 'bg-amber-50/60 border-amber-200 text-amber-950',
    accentText: 'text-amber-700',
  },
};

export const BOX_SCALE_CONFIGS: Record<
  BoxScaleLevel,
  {
    name: string;
    label: string;
    cellPy: string;
    boxPadding: string;
    fontSizeItem: string;
    fontSizeSub: string;
    fontSizeBadge: string;
    iconSize: string;
    btnPadding: string;
  }
> = {
  1: {
    name: 'Ultra',
    label: 'Ultra Compacto',
    cellPy: 'py-0.5 sm:py-1.5',
    boxPadding: 'px-0.5 py-0.5',
    fontSizeItem: 'text-[7.5px] sm:text-[10px]',
    fontSizeSub: 'text-[6.5px] sm:text-[8px]',
    fontSizeBadge: 'text-[7px] sm:text-[9.5px]',
    iconSize: 'text-[9px] sm:text-[12px]',
    btnPadding: 'p-0.5 sm:px-1.5 sm:py-0.5',
  },
  2: {
    name: 'Compacto',
    label: 'Compacto (Padrão)',
    cellPy: 'py-1 sm:py-2',
    boxPadding: 'px-1 sm:px-1.5 py-0.5',
    fontSizeItem: 'text-[8.5px] sm:text-xs',
    fontSizeSub: 'text-[7px] sm:text-[9.5px]',
    fontSizeBadge: 'text-[8px] sm:text-xs',
    iconSize: 'text-[10px] sm:text-[14px]',
    btnPadding: 'px-1 sm:px-2 py-0.5 sm:py-1',
  },
  3: {
    name: 'Médio',
    label: 'Médio / Equilibrado',
    cellPy: 'py-1.5 sm:py-2.5',
    boxPadding: 'px-1.5 sm:px-2 py-1',
    fontSizeItem: 'text-[9.5px] sm:text-sm',
    fontSizeSub: 'text-[8px] sm:text-[10.5px]',
    fontSizeBadge: 'text-[8.5px] sm:text-xs',
    iconSize: 'text-[12px] sm:text-[16px]',
    btnPadding: 'px-1.5 sm:px-2.5 py-1 sm:py-1.5',
  },
  4: {
    name: 'Amplo',
    label: 'Amplo / Espaçoso',
    cellPy: 'py-2 sm:py-3.5',
    boxPadding: 'px-2 sm:px-3 py-1.5',
    fontSizeItem: 'text-[10.5px] sm:text-base',
    fontSizeSub: 'text-[9px] sm:text-xs',
    fontSizeBadge: 'text-[9.5px] sm:text-sm',
    iconSize: 'text-[14px] sm:text-[18px]',
    btnPadding: 'px-2 sm:px-3 py-1.5 sm:py-2',
  },
};

// Helper para detectar ícone padrão do item
export const getItemIcon = (productName: string) => {
  const p = (productName || '').toLowerCase();
  if (p.includes('tv') || p.includes('televis')) return 'tv';
  if (p.includes('moto') || p.includes('celular') || p.includes('phone') || p.includes('iphone')) return 'smartphone';
  if (p.includes('armário') || p.includes('armario') || p.includes('móvel') || p.includes('movel')) return 'shelves';
  if (p.includes('notebook') || p.includes('laptop') || p.includes('computador') || p.includes('pc')) return 'laptop';
  if (p.includes('ar condicionado') || p.includes('ar')) return 'mode_fan';
  if (p.includes('geladeira') || p.includes('refrigerador')) return 'kitchen';
  return 'inventory_2';
};

export const DebtorsMasterSpreadsheet: React.FC<DebtorsMasterSpreadsheetProps> = ({
  debtors,
  installments,
  purchases,
  onNavigate,
  onNudgeWhatsApp,
  onSettleInstallment,
  onShowProof,
  onOpenNewPurchaseForDebtor,
  onOpenNewDebtor,
  onOpenGeminiScanner,
  onEditDebtor,
  onOpenContract,
  onOpenExtratoTotal,
  searchQuery = '',
  initialSelectedDebtorId,
  onSelectDebtor,
}) => {
  const [selectedDebtorId, setSelectedDebtorId] = useState<string>(
    initialSelectedDebtorId || debtors[0]?.id || 'd1'
  );
  const [debtorSearch, setDebtorSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | 'ontime' | 'paid'>('all');
  const [spreadsheetSearch, setSpreadsheetSearch] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [selectedItemTab, setSelectedItemTab] = useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [showScoreDetails, setShowScoreDetails] = useState<boolean>(false);

  // Estados dedicados para o Modo Cartões (Abas separadas por Produto e por Devedores)
  const [cardsGroupMode, setCardsGroupMode] = useState<'by-product' | 'by-debtor'>('by-product');
  const [cardsSelectedProduct, setCardsSelectedProduct] = useState<string>('all');
  const [cardsSelectedDebtorId, setCardsSelectedDebtorId] = useState<string>('all');
  const [cardsDebtorProductTab, setCardsDebtorProductTab] = useState<string>('all');

  // Layout customizer state
  const [isCustomizerActive, setIsCustomizerActive] = useState<boolean>(() => {
    return localStorage.getItem('haspaho_layout_customizer_active') === 'true';
  });

  // Estados dedicados para o tamanho/escala e cores clarinhas/neutras das caixinhas
  const [boxScaleLevel, setBoxScaleLevel] = useState<BoxScaleLevel>(() => {
    const saved = localStorage.getItem('haspaho_box_scale_level');
    if (saved && ['1', '2', '3', '4'].includes(saved)) {
      return Number(saved) as BoxScaleLevel;
    }
    return 2; // Padrão compacto otimizado para mobile
  });

  const [boxColorTheme, setBoxColorTheme] = useState<BoxColorTheme>(() => {
    const saved = localStorage.getItem('haspaho_box_color_theme');
    if (saved && ['neutral', 'sky', 'stone', 'sage', 'lavender', 'amber'].includes(saved)) {
      return saved as BoxColorTheme;
    }
    return 'neutral';
  });

  const [boxShowCardName, setBoxShowCardName] = useState<boolean>(() => {
    return localStorage.getItem('haspaho_box_show_card') !== 'false';
  });

  const [boxShowIcons, setBoxShowIcons] = useState<boolean>(() => {
    return localStorage.getItem('haspaho_box_show_icons') !== 'false';
  });

  const [customItemTexts, setCustomItemTexts] = useState<
    Record<string, { name?: string; card?: string; icon?: string }>
  >(() => {
    try {
      const saved = localStorage.getItem('haspaho_custom_item_texts');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Modal / Edição de uma caixinha específica
  const [editingCaixinha, setEditingCaixinha] = useState<{
    itemId: string;
    currentName: string;
    currentCard: string;
    currentIcon?: string;
  } | null>(null);

  const handleAdjustScale = (delta: number) => {
    const next = Math.max(1, Math.min(4, boxScaleLevel + delta)) as BoxScaleLevel;
    setBoxScaleLevel(next);
    localStorage.setItem('haspaho_box_scale_level', String(next));
  };

  const handleChangeColorTheme = (theme: BoxColorTheme) => {
    setBoxColorTheme(theme);
    localStorage.setItem('haspaho_box_color_theme', theme);
  };

  const handleToggleCardName = () => {
    const next = !boxShowCardName;
    setBoxShowCardName(next);
    localStorage.setItem('haspaho_box_show_card', String(next));
  };

  const handleToggleIcons = () => {
    const next = !boxShowIcons;
    setBoxShowIcons(next);
    localStorage.setItem('haspaho_box_show_icons', String(next));
  };

  const handleSaveCustomCaixinha = (itemId: string, name: string, card: string, icon: string) => {
    setCustomItemTexts((prev) => {
      const updated = {
        ...prev,
        [itemId]: {
          name: name.trim(),
          card: card.trim(),
          icon: icon.trim(),
        },
      };
      localStorage.setItem('haspaho_custom_item_texts', JSON.stringify(updated));
      return updated;
    });
    setEditingCaixinha(null);
  };

  const handleResetCaixinha = (itemId: string) => {
    setCustomItemTexts((prev) => {
      const updated = { ...prev };
      delete updated[itemId];
      localStorage.setItem('haspaho_custom_item_texts', JSON.stringify(updated));
      return updated;
    });
    setEditingCaixinha(null);
  };

  const handleResetAllCaixinhas = () => {
    setBoxScaleLevel(2);
    setBoxColorTheme('neutral');
    setBoxShowCardName(true);
    setBoxShowIcons(true);
    setCustomItemTexts({});
    setHiddenElements([]);
    localStorage.removeItem('haspaho_box_scale_level');
    localStorage.removeItem('haspaho_box_color_theme');
    localStorage.removeItem('haspaho_box_show_card');
    localStorage.removeItem('haspaho_box_show_icons');
    localStorage.removeItem('haspaho_custom_item_texts');
    localStorage.removeItem('haspaho_hidden_elements');
  };

  const [hiddenElements, setHiddenElements] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('haspaho_hidden_elements');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const toggleHideElement = (id: string) => {
    setHiddenElements((prev) => {
      const next = prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id];
      localStorage.setItem('haspaho_hidden_elements', JSON.stringify(next));
      return next;
    });
  };

  const saveCustomLayout = () => {
    localStorage.setItem('haspaho_hidden_elements', JSON.stringify(hiddenElements));
    localStorage.setItem('haspaho_layout_customizer_active', 'false');
    setIsCustomizerActive(false);
  };

  // Currently selected debtor
  const currentDebtor = useMemo(() => {
    return debtors.find((d) => d.id === selectedDebtorId) || debtors[0];
  }, [debtors, selectedDebtorId]);

  // Filtered debtor list for the left column
  const filteredDebtors = useMemo(() => {
    const q = (debtorSearch || searchQuery).trim().toLowerCase();
    if (!q) return debtors;
    return debtors.filter((d) => {
      if (!d) return false;
      const name = (d.name || '').toLowerCase();
      const rel = (d.relation || '').toLowerCase();
      const phone = String(d.phone || '');
      return name.includes(q) || rel.includes(q) || phone.includes(q);
    });
  }, [debtors, debtorSearch, searchQuery]);

  // Agrupamento estrito em linhas com no máximo 4 usuários por linha:
  // - Linha 1: 4 usuários (índices 0 a 3)
  // - Linha 2: pula para a linha de baixo com mais 4 usuários (índices 4 a 7)
  // - Linha 3: se tiver 9 pessoas ou mais, começa uma terceira linha (índices 8 em diante)
  const debtorRows = useMemo(() => {
    const rows: Debtor[][] = [];
    for (let i = 0; i < filteredDebtors.length; i += 4) {
      rows.push(filteredDebtors.slice(i, i + 4));
    }
    return rows;
  }, [filteredDebtors]);

  // All installments belonging to the currently selected debtor
  const debtorInstallments = useMemo(() => {
    if (!currentDebtor) return [];
    const currentName = (currentDebtor.name || '').toLowerCase();
    return installments.filter(
      (i) =>
        i.debtorId === currentDebtor.id ||
        (i.debtorName && (i.debtorName || '').toLowerCase() === currentName)
    );
  }, [installments, currentDebtor]);

  // Group debtor installments by purchase item (e.g. "Smart TV 55 polegadas", "Notebook Gamer Pro")
  // Allows displaying each purchased item in its own dedicated tab!
  const debtorItems = useMemo(() => {
    const itemMap = new Map<string, {
      product: string;
      cardName: string;
      totalInstallments: number;
      paidCount: number;
      overdueCount: number;
      totalValue: number;
      monthlyValue: number;
      purchaseId?: string;
    }>();

    debtorInstallments.forEach((inst) => {
      const prodName = inst.product || 'Compra';
      const existing = itemMap.get(prodName);
      const isPaid = inst.status === 'paid';
      const isOverdue = inst.status === 'overdue';
      const amt = inst.amount || inst.originalAmount || 0;

      if (!existing) {
        itemMap.set(prodName, {
          product: prodName,
          cardName: inst.cardName,
          totalInstallments: inst.totalInstallments || 18,
          paidCount: isPaid ? 1 : 0,
          overdueCount: isOverdue ? 1 : 0,
          totalValue: amt,
          monthlyValue: inst.originalAmount || amt,
          purchaseId: inst.purchaseId,
        });
      } else {
        existing.totalInstallments = Math.max(existing.totalInstallments, inst.totalInstallments || 0);
        if (isPaid) existing.paidCount += 1;
        if (isOverdue) existing.overdueCount += 1;
        existing.totalValue += amt;
      }
    });

    return Array.from(itemMap.values());
  }, [debtorInstallments]);

  // Auto-default to the first item (e.g. "Smart TV 55 polegadas") when debtor is selected
  // so that items are cleanly separated by tab without mixing
  React.useEffect(() => {
    setSelectedCategoryFilter('all');
    if (debtorItems.length > 0) {
      setSelectedItemTab(debtorItems[0].product);
    } else {
      setSelectedItemTab('all');
    }
  }, [selectedDebtorId]);

  // Filter installments for the spreadsheet table
  const displayedInstallments = useMemo(() => {
    return debtorInstallments.filter((inst) => {
      // Filter by selected purchase item tab (e.g. "Smart TV 55 polegadas" vs "Notebook Gamer Pro")
      if (selectedItemTab !== 'all' && inst.product !== selectedItemTab) {
        return false;
      }

      // Filter by selected category filter
      if (selectedCategoryFilter !== 'all') {
        const catKey = selectedCategoryFilter.replace('cat:', '');
        if (getProductCategory(inst.product) !== catKey) {
          return false;
        }
      }

      // Status filter
      if (statusFilter === 'overdue' && inst.status !== 'overdue') return false;
      if (statusFilter === 'paid' && inst.status !== 'paid') return false;
      if (statusFilter === 'ontime' && inst.status !== 'ontime' && inst.status !== 'soon') return false;

      // Search inside spreadsheet
      if (spreadsheetSearch.trim()) {
        const term = spreadsheetSearch.toLowerCase();
        return (
          inst.product.toLowerCase().includes(term) ||
          inst.cardName.toLowerCase().includes(term) ||
          inst.dueDate.includes(term) ||
          inst.amount.toString().includes(term) ||
          `${inst.installmentNumber}/${inst.totalInstallments}`.includes(term)
        );
      }
      return true;
    });
  }, [debtorInstallments, selectedItemTab, selectedCategoryFilter, statusFilter, spreadsheetSearch]);

  // Summary counts and totals for the spreadsheet
  const paidList = debtorInstallments.filter((i) => i.status === 'paid');
  const overdueList = debtorInstallments.filter((i) => i.status === 'overdue');
  const ontimeList = debtorInstallments.filter((i) => i.status === 'ontime' || i.status === 'soon');

  const totalPaidSum = paidList.reduce((acc, i) => acc + i.originalAmount, 0);
  const totalOverdueSum = overdueList.reduce((acc, i) => acc + (i.amount || i.originalAmount), 0);
  const totalOntimeSum = ontimeList.reduce((acc, i) => acc + i.originalAmount, 0);
  const totalContracted = totalPaidSum + totalOverdueSum + totalOntimeSum;

  // Cálculos específicos para o item selecionado (ex: Smart TV 55 polegadas) ou todas as parcelas
  const activeTabInstallments = useMemo(() => {
    let list = debtorInstallments;
    if (selectedItemTab !== 'all') {
      list = list.filter((i) => i.product === selectedItemTab);
    }
    if (selectedCategoryFilter !== 'all') {
      const catKey = selectedCategoryFilter.replace('cat:', '');
      list = list.filter((i) => getProductCategory(i.product) === catKey);
    }
    return list;
  }, [debtorInstallments, selectedItemTab, selectedCategoryFilter]);

  const activeTabPaid = activeTabInstallments.filter((i) => i.status === 'paid');
  const activeTabOverdue = activeTabInstallments.filter((i) => i.status === 'overdue');
  const activeTabOntime = activeTabInstallments.filter((i) => i.status === 'ontime' || i.status === 'soon');

  const activeTabTotal = activeTabInstallments.reduce((acc, i) => acc + (i.amount || i.originalAmount), 0);
  const activeTabPaidSum = activeTabPaid.reduce((acc, i) => acc + i.originalAmount, 0);
  const activeTabOverdueSum = activeTabOverdue.reduce((acc, i) => acc + (i.amount || i.originalAmount), 0);
  const activeTabOntimeSum = activeTabOntime.reduce((acc, i) => acc + i.originalAmount, 0);
  const activeTabRemaining = activeTabOverdueSum + activeTabOntimeSum;

  const currentDebtorPurchases = purchases.filter((p) => p.debtorId === currentDebtor?.id);

  // Helper de ícone por produto
  const getProductIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('armário') || n.includes('armario') || n.includes('móvel') || n.includes('movel')) return 'shelves';
    if (n.includes('celular') || n.includes('moto') || n.includes('smartphone') || n.includes('iphone') || n.includes('samsung') || n.includes('phone')) return 'smartphone';
    if (n.includes('notebook') || n.includes('computador') || n.includes('dell') || n.includes('laptop') || n.includes('mac')) return 'laptop_mac';
    if (n.includes('tv') || n.includes('smart tv') || n.includes('televis')) return 'tv';
    return 'inventory_2';
  };

  // 1. Agrupamento de TODOS os produtos distintos com suas parcelas (para a aba "Separado por Produto")
  const allProductsData = useMemo(() => {
    const map = new Map<string, {
      product: string;
      debtorNames: Set<string>;
      debtorAvatars: Map<string, string>;
      cardNames: Set<string>;
      totalInstallments: number;
      paidCount: number;
      overdueCount: number;
      soonCount: number;
      ontimeCount: number;
      totalValue: number;
      monthlyValue: number;
      installments: Installment[];
    }>();

    installments.forEach((inst) => {
      const prod = inst.product || 'Outro Produto';
      const amt = inst.amount || inst.originalAmount || 0;
      const isPaid = inst.status === 'paid';
      const isOverdue = inst.status === 'overdue';
      const isSoon = inst.status === 'soon';
      const isOntime = inst.status === 'ontime';

      const existing = map.get(prod);
      if (!existing) {
        const avatars = new Map<string, string>();
        if (inst.debtorAvatar) avatars.set(inst.debtorName, inst.debtorAvatar);

        map.set(prod, {
          product: prod,
          debtorNames: new Set([inst.debtorName]),
          debtorAvatars: avatars,
          cardNames: new Set([inst.cardName || 'Nubank']),
          totalInstallments: inst.totalInstallments || 1,
          paidCount: isPaid ? 1 : 0,
          overdueCount: isOverdue ? 1 : 0,
          soonCount: isSoon ? 1 : 0,
          ontimeCount: isOntime ? 1 : 0,
          totalValue: amt,
          monthlyValue: inst.originalAmount || amt,
          installments: [inst],
        });
      } else {
        existing.debtorNames.add(inst.debtorName);
        if (inst.debtorAvatar) existing.debtorAvatars.set(inst.debtorName, inst.debtorAvatar);
        if (inst.cardName) existing.cardNames.add(inst.cardName);
        existing.totalInstallments = Math.max(existing.totalInstallments, inst.totalInstallments || 0);
        if (isPaid) existing.paidCount += 1;
        if (isOverdue) existing.overdueCount += 1;
        if (isSoon) existing.soonCount += 1;
        if (isOntime) existing.ontimeCount += 1;
        existing.totalValue += amt;
        existing.installments.push(inst);
      }
    });

    return Array.from(map.values()).map((p) => ({
      ...p,
      debtorNamesList: Array.from(p.debtorNames),
      debtorsWithAvatars: Array.from(p.debtorNames).map((name) => ({
        name,
        avatar: p.debtorAvatars.get(name) || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      })),
      cardNamesList: Array.from(p.cardNames),
      sortedInstallments: p.installments.sort((a, b) => a.installmentNumber - b.installmentNumber),
    }));
  }, [installments]);

  // 2. Agrupamento de TODOS os devedores com suas compras e parcelas (para a aba "Separado por Devedor")
  const allDebtorsCardsData = useMemo(() => {
    return debtors.map((d) => {
      const dInsts = installments.filter(
        (i) => i.debtorId === d.id || i.debtorName.toLowerCase() === d.name.toLowerCase()
      );

      // Agrupa compras deste devedor por produto
      const prodMap = new Map<string, Installment[]>();
      dInsts.forEach((inst) => {
        const p = inst.product || 'Compra';
        const list = prodMap.get(p) || [];
        list.push(inst);
        prodMap.set(p, list);
      });

      const products = Array.from(prodMap.entries()).map(([productName, insts]) => {
        const total = insts.reduce((acc, cur) => acc + (cur.amount || cur.originalAmount || 0), 0);
        const paid = insts.filter((i) => i.status === 'paid').length;
        const overdue = insts.filter((i) => i.status === 'overdue').length;
        const soon = insts.filter((i) => i.status === 'soon').length;
        return {
          productName,
          total,
          totalCount: insts.length,
          paidCount: paid,
          overdueCount: overdue,
          soonCount: soon,
          cardName: insts[0]?.cardName || 'Nubank',
          installments: insts.sort((a, b) => a.installmentNumber - b.installmentNumber),
        };
      });

      const totalValue = dInsts.reduce((acc, cur) => acc + (cur.amount || cur.originalAmount || 0), 0);
      const paidCount = dInsts.filter((i) => i.status === 'paid').length;
      const overdueCount = dInsts.filter((i) => i.status === 'overdue').length;

      return {
        debtor: d,
        totalValue,
        paidCount,
        overdueCount,
        totalInstallments: dInsts.length,
        products,
        installments: dInsts.sort((a, b) => a.installmentNumber - b.installmentNumber),
      };
    });
  }, [debtors, installments]);

  // Garante que o modo cartões sempre selecione um devedor e produto individual (nunca 'all')
  useEffect(() => {
    if ((cardsSelectedDebtorId === 'all' || !cardsSelectedDebtorId) && debtors.length > 0) {
      setCardsSelectedDebtorId(debtors[0].id);
    }
  }, [debtors, cardsSelectedDebtorId]);

  useEffect(() => {
    if ((cardsSelectedProduct === 'all' || !cardsSelectedProduct) && allProductsData.length > 0) {
      setCardsSelectedProduct(allProductsData[0].product);
    }
  }, [allProductsData, cardsSelectedProduct]);

  return (
    <div className="flex flex-col w-full gap-3">
      {/* ========================================================================= */}
      {/* DEVEDORES • BOTÕES COMPACTOS EM LINHA (Estilo Botãozinho Conforme o Print) */}
      {/* ========================================================================= */}
      <div className="bg-white/80 backdrop-blur-md border border-slate-200/90 rounded-2xl p-2.5 sm:p-3 shadow-2xs flex flex-col gap-2">
        {/* Barra superior de controle dos devedores: título limpo + busca rápida + novo devedor */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[18px]">group</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-slate-900 text-sm leading-tight">Devedores</h3>
                <span className="px-2 py-0.2 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                  {debtors.length} cadastrados
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Selecione o devedor nos botões para abrir todas as suas informações e extrato completo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Busca Rápida */}
            <div className="relative w-full sm:w-56">
              <span className="material-symbols-outlined absolute left-2.5 text-slate-400 text-[16px] pointer-events-none top-2">
                search
              </span>
              <input
                type="text"
                value={debtorSearch}
                onChange={(e) => setDebtorSearch(e.target.value)}
                placeholder="Buscar devedor..."
                className="w-full h-8 pl-8 pr-7 bg-slate-50 text-slate-800 placeholder:text-slate-400 text-xs rounded-xl outline-none border border-slate-200/80 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
              />
              {debtorSearch && (
                <button
                  onClick={() => setDebtorSearch('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">close</span>
                </button>
              )}
            </div>

            {/* Botão Adicionar Devedor com ícone de pessoinha ao lado da busca */}
            <button
              type="button"
              onClick={onOpenNewDebtor}
              className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-2xs transition-all active:scale-95 flex items-center gap-1.5 shrink-0 cursor-pointer"
              title="Cadastrar Novo Devedor"
            >
              <span className="material-symbols-outlined text-[16px]">person_add</span>
              <span>Adicionar Devedor</span>
            </button>

            {/* Botão Gemini Scanner com QR Code */}
            {onOpenGeminiScanner && (
              <button
                type="button"
                onClick={onOpenGeminiScanner}
                className="h-8 px-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:to-indigo-800 text-white font-bold text-xs rounded-xl shadow-2xs transition-all active:scale-95 flex items-center gap-1.5 shrink-0 cursor-pointer"
                title="Receber contrato assinado com IA Gemini e QR Code scanner"
              >
                <span className="material-symbols-outlined text-[17px]">qr_code_scanner</span>
                <span className="hidden sm:inline">Receber Contrato (IA Gemini)</span>
                <span className="sm:hidden">IA Gemini</span>
              </button>
            )}
          </div>
        </div>

        {/* Linhas de Devedores (Máximo 4 usuários por linha) */}
        {debtorRows.length === 0 ? (
          <div className="py-4 text-center text-xs text-slate-500">
            Nenhum devedor encontrado para &ldquo;{debtorSearch || searchQuery}&rdquo;.
          </div>
        ) : (
          <div className="flex flex-col gap-2 w-full py-0.5">
            {debtorRows.map((row, rowIndex) => (
              <div
                key={`debtor-row-${rowIndex}`}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 w-full"
              >
                {row.map((debtor) => {
                  const isSelected = debtor.id === currentDebtor?.id;
                  const debtorNameLower = (debtor.name || '').toLowerCase();
                  const debtorInsts = installments.filter(
                    (i) => i.debtorId === debtor.id || (i.debtorName && (i.debtorName || '').toLowerCase() === debtorNameLower)
                  );
                  const lateCount = debtorInsts.filter((i) => i.status === 'overdue').length || debtor.overdueCount || 0;
                  const hasSoon = debtorInsts.some((i) => i.status === 'soon');
                  const initials = (debtor.name || 'D').split(/\s+/).filter(Boolean).map((n) => n[0]).slice(0, 2).join('').toUpperCase();
                  const avatarSrc = getCleanDebtorAvatar(debtor.name, debtor.avatar);

                  return (
                    <button
                      key={debtor.id}
                      type="button"
                      onClick={() => {
                        setSelectedDebtorId(debtor.id);
                        if (onSelectDebtor) onSelectDebtor(debtor.id);
                      }}
                      className={`group relative min-h-[64px] py-2 px-3 rounded-2xl border flex items-center justify-between gap-2.5 w-full min-w-0 transition-all cursor-pointer select-none text-xs ${
                        isSelected
                          ? 'bg-blue-50/90 border-blue-600 text-blue-950 font-bold ring-2 ring-blue-500/20 shadow-xs'
                          : 'bg-white hover:bg-slate-50 border-slate-200/90 text-slate-700 shadow-2xs hover:border-slate-300'
                      }`}
                      title={`Clique para abrir o extrato e compras de ${debtor.name}`}
                    >
                      {/* Lado Esquerdo: Avatar Oficial Aprovado + Nome + Relação / Telefone */}
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="relative shrink-0 w-11 h-11">
                          {avatarSrc ? (
                            <img
                              src={avatarSrc}
                              alt={debtor.name}
                              referrerPolicy="no-referrer"
                              className={`w-full h-full rounded-full object-cover shadow-2xs border-2 border-white ring-1 ring-slate-200 ${
                                isSelected ? 'ring-2 ring-blue-500' : ''
                              }`}
                              onError={(e) => {
                                const fallbackUrl = getCleanDebtorAvatar(debtor.name);
                                if (e.currentTarget.src !== fallbackUrl) {
                                  e.currentTarget.src = fallbackUrl;
                                }
                              }}
                            />
                          ) : null}
                          <div
                            className={`avatar-fallback ${avatarSrc ? 'hidden' : ''} w-full h-full rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-white font-black text-xs flex items-center justify-center shadow-2xs border-2 border-white ring-1 ring-slate-200`}
                          >
                            {initials}
                          </div>

                          {/* Selo no cantinho inferior: Check verde em dia ou Alerta vermelho se atrasado */}
                          {lateCount > 0 ? (
                            <span
                              className="absolute -bottom-1 -right-0.5 w-4.5 h-4.5 rounded-full bg-red-600 flex items-center justify-center text-white ring-1.5 ring-white text-[9px] font-black shadow-xs z-10"
                              title="Parcela em atraso"
                            >
                              !
                            </span>
                          ) : (
                            <span
                              className="absolute -bottom-1 -right-0.5 w-4.5 h-4.5 rounded-full bg-white flex items-center justify-center ring-1 ring-slate-100 text-emerald-600 shadow-2xs z-10"
                              title="Pagamentos em dia"
                            >
                              <span className="material-symbols-outlined text-[13px] block">check_circle</span>
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col min-w-0 flex-1 text-left">
                          <span className="font-extrabold text-xs sm:text-sm text-slate-900 truncate block leading-tight" title={debtor.name}>
                            {debtor.name}
                          </span>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5 truncate">
                            <span className="font-semibold text-slate-600">{debtor.relation}</span>
                            {debtor.phone && (
                              <>
                                <span className="text-slate-300">•</span>
                                <span className="truncate">{debtor.phone}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Lado Direito: Score no topo, Status Atrasado / Em dia + Lápis embaixo */}
                      <div className="flex flex-col items-end justify-center gap-1 shrink-0 pl-1.5">
                        <div className="flex items-center gap-1">
                          <span
                            className={`text-[9.5px] px-1.5 py-0.5 rounded-md font-bold whitespace-nowrap ${
                              (debtor.score || 700) >= 800
                                ? 'bg-emerald-100 text-emerald-800'
                                : (debtor.score || 700) >= 600
                                ? 'bg-blue-100 text-blue-800'
                                : (debtor.score || 700) >= 450
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                            title={`Score: ${debtor.score || 700}`}
                          >
                            Score {debtor.score || 700}
                          </span>
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onEditDebtor) onEditDebtor(debtor);
                            }}
                            className="w-5 h-5 rounded hover:bg-slate-200/80 text-slate-400 hover:text-blue-600 flex items-center justify-center transition-colors cursor-pointer"
                            title="Editar devedor"
                          >
                            <span className="material-symbols-outlined text-[13px]">edit</span>
                          </span>
                        </div>

                        {lateCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[9px] font-black border border-red-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                            <span>{lateCount} {lateCount === 1 ? 'atrasada' : 'atrasadas'}</span>
                          </span>
                        ) : hasSoon ? (
                          <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            Vence em breve
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            Em dia
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* CONTEXTO DO DEVEDOR SELECIONADO & PLANILHA UNIFICADA COM O EXTRATO         */}
      {/* ========================================================================= */}
      <div className="w-full min-w-0">
          {currentDebtor ? (
            <div className="bg-white/80 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden flex flex-col">
              
              {/* Header Compacto do Devedor Selecionado (Reorganizado Mobile & Desktop) */}
              <div className="p-3 sm:p-4 border-b border-slate-100 bg-gradient-to-r from-slate-50/90 via-white to-blue-50/30 flex flex-col gap-2.5 sm:gap-3 min-w-0">
                {/* Linha Superior: Perfil (Avatar + Nome + Contatos) + Score & Cashback à Direita */}
                <div className="flex items-start justify-between gap-2.5 min-w-0">
                  {/* Lado Esquerdo: Avatar alinhado perfeitamente com Nome e Contato, sem espaços vazios */}
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <div className="relative shrink-0 w-14 h-14 sm:w-16 sm:h-16">
                      {(() => {
                        const currentAvatarSrc = getCleanDebtorAvatar(currentDebtor.name, currentDebtor.avatar);
                        return (
                          <>
                            {currentAvatarSrc ? (
                              <img
                                src={currentAvatarSrc}
                                alt={currentDebtor.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full rounded-2xl object-cover border-2 border-white ring-1 ring-slate-200 shadow-xs"
                                onError={(e) => {
                                  const fallbackUrl = getCleanDebtorAvatar(currentDebtor.name);
                                  if (e.currentTarget.src !== fallbackUrl) {
                                    e.currentTarget.src = fallbackUrl;
                                  } else {
                                    (e.currentTarget as HTMLElement).style.display = 'none';
                                    const fallback = e.currentTarget.parentElement?.querySelector('.selected-avatar-fallback');
                                    if (fallback) fallback.classList.remove('hidden');
                                  }
                                }}
                              />
                            ) : null}
                            <div
                              className={`selected-avatar-fallback ${currentAvatarSrc ? 'hidden' : ''} w-full h-full rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white font-black text-sm flex items-center justify-center shadow-xs border-2 border-white ring-1 ring-slate-200`}
                            >
                              {(currentDebtor?.name || 'D').split(/\s+/).filter(Boolean).map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                            </div>
                          </>
                        );
                      })()}

                      {/* Selo no cantinho inferior idêntico à imagem 2 */}
                      {currentDebtor.overdueCount > 0 ? (
                        <span className="absolute -bottom-1 -right-0.5 w-5 h-5 rounded-full bg-red-600 flex items-center justify-center text-white ring-2 ring-white text-[10px] font-black z-10 shadow-xs">
                          <span className="material-symbols-outlined text-[12px]">priority_high</span>
                        </span>
                      ) : (
                        <span className="absolute -bottom-1 -right-0.5 w-5 h-5 rounded-full bg-white flex items-center justify-center ring-1 ring-slate-100 text-emerald-600 shadow-xs z-10">
                          <span className="material-symbols-outlined text-[15px] block">check_circle</span>
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h2 className="text-sm sm:text-lg font-bold text-slate-900 leading-tight truncate">
                          {currentDebtor.name}
                        </h2>
                        <span className="px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700 text-[10.5px] font-bold shrink-0">
                          {currentDebtor.relation}
                        </span>
                        {currentDebtor.contractSigned && (
                          <span className="inline-flex items-center gap-0.5 text-emerald-700 font-bold text-[9.5px] bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200 shrink-0">
                            <span className="material-symbols-outlined text-[11px]">verified</span>
                            Assinado
                          </span>
                        )}
                        {/* Botão de Lápis para Editar Devedor */}
                        <button
                          type="button"
                          onClick={() => onEditDebtor && onEditDebtor(currentDebtor)}
                          className="h-5 px-1.5 rounded-md bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 border border-slate-200 text-[10px] font-semibold flex items-center gap-0.5 transition-all cursor-pointer shadow-2xs active:scale-95 shrink-0"
                          title="Editar devedor"
                        >
                          <span className="material-symbols-outlined text-[12px] text-blue-600">edit</span>
                          <span>Editar</span>
                        </button>
                      </div>

                      {/* Contatos (Telefone e PIX) logo abaixo do nome */}
                      <div className="flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs text-slate-500 mt-0.5 flex-wrap">
                        <a
                          href={`tel:${currentDebtor.phone.replace(/\D/g, '')}`}
                          className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[12px] text-slate-400">call</span>
                          <span className="font-medium text-slate-600">{currentDebtor.phone}</span>
                        </a>
                        {currentDebtor.pixKey && (
                          <span className="flex items-center gap-1 font-mono text-[10px] sm:text-[11px] text-slate-600">
                            <span className="material-symbols-outlined text-[12px] text-emerald-600">key</span>
                            PIX: {currentDebtor.pixKey}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Lado Direito: Score e Cashback no Topo Direito (Elimina o vazio à direita) */}
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 shrink-0">
                    <div className="flex items-center gap-1 px-2 py-1 rounded-xl bg-white border border-slate-200 shadow-2xs text-xs">
                      <span className="material-symbols-outlined text-[15px] text-blue-600">speed</span>
                      <span className="text-slate-500 text-[10px] hidden xs:inline">Score:</span>
                      <span className="font-black text-slate-900 text-xs">{currentDebtor.score || 700}</span>
                      <span
                        className={`text-[8.5px] font-bold px-1.5 py-0.2 rounded-md ${
                          (currentDebtor.score || 700) >= 800
                            ? 'bg-emerald-100 text-emerald-800'
                            : (currentDebtor.score || 700) >= 600
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {(currentDebtor.score || 700) >= 800 ? 'Excelente' : (currentDebtor.score || 700) >= 600 ? 'Bom' : 'Regular'}
                      </span>
                    </div>

                  </div>
                </div>

                {/* Grade de Ações: Em Mobile preenche 100% da largura em grid simétrica de 2 colunas, eliminando todos os buracos brancos */}
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5 sm:gap-2 w-full pt-0.5">
                  {/* Gerar Extrato Total - Em linha comprida (col-span-2) */}
                  <button
                    type="button"
                    onClick={() => onOpenExtratoTotal && onOpenExtratoTotal(currentDebtorPurchases[0]?.id, currentDebtor.id)}
                    className="col-span-2 sm:w-auto h-9 sm:h-8 px-2.5 py-1 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center sm:justify-start gap-1.5 transition-all cursor-pointer border bg-gradient-to-r from-blue-700 to-slate-900 hover:from-blue-800 hover:to-slate-950 text-white shadow-2xs active:scale-95 shrink-0"
                    title="Gerar Extrato Total do Parcelamento (Histórico Completo)"
                  >
                    <span className="material-symbols-outlined text-[15px] shrink-0">description</span>
                    <span className="truncate">📄 Gerar Extrato Total</span>
                  </button>

                  {/* Contrato Digital */}
                  <button
                    type="button"
                    onClick={() => onOpenContract && onOpenContract(currentDebtor.id)}
                    className="w-full sm:w-auto h-9 sm:h-8 px-2.5 py-1 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center sm:justify-start gap-1 transition-all cursor-pointer border bg-white hover:bg-indigo-50 text-indigo-700 border-indigo-200 shadow-2xs active:scale-95 shrink-0"
                    title="Gerar ou visualizar contrato digital"
                  >
                    <span className="material-symbols-outlined text-[15px] text-indigo-600 shrink-0">history_edu</span>
                    <span className="truncate">Contrato Digital</span>
                    {currentDebtor.contractSigned ? (
                      <span className="px-1 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[8px] font-black uppercase shrink-0">
                        Assinado
                      </span>
                    ) : (
                      <span className="px-1 py-0.2 rounded-full bg-indigo-100 text-indigo-900 text-[8px] font-bold shrink-0">
                        Assinar
                      </span>
                    )}
                  </button>

                  {/* Nova Compra */}
                  <button
                    type="button"
                    onClick={() => onOpenNewPurchaseForDebtor(currentDebtor.id)}
                    className="w-full sm:w-auto h-9 sm:h-8 px-2.5 py-1 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center sm:justify-start gap-1.5 transition-all cursor-pointer bg-blue-600 hover:bg-blue-700 text-white shadow-2xs active:scale-95 shrink-0"
                    title="Cadastrar nova compra para este devedor"
                  >
                    <span className="material-symbols-outlined text-[15px] shrink-0">add_card</span>
                    <span className="truncate">Nova Compra</span>
                  </button>

                  {/* Cobrança WhatsApp */}
                  <button
                    type="button"
                    onClick={() =>
                      onNudgeWhatsApp(
                        currentDebtor.name,
                        `R$ ${safeToFixed(activeTabRemaining, 2)}`,
                        selectedItemTab !== 'all' ? selectedItemTab : (currentDebtorPurchases[0]?.product || 'Compras parceladas'),
                        'Extrato Atual',
                        currentDebtor.phone
                      )
                    }
                    className={`w-full sm:w-auto h-9 sm:h-8 px-2.5 py-1 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center sm:justify-start gap-1.5 transition-all cursor-pointer border bg-white hover:bg-emerald-50 text-emerald-800 border-emerald-200 shadow-2xs active:scale-95 shrink-0 ${
                      activeTabOverdue.length === 0 ? 'col-span-2 sm:col-span-1' : 'col-span-1'
                    }`}
                    title="Enviar cobrança detalhada via WhatsApp"
                  >
                    <WhatsAppIcon className="w-4 h-4 text-emerald-600 shrink-0" size={15} />
                    <span className="truncate">Cobrança WhatsApp</span>
                  </button>

                  {/* Cobrar Atrasos (se houver) */}
                  {activeTabOverdue.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const targetId = activeTabOverdue[0]?.id || 'inst-1';
                        onNavigate('detalhe-atraso', targetId);
                      }}
                      className="col-span-1 sm:w-auto h-9 sm:h-8 px-2.5 py-1 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center sm:justify-start gap-1.5 transition-all cursor-pointer border bg-white hover:bg-red-50 text-red-700 border-red-200 shadow-2xs active:scale-95 shrink-0"
                    >
                      <span className="material-symbols-outlined text-[15px] text-red-600 shrink-0">warning</span>
                      <span className="truncate">Cobrar Atrasos ({activeTabOverdue.length})</span>
                    </button>
                  )}

                  {/* Relatório - Linha Comprida / Extenso igual ao Extrato Total */}
                  <button
                    type="button"
                    onClick={() => onNavigate('relatorios')}
                    className="col-span-2 sm:w-auto h-9 sm:h-8 px-3 py-1 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center sm:justify-start gap-1.5 transition-all cursor-pointer border bg-white hover:bg-slate-100 text-slate-800 border-slate-300 shadow-2xs active:scale-95 shrink-0"
                    title="Relatório de recebíveis"
                  >
                    <span className="material-symbols-outlined text-[16px] text-slate-700 shrink-0">bar_chart</span>
                    <span className="truncate">Relatório</span>
                  </button>
                </div>
              </div>

              {/* ========================================================================= */}
              {/* LINHA UNIFICADA DO EXTRATO DE PARCELAS • ITENS & TODAS AS AÇÕES / TOTAIS  */}
              {/* (Smart TV, Contrato, WhatsApp, Nova Compra, Totais e Alerta)              */}
              {/* ========================================================================= */}
              <div className="flex flex-col border-b border-slate-200/90 bg-slate-50/50 min-w-0">
                {/* Barra de Filtro Rápido por Categorias do Pedido do Usuário */}
                <div className="px-3 sm:px-4 py-2 bg-white border-b border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs select-none scrollbar-none w-full">
                    <span className="text-[11px] text-slate-700 font-bold whitespace-nowrap shrink-0 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] text-cyan-600 font-black">category</span>
                      <span>Filtrar Categoria:</span>
                    </span>

                    {[
                      { key: 'smartphone', label: 'Smartphone', icon: 'smartphone' },
                      { key: 'curso', label: 'Curso', icon: 'school' },
                      { key: 'design_grafico', label: 'Design Gráfico', icon: 'palette' },
                      { key: 'marketing', label: 'Marketing', icon: 'trending_up' },
                      { key: 'tv_50', label: 'TV de 50', icon: 'tv' },
                      { key: 'estudio_4k', label: 'Estúdio 4K', icon: 'videocam' },
                    ].map((cat) => {
                      const isCatSelected = selectedCategoryFilter === `cat:${cat.key}`;
                      return (
                        <button
                          key={cat.key}
                          type="button"
                          onClick={() => {
                            setSelectedCategoryFilter(isCatSelected ? 'all' : `cat:${cat.key}`);
                            setSelectedItemTab('all'); // Reset specific product tab to avoid conflict
                          }}
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all shrink-0 cursor-pointer border flex items-center gap-1 ${
                            isCatSelected
                              ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-xs font-extrabold'
                              : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600 border-slate-200'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[13px]">{cat.icon}</span>
                          <span>{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 1. Barra dos Itens Comprados (Smart TV, etc.) em Barra Rolável sem vazios */}
                <div className="px-3 sm:px-4 py-2 bg-gradient-to-r from-slate-50 via-blue-50/30 to-slate-50 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-2 min-w-0">
                  {/* Itens Comprados */}
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full xl:w-auto min-w-0 py-0.5">
                    <div className="flex items-center gap-1.5 shrink-0 pr-1">
                      <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                      <span className="text-[11px] uppercase font-bold text-slate-700 tracking-wider whitespace-nowrap">
                        Extrato:
                      </span>
                    </div>

                    {debtorItems.map((item) => {
                      const isSelected = selectedItemTab === item.product;
                      const isShelves = item.product.toLowerCase().includes('armário') || item.product.toLowerCase().includes('armario');
                      const isPhone = item.product.toLowerCase().includes('moto') || item.product.toLowerCase().includes('celular') || item.product.toLowerCase().includes('phone');
                      const icon = isPhone ? 'smartphone' : isShelves ? 'shelves' : 'inventory_2';

                      return (
                        <button
                          key={item.product}
                          type="button"
                          onClick={() => setSelectedItemTab(item.product)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0 border whitespace-nowrap ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-300'
                              : 'bg-white text-slate-700 hover:bg-slate-100/90 border-slate-300 shadow-2xs'
                          }`}
                        >
                          <span className={`material-symbols-outlined text-[16px] ${isSelected ? 'text-white' : 'text-blue-600'}`}>
                            {icon}
                          </span>
                          <span>{item.product}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                              isSelected
                                ? 'bg-blue-700/80 text-blue-100'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            1 a {item.totalInstallments}
                          </span>
                          {item.overdueCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[9px] font-black animate-pulse">
                              {item.overdueCount} atrasada
                            </span>
                          )}
                          {item.paidCount === item.totalInstallments && (
                            <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-black">
                              Quitado
                            </span>
                          )}
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => setSelectedItemTab('all')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 border whitespace-nowrap ${
                        selectedItemTab === 'all'
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs ring-2 ring-slate-400'
                          : 'bg-white text-slate-700 hover:bg-slate-100/90 border-slate-300 shadow-2xs'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">view_kanban</span>
                      <span>Todas Parcelas ({debtorInstallments.length})</span>
                    </button>
                  </div>
                </div>

                {/* 2. Resumo Financeiro Consolidado do Extrato (Total, Quitado, Saldo, Em atraso) e Alerta */}
                <div className="px-3 sm:px-4 py-2 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 min-w-0">
                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-4 text-xs min-w-0 w-full sm:w-auto">
                    {/* Total do Extrato */}
                    <div className="flex items-center justify-between sm:justify-start gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200/80">
                      <span className="text-[10px] uppercase font-bold text-slate-500">Total:</span>
                      <span className="font-bold text-slate-900">
                        R$ {safeToFixed(activeTabTotal).replace('.', ',')}
                      </span>
                    </div>

                    {/* Total Quitado */}
                    <div className="flex items-center justify-between sm:justify-start gap-1.5 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200/80">
                      <span className="text-[10px] uppercase font-bold text-emerald-700">Quitado:</span>
                      <span className="font-bold text-emerald-900">
                        R$ {safeToFixed(activeTabPaidSum).replace('.', ',')}
                      </span>
                    </div>

                    {/* Saldo a Receber */}
                    <div className="flex items-center justify-between sm:justify-start gap-1.5 bg-blue-50 px-2.5 py-1.5 rounded-xl border border-blue-200/80">
                      <span className="text-[10px] uppercase font-bold text-blue-700">A Receber:</span>
                      <span className="font-bold text-blue-900">
                        R$ {safeToFixed(activeTabRemaining).replace('.', ',')}
                      </span>
                    </div>

                    {/* Em Atraso */}
                    <div className={`flex items-center justify-between sm:justify-start gap-1.5 px-2.5 py-1.5 rounded-xl border ${
                      activeTabOverdueSum > 0
                        ? 'bg-red-50 border-red-200 text-red-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}>
                      <span className="text-[10px] uppercase font-bold">Atraso:</span>
                      <span className={`font-bold ${activeTabOverdueSum > 0 ? 'text-red-700' : 'text-slate-800'}`}>
                        R$ {safeToFixed(activeTabOverdueSum).replace('.', ',')}
                        {activeTabOverdue.length > 0 && (
                          <span className="text-[10px] font-black text-red-600 ml-1">
                            ({activeTabOverdue.length})
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Alerta Financeiro (Compacto na Mesma Linha no Desktop, Full Width Responsivo no Mobile) */}
                  {currentDebtor.spendingAlert && (
                    <div className="flex items-center gap-1.5 bg-red-50 text-red-800 border border-red-300 px-2.5 py-1 rounded-xl text-xs shadow-2xs min-w-0 w-full sm:w-auto">
                      <span className="material-symbols-outlined text-[16px] text-red-600 shrink-0">warning</span>
                      <span className="font-bold shrink-0">Atenção:</span>
                      <span className="text-[11px] truncate min-w-0 flex-1">
                        {(currentDebtor.spendingAlertMessage || 'Gastando mais do que ganha. Cautela com novos empréstimos.')
                          .replace(/^⚠️\s*(Sinal de )?Alerta:\s*/i, '')}
                      </span>
                    </div>
                  )}
                </div>

                {/* 3. Filtro por Status da Parcela + Busca Textual + Alternador Planilha / Quadros */}
                <div className="px-4 py-2 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                    <button
                      onClick={() => setStatusFilter('all')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                        statusFilter === 'all'
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Todas ({activeTabInstallments.length})
                    </button>
                    <button
                      onClick={() => setStatusFilter('overdue')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer ${
                        statusFilter === 'overdue'
                          ? 'bg-red-600 text-white shadow-2xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-red-50 hover:text-red-700'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                      Atrasadas ({activeTabOverdue.length})
                    </button>
                    <button
                      onClick={() => setStatusFilter('ontime')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer ${
                        statusFilter === 'ontime'
                          ? 'bg-amber-600 text-white shadow-2xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-amber-50 hover:text-amber-800'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      A Vencer ({activeTabOntime.length})
                    </button>
                    <button
                      onClick={() => setStatusFilter('paid')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer ${
                        statusFilter === 'paid'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-emerald-50 hover:text-emerald-800'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                      Pagas ({activeTabPaid.length})
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0">
                    {/* Campo de Busca */}
                    <div className="relative w-full sm:w-52">
                      <span className="material-symbols-outlined absolute left-2 text-slate-400 text-[15px] pointer-events-none top-1.5">
                        search
                      </span>
                      <input
                        type="text"
                        value={spreadsheetSearch}
                        onChange={(e) => setSpreadsheetSearch(e.target.value)}
                        placeholder="Buscar parcela..."
                        className="w-full h-7 pl-7 pr-6 bg-white text-slate-800 placeholder:text-slate-400 text-xs rounded-lg outline-none border border-slate-200 focus:border-blue-500 transition-all"
                      />
                      {spreadsheetSearch && (
                        <button
                          onClick={() => setSpreadsheetSearch('')}
                          className="absolute right-1.5 top-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[13px]">close</span>
                        </button>
                      )}
                    </div>

                    {/* Alternador Modo Planilha / Modo Cartões */}
                    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-semibold shadow-2xs">
                      <button
                        onClick={() => setViewMode('table')}
                        className={`px-3 py-1 rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                          viewMode === 'table'
                            ? 'bg-blue-600 text-white shadow-2xs font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Visualizar em Modo Planilha"
                      >
                        <span className="material-symbols-outlined text-[15px]">table_chart</span>
                        <span>Modo Planilha</span>
                      </button>
                      <button
                        onClick={() => setViewMode('cards')}
                        className={`px-3 py-1 rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                          viewMode === 'cards'
                            ? 'bg-blue-600 text-white shadow-2xs font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Visualizar em Modo Cartões (Separado por Produto e por Devedores)"
                      >
                        <span className="material-symbols-outlined text-[15px]">grid_view</span>
                        <span>Modo Cartões</span>
                      </button>
                    </div>

                    {/* Controles de Customização ocupando o espaço ao lado de Customizar */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          const next = !isCustomizerActive;
                          setIsCustomizerActive(next);
                          localStorage.setItem('haspaho_layout_customizer_active', String(next));
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border flex items-center gap-1 cursor-pointer shadow-2xs shrink-0 ${
                          isCustomizerActive
                            ? 'bg-amber-500 text-white border-amber-600 ring-2 ring-amber-300'
                            : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                        }`}
                        title="Customizar tamanho, cores e dados dentro das caixinhas"
                      >
                        <span className="material-symbols-outlined text-[15px]">tune</span>
                        <span>{isCustomizerActive ? 'Fechar Customizar' : '🛠️ Customizar'}</span>
                      </button>

                      {/* Stepper rápido de Reduzir (-) e Aumentar (+) Caixinhas */}
                      <div
                        className="inline-flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs"
                        title="Aumentar ou diminuir o tamanho das caixinhas"
                      >
                        <button
                          type="button"
                          onClick={() => handleAdjustScale(-1)}
                          disabled={boxScaleLevel <= 1}
                          className="w-6 h-6 flex items-center justify-center text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer font-bold text-xs"
                          title="Reduzir tamanho das caixinhas (-)"
                        >
                          -
                        </button>
                        <span className="px-1.5 text-[10.5px] font-bold text-slate-700 whitespace-nowrap">
                          {BOX_SCALE_CONFIGS[boxScaleLevel].name}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAdjustScale(1)}
                          disabled={boxScaleLevel >= 4}
                          className="w-6 h-6 flex items-center justify-center text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer font-bold text-xs"
                          title="Aumentar tamanho das caixinhas (+)"
                        >
                          +
                        </button>
                      </div>

                      {/* Seletor rápido de Cores Clarinhas e Neutras */}
                      <div
                        className="flex items-center gap-1 bg-white border border-slate-200 px-1.5 py-1 rounded-lg shadow-2xs"
                        title="Cores clarinhas e neutras para as caixinhas"
                      >
                        <span className="text-[10px] font-bold text-slate-400 hidden xl:inline">Cor:</span>
                        {(Object.keys(BOX_COLOR_THEMES) as BoxColorTheme[]).map((themeKey) => {
                          const config = BOX_COLOR_THEMES[themeKey];
                          const isActive = boxColorTheme === themeKey;
                          return (
                            <button
                              key={themeKey}
                              type="button"
                              onClick={() => handleChangeColorTheme(themeKey)}
                              className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border transition-all cursor-pointer ${config.swatch} ${
                                isActive ? 'ring-2 ring-blue-500 scale-110 shadow-xs' : 'opacity-80 hover:opacity-100'
                              }`}
                              title={`Cor: ${config.label}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Banner / Painel de Customização Expandido */}
              {isCustomizerActive && (
                <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 text-white p-3 sm:p-4 m-3 sm:m-4 rounded-2xl shadow-md border border-amber-400 flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-400/60 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-2xl">tune</span>
                      <div>
                        <h4 className="font-extrabold text-sm leading-tight">
                          Painel de Customização das Caixinhas e Layout
                        </h4>
                        <p className="text-xs text-amber-100">
                          Personalize o tamanho, paletas clarinhas/neutras e edite o texto ou ícone das caixinhas.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleResetAllCaixinhas}
                        className="px-3 py-1 bg-amber-700/80 hover:bg-amber-800 text-white text-xs font-bold rounded-lg cursor-pointer transition-all border border-amber-600 shadow-2xs"
                      >
                        Restaurar Padrão
                      </button>
                      <button
                        type="button"
                        onClick={saveCustomLayout}
                        className="px-4 py-1 bg-white hover:bg-amber-50 text-amber-900 text-xs font-extrabold rounded-lg shadow-sm cursor-pointer transition-all flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[15px]">check</span>
                        <span>Concluir</span>
                      </button>
                    </div>
                  </div>

                  {/* Controles detalhados do Painel de Customização */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3 text-xs">
                    {/* Opção 1: Escala / Tamanho das Caixinhas */}
                    <div className="bg-amber-600/40 p-2.5 rounded-xl border border-amber-400/50 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold flex items-center gap-1 text-[11px]">
                          <span className="material-symbols-outlined text-[14px]">aspect_ratio</span>
                          Tamanho das Caixinhas
                        </span>
                        <span className="text-[10px] bg-amber-700/60 px-1.5 py-0.5 rounded font-mono font-bold">
                          {BOX_SCALE_CONFIGS[boxScaleLevel].label}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1 mt-1">
                        {([1, 2, 3, 4] as BoxScaleLevel[]).map((lvl) => (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() => {
                              setBoxScaleLevel(lvl);
                              localStorage.setItem('haspaho_box_scale_level', String(lvl));
                            }}
                            className={`py-1 rounded font-bold text-[10px] transition-all cursor-pointer ${
                              boxScaleLevel === lvl
                                ? 'bg-white text-amber-900 shadow-xs'
                                : 'bg-amber-700/40 hover:bg-amber-700/70 text-white'
                            }`}
                          >
                            {BOX_SCALE_CONFIGS[lvl].name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Opção 2: Cores Clarinhas e Neutras */}
                    <div className="bg-amber-600/40 p-2.5 rounded-xl border border-amber-400/50 flex flex-col gap-1.5">
                      <span className="font-bold flex items-center gap-1 text-[11px]">
                        <span className="material-symbols-outlined text-[14px]">palette</span>
                        Cores Neutras e Clarinhas
                      </span>
                      <div className="grid grid-cols-3 gap-1 mt-1">
                        {(Object.keys(BOX_COLOR_THEMES) as BoxColorTheme[]).map((themeKey) => {
                          const config = BOX_COLOR_THEMES[themeKey];
                          const isActive = boxColorTheme === themeKey;
                          return (
                            <button
                              key={themeKey}
                              type="button"
                              onClick={() => handleChangeColorTheme(themeKey)}
                              className={`py-1 px-1 rounded flex items-center justify-center gap-1 text-[10px] font-bold transition-all cursor-pointer ${
                                isActive
                                  ? 'bg-white text-amber-900 shadow-xs ring-1 ring-white'
                                  : 'bg-amber-700/40 hover:bg-amber-700/70 text-white'
                              }`}
                            >
                              <span className={`w-2.5 h-2.5 rounded-full border ${config.swatch}`} />
                              <span className="truncate">{config.label.split(' ')[0]}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Opção 3: Conteúdo e Edição dentro das Caixinhas */}
                    <div className="bg-amber-600/40 p-2.5 rounded-xl border border-amber-400/50 flex flex-col gap-1.5">
                      <span className="font-bold flex items-center gap-1 text-[11px]">
                        <span className="material-symbols-outlined text-[14px]">edit_note</span>
                        Exibição & Edição das Caixinhas
                      </span>
                      <div className="flex flex-col gap-1 mt-0.5">
                        <label className="flex items-center gap-1.5 cursor-pointer text-[10.5px]">
                          <input
                            type="checkbox"
                            checked={boxShowCardName}
                            onChange={handleToggleCardName}
                            className="rounded text-amber-700 focus:ring-amber-500 w-3.5 h-3.5 cursor-pointer"
                          />
                          <span>Exibir Cartão/Subtexto (ex: Nubank Croma)</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-[10.5px]">
                          <input
                            type="checkbox"
                            checked={boxShowIcons}
                            onChange={handleToggleIcons}
                            className="rounded text-amber-700 focus:ring-amber-500 w-3.5 h-3.5 cursor-pointer"
                          />
                          <span>Exibir Ícones dentro das Caixinhas</span>
                        </label>
                        <span className="text-[10px] text-amber-200 mt-0.5">
                          💡 Dica: Clique no botão <strong>✎</strong> nas caixinhas de itens da tabela para renomear ou trocar o ícone.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================ */}
              {/* TABELA PLANILHA FINANCEIRA DAS PARCELAS                      */}
              {/* ============================================================ */}
              {/* TABELA PRINCIPAL DE PARCELAS DO DEVEDOR (COMPACTADA MOBILE EM CAIXINHAS / CHIPS) */}
              {/* ============================================================ */}
              {viewMode === 'table' ? (
                <div className="w-full overflow-x-auto table-scroll-container financial-table-container">
                  <table className="w-full text-left text-xs min-w-0 sm:min-w-[850px] border-collapse">
                    <thead>
                      <tr className="bg-slate-100/90 text-slate-600 font-bold uppercase text-[9px] sm:text-[10px] tracking-wider border-b border-slate-200/80 whitespace-nowrap select-none">
                        <th className="py-2 px-3 text-left w-[24%]">Comp. / Compra</th>
                        <th className="py-2 px-3 text-center w-[13%]">Valor</th>
                        <th className="py-2 px-3 text-center w-[13%]">Vencimento</th>
                        <th className="py-2 px-3 text-center w-[13%]">Status</th>
                        <th className="py-2 px-3 text-center w-[13%]">Pagamento</th>
                        <th className="py-2 px-3 text-center w-[13%]">Comprovante</th>
                        <th className="py-2 px-4 text-center sm:text-right pr-6 w-[11%]">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {displayedInstallments.map((item) => {
                        const isOverdue = item.status === 'overdue';
                        const isPaid = item.status === 'paid';
                        const isSoon = item.status === 'soon';
                        const hasPenalty = (item.penaltyFee || 0) + (item.interestFee || 0) + (item.cardFee || 0) > 0;
                        const finalAmount = item.amount || item.originalAmount;

                        const scaleConfig = BOX_SCALE_CONFIGS[boxScaleLevel];
                        const themeConfig = BOX_COLOR_THEMES[boxColorTheme];
                        const customItem = customItemTexts[item.id];
                        const itemDisplayName = customItem?.name || formatProductShort(item.product);
                        const itemCardName = customItem?.card || formatCardShort(item.cardName);
                        const itemIconName = customItem?.icon || getItemIcon(item.product);

                        // Formatação de Parcela de forma bem alinhada "01 / 12" ou "12 / 12"
                        const installmentSeq = `${item.installmentNumber.toString().padStart(2, '0')} / ${item.totalInstallments.toString().padStart(2, '0')}`;

                        return (
                          <tr
                            key={item.id}
                            className={`transition-colors border-b border-slate-100 ${
                              isOverdue
                                ? 'bg-red-50/40 hover:bg-red-50/70'
                                : isPaid
                                ? 'bg-slate-50/30 hover:bg-slate-100/50 opacity-85'
                                : 'hover:bg-blue-50/30'
                            }`}
                          >
                            {/* Coluna 1: Comp. (combina Objeto/Produto com parcela sequencial bonita) com linha de ramificação */}
                            <td className={`${scaleConfig.cellPy} pl-4 pr-3 whitespace-nowrap min-w-0 w-[24%]`}>
                              <div className="flex items-center gap-1.5 w-full">
                                {/* Linha de ramificação interligando os elementos (Estilo Ramificado) */}
                                <div className="relative w-4 self-stretch min-h-[36px] flex items-center justify-center shrink-0">
                                  {/* Linha vertical tracejada */}
                                  <div className="absolute top-0 bottom-0 left-2 w-[1.5px] border-l-2 border-dashed border-cyan-400/40" />
                                  {/* Linha horizontal tracejada para conectar ao card */}
                                  <div className="absolute top-1/2 left-2 w-2 h-[1.5px] border-t-2 border-dashed border-cyan-400/40" />
                                  {/* Ponto focal de junção iluminado */}
                                  <div className="absolute top-1/2 left-2 -translate-x-[2px] -translate-y-[2px] w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee] z-10" />
                                </div>

                                <div
                                  className={`relative flex items-center gap-2 ${scaleConfig.boxPadding} rounded ${themeConfig.itemBox} w-full min-w-0 shadow-2xs group transition-all`}
                                  title={`${item.product} - ${item.cardName}`}
                                >
                                  {boxShowIcons && (
                                    <span className={`material-symbols-outlined ${scaleConfig.iconSize} ${themeConfig.accentText} shrink-0`}>
                                      {itemIconName}
                                    </span>
                                  )}
                                  <div className="flex flex-col min-w-0 flex-1 justify-center leading-normal">
                                    <span className={`font-bold ${scaleConfig.fontSizeItem} leading-tight text-slate-900 truncate`}>
                                      {itemDisplayName}
                                    </span>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span className={`${scaleConfig.fontSizeSub} font-extrabold text-blue-600 bg-blue-50/80 px-1 py-0.2 rounded border border-blue-100 font-mono shrink-0`}>
                                        {installmentSeq}
                                      </span>
                                      {boxShowCardName && (
                                        <span className={`${scaleConfig.fontSizeSub} text-slate-500 font-normal truncate`}>
                                          {itemCardName}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {isCustomizerActive && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingCaixinha({
                                          itemId: item.id,
                                          currentName: customItem?.name || item.product,
                                          currentCard: customItem?.card || item.cardName,
                                          currentIcon: itemIconName,
                                        });
                                      }}
                                      className="w-4 h-4 sm:w-5 sm:h-5 bg-amber-500 hover:bg-amber-600 text-white rounded-full flex items-center justify-center text-[9px] sm:text-[11px] shadow-xs cursor-pointer shrink-0 transition-transform active:scale-95 ml-auto"
                                      title="Editar texto e ícone desta caixinha"
                                    >
                                      ✎
                                    </button>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Coluna 2: Valor */}
                            <td className={`${scaleConfig.cellPy} px-3 whitespace-nowrap text-center w-[13%]`}>
                              <div className={`inline-flex flex-col items-center justify-center w-full ${scaleConfig.boxPadding} rounded bg-emerald-50/90 border border-emerald-300 text-emerald-950 ${scaleConfig.fontSizeBadge} font-bold whitespace-nowrap shadow-2xs`}>
                                <span>
                                  R$ {safeToFixed(isOverdue ? item.originalAmount + 5.00 : finalAmount).replace('.', ',')}
                                </span>
                                {isOverdue ? (
                                  <span className="text-[6.5px] sm:text-[8.5px] text-red-600 font-extrabold leading-none mt-0.5">
                                    +R$5 taxa
                                  </span>
                                ) : hasPenalty ? (
                                  <span className="text-[6.5px] sm:text-[8.5px] text-slate-500 font-medium leading-none mt-0.5">
                                    orig. R$ {safeToFixed(item.originalAmount).replace('.', ',')}
                                  </span>
                                ) : null}
                              </div>
                            </td>

                            {/* Coluna 3: Vencimento */}
                            <td className={`${scaleConfig.cellPy} px-3 whitespace-nowrap text-center w-[13%]`}>
                              <div className={`inline-flex items-center justify-center w-full gap-0.5 ${scaleConfig.boxPadding} rounded border ${scaleConfig.fontSizeBadge} font-semibold whitespace-nowrap shadow-2xs ${
                                isOverdue
                                  ? 'bg-red-50/90 border-red-200 text-red-900 animate-pulse'
                                  : isSoon
                                  ? 'bg-amber-50/90 border-amber-200 text-amber-900'
                                  : 'bg-blue-50/70 border-blue-200/80 text-blue-950'
                              }`}>
                                <span className="sm:hidden">{formatDueDateShort(item.dueDate)}</span>
                                <span className="hidden sm:inline">{item.dueDate}</span>
                                {isOverdue && (
                                  <span className="text-[7px] sm:text-[9.5px] text-red-700 font-black ml-0.5">
                                    (-{item.delayDays || 9}d)
                                  </span>
                                )}
                                {isSoon && (
                                  <span className="text-[7px] sm:text-[9.5px] text-amber-800 font-bold ml-0.5">
                                    ({item.dueInDays || 2}d)
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Coluna 4: Status (Pills cápsulas idênticas ao print) */}
                            <td className={`${scaleConfig.cellPy} px-3 text-center whitespace-nowrap w-[13%]`}>
                              {isPaid ? (
                                <span className={`inline-flex items-center justify-center px-2 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[9.5px] font-extrabold tracking-wider w-24 shadow-2xs`}>
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
                                  <span>PAGO</span>
                                </span>
                              ) : isOverdue ? (
                                <span className={`inline-flex items-center justify-center px-2 py-1.5 rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20 text-[9.5px] font-black tracking-wider w-24 animate-pulse shadow-2xs`}>
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5 animate-ping"></span>
                                  <span>ATRASADO</span>
                                </span>
                              ) : isSoon ? (
                                <span className={`inline-flex items-center justify-center px-2 py-1.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[9.5px] font-extrabold tracking-wider w-24 shadow-2xs`}>
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse"></span>
                                  <span>BREVE</span>
                                </span>
                              ) : (
                                <span className={`inline-flex items-center justify-center px-2 py-1.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20 text-[9.5px] font-extrabold tracking-wider w-24 shadow-2xs`}>
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5"></span>
                                  <span>PENDENTE</span>
                                </span>
                              )}
                            </td>

                            {/* Coluna 5: Pagamento (data e hora ou ---) */}
                            <td className={`${scaleConfig.cellPy} px-3 text-center whitespace-nowrap w-[13%]`}>
                              {isPaid ? (
                                <span className="font-mono text-[10px] sm:text-xs text-slate-600 font-semibold bg-slate-50 border border-slate-200/60 px-2 py-1 rounded shadow-3xs">
                                  {item.paidAt || item.dueDate}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-medium">---</span>
                              )}
                            </td>

                            {/* Coluna 6: Comprovante (botão recibo ou --- / pendente) */}
                            <td className={`${scaleConfig.cellPy} px-3 text-center whitespace-nowrap w-[13%]`}>
                              {isPaid ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onShowProof &&
                                    onShowProof(
                                      currentDebtor.name,
                                      `R$ ${safeToFixed(item.originalAmount || item.amount, 2)}`,
                                      item.paidAt || item.dueDate || 'Hoje',
                                      'Conta Corrente / PIX',
                                      item.authCode || generateAuthCode(),
                                      `${item.product} (Parcela ${item.installmentNumber}/${item.totalInstallments})`
                                    )
                                  }
                                  className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 hover:border-blue-300 flex items-center justify-center cursor-pointer transition-colors shadow-2xs mx-auto"
                                  title="Visualizar Recibo de Pagamento"
                                >
                                  <span className="material-symbols-outlined text-[15px] text-blue-600">visibility</span>
                                </button>
                              ) : (
                                <span className="text-[10px] font-bold text-amber-600/70 bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10">
                                  Pendente
                                </span>
                              )}
                            </td>

                            {/* Coluna 7: Ações */}
                            <td className={`${scaleConfig.cellPy} px-3 text-center sm:text-right pr-6 whitespace-nowrap w-[11%]`}>
                              <div className="flex items-center justify-center sm:justify-end gap-1 sm:gap-1.5">
                                {isPaid ? (
                                  <span className="text-emerald-600 font-extrabold text-[10.5px] flex items-center gap-0.5 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                    <span className="material-symbols-outlined text-[13px]">check_circle</span>
                                    <span>Pago</span>
                                  </span>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => onSettleInstallment(item)}
                                      className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded border border-emerald-600 text-[9.5px] sm:text-xs font-extrabold transition-all shadow-2xs cursor-pointer"
                                      title="Dar baixa / Quitar esta parcela"
                                    >
                                      Quitar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onNudgeWhatsApp(
                                          currentDebtor.name,
                                          `R$ ${safeToFixed(finalAmount, 2)}`,
                                          item.product,
                                          `${item.installmentNumber}/${item.totalInstallments}`,
                                          currentDebtor.phone
                                        )
                                      }
                                      className="w-6 h-6 sm:w-7 sm:h-7 rounded border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 flex items-center justify-center transition-colors cursor-pointer shrink-0 shadow-2xs"
                                      title="Enviar cobrança via WhatsApp"
                                    >
                                      <WhatsAppIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" size={14} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {displayedInstallments.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-500">
                            <span className="material-symbols-outlined text-[36px] text-slate-300 block mb-1">
                              folder_open
                            </span>
                            Nenhuma parcela encontrada para os filtros selecionados.
                          </td>
                        </tr>
                      )}
                    </tbody>

                    {/* Rodapé com Totais da Planilha */}
                    {displayedInstallments.length > 0 && (
                      <tfoot>
                        <tr className="bg-slate-100/90 text-slate-800 font-bold text-xs border-t-2 border-slate-200 select-none">
                          <td className="py-3 px-4 font-bold" colSpan={4}>
                            <div className="flex items-center gap-2">
                              <span>TOTAL DAS PARCELAS EXIBIDAS</span>
                              <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] text-slate-600 font-semibold shadow-3xs">
                                {displayedInstallments.length} itens
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-black text-blue-700 text-sm text-center">
                            R$ {safeFormatCurrency(displayedInstallments.reduce((acc, i) => acc + safeToNumber(i.amount || i.originalAmount), 0))}
                          </td>
                          <td colSpan={2} className="py-3 px-4 text-right text-[11px] text-slate-500 font-normal pr-6">
                            Conciliação atualizada em tempo real
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              ) : (
                /* ========================================================================= */
                /* MODO CARTÕES • ESTRITAMENTE SEPARADO POR PRODUTO E POR DEVEDORES          */
                /* ========================================================================= */
                <div className="flex flex-col bg-slate-50/60 min-h-[400px]">
                  {/* Top Bar do Modo Cartões: Seletor Principal de Abas (Produto vs Devedores) */}
                  <div className="p-3 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setCardsGroupMode('by-product')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                          cardsGroupMode === 'by-product'
                            ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80 ring-1 ring-blue-500/20'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[17px] text-blue-600">inventory_2</span>
                        <span>Separado por Produto</span>
                        <span className="px-1.5 py-0.2 bg-blue-50 text-blue-700 rounded-full text-[10px] font-bold border border-blue-200">
                          {allProductsData.length}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCardsGroupMode('by-debtor')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                          cardsGroupMode === 'by-debtor'
                            ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80 ring-1 ring-blue-500/20'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[17px] text-blue-600">groups</span>
                        <span>Separado por Devedor</span>
                        <span className="px-1.5 py-0.2 bg-blue-50 text-blue-700 rounded-full text-[10px] font-bold border border-blue-200">
                          {debtors.length}
                        </span>
                      </button>
                    </div>

                    {/* Filtros de Status no Modo Cartões */}
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Filtrar:</span>
                      <button
                        type="button"
                        onClick={() => setStatusFilter('all')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                          statusFilter === 'all'
                            ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200'
                        }`}
                      >
                        Todos
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter('overdue')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border flex items-center gap-1 ${
                          statusFilter === 'overdue'
                            ? 'bg-red-600 text-white border-red-600 shadow-2xs'
                            : 'bg-white text-red-700 hover:bg-red-50 border-red-200'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        Em Atraso
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter('ontime')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border flex items-center gap-1 ${
                          statusFilter === 'ontime'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                            : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
                        }`}
                      >
                        Em Aberto
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter('paid')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border flex items-center gap-1 ${
                          statusFilter === 'paid'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                            : 'bg-white text-emerald-700 hover:bg-emerald-50 border-emerald-200'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px]">check</span>
                        Quitadas
                      </button>
                    </div>
                  </div>

                  {/* ========================================================================= */}
                  {/* ABA 1: SEPARADO POR PRODUTO (Produtos independentes, sem misturar)       */}
                  {/* ========================================================================= */}
                  {cardsGroupMode === 'by-product' && (
                    <div className="p-4 flex flex-col gap-4">
                      {/* Sub-abas de seleção de Produto */}
                      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                        {allProductsData.map((prod) => {
                          const isSelected = cardsSelectedProduct === prod.product;
                          const icon = getProductIcon(prod.product);
                          return (
                            <button
                              key={prod.product}
                              type="button"
                              onClick={() => setCardsSelectedProduct(prod.product)}
                              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0 border ${
                                isSelected
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-200'
                                  : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300 shadow-2xs'
                              }`}
                            >
                              <span className={`material-symbols-outlined text-[16px] ${isSelected ? 'text-white' : 'text-blue-600'}`}>
                                {icon}
                              </span>
                              <span className="truncate max-w-[160px]">{prod.product}</span>
                              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                                isSelected ? 'bg-blue-700 text-blue-100' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {prod.installments.length} parc.
                              </span>
                              {prod.overdueCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[9px] font-black animate-pulse">
                                  {prod.overdueCount} atraso
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Lista de Produtos renderizados */}
                      {allProductsData
                        .filter((p) => cardsSelectedProduct === 'all' || p.product === cardsSelectedProduct)
                        .map((prod) => {
                          const matchingInstallments = prod.sortedInstallments.filter((inst) => {
                            if (statusFilter === 'overdue' && inst.status !== 'overdue') return false;
                            if (statusFilter === 'paid' && inst.status !== 'paid') return false;
                            if (statusFilter === 'ontime' && inst.status !== 'ontime' && inst.status !== 'soon') return false;
                            if (spreadsheetSearch.trim()) {
                              const term = spreadsheetSearch.toLowerCase();
                              return (
                                inst.product.toLowerCase().includes(term) ||
                                inst.debtorName.toLowerCase().includes(term) ||
                                inst.cardName.toLowerCase().includes(term) ||
                                inst.dueDate.includes(term) ||
                                inst.amount.toString().includes(term) ||
                                `${inst.installmentNumber}/${inst.totalInstallments}`.includes(term)
                              );
                            }
                            return true;
                          });

                          return (
                            <div
                              key={prod.product}
                              className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/60 shadow-md overflow-hidden"
                            >
                              {/* Cabeçalho do Bloco de Produto - Compacto & Otimizado */}
                              <div className="px-3 py-2.5 bg-gradient-to-r from-slate-50 via-blue-50/20 to-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-2xs shrink-0">
                                    <span className="material-symbols-outlined text-[18px]">
                                      {getProductIcon(prod.product)}
                                    </span>
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm truncate">{prod.product}</h4>
                                      <span className="text-[9.5px] sm:text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                                        {prod.installments.length} parcelas
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10.5px] sm:text-xs text-slate-500">
                                      <span>Cartão: <strong className="text-slate-700">{prod.cardNamesList.join(', ')}</strong></span>
                                      <span>•</span>
                                      <span>Total: <strong className="text-blue-700 font-bold">R$ {safeToFixed(prod.totalValue).replace('.', ',')}</strong></span>
                                    </div>
                                  </div>
                                </div>

                                {/* Devedores Responsáveis por este Produto */}
                                <div className="flex items-center gap-2.5 shrink-0 ml-auto sm:ml-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10.5px] font-semibold text-slate-400">Devedor:</span>
                                    <div className="flex -space-x-1.5 overflow-hidden">
                                      {prod.debtorsWithAvatars.map((d, idx) => (
                                        <SafeDebtorAvatar key={idx} name={d.name} avatar={d.avatar} size="xs" />
                                      ))}
                                    </div>
                                    <span className="text-[11px] sm:text-xs font-bold text-slate-800 max-w-[110px] sm:max-w-[180px] truncate">
                                      {prod.debtorNamesList.join(', ')}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1 text-[10px] sm:text-[11px]">
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                                      {prod.paidCount} pagas
                                    </span>
                                    {prod.overdueCount > 0 && (
                                      <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 font-bold border border-red-200">
                                        {prod.overdueCount} atraso
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Grid de Cartões deste Produto - Pequeninos e Compactos (2 colunas no mobile) */}
                              <div className="p-2 sm:p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5 sm:gap-2.5 bg-slate-50/50">
                                {matchingInstallments.map((item) => {
                                  const isOverdue = item.status === 'overdue';
                                  const isPaid = item.status === 'paid';
                                  const isSoon = item.status === 'soon';
                                  const finalAmount = item.amount || item.originalAmount;

                                  return (
                                    <div
                                      key={item.id}
                                      className={`p-2 sm:p-2.5 rounded-xl border transition-all flex flex-col justify-between shadow-2xs hover:shadow-xs ${
                                        isOverdue
                                          ? 'bg-red-50/90 border-red-300 ring-1 ring-red-400'
                                          : isPaid
                                          ? 'bg-slate-50/60 border-slate-200/80 opacity-90'
                                          : isSoon
                                          ? 'bg-amber-50/80 border-amber-300'
                                          : 'bg-white border-slate-200/90 hover:border-slate-300'
                                      }`}
                                    >
                                      <div>
                                        {/* Linha 1: Número da Parcela + Status */}
                                        <div className="flex items-center justify-between gap-1">
                                          <span className="font-mono font-bold text-[9.5px] sm:text-[11px] text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                            #{item.installmentNumber}/{item.totalInstallments}
                                          </span>
                                          {isPaid ? (
                                            <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-300 text-[8.5px] sm:text-[9.5px] font-bold">
                                              <span className="material-symbols-outlined text-[10px] sm:text-[11px]">check_circle</span> PAGO
                                            </span>
                                          ) : isOverdue ? (
                                            <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-red-100 text-red-700 border border-red-400 text-[8.5px] sm:text-[9.5px] font-black animate-pulse">
                                              <span className="material-symbols-outlined text-[10px] sm:text-[11px]">warning</span> ATRASO
                                            </span>
                                          ) : isSoon ? (
                                            <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-50 text-amber-950 border border-amber-300 text-[8.5px] sm:text-[9.5px] font-bold">
                                              <span className="material-symbols-outlined text-[10px] sm:text-[11px] text-amber-700">flag</span> BREVE
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 text-[8.5px] sm:text-[9.5px] font-medium">
                                              <span className="w-1 h-1 rounded-full bg-slate-400" /> EM DIA
                                            </span>
                                          )}
                                        </div>

                                        {/* Linha 2: Vencimento e Valor em caixinha compacta */}
                                        <div className="my-1.5 p-1 sm:p-1.5 rounded-lg bg-slate-50 border border-slate-200/80 text-center">
                                          <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-slate-500 font-medium px-0.5">
                                            <span>Vencimento</span>
                                            <span className={`font-bold ${isOverdue ? 'text-red-600' : 'text-slate-700'}`}>
                                              {item.dueDate}
                                            </span>
                                          </div>
                                          <div className="mt-0.5 text-xs sm:text-[13px] font-black text-slate-900 flex items-center justify-center gap-1">
                                            <span>R$ {safeToFixed(isOverdue ? item.originalAmount + 5.00 : finalAmount).replace('.', ',')}</span>
                                            {isOverdue && (
                                              <span className="text-[7.5px] sm:text-[8px] text-red-600 font-extrabold">+R$5</span>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Linha 3: Ações Compactas */}
                                      <div className="pt-1 border-t border-slate-100">
                                        {isPaid ? (
                                          <div className="flex items-center justify-between text-[9px] sm:text-[10.5px] text-slate-500">
                                            <span className="text-[8.5px] sm:text-[9.5px] text-slate-400 truncate">
                                              {item.paidAt ? formatDueDateShort(item.paidAt) : 'Quitado'}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                onShowProof &&
                                                onShowProof(
                                                  item.debtorName,
                                                  `R$ ${safeToFixed(item.originalAmount, 2)}`,
                                                  item.paidAt || item.dueDate,
                                                  'PIX / Banco',
                                                  item.authCode || generateAuthCode(),
                                                  item.product
                                                )
                                              }
                                              className="px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-[9px] sm:text-[10px] font-bold cursor-pointer transition-colors"
                                            >
                                              Recibo
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-1">
                                            <button
                                              type="button"
                                              onClick={() => onSettleInstallment(item)}
                                              className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded text-[9.5px] sm:text-[11px] font-bold transition-all shadow-2xs cursor-pointer flex items-center justify-center gap-0.5"
                                              title="Quitar"
                                            >
                                              <span className="material-symbols-outlined text-[12px]">check</span>
                                              <span>Quitar</span>
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const d = debtors.find((deb) => deb.id === item.debtorId || deb.name.toLowerCase() === item.debtorName.toLowerCase());
                                                onNudgeWhatsApp(
                                                  item.debtorName,
                                                  `R$ ${safeToFixed(finalAmount, 2)}`,
                                                  item.product,
                                                  `${item.installmentNumber}/${item.totalInstallments}`,
                                                  d?.phone || '(14) 99733-9863'
                                                );
                                              }}
                                              className="w-6 h-6 rounded border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                                              title="Cobrar via WhatsApp"
                                            >
                                              <span className="material-symbols-outlined text-[13px]">chat</span>
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}

                                {matchingInstallments.length === 0 && (
                                  <div className="col-span-full py-8 text-center text-slate-500 text-xs">
                                    Nenhuma parcela para este produto com o filtro atual.
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}

                  {/* ========================================================================= */}
                  {/* ABA 2: SEPARADO POR DEVEDOR (Devedores com suas compras em abas próprias)  */}
                  {/* ========================================================================= */}
                  {cardsGroupMode === 'by-debtor' && (
                    <div className="p-4 flex flex-col gap-4">
                      {/* Sub-abas de seleção de Devedor */}
                      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                        {allDebtorsCardsData.map((dItem) => {
                          const isSelected = cardsSelectedDebtorId === dItem.debtor.id;
                          return (
                            <button
                              key={dItem.debtor.id}
                              type="button"
                              onClick={() => {
                                setCardsSelectedDebtorId(dItem.debtor.id);
                                setCardsDebtorProductTab('all');
                              }}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0 border ${
                                isSelected
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-200'
                                  : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300 shadow-2xs'
                              }`}
                            >
                              <SafeDebtorAvatar name={dItem.debtor.name} avatar={dItem.debtor.avatar} size="xs" />
                              <span className="truncate max-w-[120px]">{dItem.debtor.name}</span>
                              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                                isSelected ? 'bg-blue-700 text-blue-100' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {dItem.products.length} itens
                              </span>
                              {dItem.overdueCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[9px] font-black animate-pulse">
                                  {dItem.overdueCount} atraso
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Conteúdo dos Devedores */}
                      {allDebtorsCardsData
                        .filter((dItem) => cardsSelectedDebtorId === 'all' || dItem.debtor.id === cardsSelectedDebtorId)
                        .map((dItem) => {
                          return (
                            <div
                              key={dItem.debtor.id}
                              className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/60 shadow-md overflow-hidden"
                            >
                              {/* Cabeçalho do Devedor - Compacto & Responsivo */}
                              <div className="px-3 py-2.5 bg-gradient-to-r from-slate-50 via-blue-50/30 to-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <SafeDebtorAvatar
                                    name={dItem.debtor.name}
                                    avatar={dItem.debtor.avatar}
                                    size="md"
                                    className="ring-2 ring-blue-500/30 shadow-2xs"
                                  />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm truncate">{dItem.debtor.name}</h4>
                                      <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                                        {dItem.debtor.relation}
                                      </span>
                                      <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300">
                                        Score: {dItem.debtor.score}
                                      </span>
                                    </div>
                                    <div className="text-[10.5px] sm:text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                                      <span>Tel: <strong className="text-slate-700">{dItem.debtor.phone}</strong></span>
                                      <span>•</span>
                                      <span>Total: <strong className="text-blue-700 font-bold">R$ {safeToFixed(dItem.totalValue).replace('.', ',')}</strong></span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0 ml-auto sm:ml-0">
                                  <button
                                    type="button"
                                    onClick={() => onOpenNewPurchaseForDebtor(dItem.debtor.id)}
                                    className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[11px] font-bold transition-all border border-blue-200 cursor-pointer flex items-center gap-1"
                                    title="Nova Compra para este devedor"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">add_shopping_cart</span>
                                    <span className="hidden sm:inline">Nova Compra</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onOpenContract && onOpenContract(dItem.debtor.id)}
                                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-all border border-slate-200 cursor-pointer flex items-center gap-1"
                                    title="Ver Contrato"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">description</span>
                                    <span className="hidden sm:inline">Contrato</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const overdue = dItem.installments.find((i) => i.status === 'overdue');
                                      onNudgeWhatsApp(
                                        dItem.debtor.name,
                                        `R$ ${(overdue?.amount ||safeToFixed(100), 2)}`,
                                        overdue?.product || 'Parcela',
                                        `${overdue?.installmentNumber || 1}/${overdue?.totalInstallments || 1}`,
                                        dItem.debtor.phone
                                      );
                                    }}
                                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
                                  >
                                    <WhatsAppIcon className="w-4 h-4 text-white" size={15} />
                                    <span>WhatsApp</span>
                                  </button>
                                </div>
                              </div>

                              {/* Se o devedor tiver múltiplos produtos, abas para alternar produtos deste devedor */}
                              {dItem.products.length > 1 && (
                                <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2 overflow-x-auto no-scrollbar">
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                    Produtos de {dItem.debtor.name.split(' ')[0]}:
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setCardsDebtorProductTab('all')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all border ${
                                      cardsDebtorProductTab === 'all'
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                        : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
                                    }`}
                                  >
                                    Todos ({dItem.installments.length})
                                  </button>
                                  {dItem.products.map((p) => (
                                    <button
                                      key={p.productName}
                                      type="button"
                                      onClick={() => setCardsDebtorProductTab(p.productName)}
                                      className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all border flex items-center gap-1 ${
                                        cardsDebtorProductTab === p.productName
                                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                          : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
                                      }`}
                                    >
                                      <span className="material-symbols-outlined text-[14px]">
                                        {getProductIcon(p.productName)}
                                      </span>
                                      <span>{p.productName}</span>
                                      <span className="text-[10px] font-semibold opacity-80">({p.totalCount})</span>
                                    </button>
                                  ))}
                                </div>
                              )}

                              {/* Grid de Cartões do Devedor - Pequeninos e Compactos (2 colunas no mobile) */}
                              <div className="p-2 sm:p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5 sm:gap-2.5 bg-slate-50/50">
                                {dItem.installments
                                  .filter((inst) => {
                                    if (cardsDebtorProductTab !== 'all' && inst.product !== cardsDebtorProductTab) return false;
                                    if (statusFilter === 'overdue' && inst.status !== 'overdue') return false;
                                    if (statusFilter === 'paid' && inst.status !== 'paid') return false;
                                    if (statusFilter === 'ontime' && inst.status !== 'ontime' && inst.status !== 'soon') return false;
                                    if (spreadsheetSearch.trim()) {
                                      const term = spreadsheetSearch.toLowerCase();
                                      return (
                                        inst.product.toLowerCase().includes(term) ||
                                        inst.cardName.toLowerCase().includes(term) ||
                                        inst.dueDate.includes(term) ||
                                        inst.amount.toString().includes(term) ||
                                        `${inst.installmentNumber}/${inst.totalInstallments}`.includes(term)
                                      );
                                    }
                                    return true;
                                  })
                                  .map((item) => {
                                    const isOverdue = item.status === 'overdue';
                                    const isPaid = item.status === 'paid';
                                    const isSoon = item.status === 'soon';
                                    const finalAmount = item.amount || item.originalAmount;

                                    return (
                                      <div
                                        key={item.id}
                                        className={`p-2 sm:p-2.5 rounded-xl border transition-all flex flex-col justify-between shadow-2xs hover:shadow-xs ${
                                          isOverdue
                                            ? 'bg-red-50/90 border-red-300 ring-1 ring-red-400'
                                            : isPaid
                                            ? 'bg-slate-50/60 border-slate-200/80 opacity-90'
                                            : isSoon
                                            ? 'bg-amber-50/80 border-amber-300'
                                            : 'bg-white border-slate-200/90 hover:border-slate-300'
                                        }`}
                                      >
                                        <div>
                                          {/* Linha 1: Número da Parcela + Status */}
                                          <div className="flex items-center justify-between gap-1">
                                            <span className="font-mono font-bold text-[9.5px] sm:text-[11px] text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                              #{item.installmentNumber}/{item.totalInstallments}
                                            </span>
                                            {isPaid ? (
                                              <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-300 text-[8.5px] sm:text-[9.5px] font-bold">
                                                <span className="material-symbols-outlined text-[10px] sm:text-[11px]">check_circle</span> PAGO
                                              </span>
                                            ) : isOverdue ? (
                                              <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-red-100 text-red-700 border border-red-400 text-[8.5px] sm:text-[9.5px] font-black animate-pulse">
                                                <span className="material-symbols-outlined text-[10px] sm:text-[11px]">warning</span> ATRASO
                                              </span>
                                            ) : isSoon ? (
                                              <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-50 text-amber-950 border border-amber-300 text-[8.5px] sm:text-[9.5px] font-bold">
                                                <span className="material-symbols-outlined text-[10px] sm:text-[11px] text-amber-700">flag</span> BREVE
                                              </span>
                                            ) : (
                                              <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 text-[8.5px] sm:text-[9.5px] font-medium">
                                                <span className="w-1 h-1 rounded-full bg-slate-400" /> EM DIA
                                              </span>
                                            )}
                                          </div>

                                          {/* Linha 2: Produto e Cartão compacto */}
                                          <div className="mt-1.5 flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[13px] text-blue-600 shrink-0">
                                              {getProductIcon(item.product)}
                                            </span>
                                            <span className="font-bold text-slate-900 text-[11px] sm:text-xs truncate" title={item.product}>
                                              {item.product}
                                            </span>
                                          </div>
                                          <div className="text-[9.5px] sm:text-[10.5px] text-slate-400 truncate flex items-center gap-0.5">
                                            <span className="truncate">{formatCardShort(item.cardName)}</span>
                                          </div>

                                          {/* Linha 3: Vencimento e Valor em caixinha compacta */}
                                          <div className="my-1.5 p-1 sm:p-1.5 rounded-lg bg-slate-50 border border-slate-200/80 text-center">
                                            <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-slate-500 font-medium px-0.5">
                                              <span>Vencimento</span>
                                              <span className={`font-bold ${isOverdue ? 'text-red-600' : 'text-slate-700'}`}>
                                                {item.dueDate}
                                              </span>
                                            </div>
                                            <div className="mt-0.5 text-xs sm:text-[13px] font-black text-slate-900 flex items-center justify-center gap-1">
                                              <span>R$ {safeToFixed(isOverdue ? item.originalAmount + 5.00 : finalAmount).replace('.', ',')}</span>
                                              {isOverdue && (
                                                <span className="text-[7.5px] sm:text-[8px] text-red-600 font-extrabold">+R$5</span>
                                              )}
                                            </div>
                                          </div>
                                        </div>

                                        {/* Linha 4: Ações Compactas */}
                                        <div className="pt-1 border-t border-slate-100">
                                          {isPaid ? (
                                            <div className="flex items-center justify-between text-[9px] sm:text-[10.5px] text-slate-500">
                                              <span className="text-[8.5px] sm:text-[9.5px] text-slate-400 truncate">
                                                {item.paidAt ? formatDueDateShort(item.paidAt) : 'Quitado'}
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  onShowProof &&
                                                  onShowProof(
                                                    dItem.debtor.name,
                                                    `R$ ${safeToFixed(item.originalAmount, 2)}`,
                                                    item.paidAt || item.dueDate,
                                                    'PIX / Banco',
                                                    item.authCode || generateAuthCode(),
                                                    item.product
                                                  )
                                                }
                                                className="px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-[9px] sm:text-[10px] font-bold cursor-pointer transition-colors"
                                              >
                                                Recibo
                                              </button>
                                            </div>
                                          ) : (
                                            <div className="flex items-center gap-1">
                                              <button
                                                type="button"
                                                onClick={() => onSettleInstallment(item)}
                                                className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded text-[9.5px] sm:text-[11px] font-bold transition-all shadow-2xs cursor-pointer flex items-center justify-center gap-0.5"
                                                title="Quitar"
                                              >
                                                <span className="material-symbols-outlined text-[12px]">check</span>
                                                <span>Quitar</span>
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  onNudgeWhatsApp(
                                                    dItem.debtor.name,
                                                    `R$ ${safeToFixed(finalAmount, 2)}`,
                                                    item.product,
                                                    `${item.installmentNumber}/${item.totalInstallments}`,
                                                    dItem.debtor.phone
                                                  )
                                                }
                                                className="w-6 h-6 rounded border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                                                title="Cobrar via WhatsApp"
                                              >
                                                <WhatsAppIcon className="w-3.5 h-3.5 text-emerald-600" size={13} />
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}

            </div>
          ) : (
            <div className="p-12 bg-white border border-slate-200 rounded-2xl text-center text-slate-500">
              Selecione uma aba de devedor acima para visualizar a planilha.
            </div>
          )}
        </div>

        {/* Modal de Customização / Edição da Caixinha */}
        {editingCaixinha && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-400 text-xl">tune</span>
                  <h3 className="font-bold text-sm">Personalizar Caixinha do Item</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingCaixinha(null)}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              <div className="p-4 sm:p-5 flex flex-col gap-4">
                <p className="text-xs text-slate-500">
                  Adapte o nome exibido, cartão/subtexto ou o ícone desta caixinha para melhor organização.
                </p>

                {/* Prévia da Caixinha em Tempo Real */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700">Prévia da Caixinha:</label>
                  <div className={`p-2.5 rounded-lg border flex items-center gap-2 ${BOX_COLOR_THEMES[boxColorTheme].itemBox} shadow-2xs`}>
                    {boxShowIcons && (
                      <span className={`material-symbols-outlined text-lg ${BOX_COLOR_THEMES[boxColorTheme].accentText}`}>
                        {editingCaixinha.currentIcon || 'inventory_2'}
                      </span>
                    )}
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-bold text-xs leading-tight truncate">
                        {editingCaixinha.currentName || 'Nome do Item'}
                      </span>
                      {boxShowCardName && (
                        <span className="text-[10px] opacity-75 font-normal truncate">
                          {editingCaixinha.currentCard || 'Subtexto / Cartão'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Campo 1: Nome do Item / Objeto */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">Nome ou Abreviatura do Item:</label>
                  <input
                    type="text"
                    value={editingCaixinha.currentName}
                    onChange={(e) =>
                      setEditingCaixinha({ ...editingCaixinha, currentName: e.target.value })
                    }
                    placeholder="Ex: Smart TV, iPhone, Armário..."
                    className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-blue-500 outline-none transition-all"
                  />
                </div>

                {/* Campo 2: Subtexto / Cartão */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">Subtexto / Cartão:</label>
                  <input
                    type="text"
                    value={editingCaixinha.currentCard}
                    onChange={(e) =>
                      setEditingCaixinha({ ...editingCaixinha, currentCard: e.target.value })
                    }
                    placeholder="Ex: Nubank Croma, Mercado Pago..."
                    className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-blue-500 outline-none transition-all"
                  />
                </div>

                {/* Campo 3: Escolha do Ícone */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700">Ícone Representativo:</label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[
                      { id: 'tv', label: 'TV' },
                      { id: 'smartphone', label: 'Celular' },
                      { id: 'shelves', label: 'Armário' },
                      { id: 'laptop', label: 'Notebook' },
                      { id: 'kitchen', label: 'Cozinha' },
                      { id: 'mode_fan', label: 'Ar Cond.' },
                      { id: 'credit_card', label: 'Cartão' },
                      { id: 'shopping_bag', label: 'Compras' },
                      { id: 'inventory_2', label: 'Caixa' },
                      { id: 'star', label: 'Destaque' },
                    ].map((iconOpt) => (
                      <button
                        key={iconOpt.id}
                        type="button"
                        onClick={() =>
                          setEditingCaixinha({ ...editingCaixinha, currentIcon: iconOpt.id })
                        }
                        className={`flex flex-col items-center justify-center p-1.5 rounded-lg border transition-all cursor-pointer ${
                          editingCaixinha.currentIcon === iconOpt.id
                            ? 'bg-amber-100 border-amber-500 text-amber-900 font-bold shadow-xs'
                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                        }`}
                        title={iconOpt.label}
                      >
                        <span className="material-symbols-outlined text-[18px]">{iconOpt.id}</span>
                        <span className="text-[9px] mt-0.5 truncate">{iconOpt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Botões de Ação */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 mt-1">
                  <button
                    type="button"
                    onClick={() => handleResetCaixinha(editingCaixinha.itemId)}
                    className="px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 font-semibold rounded-lg cursor-pointer transition-colors"
                  >
                    Restaurar Original
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingCaixinha(null)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 font-semibold rounded-lg cursor-pointer transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleSaveCustomCaixinha(
                          editingCaixinha.itemId,
                          editingCaixinha.currentName,
                          editingCaixinha.currentCard,
                          editingCaixinha.currentIcon || 'inventory_2'
                        )
                      }
                      className="px-4 py-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg shadow-sm cursor-pointer transition-all"
                    >
                      Salvar Caixinha
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};
