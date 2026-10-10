import React, { useState, useEffect } from 'react';
import {
  Search,
  X,
  User,
  MessageSquare,
  FileText,
  Share2,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { globalSearch } from '../../lib/supabase/client';
import { getInitials, getAvatarColor, formatMessageTime } from '../../lib/utils';
import type { Profile, Message, Post, DriveFile } from '../../types/database';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  onSelectUser: (user: Profile) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  currentUserId,
  onSelectUser,
}) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    users: Profile[];
    messages: Message[];
    posts: Post[];
    files: DriveFile[];
  }>({ users: [], messages: [], posts: [], files: [] });

  useEffect(() => {
    if (!query.trim()) {
      setResults({ users: [], messages: [], posts: [], files: [] });
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      const res = await globalSearch(query, currentUserId);
      setResults(res);
      setLoading(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [query, currentUserId]);

  if (!isOpen) return null;

  const totalResults =
    results.users.length +
    results.messages.length +
    results.posts.length +
    results.files.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-24 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-neutral-200 flex items-center gap-3">
          <Search className="w-5 h-5 text-neutral-400 shrink-0" />
          <input
            type="text"
            placeholder="Search users, messages, social posts, or drive files..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="flex-1 text-sm text-neutral-800 placeholder-neutral-400 bg-transparent focus:outline-hidden font-medium"
          />
          {loading && <Loader2 className="w-4 h-4 animate-spin text-orange-500 shrink-0" />}
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-900 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {!query.trim() ? (
            <div className="text-center py-12 text-neutral-400 text-xs">
              Type to search across everything in Universal...
            </div>
          ) : !loading && totalResults === 0 ? (
            <div className="text-center py-12 text-neutral-400 text-xs">
              No results found for &quot;{query}&quot;
            </div>
          ) : (
            <>
              {/* Users */}
              {results.users.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                    People ({results.users.length})
                  </h4>
                  <div className="divide-y divide-neutral-100">
                    {results.users.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => {
                          onSelectUser(u);
                          onClose();
                        }}
                        className="w-full py-2.5 px-3 flex items-center justify-between hover:bg-neutral-50 rounded-xl transition-colors text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                              u.avatar_url ? 'bg-neutral-200' : getAvatarColor(u.username)
                            }`}
                          >
                            {u.avatar_url ? (
                              <img
                                src={u.avatar_url}
                                alt={u.display_name}
                                className="w-full h-full object-cover rounded-full"
                              />
                            ) : (
                              getInitials(u.display_name)
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-neutral-900 leading-tight">
                              {u.display_name}
                            </p>
                            <p className="text-[11px] text-neutral-400 font-mono">@{u.username}</p>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-neutral-300" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages */}
              {results.messages.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                    Messages ({results.messages.length})
                  </h4>
                  <div className="space-y-1.5">
                    {results.messages.map((m) => (
                      <div
                        key={m.id}
                        className="p-3 bg-neutral-50 rounded-xl text-xs text-neutral-800"
                      >
                        <p className="line-clamp-2">{m.content}</p>
                        <span className="text-[10px] text-neutral-400 mt-1 block">
                          {formatMessageTime(m.created_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Social Posts */}
              {results.posts.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                    Social Posts ({results.posts.length})
                  </h4>
                  <div className="space-y-1.5">
                    {results.posts.map((p) => (
                      <div
                        key={p.id}
                        className="p-3 bg-neutral-50 rounded-xl text-xs text-neutral-800"
                      >
                        <span className="font-semibold text-neutral-900 block mb-0.5">
                          {p.user?.display_name || 'Universal User'}
                        </span>
                        <p className="line-clamp-2">{p.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Files */}
              {results.files.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                    Drive Files ({results.files.length})
                  </h4>
                  <div className="divide-y divide-neutral-100">
                    {results.files.map((f) => (
                      <a
                        key={f.id}
                        href={f.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2 px-3 flex items-center justify-between hover:bg-neutral-50 rounded-xl text-xs text-neutral-900"
                      >
                        <span className="truncate">{f.name}</span>
                        <span className="text-neutral-400 text-[11px] shrink-0 font-mono">
                          {f.folder_name || 'General'}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
