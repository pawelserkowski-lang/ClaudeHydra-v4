/**
 * ClaudeHydra — Settings hooks.
 * Thin wrapper around @jaskier/core useSettingsQuery with CH-specific telemetry sync.
 */

import { createTelemetryChecker, useSettingsQuery as useSharedSettingsQuery } from '@jaskier/core';
import { apiGet, apiPost } from '@/shared/api/client';
import type { Settings } from '@/shared/api/schemas';

/** localStorage key for telemetry setting (read by ErrorBoundary class component) */
const TELEMETRY_LS_KEY = 'claude-hydra-telemetry';

/** Check if telemetry is enabled (safe for class components / non-hook contexts) */
export const isTelemetryEnabled = createTelemetryChecker(TELEMETRY_LS_KEY);

const SETTINGS_CONFIG = {
  telemetryLocalStorageKey: TELEMETRY_LS_KEY,
  apiClient: { apiGet, apiPost },
} as const;

/** GET /api/settings — with telemetry sync to localStorage */
export function useSettingsQuery() {
  return useSharedSettingsQuery<Settings>(SETTINGS_CONFIG);
}
