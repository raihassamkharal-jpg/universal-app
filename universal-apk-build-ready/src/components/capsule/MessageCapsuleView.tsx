import React, { useState, useEffect, useCallback } from 'react';
import {
  Bookmark,
  Plus,
  Trash2,
  FileText,
  Link as LinkIcon,
  Bell,
  Image as ImageIcon,
  Loader2,
  Tag,
} from 'lucide-react';
import {
  fetchMessageCapsules,
  createMessageCapsule,
  deleteMessageCapsule,
} from '../../lib/supabase/client';
import { formatMessageTime } from '../../lib/utils';
import type { MessageCapsule } from '../../types/database';

interface MessageCapsuleViewProps {
  currentUserId: string;
}

export const MessageCapsuleView: React.FC<MessageCapsuleViewProps> = ({ currentUserId }) => {
  const [capsules, setCapsules] = useState<MessageCapsule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'note' | 'media' | 'message' | 'link' | 'reminder'>('note');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadCapsules = useCallback(async () => {
    setLoading(true);
    const data = await fetchMessageCapsules(currentUserId);
    setCapsules(data);
    setLoading(false);
  }, [currentUserId]);

  useEffect(() => {
    loadCapsules();
  }, [loadCapsules]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    const created = await createMessageCapsule(currentUserId, title, category, description);
    setSubmitting(false);

    if (created) {
      setCapsules((prev) => [created, ...prev]);
      setTitle('');
      setDescription('');
      setIsCreating(false);
      setFormError(null);
    } else {
      setFormError('Could not save capsule item. Please try again.');
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await deleteMessageCapsule(id, currentUserId);
    if (ok) {
      setCapsules((prev) => prev.filter((c) => c.id !== id));
    }
  };

  const filteredCapsules = capsules.filter((c) => {
    if (categoryFilter === 'all') return true;
    return c.category === categoryFilter;
  });

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'reminder':
        return <Bell className="w-4 h-4 text-amber-500" />;
      case 'link':
        return <LinkIcon className="w-4 h-4 text-blue-500" />;
      case 'media':
        return <ImageIcon className="w-4 h-4 text-purple-500" />;
      default:
        return <FileText className="w-4 h-4 text-emerald-500" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden">
      {/* Top Header */}
      <div className="p-4 sm:p-6 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
            Message Capsule & Memory Board
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Store essential thoughts, key message clippings, and personal reminders
          </p>
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Capsule Item</span>
        </button>
      </div>

      {/* Categories Bar */}
      <div className="px-4 sm:px-6 py-3 border-b border-neutral-100 bg-neutral-50/50 flex items-center gap-1.5 overflow-x-auto">
        {(['all', 'note', 'reminder', 'link', 'media'] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-colors cursor-pointer ${
              categoryFilter === cat
                ? 'bg-orange-500 text-white shadow-2xs'
                : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
            }`}
          >
            {cat === 'all' ? 'All Items' : `${cat}s`}
          </button>
        ))}
      </div>

      {/* Main List */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {/* Create Modal / Card */}
        {isCreating && (
          <div className="mb-6 p-4 sm:p-5 rounded-3xl border border-orange-200 bg-orange-50/30 animate-in fade-in">
            <h4 className="font-bold text-sm text-neutral-900 mb-3">Add to Message Capsule</h4>
            <form onSubmit={handleCreate} className="space-y-3">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center justify-between">
                  <span>{formError}</span>
                  <button type="button" onClick={() => setFormError(null)} className="text-neutral-400 hover:text-neutral-700 font-bold">
                    ✕
                  </button>
                </div>
              )}
              <div>
                <input
                  type="text"
                  placeholder="Title / Summary..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full py-2 px-3 bg-white border border-neutral-200 rounded-xl text-xs text-neutral-800 font-semibold focus:outline-hidden focus:ring-1 focus:ring-orange-500"
                  required
                />
              </div>

              <div>
                <textarea
                  placeholder="Notes, message content, link, or reminder details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full p-3 bg-white border border-neutral-200 rounded-xl text-xs text-neutral-800 resize-none focus:outline-hidden focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-500 font-medium">Category:</span>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="py-1 px-2.5 bg-white border border-neutral-200 rounded-lg text-xs font-semibold text-neutral-700 capitalize"
                  >
                    <option value="note">Note</option>
                    <option value="reminder">Reminder</option>
                    <option value="link">Link</option>
                    <option value="media">Media</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="px-3 py-1.5 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-600 hover:bg-neutral-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !title.trim()}
                    className="px-4 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs transition-colors shadow-2xs disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Save Capsule</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
            <Loader2 className="w-6 h-6 animate-spin text-orange-500 mb-2" />
            <span className="text-xs">Loading capsules...</span>
          </div>
        ) : filteredCapsules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 text-neutral-400 flex items-center justify-center mb-3">
              <Bookmark className="w-6 h-6" />
            </div>
            <h4 className="font-semibold text-neutral-800 text-sm">No saved items found</h4>
            <p className="text-xs text-neutral-500 max-w-xs mt-1">
              Save key messages, reminders, or notes here for permanent private keeping.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCapsules.map((cap) => (
              <div
                key={cap.id}
                className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="flex items-center gap-1.5 text-xs font-semibold capitalize text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded-md">
                      {getCategoryIcon(cap.category)}
                      {cap.category}
                    </span>

                    <button
                      onClick={() => handleDelete(cap.id)}
                      className="p-1 text-neutral-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                      title="Delete capsule"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <h3 className="font-bold text-sm text-neutral-900 mb-1">{cap.title}</h3>
                  {cap.description && (
                    <p className="text-xs text-neutral-600 whitespace-pre-wrap leading-relaxed">
                      {cap.description}
                    </p>
                  )}
                </div>

                <div className="pt-3 mt-3 border-t border-neutral-100 text-[11px] text-neutral-400">
                  Saved {formatMessageTime(cap.created_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
