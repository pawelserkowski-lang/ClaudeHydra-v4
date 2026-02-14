/**
 * ThemeContext — dark/light/system theme management
 * Ported from ClaudeHydra v3 Zustand store (claudeStore.theme)
 * Upgraded to React Context with system preference detection.
 *
 * ClaudeHydra uses the neutral white (#ffffff) dark theme by default.
 * Light theme is "White Wolf" with forest green (#2d6a4f).
 */

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ThemeMode = 'dark' | 'light' | 'system';
type ResolvedTheme = 'dark' | 'light';

interface ThemeContextValue {
  /** User-selected mode: dark | light | system */
  mode: ThemeMode;
  /** The actually applied theme after resolving "system" */
  resolvedTheme: ResolvedTheme;
  /** Switch to a specific mode */
  setMode: (mode: ThemeMode) => void;
  /** Convenience toggle: dark <-> light (skips system) */
  toggleTheme: () => void;
  /** Whether the resolved theme is dark */
  isDark: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'claude-hydra-theme';
const META_COLOR_DARK = '#0a0f0d';
const META_COLOR_LIGHT = '#ffffff';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSystemPreference(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light' || stored === 'system') {
      return stored;
    }
  } catch {
    // localStorage may be unavailable (SSR, privacy mode)
  }
  return 'dark';
}

function applyTheme(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return;

  document.documentElement.setAttribute('data-theme', resolved);

  // Update <meta name="theme-color"> for mobile browsers
  const metaColor = resolved === 'dark' ? META_COLOR_DARK : META_COLOR_LIGHT;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = metaColor;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface ThemeProviderProps {
  children: ReactNode;
  /** Override the default initial mode (useful for testing) */
  defaultMode?: ThemeMode;
}

export function ThemeProvider({ children, defaultMode }: ThemeProviderProps) {
  const [mode, setModeState] = useState<ThemeMode>(() => defaultMode ?? readStoredMode());
  const [systemPref, setSystemPref] = useState<ResolvedTheme>(getSystemPreference);

  // Listen for OS-level preference changes
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setSystemPref(e.matches ? 'dark' : 'light');
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Resolve the actual theme
  const resolvedTheme: ResolvedTheme = useMemo(() => {
    if (mode === 'system') return systemPref;
    return mode;
  }, [mode, systemPref]);

  // Apply to DOM whenever resolved theme changes
  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  // Persist to localStorage
  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore write failures
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setMode(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      resolvedTheme,
      setMode,
      toggleTheme,
      isDark: resolvedTheme === 'dark',
    }),
    [mode, resolvedTheme, setMode, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a <ThemeProvider>');
  }
  return ctx;
}
