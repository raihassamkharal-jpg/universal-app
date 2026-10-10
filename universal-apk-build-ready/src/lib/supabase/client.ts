import { createClient } from '@supabase/supabase-js';
import type {
  Profile,
  Message,
  MessageType,
  MessageReaction,
  ConversationWithDetails,
  UserStatus,
  StatusView,
  CallRecord,
  Post,
  PostComment,
  DriveFile,
  MessageCapsule,
  AppNotification,
} from '../../types/database';

// Safely retrieve environment variables across Vite and Node environments
// Avoid dynamic process.env[key] bracket indexing so Vite define and Rollup bundling work reliably
const rawSupabaseUrl =
  (typeof process !== 'undefined' && process.env ? process.env.NEXT_PUBLIC_SUPABASE_URL : '') ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_URL) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
  'https://qgkbjmnyqrdskepwxqrx.supabase.co';

const rawSupabaseAnonKey =
  (typeof process !== 'undefined' && process.env ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : '') ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
  'sb_publishable_VHR_iPQOVImFe3dT2IqwIA_QLCJaKSV';

const supabaseUrl = String(rawSupabaseUrl || '').trim();
const supabaseAnonKey = String(rawSupabaseAnonKey || '').trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== '' &&
  supabaseAnonKey !== '' &&
  !supabaseUrl.includes('your-supabase-url')
);

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

// ---------------------------------------------------------------------------
// Local Persistence Helpers (Ensures zero-error resilience if Supabase tables
// or storage buckets are not migrated yet or running in demo mode)
// ---------------------------------------------------------------------------

function getLocalStore<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
}

function setLocalStore<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

// Built-in Demo Contacts for instant interactive search & testing
export const DEMO_CONTACTS: Profile[] = [
  {
    id: 'demo-contact-hassam',
    username: 'hassam',
    display_name: 'Hassam Kharal',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    status: 'Exploring Universal messaging. Real-time is so smooth! ✨',
    last_seen: new Date().toISOString(),
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'demo-contact-sophia',
    username: 'sophia_design',
    display_name: 'Sophia Martinez',
    avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    status: 'Designing sleek micro-interactions 🎨',
    last_seen: new Date().toISOString(),
    created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'demo-contact-elena',
    username: 'elena_dev',
    display_name: 'Elena Rostova',
    avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    status: 'Coding WebRTC peer-to-peer audio pipelines 🎧',
    last_seen: new Date().toISOString(),
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'demo-contact-marcus',
    username: 'marcus_ai',
    display_name: 'Marcus Sterling',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    status: 'Universal connect everyone 🌐',
    last_seen: new Date().toISOString(),
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Initial Seed Feed Posts
const SEED_FEED_POSTS: Post[] = [
  {
    id: 'seed-post-1',
    user_id: 'demo-contact-hassam',
    content: 'Welcome to Universal! 🚀 Search any friend by their unique username handle, initiate instant WebRTC audio/video calls, and share high-resolution media without sharing phone numbers.',
    media_urls: ['https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80'],
    media_type: 'image',
    likes_count: 14,
    comments_count: 3,
    has_liked: false,
    created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 3).toISOString(),
    user: DEMO_CONTACTS[0],
  },
  {
    id: 'seed-post-2',
    user_id: 'demo-contact-sophia',
    content: 'What feature do you use most often in modern messaging?',
    media_urls: [],
    media_type: 'poll',
    poll_options: [
      { id: 'opt_0', text: 'HD Voice & Video Calls', votes: 28 },
      { id: 'opt_1', text: 'Voice Notes & Audio Clips', votes: 42 },
      { id: 'opt_2', text: 'Universal Cloud Drive & Files', votes: 19 },
      { id: 'opt_3', text: '24-Hour Ephemeral Stories', votes: 31 },
    ],
    likes_count: 9,
    comments_count: 5,
    has_liked: false,
    created_at: new Date(Date.now() - 3600000 * 8).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 8).toISOString(),
    user: DEMO_CONTACTS[1],
  },
];

// Initial Seed Capsule
const SEED_CAPSULES: MessageCapsule[] = [
  {
    id: 'seed-capsule-1',
    user_id: 'global',
    title: 'Universal Handle & Security',
    category: 'note',
    description: 'Universal provides username-based identity. You never need to expose your phone number or email address. Share your QR ID Card from the header menu.',
    items: null,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
];

// Initial Seed Drive File
const SEED_DRIVE_FILES: DriveFile[] = [
  {
    id: 'seed-drive-1',
    user_id: 'global',
    folder_name: 'General',
    name: 'Universal_Platform_Guide.pdf',
    file_url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&auto=format&fit=crop&q=80',
    file_type: 'application/pdf',
    file_size: 245760,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
];

// ---------------------------------------------------------------------------
// Upload a file to real Supabase Storage (with persistent Data URL fallback)
// ---------------------------------------------------------------------------
export async function uploadFileToStorage(
  file: File | Blob,
  bucket: 'chat-attachments' | 'avatars' | 'audio-custom' | 'feed-media' | 'drive-files',
  customPath?: string
): Promise<{ publicUrl: string | null; error?: string }> {
  // Helper to create reliable client-side data URL when bucket does not exist
  const createFallbackUrl = (): Promise<{ publicUrl: string | null; error?: string }> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({ publicUrl: reader.result as string, error: undefined });
      };
      reader.onerror = () => {
        resolve({ publicUrl: URL.createObjectURL(file), error: undefined });
      };
      reader.readAsDataURL(file);
    });
  };

  if (!isSupabaseConfigured) {
    return createFallbackUrl();
  }

  try {
    const fileExt =
      file instanceof File && file.name.includes('.')
        ? file.name.split('.').pop()
        : file.type.includes('/')
        ? file.type.split('/')[1]?.replace('x-', '').replace('webm', 'webm') || 'bin'
        : 'bin';

    const fileName = customPath || `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${fileExt}`;
    const contentType = file.type || 'application/octet-stream';

    const { data, error } = await supabase.storage.from(bucket).upload(fileName, file, {
      cacheControl: '3600',
      contentType,
      upsert: true,
    });

    if (error) {
      // Storage bucket might not exist yet; fall back seamlessly
      return createFallbackUrl();
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
    return { publicUrl: urlData.publicUrl, error: undefined };
  } catch {
    return createFallbackUrl();
  }
}

