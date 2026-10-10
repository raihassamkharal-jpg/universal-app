export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  cover_url?: string | null;
  bio?: string | null;
  status?: string | null;
  last_seen: string;
  created_at: string;
  updated_at: string;
  custom_ringtone_url?: string | null;
  custom_outgoing_tone_url?: string | null;
  custom_notification_sound_url?: string | null;
  theme_preference?: 'light' | 'dark' | 'system';
  language?: 'en' | 'ur' | 'hi' | 'ar';
  privacy_profile_visibility?: 'everyone' | 'contacts' | 'nobody';
  privacy_read_receipts?: boolean;
  privacy_typing?: boolean;
  privacy_calls?: 'everyone' | 'contacts' | 'nobody';
  privacy_online?: 'everyone' | 'contacts' | 'nobody';
  privacy_status?: 'everyone' | 'contacts' | 'nobody';
}

export interface ConversationMember {
  id: string;
  conversation_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string;
  is_pinned?: boolean;
  is_muted?: boolean;
  is_archived?: boolean;
  custom_nickname?: string | null;
}

export type MessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'voice'
  | 'document'
  | 'file'
  | 'sticker'
  | 'gif';

export interface UserStatus {
  id: string;
  user_id: string;
  content?: string | null;
  media_url?: string | null;
  background_color?: string | null;
  created_at: string;
  expires_at: string;
  user?: Profile;
  views_count?: number;
  has_viewed?: boolean;
}

export interface StatusView {
  id: string;
  status_id: string;
  viewer_id: string;
  viewed_at: string;
  viewer?: Profile;
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
  user?: Profile;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  message_type?: MessageType;
  file_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  file_type?: string | null;
  duration_seconds?: number | null;
  reply_to_message_id?: string | null;
  reply_message?: Message | null;
  is_edited?: boolean;
  edited_at?: string | null;
  is_deleted_everyone?: boolean;
  deleted_at?: string | null;
  deleted_for_users?: string[];
  reactions?: MessageReaction[];
  is_pinned?: boolean;
  is_starred?: boolean;
  is_forwarded?: boolean;
  expires_at?: string | null;
}

export interface ConversationWithDetails {
  id: string;
  created_at: string;
  updated_at: string;
  other_user: Profile;
  last_message?: Message | null;
  unread_count: number;
  is_pinned?: boolean;
  is_muted?: boolean;
  is_archived?: boolean;
}

export interface TypingIndicatorState {
  userId: string;
  username: string;
  timestamp: number;
}

// -------------------------------------------------------------
// Calling & WebRTC Types
// -------------------------------------------------------------

export type CallType = 'audio' | 'video';
export type CallStatus =
  | 'calling'
  | 'ringing'
  | 'accepted'
  | 'connecting'
  | 'connected'
  | 'rejected'
  | 'missed'
  | 'ended'
  | 'busy'
  | 'failed'
  | 'cancelled';

export interface CallRecord {
  id: string;
  conversation_id?: string | null;
  caller_id: string;
  receiver_id: string;
  call_type: CallType;
  status: CallStatus;
  started_at: string;
  answered_at?: string | null;
  ended_at?: string | null;
  duration_seconds?: number | null;
  duration?: number | null;
  end_reason?: string | null;
  created_at: string;
  caller?: Profile;
  receiver?: Profile;
}

export type SignalType =
  | 'call-offer'
  | 'call-answer'
  | 'ice-candidate'
  | 'call-accepted'
  | 'call-rejected'
  | 'call-busy'
  | 'call-ended'
  | 'call-timeout'
  | 'offer'
  | 'answer'
  | 'candidate'
  | 'end'
  | 'reject'
  | 'busy'
  | 'accept';

export interface CallSignalPayload {
  callId: string;
  callerId: string;
  receiverId: string;
  type: SignalType;
  callType: CallType;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  callerProfile?: Profile;
}

export interface UserDeviceRegistration {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent?: string | null;
  device_type?: 'web' | 'mobile' | 'pwa';
  is_active: boolean;
  last_active_at: string;
  created_at: string;
  updated_at: string;
}

// -------------------------------------------------------------
// Social Feed Types
// -------------------------------------------------------------

export interface Post {
  id: string;
  user_id: string;
  content: string;
  media_urls?: string[];
  media_type?: 'text' | 'image' | 'video' | 'gif' | 'poll';
  poll_options?: { id: string; text: string; votes: number }[];
  poll_voters?: Record<string, string>; // userId -> optionId
  created_at: string;
  updated_at: string;
  user?: Profile;
  likes_count: number;
  comments_count: number;
  has_liked?: boolean;
  has_bookmarked?: boolean;
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  parent_comment_id?: string | null;
  content: string;
  created_at: string;
  user?: Profile;
  replies?: PostComment[];
}

// -------------------------------------------------------------
// Drive Types
// -------------------------------------------------------------

export interface DriveFile {
  id: string;
  user_id: string;
  folder_name?: string | null;
  name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

// -------------------------------------------------------------
// Message Capsule & Memory Board Types
// -------------------------------------------------------------

export interface MessageCapsule {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  category: 'note' | 'media' | 'message' | 'link' | 'reminder';
  items?: any;
  created_at: string;
}

// -------------------------------------------------------------
// Notification Types
// -------------------------------------------------------------

export type NotificationType =
  | 'message'
  | 'call'
  | 'missed_call'
  | 'reaction'
  | 'follow'
  | 'comment'
  | 'post_like'
  | 'mention'
  | 'group_invite';

export interface AppNotification {
  id: string;
  user_id: string;
  actor_id?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
  is_read: boolean;
  created_at: string;
  actor?: Profile;
}

// Navigation Tabs
export type MainViewTab = 'chats' | 'calls' | 'social' | 'drive' | 'capsule';
