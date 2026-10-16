import React, { useState } from 'react';
import { PAYMENT_METHOD_GROUPS } from '../data/paymentMethods';
import { playAppSound } from '../utils/soundUtils';

interface PaymentMethodSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  theme?: 'dark' | 'light';
}

export const getPaymentBrandStyle = (name: string) => {
  const lower = (name || '').toLowerCase();
  if (lower.includes('pix') || lower.includes('dinheiro') || lower.includes('espécie')) {
    return {
      bg: 'bg-gradient-to-r from-emerald-950/90 via-teal-900/80 to-slate-900 border-emerald-500/50 text-emerald-200',
      badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
      icon: 'bolt',
      brand: 'PIX & Dinheiro',
    };
  }
  if (lower.includes('nubank')) {
    return {
      bg: 'bg-gradient-to-r from-purple-950/90 via-indigo-950/80 to-slate-900 border-purple-500/50 text-purple-200',
      badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-400/40',
      icon: 'credit_card',
      brand: 'Nubank',
    };
  }
  if (lower.includes('c6')) {
    return {
      bg: 'bg-gradient-to-r from-slate-900 via-neutral-900 to-black border-slate-600 text-slate-100',
      badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40',
      icon: 'credit_card',
      brand: 'C6 Bank',
    };
  }
  if (lower.includes('inter')) {
    return {
      bg: 'bg-gradient-to-r from-orange-950/90 via-amber-950/80 to-slate-900 border-orange-500/50 text-orange-200',
      badgeBg: 'bg-orange-500/20 text-orange-300 border-orange-400/40',
      icon: 'credit_card',
      brand: 'Banco Inter',
    };
  }
  if (lower.includes('itaú') || lower.includes('itau') || lower.includes('personnalité')) {
    return {
      bg: 'bg-gradient-to-r from-orange-950/90 via-blue-950/80 to-slate-900 border-amber-500/50 text-amber-200',
      badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-400/40',
      icon: 'credit_card',
      brand: 'Itaú',
    };
  }
  if (lower.includes('bradesco')) {
    return {
      bg: 'bg-gradient-to-r from-rose-950/90 via-red-950/80 to-slate-900 border-rose-500/50 text-rose-200',
      badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-400/40',
      icon: 'credit_card',
      brand: 'Bradesco',
    };
  }
  if (lower.includes('santander')) {
    return {
      bg: 'bg-gradient-to-r from-red-950/90 via-rose-950/80 to-slate-900 border-red-500/50 text-red-200',
      badgeBg: 'bg-red-500/20 text-red-300 border-red-400/40',
      icon: 'credit_card',
      brand: 'Santander',
    };
  }
  if (lower.includes('caixa')) {
    return {
      bg: 'bg-gradient-to-r from-blue-950/90 via-cyan-950/80 to-slate-900 border-cyan-500/50 text-cyan-200',
      badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40',
      icon: 'credit_card',
      brand: 'Caixa',
    };
  }
  if (lower.includes('bb') || lower.includes('banco do brasil') || lower.includes('ourocard')) {
    return {
      bg: 'bg-gradient-to-r from-amber-950/90 via-yellow-950/80 to-slate-900 border-yellow-500/50 text-yellow-200',
      badgeBg: 'bg-yellow-500/20 text-yellow-300 border-yellow-400/40',
      icon: 'credit_card',
      brand: 'Banco do Brasil',
    };
  }
  return {
    bg: 'bg-gradient-to-r from-slate-900 via-slate-850 to-slate-950 border-cyan-500/40 text-slate-100',
    badgeBg: 'bg-cyan-500/20 text-cyan-200 border-cyan-400/40',
    icon: 'account_balance_wallet',
    brand: 'Cartão / Meio',
  };
};