// ---------------------------------------------------------------------------
// Search profiles by username or display name
// ---------------------------------------------------------------------------
export async function searchUsers(query: string, currentUserId: string): Promise<Profile[]> {
  const cleanQuery = query.trim().replace(/^@/, '').toLowerCase();
  if (cleanQuery.length === 0) return [];

  let results: Profile[] = [];

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', currentUserId)
        .or(`username.ilike.%${cleanQuery}%,display_name.ilike.%${cleanQuery}%`)
        .limit(8);

      if (!error && data && data.length > 0) {
        results = data as Profile[];
      }
    } catch {
      // Continue to demo contacts
    }
  }

  // Also search demo contacts to ensure users always have contacts to interact with
  const matchingDemos = DEMO_CONTACTS.filter(
    (c) =>
      c.id !== currentUserId &&
      (c.username.toLowerCase().includes(cleanQuery) ||
        c.display_name.toLowerCase().includes(cleanQuery))
  );

  // Merge unique by username
  const existingUsernames = new Set(results.map((r) => r.username.toLowerCase()));
  for (const demo of matchingDemos) {
    if (!existingUsernames.has(demo.username.toLowerCase())) {
      results.push(demo);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Get or create a 1-to-1 conversation
// ---------------------------------------------------------------------------
export async function getOrCreateConversation(
  currentUserId: string,
  otherUserId: string
): Promise<string | null> {
  if (!currentUserId || !otherUserId) return null;
  if (currentUserId === otherUserId) return null;

  const isRealUserPair =
    isSupabaseConfigured &&
    !currentUserId.startsWith('demo-') &&
    !otherUserId.startsWith('demo-');

  // If real Supabase accounts, check Supabase first to avoid stale local shadows
  if (isRealUserPair) {
    try {
      // 1. Try secure stored procedure if available
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc(
          'get_or_create_conversation',
          { p_other_user_id: otherUserId }
        );
        if (!rpcError && rpcData) {
          return String(rpcData);
        }
      } catch {}

      // 2. Query memberships
      const { data: myMemberships } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', currentUserId);

      const myConvIds = Array.from(
        new Set((myMemberships || []).map((m) => m.conversation_id).filter(Boolean))
      );

      if (myConvIds.length > 0) {
        const { data: shared } = await supabase
          .from('conversation_members')
          .select('conversation_id')
          .eq('user_id', otherUserId)
          .in('conversation_id', myConvIds)
          .limit(1);

        if (shared && shared.length > 0 && shared[0].conversation_id) {
          return shared[0].conversation_id;
        }
      }

      // 3. Create new conversation on Supabase
      const newConvId = crypto.randomUUID();
      const now = new Date().toISOString();

      const { error: newConvErr } = await supabase.from('conversations').insert({
        id: newConvId,
        created_at: now,
        updated_at: now,
      });

      if (!newConvErr) {
        await supabase.from('conversation_members').insert([
          {
            conversation_id: newConvId,
            user_id: currentUserId,
            joined_at: now,
            last_read_at: now,
          },
          {
            conversation_id: newConvId,
            user_id: otherUserId,
            joined_at: now,
            last_read_at: now,
          },
        ]);
        return newConvId;
      }
    } catch (err) {
      console.warn('Supabase getOrCreateConversation error:', err);
    }

    // For real users, NEVER return a local fake 'conv_...' string as it breaks PostgreSQL UUID and Realtime
    return null;
  }

  // Check local store for demo accounts
  const localConvs = getLocalStore<any[]>('universal_local_conversations', []);
  const existingLocal = localConvs.find(
    (c) =>
      (c.userA === currentUserId && c.userB === otherUserId) ||
      (c.userA === otherUserId && c.userB === currentUserId)
  );
  if (existingLocal) {
    return existingLocal.id;
  }

  // Local demo conversation creation
  const localConvId = `conv_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`;
  localConvs.unshift({
    id: localConvId,
    userA: currentUserId,
    userB: otherUserId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  setLocalStore('universal_local_conversations', localConvs);
  return localConvId;
}

// ---------------------------------------------------------------------------
// Fetch user's conversation list with details
// ---------------------------------------------------------------------------
export async function fetchUserConversations(
  currentUserId: string
): Promise<ConversationWithDetails[]> {
  if (!currentUserId) return [];

  const conversationsResult: ConversationWithDetails[] = [];
  const seenConvIds = new Set<string>();

  // 1. Try Supabase
  if (isSupabaseConfigured) {
    try {
      const { data: myMemberships, error: memberError } = await supabase
        .from('conversation_members')
        .select('*')
        .eq('user_id', currentUserId);

      if (!memberError && myMemberships && myMemberships.length > 0) {
        const membershipMap = new Map<string, any>();
        myMemberships.forEach((m) => {
          if (m.conversation_id) membershipMap.set(m.conversation_id, m);
        });

        const convIds = Array.from(membershipMap.keys());
        if (convIds.length > 0) {
          const { data: convs } = await supabase
            .from('conversations')
            .select('*')
            .in('id', convIds)
            .order('updated_at', { ascending: false });

          if (convs && convs.length > 0) {
            const { data: allMembers } = await supabase
              .from('conversation_members')
              .select('conversation_id, user_id')
              .in('conversation_id', convIds)
              .neq('user_id', currentUserId);

            const membersList = allMembers || [];
            const otherUserIds = Array.from(new Set(membersList.map((m) => m.user_id).filter(Boolean)));

            const profileMap = new Map<string, Profile>();
            if (otherUserIds.length > 0) {
              const { data: profiles } = await supabase.from('profiles').select('*').in('id', otherUserIds);
              if (profiles) {
                profiles.forEach((p) => profileMap.set(p.id, p as Profile));
              }
            }

            // Also check demo contacts map
            DEMO_CONTACTS.forEach((d) => profileMap.set(d.id, d));

            const convToOtherUserMap = new Map<string, Profile>();
            membersList.forEach((m) => {
              const p = profileMap.get(m.user_id);
              if (p) convToOtherUserMap.set(m.conversation_id, p);
            });

            for (const conv of convs) {
              const otherUser = convToOtherUserMap.get(conv.id) || {
                id: 'unknown',
                username: 'member',
                display_name: 'Member',
                avatar_url: null,
                status: '',
                last_seen: new Date().toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };

              const { data: lastMsgData } = await supabase
                .from('messages')
                .select('*')
                .eq('conversation_id', conv.id)
                .order('created_at', { ascending: false })
                .limit(1);

              const lastMessage = lastMsgData && lastMsgData.length > 0 ? (lastMsgData[0] as Message) : null;
              const myMembership = membershipMap.get(conv.id);

              conversationsResult.push({
                id: conv.id,
                created_at: conv.created_at,
                updated_at: conv.updated_at,
                other_user: otherUser,
                last_message: lastMessage,
                unread_count: 0,
                is_pinned: Boolean(myMembership?.is_pinned),
                is_muted: Boolean(myMembership?.is_muted),
                is_archived: Boolean(myMembership?.is_archived),
              });
              seenConvIds.add(conv.id);
            }
          }
        }
      }
    } catch {}
  }

  // 2. Local conversations fallback
  const localConvs = getLocalStore<any[]>('universal_local_conversations', []);
  const localMessages = getLocalStore<Message[]>('universal_local_messages', []);

  for (const lc of localConvs) {
    if (seenConvIds.has(lc.id)) continue;
    if (lc.userA !== currentUserId && lc.userB !== currentUserId) continue;

    const isCurrentDemo = currentUserId.startsWith('demo-');
    const isOtherDemo = (lc.userA?.startsWith('demo-') || lc.userB?.startsWith('demo-'));
    // If real user, ignore local shadow records between two non-demo accounts
    if (!isCurrentDemo && !isOtherDemo) continue;

    const otherId = lc.userA === currentUserId ? lc.userB : lc.userA;
    const demoProfile = DEMO_CONTACTS.find((d) => d.id === otherId) || {
      id: otherId,
      username: 'user',
      display_name: 'Chat Member',
      avatar_url: null,
      status: '',
      last_seen: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const convMsgs = localMessages.filter((m) => m.conversation_id === lc.id);
    const lastMsg = convMsgs.length > 0 ? convMsgs[convMsgs.length - 1] : null;

    conversationsResult.push({
      id: lc.id,
      created_at: lc.created_at,
      updated_at: lastMsg?.created_at || lc.updated_at,
      other_user: demoProfile,
      last_message: lastMsg,
      unread_count: 0,
    });
    seenConvIds.add(lc.id);
  }

  // If user has zero conversations, create a default friendly conversation with @hassam
  if (conversationsResult.length === 0) {
    const welcomeConvId = 'welcome-chat-hassam';
    const welcomeMsg: Message = {
      id: 'welcome-msg-1',
      conversation_id: welcomeConvId,
      sender_id: DEMO_CONTACTS[0].id,
      content: 'Hey there! Welcome to Universal 👋 You can search any username, start voice/video calls, and exchange photos & voice notes seamlessly.',
      message_type: 'text',
      is_read: true,
      created_at: new Date(Date.now() - 60000 * 15).toISOString(),
    };

    const welcomeConv: ConversationWithDetails = {
      id: welcomeConvId,
      created_at: new Date(Date.now() - 60000 * 15).toISOString(),
      updated_at: new Date(Date.now() - 60000 * 15).toISOString(),
      other_user: DEMO_CONTACTS[0],
      last_message: welcomeMsg,
      unread_count: 0,
    };

    // Store in local store
    localConvs.push({
      id: welcomeConvId,
      userA: currentUserId,
      userB: DEMO_CONTACTS[0].id,
      created_at: welcomeConv.created_at,
      updated_at: welcomeConv.updated_at,
    });
    setLocalStore('universal_local_conversations', localConvs);

    localMessages.push(welcomeMsg);
    setLocalStore('universal_local_messages', localMessages);

    conversationsResult.push(welcomeConv);
  }

  // Sort: pinned first, then by updated_at descending
  conversationsResult.sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    const timeA = a.last_message?.created_at || a.updated_at;
    const timeB = b.last_message?.created_at || b.updated_at;
    return new Date(timeB).getTime() - new Date(timeA).getTime();
  });

  return conversationsResult;
}

// ---------------------------------------------------------------------------
// Fetch message reactions
// ---------------------------------------------------------------------------
export async function fetchMessageReactions(
  messageIds: string[]
): Promise<Record<string, MessageReaction[]>> {
  if (!isSupabaseConfigured || messageIds.length === 0) {
    return getLocalStore<Record<string, MessageReaction[]>>('universal_local_reactions', {});
  }

  try {
    const { data, error } = await supabase
      .from('message_reactions')
      .select('*, user:profiles(id, username, display_name, avatar_url)')
      .in('message_id', messageIds);

    if (error) {
      return getLocalStore<Record<string, MessageReaction[]>>('universal_local_reactions', {});
    }

    const map: Record<string, MessageReaction[]> = {};
    (data || []).forEach((r) => {
      if (!map[r.message_id]) map[r.message_id] = [];
      map[r.message_id].push({
        id: r.id,
        message_id: r.message_id,
        user_id: r.user_id,
        emoji: r.emoji,
        created_at: r.created_at,
        user: r.user,
      });
    });

    return map;
  } catch {
    return getLocalStore<Record<string, MessageReaction[]>>('universal_local_reactions', {});
  }
}

// ---------------------------------------------------------------------------
// Fetch conversation messages
// ---------------------------------------------------------------------------
export async function fetchConversationMessages(
  conversationId: string,
  currentUserId?: string
): Promise<Message[]> {
  if (!conversationId) return [];

  // 1. Try Supabase
  if (isSupabaseConfigured && !conversationId.startsWith('conv_') && !conversationId.startsWith('welcome-')) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(300);

      if (!error && data) {
        let messages = data as Message[];
        if (currentUserId) {
          messages = messages.filter((m) => {
            if (m.deleted_for_users && Array.isArray(m.deleted_for_users)) {
              return !m.deleted_for_users.includes(currentUserId);
            }
            return true;
          });
        }
        const messageIds = messages.map((m) => m.id);
        if (messageIds.length > 0) {
          const reactionsMap = await fetchMessageReactions(messageIds);
          messages = messages.map((m) => ({
            ...m,
            reactions: reactionsMap[m.id] || [],
          }));
        }
        return messages;
      }
    } catch {}
  }

  // 2. Local fallback
  const allLocal = getLocalStore<Message[]>('universal_local_messages', []);
  const filtered = allLocal.filter((m) => m.conversation_id === conversationId);
  const reactionsMap = getLocalStore<Record<string, MessageReaction[]>>('universal_local_reactions', {});

  return filtered.map((m) => ({
    ...m,
    reactions: reactionsMap[m.id] || [],
  }));
}

