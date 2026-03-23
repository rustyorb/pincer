# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

RedPincer is an AI/LLM red-teaming suite for testing model safety. It sends attack payloads (prompt injection, jailbreak, extraction, bypass) to LLM endpoints, analyzes responses with a heuristic engine, and reports vulnerabilities. Built for authorized security testing only.

## Commands

```bash
npm run dev      # Start dev server (http://localhost:3000)
npm run build    # Production build
npm run start    # Serve production build
npm run lint     # ESLint (v9 flat config)
```

Docker: `docker build -t redpincer . && docker run -p 3000:3000 redpincer`

**Testing:** Vitest + jsdom. Run `npm test` (single run), `npm run test:watch` (watch mode), `npm run test:coverage` (with coverage). Tests live in `src/lib/__tests__/`. Use `npm ci` (not `npm install`) to respect the lockfile.

## Architecture

**Stack:** Next.js 16 + React 19 + TypeScript (strict) + Tailwind CSS 4 + shadcn/ui (new-york style) + Zustand 5

**All components are client-side** (`"use client"` directive). There are no server components. The app uses a single-page layout where `src/app/page.tsx` switches views based on `store.view` state. Views: `config | attacks | results | reports | chains | session | editor | comparison | adaptive | heatmap | regression | scoring`

### Data Flow

1. User configures LLM target (endpoint, API key, model, provider) in `TargetConfig`
2. User selects attack categories/payloads and hits RUN
3. `POST /api/attack` streams NDJSON — one `AttackResult` per payload
4. Each result includes heuristic `AnalysisResult` (pattern-matching, no LLM grading)
5. Results stored in Zustand → persisted to localStorage (`"redpincer-state"`)

### Key Modules

| Module | Purpose |
|---|---|
| `src/lib/store.ts` | Zustand store (`useStore` hook) with persist middleware. Persisted via `partialize`: targets, activeTargetId, selectedCategories, runs, activeRunId. NOT persisted: view, isRunning. |
| `src/lib/types.ts` | All TypeScript interfaces and enums. Core types: `TargetConfig`, `AttackPayload`, `AttackResult`, `AnalysisResult`, `AttackRun`, `AttackChain` |
| `src/lib/llm-client.ts` | Multi-provider client. OpenAI/OpenRouter use chat.completions format; Anthropic uses Messages API with top-level `system` param. 30s timeout. |
| `src/lib/analysis.ts` | Heuristic response classifier with refusal, compliance, explanation, and hedging pattern detection. Context-aware analysis prevents false positives (e.g., decoding base64 + refusing = refusal, not breach). Outputs classification + severity score (1-10) + confidence (0-1). |
| `src/lib/chains.ts` | Sequential multi-step attacks. Steps support `{{previous_response}}` and `{{step:stepId}}` template variables. Response transforms: full, extract_json, extract_code, first_line, last_paragraph. |
| `src/lib/variants.ts` | 20 payload transformations (case, unicode homoglyphs, base64, ROT13, leetspeak, zero-width spaces, etc.) |
| `src/lib/attacks/*.ts` | 160 payloads (40 per category) with id format `inj-001`, `jb-001`, `ext-001`, `byp-001` |
| `src/lib/adaptive.ts` | Weakness analysis engine — examines run results to identify vulnerability patterns and generate follow-up strategies |
| `src/lib/scoring.ts` | Custom scoring rubric system — weighted scoring by category, severity, classification with letter grades |

### API Routes

- `POST /api/attack` — Streams attack results as NDJSON. Supports AbortController for stop functionality. Accepts `{endpoint, apiKey, model, provider, categories?, payloadIds?}`
- `POST /api/chain` — Executes chain steps sequentially with template resolution
- `POST /api/test-connection` — Validates LLM endpoint connectivity
- `POST /api/models` — Fetches available models from provider API (OpenAI, Anthropic hardcoded list, OpenRouter)
- `POST /api/generate-payload` — Uses target LLM to generate new attack payloads via meta-prompting

### Styling

- Dark mode is hardcoded (`.dark` class on `<html>`)
- Custom OKLCH color tokens in `src/app/globals.css`: `redpincer` (red), `lobster` (orange), `success` (green), `warning` (yellow)
- Use `cn()` from `src/lib/utils.ts` (clsx + tailwind-merge) for conditional classes
- Icons from `lucide-react`, toasts from `sonner`

### Authentication

Auth is **opt-in** via environment variables. When `PINCER_USERNAME` and `PINCER_PASSWORD` are both set, all routes are protected by session-based auth with HMAC-signed cookies. Set `PINCER_AUTH_DISABLED=true` to explicitly disable. See `.env.example`.

| Module | Purpose |
|---|---|
| `src/lib/auth.ts` | Core auth logic — credential validation (timing-safe), HMAC session tokens, config |
| `src/lib/use-auth.ts` | Client-side React hook for auth status + logout |
| `src/middleware.ts` | Next.js middleware — redirects unauthenticated requests to `/login`, returns 401 for API routes |
| `src/app/login/page.tsx` | Login page with form |
| `src/app/api/auth/login/route.ts` | POST — validates credentials, sets httpOnly session cookie |
| `src/app/api/auth/logout/route.ts` | POST — clears session cookie |
| `src/app/api/auth/status/route.ts` | GET — returns auth state (enabled, authenticated, username) |

### Rate Limiting

All API routes are rate-limited via in-memory sliding window (enforced in `src/middleware.ts`). Always active — no configuration needed. Resets on server restart.

| Tier | Routes | Limit |
|---|---|---|
| `auth` | `/api/auth/*` | 5 req / 60s (brute-force protection) |
| `attack` | `/api/attack`, `/api/chain`, `/api/generate-adaptive` | 10 req / 60s |
| `api` | All other `/api/*` | 30 req / 60s |

Rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`) are included on all API responses. 429 responses include `retryAfter` in the JSON body.

| Module | Purpose |
|---|---|
| `src/lib/rate-limit.ts` | Rate limiter class, tier config, route-to-tier mapping, client key extraction, header helpers |

## Conventions

- Path alias: `@/*` maps to `./src/*`
- Use `import type` for TypeScript-only imports
- shadcn/ui components live in `src/components/ui/` — add new ones via `npx shadcn add <component>`
- Provider enum values: `"openai" | "anthropic" | "openrouter" | "custom"`
- Attack categories: `"injection" | "jailbreak" | "extraction" | "bypass"`
