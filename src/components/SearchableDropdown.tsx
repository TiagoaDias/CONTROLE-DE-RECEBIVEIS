import React, { useState, useRef, useEffect } from 'react';

export interface DropdownItem<T = any> {
  id: string;
  label: string;
  sublabel?: string;
  icon?: string;
  avatar?: string;
  badge?: string;
  badgeType?: 'default' | 'success' | 'danger' | 'warning';
  value: T;
}

export interface SearchableDropdownProps<T = any> {
  title?: string;
  placeholder?: string;
  selectedItem: DropdownItem<T> | null;
  items: DropdownItem<T>[];
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onSelect: (item: DropdownItem<T>) => void;
  disabled?: boolean;
  disabledMessage?: string;
  searchPlaceholder?: string;
  showSearch?: boolean;
  className?: string;
  emptyMessage?: string;
  accentColor?: 'cyan' | 'blue' | 'indigo' | 'slate';
  dropdownAlign?: 'left' | 'right' | 'full';
  displayMode?: 'inline' | 'stacked';
}

export function SearchableDropdown<T = any>({
  title,
  placeholder = 'Selecione uma opção...',
  selectedItem,
  items,
  isOpen,
  onToggle,
  onClose,
  onSelect,
  disabled = false,
  disabledMessage = 'Opção indisponível',
  searchPlaceholder = 'Pesquisar...',
  showSearch = true,
  className = '',
  emptyMessage = 'Nenhum resultado encontrado.',
  accentColor = 'cyan',
  dropdownAlign = 'left',
  displayMode = 'inline',
}: SearchableDropdownProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fecha ao clicar fora
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      return;
    }

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    // Auto-focus no campo de busca ao abrir
    const timer = setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 50);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [isOpen, onClose]);

  // Filtragem de itens pela busca em tempo real
  const filteredItems = items.filter((item) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    const matchLabel = item.label.toLowerCase().includes(q);
    const matchSublabel = item.sublabel ? item.sublabel.toLowerCase().includes(q) : false;
    const matchBadge = item.badge ? item.badge.toLowerCase().includes(q) : false;
    return matchLabel || matchSublabel || matchBadge;
  });

  const getBorderColor = () => {
    if (disabled) return 'border-slate-200 bg-slate-100/80 text-slate-400 cursor-not-allowed';
    if (isOpen) {
      if (accentColor === 'cyan') return 'bg-gradient-to-r from-cyan-50 via-blue-50 to-indigo-50 border-cyan-400 text-slate-950 ring-4 ring-cyan-200 shadow-md';
      if (accentColor === 'indigo') return 'bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 border-indigo-400 text-slate-950 ring-4 ring-indigo-200 shadow-md';
      return 'bg-gradient-to-r from-blue-50 via-sky-50 to-cyan-50 border-blue-400 text-slate-950 ring-4 ring-blue-200 shadow-md';
    }
    return 'bg-white/90 hover:bg-gradient-to-r hover:from-cyan-50/40 hover:to-blue-50/40 border-cyan-200/80 text-slate-800 shadow-xs hover:shadow-md hover:border-cyan-400 transition-all';
  };

  const getBadgeStyle = (type?: DropdownItem['badgeType']) => {
    switch (type) {
      case 'success':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold';
      case 'danger':
        return 'bg-red-100 text-red-800 border-red-300 font-bold animate-pulse';
      case 'warning':
        return 'bg-amber-100 text-amber-800 border-amber-300 font-bold';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200 font-medium';
    }
  };

  const getDropdownPositionClass = () => {
    if (dropdownAlign === 'right') {
      return 'right-0 left-auto w-full min-w-[280px] sm:min-w-[340px] max-w-[calc(100vw-24px)] sm:max-w-[440px]';
    }
    if (dropdownAlign === 'full') {
      return 'left-0 right-0 w-full max-w-[calc(100vw-24px)]';
    }
    return 'left-0 right-auto w-full min-w-[280px] sm:min-w-[340px] max-w-[calc(100vw-24px)] sm:max-w-[440px]';
  };

  return (
    <div ref={containerRef} className={`relative flex flex-col min-w-0 select-none ${className}`}>
      {/* Campo / Botão do Dropdown */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) onToggle();
        }}
        className={`w-full min-h-[48px] px-3 rounded-2xl border-2 flex items-center justify-between gap-2.5 text-left transition-all duration-200 cursor-pointer hover:scale-[1.01] active:scale-[0.99] ${getBorderColor()}`}
        title={disabled ? disabledMessage : title || placeholder}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* Avatar ou Ícone com Efeito Brilhante */}
          {selectedItem?.avatar ? (
            <img
              src={selectedItem.avatar}
              alt=""
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-xl object-cover shadow-xs border-2 border-cyan-400 shrink-0"
            />
          ) : selectedItem?.icon ? (
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border-2 shadow-2xs ${
              accentColor === 'cyan'
                ? 'bg-gradient-to-br from-cyan-400 to-blue-500 text-white border-cyan-300'
                : 'bg-gradient-to-br from-slate-700 to-slate-900 text-white border-slate-600'
            }`}>
              <span className="material-symbols-outlined text-[18px]">{selectedItem.icon}</span>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-100 to-blue-100 text-cyan-700 flex items-center justify-center shrink-0 border-2 border-cyan-300 shadow-2xs">
              <span className="material-symbols-outlined text-[18px]">
                {disabled ? 'lock' : 'bolt'}
              </span>
            </div>
          )}

          {/* Textos: Título / Nome Selecionado */}
          {displayMode === 'inline' ? (
            <div className="min-w-0 flex-1 leading-tight truncate">
              <div className="flex items-center gap-1.5 truncate text-sm sm:text-[14.5px]">
                {disabled ? (
                  <span className="text-slate-500 font-bold truncate">{disabledMessage}</span>
                ) : selectedItem ? (
                  <>
                    {title && (
                      <span className="text-slate-900 font-black shrink-0 tracking-wide">
                        {title}:
                      </span>
                    )}
                    <span className="font-black text-slate-950 truncate bg-cyan-100/80 px-2 py-0.5 rounded-lg border border-cyan-300 text-slate-950 shadow-2xs">
                      {selectedItem.label}
                    </span>
                  </>
                ) : (
                  <span className="font-extrabold text-slate-900 truncate">
                    {title ? title : placeholder}
                  </span>
                )}
              </div>
              {selectedItem?.sublabel && (
                <span className="text-xs text-slate-700 block truncate font-semibold mt-0.5">
                  ✨ {selectedItem.sublabel}
                </span>
              )}
            </div>
          ) : (
            <div className="min-w-0 flex-1 leading-tight">
              {title && (
                <span className="text-xs text-slate-900 font-black tracking-wide uppercase block truncate">
                  ✨ {title}
                </span>
              )}
              <span className={`text-sm sm:text-[14.5px] font-black truncate block ${
                disabled ? 'text-slate-500' : 'text-slate-950'
              }`}>
                {disabled
                  ? disabledMessage
                  : selectedItem
                  ? selectedItem.label
                  : placeholder}
              </span>
            </div>
          )}
        </div>

        {/* Lado Direito: Seta em formato de V com Animação */}
        <div className="flex items-center gap-2 shrink-0 pl-1">
          {selectedItem?.badge && (
            <span className={`text-xs px-3 py-1 rounded-xl border font-mono font-black hidden sm:inline shadow-2xs ${getBadgeStyle(selectedItem.badgeType)}`}>
              {selectedItem.badge}
            </span>
          )}
          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform duration-200 ${
            isOpen ? 'bg-cyan-600 text-white rotate-180 shadow-md' : 'bg-cyan-100 text-cyan-900 border border-cyan-300'
          }`}>
            <span className="material-symbols-outlined text-[18px] font-black">
              expand_more
            </span>
          </div>
        </div>
      </button>

      {/* ============================================================ */}
      {/* MENU SUSPENSO / LISTA DROPDOWN FLUTUANTE                      */}
      {/* ============================================================ */}
      {isOpen && !disabled && (
        <div className={`absolute top-[calc(100%+8px)] bg-white/98 backdrop-blur-md rounded-2xl border-2 border-cyan-400 shadow-[0_10px_35px_rgba(6,182,212,0.3)] p-3.5 flex flex-col gap-3 z-[999] animate-in fade-in zoom-in-95 duration-200 ${getDropdownPositionClass()}`}>
          
          {/* Cabeçalho da Lista com Título e Botão Fechar */}
          <div className="flex items-center justify-between pb-2.5 border-b border-cyan-100 px-1">
            <span className="font-black text-slate-900 text-sm flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-cyan-600 animate-spin" style={{ animationDuration: '4s' }}>
                auto_awesome
              </span>
              <span>{title ? `Escolher ${title}` : 'Selecione uma opção'} ({items.length})</span>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
              title="Fechar menu"
            >
              <span className="material-symbols-outlined text-[16px] font-black">close</span>
            </button>
          </div>

          {/* Campo de Pesquisa em Tempo Real */}
          {showSearch && items.length > 2 && (
            <div className="relative w-full">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-700 material-symbols-outlined text-[18px]">
                search
              </span>
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full h-10 pl-10 pr-9 bg-slate-50 border-2 border-cyan-200 rounded-xl text-sm font-bold text-slate-900 placeholder-slate-400 outline-none focus:bg-white focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 transition-all shadow-inset"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
            </div>
          )}

          {/* Itens da Lista com Rolagem Confortável */}
          <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
            {filteredItems.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-600 font-medium flex flex-col items-center gap-2">
                <span className="material-symbols-outlined text-[32px] text-cyan-500">search_off</span>
                <span>{emptyMessage}</span>
              </div>
            ) : (
              filteredItems.map((item) => {
                const isSelected = selectedItem?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelect(item);
                      onClose();
                    }}
                    className={`w-full p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 text-left select-none hover:scale-[1.01] active:scale-[0.99] ${
                      isSelected
                        ? 'bg-gradient-to-r from-cyan-100 via-blue-50 to-white border-cyan-500 text-slate-950 shadow-sm ring-2 ring-cyan-300 font-black'
                        : 'bg-white hover:bg-cyan-50/50 border-slate-200 text-slate-900 hover:border-cyan-300 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Checkmark Radio */}
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border-2 transition-all ${
                        isSelected
                          ? 'bg-gradient-to-br from-cyan-500 to-blue-600 border-cyan-400 text-white shadow-xs scale-110'
                          : 'border-slate-300 bg-slate-50 text-transparent'
                      }`}>
                        <span className="material-symbols-outlined text-[14px] font-black">
                          {isSelected ? 'check' : ''}
                        </span>
                      </span>

                      {/* Avatar ou Ícone do Item */}
                      {item.avatar ? (
                        <img
                          src={item.avatar}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="w-9 h-9 rounded-xl object-cover shadow-xs border-2 border-cyan-300 shrink-0"
                        />
                      ) : item.icon ? (
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border-2 shadow-2xs ${
                          isSelected
                            ? 'bg-cyan-600 text-white border-cyan-500'
                            : 'bg-cyan-50 text-cyan-800 border-cyan-200'
                        }`}>
                          <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                        </div>
                      ) : null}

                      {/* Nome e Subtítulo */}
                      <div className="min-w-0 leading-tight">
                        <span className="text-sm sm:text-[14.5px] font-black text-slate-950 block truncate">
                          {item.label}
                        </span>
                        {item.sublabel && (
                          <span className="text-xs text-slate-700 block truncate font-semibold mt-0.5">
                            {item.sublabel}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Badge do Item */}
                    {item.badge && (
                      <span className={`text-xs font-mono font-black shrink-0 px-3 py-1 rounded-xl border shadow-2xs ${getBadgeStyle(item.badgeType)}`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