export interface SendMessagePayload {
  conversationId: string;
  senderId: string;
  content?: string;
  messageType?: MessageType;
  fileUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  fileType?: string | null;
  durationSeconds?: number | null;
  replyToMessageId?: string | null;
}

// ---------------------------------------------------------------------------
// Send a new message
// ---------------------------------------------------------------------------
export async function sendChatMessage(
  conversationIdOrPayload: string | SendMessagePayload,
  senderId?: string,
  content?: string
): Promise<Message | null> {
  let payload: SendMessagePayload;
  if (typeof conversationIdOrPayload === 'object') {
    payload = conversationIdOrPayload;
  } else {
    payload = {
      conversationId: conversationIdOrPayload,
      senderId: senderId!,
      content: content || '',
      messageType: 'text',
    };
  }

  const {
    conversationId,
    senderId: actualSenderId,
    content: msgContent = '',
    messageType = 'text',
    fileUrl = null,
    fileName = null,
    fileSize = null,
    fileType = null,
    durationSeconds = null,
    replyToMessageId = null,
  } = payload;

  if (!conversationId || !actualSenderId) return null;
  const safeContent = (msgContent || '').trim() || (fileUrl ? fileUrl : '');
  const now = new Date().toISOString();

  // Try Supabase first if not a local conv ID
  if (isSupabaseConfigured && !conversationId.startsWith('conv_') && !conversationId.startsWith('welcome-')) {
    try {
      const insertPayload: any = {
        conversation_id: conversationId,
        sender_id: actualSenderId,
        content: safeContent,
        is_read: false,
        message_type: messageType,
      };

      if (fileUrl) insertPayload.file_url = fileUrl;
      if (fileName) insertPayload.file_name = fileName;
      if (fileSize) insertPayload.file_size = fileSize;
      if (fileType) insertPayload.file_type = fileType;
      if (durationSeconds) insertPayload.duration_seconds = durationSeconds;
      if (replyToMessageId) insertPayload.reply_to_message_id = replyToMessageId;

      const { data, error } = await supabase
        .from('messages')
        .insert(insertPayload)
        .select('*')
        .single();

      if (!error && data) {
        supabase
          .from('conversations')
          .update({ updated_at: now })
          .eq('id', conversationId)
          .then(() => {}, () => {});

        // Broadcast cross-tab for immediate multi-window/account sync
        try {
          if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
            const bc = new BroadcastChannel('universal_chat_events');
            bc.postMessage({ type: 'NEW_MESSAGE', message: data });
            bc.close();
          }
        } catch {}

        return data as Message;
      }
    } catch {}
  }

  // Local fallback
  const newMsg: Message = {
    id: `msg_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`,
    conversation_id: conversationId,
    sender_id: actualSenderId,
    content: safeContent,
    message_type: messageType,
    file_url: fileUrl,
    file_name: fileName,
    file_size: fileSize,
    file_type: fileType,
    duration_seconds: durationSeconds,
    reply_to_message_id: replyToMessageId,
    is_read: false,
    created_at: now,
  };

  const allLocal = getLocalStore<Message[]>('universal_local_messages', []);
  allLocal.push(newMsg);
  setLocalStore('universal_local_messages', allLocal);

  // Update conversation updated_at
  const localConvs = getLocalStore<any[]>('universal_local_conversations', []);
  const conv = localConvs.find((c) => c.id === conversationId);
  if (conv) {
    conv.updated_at = now;
    setLocalStore('universal_local_conversations', localConvs);
  }

  // Broadcast cross-tab for local messages too
  try {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const bc = new BroadcastChannel('universal_chat_events');
      bc.postMessage({ type: 'NEW_MESSAGE', message: newMsg });
      bc.close();
    }
  } catch {}

  return newMsg;
}

