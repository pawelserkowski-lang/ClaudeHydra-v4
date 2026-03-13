# ADR-003: Chrome Persistent Context over storageState

**Status:** Accepted
**Date:** 2026-02-15
**Deciders:** Jaskier Team

## Context

The `gemini-browser-proxy` needs to maintain authenticated Google sessions for browser-based AI interactions (Gemini on AI Studio). Two Playwright/Chromium approaches were evaluated:

1. **`storageState`** — export cookies/localStorage to JSON, inject into new browser contexts.
2. **`launchPersistentContext`** — use a full Chrome user profile directory (`browser-profile/`).

Initial implementation used `storageState`, which worked for simple sites but failed for Google sessions.

## Decision

Use `launchPersistentContext` with a persistent Chrome profile directory.

## Rationale

- Google sets `httpOnly` + `secure` + `SameSite=Lax` cookies that `storageState` JSON export cannot fully capture.
- Google sessions are validated server-side with additional signals (IndexedDB tokens, service worker registrations) beyond cookies alone.
- Persistent context preserves the actual Chrome SQLite cookie database, session storage, and IndexedDB intact.
- Login detection uses a positive signal (chat input textarea visible) rather than absence of "Sign in" button.

## Trade-offs

- **Larger disk footprint** — full Chrome profile is ~50-200MB vs ~50KB for storageState JSON.
- **Single browser process** — all 4 workers share one browser context (4 pages, 1 process) instead of independent contexts.
- **Profile corruption risk** — crash can corrupt profile; mitigated by `worker-profile/` backup copy at init.

## Consequences

- `npm run login:persistent` creates the initial `browser-profile/` with a manual login flow.
- Windows Task Scheduler (`GeminiProxySessionCheck`) verifies session validity every 6 hours.
- Profile directory must not be committed to git (added to `.gitignore`).
