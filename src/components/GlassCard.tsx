import type { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
}

export function GlassCard({ children, className = '' }: GlassCardProps) {
  return (
    <div className={`bg-gradient-to-br from-[var(--color-dark-panel)] to-[#141414] border border-[var(--color-dark-border)] shadow-2xl rounded-3xl p-6 ${className}`}>
      {children}
    </div>
  );
}
