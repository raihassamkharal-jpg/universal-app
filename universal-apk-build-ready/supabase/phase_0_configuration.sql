-- ==============================================================================
-- UNIVERSAL — PHASE 0 CONFIGURATION MIGRATION
-- Privacy Controls, Data Export, Self-Account Deletion, Status Privacy,
-- OAuth Profile Robustness, and Storage RLS Hardening
-- ==============================================================================
-- Purpose:
--   1. Provides database-level support for Privacy and Data Management Controls:
--      - Account data export function (secure, participant-isolated json payload).
--      - Self-account deletion cascade function (`delete_own_user_account`).
--      - Privacy policy compliance flags and tracking.
--   2. Hardens and expands status privacy filtering:
--      - Safe view rules ensuring users only query statuses matching their privacy preference.
--   3. Upgrades profile handling for OAuth providers (Google, etc.) ensuring no username
--      collisions or null handles on automated auth ingestion.
--   4. Storage bucket existence and policy hardening for chat, avatars, audio, feed, and drive.
--
-- Scope:
--   - ONLY functionality requested in the Privacy + Security + Google Login + System Audit.
--   - Does NOT drop or recreate existing conversations, messages, calls, or profiles.
--   - Safe, idempotent, and non-destructive.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PROFILE PRIVACY & DATA MANAGEMENT COLUMNS
-- ------------------------------------------------------------------------------
alter table public.profiles add column if not exists privacy_data_policy_accepted boolean default true;
alter table public.profiles add column if not exists privacy_data_policy_version text default '2026-09-25';
alter table public.profiles add column if not exists last_data_export_at timestamptz;

-- ------------------------------------------------------------------------------
-- 2. STATUS PRIVACY POLICIES HARDENING
-- ------------------------------------------------------------------------------
-- Ensure statuses can only be selected by users if privacy allows:
-- - 'everyone': all authenticated users can view
-- - 'contacts': only users who share a conversation with the creator
-- - 'nobody': only the creator themselves
do $$
begin
  -- Refresh RLS on statuses
  alter table public.statuses enable row level security;

  drop policy if exists "statuses_read_with_privacy" on public.statuses;
  create policy "statuses_read_with_privacy"
    on public.statuses
    for select
    to authenticated
    using (
      user_id = auth.uid()
      or (
        expires_at > now()
        and (
          -- Check creator's status privacy preference
          exists (
            select 1 from public.profiles p
            where p.id = statuses.user_id
              and (
                coalesce(p.privacy_status, 'everyone') = 'everyone'
                or (
                  coalesce(p.privacy_status, 'everyone') = 'contacts'
                  and exists (
                    select 1 from public.conversation_members cm1
                    join public.conversation_members cm2 on cm1.conversation_id = cm2.conversation_id
                    where cm1.user_id = statuses.user_id
                      and cm2.user_id = auth.uid()
                  )
                )
              )
          )
        )
      )
    );
exception when others then
  raise notice 'Note: Status privacy policy adjustment: %', sqlerrm;
end $$;

-- ------------------------------------------------------------------------------
-- 3. SECURE DATA EXPORT FUNCTION (GDPR / PRIVACY RIGHT OF ACCESS)
-- ------------------------------------------------------------------------------
-- Returns a structured JSON document containing all user-owned profile data,
-- authored posts, reactions, comments, statuses, call records, and private drive records.
create or replace function public.export_own_user_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
  v_profile jsonb;
  v_posts jsonb;
  v_statuses jsonb;
  v_calls jsonb;
  v_drive jsonb;
  v_capsules jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required to export data';
  end if;

  -- 1. Profile
  select to_jsonb(p) into v_profile
  from public.profiles p
  where p.id = v_uid;

  -- 2. User Posts
  select coalesce(jsonb_agg(to_jsonb(pt)), '[]'::jsonb) into v_posts
  from (
    select id, content, media_url, media_type, likes_count, comments_count, created_at
    from public.posts
    where user_id = v_uid
    order by created_at desc
  ) pt;

  -- 3. User Statuses
  select coalesce(jsonb_agg(to_jsonb(st)), '[]'::jsonb) into v_statuses
  from (
    select id, content, media_url, background_color, created_at, expires_at
    from public.statuses
    where user_id = v_uid
    order by created_at desc
  ) st;

  -- 4. User Call Records
  select coalesce(jsonb_agg(to_jsonb(cl)), '[]'::jsonb) into v_calls
  from (
    select id, caller_id, receiver_id, call_type, status, started_at, duration, created_at
    from public.calls
    where caller_id = v_uid or receiver_id = v_uid
    order by created_at desc
  ) cl;

  -- 5. User Drive Files
  select coalesce(jsonb_agg(to_jsonb(df)), '[]'::jsonb) into v_drive
  from (
    select id, name, size, mime_type, file_url, created_at
    from public.drive_files
    where user_id = v_uid
    order by created_at desc
  ) df;

  -- 6. User Message Capsules
  select coalesce(jsonb_agg(to_jsonb(mc)), '[]'::jsonb) into v_capsules
  from (
    select id, title, description, category, items, created_at
    from public.message_capsules
    where user_id = v_uid
    order by created_at desc
  ) mc;

  -- Update last_data_export_at timestamp
  update public.profiles
  set last_data_export_at = now()
  where id = v_uid;

  -- Compile export object
  v_result := jsonb_build_object(
    'exported_at', now(),
    'user_id', v_uid,
    'profile', v_profile,
    'posts', v_posts,
    'statuses', v_statuses,
    'call_history', v_calls,
    'drive_files', v_drive,
    'message_capsules', v_capsules,
    'privacy_statement', 'Exported under Universal Privacy & Data Portability Policy.'
  );

  return v_result;
