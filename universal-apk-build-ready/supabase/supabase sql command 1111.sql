-- ==============================================================================
-- UNIVERSAL — SUPABASE SQL COMMAND 1111 (COMPREHENSIVE AUDIT & REPAIR SCRIPT)
-- Safe, Idempotent, and Non-Destructive Database Synchronization
-- ==============================================================================
-- Run this script in the Supabase SQL Editor:
-- Dashboard -> SQL Editor -> New Query -> Paste & Run.
-- ==============================================================================

-- 1. Ensure required extensions exist
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- 2. Core Security & Membership Helper Function
-- CRITICAL: Preserves signature (p_conversation_id uuid, p_user_id uuid)
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

-- 4. Conversations Table RLS Update Policy
-- Fix: Ensure members can update conversation updated_at without RLS errors
drop policy if exists "Members can update conversations" on public.conversations;
create policy "Members can update conversations"
  on public.conversations for update
  to authenticated
  using (public.is_member_of(id, auth.uid()))
  with check (public.is_member_of(id, auth.uid()));

-- 5. Helper Function: Get or Create Private 1-to-1 Conversation
create or replace function public.get_or_create_conversation(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_user_id uuid := auth.uid();
  v_conv_id uuid;
begin
  if v_current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_current_user_id = p_other_user_id then
    raise exception 'Cannot create a conversation with yourself';
  end if;

  -- Look for an existing 2-person conversation with exactly these two users
  select cm1.conversation_id into v_conv_id
  from public.conversation_members cm1
  join public.conversation_members cm2 on cm1.conversation_id = cm2.conversation_id
  where cm1.user_id = v_current_user_id
    and cm2.user_id = p_other_user_id
    and (select count(*) from public.conversation_members cm3 where cm3.conversation_id = cm1.conversation_id) = 2
  limit 1;

  if v_conv_id is not null then
    return v_conv_id;
  end if;

  -- Otherwise create a new conversation
  insert into public.conversations (created_at, updated_at)
  values (now(), now())
  returning id into v_conv_id;

  -- Add both members
  insert into public.conversation_members (conversation_id, user_id, joined_at, last_read_at)
  values
    (v_conv_id, v_current_user_id, now(), now()),
    (v_conv_id, p_other_user_id, now(), now());

  return v_conv_id;
end;
$$;

grant execute on function public.get_or_create_conversation(uuid) to authenticated;

-- 7. Safe Column Constraints & Defaults
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'drive_files' and column_name = 'file_type') then
    alter table public.drive_files alter column file_type set default 'application/octet-stream';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'messages' and column_name = 'content') then
    alter table public.messages alter column content drop not null;
    alter table public.messages alter column content set default '';
  end if;
end $$;
-- Ensure replica identity is FULL so Supabase Realtime sends full payloads on changes
alter table public.messages replica identity full;
alter table public.conversations replica identity full;
alter table public.conversation_members replica identity full;
alter table public.profiles replica identity full;
alter table public.user_device_registrations replica identity full;

-- Safely add tables to publication if publication exists
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
  t record;
  target_tables text[] := array[
    'messages',
    'conversations',
    'conversation_members',
    'profiles',
    'user_device_registrations',
    'statuses',
    'message_reactions',
    'calls'
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
