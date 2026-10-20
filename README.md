# Henry V1 — Learning Lab

Mobile-first PWA for tracking learning objectives, storing knowledge notes, and keeping a learning journal. Henry V1 is a learning-workspace foundation, not a trained foundation model.

## Deployment
- Production app: https://henry-v1-learning-lab.vercel.app
- Supabase project: `hokkvulwfowzjdgopnlk`
- Supabase schema: `supabase/schema.sql`
- Public browser configuration: `supabase-config.js` (contains only the project URL and publishable key; never place a service-role key in client code).

## Current capabilities
- Mobile-first black/green dashboard and installable PWA shell
- Create learning objectives and manually record progress
- Save and search knowledge notes; import text/Markdown/code files
- Learning journal and JSON export
- Local browser persistence for offline/fallback use
- Supabase email/password sign-up and sign-in
- Signed-in users can sync objectives, knowledge notes and journal entries to their own account
- Row Level Security is enabled on the three data tables so users can access only rows owned by their account

## Current limitations
- No language model is connected yet; the Learning Chat saves teaching notes rather than generating model responses.
- No automated web-research worker, PDF extraction, or background task runner yet.
- Objective progress remains manually recorded.
- Cloud sync requires an account and an internet connection. Local browser data remains on the device until a signed-in sync occurs.
- If Supabase email confirmation is enabled, users must confirm their email before password sign-in.

## Build
`npm install` then `npm run build`.
