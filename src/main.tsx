import { QueryClientProvider } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import { ViewSkeleton } from '@/components/molecules/ViewSkeleton';
import { AppShell } from '@/components/organisms/AppShell';
import { ErrorBoundary } from '@/components/organisms/ErrorBoundary';
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
const HistoryView = lazy(() => import('@/features/history/components/HistoryView'));
const SettingsView = lazy(() => import('@/features/settings/components/SettingsView'));

// ---------------------------------------------------------------------------
// ViewRouter — maps the current view id to the correct lazy component
// with AnimatePresence view transitions (matching ClaudeHydra v3 layout)
// ---------------------------------------------------------------------------

function ViewRouter() {
  const currentView = useViewStore((s) => s.currentView);

  const renderView = () => {
    switch (currentView) {
      case 'home':
        return <HomePage />;
      case 'chat':
        return <ClaudeChatView />;
      case 'agents':
        return <AgentsView />;
      case 'history':
        return <HistoryView />;
      case 'settings':
        return <SettingsView />;
    }
  };

  return (
    <div className="flex-1 overflow-hidden relative">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentView}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="h-full w-full"
        >
          <ErrorBoundary>
            <Suspense fallback={<ViewSkeleton />}>{renderView()}</Suspense>
          </ErrorBoundary>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <AppShell>
          <ViewRouter />
        </AppShell>
      </ErrorBoundary>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--matrix-glass-bg)',
            border: '1px solid var(--matrix-border)',
            color: 'var(--matrix-text-primary)',
          },
        }}
      />
    </QueryClientProvider>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
