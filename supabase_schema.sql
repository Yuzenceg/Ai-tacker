-- AI Goals Tracker Supabase setup
-- Run this in Supabase Dashboard > SQL Editor for the project used by this app.

create extension if not exists pgcrypto;

-- App tables ---------------------------------------------------------------

create table if not exists public.goals (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    target_date date not null,
    is_completed boolean not null default false,
    created_at timestamptz not null default now()
);

create table if not exists public.notes (
    id uuid primary key default gen_random_uuid(),
    content text not null,
    target_date date not null,
    created_at timestamptz not null default now()
);

create table if not exists public.memories (
    id uuid primary key default gen_random_uuid(),
    content text not null,
    target_date date not null,
    created_at timestamptz not null default now()
);

alter table public.goals enable row level security;
alter table public.notes enable row level security;
alter table public.memories enable row level security;

drop policy if exists "Public read goals" on public.goals;
drop policy if exists "Public insert goals" on public.goals;
drop policy if exists "Public update goals" on public.goals;
drop policy if exists "Public delete goals" on public.goals;
create policy "Public read goals" on public.goals for select using (true);
create policy "Public insert goals" on public.goals for insert with check (true);
create policy "Public update goals" on public.goals for update using (true) with check (true);
create policy "Public delete goals" on public.goals for delete using (true);

drop policy if exists "Public read notes" on public.notes;
drop policy if exists "Public insert notes" on public.notes;
drop policy if exists "Public update notes" on public.notes;
drop policy if exists "Public delete notes" on public.notes;
create policy "Public read notes" on public.notes for select using (true);
create policy "Public insert notes" on public.notes for insert with check (true);
create policy "Public update notes" on public.notes for update using (true) with check (true);
create policy "Public delete notes" on public.notes for delete using (true);

drop policy if exists "Public read memories" on public.memories;
drop policy if exists "Public insert memories" on public.memories;
drop policy if exists "Public update memories" on public.memories;
drop policy if exists "Public delete memories" on public.memories;
create policy "Public read memories" on public.memories for select using (true);
create policy "Public insert memories" on public.memories for insert with check (true);
create policy "Public update memories" on public.memories for update using (true) with check (true);
create policy "Public delete memories" on public.memories for delete using (true);

-- Public image bucket ------------------------------------------------------
-- The frontend uploads journal photos to storage bucket: memories/uploads/...

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'memories',
    'memories',
    true,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read memory images" on storage.objects;
drop policy if exists "Public upload memory images" on storage.objects;
drop policy if exists "Public update memory images" on storage.objects;
drop policy if exists "Public delete memory images" on storage.objects;

create policy "Public read memory images"
on storage.objects for select
using (bucket_id = 'memories');

create policy "Public upload memory images"
on storage.objects for insert
with check (bucket_id = 'memories');

create policy "Public update memory images"
on storage.objects for update
using (bucket_id = 'memories')
with check (bucket_id = 'memories');

create policy "Public delete memory images"
on storage.objects for delete
using (bucket_id = 'memories');
