export function fmtPrice(x: number): string {
  if (Math.abs(x) >= 1) return x.toFixed(2);
  if (x === 0) return '0.00';
  return x.toFixed(Math.max(2, 2 - Math.floor(Math.log10(Math.abs(x)))));
}

export function formatCurrency(value: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercentage(value: number, decimals = 2): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

export function formatDate(timestamp: number | string): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp * 1000);
  return date.toLocaleString();
}
