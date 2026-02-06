# Pincer

**AI/LLM Red Team Suite** — A web-based security testing toolkit for probing, auditing, and stress-testing AI language models against prompt injection, jailbreaks, data extraction, and guardrail bypasses.

Point Pincer at any LLM API endpoint, select your attack modules, and run automated red team assessments with real-time streaming results, heuristic analysis, and exportable reports.

## Features

- **100+ Attack Payloads** across 4 categories: Prompt Injection, Jailbreak, Data Extraction, Guardrail Bypass
- **Model-Specific Attacks** targeting GPT, Claude, and Llama architectures alongside universal payloads
- **Heuristic Response Analysis** — classifies responses (refusal, partial compliance, full jailbreak, information leakage) with severity scoring, confidence levels, and leaked data extraction — no LLM-based grading required
- **Attack Chaining** — multi-step sequential attacks with conversation history, template variables, and response transforms (context poisoning, gradual escalation, trust building chains)
- **Payload Variant Generator** — 20 transform types across 6 categories (case manipulation, unicode homoglyphs, encoding tricks, whitespace injection, separator obfuscation, language mixing)
- **Custom Payload Editor** with syntax highlighting, tag management, and integrated variant generation
- **Session Persistence** — auto-save to localStorage, full export/import with merge support, storage management
- **Real-Time Streaming** — NDJSON streaming from API routes for live result updates during attack runs
- **Multi-Provider Support** — OpenAI, Anthropic, OpenRouter, or any OpenAI-compatible endpoint
- **Report Generation** — Markdown export with executive summary, technical findings, severity breakdown, and remediation recommendations

## Tech Stack

- **Framework:** Next.js 16 (App Router) + React 19
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS 4 + shadcn/ui
- **State:** Zustand with persist middleware
- **Icons:** Lucide React

## Getting Started

```bash
# Install dependencies
npm ci

# Run development server
npm run dev

# Build for production
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000) to access the Pincer dashboard.

## Usage

1. **Configure a Target** — Add an LLM API endpoint (URL, API key, model name, provider)
2. **Select Attack Categories** — Check the categories you want to test (Injection, Jailbreak, Extraction, Bypass)
3. **Run Attack** — Hit the RUN button to stream attacks against the target
4. **Review Results** — Analyze responses with heuristic classification, severity scores, and leaked data highlights
5. **Generate Report** — Export findings as a Markdown report

### Advanced

- **Attack Chains** — Build multi-step attack sequences that feed previous responses into subsequent prompts
- **Payload Editor** — Create custom payloads with syntax highlighting and generate variants automatically
- **Session Management** — Export/import full session data for collaboration or archival

## Project Structure

```
src/
├── app/
│   ├── page.tsx                  # Main app shell with view routing
│   ├── layout.tsx                # Root layout with theme provider
│   ├── globals.css               # Tailwind + custom color tokens
│   └── api/
│       ├── attack/route.ts       # Attack execution (NDJSON streaming)
│       ├── chain/route.ts        # Chain execution (sequential steps)
│       └── test-connection/route.ts
├── components/
│   ├── sidebar.tsx               # Navigation + target list + run button
│   ├── target-config.tsx         # LLM endpoint configuration
│   ├── attack-modules.tsx        # Payload browser by category
│   ├── results-dashboard.tsx     # Run results with analysis display
│   ├── report-generator.tsx      # Markdown report export
│   ├── chain-builder.tsx         # Multi-step chain editor + runner
│   ├── session-manager.tsx       # Export/import/storage management
│   ├── payload-editor.tsx        # Custom payload editor + variants
│   └── ui/                       # shadcn/ui components
└── lib/
    ├── store.ts                  # Zustand store (persisted)
    ├── types.ts                  # All TypeScript types
    ├── llm-client.ts             # Multi-provider LLM client
    ├── analysis.ts               # Heuristic response analysis engine
    ├── chains.ts                 # Attack chain definitions + helpers
    ├── persistence.ts            # Session export/import utilities
    ├── variants.ts               # Payload variant generator
    └── attacks/
        ├── index.ts              # Payload aggregation + query helpers
        ├── injection.ts          # 25 prompt injection payloads
        ├── jailbreak.ts          # 25 jailbreak payloads
        ├── extraction.ts         # 25 data extraction payloads
        └── bypass.ts             # 25 guardrail bypass payloads
```

## Disclaimer

Pincer is designed for **authorized security testing and research only**. Use it to audit AI systems you own or have explicit permission to test. Do not use this tool against systems without authorization. The authors are not responsible for misuse.

## License

MIT
