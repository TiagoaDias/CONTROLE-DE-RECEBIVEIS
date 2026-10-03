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
      if (accentColor === 'cyan') return 'bg-cyan-50/70 border-cyan-400 text-slate-900 ring-2 ring-cyan-200';
      if (accentColor === 'indigo') return 'bg-indigo-50/70 border-indigo-400 text-slate-900 ring-2 ring-indigo-200';
      return 'bg-blue-50/70 border-blue-400 text-slate-900 ring-2 ring-blue-200';
    }
    return 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800 shadow-2xs';
  };

  const getBadgeStyle = (type?: DropdownItem['badgeType']) => {
    switch (type) {
      case 'success':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'danger':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'warning':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getDropdownPositionClass = () => {
    if (dropdownAlign === 'right') {
      return 'right-0 left-auto w-full min-w-[270px] sm:min-w-[320px] max-w-[calc(100vw-24px)] sm:max-w-[420px]';
    }
    if (dropdownAlign === 'full') {
      return 'left-0 right-0 w-full max-w-[calc(100vw-24px)]';
    }
    return 'left-0 right-auto w-full min-w-[270px] sm:min-w-[320px] max-w-[calc(100vw-24px)] sm:max-w-[420px]';
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
        className={`w-full min-h-[46px] px-2.5 sm:px-3 rounded-xl border flex items-center justify-between gap-2 text-left transition-all cursor-pointer ${getBorderColor()}`}
        title={disabled ? disabledMessage : title || placeholder}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Avatar ou Ícone */}
          {selectedItem?.avatar ? (
            <img
              src={selectedItem.avatar}
              alt=""
              referrerPolicy="no-referrer"
              className="w-7 h-7 rounded-lg object-cover shadow-2xs border border-slate-200 shrink-0"
            />
          ) : selectedItem?.icon ? (
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
              accentColor === 'cyan'
                ? 'bg-cyan-100/70 text-cyan-800 border-cyan-200'
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}>
              <span className="material-symbols-outlined text-[17px]">{selectedItem.icon}</span>
            </div>
          ) : (
            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center shrink-0 border border-slate-200">
              <span className="material-symbols-outlined text-[16px]">
                {disabled ? 'lock' : 'menu_open'}
              </span>
            </div>
          )}

          {/* Textos: Título / Nome Selecionado */}
          {displayMode === 'inline' ? (
            <div className="min-w-0 flex-1 leading-tight truncate">
              <div className="flex items-center gap-1 truncate text-xs sm:text-[13px]">
                {disabled ? (
                  <span className="text-slate-400 font-medium truncate">{disabledMessage}</span>
                ) : selectedItem ? (
                  <>
                    {title && (
                      <span className="text-slate-500 font-bold shrink-0">
                        {title}:
                      </span>
                    )}
                    <span className="font-extrabold text-slate-900 truncate">
                      {selectedItem.label}
                    </span>
                  </>
                ) : (
                  <span className="font-bold text-slate-700 truncate">
                    {title ? title : placeholder}
                  </span>
                )}
              </div>
              {selectedItem?.sublabel && (
                <span className="text-[10px] text-slate-400 block truncate font-medium">
                  {selectedItem.sublabel}
                </span>
              )}
            </div>
          ) : (
            <div className="min-w-0 flex-1 leading-tight">
              {title && (
                <span className="text-[10px] text-slate-500 font-bold tracking-wide uppercase block truncate">
                  {title}
                </span>
              )}
              <span className={`text-xs sm:text-[13px] font-black truncate block ${
                disabled ? 'text-slate-400' : 'text-slate-900'
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

        {/* Lado Direito: Seta em formato de V (Chevron) */}
        <div className="flex items-center gap-1.5 shrink-0 pl-1">
          {selectedItem?.badge && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono font-bold hidden sm:inline ${getBadgeStyle(selectedItem.badgeType)}`}>
              {selectedItem.badge}
            </span>
          )}
          <span
            className={`material-symbols-outlined text-[19px] text-slate-500 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-cyan-600' : ''
            }`}
          >
            expand_more
          </span>
        </div>
      </button>

      {/* ============================================================ */}
      {/* MENU SUSPENSO / LISTA DROPDOWN FLUTUANTE                      */}
      {/* ============================================================ */}
      {isOpen && !disabled && (
        <div className={`absolute top-[calc(100%+6px)] bg-white rounded-2xl border border-cyan-300/90 shadow-2xl p-2.5 flex flex-col gap-2 z-[999] animate-in fade-in zoom-in-95 duration-150 ${getDropdownPositionClass()}`}>
          
          {/* Cabeçalho da Lista com Título e Botão Fechar */}
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 px-1 text-xs">
            <span className="font-bold text-slate-800 text-[11.5px] flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px] text-cyan-600">view_list</span>
              <span>{title ? `Selecionar ${title}` : 'Selecione uma opção'} ({items.length})</span>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="w-5 h-5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
              title="Fechar menu"
            >
              <span className="material-symbols-outlined text-[15px]">close</span>
            </button>
          </div>

          {/* Campo de Pesquisa em Tempo Real */}
          {showSearch && items.length > 2 && (
            <div className="relative w-full">
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full h-8 px-3 pr-7 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 outline-none focus:bg-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-300 transition-all"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[13px]">close</span>
                </button>
              )}
            </div>
          )}

          {/* Itens da Lista com Rolagem Confortável */}
          <div className="flex flex-col gap-1 max-h-60 overflow-y-auto pr-0.5 custom-scrollbar">
            {filteredItems.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                {emptyMessage}
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
                      onClose(); // Fecha automaticamente ao selecionar
                    }}
                    className={`w-full p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 text-left select-none ${
                      isSelected
                        ? 'bg-gradient-to-r from-cyan-50 via-blue-50/60 to-white border-cyan-400 text-slate-900 shadow-2xs ring-1 ring-cyan-300'
                        : 'bg-white hover:bg-slate-50 border-slate-200/80 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Checkmark Radio */}
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 border ${
                        isSelected
                          ? 'bg-cyan-500 border-cyan-400 text-slate-950'
                          : 'border-slate-300 text-transparent'
                      }`}>
                        <span className="material-symbols-outlined text-[11px] font-black">
                          {isSelected ? 'check' : ''}
                        </span>
                      </span>

                      {/* Avatar ou Ícone do Item */}
                      {item.avatar ? (
                        <img
                          src={item.avatar}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="w-7 h-7 rounded-lg object-cover shadow-2xs border border-slate-200 shrink-0"
                        />
                      ) : item.icon ? (
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                          isSelected
                            ? 'bg-cyan-100 text-cyan-800 border-cyan-300'
                            : 'bg-slate-100 border-slate-200 text-slate-600'
                        }`}>
                          <span className="material-symbols-outlined text-[15px]">{item.icon}</span>
                        </div>
                      ) : null}

                      {/* Nome e Subtítulo */}
                      <div className="min-w-0 leading-tight">
                        <span className="text-xs font-bold text-slate-900 block truncate">
                          {item.label}
                        </span>
                        {item.sublabel && (
                          <span className="text-[10px] text-slate-500 block truncate font-medium">
                            {item.sublabel}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Badge do Item */}
                    {item.badge && (
                      <span className={`text-[10.5px] font-mono font-bold shrink-0 px-2 py-0.5 rounded-full border ${getBadgeStyle(item.badgeType)}`}>
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
