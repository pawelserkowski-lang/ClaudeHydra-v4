/**
 * Chat-related TanStack Query hooks.
 * Claude API chat mutation (non-streaming fallback).
 */

import { useMutation } from '@tanstack/react-query';
import { apiPost } from '@/shared/api/client';
import type { ClaudeChatRequest, ClaudeChatResponse } from '@/shared/api/schemas';

/** POST /api/claude/chat */
export function useClaudeChatMutation() {
  return useMutation<ClaudeChatResponse, Error, ClaudeChatRequest>({
    mutationFn: (body) => apiPost<ClaudeChatResponse>('/api/claude/chat', body),
  });
}
