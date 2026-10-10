alter table public.messages drop constraint if exists message_content_length;

alter table public.messages alter column content drop not null;
alter table public.messages alter column content set default '';

alter table public.messages add constraint message_content_length check (
  content is null or char_length(content) <= 10000
);

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

create index if not exists idx_messages_reply_to on public.messages (reply_to_message_id);
create index if not exists idx_messages_type on public.messages (conversation_id, message_type);

alter table public.conversation_members add column if not exists is_pinned boolean not null default false;
alter table public.conversation_members add column if not exists is_muted boolean not null default false;
alter table public.conversation_members add column if not exists is_archived boolean not null default false;

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

alter table public.message_reactions enable row level security;

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

drop policy if exists "Users can update their own messages or read state" on public.messages;
drop policy if exists "Users can update read state on messages in their conversations" on public.messages;
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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-attachments', 'chat-attachments', true, 52428800, null)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 10485760, null)
on conflict (id) do update set public = true;

drop policy if exists "Authenticated users can upload chat attachments" on storage.objects;
create policy "Authenticated users can upload chat attachments"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'chat-attachments');

drop policy if exists "Authenticated users can view chat attachments" on storage.objects;
create policy "Authenticated users can view chat attachments"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'chat-attachments');

drop policy if exists "Anyone can view avatars" on storage.objects;
create policy "Anyone can view avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Authenticated users can upload avatars" on storage.objects;
create policy "Authenticated users can upload avatars"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars');

drop policy if exists "Users can update own avatar" on storage.objects;
create policy "Users can update own avatar"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars');

alter table public.message_reactions replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
      and schemaname = 'public' 
      and tablename = 'message_reactions'
  ) then
    alter publication supabase_realtime add table public.message_reactions;
  end if;
end $$;

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

alter table public.statuses enable row level security;

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

create table if not exists public.status_views (
  id uuid primary key default gen_random_uuid(),
  status_id uuid not null references public.statuses(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz default timezone('utc'::text, now()) not null,
  constraint unique_status_viewer unique (status_id, viewer_id)
);

create index if not exists idx_status_views_status on public.status_views (status_id);

alter table public.status_views enable row level security;

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

alter table public.statuses replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
      and schemaname = 'public' 
      and tablename = 'statuses'
  ) then
    alter publication supabase_realtime add table public.statuses;
  end if;
end $$;
