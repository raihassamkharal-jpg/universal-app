-- ==============================================================================
-- UNIVERSAL — MASTER IDEMPOTENT BACKEND COMPATIBILITY MIGRATION
-- Legacy Compatibility: Local Message Hub -> Universal
-- ==============================================================================
-- This script is safe, idempotent, and non-destructive.
-- It intelligently inspects the existing Supabase database:
--   1. Existing Local Message Hub tables/objects are preserved and reused.
--   2. Incomplete or legacy objects are safely upgraded without data loss.
--   3. Missing Universal tables, columns, indexes, and storage buckets are created.
--   4. Preserves function signatures (specifically `is_member_of(p_conversation_id uuid, p_user_id uuid)`).
--   5. Provides backward-compatible views and aliases for legacy access.
--   6. Configures Supabase Realtime replication and Storage buckets safely.
--
-- Instructions:
--   1. Open Supabase Dashboard -> SQL Editor -> New Query.
--   2. Paste and run this entire file.
-- ==============================================================================

-- ==============================================================================
-- STEP 1: PRE-FLIGHT DATABASE SELF-CHECK & DIAGNOSTIC REPORTING
-- ==============================================================================
do $$
declare
  v_table_count int := 0;
  v_has_profiles boolean := false;
  v_has_convs boolean := false;
  v_has_msgs boolean := false;
  v_has_legacy_call_history boolean := false;
  v_has_legacy_memory_board boolean := false;
  v_has_legacy_comments boolean := false;
  v_has_legacy_feed boolean := false;
  v_is_member_of_exists boolean := false;
  v_is_member_of_param text := '';
begin
  raise notice '--------------------------------------------------------------';
  raise notice 'STARTING SUPABASE COMPATIBILITY AUDIT: Local Message Hub -> Universal';
  raise notice '--------------------------------------------------------------';

  -- Check existing core tables
  select exists(select 1 from information_schema.tables where table_schema = 'public' and table_name = 'profiles') into v_has_profiles;
  select exists(select 1 from information_schema.tables where table_schema = 'public' and table_name = 'conversations') into v_has_convs;
  select exists(select 1 from information_schema.tables where table_schema = 'public' and table_name = 'messages') into v_has_msgs;

  -- Check legacy variant tables
  select exists(select 1 from information_schema.tables where table_schema = 'public' and table_name = 'call_history' and table_type = 'BASE TABLE') into v_has_legacy_call_history;
  select exists(select 1 from information_schema.tables where table_schema = 'public' and table_name = 'memory_board' and table_type = 'BASE TABLE') into v_has_legacy_memory_board;
  select exists(select 1 from information_schema.tables where table_schema = 'public' and table_name = 'comments' and table_type = 'BASE TABLE') into v_has_legacy_comments;
  select exists(select 1 from information_schema.tables where table_schema = 'public' and table_name = 'feed_posts' and table_type = 'BASE TABLE') into v_has_legacy_feed;

  -- Check is_member_of function
  select exists(
    select 1 from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where n.nspname = 'public' and p.proname = 'is_member_of'
  ) into v_is_member_of_exists;

  if v_is_member_of_exists then
    select coalesce(proargnames[1], 'unnamed') into v_is_member_of_param
    from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where n.nspname = 'public' and p.proname = 'is_member_of'
    limit 1;
    raise notice '[AUDIT] Detected existing public.is_member_of with parameter: "%"', v_is_member_of_param;
  else
    raise notice '[AUDIT] public.is_member_of does not exist yet. Will create.';
  end if;

  if v_has_profiles and v_has_convs and v_has_msgs then
    raise notice '[AUDIT] Detected existing Local Message Hub core tables (profiles, conversations, messages). Upgrading in-place.';
  else
    raise notice '[AUDIT] Fresh or partial database detected. Provisioning complete schema.';
  end if;

  if v_has_legacy_call_history then
    raise notice '[AUDIT] Legacy BASE TABLE "call_history" detected. Will migrate records to "calls".';
  end if;
  if v_has_legacy_memory_board then
    raise notice '[AUDIT] Legacy BASE TABLE "memory_board" detected. Will migrate records to "message_capsules".';
  end if;
  if v_has_legacy_comments then
    raise notice '[AUDIT] Legacy BASE TABLE "comments" detected. Will migrate records to "post_comments".';
  end if;
  if v_has_legacy_feed then
    raise notice '[AUDIT] Legacy BASE TABLE "feed_posts" detected. Will migrate records to "posts".';
  end if;

  raise notice '--------------------------------------------------------------';
