# Contributing

Guidelines for contributing to ClaudeHydra v4.

---

## Development Setup

```bash
# Clone and install
git clone <repo-url> ClaudeHydra
cd ClaudeHydra
pnpm install

# Start backend
cd backend && cargo run

# Start frontend (separate terminal)
pnpm dev
```

Frontend: `http://localhost:5177` | Backend: `http://localhost:8082`

---

## Code Style

### TypeScript / React

- **Linter and formatter**: Biome (not ESLint/Prettier)
- Run `pnpm lint` before committing
- Run `pnpm lint:fix` to auto-fix issues
- Run `pnpm format` to format all source files

Key rules:
- Functional components only (no class components)
- Named exports (no default exports)
- Use `interface` for object shapes, `type` for unions and intersections
- Destructure props in function parameters
- Use `@/` path alias for all imports from `src/`
- Prefer `const` over `let`; never use `var`
- Use `vi.fn()` for test mocks (Vitest, not Jest)

### Rust

- Run `cargo fmt` before committing
- Run `cargo clippy -- -D warnings` and fix all warnings
- Follow the existing module structure: `handlers.rs`, `models.rs`, `state.rs`
- Use `anyhow::Result` for fallible functions
- Derive `Serialize, Deserialize` on all API-facing structs
- Use `tracing::info!` / `tracing::error!` for logging (not `println!`)

---

## Matrix Theme Rules

The visual identity is non-negotiable. All UI contributions must follow these rules:

### Colors

1. **Never use raw hex/RGB values in components.** Always reference CSS variables (`var(--matrix-accent)`) or Tailwind tokens (`text-matrix-accent`).
2. **Accent color is `#00ff41` (dark) / `#2d6a4f` (light).** Do not introduce new accent colors.
3. **Backgrounds must use the `--matrix-bg-*` scale.** Three levels: primary, secondary, tertiary.
4. **Error/warning/success use the designated semantic colors.** Do not invent new status colors.

### Surfaces

5. **Use glass panels for all floating surfaces.** Apply `.glass-panel`, `.glass-card`, or `.glass-input`.
6. **Sidebar uses `.glass-panel-solid`** (opaque, no blur).
7. **No opaque white or black backgrounds.** Everything is semi-transparent or uses the theme background.

### Typography

8. **UI text uses Inter** (`font-sans`). Code and data use JetBrains Mono (`font-mono`).
9. **Base font size is 87.5% (14px).** Do not override `html { font-size }`.

### Effects

10. **Text glow is dark-theme only.** Light theme must disable all `text-shadow`.
11. **All animations must respect `prefers-reduced-motion`.** No exceptions.
12. **CRT scan-line is a global effect.** Do not add per-component scan lines.

### Testing Your Theme Changes

- Toggle between dark and light themes and verify both look correct
- Check with `prefers-reduced-motion: reduce` (enable in browser DevTools)
- Verify scrollbar styling in both themes
- Test glass blur on all target browsers

---

## Component Conventions

### File Structure

Every new component must follow this pattern:

```
src/components/atoms/MyComponent.tsx     # Component implementation
src/components/atoms/__tests__/MyComponent.test.tsx  # Tests
src/components/atoms/index.ts            # Re-export
```

### Naming

- Components: `PascalCase` (e.g., `StatusIndicator`)
- Files: `PascalCase.tsx` (matches component name)
- Hooks: `camelCase` with `use` prefix (e.g., `useAgents`)
- Stores: `camelCase` with `Store` suffix (e.g., `viewStore`)
- Test files: `ComponentName.test.tsx`

### Component Anatomy

```tsx
// Imports
import { type FC } from 'react';
import { clsx } from 'clsx';

// Types
interface MyComponentProps {
  label: string;
  variant?: 'primary' | 'secondary';
  className?: string;
}

// Component
export const MyComponent: FC<MyComponentProps> = ({
  label,
  variant = 'primary',
  className,
}) => {
  return (
    <div className={clsx('base-class', className)}>
      {label}
    </div>
  );
};
```

### Feature Modules

New features follow this structure:

```
src/features/my-feature/
  api/              # API calls (fetch wrappers)
  components/       # Feature-specific components
  hooks/            # Feature-specific hooks
  stores/           # Feature-specific Zustand slices
  index.ts          # Public API (re-exports)
```

---

## Git Workflow

### Branches

- `main` -- stable, deployable code
- `feature/<name>` -- new features
- `fix/<name>` -- bug fixes
- `refactor/<name>` -- code improvements without behavior change
- `docs/<name>` -- documentation updates

### Commit Messages

Use conventional commits:

```
feat: add model temperature slider to chat input
fix: correct Ollama timeout causing 502 on slow models
refactor: extract glass panel styles into shared utility
docs: update API reference with session endpoints
test: add missing tests for AgentsView component
chore: update Biome to 2.3.14
```

Format: `<type>: <description>` (lowercase, no period at end, imperative mood)

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`, `perf`

### Pull Requests

1. **Create a feature branch** from `main`
2. **Keep PRs focused** -- one feature or fix per PR
3. **Write a clear title** following commit message format
4. **Include in the PR description:**
   - What changed and why
   - Screenshots for UI changes (both themes)
   - Test plan or steps to verify
5. **Ensure CI passes** before requesting review:
   - `pnpm lint` -- no lint errors
   - `pnpm test` -- all 42 tests pass
   - `pnpm build` -- build succeeds
   - `cargo test` -- all 16 tests pass
   - `cargo clippy` -- no warnings

### Review Checklist

- [ ] Code follows the style guide (Biome for TS, rustfmt for Rust)
- [ ] Matrix theme rules are respected
- [ ] Both dark and light themes tested
- [ ] Tests added for new functionality
- [ ] No raw color values in components
- [ ] Animations respect reduced motion
- [ ] API changes are reflected in `docs/API.md`
- [ ] New components are documented in `docs/COMPONENTS.md`

---

## Adding a New Endpoint

1. Add the route in `backend/src/lib.rs` (`create_router`)
2. Implement the handler in `backend/src/handlers.rs`
3. Add request/response types in `backend/src/models.rs`
4. Update state if needed in `backend/src/state.rs`
5. Add `cargo test` for the endpoint
6. Create the frontend API call in the relevant `features/*/api/` directory
7. Update `docs/API.md` with the new endpoint

---

## Adding a New Component

1. Create the component file in the appropriate atomic layer
2. Export from the layer's `index.ts`
3. Write tests in `__tests__/`
4. Use only CSS variables and Tailwind tokens for styling
5. Verify in both themes
6. Update `docs/COMPONENTS.md`
