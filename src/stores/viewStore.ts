/**
 * viewStore — Zustand store for SPA view routing, sidebar, sessions & tabs.
 *
 * v2: Browser-style ChatTab system ported from GeminiHydra-v15.
 * Each tab links to a session via sessionId. Supports pin, reorder,
 * context menu close, and per-session streaming isolation.
 * Refactored to use the Slice Pattern for better maintainability.
 */

import { useCallback } from 'react';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type { ChatSession, ChatTab } from '@/shared/types/store';
import { createSessionSlice, type SessionSlice } from './slices/sessionSlice';
import { createViewSlice, type ViewSlice } from './slices/viewSlice';

// Re-export shared types so existing imports from '@/stores/viewStore' keep working
export type { ChatSession, ChatTab } from '@/shared/types/store';

// ============================================================================
// TYPES
// ============================================================================

export type ViewStoreState = ViewSlice & SessionSlice;

// Re-export types for backward compatibility
export * from './types';
export * from './utils';

// ============================================================================
// STORE
// ============================================================================

export const useViewStore = create<ViewStoreState>()(
  devtools(
    persist(
      (...a) => ({
        ...createViewSlice(...a),
        ...createSessionSlice(...a),
      }),
      {
        name: 'claude-hydra-v4-view',
        version: 2,
        migrate: (persisted: unknown, version: number) => {
          const state = persisted as Record<string, unknown>;
          if (version < 2) {
            // Migrate openTabs: string[] → tabs: ChatTab[]
            const openTabs = (state.openTabs as string[]) ?? [];
            const chatSessions = (state.chatSessions as ChatSession[]) ?? [];
            const activeSessionId = state.activeSessionId as string | null;

            const tabs: ChatTab[] = openTabs.map((sessionId) => {
              const session = chatSessions.find((s) => s.id === sessionId);
              return {
                id: crypto.randomUUID(),
                sessionId,
                title: session?.title ?? 'New Chat',
                isPinned: false,
              };
            });

            delete state.openTabs;
            state.tabs = tabs;
            state.activeTabId = tabs.find((t) => t.sessionId === activeSessionId)?.id ?? null;
          }
          return state;
        },
        partialize: (state) => ({
          currentView: state.currentView,
          sidebarCollapsed: state.sidebarCollapsed,
          activeSessionId: state.activeSessionId,
          chatSessions: state.chatSessions,
          tabs: state.tabs,
          activeTabId: state.activeTabId,
        }),
      },
    ),
    { name: 'ClaudeHydra/ViewStore', enabled: import.meta.env.DEV },
  ),
);

// ============================================================================
// MEMOIZED SELECTORS (#31)
// ============================================================================

/** Returns the currently active ChatSession (or undefined). Shallow-compared. */
export function useCurrentSession(): ChatSession | undefined {
  return useViewStore(useCallback((s: ViewStoreState) => s.chatSessions.find((cs) => cs.id === s.activeSessionId), []));
}

/** Returns the current chat sessions array with shallow equality. */
export function useCurrentChatHistory(): ChatSession[] {
  return useViewStore(useShallow((s) => s.chatSessions));
}
