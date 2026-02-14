/**
 * AppShell — root layout organism for ClaudeHydra v4.
 * Ported from ClaudeHydra v3 App.tsx layout.
 *
 * Composes:
 *  - ThemeProvider wrapper
 *  - Background layers (RuneRain, background image, gradient, glow)
 *  - Sidebar (collapsible navigation)
 *  - Content area (children slot)
 *  - StatusFooter
 *
 * Matches Tissaia v4 style with p-4 gap-4 spacing.
 */

import type { ReactNode } from 'react';

import { RuneRain } from '@/components/atoms';
import { Sidebar } from '@/components/organisms/Sidebar';
import { StatusFooter } from '@/components/organisms/StatusFooter';
import { useTheme, ThemeProvider } from '@/contexts/ThemeContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AppShellProps {
  /** Page content rendered in the main area */
  children: ReactNode;
}

// ---------------------------------------------------------------------------
// Inner shell (needs ThemeProvider above it)
// ---------------------------------------------------------------------------

function AppShellInner({ children }: AppShellProps) {
  const { isDark } = useTheme();

  const glassPanel = isDark
    ? 'bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl'
    : 'bg-white/40 backdrop-blur-xl border border-white/20 shadow-lg rounded-2xl';

  return (
    <div
      data-testid="app-shell"
      className={`relative flex h-screen w-full ${
        isDark
          ? 'text-white selection:bg-white/30 selection:text-white'
          : 'text-black selection:bg-emerald-500 selection:text-white'
      } overflow-hidden font-mono`}
    >
      {/* Background Layer — crossfade between dark/light */}
      <div
        className={`absolute inset-0 z-[1] bg-cover bg-center pointer-events-none transition-opacity duration-1000 ease-in-out bg-[url('/background.webp')] ${
          isDark ? 'opacity-40' : 'opacity-0'
        }`}
      />
      <div
        className={`absolute inset-0 z-[1] bg-cover bg-center pointer-events-none transition-opacity duration-1000 ease-in-out bg-[url('/backgroundlight.webp')] ${
          !isDark ? 'opacity-35' : 'opacity-0'
        }`}
      />

      {/* Gradient overlay */}
      <div
        className={`absolute inset-0 z-[1] bg-gradient-to-b pointer-events-none transition-opacity duration-1000 opacity-60 ${
          isDark
            ? 'from-black/40 via-transparent to-black/60'
            : 'from-white/30 via-transparent to-slate-100/50'
        }`}
      />

      {/* Radial glow */}
      <div
        className={`absolute inset-0 z-[1] pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] ${
          isDark ? 'from-white/5' : 'from-emerald-500/5'
        } via-transparent to-transparent`}
      />

      {/* Rune Rain Effect */}
      <RuneRain opacity={0.1} />

      {/* Main content with padding and gap matching Tissaia */}
      <div className="relative z-10 flex h-full w-full backdrop-blur-[1px] gap-4 p-4">
        {/* Sidebar */}
        <Sidebar />

        {/* Main content area */}
        <main className={`flex-1 flex flex-col min-w-0 overflow-hidden relative ${glassPanel}`}>
          <div className="flex-1 min-h-0 overflow-hidden">
            {children}
          </div>
          <StatusFooter />
        </main>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component (with ThemeProvider wrapper)
// ---------------------------------------------------------------------------

export function AppShell({ children }: AppShellProps) {
  return (
    <ThemeProvider>
      <AppShellInner>{children}</AppShellInner>
    </ThemeProvider>
  );
}
