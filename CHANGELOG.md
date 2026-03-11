# 4.0.0 (2026-02-25)


### Bug Fixes

* add missing x-api-key header and configurable API URL in chat endpoints ([569d328](https://github.com/EPS-AI-SOLUTIONS/ClaudeHydra/commit/569d32862a35f9f262f4f68a641abdd39f53c2bb))
* **backend:** prevent invalid Unicode surrogate errors in Anthropic API requests ([3f2d6c2](https://github.com/EPS-AI-SOLUTIONS/ClaudeHydra/commit/3f2d6c23d94349937aefb0043b76ee68b8738cd7))
* **backend:** unique migration timestamps and dead code cleanup ([a2e2491](https://github.com/EPS-AI-SOLUTIONS/ClaudeHydra/commit/a2e249135efda8df07f21e6f4be5e31202869da8))
* **i18n:** complete translations — add missing keys, set Polish default ([a88f3d3](https://github.com/EPS-AI-SOLUTIONS/ClaudeHydra/commit/a88f3d3e32f59d6e988d5cf49ff0bd94e2b199e5))
* **migrations:** normalize line endings CRLF → LF and update CLAUDE.md ([3422a53](https://github.com/EPS-AI-SOLUTIONS/ClaudeHydra/commit/3422a530dd4ab0991dc310d9ddd36b7a02346217))
* **partner:** portal escape for PartnerChatModal + UI/theme refactor ([6e1c0b9](https://github.com/EPS-AI-SOLUTIONS/ClaudeHydra/commit/6e1c0b96c30ea653c985ad70e2b7e716a6f944ea))
* port UI fixes from GeminiHydra — Ctrl+Enter newline, bigger collapse button ([724d8f7](https://github.com/EPS-AI-SOLUTIONS/ClaudeHydra/commit/724d8f72af10d7a94f773c948f51179df00174f8))
* resolve Biome lint errors and improve code quality ([8410dd5](https://github.com/EPS-AI-SOLUTIONS/ClaudeHydra/commit/8410dd56027e013d4ea72785bf9c812fa07fc744))
* restore Polish diacritics in pl.json translations ([d7e13d7](https://github.com/EPS-AI-SOLUTIONS/ClaudeHydra/commit/d7e13d74d38e9b60b5eb2c38cb7bbf1d4585fe0c))
* **scripts:** always restart backend in dev/release scripts ([5fe6ed0](https://github.com/EPS-AI-SOLUTIONS/ClaudeHydra/commit/5fe6ed0e6a6fcf2bbdedd65010eda4837e8e9008))
* tsconfig.node.json - use emitDeclarationOnly for allowImportingTsExtensions compatibility ([d98ec5f](https://github.com/EPS-AI-SOLUTIONS/ClaudeHydra/commit/d98ec5fe07dbf97a1da48ab2966e5347db3fac45))
* update vercel.json to use corepack for pnpm ([a3b10e9](https://github.com/EPS-AI-SOLUTIONS/ClaudeHydra/commit/a3b10e92a8de47545b3643cea06759ec38a89370))


### Features

* add backend watchdog, non-blocking startup, and auto-retry ([a0721ae](https://github.com/EPS-AI-SOLUTIONS/ClaudeHydra/commit/a0721aeace5950f00bb0d43ea9dd7a5651c7716e))
* add Fly.io backend deployment + production API URLs ([1cb0894](https://github.com/EPS-AI-SOLUTIONS/ClaudeHydra/commit/1cb0894a6413fa5f02aeb8a6df66905d686f3bc2))
* add optional auth middleware (AUTH_SECRET Bearer token) ([a1b867a](https://github.com/EPS-AI-SOLUTIONS/ClaudeHydra/commit/a1b867a1539c899e592eada713743a6062937667))
* add Vitest unit tests for API client, Zod schemas, and markdown utils ([7500196](https://github.com/EPS-AI-SOLUTIONS/ClaudeHydra/commit/7500196bc93492b2282bbd30a6316982169fe385))
* add welcome message to ClaudeHydra chat ([aa546da](https://github.com/EPS-AI-SOLUTIONS/ClaudeHydra/commit/aa546dae01258a9a96f291f35001f67a1243d091))
* **backend:** auto-fetch models at startup and set latest per tier ([66eda39](https://github.com/EPS-AI-SOLUTIONS/ClaudeHydra/commit/66eda3993b5c4bab7102789324295cc795e08a1c))
* **backend:** background system monitor with cached snapshots ([034e168](https://github.com/EPS-AI-SOLUTIONS/ClaudeHydra/commit/034e16800d1f477986c652fece788abfd5e437b5))
* **chat:** auto-name sessions from first user message ([dabf41b](https://github.com/EPS-AI-SOLUTIONS/ClaudeHydra/commit/dabf41baf0af831ba0cae75af7d786ded2e8d65b))
* **chat:** per-session streaming — unblock input on inactive tabs ([b007aa9](https://github.com/EPS-AI-SOLUTIONS/ClaudeHydra/commit/b007aa9833b24ce8ab07aca8bc6cc299a2193bb4))
* ClaudeHydra v4.0.0 - AI Swarm Control Center ([2383ecd](https://github.com/EPS-AI-SOLUTIONS/ClaudeHydra/commit/2383ecdf1b444accc726a45f332d82d5081a5892))
* **i18n:** translate HomeView — add home and time sections to en/pl JSON, convert HomePage.tsx to use useTranslation ([b98798b](https://github.com/EPS-AI-SOLUTIONS/ClaudeHydra/commit/b98798b6ec3b41ccc4ebedfcd0575d6c49cbe775))
* migrate backend to shared Postgres (sqlx 0.8) ([3c51410](https://github.com/EPS-AI-SOLUTIONS/ClaudeHydra/commit/3c514100fada0e89ded4816fa48ba662ba01c76f))
* **migrations:** add model pins migration (005) ([50e7336](https://github.com/EPS-AI-SOLUTIONS/ClaudeHydra/commit/50e7336177b3985acd663aeda174dd61f411ba8f))
* OAuth integration, chat improvements, dead code cleanup ([1dad5fe](https://github.com/EPS-AI-SOLUTIONS/ClaudeHydra/commit/1dad5feec6ef4cfbb8e3ae4682003528b8461bf0))
* **partner:** cross-session visibility with GeminiHydra ([f49020c](https://github.com/EPS-AI-SOLUTIONS/ClaudeHydra/commit/f49020c3cdb0f78d032c11c908112ea2aa2ef77d))
* replace Ollama with Claude API — full backend + frontend migration ([026ca36](https://github.com/EPS-AI-SOLUTIONS/ClaudeHydra/commit/026ca36562fe41d7377fc2c551ab092c8e646fe4))
* restore Agents feature without sidebar navigation ([a83f8af](https://github.com/EPS-AI-SOLUTIONS/ClaudeHydra/commit/a83f8af04cfb018a5ee9034cc46917bdfba5490b))
* security hardening, dead code cleanup, i18n completeness, logo optimization ([29a0f94](https://github.com/EPS-AI-SOLUTIONS/ClaudeHydra/commit/29a0f949d3ddf79c7dbbc5afc5791b01f0940348))
* **sidebar:** align with Tissaia design — add i18n, language selector, simplify nav ([a18f84e](https://github.com/EPS-AI-SOLUTIONS/ClaudeHydra/commit/a18f84ed008438bf44ea021e4dbe1cd1907059b8))
* **tabs:** port browser-style tab system from GeminiHydra ([15c5e3d](https://github.com/EPS-AI-SOLUTIONS/ClaudeHydra/commit/15c5e3d0e303f9dee9e3e0de7f053c140d657a49))
* unit tests, health dashboard, PWA, dead export cleanup, DX improvements ([89a28d6](https://github.com/EPS-AI-SOLUTIONS/ClaudeHydra/commit/89a28d6039ca0fa6dfa1d3a02fb8b1a2395c0466))


### Performance Improvements

* vendor chunk splitting + selective highlight.js languages ([2de6162](https://github.com/EPS-AI-SOLUTIONS/ClaudeHydra/commit/2de6162af8f1fe0382a4361441db5d7ee2f23222))



