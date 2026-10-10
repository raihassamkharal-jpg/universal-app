import React, { useState } from 'react';
import {
  Search,
  Plus,
  MessageSquare,
  CheckCheck,
  Check,
  Pin,
  VolumeX,
  Archive,
  MoreVertical,
  Image as ImageIcon,
  Video,
  Mic,
  FileText,
} from 'lucide-react';
import { getInitials, getAvatarColor, formatMessageTime, formatLastSeen } from '../../lib/utils';
import { updateConversationMembership } from '../../lib/supabase/client';
import { StatusTray } from '../status/StatusTray';
import type { ConversationWithDetails, UserStatus, Profile } from '../../types/database';

interface ConversationListProps {
  conversations: ConversationWithDetails[];
  selectedConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onOpenSearch: () => void;
  loading: boolean;
  currentUserId: string;
  onRefreshConversations?: () => void;
  statuses?: UserStatus[];
  currentUserProfile?: Profile | null;
  onOpenCreateStatus?: () => void;
  onOpenStatusViewer?: (statuses: UserStatus[], startIndex?: number) => void;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  selectedConversationId,
  onSelectConversation,
  onOpenSearch,
  loading,
  currentUserId,
  onRefreshConversations,
  statuses = [],
  currentUserProfile = null,
  onOpenCreateStatus,
  onOpenStatusViewer,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [activeMenuConvId, setActiveMenuConvId] = useState<string | null>(null);

  // Filter conversations by search input
  const filtered = conversations.filter((c) => {
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase().trim();
    return (
      c.other_user.display_name.toLowerCase().includes(q) ||
      c.other_user.username.toLowerCase().includes(q) ||
      (c.last_message?.content || '').toLowerCase().includes(q) ||
      (c.last_message?.file_name || '').toLowerCase().includes(q)
    );
  });

  const handleTogglePin = async (conv: ConversationWithDetails, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveMenuConvId(null);
    await updateConversationMembership(conv.id, currentUserId, {
      is_pinned: !conv.is_pinned,
    });
    onRefreshConversations?.();
  };

  const handleToggleMute = async (conv: ConversationWithDetails, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveMenuConvId(null);
    await updateConversationMembership(conv.id, currentUserId, {
      is_muted: !conv.is_muted,
    });
    onRefreshConversations?.();
  };

  const handleToggleArchive = async (conv: ConversationWithDetails, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveMenuConvId(null);
    await updateConversationMembership(conv.id, currentUserId, {
      is_archived: !conv.is_archived,
    });
    onRefreshConversations?.();
  };