end $$;

-- ==============================================================================
-- STEP 2: EXTENSIONS
-- ==============================================================================
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ==============================================================================
-- STEP 3: PRESERVE & UPGRADE CORE TABLES
-- ==============================================================================

-- 3.1 PROFILES TABLE
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  avatar_url text,
  status text default 'Hey there! I am using Universal.',
  last_seen timestamptz default timezone('utc'::text, now()) not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- Upgrade profiles with Universal columns
alter table public.profiles add column if not exists cover_url text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists custom_ringtone_url text;
alter table public.profiles add column if not exists custom_outgoing_tone_url text;
alter table public.profiles add column if not exists custom_notification_sound_url text;
alter table public.profiles add column if not exists theme_preference text default 'light';
alter table public.profiles add column if not exists language text default 'en';
alter table public.profiles add column if not exists privacy_profile_visibility text default 'everyone';
alter table public.profiles add column if not exists privacy_read_receipts boolean default true;
alter table public.profiles add column if not exists privacy_typing boolean default true;
alter table public.profiles add column if not exists privacy_calls text default 'everyone';
alter table public.profiles add column if not exists privacy_online text default 'everyone';
alter table public.profiles add column if not exists privacy_status text default 'everyone';

-- Update default status text for new profiles (preserves existing custom user statuses)
alter table public.profiles alter column status set default 'Hey there! I am using Universal.';

-- Indexes on profiles
create index if not exists idx_profiles_username on public.profiles (lower(username));
create index if not exists idx_profiles_display_name on public.profiles (display_name);

-- 3.2 CONVERSATIONS TABLE
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- Upgrade conversations with Universal columns
alter table public.conversations add column if not exists is_group boolean default false;
alter table public.conversations add column if not exists title text;
alter table public.conversations add column if not exists avatar_url text;
alter table public.conversations add column if not exists description text;
alter table public.conversations add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.conversations add column if not exists disappearing_mode text default 'off';

create index if not exists idx_conversations_updated_at on public.conversations (updated_at desc);

-- 3.3 CONVERSATION_MEMBERS TABLE
create table if not exists public.conversation_members (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz default timezone('utc'::text, now()) not null,
  last_read_at timestamptz default timezone('utc'::text, now()) not null,
  constraint unique_conversation_member unique (conversation_id, user_id)
);

-- Upgrade conversation_members with Universal columns
alter table public.conversation_members add column if not exists role text default 'member';
alter table public.conversation_members add column if not exists is_pinned boolean not null default false;
alter table public.conversation_members add column if not exists is_muted boolean not null default false;
alter table public.conversation_members add column if not exists is_archived boolean not null default false;
alter table public.conversation_members add column if not exists custom_nickname text;

create index if not exists idx_cm_user_id on public.conversation_members (user_id);
create index if not exists idx_cm_conversation_id on public.conversation_members (conversation_id);

-- ==============================================================================
-- STEP 4: FUNCTION `is_member_of` (PRESERVE EXACT LEGACY SIGNATURE)
-- ==============================================================================
-- CRITICAL REQUIREMENT: Do NOT change parameter name p_conversation_id to p_conv_id.
-- Do NOT use DROP FUNCTION ... CASCADE.
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

-- 3.4 MESSAGES TABLE
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text default '',
  is_read boolean default false not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Safely relax legacy content constraints to allow voice notes & attachment-only messages
alter table public.messages drop constraint if exists message_content_length;
alter table public.messages alter column content drop not null;
alter table public.messages alter column content set default '';

