# ADR-002: Source-Only @jaskier/* Packages

**Status:** Accepted
**Date:** 2026-02-20
**Deciders:** Jaskier Team

## Context

The monorepo has 11 shared frontend packages (`@jaskier/core`, `@jaskier/chat-module`, `@jaskier/i18n`, etc.). Two distribution strategies were evaluated:

1. **Pre-built packages** — each package runs a build step producing `dist/` artifacts, consumers import compiled JS.
2. **Source-only packages** — consumers import TypeScript source directly, letting the app's bundler handle compilation.

## Decision

All `@jaskier/*` packages are source-only (no build step), with the exception of `@jaskier/ui` which uses Vite library mode.

## Rationale

- **Faster dev iteration** — no need to rebuild packages before the consuming app picks up changes; HMR propagates instantly.
- **No build ordering issues** — Turborepo doesn't need to topologically sort package builds before app builds.
- **Simpler configuration** — packages need only a `tsconfig.json` and `package.json` with `"main"` pointing to source `src/index.ts`.
- **Tree-shaking preserved** — the app bundler (Vite) sees the full source and eliminates unused exports.

## Exception: @jaskier/ui

`@jaskier/ui` requires a Vite library mode build step because:
- It exports CSS alongside components (needs PostCSS/Tailwind processing).
- Storybook on port :6006 depends on built component artifacts.
- Visual regression tests (Chromatic) require stable, pre-built output.

## Consequences

- TypeScript path aliases in consuming apps must resolve to package source directories.
- Type-checking runs against source (not `.d.ts`), which is slower but catches more errors.
- Adding a new package is trivial — no build tooling setup required.
