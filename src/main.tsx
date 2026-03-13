import { FeatureErrorFallback } from '@jaskier/hydra-app/components/molecules';
import { ErrorBoundary } from '@jaskier/ui';
import { QueryClientProvider, QueryErrorResetBoundary } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AnimatePresence, motion } from 'motion/react';
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import { OfflineBanner } from '@/components/molecules/OfflineBanner';
import { ViewSkeleton } from '@/components/molecules/ViewSkeleton';
import { AppShell } from '@/components/organisms/AppShell';
import { queryClient } from '@/shared/api/queryClient';
import { useViewStore } from '@/stores/viewStore';
import '@/i18n';
import './styles/globals.css';

// ---------------------------------------------------------------------------
// Lazy-loaded views — each chunk is fetched on demand
// ---------------------------------------------------------------------------

const HomePage = lazy(() => import('@/features/home/components/HomePage'));
const ClaudeChatView = lazy(() => import('@/features/chat/components/ClaudeChatView'));
const AgentsView = lazy(() => import('@/features/agents/components/AgentsView'));
const SettingsView = lazy(() => import('@/features/settings/components/SettingsView'));
const LazyLogsView = lazy(() => import('@/features/logs/components/LogsView'));
const LazyDelegationsView = lazy(() => import('@/features/delegations/components/DelegationsView'));
const LazyAnalyticsView = lazy(() => import('@/features/analytics/components/AnalyticsView'));

// ---------------------------------------------------------------------------
// ViewRouter — maps the current view id to the correct lazy component
// with AnimatePresence view transitions (matching ClaudeHydra v3 layout)
// ---------------------------------------------------------------------------

function ViewRouter() {
  const currentView = useViewStore((s) => s.currentView);
  const isChatView = currentView === 'chat';

  function renderNonChatView() {
    switch (currentView) {
      case 'home':
        return <HomePage />;
      case 'agents':
        return (
          <ErrorBoundary fallback={<FeatureErrorFallback feature="Agents" onRetry={() => window.location.reload()} />}>
            <AgentsView />
          </ErrorBoundary>
        );
      case 'settings':
        return (
          <ErrorBoundary
            fallback={<FeatureErrorFallback feature="Settings" onRetry={() => window.location.reload()} />}
          >
            <SettingsView />
          </ErrorBoundary>
        );
      case 'logs':
        return (
          <ErrorBoundary fallback={<FeatureErrorFallback feature="Logs" onRetry={() => window.location.reload()} />}>
            <LazyLogsView />
          </ErrorBoundary>
        );
      case 'delegations':
        return (
          <ErrorBoundary
            fallback={<FeatureErrorFallback feature="Delegations" onRetry={() => window.location.reload()} />}
          >
            <LazyDelegationsView />
          </ErrorBoundary>
        );
      case 'analytics':
        return (
          <ErrorBoundary
            fallback={<FeatureErrorFallback feature="Analytics" onRetry={() => window.location.reload()} />}
          >
            <LazyAnalyticsView />
          </ErrorBoundary>
        );
    }
  }

  return (
    <div className="h-full overflow-hidden relative">
      {/* Chat always mounted — preserves WebSocket connection across view switches */}
      <div className={isChatView ? 'h-full w-full' : 'hidden'}>
        <ErrorBoundary fallback={<FeatureErrorFallback feature="Chat" onRetry={() => window.location.reload()} />}>
          <Suspense fallback={<ViewSkeleton />}>
            <ClaudeChatView />
          </Suspense>
        </ErrorBoundary>
      </div>

      {/* Non-chat views with enter/exit animations */}
      <AnimatePresence mode="wait">
        {!isChatView && (
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="h-full w-full"
          >
            <QueryErrorResetBoundary>
              {() => (
                <ErrorBoundary>
                  <Suspense fallback={<ViewSkeleton />}>{renderNonChatView()}</Suspense>
                </ErrorBoundary>
              )}
            </QueryErrorResetBoundary>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <QueryErrorResetBoundary>
        {() => (
          <ErrorBoundary>
            <AppShell>
              <ViewRouter />
            </AppShell>
          </ErrorBoundary>
        )}
      </QueryErrorResetBoundary>
      <OfflineBanner />
      <Toaster position="bottom-right" theme="dark" richColors />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

// Jaskier Shared Pattern -- createRoot with HMR safety & documentation
/**
 * Application Mount Point
 * =======================
 * - React 19.2.4 + Vite 7 with Hot Module Replacement (HMR)
 * - StrictMode intentionally enabled in DEV for side-effect detection
 * - Double-renders in StrictMode are EXPECTED and INTENTIONAL (React 18+ behavior)
 * - This helps catch bugs in component lifecycle (effects, reducers, etc.)
 *
 * HMR Safety (Vite + @vitejs/plugin-react):
 * - import.meta.hot?.dispose() cleans up the root before HMR re-import
 * - Prevents "createRoot() on container already passed to createRoot()" error
 * - On code change: dispose() unmounts old tree → module re-imports → new createRoot()
 * - Production: import.meta.hot is undefined (Vite tree-shaking removes block)
 *
 * Reference: https://vitejs.dev/guide/ssr.html#setting-up-the-dev-server
 *
 * Sentry Frontend Integration (MON-002)
 * ======================================
 * Backend Sentry is integrated via jaskier-core's `sentry` feature flag.
 * To add frontend error tracking, install @sentry/react per-app:
 *
 *   npm install @sentry/react
 *
 * Then initialize before createRoot():
 *
 *   import * as Sentry from '@sentry/react';
 *   Sentry.init({
 *     dsn: import.meta.env.VITE_SENTRY_DSN,
 *     environment: import.meta.env.MODE, // 'development' | 'production'
 *     release: `claudehydra-frontend@${import.meta.env.VITE_APP_VERSION ?? '0.0.0'}`,
 *     integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
 *     tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
 *     replaysSessionSampleRate: 0.1,
 *     replaysOnErrorSampleRate: 1.0,
 *   });
 *
 * Wrap <App /> with Sentry.ErrorBoundary for automatic error capture:
 *   <Sentry.ErrorBoundary fallback={<p>Something went wrong</p>}>
 *     <App />
 *   </Sentry.ErrorBoundary>
 *
 * Each app needs its own VITE_SENTRY_DSN in .env (never commit DSN values).
 * See: https://docs.sentry.io/platforms/javascript/guides/react/
 */

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

  // HMR cleanup: unmount root before hot reload to prevent double-mount
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      root.unmount();
    });
  }
}
