# ADR-004: Cargo Workspace Shared Crates with Trait-Based Generics

**Status:** Accepted
**Date:** 2026-03-01
**Deciders:** Jaskier Team

## Context

The Jaskier ecosystem has 7 Hydra app backends (ClaudeHydra, GeminiHydra, Tissaia, OpenAIHydra, GrokHydra, DeepSeekHydra, Regis) with significant code duplication: OAuth flows, model registry, session management, router construction, browser proxy integration, and tool definitions were copy-pasted across apps.

## Decision

Extract shared logic into 10 workspace crates (`jaskier-*`) using Rust trait-based generics for app-specific customization.

## Pattern

```
1. Local module in app's backend/src/ (e.g., oauth_google.rs)
2. Shared crate with generic trait (e.g., jaskier-oauth with HasGoogleOAuthState)
3. Re-export stub in app: pub use jaskier_oauth::google::*;
4. Trait impl in app's state.rs — wires shared logic to app-specific state
5. Handler rewrite: turbofish ::<AppState> at call-sites
```

## Rationale

- **Compile-time type safety** — trait bounds guarantee each app provides required state fields.
- **Zero-cost abstractions** — monomorphization means no runtime dispatch overhead.
- **Single source of truth** — bug fixes in shared crates propagate to all apps automatically.
- **Incremental adoption** — apps can adopt shared crates one module at a time; re-export stubs preserve existing APIs.

## Trade-offs

- **Supertrait chains** — `HasGoogleOAuthState` requires `HasModelRegistryState` requires `HasWatchdogState`, increasing trait complexity.
- **Longer initial compile** — 10 crates add build units (mitigated by cargo caching).
- **Turbofish syntax** — generic handlers require `::<AppState>` at every call-site.

## Consequences

- Reduced per-app backend code from ~6000 to ~1500 lines (sessions, router, handlers extracted).
- 836+ tests passing across 65 test suites with 0 failures.
- Adding a new Hydra app requires only `state.rs` trait impls and a thin `main.rs`.
