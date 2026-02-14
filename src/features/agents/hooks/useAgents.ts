/**
 * Agents TanStack Query hook.
 * Fetches the list of Claude AI agents from the backend.
 */

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/shared/api/client';
import type { AgentsList } from '@/shared/api/schemas';

/** GET /api/agents */
export function useAgentsQuery() {
  return useQuery<AgentsList>({
    queryKey: ['agents'],
    queryFn: () => apiGet<AgentsList>('/api/agents'),
  });
}
