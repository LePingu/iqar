import { useState } from 'react';
import { Outlet, Link } from '@tanstack/react-router';
import { FiActivity, FiServer, FiTrendingUp, FiRadio, FiMenu, FiX } from 'react-icons/fi';
import { useRole } from '../contexts/RoleContext';
import logoUrl from '../assets/iqar_logo.png';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Control Tower', icon: <FiServer size={18} />, exact: true, adminOnly: true },
  { to: '/backtests', label: 'Runs Browser', icon: <FiTrendingUp size={18} />, exact: true, adminOnly: true },
  { to: '/backtests/live', label: 'Live Monitor', icon: <FiActivity size={18} />, adminOnly: true },
  { to: '/live', label: 'Live Trading', icon: <FiRadio size={18} /> },
];

export function AppLayout() {
  const { role, email, loading } = useRole();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-[var(--color-text-muted)] text-sm">Loading…</div>
      </div>
    );
  }

  const visibleNav = NAV_ITEMS.filter(
    (item) => !item.adminOnly || role === 'admin',
  );

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2.5">
            <img src={logoUrl} alt="IQAR Logo" className="h-8 w-auto object-contain" />
          </div>
          <button
            className="md:hidden text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            onClick={() => setSidebarOpen(false)}
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 flex flex-col gap-0.5">
          {visibleNav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={item.exact ? { exact: true } : undefined}
              className="sidebar-link"
              activeProps={{ className: 'sidebar-link sidebar-link-active' }}
              onClick={() => setSidebarOpen(false)}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Role indicator */}
        <div className="px-4 py-3 border-t border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                role === 'admin'
                  ? 'bg-[var(--color-green)]'
                  : 'bg-[var(--color-text-muted)]'
              }`}
            />
            <span className="text-xs text-[var(--color-text-muted)] capitalize">
              {role === 'admin' ? 'Full Control' : 'Reader'}
            </span>
          </div>
          {email && (
            <div className="text-xs text-[var(--color-text-muted)] mt-1 truncate">
              {email}
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)]">
          <button
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            onClick={() => setSidebarOpen(true)}
          >
            <FiMenu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <img src={logoUrl} alt="IQAR" className="h-6 w-auto object-contain" />
          </div>
          <div className="w-6" /> {/* Spacer for centering */}
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          <div className="max-w-[1400px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
