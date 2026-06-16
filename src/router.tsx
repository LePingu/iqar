import { createRootRoute, createRoute, createRouter, Outlet, Link } from '@tanstack/react-router';
import { FiActivity, FiServer, FiTrendingUp } from 'react-icons/fi';
import { ControlTower } from './views/ControlTower';
import { LiveMonitor } from './views/LiveMonitor';
import { RunsBrowser } from './views/RunsBrowser';
import { RunDetail } from './views/RunDetail';
import { JobMonitor } from './views/JobMonitor';

const rootRoute = createRootRoute({
  component: () => (
    <div className="flex flex-col min-h-screen">
      <nav className="glass-panel m-4 flex items-center gap-8 !p-4">
        <div className="text-[var(--color-gold-accent)] font-bold text-xl flex items-center gap-2">
          <FiActivity /> Trader-Strat
        </div>
        <div className="flex gap-6">
          <Link to="/" activeOptions={{ exact: true }} className="flex items-center gap-2 text-gray-300 hover:text-[var(--color-gold-dim)] transition-colors" activeProps={{ className: 'text-[var(--color-gold-accent)] font-medium' }}>
            <FiServer />
            Control Tower
          </Link>
          <Link to="/backtests" className="flex items-center gap-2 text-gray-300 hover:text-[var(--color-gold-dim)] transition-colors" activeProps={{ className: 'text-[var(--color-gold-accent)] font-medium' }}>
            <FiTrendingUp />
            Runs Browser
          </Link>
          <Link to="/live" className="flex items-center gap-2 text-gray-300 hover:text-[var(--color-gold-dim)] transition-colors" activeProps={{ className: 'text-[var(--color-gold-accent)] font-medium' }}>
            <FiActivity />
            Live Monitor
          </Link>
        </div>
      </nav>
      <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: ControlTower,
});

const backtestsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/backtests',
  component: RunsBrowser,
});

const runDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/backtests/$runId',
  component: RunDetail,
});

const jobMonitorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/backtests/jobs/$jobId',
  component: JobMonitor,
});

const liveRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/live',
  component: LiveMonitor,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  backtestsRoute,
  runDetailRoute,
  jobMonitorRoute,
  liveRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
