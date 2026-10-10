import React, { useState, useRef } from 'react';
import { X, Image as ImageIcon, Type, Sparkles, Loader2, Upload, AlertCircle, Video } from 'lucide-react';
import { createStatus, uploadFileToStorage } from '../../lib/supabase/client';
import type { UserStatus } from '../../types/database';

interface CreateStatusModalProps {
  isOpen: boolean;
  userId: string;
  onClose: () => void;
  onStatusCreated: (status: UserStatus) => void;
}

const GRADIENTS = [
  { name: 'Orange Amber', class: 'bg-gradient-to-tr from-orange-500 to-amber-500' },
  { name: 'Sunset Rose', class: 'bg-gradient-to-tr from-rose-500 to-orange-400' },
  { name: 'Purple Violet', class: 'bg-gradient-to-tr from-purple-600 to-indigo-500' },
  { name: 'Ocean Emerald', class: 'bg-gradient-to-tr from-emerald-500 to-teal-600' },
  { name: 'Midnight Slate', class: 'bg-gradient-to-tr from-neutral-800 to-neutral-950' },
  { name: 'Electric Cyan', class: 'bg-gradient-to-tr from-cyan-500 to-blue-600' },
];

export const CreateStatusModal: React.FC<CreateStatusModalProps> = ({
  isOpen,
  userId,
  onClose,
  onStatusCreated,
}) => {
  const [mode, setMode] = useState<'text' | 'media'>('text');
  const [textContent, setTextContent] = useState('');
  const [selectedGradient, setSelectedGradient] = useState(GRADIENTS[0].class);
  const [selectedMedia, setSelectedMedia] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [mediaCaption, setMediaCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 25 * 1024 * 1024) {
        setError('Media file is too large (max 25MB)');
        return;
      }
      setSelectedMedia(file);
      setIsVideo(file.type.startsWith('video/'));
      setMediaPreview(URL.createObjectURL(file));
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'text' && !textContent.trim()) {
      setError('Please type a status message.');
      return;
    }

    if (mode === 'media' && !selectedMedia) {
      setError('Please select a photo or video for your status.');
      return;
    }

    setLoading(true);

    try {
      let mediaUrl: string | undefined = undefined;

      if (mode === 'media' && selectedMedia) {
        const uploadRes = await uploadFileToStorage(selectedMedia, 'chat-attachments');
        if (uploadRes.error || !uploadRes.publicUrl) {
          setError(uploadRes.error || 'Failed to upload status media.');
          setLoading(false);
          return;
        }
        mediaUrl = uploadRes.publicUrl;
      }

      const newStatus = await createStatus(userId, {
        content: mode === 'text' ? textContent.trim() : mediaCaption.trim() || undefined,
        media_url: mediaUrl,
        background_color: mode === 'text' ? selectedGradient : undefined,
      });

      setLoading(false);

      if (newStatus) {
        onStatusCreated(newStatus);
        onClose();
      } else {
        // Fallback optimistic status object if database table is pending migration
        const optimistic: UserStatus = {
          id: `status-${Date.now()}`,
          user_id: userId,
          content: mode === 'text' ? textContent.trim() : mediaCaption.trim() || null,
          media_url: mediaUrl || null,
          background_color: selectedGradient,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          views_count: 0,
        };
        onStatusCreated(optimistic);
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to publish status');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl border border-neutral-100 dark:border-neutral-800 overflow-hidden text-neutral-900 dark:text-neutral-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-white leading-tight">Create Status</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Disappears automatically in 24 hours</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="px-6 pt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setMode('text')}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              mode === 'text'
                ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800 shadow-2xs'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Type className="w-4 h-4" />
            <span>Text Status</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('media')}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              mode === 'media'
                ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800 shadow-2xs'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Photo / Video</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-xl text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'text' ? (
            <div className="space-y-4">
              {/* Preview Card */}
              <div
                className={`w-full h-56 rounded-2xl ${selectedGradient} text-white p-6 flex flex-col items-center justify-center text-center shadow-inner transition-colors duration-200`}
              >
                <p className="text-xl sm:text-2xl font-bold break-words max-w-xs drop-shadow-xs">
                  {textContent || 'Type your status thoughts...'}
                </p>
              </div>

              {/* Text Input */}
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                maxLength={280}
                rows={3}
                placeholder="What's happening today?..."
                className="w-full p-3 text-sm border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white rounded-xl focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors resize-none"
              />

              {/* Gradient selector */}
              <div>
                <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-2">
                  Choose Color Theme
                </label>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {GRADIENTS.map((g) => (
                    <button
                      key={g.name}
                      type="button"
                      onClick={() => setSelectedGradient(g.class)}
                      className={`w-8 h-8 rounded-full ${g.class} shrink-0 cursor-pointer transition-transform ${
                        selectedGradient === g.class ? 'ring-2 ring-orange-500 ring-offset-2 dark:ring-offset-neutral-900 scale-110' : 'hover:scale-105'
                      }`}
                      title={g.name}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Media Preview / File selector */}
              {mediaPreview ? (
                <div className="relative w-full h-56 rounded-2xl overflow-hidden bg-black flex items-center justify-center">
                  {isVideo ? (
                    <video src={mediaPreview} controls className="w-full h-full object-contain" />
                  ) : (
                    <img src={mediaPreview} alt="Status preview" className="w-full h-full object-contain" />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMedia(null);
                      setMediaPreview(null);
                      setIsVideo(false);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-52 border-2 border-dashed border-neutral-200 dark:border-neutral-700 hover:border-orange-400 hover:bg-orange-50/20 dark:hover:bg-orange-950/20 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-colors p-4 text-center"
                >
                  <Upload className="w-8 h-8 text-neutral-400 mb-2" />
                  <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Click to upload photo or video</p>
                  <p className="text-xs text-neutral-400 mt-0.5">JPEG, PNG, MP4, WEBM (Max 25MB)</p>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleMediaSelect}
                className="hidden"
              />

              <input
                type="text"
                value={mediaCaption}
                onChange={(e) => setMediaCaption(e.target.value)}
                placeholder="Add a caption (optional)..."
                className="w-full p-2.5 text-sm border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white rounded-xl focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
              />
            </div>
          )}

          {/* Submit */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:text-neutral-800 dark:hover:text-white rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Publishing...</span>
                </>
              ) : (
                <span>Share to Status</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
