import type { StateCreator } from 'zustand';
import type { ChatTab, Session } from '../types';
import type { ViewStoreState } from '../viewStore';

export interface SessionSlice {
  activeSessionId: string | null;
  chatSessions: Session[];
  tabs: ChatTab[];
  activeTabId: string | null;

  selectSession: (id: string | null) => void;
  createSession: (title?: string) => string;
  createSessionWithId: (id: string, title: string) => void;
  deleteSession: (id: string) => void;
  updateSessionTitle: (id: string, newTitle: string) => void;
  setSessionWorkingDirectory: (id: string, wd: string) => void;
  syncWorkingDirectories: (dirs: Array<{ id: string; workingDirectory: string }>) => void;
  hydrateSessions: (sessions: Session[]) => void;
  markSessionPending: (id: string, pending: boolean) => void;
  replaceSession: (tempId: string, realId: string, title: string) => void;

  openTab: (sessionId: string) => void;
  closeTab: (tabId: string) => void;
  switchTab: (tabId: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  togglePinTab: (tabId: string) => void;
}

export const createSessionSlice: StateCreator<ViewStoreState, [], [], SessionSlice> = (set, get) => ({
  activeSessionId: null,
  chatSessions: [],
  tabs: [],
  activeTabId: null,

  selectSession: (id) => set({ activeSessionId: id }),

  createSession: (title) => {
    const id = crypto.randomUUID();
    const now = Date.now();
    const sessions = get().chatSessions;
    const sessionTitle = title ?? `Chat ${sessions.length + 1}`;
    const tabId = crypto.randomUUID();

    set((state) => ({
      chatSessions: [
        { id, title: sessionTitle, createdAt: now, updatedAt: now, messageCount: 0 },
        ...state.chatSessions,
      ],
      activeSessionId: id,
      tabs: [...state.tabs, { id: tabId, sessionId: id, title: sessionTitle, isPinned: false }],
      activeTabId: tabId,
      currentView: 'chat',
    }));

    return id;
  },

  createSessionWithId: (id, title) => {
    const now = Date.now();
    const tabId = crypto.randomUUID();
    set((state) => {
      const existingTab = state.tabs.find((t) => t.sessionId === id);
      return {
        chatSessions: [{ id, title, createdAt: now, updatedAt: now, messageCount: 0 }, ...state.chatSessions],
        activeSessionId: id,
        tabs: existingTab ? state.tabs : [...state.tabs, { id: tabId, sessionId: id, title, isPinned: false }],
        activeTabId: existingTab?.id ?? tabId,
        currentView: 'chat',
      };
    });
  },

  deleteSession: (id) =>
    set((state) => {
      const newSessions = state.chatSessions.filter((s) => s.id !== id);
      const deletedTabIdx = state.tabs.findIndex((t) => t.sessionId === id);
      const newTabs = state.tabs.filter((t) => t.sessionId !== id);
      let newActiveSessionId = state.activeSessionId;
      let newActiveTabId = state.activeTabId;

      if (state.activeSessionId === id) {
        if (newTabs.length > 0) {
          const nextIdx = Math.min(Math.max(0, deletedTabIdx), newTabs.length - 1);
          const nextTab = newTabs[nextIdx];
          newActiveTabId = nextTab?.id ?? null;
          newActiveSessionId = nextTab?.sessionId ?? null;
        } else {
          newActiveTabId = null;
          newActiveSessionId = newSessions.length > 0 ? (newSessions[0]?.id ?? null) : null;
        }
      } else if (state.activeTabId && !newTabs.some((t) => t.id === state.activeTabId)) {
        newActiveTabId = newTabs.length > 0 ? (newTabs[0]?.id ?? null) : null;
      }

      return {
        chatSessions: newSessions,
        activeSessionId: newActiveSessionId,
        activeTabId: newActiveTabId,
        tabs: newTabs,
      };
    }),

  updateSessionTitle: (id, newTitle) =>
    set((state) => ({
      chatSessions: state.chatSessions.map((s) => (s.id === id ? { ...s, title: newTitle, updatedAt: Date.now() } : s)),
      tabs: state.tabs.map((t) => (t.sessionId === id ? { ...t, title: newTitle } : t)),
    })),

  setSessionWorkingDirectory: (id, wd) =>
    set((state) => ({
      chatSessions: state.chatSessions.map((s) => (s.id === id ? { ...s, workingDirectory: wd } : s)),
    })),

  syncWorkingDirectories: (dirs) =>
    set((state) => {
      const dirMap = new Map(dirs.map((d) => [d.id, d.workingDirectory]));
      let changed = false;
      const chatSessions = state.chatSessions.map((s) => {
        const dbWd = dirMap.get(s.id);
        if (dbWd !== undefined && dbWd !== (s.workingDirectory ?? '')) {
          changed = true;
          return { ...s, workingDirectory: dbWd };
        }
        return s;
      });
      return changed ? { chatSessions } : state;
    }),

  hydrateSessions: (sessions) =>
    set((state) => {
      const existingIds = new Set(state.chatSessions.map((s) => s.id));
      const newSessions = sessions.filter((s) => !existingIds.has(s.id));
      if (newSessions.length === 0) return state;
      return {
        chatSessions: [...newSessions, ...state.chatSessions].sort(
          (a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt),
        ),
      };
    }),

  markSessionPending: (id, pending) =>
    set((state) => ({
      chatSessions: state.chatSessions.map((s) => (s.id === id ? { ...s, _pending: pending } : s)),
    })),

  replaceSession: (tempId, realId, title) =>
    set((state) => ({
      chatSessions: state.chatSessions.map((s) => (s.id === tempId ? { ...s, id: realId, title, _pending: false } : s)),
      tabs: state.tabs.map((t) => (t.sessionId === tempId ? { ...t, sessionId: realId, title } : t)),
      activeSessionId: state.activeSessionId === tempId ? realId : state.activeSessionId,
    })),

  openTab: (sessionId) =>
    set((state) => {
      const existing = state.tabs.find((t) => t.sessionId === sessionId);
      if (existing) {
        return { activeTabId: existing.id, activeSessionId: sessionId };
      }
      const session = state.chatSessions.find((s) => s.id === sessionId);
      const newTab: ChatTab = {
        id: crypto.randomUUID(),
        sessionId,
        title: session?.title || 'New Chat',
        isPinned: false,
      };
      return {
        tabs: [...state.tabs, newTab],
        activeTabId: newTab.id,
        activeSessionId: sessionId,
      };
    }),

  closeTab: (tabId) =>
    set((state) => {
      const tabIndex = state.tabs.findIndex((t) => t.id === tabId);
      if (tabIndex === -1) return state;
      const tab = state.tabs[tabIndex];
      if (tab?.isPinned) return state;

      const newTabs = state.tabs.filter((t) => t.id !== tabId);
      let newActiveTabId = state.activeTabId;
      let newActiveSessionId = state.activeSessionId;

      if (state.activeTabId === tabId) {
        if (newTabs.length > 0) {
          const nextIdx = Math.min(tabIndex, newTabs.length - 1);
          const nextTab = newTabs[nextIdx];
          newActiveTabId = nextTab?.id ?? null;
          newActiveSessionId = nextTab?.sessionId ?? null;
        } else {
          newActiveTabId = null;
          newActiveSessionId = null;
        }
      }

      return {
        tabs: newTabs,
        activeTabId: newActiveTabId,
        activeSessionId: newActiveSessionId,
      };
    }),

  switchTab: (tabId) =>
    set((state) => {
      const tab = state.tabs.find((t) => t.id === tabId);
      if (!tab) return state;
      return {
        activeTabId: tabId,
        activeSessionId: tab.sessionId,
        currentView: 'chat',
      };
    }),

  reorderTabs: (fromIndex, toIndex) =>
    set((state) => {
      if (fromIndex < 0 || fromIndex >= state.tabs.length || toIndex < 0 || toIndex >= state.tabs.length) {
        return state;
      }
      const newTabs = [...state.tabs];
      const moved = newTabs.splice(fromIndex, 1)[0];
      if (!moved) return state;
      newTabs.splice(toIndex, 0, moved);
      return { tabs: newTabs };
    }),

  togglePinTab: (tabId) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, isPinned: !t.isPinned } : t)),
    })),
});
