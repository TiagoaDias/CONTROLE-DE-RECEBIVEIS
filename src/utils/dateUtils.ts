/**
 * Utility functions for installment dates and formatting
 */

export function parseDateParts(dateStr: string): { day: number; month: number; year: number } {
  let day = 10;
  let month = 9;
  let year = 2026;

  if (!dateStr || typeof dateStr !== 'string') {
    return { day, month, year };
  }

  const clean = dateStr.trim();
  if (clean.includes('/')) {
    const parts = clean.split('/');
    day = parseInt(parts[0], 10) || 10;
    month = parseInt(parts[1], 10) || 9;
    year = parseInt(parts[2], 10) || 2026;
  } else if (clean.includes('-')) {
    const parts = clean.split('-');
    if (parts[0] && parts[0].length === 4) {
      // YYYY-MM-DD
      year = parseInt(parts[0], 10) || 2026;
      month = parseInt(parts[1], 10) || 9;
      day = parseInt(parts[2], 10) || 10;
    } else {
      // DD-MM-YYYY
      day = parseInt(parts[0], 10) || 10;
      month = parseInt(parts[1], 10) || 9;
      year = parseInt(parts[2], 10) || 2026;
    }
  }

  return { day, month, year };
}

export function addMonthsToDateStr(dateStr: string, monthsToAdd: number): string {
  if (!dateStr || typeof dateStr !== 'string') {
    return '10/10/2026';
  }
  const { day, month, year } = parseDateParts(dateStr);
  
  const totalMonths = (month - 1) + (monthsToAdd || 0);
  const newYear = year + Math.floor(totalMonths / 12);
  const newMonth = ((totalMonths % 12) + 12) % 12 + 1;

  const dd = String(day).padStart(2, '0');
  const mm = String(newMonth).padStart(2, '0');
  return `${dd}/${mm}/${newYear}`;
}