  // Helper to render last message preview with icons
  const renderLastMessagePreview = (conv: ConversationWithDetails) => {
    const msg = conv.last_message;
    if (!msg) return <span>Started conversation</span>;

    if (msg.is_deleted_everyone) {
      return <span className="italic text-neutral-400 dark:text-neutral-500">🚫 Message deleted</span>;
    }

    const type = msg.message_type || 'text';
    if (type === 'image') {
      return (
        <span className="flex items-center gap-1">
          <ImageIcon className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          <span>Photo</span>
        </span>
      );
    }
    if (type === 'video') {
      return (
        <span className="flex items-center gap-1">
          <Video className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          <span>Video</span>
        </span>
      );
    }
    if (type === 'voice') {
      return (
        <span className="flex items-center gap-1">
          <Mic className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          <span>Voice message ({msg.duration_seconds || 0}s)</span>
        </span>
      );
    }
    if (type === 'file') {
      return (
        <span className="flex items-center gap-1">
          <FileText className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          <span className="truncate">{msg.file_name || 'Document'}</span>
        </span>
      );
    }

    return <span className="truncate">{msg.content}</span>;
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100">
      {/* Top Bar: Search Input & New Chat Button */}
      <div className="p-3.5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/60 space-y-2">
        <div className="flex items-center gap-2">
          {/* Quick Filter Input */}
          <div className="flex-1 relative flex items-center">
            <Search className="w-4 h-4 text-neutral-400 dark:text-neutral-500 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-700/90 rounded-xl text-xs placeholder-neutral-400 dark:placeholder-neutral-500 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-all shadow-2xs"
            />
          </div>

          {/* New Chat Button */}
          <button
            onClick={onOpenSearch}
            className="p-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
            title="Start new conversation"
            aria-label="Start new conversation"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 24-Hour Status / Stories Tray */}
      {onOpenCreateStatus && onOpenStatusViewer && (
        <StatusTray
          currentUser={currentUserProfile}
          statuses={statuses}
          onOpenCreate={onOpenCreateStatus}
          onOpenViewer={onOpenStatusViewer}
        />
      )}

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800">
        {loading ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-neutral-200 dark:bg-neutral-800 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-neutral-200 dark:bg-neutral-800 rounded-sm w-1/2" />
                  <div className="h-3 bg-neutral-100 dark:bg-neutral-800/60 rounded-sm w-4/5" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-neutral-400 dark:text-neutral-500">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 dark:bg-orange-950/40 text-orange-500 flex items-center justify-center mb-3">
              <MessageSquare className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
              {filterQuery ? 'No chats found' : 'No conversations yet'}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-[200px] leading-relaxed">
              {filterQuery
                ? 'Try a different search term'
                : 'Find another user by their unique username to start chatting.'}
            </p>
            {!filterQuery && (
              <button
                onClick={onOpenSearch}
                className="mt-4 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Start Conversation</span>
              </button>
            )}
          </div>
        ) : (
          filtered.map((conv) => {
            const isSelected = conv.id === selectedConversationId;
            const presence = formatLastSeen(conv.other_user.last_seen);
            const isMyLastMessage = conv.last_message?.sender_id === currentUserId;

            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`relative group w-full p-3.5 flex items-center gap-3 text-left transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-orange-50/70 dark:bg-orange-950/30 border-l-4 border-orange-500 pl-2.5'
                    : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                }`}
              >
                {/* Avatar with presence dot */}
                <div className="relative shrink-0">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white overflow-hidden ${
                      conv.other_user.avatar_url
                        ? 'bg-neutral-200 dark:bg-neutral-800'
                        : getAvatarColor(conv.other_user.username)
                    }`}
                  >
                    {conv.other_user.avatar_url ? (
                      <img
                        src={conv.other_user.avatar_url}
                        alt={conv.other_user.display_name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      getInitials(conv.other_user.display_name || conv.other_user.username)
                    )}
                  </div>

                  {presence.isOnline && (
                    <span
                      className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-900"
                      title="Online"
                    />
                  )}
                </div>

                {/* Info & Last message */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-semibold text-sm text-neutral-900 dark:text-white truncate">
                        {conv.other_user.display_name}
                      </span>
                      {conv.is_pinned && (
                        <Pin className="w-3 h-3 text-orange-500 fill-orange-500 shrink-0" />
                      )}
                      {conv.is_muted && (
                        <VolumeX className="w-3 h-3 text-neutral-400 dark:text-neutral-500 shrink-0" />
                      )}
                    </div>
                    <span className="text-[11px] text-neutral-400 dark:text-neutral-500 font-medium shrink-0 ml-2">
                      {formatMessageTime(conv.last_message?.created_at || conv.updated_at)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1 min-w-0 text-xs text-neutral-500 dark:text-neutral-400 truncate">
                      {isMyLastMessage && (
                        conv.last_message?.is_read ? (
                          <CheckCheck className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 shrink-0" />
                        )
                      )}
                      <span className="truncate">{renderLastMessagePreview(conv)}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {conv.unread_count > 0 && (
                        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-orange-500 text-white font-bold text-[11px] flex items-center justify-center shadow-xs">
                          {conv.unread_count > 99 ? '99+' : conv.unread_count}
                        </span>
                      )}

                      {/* Options menu trigger */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuConvId(activeMenuConvId === conv.id ? null : conv.id);
                        }}
                        className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-white rounded transition-opacity cursor-pointer"
                        title="Chat options"
                        aria-label="Chat options"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Popover Menu */}
                {activeMenuConvId === conv.id && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-2 top-12 z-30 w-40 bg-white dark:bg-neutral-800 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-700 py-1 text-xs animate-in fade-in"
                  >
                    <button
                      type="button"
                      onClick={(e) => handleTogglePin(conv, e)}
                      className="w-full px-3 py-1.5 text-left text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2 cursor-pointer"
                    >
                      <Pin className="w-3.5 h-3.5" />
                      <span>{conv.is_pinned ? 'Unpin Chat' : 'Pin Chat'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleToggleMute(conv, e)}
                      className="w-full px-3 py-1.5 text-left text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2 cursor-pointer"
                    >
                      <VolumeX className="w-3.5 h-3.5" />
                      <span>{conv.is_muted ? 'Unmute' : 'Mute Notifications'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleToggleArchive(conv, e)}
                      className="w-full px-3 py-1.5 text-left text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2 cursor-pointer"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>{conv.is_archived ? 'Unarchive' : 'Archive Chat'}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
