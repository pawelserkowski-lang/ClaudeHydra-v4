// src/components/organisms/sidebar/useSidebarLogic.ts
import { useCallback, useMemo, useState } from 'react';
import { useSessionSync } from '@/features/chat/hooks/useSessionSync';
import { useViewStore, type ViewId } from '@/stores/viewStore';

export function useSidebarLogic() {
  // Store selectors
  const currentView = useViewStore((s) => s.currentView);

  // Session sync (DB + localStorage)
  const {
    currentSessionId,
    sessions,
    selectSession,
    openTab,
    setCurrentView,
    createSessionWithSync,
    deleteSessionWithSync,
    renameSessionWithSync,
  } = useSessionSync();

  // Session search/filter (#19)
  const [sessionSearchQuery, setSessionSearchQuery] = useState('');
  const handleSessionSearch = useCallback((query: string) => {
    setSessionSearchQuery(query);
  }, []);

  // Sessions sorted by updatedAt descending, then filtered by search
  const sortedSessions = useMemo(() => {
    const sorted = [...sessions].sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt));
    if (!sessionSearchQuery) return sorted;
    return sorted.filter((s) => s.title.toLowerCase().includes(sessionSearchQuery));
  }, [sessions, sessionSearchQuery]);

  // Collapsible sessions toggle
  const [showSessions, setShowSessions] = useState(true);

  // #42 — Keyboard navigation for session list
  const [focusedSessionIndex, setFocusedSessionIndex] = useState(-1);

  // Base handlers (no mobile-close logic — SidebarContent wraps these)
  const handleSelectSession = useCallback(
    (sessionId: string) => {
      selectSession(sessionId);
      openTab(sessionId);
      setCurrentView('chat');
    },
    [selectSession, openTab, setCurrentView],
  );

  const handleSessionListKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedSessionIndex((i) => (i + 1) % sortedSessions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedSessionIndex((i) => (i - 1 + sortedSessions.length) % sortedSessions.length);
      } else if (e.key === 'Enter' && focusedSessionIndex >= 0 && sortedSessions[focusedSessionIndex]) {
        e.preventDefault();
        handleSelectSession(sortedSessions[focusedSessionIndex].id);
      }
    },
    [sortedSessions, focusedSessionIndex, handleSelectSession],
  );

  const handleNewChat = useCallback(() => {
    createSessionWithSync();
  }, [createSessionWithSync]);

  const handleDeleteSession = useCallback(
    (id: string) => {
      deleteSessionWithSync(id);
    },
    [deleteSessionWithSync],
  );

  const handleRenameSession = useCallback(
    (id: string, newTitle: string) => {
      renameSessionWithSync(id, newTitle);
    },
    [renameSessionWithSync],
  );

  const handleNavClick = useCallback(
    (view: ViewId) => {
      setCurrentView(view);
    },
    [setCurrentView],
  );

  return {
    // Store state
    currentView,
    setCurrentView,

    // Session state
    currentSessionId,
    sessions,
    sortedSessions,
    sessionSearchQuery,
    focusedSessionIndex,
    showSessions,
    setShowSessions,

    // Session handlers
    handleSessionSearch,
    handleSessionListKeyDown,
    handleSelectSession,
    handleNewChat,
    handleDeleteSession,
    handleRenameSession,
    handleNavClick,
  };
}
