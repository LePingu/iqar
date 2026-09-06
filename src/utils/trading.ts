export function fmtPrice(x: number): string {
  if (Math.abs(x) >= 1) return x.toFixed(2);
  if (x === 0) return '0.00';
  return x.toFixed(Math.max(2, 2 - Math.floor(Math.log10(Math.abs(x)))));
}

export function formatMoney(value: number, currency = 'USD', decimals = 2): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(decimals)}`;
  }
}

export function currencySymbol(currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 })
      .format(0)
      .replace(/[\d.,\s\u00a0]/g, '');
  } catch {
    return `${currency} `;
  }
}

export function formatCurrency(value: number, decimals = 2): string {
  return formatMoney(value, 'USD', decimals);
}

export function formatPercentage(value: number, decimals = 2): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

export function formatDate(timestamp: number | string): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp * 1000);
  return date.toLocaleString();
}
