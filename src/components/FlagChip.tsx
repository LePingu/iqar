interface FlagChipProps {
  label: string;
  active: boolean;
  onClick?: () => void;
  readOnly?: boolean;
}

export function FlagChip({ label, active, onClick, readOnly = false }: FlagChipProps) {
  if (readOnly) {
    if (!active) return null;
    return (
      <span className="badge bg-[var(--color-gold-muted)] text-[var(--color-gold-accent)]">
        {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`badge cursor-pointer transition-colors ${
        active
          ? 'bg-[var(--color-gold-muted)] text-[var(--color-gold-accent)]'
          : 'bg-transparent text-[var(--color-text-muted)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-secondary)]'
      }`}
    >
      {label}
    </button>
  );
}