// ---------------------------------------------------------------------------
// Edit own message
// ---------------------------------------------------------------------------
export async function editChatMessage(
  messageId: string,
  currentUserId: string,
  newContent: string
): Promise<boolean> {
  if (!messageId || !currentUserId || !newContent.trim()) return false;

  if (isSupabaseConfigured && !messageId.startsWith('msg_')) {
    try {
      const { error } = await supabase
        .from('messages')
        .update({
          content: newContent.trim(),
          is_edited: true,
          edited_at: new Date().toISOString(),
        })
        .eq('id', messageId)
        .eq('sender_id', currentUserId);

      if (!error) {
        try {
          if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
            const bc = new BroadcastChannel('universal_chat_events');
            bc.postMessage({ type: 'MESSAGE_EDITED', messageId, content: newContent.trim() });
            bc.close();
          }
        } catch {}
        return true;
      }
    } catch {}
  }

  // Local fallback
  const allLocal = getLocalStore<Message[]>('universal_local_messages', []);
  const target = allLocal.find((m) => m.id === messageId);
  if (target) {
    target.content = newContent.trim();
    target.is_edited = true;
    target.edited_at = new Date().toISOString();
    setLocalStore('universal_local_messages', allLocal);
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('universal_chat_events');
        bc.postMessage({ type: 'MESSAGE_EDITED', messageId, content: newContent.trim() });
        bc.close();
      }
    } catch {}
    return true;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Delete message for everyone
// ---------------------------------------------------------------------------
export async function deleteMessageForEveryone(
  messageId: string,
  currentUserId: string
): Promise<boolean> {
  if (!messageId || !currentUserId) return false;

  if (isSupabaseConfigured && !messageId.startsWith('msg_')) {
    try {
      const { error } = await supabase
        .from('messages')
        .update({
          content: 'This message was deleted',
          is_deleted_everyone: true,
          deleted_at: new Date().toISOString(),
          file_url: null,
        })
        .eq('id', messageId)
        .eq('sender_id', currentUserId);

      if (!error) {
        try {
          if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
            const bc = new BroadcastChannel('universal_chat_events');
            bc.postMessage({ type: 'MESSAGE_DELETED', messageId });
            bc.close();
          }
        } catch {}
        return true;
      }
    } catch {}
  }

  // Local fallback
  const allLocal = getLocalStore<Message[]>('universal_local_messages', []);
  const target = allLocal.find((m) => m.id === messageId);
  if (target) {
    target.content = 'This message was deleted';
    target.is_deleted_everyone = true;
    target.deleted_at = new Date().toISOString();
    target.file_url = null;
    setLocalStore('universal_local_messages', allLocal);
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('universal_chat_events');
        bc.postMessage({ type: 'MESSAGE_DELETED', messageId });
        bc.close();
      }
    } catch {}
    return true;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Delete message for current user only
// ---------------------------------------------------------------------------
export async function deleteMessageForMe(
  messageId: string,
  currentUserId: string
): Promise<boolean> {
  if (!messageId || !currentUserId) return false;

  if (isSupabaseConfigured && !messageId.startsWith('msg_')) {
    try {
      const { data: currentMsg } = await supabase
        .from('messages')
        .select('deleted_for_users')
        .eq('id', messageId)
        .single();

      const currentArray = (currentMsg?.deleted_for_users as string[]) || [];
      if (!currentArray.includes(currentUserId)) {
        await supabase
          .from('messages')
          .update({ deleted_for_users: [...currentArray, currentUserId] })
          .eq('id', messageId);
      }
      return true;
    } catch {}
  }

  const allLocal = getLocalStore<Message[]>('universal_local_messages', []);
  const target = allLocal.find((m) => m.id === messageId);
  if (target) {
    const list = target.deleted_for_users || [];
    if (!list.includes(currentUserId)) {
      target.deleted_for_users = [...list, currentUserId];
      setLocalStore('universal_local_messages', allLocal);
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Toggle message reaction
// ---------------------------------------------------------------------------
export async function toggleMessageReaction(
  messageId: string,
  userId: string,
  emoji: string
): Promise<{ added: boolean; reaction?: MessageReaction }> {
  if (!messageId || !userId || !emoji) return { added: false };

  if (isSupabaseConfigured && !messageId.startsWith('msg_')) {
    try {
      const { data: existing } = await supabase
        .from('message_reactions')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', userId)
        .eq('emoji', emoji)
        .maybeSingle();

      if (existing) {
        await supabase.from('message_reactions').delete().eq('id', existing.id);
        try {
          if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
            const bc = new BroadcastChannel('universal_chat_events');
            bc.postMessage({ type: 'REACTION_UPDATED', messageId, userId, emoji, added: false });
            bc.close();
          }
        } catch {}
        return { added: false };
      } else {
        const { data, error } = await supabase
          .from('message_reactions')
          .insert({ message_id: messageId, user_id: userId, emoji })
          .select('*')
          .single();

        if (!error && data) {
          try {
            if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
              const bc = new BroadcastChannel('universal_chat_events');
              bc.postMessage({ type: 'REACTION_UPDATED', messageId, userId, emoji, added: true, reaction: data });
              bc.close();
            }
          } catch {}
          return { added: true, reaction: data as MessageReaction };
        }
      }
    } catch {}
  }

  // Local fallback
  const allReactions = getLocalStore<Record<string, MessageReaction[]>>('universal_local_reactions', {});
  const msgReactions = allReactions[messageId] || [];
  const existingIdx = msgReactions.findIndex((r) => r.user_id === userId && r.emoji === emoji);

  if (existingIdx >= 0) {
    msgReactions.splice(existingIdx, 1);
    allReactions[messageId] = msgReactions;
    setLocalStore('universal_local_reactions', allReactions);
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('universal_chat_events');
        bc.postMessage({ type: 'REACTION_UPDATED', messageId, userId, emoji, added: false });
        bc.close();
      }
    } catch {}
    return { added: false };
  } else {
    const newReaction: MessageReaction = {
      id: `react_${Date.now()}`,
      message_id: messageId,
      user_id: userId,
      emoji,
      created_at: new Date().toISOString(),
    };
    msgReactions.push(newReaction);
    allReactions[messageId] = msgReactions;
    setLocalStore('universal_local_reactions', allReactions);
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('universal_chat_events');
        bc.postMessage({ type: 'REACTION_UPDATED', messageId, userId, emoji, added: true, reaction: newReaction });
        bc.close();
      }
    } catch {}
    return { added: true, reaction: newReaction };
  }
}

// ---------------------------------------------------------------------------
// Update conversation membership (pin, mute, archive)
// ---------------------------------------------------------------------------
export async function updateConversationMembership(
  conversationId: string,
  userId: string,
  updates: { is_pinned?: boolean; is_muted?: boolean; is_archived?: boolean }
): Promise<boolean> {
  if (!conversationId || !userId) return false;

  if (isSupabaseConfigured && !conversationId.startsWith('conv_')) {
    try {
      await supabase
        .from('conversation_members')
        .update(updates)
        .eq('conversation_id', conversationId)
        .eq('user_id', userId);
      return true;
    } catch {}
  }
  return true;
}

