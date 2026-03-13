# ADR-005: Pin ort to v2.0.0-rc.12

**Status:** Accepted
**Date:** 2026-03-05
**Deciders:** Jaskier Team

## Context

The `jaskier-imaging` crate provides ONNX-based ML inference for face detection (SCRFD-500M), object detection (YOLOv8), and super-resolution (Real-ESRGAN 4x). The `ort` crate is the primary Rust binding for ONNX Runtime.

At time of adoption, `ort` v2.0 stable had not been released. The latest available version was `v2.0.0-rc.12`.

## Decision

Pin `ort` to exactly `v2.0.0-rc.12` in `Cargo.toml` using `version = "=2.0.0-rc.12"`.

## Rationale

- `ort` 1.x API is fundamentally different (session creation, input/output handling) and lacks features needed for batch inference.
- `ort` 2.0-rc.12 provides the required `SessionBuilder`, `Value::from_array`, and execution provider selection APIs.
- Pinning the exact version prevents accidental upgrades to a newer RC that may break the API surface.

## Risks

- **RC instability** — release candidates may have undiscovered bugs or API changes before stable.
- **Security patches** — pinned version won't receive automatic updates.
- **Ecosystem lag** — other crates depending on ort may expect stable version ranges.

## Mitigation

- **Feature-gated** — `jaskier-imaging` is behind the `onnx` Cargo feature flag, only enabled by Tissaia.
- **Isolated usage** — ONNX inference is confined to three modules (`scrfd.rs`, `yolo.rs`, `esrgan.rs`) with clean boundaries.
- **Upgrade path** — when `ort` 2.0 stable releases, update the pin and run the imaging test suite (`cargo test -p jaskier-imaging --features onnx`).

## Consequences

- `Cargo.lock` will show `ort 2.0.0-rc.12` for any workspace member enabling the `onnx` feature.
- CI runs imaging tests only when the `onnx` feature is explicitly enabled.
- Dependabot / `cargo audit` may flag the RC version; this is expected and acceptable.
