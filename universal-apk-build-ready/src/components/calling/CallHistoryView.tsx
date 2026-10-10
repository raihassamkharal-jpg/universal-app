import React, { useState, useEffect, useCallback } from 'react';
import {
  Phone,
  Video,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Clock,
  Search,
  Plus,
  Loader2,
  Sliders,
} from 'lucide-react';
import { fetchCallHistory, supabase, isSupabaseConfigured } from '../../lib/supabase/client';
import { callManager } from '../../lib/webrtc/callManager';
import { getInitials, getAvatarColor, formatMessageTime, formatDuration } from '../../lib/utils';
import type { CallRecord, Profile } from '../../types/database';

interface CallHistoryViewProps {
  currentUserId: string;
  onOpenSettings?: () => void;
  onStartNewCall?: () => void;
}

export const CallHistoryView: React.FC<CallHistoryViewProps> = ({
  currentUserId,
  onOpenSettings,
  onStartNewCall,
}) => {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'missed' | 'audio' | 'video'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadHistory = useCallback(async () => {
    setLoading(true);
    const records = await fetchCallHistory(currentUserId);
    setCalls(records);
    setLoading(false);
  }, [currentUserId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Realtime subscription to calls table and callManager updates
  useEffect(() => {
    const unsubManager = callManager.subscribe((state) => {
      if (
        state?.status === 'ended' ||
        state?.status === 'rejected' ||
        state?.status === 'missed'
      ) {
        loadHistory();
      }
    });

    if (!isSupabaseConfigured || !currentUserId) {
      return unsubManager;
    }

    const channel = supabase
      .channel(`call_history_realtime_${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calls',
        },
        () => {
          loadHistory();
        }
      )
      .subscribe();

    return () => {
      unsubManager();
      supabase.removeChannel(channel);
    };
  }, [currentUserId, loadHistory]);

  const handleCallBack = (targetUser: Profile, callType: 'audio' | 'video') => {
    callManager.startCall(targetUser, callType);
  };

  const filteredCalls = calls.filter((c) => {
    const isMissed = c.status === 'missed' || c.status === 'rejected';
    if (filter === 'missed' && !isMissed) return false;
    if (filter === 'audio' && c.call_type !== 'audio') return false;
    if (filter === 'video' && c.call_type !== 'video') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const other = c.caller_id === currentUserId ? c.receiver : c.caller;
      const name = other?.display_name?.toLowerCase() || '';
      const username = other?.username?.toLowerCase() || '';
      return name.includes(q) || username.includes(q);
    }

    return true;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-neutral-900 overflow-hidden text-neutral-900 dark:text-neutral-100">
      {/* Top Header */}
      <div className="p-4 sm:p-6 border-b border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Call History
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Real WebRTC audio and video communication logs
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
              <span>Call Settings & Audio</span>
            </button>
          )}

          {onStartNewCall && (
            <button
              onClick={onStartNewCall}
              className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Call</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="px-4 sm:px-6 py-3 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'missed', 'audio', 'video'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-colors cursor-pointer ${
                filter === tab
                  ? 'bg-orange-500 text-white shadow-2xs'
                  : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700'
              }`}
            >
              {tab === 'all' ? 'All Calls' : tab}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 dark:text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search call logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-64 pl-9 pr-3 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-hidden focus:ring-1 focus:ring-orange-500"
          />
        </div>
      </div>

      {/* Call Log List */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 divide-y divide-neutral-100 dark:divide-neutral-800">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
            <Loader2 className="w-6 h-6 animate-spin text-orange-500 mb-2" />
            <span className="text-xs font-medium">Loading call records...</span>
          </div>
        ) : filteredCalls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-400 flex items-center justify-center mb-3">
              <Phone className="w-6 h-6" />
            </div>
            <h4 className="font-semibold text-neutral-800 dark:text-neutral-200 text-sm">No call records found</h4>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-xs mt-1">
              Calls made or received with Universal contacts will appear here with duration and details.
            </p>
          </div>
        ) : (
          filteredCalls.map((call) => {
            const isOutgoing = call.caller_id === currentUserId;
            const otherUser = isOutgoing ? call.receiver : call.caller;
            const isMissed = call.status === 'missed' || call.status === 'rejected';

            const displayName = otherUser?.display_name || 'Universal User';
            const username = otherUser?.username || 'user';

            return (
              <div
                key={call.id}
                className="py-3.5 flex items-center justify-between gap-3 group hover:bg-neutral-50/80 dark:hover:bg-neutral-800/50 px-2 rounded-xl transition-colors"
              >
                {/* Caller avatar & status icon */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold text-white overflow-hidden shrink-0 ${
                      otherUser?.avatar_url
                        ? 'bg-neutral-200 dark:bg-neutral-800'
                        : getAvatarColor(username)
                    }`}
                  >
                    {otherUser?.avatar_url ? (
                      <img
                        src={otherUser.avatar_url}
                        alt={displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      getInitials(displayName)
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4
                        className={`font-semibold text-sm truncate ${
                          isMissed ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-neutral-900 dark:text-white'
                        }`}
                      >
                        {displayName}
                      </h4>
                      <span className="text-[11px] text-neutral-400 font-mono">@{username}</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {/* Direction and Status icon */}
                      {isMissed ? (
                        <span className="flex items-center gap-1 text-rose-500 font-semibold text-[11px]">
                          <PhoneMissed className="w-3.5 h-3.5" />
                          <span>Missed</span>
                        </span>
                      ) : isOutgoing ? (
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[11px]">
                          <PhoneOutgoing className="w-3.5 h-3.5" />
                          <span>Outgoing</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 text-[11px]">
                          <PhoneIncoming className="w-3.5 h-3.5" />
                          <span>Incoming</span>
                        </span>
                      )}

                      <span>·</span>
                      <span className="text-[11px]">
                        {formatMessageTime(call.started_at || call.created_at)}
                      </span>

                      {call.duration_seconds && call.duration_seconds > 0 ? (
                        <>
                          <span>·</span>
                          <span className="text-[11px] font-mono text-neutral-600 dark:text-neutral-300 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDuration(call.duration_seconds)}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Call-back buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => otherUser && handleCallBack(otherUser, 'audio')}
                    className="p-2 text-neutral-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/40 rounded-xl transition-colors cursor-pointer"
                    title={`Call back ${displayName}`}
                  >
                    <Phone className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => otherUser && handleCallBack(otherUser, 'video')}
                    className="p-2 text-neutral-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/40 rounded-xl transition-colors cursor-pointer"
                    title={`Video call ${displayName}`}
                  >
                    <Video className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