// ---------------------------------------------------------------------------
// Mark messages as read
// ---------------------------------------------------------------------------
export async function markConversationAsRead(
  conversationId: string,
  currentUserId: string
): Promise<void> {
  if (!conversationId || !currentUserId) return;

  if (isSupabaseConfigured && !conversationId.startsWith('conv_')) {
    try {
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', currentUserId)
        .eq('is_read', false);
    } catch {}
  }

  const allLocal = getLocalStore<Message[]>('universal_local_messages', []);
  let changed = false;
  allLocal.forEach((m) => {
    if (m.conversation_id === conversationId && m.sender_id !== currentUserId && !m.is_read) {
      m.is_read = true;
      changed = true;
    }
  });
  if (changed) setLocalStore('universal_local_messages', allLocal);
}

// ---------------------------------------------------------------------------
// Update user presence (last_seen)
// ---------------------------------------------------------------------------
export async function updateUserPresence(userId: string): Promise<void> {
  if (!userId || !isSupabaseConfigured) return;
  try {
    await supabase
      .from('profiles')
      .update({ last_seen: new Date().toISOString() })
      .eq('id', userId);
  } catch {}
}

// ---------------------------------------------------------------------------
// 24-Hour Status / Stories System
// ---------------------------------------------------------------------------
export async function fetchActiveStatuses(currentUserId: string): Promise<UserStatus[]> {
  let statusesData: UserStatus[] = [];

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('statuses')
        .select('*, user:profiles!user_id(*)')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        statusesData = data as UserStatus[];
      }
    } catch {}
  }

  // Check local store
  const localStatuses = getLocalStore<UserStatus[]>('universal_local_statuses', []);
  const validLocal = localStatuses.filter(
    (s) => new Date(s.expires_at || 0).getTime() > Date.now()
  );

  const merged = [...statusesData, ...validLocal];
  const viewedSet = new Set(getLocalStore<string[]>('universal_viewed_statuses', []));

  return merged.map((s) => ({
    ...s,
    has_viewed: viewedSet.has(s.id),
  }));
}

export async function createStatus(
  userId: string,
  data: {
    content?: string;
    media_url?: string;
    background_color?: string;
  }
): Promise<UserStatus | null> {
  if (!userId) return null;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  if (isSupabaseConfigured) {
    try {
      const { data: inserted, error } = await supabase
        .from('statuses')
        .insert({
          user_id: userId,
          content: data.content || null,
          media_url: data.media_url || null,
          background_color: data.background_color || 'bg-gradient-to-tr from-orange-500 to-amber-500',
        })
        .select('*, user:profiles!user_id(*)')
        .single();

      if (!error && inserted) {
        return inserted as UserStatus;
      }
    } catch {}
  }

  // Local fallback
  const newStatus: UserStatus = {
    id: `status_${Date.now()}`,
    user_id: userId,
    content: data.content || null,
    media_url: data.media_url || null,
    background_color: data.background_color || 'bg-gradient-to-tr from-orange-500 to-amber-500',
    created_at: now.toISOString(),
    expires_at: expiresAt,
  };

  const localStatuses = getLocalStore<UserStatus[]>('universal_local_statuses', []);
  localStatuses.unshift(newStatus);
  setLocalStore('universal_local_statuses', localStatuses);
  return newStatus;
}

export async function recordStatusView(statusId: string, viewerId: string): Promise<void> {
  if (!statusId || !viewerId) return;

  if (isSupabaseConfigured) {
    try {
      await supabase.from('status_views').upsert(
        { status_id: statusId, viewer_id: viewerId, viewed_at: new Date().toISOString() },
        { onConflict: 'status_id,viewer_id' }
      );
    } catch {}
  }

  const viewedSet = new Set(getLocalStore<string[]>('universal_viewed_statuses', []));
  viewedSet.add(statusId);
  setLocalStore('universal_viewed_statuses', Array.from(viewedSet));
}

export async function deleteStatus(statusId: string, userId: string): Promise<boolean> {
  if (!statusId || !userId) return false;

  if (isSupabaseConfigured) {
    try {
      await supabase.from('statuses').delete().eq('id', statusId).eq('user_id', userId);
    } catch {}
  }

  const localStatuses = getLocalStore<UserStatus[]>('universal_local_statuses', []);
  const updated = localStatuses.filter((s) => s.id !== statusId);
  setLocalStore('universal_local_statuses', updated);
  return true;
}

export async function fetchStatusViewers(statusId: string): Promise<Profile[]> {
  if (!statusId) return [];
  if (isSupabaseConfigured) {
    try {
      const { data } = await supabase
        .from('status_views')
        .select('viewer:profiles!viewer_id(*)')
        .eq('status_id', statusId)
        .order('viewed_at', { ascending: false });

      if (data && data.length > 0) {
        return data.map((d: any) => d.viewer).filter(Boolean) as Profile[];
      }
    } catch {}
  }
  return [];
}

