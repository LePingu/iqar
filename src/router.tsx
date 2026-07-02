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
import { RunsBrowser } from './views/RunsBrowser';
import { RunDetail } from './views/RunDetail';
import { JobMonitor } from './views/JobMonitor';

// --- Route definitions ---

const rootRoute = createRootRoute({ component: AppLayout });

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

const backtestsLiveRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/backtests/live',
  component: LiveRunMonitor,
});

const backtestsLiveRunRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/backtests/live/$runId',
  component: LiveRunMonitor,
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
  component: LiveTradingDashboard,
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
  catchAllRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