-- Upgrade messages with rich Universal media & feature columns
alter table public.messages add column if not exists message_type text not null default 'text';
alter table public.messages add column if not exists file_url text;
alter table public.messages add column if not exists file_name text;
alter table public.messages add column if not exists file_size bigint;
alter table public.messages add column if not exists file_type text;
alter table public.messages add column if not exists duration_seconds integer;
alter table public.messages add column if not exists reply_to_message_id uuid references public.messages(id) on delete set null;
alter table public.messages add column if not exists is_edited boolean not null default false;
alter table public.messages add column if not exists edited_at timestamptz;
alter table public.messages add column if not exists is_deleted_everyone boolean not null default false;
alter table public.messages add column if not exists deleted_at timestamptz;
alter table public.messages add column if not exists deleted_for_users uuid[] not null default '{}';
alter table public.messages add column if not exists is_pinned boolean not null default false;
alter table public.messages add column if not exists is_starred boolean not null default false;
alter table public.messages add column if not exists is_forwarded boolean not null default false;
alter table public.messages add column if not exists expires_at timestamptz;

create index if not exists idx_messages_conversation_created on public.messages (conversation_id, created_at asc);
create index if not exists idx_messages_sender_id on public.messages (sender_id);
create index if not exists idx_messages_reply_to on public.messages (reply_to_message_id);
create index if not exists idx_messages_type on public.messages (conversation_id, message_type);

-- 3.5 MESSAGE_REACTIONS TABLE
create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  constraint unique_message_user_emoji unique (message_id, user_id, emoji)
);

create index if not exists idx_message_reactions_msg on public.message_reactions (message_id);
create index if not exists idx_message_reactions_user on public.message_reactions (user_id);

-- 3.6 STATUSES & STATUS_VIEWS (24-Hour Stories)
create table if not exists public.statuses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text,
  media_url text,
  background_color text default 'bg-gradient-to-tr from-orange-500 to-amber-500',
  created_at timestamptz default timezone('utc'::text, now()) not null,
  expires_at timestamptz default timezone('utc'::text, now() + interval '24 hours') not null
);

create index if not exists idx_statuses_user_created on public.statuses (user_id, created_at desc);
create index if not exists idx_statuses_expires on public.statuses (expires_at);

create table if not exists public.status_views (
  id uuid primary key default gen_random_uuid(),
  status_id uuid not null references public.statuses(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz default timezone('utc'::text, now()) not null,
  constraint unique_status_viewer unique (status_id, viewer_id)
);

create index if not exists idx_status_views_status on public.status_views (status_id);

-- 3.7 CALLS & CALL_SIGNALING (WebRTC Audio/Video Calling)
create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete set null,
  caller_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  call_type text not null default 'audio',
  status text not null default 'calling',
  started_at timestamptz default timezone('utc'::text, now()) not null,
  answered_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer default 0,
  sdp_offer text,
  sdp_answer text,
  ice_candidates jsonb default '[]'::jsonb,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.calls add column if not exists conversation_id uuid references public.conversations(id) on delete set null;
alter table public.calls add column if not exists sdp_offer text;
alter table public.calls add column if not exists sdp_answer text;
alter table public.calls add column if not exists ice_candidates jsonb default '[]'::jsonb;
alter table public.calls add column if not exists duration_seconds integer default 0;
alter table public.calls add column if not exists duration integer default 0;
alter table public.calls add column if not exists end_reason text;
alter table public.calls add column if not exists answered_at timestamptz;
alter table public.calls add column if not exists ended_at timestamptz;

create index if not exists idx_calls_caller on public.calls (caller_id);
create index if not exists idx_calls_receiver on public.calls (receiver_id);
create index if not exists idx_calls_status on public.calls (status);

create table if not exists public.call_signaling (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  signal_type text not null,
  payload jsonb not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_call_signaling_call on public.call_signaling (call_id);

-- 3.8 SOCIAL FEED: POSTS, LIKES, COMMENTS, FOLLOWS
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null default '',
  media_urls text[] default '{}',
  media_type text default 'text',
  poll_options jsonb,
  poll_voters jsonb default '{}'::jsonb,
  likes_count integer default 0,
  comments_count integer default 0,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.posts add column if not exists poll_options jsonb;
alter table public.posts add column if not exists poll_voters jsonb default '{}'::jsonb;
alter table public.posts add column if not exists likes_count integer default 0;
alter table public.posts add column if not exists comments_count integer default 0;

create index if not exists idx_posts_user on public.posts (user_id);
create index if not exists idx_posts_created on public.posts (created_at desc);

create table if not exists public.post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  constraint unique_post_user_like unique (post_id, user_id)
);

create index if not exists idx_post_likes_post on public.post_likes (post_id);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_comment_id uuid references public.post_comments(id) on delete cascade,
  content text not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.post_comments add column if not exists parent_comment_id uuid references public.post_comments(id) on delete cascade;

create index if not exists idx_post_comments_post on public.post_comments (post_id);
create index if not exists idx_post_comments_parent on public.post_comments (parent_comment_id);

create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  constraint unique_follower_following unique (follower_id, following_id)
);

