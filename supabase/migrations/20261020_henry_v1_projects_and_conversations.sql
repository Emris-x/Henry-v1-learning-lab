-- Additive Henry V1 project workspace schema.
-- Existing learning tables and data are not modified.

create table if not exists public.henry_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  goal text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists henry_projects_user_updated_idx on public.henry_projects(user_id, updated_at desc);
alter table public.henry_projects enable row level security;
drop policy if exists "users manage own Henry projects" on public.henry_projects;
create policy "users manage own Henry projects" on public.henry_projects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.henry_project_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.henry_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  mode text not null default 'Explore' check (mode in ('Explore','Teach','Build')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists henry_project_messages_project_created_idx on public.henry_project_messages(project_id, created_at asc);
alter table public.henry_project_messages enable row level security;
drop policy if exists "users manage own Henry project messages" on public.henry_project_messages;
create policy "users manage own Henry project messages" on public.henry_project_messages
for all using (
  auth.uid() = user_id and exists (
    select 1 from public.henry_projects p where p.id = project_id and p.user_id = auth.uid()
  )
)
with check (
  auth.uid() = user_id and exists (
    select 1 from public.henry_projects p where p.id = project_id and p.user_id = auth.uid()
  )
);
