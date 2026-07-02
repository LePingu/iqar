interface KPICardProps {
  label: string;
  value: string | number;
  isPositive?: boolean;
  neutral?: boolean;
  className?: string;
}

export function KPICard({ label, value, isPositive = true, neutral = false, className = '' }: KPICardProps) {
  const valueColor = neutral
    ? 'text-[var(--color-text-primary)]'
    : isPositive
      ? 'text-positive'
      : 'text-negative';

  return (
    <div className={`card flex flex-col gap-1 ${className}`}>
      <span className="section-title !mb-0">{label}</span>
      <span className={`text-lg font-bold font-mono ${valueColor}`}>{value}</span>
    </div>
  );
}
