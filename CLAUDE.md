# ClaudeHydra v4 — AI Swarm Control Center

## Quick Start
- `npm run dev` — port 5199
- `npx tsc --noEmit` — type check

## Architecture
- Pure Vite SPA — React 19 + Zustand 5
- Views: home, chat, agents, history, settings
- ViewRouter in `src/main.tsx` with AnimatePresence transitions
- Sidebar: `src/components/organisms/Sidebar.tsx` (flat nav, session manager with rename/delete)

## Key Files
- `src/features/home/components/HomePage.tsx` — WelcomeScreen (ported from GeminiHydra)
- `src/shared/hooks/useViewTheme.ts` — full ViewTheme (replaced v3 simplified version)
- `src/stores/viewStore.ts` — ChatSession type, chatSessions, openTabs, activeSessionId
- `src/features/chat/components/OllamaChatView.tsx` — main chat interface

## Store API (differs from GeminiHydra)
- `setView(view)` not `setCurrentView(view)`
- `chatSessions` not `sessions`
- `activeSessionId` not `currentSessionId`
- `ChatSession` has `messageCount` field (GH uses `chatHistory[id].length`)

## Sidebar Session Manager
- `SessionItem` sub-component z rename (inline edit), delete (confirm), tooltip (preview)
- Sessions sorted by `updatedAt` descending
- Collapsed mode: only icon buttons for sessions

## Conventions
- motion/react for animations
- Biome for linting
- npm as package manager
