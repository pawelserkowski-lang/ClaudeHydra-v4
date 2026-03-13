/**
 * ClaudeHydra — WebSocket Chat Hook.
 * Thin wrapper around @jaskier/chat-module useWebSocketChat with CH-specific
 * WS URL construction and Zod message validation.
 */

import type {
  WsCompleteMessage as SharedWsCompleteMessage,
  WsFallbackMessage as SharedWsFallbackMessage,
  WsStartMessage as SharedWsStartMessage,
  WsToolCallMessage as SharedWsToolCallMessage,
  WsToolResultMessage as SharedWsToolResultMessage,
} from '@jaskier/chat-module';
import {
  type WsCallbacks as SharedWsCallbacks,
  useWebSocketChat as useSharedWebSocketChat,
} from '@jaskier/chat-module';
import { useCallback, useMemo } from 'react';
import type {
  WsCompleteMessage,
  WsFallbackMessage,
  WsIterationMessage,
  WsServerMessage,
  WsStartMessage,
  WsToolCallMessage,
  WsToolProgressMessage,
  WsToolResultMessage,
} from '@/shared/api/schemas';
import { wsServerMessageSchema } from '@/shared/api/schemas';
import { env } from '@/shared/config/env';

// Re-export shared constants for backward compatibility
export { MAX_RECONNECT_ATTEMPTS } from '@jaskier/chat-module';

// ============================================================================
// TYPES (CH-specific callback interface)
// ============================================================================

export interface WsCallbacks {
  onStart?: (msg: WsStartMessage, sessionId: string | null) => void;
  onToken?: (content: string, sessionId: string | null) => void;
  onToolCall?: (msg: WsToolCallMessage, sessionId: string | null) => void;
  onToolResult?: (msg: WsToolResultMessage, sessionId: string | null) => void;
  onToolProgress?: (msg: WsToolProgressMessage, sessionId: string | null) => void;
  onIteration?: (msg: WsIterationMessage, sessionId: string | null) => void;
  onComplete?: (msg: WsCompleteMessage, sessionId: string | null) => void;
  onError?: (message: string, sessionId: string | null) => void;
  onFallback?: (msg: WsFallbackMessage, sessionId: string | null) => void;
}

// ============================================================================
// WS URL CONSTRUCTION
// ============================================================================

function getWsUrl(): string {
  const backendUrl = env.VITE_BACKEND_URL;
  const authSecret = env.VITE_AUTH_SECRET;
  const tokenParam = authSecret ? `?token=${encodeURIComponent(authSecret)}` : '';

  if (backendUrl) {
    return `${backendUrl.replace(/^http/, 'ws')}/ws/chat${tokenParam}`;
  }

  const loc = window.location;
  const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${loc.host}/ws/chat${tokenParam}`;
}

// ============================================================================
// MESSAGE PARSER (Zod validation)
// ============================================================================

function parseServerMessage(
  raw: unknown,
): { type: string; content?: string; message?: string; [key: string]: unknown } | null {
  const parsed = wsServerMessageSchema.safeParse(raw);
  if (!parsed.success) return null;
  return parsed.data as WsServerMessage & { [key: string]: unknown };
}

// ============================================================================
// HOOK
// ============================================================================

export function useWebSocketChat(callbacks: WsCallbacks) {
  // Adapt CH callbacks to shared callback format
  const sharedCallbacks: SharedWsCallbacks = useMemo(
    () => ({
      onStart: (msg: SharedWsStartMessage, sid: string | null) => {
        callbacks.onStart?.(msg as unknown as WsStartMessage, sid);
      },
      onToken: callbacks.onToken,
      onToolCall: (msg: SharedWsToolCallMessage, sid: string | null) => {
        callbacks.onToolCall?.(msg as unknown as WsToolCallMessage, sid);
      },
      onToolResult: (msg: SharedWsToolResultMessage, sid: string | null) => {
        callbacks.onToolResult?.(msg as unknown as WsToolResultMessage, sid);
      },
      onComplete: (msg: SharedWsCompleteMessage, sid: string | null) => {
        callbacks.onComplete?.(msg as unknown as WsCompleteMessage, sid);
      },
      onError: callbacks.onError,
      onFallback: (msg: SharedWsFallbackMessage, sid: string | null) => {
        callbacks.onFallback?.(msg as unknown as WsFallbackMessage, sid);
      },
    }),
    [callbacks],
  );

  const result = useSharedWebSocketChat(sharedCallbacks, {
    getWsUrl,
    parseServerMessage,
  });

  // Adapt sendExecute signature: shared uses (prompt, mode, model, session_id)
  // CH uses (prompt, model, toolsEnabled, sessionId)
  const sendExecute = useCallback(
    (prompt: string, model?: string, toolsEnabled?: boolean, sessionId?: string) => {
      // Map CH's toolsEnabled to a mode string for the shared hook
      const mode = toolsEnabled !== false ? 'tools' : 'chat';
      result.sendExecute(prompt, mode, model, sessionId);
    },
    [result],
  );

  return {
    status: result.status,
    isStreaming: result.isStreaming,
    streamingSessionId: result.streamingSessionId,
    connectionGaveUp: result.connectionGaveUp,
    sendExecute,
    cancelStream: result.cancelStream,
    manualReconnect: result.manualReconnect,
  };
}