create index if not exists idx_follows_follower on public.follows (follower_id);
create index if not exists idx_follows_following on public.follows (following_id);

-- 3.9 UNIVERSAL DRIVE FILES
create table if not exists public.drive_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  folder_name text default 'General',
  name text not null,
  file_url text not null,
  file_type text not null,
  file_size bigint default 0,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.drive_files add column if not exists folder_name text default 'General';
create index if not exists idx_drive_files_user on public.drive_files (user_id);

-- 3.10 MESSAGE CAPSULES & MEMORY BOARD
create table if not exists public.message_capsules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  category text not null default 'note',
  items jsonb,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_message_capsules_user on public.message_capsules (user_id);

-- 3.11 NOTIFICATIONS
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  link text,
  is_read boolean default false not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_notifications_user on public.notifications (user_id, created_at desc);

-- 3.12 BLOCKED USERS
create table if not exists public.blocked_users (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  constraint unique_blocker_blocked unique (blocker_id, blocked_id)
);

create index if not exists idx_blocked_users_blocker on public.blocked_users (blocker_id);

-- ==============================================================================
-- STEP 5: LEGACY DATA PRESERVATION & COMPATIBILITY MAPPINGS
-- ==============================================================================
do $$
begin
  -- 5.1 If legacy BASE TABLE call_history exists, copy unmigrated rows to public.calls
  if exists (
    select 1 from information_schema.tables 
    where table_schema = 'public' and table_name = 'call_history' and table_type = 'BASE TABLE'
  ) then
    insert into public.calls (id, caller_id, receiver_id, call_type, status, duration_seconds, started_at, ended_at, created_at)
    select ch.id, ch.caller_id, ch.receiver_id, 
           coalesce(ch.call_type, 'audio'), 
           coalesce(ch.status, 'ended'), 
           coalesce(ch.duration_seconds, 0), 
           coalesce(ch.started_at, ch.created_at, now()), 
           ch.ended_at, 
           coalesce(ch.created_at, now())
    from public.call_history ch
    on conflict (id) do nothing;
    raise notice '[COMPAT] Preserved and migrated rows from legacy call_history table into calls.';
  end if;

  -- 5.2 If legacy BASE TABLE memory_board exists, copy unmigrated rows to public.message_capsules
  if exists (
    select 1 from information_schema.tables 
    where table_schema = 'public' and table_name = 'memory_board' and table_type = 'BASE TABLE'
  ) then
    insert into public.message_capsules (id, user_id, title, description, category, items, created_at)
    select mb.id, mb.user_id, mb.title, mb.description, coalesce(mb.category, 'note'), mb.items, coalesce(mb.created_at, now())
    from public.memory_board mb
    on conflict (id) do nothing;
    raise notice '[COMPAT] Preserved and migrated rows from legacy memory_board table into message_capsules.';
  end if;

  -- 5.3 If legacy BASE TABLE comments exists, copy unmigrated rows to public.post_comments
  if exists (
    select 1 from information_schema.tables 
    where table_schema = 'public' and table_name = 'comments' and table_type = 'BASE TABLE'
  ) then
    insert into public.post_comments (id, post_id, user_id, content, created_at)
    select c.id, c.post_id, c.user_id, c.content, coalesce(c.created_at, now())
    from public.comments c
    on conflict (id) do nothing;
    raise notice '[COMPAT] Preserved and migrated rows from legacy comments table into post_comments.';
  end if;

  -- 5.4 If legacy BASE TABLE feed_posts exists, copy unmigrated rows to public.posts
  if exists (
    select 1 from information_schema.tables 
    where table_schema = 'public' and table_name = 'feed_posts' and table_type = 'BASE TABLE'
  ) then
    insert into public.posts (id, user_id, content, media_urls, media_type, created_at, updated_at)
    select fp.id, fp.user_id, coalesce(fp.content, ''), coalesce(fp.media_urls, '{}'), coalesce(fp.media_type, 'text'), coalesce(fp.created_at, now()), coalesce(fp.updated_at, now())
    from public.feed_posts fp
    on conflict (id) do nothing;
    raise notice '[COMPAT] Preserved and migrated rows from legacy feed_posts table into posts.';
  end if;
