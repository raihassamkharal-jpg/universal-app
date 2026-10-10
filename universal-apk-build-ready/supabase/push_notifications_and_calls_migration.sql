-- ==============================================================================
-- UNIVERSAL — PUSH NOTIFICATIONS & INCOMING CALL SYSTEM MIGRATION
-- Safe, Idempotent, and Non-Destructive Database Synchronization
-- ==============================================================================
-- Run this script in the Supabase SQL Editor:
-- Dashboard -> SQL Editor -> New Query -> Paste & Run.
-- ==============================================================================

-- 1. Ensure required extensions exist
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- 2. Core Security & Membership Helper Function
-- Preserves signature (p_conversation_id uuid, p_user_id uuid)
create or replace function public.is_member_of(p_conversation_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from public.conversation_members
    where conversation_id = p_conversation_id
      and user_id = p_user_id
  );
$$;

grant execute on function public.is_member_of(uuid, uuid) to authenticated, anon;

-- 3. Device Registrations & Push Notification Subscriptions Table
create table if not exists public.user_device_registrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  device_type text default 'pwa',
  is_active boolean default true not null,
  last_active_at timestamptz default timezone('utc'::text, now()) not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null,
  constraint unique_user_endpoint unique (user_id, endpoint)
);

create index if not exists idx_device_reg_user on public.user_device_registrations (user_id);
create index if not exists idx_device_reg_active on public.user_device_registrations (user_id, is_active, last_active_at);

-- Enable Row Level Security on user_device_registrations
alter table public.user_device_registrations enable row level security;

-- RLS Policies for user_device_registrations
drop policy if exists "Users can view own device registrations" on public.user_device_registrations;
create policy "Users can view own device registrations"
  on public.user_device_registrations for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can insert own device registrations" on public.user_device_registrations;
create policy "Users can insert own device registrations"
  on public.user_device_registrations for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update own device registrations" on public.user_device_registrations;
create policy "Users can update own device registrations"
  on public.user_device_registrations for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete own device registrations" on public.user_device_registrations;
create policy "Users can delete own device registrations"
  on public.user_device_registrations for delete
  to authenticated
  using (user_id = auth.uid());

-- Helper function: Check if target user has registered active push endpoints
create or replace function public.is_user_call_reachable(p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 
    from public.user_device_registrations
    where user_id = p_user_id
      and is_active = true
      and last_active_at >= (now() - interval '30 days')
  );
$$;

grant execute on function public.is_user_call_reachable(uuid) to authenticated;

-- 4. Authoritative Calls Table Schema and Enhancements
create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete set null,
  caller_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  call_type text default 'audio' not null check (call_type in ('audio', 'video')),
  status text default 'calling' not null check (status in ('calling', 'ringing', 'accepted', 'connected', 'rejected', 'missed', 'busy', 'ended', 'failed', 'cancelled')),
  duration_seconds integer default 0,
  duration integer default 0,
  sdp_offer text,
  started_at timestamptz default timezone('utc'::text, now()) not null,
  answered_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Upgrade existing calls table columns if already present
alter table public.calls add column if not exists sdp_offer text;
alter table public.calls add column if not exists duration_seconds integer default 0;
alter table public.calls add column if not exists duration integer default 0;
alter table public.calls add column if not exists started_at timestamptz default timezone('utc'::text, now());
alter table public.calls add column if not exists answered_at timestamptz;
alter table public.calls add column if not exists ended_at timestamptz;

create index if not exists idx_calls_caller on public.calls (caller_id);
create index if not exists idx_calls_receiver on public.calls (receiver_id);
create index if not exists idx_calls_status on public.calls (status);
create index if not exists idx_calls_created on public.calls (created_at desc);

-- Enable RLS on calls
alter table public.calls enable row level security;

-- Call participants can view call records
drop policy if exists "Call participants can view calls" on public.calls;
create policy "Call participants can view calls"
  on public.calls for select
  to authenticated
  using (caller_id = auth.uid() or receiver_id = auth.uid());

-- Callers can initiate calls
drop policy if exists "Callers can insert calls" on public.calls;
create policy "Callers can insert calls"
  on public.calls for insert
  to authenticated
  with check (caller_id = auth.uid());

-- Call participants can update call state (e.g. answer, reject, end)
drop policy if exists "Participants can update calls" on public.calls;
create policy "Participants can update calls"
  on public.calls for update
  to authenticated
  using (caller_id = auth.uid() or receiver_id = auth.uid())
  with check (caller_id = auth.uid() or receiver_id = auth.uid());

-- 5. Enable Replica Identity and Realtime Subscriptions
alter table public.calls replica identity full;
alter table public.user_device_registrations replica identity full;

do $$
declare
  pub_exists boolean;
begin
  select exists (select 1 from pg_publication where pubname = 'supabase_realtime') into pub_exists;
  if not pub_exists then
    create publication supabase_realtime;
  end if;
end $$;

do $$
declare
  target_tables text[] := array[
    'calls',
    'user_device_registrations'
  ];
  tbl text;
begin
  foreach tbl in array target_tables loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = tbl) then
      if not exists (
        select 1 from pg_publication_tables 
        where pubname = 'supabase_realtime' 
          and schemaname = 'public' 
          and tablename = tbl
      ) then
        execute format('alter publication supabase_realtime add table public.%I', tbl);
      end if;
    end if;
  end loop;
end $$;
