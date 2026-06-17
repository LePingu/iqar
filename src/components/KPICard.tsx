interface KPICardProps {
  label: string;
  value: string | number;
  isPositive?: boolean;
  neutral?: boolean;
  className?: string;
}

export function KPICard({ label, value, isPositive = true, neutral = false, className = '' }: KPICardProps) {
  const valueColor = neutral
    ? 'text-white'
    : isPositive
      ? 'text-emerald-500'
      : 'text-rose-500';

  return (
    <div className={`bg-gradient-to-br from-[var(--color-dark-panel)] to-[#141414] border border-[var(--color-dark-border)] shadow-2xl rounded-3xl p-4 flex flex-col items-center justify-center text-center ${className}`}>
      <span className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</span>
      <span className={`text-xl font-bold ${valueColor}`}>{value}</span>
    </div>
  );
}
