# Henry V1 — Product Specification
Version 0.1 · Initial scope for clean rebuild

## Purpose
Henry is a mobile-first AI engineering companion that helps people turn ideas into real projects through concept exploration, technical teaching, engineering planning, and guided implementation.

## First usable milestone
A user can sign in, create a project, describe an idea, have a real AI-assisted engineering conversation, save decisions/context, and return later to continue.

## Must-have
- Mobile-first black/green interface and H emblem.
- Existing Supabase Auth for sign-up/sign-in.
- Projects with goal, status, and saved decisions.
- Conversation modes: Explore (clarify assumptions), Teach (explain concepts), Build (plan/implement tasks).
- Saved conversation history and project context, isolated per user.
- Honest loading, offline, provider error, and quota-limit states.
- Provider-neutral AI adapter; changing model provider must not require redesigning the app.

## Hybrid AI approach
**Online first:** select a suitable free-tier provider after a small comparison test. Free availability, limits, geographic/account eligibility, and terms may change.

**Provider-neutral adapter:** Henry's app sends mode, user message, bounded history, and relevant project context to a server-side endpoint. Provider-specific formats and model IDs remain behind the adapter.

**Security:** Never put model-provider secrets in browser JavaScript or Git. Use a server-side secret store and authenticated endpoint; validate input, limit request sizes, and return clear safe errors. The Supabase publishable key is not a provider secret.

**Local later:** preserve the same adapter contract for a future local model. Local inference is not a V1 dependency and must be performance-tested before promised.

**Cost controls:** use free tier only where available and terms-compliant; limit input/history size; avoid costly automatic retries; never silently switch to a paid provider.

## Out of scope for this milestone
Foundation-model training, autonomous background agents, arbitrary code execution on production infrastructure, auto-deployment of user projects, PDF/web ingestion pipelines, vector search, and unapproved paid API usage.

## Infrastructure to preserve
- GitHub: Emris-x/Henry-v1-learning-lab
- Branch: henry-clean-rebuild
- Supabase project ref: hokkvulwfowzjdgopnlk
- Existing Supabase Auth and tables: learning_tasks, knowledge_items, learning_events
- Existing Vercel project: henry-v1-learning-lab

Do not delete/reset production data, project settings, domains, or secrets. Inspect current schema first; prefer additive migrations.

## Implementation order
1. Agree scope and inspect the current code.
2. Replace the old UI on the rebuild branch with a project workspace and conversation shell.
3. Connect projects and conversation persistence to existing Supabase Auth/RLS.
4. Add a server-side AI endpoint and provider-neutral adapter.
5. Test authentication, persistence, provider errors, and user data isolation.
6. Deploy a preview, verify it, then consider production promotion.

## Acceptance criteria
- Build succeeds and the interface works on narrow mobile screens.
- Users can sign in/out, create a project, and save/restore conversations.
- A configured free-tier provider produces real responses through a server-side endpoint.
- Provider secrets are absent from client bundles and repository files.
- Users cannot read/write another user's data.
- Missing keys, quotas, and network failures are clearly reported.
- Existing production resources remain intact.

## Known constraint
Free AI access is not guaranteed, may be rate-limited, and may have restrictions on use and data. The project workspace should remain usable when AI generation is unavailable.
