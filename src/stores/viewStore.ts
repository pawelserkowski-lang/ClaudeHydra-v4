/**
 * viewStore — Zustand store for SPA view routing, sidebar, sessions & tabs.
 *
 * Uses @jaskier/state createAppStore.
 */

import { createAppStore } from '@jaskier/state';
import type { ViewType as ViewId } from '@jaskier/state';

const { useViewStore: useBaseStore, useCurrentSession, useCurrentChatHistory, useCurrentSessionId } = createAppStore({
  storageKey: 'claude-hydra-v4-view',
  devtoolsName: 'ClaudeHydra/ViewStore',
  persistVersion: 2,
});

export const useViewStore = useBaseStore;
export { useCurrentSession, useCurrentChatHistory, useCurrentSessionId };
export type { ViewId };
export * from '@/shared/types/store';
