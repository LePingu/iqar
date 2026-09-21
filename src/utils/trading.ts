export function fmtPrice(x: number | null | undefined): string {
  if (x == null || !Number.isFinite(x)) return '—';
  if (Math.abs(x) >= 1) return x.toFixed(2);
  if (x === 0) return '0.00';
  return x.toFixed(Math.max(2, 2 - Math.floor(Math.log10(Math.abs(x)))));
}

export function formatMoney(value: number | null | undefined, currency = 'USD', decimals = 2): string {
  if (value == null || !Number.isFinite(value)) return '—';
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

export function formatPercentage(value: number | null | undefined, decimals = 2): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

export function formatDate(timestamp: number | string | null | undefined): string {
  if (timestamp == null) return 'Not recorded';
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp * 1000);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : 'Not recorded';
}

// Trade prices need sub-cent precision; portfolio totals remain two decimals.
export function formatTradePrice(value: number | null | undefined, currency = 'USD') {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${currencySymbol(currency)}${fmtPrice(value)}`;
}

export function formatSignedMoney(value: number | null | undefined, currency = 'USD') {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value >= 0 ? '+' : ''}${formatMoney(value, currency)}`;
}
