import { Navigate } from '@tanstack/react-router';
import { useRole } from '../contexts/RoleContext';

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { role, loading } = useRole();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-[var(--color-text-muted)] text-sm">Verifying access…</div>
      </div>
    );
  }

  if (role !== 'admin') {
    return <Navigate to="/live" replace />;
  }

  return <>{children}</>;
}
