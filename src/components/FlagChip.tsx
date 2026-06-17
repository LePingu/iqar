interface FlagChipProps {
  label: string;
  active: boolean;
  onClick?: () => void;
  readOnly?: boolean;
}

export function FlagChip({ label, active, onClick, readOnly = false }: FlagChipProps) {
  const baseClasses = 'px-3 py-1.5 rounded-full text-xs transition-colors border';
  const activeClasses = 'bg-[var(--color-gold-accent)]/20 text-[var(--color-gold-accent)] border-[var(--color-gold-accent)]/50';
  const inactiveClasses = 'bg-transparent text-gray-400 border-gray-600 hover:border-gray-400';
  const readOnlyActiveClasses = 'px-1.5 py-0.5 bg-[var(--color-gold-accent)]/20 text-[var(--color-gold-accent)] border border-[var(--color-gold-accent)]/30 rounded text-[10px] uppercase whitespace-nowrap';

  if (readOnly) {
    if (!active) return null;
    return <span className={readOnlyActiveClasses}>{label}</span>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${baseClasses} ${active ? activeClasses : inactiveClasses}`}
    >
      {label}
    </button>
  );
}
