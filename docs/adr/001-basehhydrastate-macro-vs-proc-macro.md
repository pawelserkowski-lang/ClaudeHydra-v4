# ADR-001: Declarative Macro for delegate_base_traits!

**Status:** Accepted
**Date:** 2026-03-01
**Deciders:** Jaskier Team

## Context

The `jaskier-hydra-state` crate needs to generate 13+ trait implementations (`HasAuthSecret`, `HasLogBuffer`, `HasModelRegistryState`, etc.) for each Quad Hydra app's `AppState`. Writing these by hand is error-prone and creates maintenance burden across 4+ apps.

Two approaches were considered:
1. **Procedural macro** (`#[derive(HydraTraits)]`) via a separate `jaskier-macros` crate
2. **Declarative macro** (`macro_rules! delegate_base_traits!`) within the existing crate

## Decision

Use `macro_rules!` declarative macro instead of a proc-macro derive.

## Rationale

- **No extra crate dependency** — proc-macros require a dedicated crate with `proc-macro = true`, adding a build unit and workspace member.
- **Faster compilation** — declarative macros are expanded during parsing, avoiding the syn/quote dependency tree (~30s additional compile time).
- **Simpler debugging** — `cargo expand` output is straightforward; proc-macro errors are notoriously opaque.
- **Sufficient for the use case** — all trait impls follow an identical delegation pattern (`self.base.field()`), which `macro_rules!` handles cleanly.

## Trade-offs

- More verbose pattern matching syntax compared to proc-macro's full Rust AST access.
- Limited meta-programming — cannot inspect field types or generate entirely new structs.
- Macro hygiene requires careful `$crate::` prefixing for cross-crate usage.

## Consequences

- Each Quad Hydra app calls `delegate_base_traits!(AppState, base)` in one line to get all 13+ trait impls.
- Adding a new shared trait requires updating the macro definition (single location in `jaskier-hydra-state`).
- If trait generation needs grow beyond simple delegation, revisit proc-macro approach.
