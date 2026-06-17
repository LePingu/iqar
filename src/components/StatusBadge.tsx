type BadgeVariant = 'running' | 'completed' | 'error' | 'connecting' | 'halted' | 'trading' | 'down';

interface StatusBadgeProps {
  variant: BadgeVariant;
  label?: string;
  className?: string;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string; border: string; pulse: boolean }> = {
  running: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', pulse: true },
  completed: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', pulse: false },
  error: { bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/30', pulse: false },
  connecting: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', pulse: true },
  halted: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', pulse: false },
  trading: { bg: 'bg-[var(--color-gold-accent)]/20', text: 'text-[var(--color-gold-accent)]', border: 'border-[var(--color-gold-accent)]/30', pulse: true },
  down: { bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/30', pulse: false },
};

const defaultLabels: Record<BadgeVariant, string> = {
  running: 'Running',
  completed: 'Completed',
  error: 'Error',
  connecting: 'Connecting',
  halted: 'HALTED',
  trading: 'TRADING',
  down: 'ENGINE DOWN',
};

export function StatusBadge({ variant, label, className = '' }: StatusBadgeProps) {
  const style = variantStyles[variant];
  const displayLabel = label || defaultLabels[variant];

  return (
    <span className={`px-3 py-1 ${style.bg} ${style.text} rounded-full text-sm border ${style.border} ${style.pulse ? 'animate-pulse' : ''} ${className}`}>
      {displayLabel}
    </span>
  );
}
