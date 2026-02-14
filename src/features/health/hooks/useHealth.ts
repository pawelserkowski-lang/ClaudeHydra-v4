/**
 * Health-related TanStack Query hooks.
 * Polls backend health and system stats.
 */

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/shared/api/client';
import type { Health, SystemStats } from '@/shared/api/schemas';

/** GET /api/health — refetch every 30s */
export function useHealthQuery() {
  return useQuery<Health>({
    queryKey: ['health'],
    queryFn: () => apiGet<Health>('/api/health'),
    refetchInterval: 30_000,
  });
}

/** GET /api/system/stats — refetch every 10s */
export function useSystemStatsQuery() {
  return useQuery<SystemStats>({
    queryKey: ['system-stats'],
    queryFn: () => apiGet<SystemStats>('/api/system/stats'),
    refetchInterval: 10_000,
  });
}