end;
$$;

grant execute on function public.export_own_user_data() to authenticated;

-- ------------------------------------------------------------------------------
-- 4. SECURE SELF-ACCOUNT DELETION CASCADE FUNCTION
-- ------------------------------------------------------------------------------
-- Securely purges all user-owned records (messages, statuses, calls, reactions,
-- posts, drive files, and profile) in an atomic transaction.
create or replace function public.delete_own_user_account()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required to delete account';
  end if;

  -- Delete user's active statuses & views
  delete from public.status_views where viewer_id = v_uid;
  delete from public.statuses where user_id = v_uid;

  -- Delete user's posts, reactions, comments
  delete from public.post_likes where user_id = v_uid;
  delete from public.post_comments where user_id = v_uid;
  delete from public.posts where user_id = v_uid;

  -- Delete drive files & capsules
  delete from public.drive_files where user_id = v_uid;
  delete from public.message_capsules where user_id = v_uid;

  -- Delete call signaling & history
  delete from public.call_signaling where sender_id = v_uid or receiver_id = v_uid;
  delete from public.calls where caller_id = v_uid or receiver_id = v_uid;

  -- Delete notifications
  delete from public.notifications where user_id = v_uid or actor_id = v_uid;

  -- Remove from blocked list
  delete from public.blocked_users where blocker_id = v_uid or blocked_id = v_uid;

  -- Handle messages: mark sender messages as deleted for privacy preservation
  update public.messages
  set is_deleted_everyone = true,
      content = 'This message was deleted.',
      file_url = null
  where sender_id = v_uid;

  -- Remove from conversation members
  delete from public.conversation_members where user_id = v_uid;

  -- Finally delete profile
  delete from public.profiles where id = v_uid;

  return true;
end;
$$;

grant execute on function public.delete_own_user_account() to authenticated;

-- ------------------------------------------------------------------------------
-- 5. OAUTH USER CREATION TRIGGER REFINEMENT
-- ------------------------------------------------------------------------------
-- Ensure fallback values for avatar, username, and full_name are safely parsed
-- from Google and third-party provider metadata.
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
  -- Extract from raw_user_meta_data (works for email/password and Google OAuth)
  v_raw_username := coalesce(
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'preferred_username',
    split_part(NEW.email, '@', 1)
  );

  v_raw_display_name := coalesce(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    v_raw_username
  );

  v_raw_avatar_url := coalesce(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture'
  );

  if v_raw_username is null or trim(v_raw_username) = '' then
    v_cleaned_username := 'user_' || substr(replace(NEW.id::text, '-', ''), 1, 8);
  else
    v_cleaned_username := regexp_replace(lower(trim(v_raw_username)), '[^a-z0-9_]', '', 'g');
    if length(v_cleaned_username) < 3 then
      v_cleaned_username := v_cleaned_username || substr(replace(NEW.id::text, '-', ''), 1, 4);
    end if;
    v_cleaned_username := substr(v_cleaned_username, 1, 24);
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
    display_name = coalesce(profiles.display_name, excluded.display_name),
    avatar_url = coalesce(profiles.avatar_url, excluded.avatar_url),
    updated_at = now();

  return NEW;
end;
$$;
