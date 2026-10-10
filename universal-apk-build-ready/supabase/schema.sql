-- ==============================================================================
-- LOCAL MESSAGE HUB: SUPABASE DATABASE INITIALIZATION SCHEMA
-- ==============================================================================
-- Copy and paste this entire script into your Supabase Dashboard:
-- Supabase Project -> SQL Editor -> New Query -> Paste & Run.
-- ==============================================================================

-- 1. Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- 2. Create PROFILES table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  avatar_url text,
  status text default 'Hey there! I am using Local Message Hub.',
  last_seen timestamptz default timezone('utc'::text, now()) not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null,
  constraint username_format check (
    char_length(username) >= 3 and 
    char_length(username) <= 24 and 
    username ~* '^[a-zA-Z0-9_]+$'
  )
);

create index if not exists idx_profiles_username on public.profiles (lower(username));
create index if not exists idx_profiles_display_name on public.profiles (display_name);

-- 3. Create CONVERSATIONS table
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_conversations_updated_at on public.conversations (updated_at desc);

-- 4. Create CONVERSATION_MEMBERS table
create table if not exists public.conversation_members (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz default timezone('utc'::text, now()) not null,
  last_read_at timestamptz default timezone('utc'::text, now()) not null,
  constraint unique_conversation_member unique (conversation_id, user_id)
);

create index if not exists idx_cm_user_id on public.conversation_members (user_id);
create index if not exists idx_cm_conversation_id on public.conversation_members (conversation_id);

-- 5. Create MESSAGES table
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  is_read boolean default false not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  constraint message_content_length check (
    char_length(trim(content)) > 0 and 
    char_length(content) <= 5000
  )
);

create index if not exists idx_messages_conversation_created on public.messages (conversation_id, created_at asc);
create index if not exists idx_messages_sender_id on public.messages (sender_id);
create index if not exists idx_messages_unread on public.messages (conversation_id, is_read) where is_read = false;

-- 6. Helper Function: Get or Create Private 1-to-1 Conversation
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

-- 7. Trigger: Update conversation updated_at whenever a new message is inserted
create or replace function public.handle_new_message()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.conversations
  set updated_at = NEW.created_at
  where id = NEW.conversation_id;
  return NEW;
end;
$$;

drop trigger if exists on_new_message on public.messages;
create trigger on_new_message
  after insert on public.messages
  for each row execute function public.handle_new_message();

-- 8. Trigger: Automatically create Profile row on auth.users registration
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

  insert into public.profiles (id, username, display_name, avatar_url, created_at, updated_at, last_seen)
  values (
    NEW.id,
    v_cleaned_username,
    v_raw_display_name,
    v_raw_avatar_url,
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- 9. Row Level Security (RLS) Configuration
alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

-- PROFILES Policies
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- Helper function to break RLS recursion safely
create or replace function public.is_member_of(p_conversation_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = p_conversation_id and user_id = p_user_id
  );
$$;

grant execute on function public.is_member_of(uuid, uuid) to authenticated;

-- CONVERSATIONS Policies
drop policy if exists "Users can view conversations they belong to" on public.conversations;
create policy "Users can view conversations they belong to"
  on public.conversations for select
  to authenticated
  using (public.is_member_of(id, auth.uid()));

drop policy if exists "Authenticated users can create conversations" on public.conversations;
create policy "Authenticated users can create conversations"
  on public.conversations for insert
  to authenticated
  with check (auth.role() = 'authenticated');

-- CONVERSATION_MEMBERS Policies
drop policy if exists "Users can view members of conversations they belong to" on public.conversation_members;
drop policy if exists "Users can view membership records" on public.conversation_members;
create policy "Users can view membership records"
  on public.conversation_members for select
  to authenticated
  using (true);

drop policy if exists "Users can join or add members" on public.conversation_members;
create policy "Users can join or add members"
  on public.conversation_members for insert
  to authenticated
  with check (auth.role() = 'authenticated');

drop policy if exists "Users can update their own membership status" on public.conversation_members;
create policy "Users can update their own membership status"
  on public.conversation_members for update
  to authenticated
  using (user_id = auth.uid());

-- MESSAGES Policies
drop policy if exists "Users can read messages in their conversations" on public.messages;
create policy "Users can read messages in their conversations"
  on public.messages for select
  to authenticated
  using (public.is_member_of(conversation_id, auth.uid()));

drop policy if exists "Users can send messages to their conversations" on public.messages;
create policy "Users can send messages to their conversations"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid() and
    public.is_member_of(conversation_id, auth.uid())
  );

drop policy if exists "Users can update read state on messages in their conversations" on public.messages;
create policy "Users can update read state on messages in their conversations"
  on public.messages for update
  to authenticated
  using (public.is_member_of(conversation_id, auth.uid()));

-- 10. Realtime Replication Setup
-- Ensure replica identity is full so realtime stream delivers complete payloads
alter table public.messages replica identity full;
alter table public.conversations replica identity full;
alter table public.conversation_members replica identity full;
alter table public.profiles replica identity full;

-- Add tables to the realtime publication
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.conversation_members;
alter publication supabase_realtime add table public.profiles;
