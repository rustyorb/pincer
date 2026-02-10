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

No test framework is configured. Use `npm ci` (not `npm install`) to respect the lockfile.

## Architecture

**Stack:** Next.js 16 + React 19 + TypeScript (strict) + Tailwind CSS 4 + shadcn/ui (new-york style) + Zustand 5

**All components are client-side** (`"use client"` directive). There are no server components. The app uses a single-page layout where `src/app/page.tsx` switches views based on `store.view` state.

### Data Flow

1. User configures LLM target (endpoint, API key, model, provider) in `TargetConfig`
2. User selects attack categories/payloads and hits RUN
3. `POST /api/attack` streams NDJSON — one `AttackResult` per payload
4. Each result includes heuristic `AnalysisResult` (pattern-matching, no LLM grading)
5. Results stored in Zustand → persisted to localStorage (`"redpincer-state"`)

### Key Modules

| Module | Purpose |
|---|---|
| `src/lib/store.ts` | Zustand store with persist middleware. UI state (view, isRunning) is NOT persisted; data state (targets, runs, categories) IS persisted. |
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

## Conventions

- Path alias: `@/*` maps to `./src/*`
- Use `import type` for TypeScript-only imports
- shadcn/ui components live in `src/components/ui/` — add new ones via `npx shadcn add <component>`
- Provider enum values: `"openai" | "anthropic" | "openrouter" | "custom"`
- Attack categories: `"injection" | "jailbreak" | "extraction" | "bypass"`
