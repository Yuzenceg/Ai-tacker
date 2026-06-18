-- AI Tracker — Supabase Schema with Full Auth & RLS
-- Run this in Supabase Dashboard > SQL Editor.
-- NOTE: If you have existing data without a user_id, you will need to manually
-- assign a user_id to those rows after adding the column.

create extension if not exists pgcrypto;

-- ============================================================
-- Profiles table (display name + avatar)
-- ============================================================

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    display_name text,
    avatar_url text,
    updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users read own profile" on public.profiles;
drop policy if exists "Users insert own profile" on public.profiles;
drop policy if exists "Users update own profile" on public.profiles;

create policy "Users read own profile"
    on public.profiles for select
    using (auth.uid() = id);

create policy "Users insert own profile"
    on public.profiles for insert
    with check (auth.uid() = id);

create policy "Users update own profile"
    on public.profiles for update
    using (auth.uid() = id)
    with check (auth.uid() = id);

-- Auto-create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.profiles (id, display_name)
    values (new.id, split_part(new.email, '@', 1));
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();

-- ============================================================
-- Goals table
-- ============================================================

create table if not exists public.goals (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null,
    target_date date not null,
    is_completed boolean not null default false,
    created_at timestamptz not null default now()
);

alter table public.goals enable row level security;

drop policy if exists "Public read goals" on public.goals;
drop policy if exists "Public insert goals" on public.goals;
drop policy if exists "Public update goals" on public.goals;
drop policy if exists "Public delete goals" on public.goals;
drop policy if exists "Users read own goals" on public.goals;
drop policy if exists "Users insert own goals" on public.goals;
drop policy if exists "Users update own goals" on public.goals;
drop policy if exists "Users delete own goals" on public.goals;

create policy "Users read own goals"
    on public.goals for select
    using (auth.uid() = user_id);

create policy "Users insert own goals"
    on public.goals for insert
    with check (auth.uid() = user_id);

create policy "Users update own goals"
    on public.goals for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users delete own goals"
    on public.goals for delete
    using (auth.uid() = user_id);

-- ============================================================
-- Notes table
-- ============================================================

create table if not exists public.notes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    content text not null,
    target_date date not null,
    created_at timestamptz not null default now()
);

alter table public.notes enable row level security;

drop policy if exists "Public read notes" on public.notes;
drop policy if exists "Public insert notes" on public.notes;
drop policy if exists "Public update notes" on public.notes;
drop policy if exists "Public delete notes" on public.notes;
drop policy if exists "Users read own notes" on public.notes;
drop policy if exists "Users insert own notes" on public.notes;
drop policy if exists "Users update own notes" on public.notes;
drop policy if exists "Users delete own notes" on public.notes;

create policy "Users read own notes"
    on public.notes for select
    using (auth.uid() = user_id);

create policy "Users insert own notes"
    on public.notes for insert
    with check (auth.uid() = user_id);

create policy "Users update own notes"
    on public.notes for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users delete own notes"
    on public.notes for delete
    using (auth.uid() = user_id);

-- ============================================================
-- Memories table
-- ============================================================

create table if not exists public.memories (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    content text not null,
    target_date date not null,
    created_at timestamptz not null default now()
);

alter table public.memories enable row level security;

drop policy if exists "Public read memories" on public.memories;
drop policy if exists "Public insert memories" on public.memories;
drop policy if exists "Public update memories" on public.memories;
drop policy if exists "Public delete memories" on public.memories;
drop policy if exists "Users read own memories" on public.memories;
drop policy if exists "Users insert own memories" on public.memories;
drop policy if exists "Users update own memories" on public.memories;
drop policy if exists "Users delete own memories" on public.memories;

create policy "Users read own memories"
    on public.memories for select
    using (auth.uid() = user_id);

create policy "Users insert own memories"
    on public.memories for insert
    with check (auth.uid() = user_id);

create policy "Users update own memories"
    on public.memories for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users delete own memories"
    on public.memories for delete
    using (auth.uid() = user_id);

-- ============================================================
-- Storage: memories bucket (scoped per user)
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'memories',
    'memories',
    false,
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
drop policy if exists "Users read own memory images" on storage.objects;
drop policy if exists "Users upload own memory images" on storage.objects;
drop policy if exists "Users update own memory images" on storage.objects;
drop policy if exists "Users delete own memory images" on storage.objects;

create policy "Users read own memory images"
    on storage.objects for select
    using (bucket_id = 'memories' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users upload own memory images"
    on storage.objects for insert
    with check (bucket_id = 'memories' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users update own memory images"
    on storage.objects for update
    using (bucket_id = 'memories' and auth.uid()::text = (storage.foldername(name))[1])
    with check (bucket_id = 'memories' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users delete own memory images"
    on storage.objects for delete
    using (bucket_id = 'memories' and auth.uid()::text = (storage.foldername(name))[1]);
