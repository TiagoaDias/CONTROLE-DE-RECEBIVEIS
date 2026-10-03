/**
 * Utilitários seguros para formatação numérica e conversão de moeda
 * Evita runtime exceptions de .toFixed() em strings ou undefined
 */

export const safeToNumber = (val: any): number => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).replace('R$', '').trim();
  if (str.includes(',')) {
    const num = parseFloat(str.replace(/\./g, '').replace(',', '.'));
    return isNaN(num) ? 0 : num;
  }
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

export const safeToFixed = (val: any, decimals: number = 2): string => {
  const num = safeToNumber(val);
  return num.toFixed(decimals);
};

export const safeFormatCurrency = (val: any): string => {
  const num = safeToNumber(val);
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
