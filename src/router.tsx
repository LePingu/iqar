import {
  createRootRoute,
  createRoute,
  createRouter,
  Navigate,
} from '@tanstack/react-router';
import { AppLayout } from './layouts/AppLayout';
import { ControlTower } from './views/ControlTower';
import { LiveRunMonitor } from './views/LiveRunMonitor';
import { LiveTradingDashboard } from './views/LiveTradingDashboard';
import { LiveRealDashboard } from './views/LiveRealDashboard';
import { RunsBrowser } from './views/RunsBrowser';
import { RunDetail } from './views/RunDetail';
import { JobMonitor } from './views/JobMonitor';

import { RequireAdmin } from './components/RequireAdmin';

// --- Route definitions ---

const rootRoute = createRootRoute({ component: AppLayout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => <RequireAdmin><ControlTower /></RequireAdmin>,
});

const backtestsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/backtests',
  component: () => <RequireAdmin><RunsBrowser /></RequireAdmin>,
});

const backtestsLiveRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/backtests/live',
  component: () => <RequireAdmin><LiveRunMonitor /></RequireAdmin>,
});

const backtestsLiveRunRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/backtests/live/$runId',
  component: () => <RequireAdmin><LiveRunMonitor /></RequireAdmin>,
});

const runDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/backtests/$runId',
  component: () => <RequireAdmin><RunDetail /></RequireAdmin>,
});

const jobMonitorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/backtests/jobs/$jobId',
  component: () => <RequireAdmin><JobMonitor /></RequireAdmin>,
});

const liveRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/live',
  component: LiveTradingDashboard,
});

const liveRealRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/live/real',
  component: () => <RequireAdmin><LiveRealDashboard /></RequireAdmin>,
});

/** Catch-all: readers hitting admin-only routes get redirected to /live */
const catchAllRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/$',
  component: () => <Navigate to="/live" />,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  backtestsRoute,
  backtestsLiveRoute,
  backtestsLiveRunRoute,
  runDetailRoute,
  jobMonitorRoute,
  liveRoute,
  liveRealRoute,
  catchAllRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
