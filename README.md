# Henry V1 — Learning Lab

Mobile-first PWA foundation for tracking learning objectives and storing notes. This is not a trained foundation model. The first version stores user knowledge locally; autonomous AI research, PDF extraction and background jobs must be connected in later milestones.

## Deploy
Import this repository into Vercel and deploy as a static Vite project. Supabase schema is in `supabase/schema.sql`. No secret API keys belong in browser code.

## Current capabilities
- Mobile-first black/green dashboard
- Learning objectives with manually recorded progress
- Notes and searchable knowledge library
- Learning journal and JSON export
- Local browser persistence and PWA install manifest

## Honest limitations
No language model, live web-search worker, PDF parser, or persistent cloud sync is connected yet. Progress is manual until real task workers are implemented. Local browser data does not automatically sync between devices.
