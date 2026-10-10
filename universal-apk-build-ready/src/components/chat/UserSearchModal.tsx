import React, { useState, useEffect } from 'react';
import { Search, X, MessageSquare, Loader2, UserCheck, AlertCircle } from 'lucide-react';
import { searchUsers } from '../../lib/supabase/client';
import { useAuth } from '../../context/AuthContext';
import { getInitials, getAvatarColor } from '../../lib/utils';
import type { Profile } from '../../types/database';

interface UserSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (user: Profile) => Promise<void>;
}

export const UserSearchModal: React.FC<UserSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectUser,
}) => {
  const { user: currentUser } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [startingChatUserId, setStartingChatUserId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Debounced search
  useEffect(() => {
    if (!isOpen || !currentUser) return;

    const trimmed = query.trim().replace(/^@/, '');
    if (!trimmed) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setActionError(null);
      try {
        const found = await searchUsers(trimmed, currentUser.id);
        setResults(found);
        setHasSearched(true);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, isOpen, currentUser]);

  if (!isOpen) return null;

  const handleStartChat = async (targetUser: Profile) => {
    setActionError(null);
    setStartingChatUserId(targetUser.id);
    try {
      await onSelectUser(targetUser);
      onClose();
    } catch {
      setActionError('Could not start conversation. Please try again.');
    } finally {
      setStartingChatUserId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-neutral-100 overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-neutral-900">Search by Username</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Find registered users by their @username to start a private conversation
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search input */}
        <div className="p-4 border-b border-neutral-100 bg-neutral-50/50">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              autoFocus
              placeholder="Search username (e.g. hassam)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-white text-sm border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
            />
            {loading && (
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center">
                <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* Results area */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-neutral-100 min-h-[220px]">
          {actionError && (
            <div className="mb-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{actionError}</span>
            </div>
          )}

          {!query.trim() ? (
            <div className="h-44 flex flex-col items-center justify-center text-center p-6 text-neutral-400">
              <Search className="w-8 h-8 mb-2 stroke-[1.5]" />
              <p className="text-xs text-neutral-500 font-medium">Type a username to find people</p>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Every member has a unique username prefix
              </p>
            </div>
          ) : loading && results.length === 0 ? (
            <div className="h-44 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
            </div>
          ) : results.length === 0 && hasSearched ? (
            <div className="h-44 flex flex-col items-center justify-center text-center p-6 text-neutral-400">
              <UserCheck className="w-8 h-8 mb-2 stroke-[1.5] text-neutral-300" />
              <p className="text-xs text-neutral-600 font-semibold">No users found</p>
              <p className="text-[11px] text-neutral-400 mt-1">
                No registered user matches <span className="font-mono text-neutral-600">@{query.replace(/^@/, '')}</span>
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {results.map((target) => (
                <div
                  key={target.id}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-neutral-50 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden ${
                        target.avatar_url ? 'bg-neutral-200' : getAvatarColor(target.username)
                      }`}
                    >
                      {target.avatar_url ? (
                        <img
                          src={target.avatar_url}
                          alt={target.display_name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        getInitials(target.display_name || target.username)
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-neutral-900 truncate">
                        {target.display_name}
                      </div>
                      <div className="text-xs font-mono text-neutral-500 truncate">
                        @{target.username}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleStartChat(target)}
                    disabled={startingChatUserId === target.id}
                    className="ml-3 px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-semibold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
                  >
                    {startingChatUserId === target.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <MessageSquare className="w-3.5 h-3.5" />
                    )}
                    <span>Message</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
