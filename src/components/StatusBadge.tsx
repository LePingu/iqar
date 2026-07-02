type BadgeVariant = 'running' | 'completed' | 'error' | 'connecting' | 'halted' | 'trading' | 'down';

interface StatusBadgeProps {
  variant: BadgeVariant;
  label?: string;
  className?: string;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string; dot?: boolean }> = {
  running:    { bg: 'bg-[var(--color-green-muted)]',   text: 'text-[var(--color-green)]',        dot: true },
  completed:  { bg: 'bg-[var(--color-green-muted)]',   text: 'text-[var(--color-green)]' },
  error:      { bg: 'bg-[var(--color-red-muted)]',     text: 'text-[var(--color-red)]' },
  connecting: { bg: 'bg-[var(--color-blue-muted)]',    text: 'text-[var(--color-blue)]',         dot: true },
  halted:     { bg: 'bg-white/5',                      text: 'text-[var(--color-text-muted)]' },
  trading:    { bg: 'bg-[var(--color-gold-muted)]',    text: 'text-[var(--color-gold-accent)]',  dot: true },
  down:       { bg: 'bg-[var(--color-red-muted)]',     text: 'text-[var(--color-red)]' },
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
    <span className={`badge ${style.bg} ${style.text} ${className}`}>
      {style.dot && (
        <span className={`w-1.5 h-1.5 rounded-full bg-current animate-pulse-dot`} />
      )}
      {displayLabel}
    </span>
  );
}