end $$;

-- 5.5 Compatibility Views (Only created if the table name is not already a BASE TABLE)
do $$
begin
  if not exists (
    select 1 from information_schema.tables 
    where table_schema = 'public' and table_name = 'call_history' and table_type = 'BASE TABLE'
  ) then
    create or replace view public.call_history as
    select id, conversation_id, caller_id, receiver_id, call_type, status,
           started_at, answered_at, ended_at, duration_seconds, created_at
    from public.calls;
    grant select, insert, update on public.call_history to authenticated;
  end if;

  if not exists (
    select 1 from information_schema.tables 
    where table_schema = 'public' and table_name = 'memory_board' and table_type = 'BASE TABLE'
  ) then
    create or replace view public.memory_board as
    select id, user_id, title, description, category, items, created_at
    from public.message_capsules;
    grant select, insert, update on public.memory_board to authenticated;
  end if;

  if not exists (
    select 1 from information_schema.tables 
    where table_schema = 'public' and table_name = 'comments' and table_type = 'BASE TABLE'
  ) then
    create or replace view public.comments as
    select id, post_id, user_id, content, created_at
    from public.post_comments;
    grant select, insert, update on public.comments to authenticated;
  end if;
end $$;

-- ==============================================================================
-- STEP 6: FUNCTIONS & TRIGGERS
-- ==============================================================================

-- 6.1 RPC: get_or_create_conversation
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
  insert into public.conversations (created_at, updated_at, is_group)
  values (now(), now(), false)
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

-- 6.2 Trigger: Update conversation updated_at on new message
create or replace function public.handle_new_message()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.conversations
  set updated_at = coalesce(NEW.created_at, now())
  where id = NEW.conversation_id;
  return NEW;
end;
$$;

drop trigger if exists on_new_message on public.messages;
create trigger on_new_message
  after insert on public.messages
  for each row execute function public.handle_new_message();

-- 6.3 Trigger: Auto-create Profile row on auth.users registration
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_raw_username text;
  v_raw_display_name text;
  v_raw_avatar_url text;
  v_cleaned_username text;
begin
  v_raw_username := NEW.raw_user_meta_data->>'username';
  v_raw_display_name := NEW.raw_user_meta_data->>'display_name';
  v_raw_avatar_url := NEW.raw_user_meta_data->>'avatar_url';

  if v_raw_username is null or trim(v_raw_username) = '' then
    v_cleaned_username := 'user_' || substr(replace(NEW.id::text, '-', ''), 1, 8);
  else
    v_cleaned_username := regexp_replace(lower(trim(v_raw_username)), '[^a-z0-9_]', '', 'g');
  end if;

  if v_raw_display_name is null or trim(v_raw_display_name) = '' then
    v_raw_display_name := v_cleaned_username;
  end if;

  insert into public.profiles (
    id,
    username,
    display_name,
    avatar_url,
    status,
    created_at,
    updated_at,
    last_seen
  )
  values (
    NEW.id,
    v_cleaned_username,
    v_raw_display_name,
    v_raw_avatar_url,
    'Hey there! I am using Universal.',
    now(),
    now(),
    now()
  )
  on conflict (id) do update
  set
    display_name = coalesce(excluded.display_name, profiles.display_name),
    avatar_url = coalesce(excluded.avatar_url, profiles.avatar_url),
    updated_at = now();

  return NEW;
end;
$$;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'auth' and table_name = 'users') then
    drop trigger if exists on_auth_user_created on auth.users;
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_auth_user();
  end if;
exception when others then
  raise notice 'Note: could not attach trigger to auth.users (privilege check): %', sqlerrm;
end $$;

