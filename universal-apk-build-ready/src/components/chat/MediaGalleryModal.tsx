import React, { useState } from 'react';
import { X, Image as ImageIcon, FileText, Music, Download, ExternalLink } from 'lucide-react';
import { formatFileSize, formatMessageTime } from '../../lib/utils';
import type { Message, Profile } from '../../types/database';

interface MediaGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  otherUser: Profile;
  onOpenMedia: (url: string, type: 'image' | 'video') => void;
}

export const MediaGalleryModal: React.FC<MediaGalleryModalProps> = ({
  isOpen,
  onClose,
  messages,
  otherUser,
  onOpenMedia,
}) => {
  const [activeTab, setActiveTab] = useState<'media' | 'docs' | 'audio'>('media');

  if (!isOpen) return null;

  const mediaMessages = messages.filter(
    (m) =>
      !m.is_deleted_everyone &&
      (m.message_type === 'image' ||
        m.message_type === 'video' ||
        (m.file_url && /\.(jpg|jpeg|png|gif|webp|mp4|webm)$/i.test(m.file_url)))
  );

  const docMessages = messages.filter(
    (m) =>
      !m.is_deleted_everyone &&
      (m.message_type === 'document' ||
        m.message_type === 'file' ||
        (m.file_url && !/\.(jpg|jpeg|png|gif|webp|mp4|webm|mp3|ogg|wav|m4a)$/i.test(m.file_url)))
  );

  const audioMessages = messages.filter(
    (m) =>
      !m.is_deleted_everyone &&
      (m.message_type === 'audio' ||
        m.message_type === 'voice' ||
        (m.file_url && /\.(mp3|ogg|wav|m4a|webm)$/i.test(m.file_url)))
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-neutral-100 overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-neutral-900">Shared Files & Media</h2>
            <p className="text-xs text-neutral-500">with @{otherUser.username}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-neutral-100 px-6 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('media')}
            className={`pb-3 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'media'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Media ({mediaMessages.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('docs')}
            className={`pb-3 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'docs'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Documents ({docMessages.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audio')}
            className={`pb-3 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'audio'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Music className="w-4 h-4" />
            <span>Voice & Audio ({audioMessages.length})</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'media' && (
            mediaMessages.length === 0 ? (
              <div className="text-center py-12 text-neutral-400 text-xs">
                No photos or videos shared yet.
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {mediaMessages.map((m) => {
                  const url = m.file_url || m.content;
                  const isVideo = m.message_type === 'video' || (url && /\.(mp4|webm)$/i.test(url));
                  return (
                    <div
                      key={m.id}
                      onClick={() => onOpenMedia(url, isVideo ? 'video' : 'image')}
                      className="group relative aspect-square rounded-xl overflow-hidden bg-neutral-100 cursor-pointer border border-neutral-200"
                    >
                      {isVideo ? (
                        <video src={url} className="w-full h-full object-cover" />
                      ) : (
                        <img
                          src={url}
                          alt="Media attachment"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          referrerPolicy="no-referrer"
                        />
                      )}
                      <div className="absolute inset-0 bg-neutral-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <ExternalLink className="w-5 h-5" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {activeTab === 'docs' && (
            docMessages.length === 0 ? (
              <div className="text-center py-12 text-neutral-400 text-xs">
                No documents or files shared yet.
              </div>
            ) : (
              <div className="space-y-2">
                {docMessages.map((m) => {
                  const url = m.file_url || m.content;
                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-3 bg-neutral-50 hover:bg-neutral-100 rounded-xl border border-neutral-200/80 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-neutral-900 truncate">
                            {m.file_name || 'Document'}
                          </p>
                          <p className="text-[10px] text-neutral-400">
                            {formatFileSize(m.file_size)} · {formatMessageTime(m.created_at)}
                          </p>
                        </div>
                      </div>
                      <a
                        href={url}
                        download={m.file_name || 'download'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-neutral-500 hover:text-orange-600 hover:bg-white rounded-lg transition-colors shadow-2xs"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {activeTab === 'audio' && (
            audioMessages.length === 0 ? (
              <div className="text-center py-12 text-neutral-400 text-xs">
                No voice messages or audio shared yet.
              </div>
            ) : (
              <div className="space-y-2">
                {audioMessages.map((m) => {
                  const url = m.file_url || m.content;
                  return (
                    <div
                      key={m.id}
                      className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/80 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs text-neutral-600">
                        <span className="font-semibold">
                          {m.message_type === 'voice' ? 'Voice Message' : m.file_name || 'Audio Clip'}
                        </span>
                        <span className="text-[11px] text-neutral-400">
                          {formatMessageTime(m.created_at)}
                        </span>
                      </div>
                      <audio controls src={url} className="w-full h-8" />
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};
