# FarmTwin frontend

Responsive FarmTwin landing page and workspace foundation built with TypeScript,
React, Vinext, and the shared Shadcn controls.

## Local development

1. Copy `.env.example` to `.env.local`.
2. Start the FastAPI backend on the configured API origin.
3. Run `npm run dev`.

Without `NEXT_PUBLIC_FARMTWIN_API_URL`, the workspace intentionally shows a
connection-required state. It never substitutes fabricated farm or provider data.

## Routes

- `/` — public landing page
- `/app` — API-backed overview and onboarding
- `/app/farms/new` — Phase 4 prerequisite explanation
- `/app/tools/:tool` — gated farm-tool explanations
- `/app/data-sources` — API-backed provider status
- `/app/settings` — connection and trust-boundary status
- `/app/project` — architecture and evidence-based phase roadmap

Run `npm run build` before publication.
