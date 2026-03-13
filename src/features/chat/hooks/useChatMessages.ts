/**
 * useChatMessages — Per-session message state management.
 *
 * Handles message caching across sessions, lazy loading from DB,
 * and session switching without losing state.
 *
 * Extracted from ClaudeChatView.tsx to reduce component complexity.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { apiGet } from '@/shared/api/client';
import { useSettingsQuery } from '@/shared/hooks/useSettings';
import { useViewStore } from '@/stores/viewStore';
import type { ChatMessage, ToolInteraction } from '../components/MessageBubble';

import type { SessionDetail } from './useSessions';

/** Sentinel message ID marking the compaction divider */
export const COMPACTION_DIVIDER_ID = '__compaction_divider__';

export function useChatMessages() {
  // Per-session message cache & loading state
  const sessionMessagesRef = useRef<Record<string, ChatMessage[]>>({});
  const loadingSessionsRef = useRef<Set<string>>(new Set());
  const abortControllersRef = useRef<Record<string, AbortController>>({});

  // Track which sessions have been compacted (for "load full history" button)
  const compactedSessionsRef = useRef<Set<string>>(new Set());

  // Displayed state (derived from active session)
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const currentSessionId = useViewStore(useShallow((s) => s.currentSessionId));

  // Configurable compaction thresholds from settings
  const { data: settings } = useSettingsQuery();
  const compactionThreshold = settings?.compaction_threshold ?? 25;
  const compactionKeep = settings?.compaction_keep ?? 15;

  /** Update messages for a specific session. Only updates display if session is active. */
  const updateSessionMessages = useCallback(
    (sessionId: string, updater: (prev: ChatMessage[]) => ChatMessage[]) => {
      const prev = sessionMessagesRef.current[sessionId] ?? [];
      let updated = updater(prev);

      // Auto-compaction: if messages exceed threshold, keep the last N to save tokens
      if (updated.length > compactionThreshold) {
        const dividerMessage: ChatMessage = {
          id: COMPACTION_DIVIDER_ID,
          role: 'system',
          content: '__compaction_divider__',
          timestamp: Date.now(),
        };
        compactedSessionsRef.current.add(sessionId);
        updated = [dividerMessage, ...updated.slice(updated.length - compactionKeep)];
      }

      sessionMessagesRef.current[sessionId] = updated;

      if (sessionId === useViewStore.getState().currentSessionId) {
        setMessages(updated);
      }
    },
    [compactionThreshold, compactionKeep],
  );

  /** Load full message history from DB for a session (overrides compaction). */
  const loadFullHistory = useCallback(async (sessionId: string) => {
    try {
      const detail = await apiGet<SessionDetail>(`/api/sessions/${sessionId}`);
      const mapped: ChatMessage[] = detail.messages.map((m) => ({
        id: m.id,
        role: m.role as ChatMessage['role'],
        content: m.content,
        model: m.model ?? undefined,
        timestamp: new Date(m.timestamp).getTime(),
        toolInteractions: m.tool_interactions?.map(
          (ti): ToolInteraction => ({
            id: ti.tool_use_id,
            toolName: ti.tool_name,
            toolInput: ti.tool_input,
            result: ti.result,
            isError: ti.is_error,
            status: 'completed',
          }),
        ),
      }));
      compactedSessionsRef.current.delete(sessionId);
      sessionMessagesRef.current[sessionId] = mapped;
      if (sessionId === useViewStore.getState().currentSessionId) {
        setMessages(mapped);
      }
    } catch {
      // Best-effort — session may not exist in DB yet
    }
  }, []);

  /** Set loading state for a specific session. Only updates display if session is active. */
  const setSessionLoading = useCallback((sessionId: string, loading: boolean) => {
    if (loading) {
      loadingSessionsRef.current.add(sessionId);
    } else {
      loadingSessionsRef.current.delete(sessionId);
    }

    if (sessionId === useViewStore.getState().currentSessionId) {
      setIsLoading(loading);
    }
  }, []);

  // ----- Session switch: save & restore messages ---------------------------

  useEffect(() => {
    if (!currentSessionId) {
      setMessages([]);
      setIsLoading(false);
      return;
    }

    const cached = sessionMessagesRef.current[currentSessionId] ?? [];
    if (cached.length > 0) {
      setMessages(cached);
      setIsLoading(loadingSessionsRef.current.has(currentSessionId));
      return;
    }

    // Lazy-load from DB when sessionMessagesRef is empty (e.g. after page refresh)
    let cancelled = false;
    setIsLoading(true);
    apiGet<SessionDetail>(`/api/sessions/${currentSessionId}`)
      .then((detail) => {
        if (cancelled) return;
        const mapped: ChatMessage[] = detail.messages.map((m) => ({
          id: m.id,
          role: m.role as ChatMessage['role'],
          content: m.content,
          model: m.model ?? undefined,
          timestamp: new Date(m.timestamp).getTime(),
          toolInteractions: m.tool_interactions?.map(
            (ti): ToolInteraction => ({
              id: ti.tool_use_id,
              toolName: ti.tool_name,
              toolInput: ti.tool_input,
              result: ti.result,
              isError: ti.is_error,
              status: 'completed',
            }),
          ),
        }));
        sessionMessagesRef.current[currentSessionId] = mapped;
        setMessages(mapped);
      })
      .catch(() => {
        // Best-effort: session may not exist in DB yet (local-only)
        if (!cancelled) setMessages([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentSessionId]);

  /** Clear messages for the active session. */
  const clearChat = useCallback(() => {
    if (currentSessionId) {
      sessionMessagesRef.current[currentSessionId] = [];
      loadingSessionsRef.current.delete(currentSessionId);
      compactedSessionsRef.current.delete(currentSessionId);
      // Abort any in-progress stream for this session
      abortControllersRef.current[currentSessionId]?.abort();
      delete abortControllersRef.current[currentSessionId];
    }
    setMessages([]);
    setIsLoading(false);
  }, [currentSessionId]);

  return {
    messages,
    isLoading,
    sessionMessagesRef,
    loadingSessionsRef,
    abortControllersRef,
    updateSessionMessages,
    setSessionLoading,
    clearChat,
    loadFullHistory,
  };
}