export const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  value,
  onChange,
  label = 'Meio de pagamento utilizado',
  theme = 'dark',
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('todos');
  const [isCustomInputMode, setIsCustomInputMode] = useState<boolean>(false);
  const [customText, setCustomText] = useState<string>('');

  const handleOpenModal = () => {
    try { playAppSound('pop'); } catch {}
    setIsModalOpen(true);
  };

  const handleSelectMethod = (methodName: string) => {
    try { playAppSound('click'); } catch {}
    setIsCustomInputMode(false);
    onChange(methodName);
    setIsModalOpen(false);
  };

  const handleCustomSubmit = () => {
    if (customText.trim()) {
      try { playAppSound('click'); } catch {}
      onChange(customText.trim());
      setIsModalOpen(false);
    }
  };

  const activeStyle = getPaymentBrandStyle(value);
  const isDark = theme === 'dark';

  // Métodos filtrados
  const filteredGroups = PAYMENT_METHOD_GROUPS.map((group) => {
    const isCategoryMatch =
      selectedCategoryFilter === 'todos' ||
      group.category.toLowerCase().includes(selectedCategoryFilter.toLowerCase());

    const matchingMethods = group.methods.filter((m) => {
      const query = searchQuery.trim().toLowerCase();
      if (!query) return isCategoryMatch;
      return (
        m.name.toLowerCase().includes(query) ||
        (m.badge && m.badge.toLowerCase().includes(query)) ||
        group.category.toLowerCase().includes(query)
      );
    });

    return {
      ...group,
      methods: matchingMethods,
    };
  }).filter((group) => group.methods.length > 0);

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {/* Label Principal */}
      <div className="flex items-center justify-between gap-1.5">
        <label className={`text-[11px] sm:text-xs font-bold flex items-center gap-1.5 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
          <span className={`material-symbols-outlined text-[15px] sm:text-[17px] ${isDark ? 'text-cyan-400' : 'text-blue-600'}`}>
            credit_card
          </span>
          <span>{label}</span>
        </label>
        <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full border ${isDark ? 'bg-cyan-500/15 text-cyan-300 border-cyan-400/30' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
          Cartões, PIX e Bancos
        </span>
      </div>

      {/* CARD INTERATIVO DE SELEÇÃO DE CARTÃO / MEIO (Substitui a caixa cinza nativa) */}
      <div
        onClick={handleOpenModal}
        className={`relative w-full p-3 rounded-2xl border-2 transition-all cursor-pointer shadow-md group hover:scale-[1.01] active:scale-[0.99] flex items-center justify-between gap-3 ${activeStyle.bg}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-[20px] text-white">
              {activeStyle.icon}
            </span>
          </div>

          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300 flex items-center gap-1">
              <span>{activeStyle.brand}</span>
              <span className={`text-[8.5px] px-1.5 py-0.2 rounded-md font-extrabold border ${activeStyle.badgeBg}`}>
                SELECIONADO
              </span>
            </span>
            <span className="text-xs sm:text-sm font-black text-white truncate leading-tight">
              {value || 'Selecionar Meio de Pagamento...'}
            </span>
          </div>
        </div>

        <button
          type="button"
          className="px-2.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-[11px] flex items-center gap-1 shadow-xs transition-all shrink-0 cursor-pointer"
        >
          <span>Trocar</span>
          <span className="material-symbols-outlined text-[14px]">unfold_more</span>
        </button>
      </div>

      {/* MODAL POP-OVER CUSTOMIZADO & ANIMADO DE SELEÇÃO DE CARTÃO */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[400] bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-gradient-to-b from-[#0b1b36] via-[#0e2447] to-[#081326] rounded-2xl sm:rounded-3xl shadow-[0_20px_60px_rgba(6,182,212,0.4)] border-2 border-cyan-400/80 flex flex-col max-h-[90vh] overflow-hidden my-auto text-white animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do Modal Selector */}
            <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-white/10 bg-[#09152b] shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center border border-cyan-400/40">
                  <span className="material-symbols-outlined text-[18px]">credit_card</span>
                </div>
                <div>
                  <h3 className="font-black text-white text-xs sm:text-sm leading-tight">
                    Selecionar Meio de Pagamento
                  </h3>
                  <span className="text-[10px] text-cyan-300 font-medium block">
                    Escolha o cartão, conta ou PIX utilizado na compra
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-red-500/20 hover:text-red-300 text-slate-300 flex items-center justify-center transition-colors cursor-pointer border border-white/10"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Campo de Busca Rápida */}
            <div className="p-3 bg-[#061224] border-b border-white/10 flex flex-col gap-2 shrink-0">
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-cyan-400 text-[18px]">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Pesquisar Nubank, C6, Inter, Itaú, PIX, Black, Gold..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-10 pl-9 pr-8 bg-white/10 border border-cyan-500/40 rounded-xl text-xs font-medium text-white placeholder-slate-400 focus:bg-white/15 focus:border-cyan-400 outline-none transition-all"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 text-slate-400 hover:text-white p-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">cancel</span>
                  </button>
                )}
              </div>

              {/* Filtros em Pílulas */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 text-[10.5px]">
                <button
                  type="button"
                  onClick={() => setSelectedCategoryFilter('todos')}
                  className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-all cursor-pointer ${
                    selectedCategoryFilter === 'todos'
                      ? 'bg-cyan-500 text-slate-950 font-black shadow-xs'
                      : 'bg-white/10 text-slate-300 hover:bg-white/20'
                  }`}
                >
                  ⚡ Todos
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategoryFilter('nubank')}
                  className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-all cursor-pointer ${
                    selectedCategoryFilter === 'nubank'
                      ? 'bg-purple-600 text-white font-black shadow-xs'
                      : 'bg-purple-950/40 text-purple-200 border border-purple-500/30'
                  }`}
                >
                  🟣 Nubank
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategoryFilter('c6')}
                  className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-all cursor-pointer ${
                    selectedCategoryFilter === 'c6'
                      ? 'bg-slate-200 text-slate-950 font-black shadow-xs'
                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                >
                  ⚫ C6 Bank
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategoryFilter('inter')}
                  className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-all cursor-pointer ${
                    selectedCategoryFilter === 'inter'
                      ? 'bg-orange-500 text-slate-950 font-black shadow-xs'
                      : 'bg-orange-950/40 text-orange-200 border border-orange-500/30'
                  }`}
                >
                  🟠 Inter
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategoryFilter('itaú')}
                  className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-all cursor-pointer ${
                    selectedCategoryFilter === 'itaú'
                      ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                      : 'bg-amber-950/40 text-amber-200 border border-amber-500/30'
                  }`}
                >
                  🟡 Itaú
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategoryFilter('pix')}
                  className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-all cursor-pointer ${
                    selectedCategoryFilter === 'pix'
                      ? 'bg-emerald-500 text-slate-950 font-black shadow-xs'
                      : 'bg-emerald-950/40 text-emerald-200 border border-emerald-500/30'
                  }`}
                >
                  ⚡ PIX
                </button>
              </div>
            </div>

            {/* Lista de Opções Estilizadas em Cards */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin">
              {/* Opção para digitar outro nome customizado */}
              <div className="p-3 rounded-2xl bg-white/5 border border-amber-500/40 hover:border-amber-400 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                    <span className="material-symbols-outlined text-[16px]">edit_note</span>
                    <span>Digitar Cartão ou Meio Particular</span>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">
                    Personalizado
                  </span>
                </div>

                {isCustomInputMode ? (
                  <div className="flex items-center gap-2 animate-in fade-in">
                    <input
                      type="text"
                      placeholder="Ex: Nubank da Minha Esposa, Cartão Cresol..."
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      className="flex-1 h-9 px-3 bg-slate-900 border border-amber-400/60 rounded-xl text-xs text-white placeholder-slate-400 outline-none"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleCustomSubmit}
                      className="h-9 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold text-xs cursor-pointer shrink-0"
                    >
                      Usar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsCustomInputMode(true)}
                    className="w-full h-8 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-all"
                  >
                    <span>+ Inserir Nome Personalizado</span>
                  </button>
                )}
              </div>

              {/* Lista de Grupos */}
              {filteredGroups.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  Nenhum meio de pagamento encontrado para "{searchQuery}".
                </div>
              ) : (
                filteredGroups.map((group) => (
                  <div key={group.category} className="space-y-1.5">
                    <div className="text-[10.5px] font-black uppercase tracking-wider text-cyan-300 px-1 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px]">
                        {group.icon || 'credit_card'}
                      </span>
                      <span>{group.category}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {group.methods.map((method) => {
                        const style = getPaymentBrandStyle(method.name);
                        const isSelected = value === method.name;

                        return (
                          <div
                            key={method.id}
                            onClick={() => handleSelectMethod(method.name)}
                            className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 text-xs group active:scale-[0.98] ${
                              isSelected
                                ? 'bg-cyan-500/20 border-cyan-400 ring-2 ring-cyan-400/50 shadow-md'
                                : `${style.bg} hover:border-cyan-400/60`
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="material-symbols-outlined text-[16px] text-cyan-300 shrink-0">
                                {style.icon}
                              </span>
                              <div className="flex flex-col min-w-0">
                                <span className="font-bold text-white truncate text-[11.5px] leading-tight">
                                  {method.name}
                                </span>
                              </div>
                            </div>

                            {isSelected ? (
                              <span className="material-symbols-outlined text-cyan-300 text-[18px] shrink-0">
                                check_circle
                              </span>
                            ) : method.badge ? (
                              <span className={`text-[8.5px] font-black px-1.5 py-0.2 rounded border shrink-0 ${style.badgeBg}`}>
                                {method.badge}
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Rodapé do Modal Selector */}
            <div className="p-3 bg-[#09152b] border-t border-white/10 flex items-center justify-between shrink-0">
              <span className="text-[10px] text-slate-400">
                Selecione para aplicar ao lançamento
              </span>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
