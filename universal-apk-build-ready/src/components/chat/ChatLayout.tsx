import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MessageSquare, Search, Plus } from 'lucide-react';
import { ConversationList } from './ConversationList';
import { ChatArea } from './ChatArea';
import { UserSearchModal } from './UserSearchModal';
import { UserProfileModal } from './UserProfileModal';
import { CreateStatusModal } from '../status/CreateStatusModal';
import { StatusViewerModal } from '../status/StatusViewerModal';
import {
  fetchUserConversations,
  getOrCreateConversation,
  fetchActiveStatuses,
  supabase,
  isSupabaseConfigured,
} from '../../lib/supabase/client';
import { requestNotificationPermission } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import type { ConversationWithDetails, Profile, Message, UserStatus } from '../../types/database';

interface ChatLayoutProps {
  onActiveChatChange?: (isActive: boolean) => void;
}

export const ChatLayout: React.FC<ChatLayoutProps> = ({ onActiveChatChange }) => {
  const { user, profile } = useAuth();
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [activeOtherUser, setActiveOtherUser] = useState<Profile | null>(null);
  const selectedConversationIdRef = useRef<string | null>(selectedConversationId);
  const processedMessageIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
    onActiveChatChange?.(Boolean(selectedConversationId));
  }, [selectedConversationId, onActiveChatChange]);

  // Status / Stories state
  const [statuses, setStatuses] = useState<UserStatus[]>([]);
  const [isCreateStatusOpen, setIsCreateStatusOpen] = useState(false);
  const [viewerState, setViewerState] = useState<{
    isOpen: boolean;
    statuses: UserStatus[];
    initialIndex: number;
  }>({
    isOpen: false,
    statuses: [],
    initialIndex: 0,
  });

  // Modals
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [profileModalTarget, setProfileModalTarget] = useState<Profile | null | 'SELF'>(null);

  // Ask for notification permission once on layout mount
  useEffect(() => {
    requestNotificationPermission().catch(() => {});
  }, []);

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!user) return;
    const list = await fetchUserConversations(user.id);
    setConversations(list);
    setLoading(false);
  }, [user]);

  // Load active 24h statuses
  const loadStatuses = useCallback(async () => {
    if (!user) return;
    const list = await fetchActiveStatuses(user.id);
    setStatuses(list);
  }, [user]);

  useEffect(() => {
    loadConversations();
    loadStatuses();
  }, [loadConversations, loadStatuses]);

  // Realtime listener for status changes
  useEffect(() => {
    if (!user || !isSupabaseConfigured) return;

    const channel = supabase
      .channel('statuses_realtime_feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'statuses' },
        () => {
          loadStatuses();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadStatuses]);

  // Global Realtime listener for conversations and messages updates
  useEffect(() => {
    if (!user || !isSupabaseConfigured) return;

    const handleIncomingMessage = (newMsg: Message) => {
      if (!newMsg || !newMsg.conversation_id) return;
      if (processedMessageIdsRef.current.has(newMsg.id)) return;
      processedMessageIdsRef.current.add(newMsg.id);

      const isIncoming = newMsg.sender_id !== user.id;

      setConversations((prev) => {
        const exists = prev.some((c) => c.id === newMsg.conversation_id);
        if (!exists) {
          // If conversation isn't in current list, load fresh list
          loadConversations();
          return prev;
        }

        const updated = prev.map((c) => {
          if (c.id === newMsg.conversation_id) {
            const isCurrentlySelected = selectedConversationIdRef.current === c.id;
            return {
              ...c,
              last_message: newMsg,
              updated_at: newMsg.created_at || new Date().toISOString(),
              unread_count: isIncoming && !isCurrentlySelected ? (c.unread_count || 0) + 1 : c.unread_count,
            };
          }
          return c;
        });

        // Re-sort: pinned first, then by latest message/updated_at descending
        return [...updated].sort((a, b) => {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
          const timeA = a.last_message?.created_at || a.updated_at;
          const timeB = b.last_message?.created_at || b.updated_at;
          return new Date(timeB).getTime() - new Date(timeA).getTime();
        });
      });
    };

    // 1. Cross-tab BroadcastChannel listener
    let localBc: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        localBc = new BroadcastChannel('universal_chat_events');
        localBc.onmessage = (event) => {
          if (event.data?.type === 'NEW_MESSAGE' && event.data.message) {
            handleIncomingMessage(event.data.message);
          } else if (event.data?.type === 'CONVERSATIONS_CHANGED') {
            loadConversations();
          }
        };
      }
    } catch {}

    // 2. Supabase Realtime channel dedicated to this user
    const channelName = `user_conversations_${user.id}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          handleIncomingMessage(payload.new as Message);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    // 3. Tab visibility & online recovery
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadConversations();
      }
    };
    const handleOnline = () => {
      loadConversations();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      if (localBc) {
        localBc.close();
      }
      supabase.removeChannel(channel);
    };
  }, [user, loadConversations]);

  // Select a user from search and start / open conversation
  const handleSelectUserFromSearch = async (targetUser: Profile) => {
    if (!user) return;

    const convId = await getOrCreateConversation(user.id, targetUser.id);
    if (!convId) {
      throw new Error('Could not create or open conversation');
    }

    // Set other user and active ID immediately to prevent blank transition or lag
    setActiveOtherUser(targetUser);
    setSelectedConversationId(convId);

    // Optimistically insert conversation into list if not already present
    setConversations((prev) => {
      const existing = prev.find((c) => c.id === convId);
      if (existing) {
        return [
          { ...existing, other_user: targetUser },
          ...prev.filter((c) => c.id !== convId),
        ];
      }
      const newEntry: ConversationWithDetails = {
        id: convId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        other_user: targetUser,
        last_message: null,
        unread_count: 0,
      };
      return [newEntry, ...prev];
    });

    // Re-sync with server
    loadConversations();
  };

  const activeConversation = conversations.find((c) => c.id === selectedConversationId);
  const currentOtherUser = activeConversation?.other_user || activeOtherUser;

  return (
    <div className="flex-1 flex overflow-hidden relative w-full h-full min-h-0 min-w-0">
      {/* Sidebar: Conversation List */}
      <div
        className={`w-full md:w-80 lg:w-96 shrink-0 h-full min-h-0 flex flex-col transition-all duration-200 ${
          selectedConversationId ? 'hidden md:flex' : 'flex'
        }`}
      >
        <ConversationList
          conversations={conversations}
          selectedConversationId={selectedConversationId}
          onSelectConversation={(id) => {
            setSelectedConversationId(id);
            const conv = conversations.find((c) => c.id === id);
            if (conv) {
              setActiveOtherUser(conv.other_user);
            }
          }}
          onOpenSearch={() => setIsSearchOpen(true)}
          loading={loading}
          currentUserId={user?.id || ''}
          onRefreshConversations={loadConversations}
          statuses={statuses}
          currentUserProfile={profile}
          onOpenCreateStatus={() => setIsCreateStatusOpen(true)}
          onOpenStatusViewer={(st, idx) =>
            setViewerState({ isOpen: true, statuses: st, initialIndex: idx || 0 })
          }
        />
      </div>

      {/* Main Chat Area */}
      <div
        className={`flex-1 h-full min-h-0 min-w-0 flex flex-col bg-neutral-50 dark:bg-neutral-950 overflow-hidden ${
          !selectedConversationId ? 'hidden md:flex' : 'flex'
        }`}
      >
        {selectedConversationId && currentOtherUser && user ? (
          <ChatArea
            key={selectedConversationId}
            conversationId={selectedConversationId}
            otherUser={currentOtherUser}
            currentUserId={user.id}
            onBackMobile={() => {
              setSelectedConversationId(null);
              setActiveOtherUser(null);
            }}
            onOpenProfile={(u) => setProfileModalTarget(u)}
            onNewMessageSent={(msg) => {
              setConversations((prev) =>
                prev.map((c) =>
                  c.id === msg.conversation_id
                    ? { ...c, last_message: msg, updated_at: msg.created_at }
                    : c
                )
              );
              loadConversations();
            }}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-white/40 dark:bg-neutral-900/40">
            <div className="w-16 h-16 rounded-3xl bg-orange-50 dark:bg-orange-950/40 text-orange-500 flex items-center justify-center mb-4 shadow-xs">
              <MessageSquare className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Universal</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mt-1 leading-relaxed">
              Select an existing chat from the list, or search for any member by their unique @username
              to start a new conversation.
            </p>
            <button
              onClick={() => setIsSearchOpen(true)}
              className="mt-5 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Search className="w-4 h-4" />
              <span>Search Users by Handle</span>
            </button>
          </div>
        )}
      </div>

      {/* Search Modal */}
      <UserSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectUser={handleSelectUserFromSearch}
      />

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={profileModalTarget !== null}
        onClose={() => setProfileModalTarget(null)}
        targetUser={profileModalTarget === 'SELF' ? null : profileModalTarget}
      />

      {/* Create Status Modal */}
      {user && (
        <CreateStatusModal
          isOpen={isCreateStatusOpen}
          userId={user.id}
          onClose={() => setIsCreateStatusOpen(false)}
          onStatusCreated={(newSt) => {
            setStatuses((prev) => [newSt, ...prev]);
            loadStatuses();
          }}
        />
      )}

      {/* Status Viewer Modal */}
      {user && (
        <StatusViewerModal
          isOpen={viewerState.isOpen}
          statuses={viewerState.statuses}
          initialIndex={viewerState.initialIndex}
          currentUserId={user.id}
          onClose={() => setViewerState({ isOpen: false, statuses: [], initialIndex: 0 })}
          onStatusDeleted={(delId) => {
            setStatuses((prev) => prev.filter((s) => s.id !== delId));
            loadStatuses();
          }}
        />
      )}
    </div>
  );
};
