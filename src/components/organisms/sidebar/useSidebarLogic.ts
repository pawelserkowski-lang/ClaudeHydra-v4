// src/components/organisms/sidebar/useSidebarLogic.ts
import { useCallback, useMemo, useState } from 'react';
import { useSessionSync } from '@/features/chat/hooks/useSessionSync';
import {
  useAddTagsMutation,
  useAllTagsQuery,
  useRemoveTagMutation,
  useSearchQuery,
  useSessionTagsQuery,
} from '@/features/chat/hooks/useTags';
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

  // ── Tag management ──────────────────────────────────────────────────────

  // Fetch tags for the active session
  const { data: activeSessionTags } = useSessionTagsQuery(currentSessionId ?? null);

  // Fetch all unique tags (for suggestions + filter dropdown)
  const { data: allTagsData } = useAllTagsQuery();
  const allTagsList = useMemo(() => allTagsData?.tags?.map((t) => t.tag) ?? [], [allTagsData]);

  // Tag mutations
  const addTagsMutation = useAddTagsMutation();
  const removeTagMutation = useRemoveTagMutation();

  const handleAddTags = useCallback(
    (sessionId: string, tags: string[]) => {
      addTagsMutation.mutate({ sessionId, tags });
    },
    [addTagsMutation],
  );

  const handleRemoveTag = useCallback(
    (sessionId: string, tag: string) => {
      removeTagMutation.mutate({ sessionId, tag });
    },
    [removeTagMutation],
  );

  // ── Full-text search + tag filter ───────────────────────────────────────

  const [searchQuery, setSearchQuery] = useState('');
  const [filterTags, setFilterTags] = useState<string[]>([]);

  const { data: searchResults } = useSearchQuery(searchQuery, filterTags);

  const handleTagFilterToggle = useCallback((tag: string) => {
    setFilterTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setFilterTags([]);
  }, []);

  // Sessions sorted by updatedAt descending, then filtered by search
  const sortedSessions = useMemo(() => {
    const sorted = [...sessions].sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt));

    // If we have tag filters or full-text search results, filter to matching session IDs
    if (filterTags.length > 0 || searchQuery.trim()) {
      if (searchResults?.results) {
        const matchedIds = new Set(searchResults.results.map((r) => r.session_id));
        const filtered = sorted.filter((s) => matchedIds.has(s.id));
        // Also apply title search if provided
        if (sessionSearchQuery) {
          return filtered.filter((s) => s.title.toLowerCase().includes(sessionSearchQuery));
        }
        return filtered;
      }
      // If search is active but no results yet, keep showing all (loading state)
      if (!sessionSearchQuery) return sorted;
    }

    if (!sessionSearchQuery) return sorted;
    return sorted.filter((s) => s.title.toLowerCase().includes(sessionSearchQuery));
  }, [sessions, sessionSearchQuery, filterTags, searchQuery, searchResults]);

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

    // Tag state
    activeSessionTags: activeSessionTags?.tags ?? [],
    allTagsList,
    handleAddTags,
    handleRemoveTag,

    // Search & filter state
    searchQuery,
    setSearchQuery,
    filterTags,
    handleTagFilterToggle,
    handleClearFilters,
    searchResults,
  };
}
