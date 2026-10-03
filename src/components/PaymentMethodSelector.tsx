import React, { useState } from 'react';
import { PAYMENT_METHOD_GROUPS, ALL_PAYMENT_METHODS_FLAT } from '../data/paymentMethods';

interface PaymentMethodSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  theme?: 'dark' | 'light';
}

export const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  value,
  onChange,
  label = 'Meio de pagamento utilizado',
  theme = 'dark',
}) => {
  const [isCustomMode, setIsCustomMode] = useState<boolean>(() => {
    return !!value && !ALL_PAYMENT_METHODS_FLAT.includes(value) && value !== 'Outro Meio de Pagamento / Cartão Particular (Digitar)';
  });
  const [customText, setCustomText] = useState<string>(() => {
    return isCustomMode ? value : '';
  });

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    if (selected === 'CUSTOM' || selected === 'Outro Meio de Pagamento / Cartão Particular (Digitar)') {
      setIsCustomMode(true);
      const initialCustom = customText || 'Outro Meio';
      onChange(initialCustom);
    } else {
      setIsCustomMode(false);
      onChange(selected);
    }
  };

  const handleCustomTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const txt = e.target.value;
    setCustomText(txt);
    onChange(txt);
  };

  const isDark = theme === 'dark';

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label className={`text-[11px] sm:text-xs font-bold flex items-center justify-between gap-1.5 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
        <span className="flex items-center gap-1.5">
          <span className={`material-symbols-outlined text-[15px] sm:text-[17px] ${isDark ? 'text-cyan-400' : 'text-blue-600'}`}>
            account_balance_wallet
          </span>
          <span>{label}</span>
        </span>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${isDark ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
          PIX / Dinheiro / Todos os Cartões
        </span>
      </label>

      <div className="flex flex-col gap-2">
        <select
          value={isCustomMode ? 'CUSTOM' : value}
          onChange={handleSelectChange}
          className={`w-full h-10 sm:h-11 px-3 rounded-xl text-xs font-semibold outline-none cursor-pointer transition-all ${
            isDark
              ? 'bg-slate-800 border border-cyan-500/40 text-white focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20'
              : 'bg-slate-50 border border-slate-300 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20'
          }`}
        >
          {PAYMENT_METHOD_GROUPS.map((group) => (
            <optgroup key={group.category} label={group.category} className={isDark ? 'bg-slate-900 text-cyan-300 font-bold' : 'bg-slate-100 text-slate-900 font-bold'}>
              {group.methods.map((method) => (
                <option
                  key={method.id}
                  value={method.id === 'custom_outro' ? 'CUSTOM' : method.name}
                  className={isDark ? 'bg-slate-800 text-white' : 'bg-white text-slate-800'}
                >
                  {method.badge ? `[${method.badge}] ` : ''}{method.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        {isCustomMode && (
          <div className="flex items-center gap-2 animate-in fade-in duration-150">
            <span className={`text-[11px] font-bold shrink-0 ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
              ✏️ Especificar:
            </span>
            <input
              type="text"
              placeholder="Digite o nome do meio ou cartão (Ex: Nubank Especial, Cartão Cooperativa...)"
              value={customText}
              onChange={handleCustomTextChange}
              autoFocus
              className={`w-full h-9 sm:h-10 px-3 rounded-xl text-xs font-semibold outline-none transition-all ${
                isDark
                  ? 'bg-slate-900/90 border border-amber-400/60 text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-400/20'
                  : 'bg-white border-2 border-blue-400 text-slate-900 focus:ring-2 focus:ring-blue-500/20'
              }`}
            />
          </div>
        )}
      </div>
    </div>
  );
};