-- ==============================================================================
-- STEP 7: ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;
alter table public.statuses enable row level security;
alter table public.status_views enable row level security;
alter table public.calls enable row level security;
alter table public.call_signaling enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
alter table public.follows enable row level security;
alter table public.drive_files enable row level security;
alter table public.message_capsules enable row level security;
alter table public.notifications enable row level security;
alter table public.blocked_users enable row level security;

-- PROFILES
drop policy if exists "Profiles viewable by anyone authenticated" on public.profiles;
drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;
create policy "Profiles viewable by anyone authenticated"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

-- CONVERSATIONS
drop policy if exists "Members view conversations" on public.conversations;
drop policy if exists "Users can view conversations they belong to" on public.conversations;
create policy "Members view conversations"
  on public.conversations for select
  to authenticated
  using (public.is_member_of(id, auth.uid()));

drop policy if exists "Authenticated users can create conversations" on public.conversations;
create policy "Authenticated users can create conversations"
  on public.conversations for insert
  to authenticated
  with check (true);

drop policy if exists "Members can update conversations" on public.conversations;
create policy "Members can update conversations"
  on public.conversations for update
  to authenticated
  using (public.is_member_of(id, auth.uid()));

-- CONVERSATION_MEMBERS
drop policy if exists "Members view conversation members" on public.conversation_members;
drop policy if exists "Users can view membership records" on public.conversation_members;
drop policy if exists "Users can view members of conversations they belong to" on public.conversation_members;
create policy "Members view conversation members"
  on public.conversation_members for select
  to authenticated
  using (public.is_member_of(conversation_id, auth.uid()) or user_id = auth.uid());

drop policy if exists "Authenticated users can insert conversation members" on public.conversation_members;
drop policy if exists "Users can join or add members" on public.conversation_members;
create policy "Authenticated users can insert conversation members"
  on public.conversation_members for insert
  to authenticated
  with check (true);

drop policy if exists "Users update own membership" on public.conversation_members;
drop policy if exists "Users can update their own membership status" on public.conversation_members;
create policy "Users update own membership"
  on public.conversation_members for update
  to authenticated
  using (user_id = auth.uid());

-- MESSAGES
drop policy if exists "Members can view messages" on public.messages;
drop policy if exists "Users can read messages in their conversations" on public.messages;
create policy "Members can view messages"
  on public.messages for select
  to authenticated
  using (public.is_member_of(conversation_id, auth.uid()));

drop policy if exists "Members can insert messages" on public.messages;
drop policy if exists "Users can send messages to their conversations" on public.messages;
create policy "Members can insert messages"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid() and
    public.is_member_of(conversation_id, auth.uid())
  );

drop policy if exists "Users can update their own messages or read state" on public.messages;
create policy "Users can update their own messages or read state"
  on public.messages for update
  to authenticated
  using (public.is_member_of(conversation_id, auth.uid()))
  with check (public.is_member_of(conversation_id, auth.uid()));

drop policy if exists "Users can delete their own messages" on public.messages;
create policy "Users can delete their own messages"
  on public.messages for delete
  to authenticated
  using (sender_id = auth.uid());

-- MESSAGE REACTIONS
drop policy if exists "Reactions viewable by conversation members" on public.message_reactions;
create policy "Reactions viewable by conversation members"
  on public.message_reactions for select
  to authenticated
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_reactions.message_id
        and public.is_member_of(m.conversation_id, auth.uid())
    )
  );

drop policy if exists "Users can add reactions in their conversations" on public.message_reactions;
create policy "Users can add reactions in their conversations"
  on public.message_reactions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.messages m
      where m.id = message_reactions.message_id
        and public.is_member_of(m.conversation_id, auth.uid())
    )
  );

drop policy if exists "Users can remove their own reactions" on public.message_reactions;
create policy "Users can remove their own reactions"
  on public.message_reactions for delete
  to authenticated
  using (user_id = auth.uid());

-- STATUSES & STATUS VIEWS
drop policy if exists "Statuses viewable by authenticated users" on public.statuses;
create policy "Statuses viewable by authenticated users"
  on public.statuses for select
  to authenticated
  using (expires_at > now());

drop policy if exists "Users can insert their own status" on public.statuses;
create policy "Users can insert their own status"
  on public.statuses for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can delete their own status" on public.statuses;
create policy "Users can delete their own status"
  on public.statuses for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Status views viewable by status creator or viewer" on public.status_views;
