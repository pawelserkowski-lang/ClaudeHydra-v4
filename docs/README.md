# ClaudeHydra v4.0.0 -- AI Swarm Control Center

A dual-provider AI chat platform with 12 Witcher-themed autonomous agents, built on React 19 and Rust/Axum.

## Quick Start

### Prerequisites

- **Node.js** >= 20 and **pnpm** >= 9
- **Rust** >= 1.82 (2024 edition)
- **Ollama** running locally (optional, for local models)
- **Anthropic API key** (optional, for Claude provider)

### 1. Clone and install

```bash
git clone <repo-url> ClaudeHydra
cd ClaudeHydra
pnpm install
```

### 2. Start the backend (Rust/Axum)

```bash
cd backend
# Optional: set environment variables
export ANTHROPIC_API_KEY=sk-ant-...
export OLLAMA_HOST=http://127.0.0.1:11434

cargo run
# Backend listens on http://localhost:8082
```

### 3. Start the frontend (Vite dev server)

```bash
pnpm dev
# Frontend available at http://localhost:5177
```

The Vite dev server proxies all `/api/*` requests to the Rust backend automatically.

## Dual Chat Architecture

ClaudeHydra supports two AI providers simultaneously:

| Provider   | Type   | Endpoint             | Models                        |
|------------|--------|----------------------|-------------------------------|
| **Claude** | Cloud  | Anthropic Messages API | claude-sonnet-4, claude-opus-4, etc. |
| **Ollama** | Local  | Local REST API        | llama3.1, mistral, codellama, etc.    |

Switch between providers in the chat interface or use the Model Selector to pick any available model.

## Tech Stack

### Frontend

| Technology          | Version | Purpose                     |
|---------------------|---------|-----------------------------|
| React               | 19.2    | UI framework                |
| Vite                | 7.3     | Build tool and dev server   |
| TypeScript          | 5.9     | Type safety                 |
| Tailwind CSS        | 4.1     | Utility-first styling       |
| Zustand             | 5.0     | Global state management     |
| TanStack Query      | 5.90    | Server state and caching    |
| Motion (Framer)     | 12.34   | Animations                  |
| Lucide React        | 0.563   | Icon library                |
| react-markdown      | 10.1    | Markdown rendering in chat  |
| Zod                 | 4.3     | Runtime schema validation   |
| i18next             | 25.8    | Internationalization        |
| Biome               | 2.3     | Linter and formatter        |

### Backend

| Technology          | Version | Purpose                     |
|---------------------|---------|-----------------------------|
| Rust                | 2024 ed.| Systems language            |
| Axum                | 0.8     | HTTP framework              |
| Tokio               | 1.49    | Async runtime               |
| Reqwest             | 0.13    | HTTP client (proxy calls)   |
| Serde               | 1.0     | Serialization               |
| sysinfo             | 0.35    | System metrics (CPU/RAM)    |
| tower-http          | 0.6     | CORS, compression, tracing  |

### Witcher Agents

12 autonomous agents organized in three tiers:

| Agent       | Role           | Tier        |
|-------------|----------------|-------------|
| Geralt      | Security       | Commander   |
| Yennefer    | Architecture   | Commander   |
| Vesemir     | Testing        | Commander   |
| Triss       | Data           | Coordinator |
| Jaskier     | Documentation  | Coordinator |
| Ciri        | Performance    | Coordinator |
| Dijkstra    | Strategy       | Coordinator |
| Lambert     | DevOps         | Executor    |
| Eskel       | Backend        | Executor    |
| Regis       | Research       | Executor    |
| Zoltan      | Frontend       | Executor    |
| Philippa    | Monitoring     | Executor    |

## Project Structure

```
ClaudeHydra/
  backend/              # Rust/Axum API server
    src/
      main.rs           # Entry point, server bootstrap
      lib.rs            # Router definition
      handlers.rs       # Request handlers
      models.rs         # Data types (Serde structs)
      state.rs          # AppState, agent initialization
  src/                  # React frontend
    components/
      atoms/            # Button, Card, Badge, Input, etc.
      molecules/        # CodeBlock, ModelSelector, etc.
      organisms/        # AppShell, Sidebar, ErrorBoundary
      effects/          # Visual effects
    features/
      home/             # Dashboard / landing page
      chat/             # Dual-provider chat (Claude + Ollama)
      agents/           # Witcher agent management
      history/          # Session history browser
      settings/         # App configuration
      health/           # System health monitoring
    stores/             # Zustand state stores
    services/           # API client layer
    styles/             # globals.css (Matrix theme)
    i18n/               # Internationalization
    workers/            # Web Workers
  docs/                 # Documentation (you are here)
```

## Scripts

| Command          | Description                       |
|------------------|-----------------------------------|
| `pnpm dev`       | Start Vite dev server (port 5177) |
| `pnpm build`     | TypeScript check + production build |
| `pnpm test`      | Run Vitest test suite             |
| `pnpm lint`      | Biome lint check                  |
| `pnpm lint:fix`  | Biome lint with auto-fix          |
| `pnpm format`    | Biome format                      |
| `pnpm preview`   | Preview production build          |

## License

Private -- All rights reserved.