// ---------------------------------------------------------------------------
// Calling & Call History
// ---------------------------------------------------------------------------
export async function fetchCallHistory(userId: string): Promise<CallRecord[]> {
  if (!userId) return [];

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('calls')
        .select('*, caller:profiles!caller_id(*), receiver:profiles!receiver_id(*)')
        .or(`caller_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('started_at', { ascending: false })
        .limit(50);

      if (!error && data && data.length > 0) {
        return data as CallRecord[];
      }
    } catch {}
  }

  // Local fallback
  return getLocalStore<CallRecord[]>('universal_local_calls', [
    {
      id: 'demo-call-1',
      caller_id: DEMO_CONTACTS[0].id,
      receiver_id: userId,
      call_type: 'video',
      status: 'ended',
      duration_seconds: 142,
      started_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      ended_at: new Date(Date.now() - 3600000 * 2 + 142000).toISOString(),
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      caller: DEMO_CONTACTS[0],
    },
    {
      id: 'demo-call-2',
      caller_id: DEMO_CONTACTS[1].id,
      receiver_id: userId,
      call_type: 'audio',
      status: 'missed',
      duration_seconds: 0,
      started_at: new Date(Date.now() - 3600000 * 6).toISOString(),
      created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
      caller: DEMO_CONTACTS[1],
    },
  ]);
}

export async function logCallRecord(record: Partial<CallRecord>): Promise<void> {
  if (!record.id) record.id = crypto.randomUUID();

  if (isSupabaseConfigured) {
    try {
      await supabase.from('calls').upsert(record as any);
    } catch {}
  }

  const localCalls = getLocalStore<CallRecord[]>('universal_local_calls', []);
  const existingIdx = localCalls.findIndex((c) => c.id === record.id);
  if (existingIdx >= 0) {
    localCalls[existingIdx] = { ...localCalls[existingIdx], ...record } as CallRecord;
  } else {
    localCalls.unshift(record as CallRecord);
  }
  setLocalStore('universal_local_calls', localCalls);
}

// ---------------------------------------------------------------------------
// Universal Social Feed
// ---------------------------------------------------------------------------
export async function fetchFeedPosts(currentUserId?: string): Promise<Post[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*, user:profiles!user_id(*)')
        .order('created_at', { ascending: false })
        .limit(40);

      if (!error && data && data.length > 0) {
        const postIds = data.map((p) => p.id);
        let myLikes = new Set<string>();

        if (currentUserId && postIds.length > 0) {
          const { data: likesData } = await supabase
            .from('post_likes')
            .select('post_id')
            .eq('user_id', currentUserId)
            .in('post_id', postIds);

          if (likesData) {
            likesData.forEach((l) => myLikes.add(l.post_id));
          }
        }

        return data.map((p) => ({
          ...p,
          has_liked: myLikes.has(p.id),
          likes_count: p.likes_count || 0,
          comments_count: p.comments_count || 0,
        })) as Post[];
      }
    } catch {}
  }

  // Local fallback with rich seed posts
  const localPosts = getLocalStore<Post[]>('universal_local_posts', SEED_FEED_POSTS);
  return localPosts;
}

export async function createFeedPost(
  userId: string,
  content: string,
  mediaUrls?: string[],
  mediaType: 'text' | 'image' | 'video' | 'gif' | 'poll' = 'text',
  pollOptions?: { id: string; text: string; votes: number }[]
): Promise<Post | null> {
  if (!userId) return null;
  const now = new Date().toISOString();

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('posts')
        .insert({
          user_id: userId,
          content: content.trim(),
          media_urls: mediaUrls || [],
          media_type: mediaType,
          poll_options: pollOptions || null,
          likes_count: 0,
          comments_count: 0,
        })
        .select('*, user:profiles!user_id(*)')
        .single();

      if (!error && data) {
        return { ...data, has_liked: false } as Post;
      }
    } catch {}
  }

  // Local fallback
  const demoProfile: Profile = DEMO_CONTACTS.find((c) => c.id === userId) || {
    id: userId,
    username: 'me',
    display_name: 'You',
    avatar_url: null,
    last_seen: now,
    created_at: now,
    updated_at: now,
  };

  const newPost: Post = {
    id: `post_${Date.now()}`,
    user_id: userId,
    content: content.trim(),
    media_urls: mediaUrls || [],
    media_type: mediaType,
    poll_options: pollOptions || undefined,
    likes_count: 0,
    comments_count: 0,
    has_liked: false,
    created_at: now,
    updated_at: now,
    user: demoProfile,
  };

  const localPosts = getLocalStore<Post[]>('universal_local_posts', SEED_FEED_POSTS);
  localPosts.unshift(newPost);
  setLocalStore('universal_local_posts', localPosts);
  return newPost;
}

export async function togglePostLike(
  postId: string,
  userId: string
): Promise<{ liked: boolean; likesCount: number }> {
  if (!postId || !userId) return { liked: false, likesCount: 0 };

  if (isSupabaseConfigured) {
    try {
      const { data: existing } = await supabase
        .from('post_likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        await supabase.from('post_likes').delete().eq('id', existing.id);
        const { data: p } = await supabase.from('posts').select('likes_count').eq('id', postId).single();
        const newCount = Math.max(0, (p?.likes_count || 1) - 1);
        await supabase.from('posts').update({ likes_count: newCount }).eq('id', postId);
        return { liked: false, likesCount: newCount };
      } else {
        await supabase.from('post_likes').insert({ post_id: postId, user_id: userId });
        const { data: p } = await supabase.from('posts').select('likes_count').eq('id', postId).single();
        const newCount = (p?.likes_count || 0) + 1;
        await supabase.from('posts').update({ likes_count: newCount }).eq('id', postId);
        return { liked: true, likesCount: newCount };
      }
    } catch {}
  }

  // Local fallback
  const localPosts = getLocalStore<Post[]>('universal_local_posts', SEED_FEED_POSTS);
  const post = localPosts.find((p) => p.id === postId);
  if (post) {
    post.has_liked = !post.has_liked;
    post.likes_count = post.has_liked
      ? (post.likes_count || 0) + 1
      : Math.max(0, (post.likes_count || 1) - 1);
    setLocalStore('universal_local_posts', localPosts);
    return { liked: Boolean(post.has_liked), likesCount: post.likes_count };
  }
  return { liked: true, likesCount: 1 };
}

export async function fetchPostComments(postId: string): Promise<PostComment[]> {
  if (!postId) return [];

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('post_comments')
        .select('*, user:profiles!user_id(*)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (!error && data && data.length > 0) {
        return data as PostComment[];
      }
    } catch {}
  }

  const allComments = getLocalStore<Record<string, PostComment[]>>('universal_local_comments', {
    'seed-post-1': [
      {
        id: 'comment-1',
        post_id: 'seed-post-1',
        user_id: DEMO_CONTACTS[1].id,
        content: 'Loving the clean typography and responsive calling!',
        created_at: new Date(Date.now() - 3600000).toISOString(),
        user: DEMO_CONTACTS[1],
      },
    ],
  });

  return allComments[postId] || [];
}

export async function deleteFeedPost(
  postId: string,
  userId: string
): Promise<boolean> {
  if (!postId || !userId) return false;

  if (isSupabaseConfigured) {
    try {
      await supabase.from('posts').delete().eq('id', postId).eq('user_id', userId);
    } catch {}
  }

  const localPosts = getLocalStore<Post[]>('universal_local_posts', SEED_FEED_POSTS);
  const updated = localPosts.filter((p) => p.id !== postId);
  setLocalStore('universal_local_posts', updated);
  return true;
}

export async function deletePostComment(
  commentId: string,
  postId: string,
  userId: string
): Promise<boolean> {
  if (!commentId || !postId || !userId) return false;

  if (isSupabaseConfigured) {
    try {
      await supabase.from('post_comments').delete().eq('id', commentId).eq('user_id', userId);
      const { data: p } = await supabase.from('posts').select('comments_count').eq('id', postId).single();
      const newCount = Math.max(0, (p?.comments_count || 1) - 1);
      await supabase.from('posts').update({ comments_count: newCount }).eq('id', postId);
    } catch {}
  }

  const allComments = getLocalStore<Record<string, PostComment[]>>('universal_local_comments', {});
  if (allComments[postId]) {
    allComments[postId] = allComments[postId].filter((c) => c.id !== commentId);
    setLocalStore('universal_local_comments', allComments);
  }

  const localPosts = getLocalStore<Post[]>('universal_local_posts', SEED_FEED_POSTS);
  const post = localPosts.find((p) => p.id === postId);
  if (post) {
    post.comments_count = Math.max(0, (post.comments_count || 1) - 1);
    setLocalStore('universal_local_posts', localPosts);
  }
  return true;
}

export async function addPostComment(
  postId: string,
  userId: string,
  content: string,
  parentCommentId?: string
): Promise<PostComment | null> {
  if (!postId || !userId || !content.trim()) return null;
  const now = new Date().toISOString();

  if (isSupabaseConfigured) {
    try {
      const insertObj: any = {
        post_id: postId,
        user_id: userId,
        content: content.trim(),
      };
      if (parentCommentId) {
        insertObj.parent_comment_id = parentCommentId;
      }

      const { data, error } = await supabase
        .from('post_comments')
        .insert(insertObj)
        .select('*, user:profiles!user_id(*)')
        .single();

      if (!error && data) {
        const { data: p } = await supabase.from('posts').select('comments_count, user_id').eq('id', postId).single();
        const newCount = (p?.comments_count || 0) + 1;
        await supabase.from('posts').update({ comments_count: newCount }).eq('id', postId);

        // Notify post author if not self
        if (p?.user_id && p.user_id !== userId && !p.user_id.startsWith('demo-')) {
          supabase.from('notifications').insert({
            user_id: p.user_id,
            actor_id: userId,
            type: 'comment',
            title: 'New Comment',
            body: `commented on your post: "${content.trim().slice(0, 50)}"`,
            link: postId,
          }).then(() => {});
        }

        return data as PostComment;
      }
    } catch {}
  }

  // Local fallback
  const demoProfile: Profile = DEMO_CONTACTS.find((c) => c.id === userId) || {
    id: userId,
    username: 'me',
    display_name: 'You',
    avatar_url: null,
    last_seen: now,
    created_at: now,
    updated_at: now,
  };

  const newComment: PostComment = {
    id: `comment_${Date.now()}`,
    post_id: postId,
    user_id: userId,
    parent_comment_id: parentCommentId || undefined,
    content: content.trim(),
    created_at: now,
    user: demoProfile,
  };

  const allComments = getLocalStore<Record<string, PostComment[]>>('universal_local_comments', {});
  if (!allComments[postId]) allComments[postId] = [];
  allComments[postId].push(newComment);
  setLocalStore('universal_local_comments', allComments);

  // Update post count
  const localPosts = getLocalStore<Post[]>('universal_local_posts', SEED_FEED_POSTS);
  const post = localPosts.find((p) => p.id === postId);
  if (post) {
    post.comments_count = (post.comments_count || 0) + 1;
    setLocalStore('universal_local_posts', localPosts);
  }

  return newComment;
}

export async function voteOnPoll(
  postId: string,
  userId: string,
  optionId: string
): Promise<Post | null> {
  if (!postId || !userId) return null;

  if (isSupabaseConfigured) {
    try {
      const { data: post } = await supabase.from('posts').select('*').eq('id', postId).single();
      if (post && post.poll_options) {
        const voters = post.poll_voters || {};
        if (voters[userId]) return post as Post;

        voters[userId] = optionId;
        const updatedOptions = post.poll_options.map((opt: any) =>
          opt.id === optionId ? { ...opt, votes: (opt.votes || 0) + 1 } : opt
        );

        const { data: updated, error } = await supabase
          .from('posts')
          .update({ poll_options: updatedOptions, poll_voters: voters })
          .eq('id', postId)
          .select('*, user:profiles!user_id(*)')
          .single();

        if (!error && updated) return updated as Post;
      }
    } catch {}
  }

  // Local fallback
  const localPosts = getLocalStore<Post[]>('universal_local_posts', SEED_FEED_POSTS);
  const post = localPosts.find((p) => p.id === postId);
  if (post && post.poll_options) {
    const voters = post.poll_voters || {};
    if (voters[userId]) return post;

    voters[userId] = optionId;
    post.poll_voters = voters;
    post.poll_options = post.poll_options.map((opt) =>
      opt.id === optionId ? { ...opt, votes: (opt.votes || 0) + 1 } : opt
    );
    setLocalStore('universal_local_posts', localPosts);
    return post;
  }
  return null;
}

export async function toggleFollowUser(
  followerId: string,
  followingId: string
): Promise<boolean> {
  if (!followerId || !followingId || followerId === followingId) return false;

  if (isSupabaseConfigured) {
    try {
      const { data: existing } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', followerId)
        .eq('following_id', followingId)
        .maybeSingle();

      if (existing) {
        await supabase.from('follows').delete().eq('id', existing.id);
        return false;
      } else {
        await supabase.from('follows').insert({ follower_id: followerId, following_id: followingId });
        return true;
      }
    } catch {}
  }

  // Local fallback
  const follows = getLocalStore<Record<string, boolean>>(`follows_${followerId}`, {});
  const isFollowed = Boolean(follows[followingId]);
  follows[followingId] = !isFollowed;
  setLocalStore(`follows_${followerId}`, follows);
  return !isFollowed;
}

export async function checkIsFollowing(
  followerId: string,
  followingId: string
): Promise<boolean> {
  if (!followerId || !followingId) return false;

  if (isSupabaseConfigured) {
    try {
      const { data } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', followerId)
        .eq('following_id', followingId)
        .maybeSingle();

      if (data) return true;
    } catch {}
  }

  const follows = getLocalStore<Record<string, boolean>>(`follows_${followerId}`, {});
  return Boolean(follows[followingId]);
}

// ---------------------------------------------------------------------------
// Universal Drive
// ---------------------------------------------------------------------------
export async function fetchDriveFiles(userId: string): Promise<DriveFile[]> {
  if (!userId) return [];

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('drive_files')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data as DriveFile[];
      }
    } catch {}
  }

  // Local fallback
  return getLocalStore<DriveFile[]>('universal_local_drive', SEED_DRIVE_FILES);
}

export async function uploadDriveFile(
  userId: string,
  file: File,
  folderName: string = 'General'
): Promise<DriveFile | null> {
  if (!userId) return null;

  const uploadRes = await uploadFileToStorage(file, 'drive-files');
  const fileUrl = uploadRes.publicUrl || URL.createObjectURL(file);
  const now = new Date().toISOString();

  if (isSupabaseConfigured && uploadRes.publicUrl) {
    try {
      const { data, error } = await supabase
        .from('drive_files')
        .insert({
          user_id: userId,
          folder_name: folderName,
          name: file.name,
          file_url: fileUrl,
          file_type: file.type || 'application/octet-stream',
          file_size: file.size,
        })
        .select('*')
        .single();

      if (!error && data) {
        return data as DriveFile;
      }
    } catch {}
  }

  // Local fallback
  const newFile: DriveFile = {
    id: `drive_${Date.now()}`,
    user_id: userId,
    folder_name: folderName,
    name: file.name,
    file_url: fileUrl,
    file_type: file.type || 'application/octet-stream',
    file_size: file.size,
    created_at: now,
  };

  const localDrive = getLocalStore<DriveFile[]>('universal_local_drive', SEED_DRIVE_FILES);
  localDrive.unshift(newFile);
  setLocalStore('universal_local_drive', localDrive);
  return newFile;
}

export async function deleteDriveFile(fileId: string, userId: string): Promise<boolean> {
  if (!fileId || !userId) return false;

  if (isSupabaseConfigured) {
    try {
      await supabase.from('drive_files').delete().eq('id', fileId).eq('user_id', userId);
    } catch {}
  }

  const localDrive = getLocalStore<DriveFile[]>('universal_local_drive', SEED_DRIVE_FILES);
  const updated = localDrive.filter((f) => f.id !== fileId);
  setLocalStore('universal_local_drive', updated);
  return true;
}

// ---------------------------------------------------------------------------
// Message Capsule & Memory Board
// ---------------------------------------------------------------------------
export async function fetchMessageCapsules(userId: string): Promise<MessageCapsule[]> {
  if (!userId) return [];

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('message_capsules')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data as MessageCapsule[];
      }
    } catch {}
  }

  return getLocalStore<MessageCapsule[]>('universal_local_capsules', SEED_CAPSULES);
}

export async function createMessageCapsule(
  userId: string,
  title: string,
  category: 'note' | 'media' | 'message' | 'link' | 'reminder',
  description?: string,
  items?: any
): Promise<MessageCapsule | null> {
  if (!userId || !title.trim()) return null;
  const now = new Date().toISOString();

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('message_capsules')
        .insert({
          user_id: userId,
          title: title.trim(),
          category,
          description: description?.trim() || null,
          items: items || null,
        })
        .select('*')
        .single();

      if (!error && data) {
        return data as MessageCapsule;
      }
    } catch {}
  }

  // Local fallback
  const newCapsule: MessageCapsule = {
    id: `capsule_${Date.now()}`,
    user_id: userId,
    title: title.trim(),
    category,
    description: description?.trim() || null,
    items: items || null,
    created_at: now,
  };

  const localCapsules = getLocalStore<MessageCapsule[]>('universal_local_capsules', SEED_CAPSULES);
  localCapsules.unshift(newCapsule);
  setLocalStore('universal_local_capsules', localCapsules);
  return newCapsule;
}

export async function deleteMessageCapsule(id: string, userId: string): Promise<boolean> {
  if (!id || !userId) return false;

  if (isSupabaseConfigured) {
    try {
      await supabase.from('message_capsules').delete().eq('id', id).eq('user_id', userId);
    } catch {}
  }

  const localCapsules = getLocalStore<MessageCapsule[]>('universal_local_capsules', SEED_CAPSULES);
  const updated = localCapsules.filter((c) => c.id !== id);
  setLocalStore('universal_local_capsules', updated);
  return true;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export async function fetchUserNotifications(userId: string): Promise<AppNotification[]> {
  if (!userId) return [];

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*, actor:profiles!actor_id(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);

      if (!error && data && data.length > 0) {
        return data as AppNotification[];
      }
    } catch {}
  }

  return getLocalStore<AppNotification[]>('universal_local_notifs', [
    {
      id: 'demo-notif-1',
      user_id: userId,
      actor_id: DEMO_CONTACTS[0].id,
      type: 'message',
      title: 'New Message',
      body: 'Hassam sent you a welcome message on Universal.',
      is_read: false,
      created_at: new Date(Date.now() - 60000 * 15).toISOString(),
      actor: DEMO_CONTACTS[0],
    },
  ]);
}

export async function markNotificationAsRead(id: string): Promise<void> {
  if (!id) return;
  if (isSupabaseConfigured) {
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    } catch {}
  }

  const localNotifs = getLocalStore<AppNotification[]>('universal_local_notifs', []);
  const target = localNotifs.find((n) => n.id === id);
  if (target) {
    target.is_read = true;
    setLocalStore('universal_local_notifs', localNotifs);
  }
}

export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  if (!userId) return;
  if (isSupabaseConfigured) {
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId);
    } catch {}
  }

  const localNotifs = getLocalStore<AppNotification[]>('universal_local_notifs', []);
  localNotifs.forEach((n) => (n.is_read = true));
  setLocalStore('universal_local_notifs', localNotifs);
}

// ---------------------------------------------------------------------------
// Blocked Users
// ---------------------------------------------------------------------------
export async function fetchBlockedUsers(blockerId: string): Promise<Profile[]> {
  if (!blockerId) return [];

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('blocked_users')
        .select('blocked:profiles!blocked_id(*)')
        .eq('blocker_id', blockerId);

      if (!error && data && data.length > 0) {
        return data.map((d: any) => d.blocked).filter(Boolean) as Profile[];
      }
    } catch {}
  }

  return getLocalStore<Profile[]>('universal_local_blocked', []);
}

export async function blockUser(blockerId: string, blockedId: string): Promise<boolean> {
  if (!blockerId || !blockedId) return false;

  if (isSupabaseConfigured) {
    try {
      await supabase.from('blocked_users').upsert(
        { blocker_id: blockerId, blocked_id: blockedId },
        { onConflict: 'blocker_id,blocked_id' }
      );
    } catch {}
  }

  const blocked = getLocalStore<Profile[]>('universal_local_blocked', []);
  const contact = DEMO_CONTACTS.find((c) => c.id === blockedId);
  if (contact && !blocked.some((b) => b.id === blockedId)) {
    blocked.push(contact);
    setLocalStore('universal_local_blocked', blocked);
  }
  return true;
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<boolean> {
  if (!blockerId || !blockedId) return false;

  if (isSupabaseConfigured) {
    try {
      await supabase
        .from('blocked_users')
        .delete()
        .eq('blocker_id', blockerId)
        .eq('blocked_id', blockedId);
    } catch {}
  }

  const blocked = getLocalStore<Profile[]>('universal_local_blocked', []);
  setLocalStore('universal_local_blocked', blocked.filter((b) => b.id !== blockedId));
  return true;
}

// ---------------------------------------------------------------------------
// Global Search
// ---------------------------------------------------------------------------
export async function globalSearch(
  query: string,
  userId: string
): Promise<{
  users: Profile[];
  messages: Message[];
  posts: Post[];
  files: DriveFile[];
}> {
  if (!query.trim()) {
    return { users: [], messages: [], posts: [], files: [] };
  }

  const q = query.trim().replace(/^@/, '').toLowerCase();
  const users = await searchUsers(q, userId);

  // Search local messages
  const localMessages = getLocalStore<Message[]>('universal_local_messages', []);
  const matchingMsgs = localMessages.filter((m) => m.content?.toLowerCase().includes(q)).slice(0, 10);

  // Search posts
  const feedPosts = await fetchFeedPosts(userId);
  const matchingPosts = feedPosts.filter((p) => p.content?.toLowerCase().includes(q)).slice(0, 10);

  // Search drive files
  const driveFiles = await fetchDriveFiles(userId);
  const matchingFiles = driveFiles.filter((f) => f.name?.toLowerCase().includes(q)).slice(0, 8);

  return {
    users,
    messages: matchingMsgs,
    posts: matchingPosts,
    files: matchingFiles,
  };
}

// ---------------------------------------------------------------------------
// Privacy, Data Export & Account Deletion
// ---------------------------------------------------------------------------
export async function exportUserData(userId: string): Promise<Record<string, any>> {
  if (!userId) throw new Error('User ID is required');

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.rpc('export_own_user_data');
      if (!error && data) {
        return data;
      }
    } catch (e) {
      console.warn('RPC export_own_user_data fallback:', e);
    }
  }

  // Resilient fallback: gather local state
  const profile = getLocalStore<Profile | null>('universal_user_profile', null);
  const posts = getLocalStore<Post[]>('universal_local_posts', []).filter((p) => p.user_id === userId);
  const statuses = getLocalStore<UserStatus[]>('universal_local_statuses', []).filter((s) => s.user_id === userId);
  const calls = getLocalStore<CallRecord[]>('universal_call_history', []).filter(
    (c) => c.caller_id === userId || c.receiver_id === userId
  );
  const drive = getLocalStore<DriveFile[]>('universal_drive_files', []).filter((d) => d.user_id === userId);
  const capsules = getLocalStore<MessageCapsule[]>('universal_message_capsules', []).filter((m) => m.user_id === userId);

  return {
    exported_at: new Date().toISOString(),
    user_id: userId,
    profile,
    posts,
    statuses,
    call_history: calls,
    drive_files: drive,
    message_capsules: capsules,
    privacy_statement: 'Exported under Universal Privacy & Data Portability Policy.',
  };
}

export async function deleteUserAccount(userId: string): Promise<{ success: boolean; error?: string }> {
  if (!userId) return { success: false, error: 'User ID is required' };

  if (isSupabaseConfigured) {
    try {
      // Call secure database cascade RPC
      const { error: rpcError } = await supabase.rpc('delete_own_user_account');
      if (rpcError) {
        console.warn('RPC delete_own_user_account failed, attempting client-level purge:', rpcError);
        // Direct table cleanup where user owns data
        await supabase.from('statuses').delete().eq('user_id', userId);
        await supabase.from('posts').delete().eq('user_id', userId);
        await supabase.from('drive_files').delete().eq('user_id', userId);
        await supabase.from('message_capsules').delete().eq('user_id', userId);
        await supabase.from('notifications').delete().eq('user_id', userId);
        await supabase.from('profiles').delete().eq('id', userId);
      }
    } catch (e: any) {
      console.warn('Backend purge error:', e);
    }
  }

  // Clear all client-stored records & credentials
  try {
    localStorage.removeItem('universal_user_profile');
    localStorage.removeItem('universal_demo_session');
    localStorage.removeItem('universal_call_history');
    localStorage.removeItem('universal_drive_files');
    localStorage.removeItem('universal_message_capsules');
    localStorage.removeItem('universal_local_statuses');
    localStorage.removeItem('universal_local_posts');
    localStorage.removeItem('universal_local_notifs');
    localStorage.removeItem('universal_local_blocked');
  } catch {}

  return { success: true };
}