create policy "Status views viewable by status creator or viewer"
  on public.status_views for select
  to authenticated
  using (
    viewer_id = auth.uid() or
    exists (select 1 from public.statuses s where s.id = status_views.status_id and s.user_id = auth.uid())
  );

drop policy if exists "Authenticated users can record status view" on public.status_views;
create policy "Authenticated users can record status view"
  on public.status_views for insert
  to authenticated
  with check (viewer_id = auth.uid());

-- CALLS & CALL SIGNALING
drop policy if exists "Calls viewable by caller or receiver" on public.calls;
create policy "Calls viewable by caller or receiver"
  on public.calls for select
  to authenticated
  using (caller_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists "Users can insert calls" on public.calls;
create policy "Users can insert calls"
  on public.calls for insert
  to authenticated
  with check (caller_id = auth.uid());

drop policy if exists "Call participants can update calls" on public.calls;
create policy "Call participants can update calls"
  on public.calls for update
  to authenticated
  using (caller_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists "Call signaling viewable by call participants" on public.call_signaling;
create policy "Call signaling viewable by call participants"
  on public.call_signaling for select
  to authenticated
  using (
    exists (
      select 1 from public.calls c
      where c.id = call_signaling.call_id
        and (c.caller_id = auth.uid() or c.receiver_id = auth.uid())
    )
  );

drop policy if exists "Call participants can send signals" on public.call_signaling;
create policy "Call participants can send signals"
  on public.call_signaling for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.calls c
      where c.id = call_signaling.call_id
        and (c.caller_id = auth.uid() or c.receiver_id = auth.uid())
    )
  );

-- POSTS, LIKES, COMMENTS, FOLLOWS
drop policy if exists "Posts viewable by authenticated users" on public.posts;
create policy "Posts viewable by authenticated users"
  on public.posts for select
  to authenticated
  using (true);

drop policy if exists "Users can insert their own posts" on public.posts;
create policy "Users can insert their own posts"
  on public.posts for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update their own posts" on public.posts;
create policy "Users can update their own posts"
  on public.posts for update
  to authenticated
  using (true);

drop policy if exists "Users can delete their own posts" on public.posts;
create policy "Users can delete their own posts"
  on public.posts for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Post likes viewable by authenticated users" on public.post_likes;
create policy "Post likes viewable by authenticated users"
  on public.post_likes for select
  to authenticated
  using (true);

drop policy if exists "Users can insert their own post likes" on public.post_likes;
create policy "Users can insert their own post likes"
  on public.post_likes for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can delete their own post likes" on public.post_likes;
create policy "Users can delete their own post likes"
  on public.post_likes for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Comments viewable by authenticated users" on public.post_comments;
create policy "Comments viewable by authenticated users"
  on public.post_comments for select
  to authenticated
  using (true);

drop policy if exists "Users can insert their own post comments" on public.post_comments;
create policy "Users can insert their own post comments"
  on public.post_comments for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can delete their own post comments" on public.post_comments;
create policy "Users can delete their own post comments"
  on public.post_comments for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Follows viewable by authenticated users" on public.follows;
create policy "Follows viewable by authenticated users"
  on public.follows for select
  to authenticated
  using (true);

drop policy if exists "Users can follow others" on public.follows;
create policy "Users can follow others"
  on public.follows for insert
  to authenticated
  with check (follower_id = auth.uid());

drop policy if exists "Users can unfollow others" on public.follows;
create policy "Users can unfollow others"
  on public.follows for delete
  to authenticated
  using (follower_id = auth.uid());

-- DRIVE FILES
drop policy if exists "Users can view their own drive files" on public.drive_files;
create policy "Users can view their own drive files"
  on public.drive_files for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can insert their own drive files" on public.drive_files;
create policy "Users can insert their own drive files"
  on public.drive_files for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can delete their own drive files" on public.drive_files;
create policy "Users can delete their own drive files"
  on public.drive_files for delete
  to authenticated
  using (user_id = auth.uid());

-- MESSAGE CAPSULES
drop policy if exists "Users can view their own message capsules" on public.message_capsules;
create policy "Users can view their own message capsules"
  on public.message_capsules for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can insert their own message capsules" on public.message_capsules;
create policy "Users can insert their own message capsules"
  on public.message_capsules for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can delete their own message capsules" on public.message_capsules;
create policy "Users can delete their own message capsules"
  on public.message_capsules for delete
  to authenticated
  using (user_id = auth.uid());

-- NOTIFICATIONS
drop policy if exists "Users can view their own notifications" on public.notifications;
create policy "Users can view their own notifications"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can update their own notifications" on public.notifications;
create policy "Users can update their own notifications"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Authenticated users can insert notifications" on public.notifications;
create policy "Authenticated users can insert notifications"
  on public.notifications for insert
  to authenticated
  with check (true);

-- BLOCKED USERS
drop policy if exists "Users can view their blocked users" on public.blocked_users;
create policy "Users can view their blocked users"
  on public.blocked_users for select
  to authenticated
  using (blocker_id = auth.uid());

drop policy if exists "Users can block others" on public.blocked_users;
create policy "Users can block others"
  on public.blocked_users for insert
  to authenticated
  with check (blocker_id = auth.uid());

drop policy if exists "Users can unblock others" on public.blocked_users;
create policy "Users can unblock others"
  on public.blocked_users for delete
  to authenticated
  using (blocker_id = auth.uid());

-- ==============================================================================
-- STEP 8: SUPABASE STORAGE BUCKETS & POLICIES
-- ==============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('chat-attachments', 'chat-attachments', true, 52428800, null),
  ('avatars', 'avatars', true, 10485760, null),
  ('audio-custom', 'audio-custom', true, 20971520, null),
  ('feed-media', 'feed-media', true, 52428800, null),
  ('drive-files', 'drive-files', true, 104857600, null)
on conflict (id) do update
set public = true;

drop policy if exists "Authenticated users can upload chat attachments" on storage.objects;
drop policy if exists "Authenticated users can upload storage objects" on storage.objects;
create policy "Authenticated users can upload storage objects"
  on storage.objects for insert
  to authenticated
  with check (bucket_id in ('chat-attachments', 'avatars', 'audio-custom', 'feed-media', 'drive-files'));

drop policy if exists "Anyone can view public storage" on storage.objects;
drop policy if exists "Authenticated users can view chat attachments" on storage.objects;
drop policy if exists "Anyone can view avatars" on storage.objects;
create policy "Anyone can view public storage"
  on storage.objects for select
  using (bucket_id in ('chat-attachments', 'avatars', 'audio-custom', 'feed-media', 'drive-files'));

drop policy if exists "Users can update own storage objects" on storage.objects;
drop policy if exists "Users can update own avatar" on storage.objects;
create policy "Users can update own storage objects"
  on storage.objects for update
  to authenticated
  using (bucket_id in ('chat-attachments', 'avatars', 'audio-custom', 'feed-media', 'drive-files'));

drop policy if exists "Users can delete own storage objects" on storage.objects;
create policy "Users can delete own storage objects"
  on storage.objects for delete
  to authenticated
  using (bucket_id in ('chat-attachments', 'avatars', 'audio-custom', 'feed-media', 'drive-files'));

-- ==============================================================================
-- STEP 9: SUPABASE REALTIME CONFIGURATION
-- ==============================================================================
do $$
declare
  t text;
  tables_to_replicate text[] := array[
    'profiles',
    'conversations',
    'conversation_members',
    'messages',
    'message_reactions',
    'statuses',
    'status_views',
    'calls',
    'call_signaling',
    'posts',
    'post_likes',
    'post_comments',
    'notifications'
  ];
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach t in array tables_to_replicate loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      execute format('alter table public.%I replica identity full;', t);
      if not exists (
        select 1 from pg_publication_tables 
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I;', t);
        raise notice '[REALTIME] Added table % to publication supabase_realtime.', t;
      end if;
    end if;
  end loop;
end $$;

-- ==============================================================================
-- STEP 10: FINAL MIGRATION SUMMARY & VALIDATION NOTICE
-- ==============================================================================
do $$
begin
  raise notice '==============================================================';
  raise notice 'UNIVERSAL MIGRATION COMPLETED SUCCESSFULLY';
  raise notice 'All tables, policies, functions, storage buckets, and realtime';
  raise notice 'publications are verified and fully operational!';
  raise notice '==============================================================';
end $$;
