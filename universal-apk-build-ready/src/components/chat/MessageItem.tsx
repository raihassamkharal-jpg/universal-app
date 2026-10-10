import React, { useState, useRef, useEffect } from 'react';
import {
  Check,
  CheckCheck,
  Loader2,
  FileText,
  Download,
  MoreVertical,
  Reply,
  Copy,
  Edit2,
  Trash2,
  Smile,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { AudioPlayer } from './AudioPlayer';
import {
  formatBubbleTime,
  formatFileSize,
  formatDuration,
} from '../../lib/utils';
import type { Message, MessageReaction, Profile } from '../../types/database';

interface MessageItemProps {
  message: Message;
  currentUserId: string;
  otherUser: Profile;
  onReply: (message: Message) => void;
  onEdit: (message: Message) => void;
  onDeleteForEveryone: (messageId: string) => void;
  onDeleteForMe: (messageId: string) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onOpenMedia: (url: string, type: 'image' | 'video') => void;
  onRetrySend?: (message: Message) => void;
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  currentUserId,
  otherUser,
  onReply,
  onEdit,
  onDeleteForEveryone,
  onDeleteForMe,
  onToggleReaction,
  onOpenMedia,
  onRetrySend,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const isMine = message.sender_id === currentUserId;
  const isPending = message.id.startsWith('temp-');
  const isFailed = message.id.startsWith('failed-');
  const isDeleted = Boolean(message.is_deleted_everyone);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopy = () => {
    const textToCopy = message.content || message.file_url || '';
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    setShowMenu(false);
  };

  // Group reactions by emoji
  const groupedReactions: { [emoji: string]: { count: number; reactedByMe: boolean; users: string[] } } = {};
  (message.reactions || []).forEach((r) => {
    if (!groupedReactions[r.emoji]) {
      groupedReactions[r.emoji] = { count: 0, reactedByMe: false, users: [] };
    }
    groupedReactions[r.emoji].count += 1;
    if (r.user_id === currentUserId) {
      groupedReactions[r.emoji].reactedByMe = true;
    }
    const name = r.user?.display_name || r.user?.username || (r.user_id === currentUserId ? 'You' : 'Member');
    groupedReactions[r.emoji].users.push(name);
  });

  // Safe link renderer: detect http/https urls and convert to safe anchor tags
  const renderFormattedText = (text: string) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className={`underline break-all font-medium transition-opacity ${
              isMine ? 'text-white hover:opacity-85' : 'text-orange-600 hover:text-orange-700'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  // Determine media/attachment type
  const rawType = message.message_type || 'text';
  const fileUrl = message.file_url || (rawType !== 'text' ? message.content : null);

  const isImage =
    rawType === 'image' ||
    (Boolean(fileUrl) && /\.(jpg|jpeg|png|gif|webp)$/i.test(fileUrl || '')) ||
    /^https?:\/\/.*\.(?:png|jpg|jpeg|gif|webp)(\?.*)?$/i.test(message.content.trim());

  const isVideo =
    rawType === 'video' ||
    (Boolean(fileUrl) && /\.(mp4|webm|mov)$/i.test(fileUrl || ''));

  const isAudioOrVoice =
    rawType === 'voice' ||
    rawType === 'audio' ||
    (Boolean(fileUrl) && /\.(mp3|wav|ogg|m4a|webm)$/i.test(fileUrl || ''));

  const isDocument =
    rawType === 'document' ||
    rawType === 'file' ||
    (Boolean(fileUrl) && !isImage && !isVideo && !isAudioOrVoice && rawType !== 'sticker' && rawType !== 'gif');

  const isSticker = rawType === 'sticker';
  const isGif = rawType === 'gif';

  return (
    <div
      className={`relative group flex flex-col ${
        isMine ? 'items-end' : 'items-start'
      } w-full min-w-0 animate-in fade-in slide-in-from-bottom-1 duration-150`}
    >
      <div
        className={`relative flex items-center gap-1 sm:gap-1.5 max-w-full min-w-0 ${
          isMine ? 'flex-row-reverse' : 'flex-row'
        }`}
      >
        {/* Message Bubble Container */}
        <div
          className={`relative max-w-[calc(100%-3.5rem)] sm:max-w-[76%] md:max-w-[72%] rounded-2xl text-sm leading-relaxed shadow-2xs transition-shadow min-w-0 ${
            isMine
              ? 'bg-orange-500 text-white rounded-tr-xs shadow-xs'
              : 'bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100 border border-neutral-200/80 dark:border-neutral-700 rounded-tl-xs'
          } ${isDeleted ? 'opacity-70 italic' : ''}`}
        >
          {/* Reply Quote Preview inside bubble */}
          {message.reply_to_message_id && !isDeleted && (
            <div
              className={`mx-2 sm:mx-2.5 mt-2 sm:mt-2.5 px-2.5 sm:px-3 py-1.5 rounded-xl border-l-3 text-xs mb-1.5 min-w-0 ${
                isMine
                  ? 'bg-orange-600/50 border-white text-orange-50'
                  : 'bg-neutral-100 dark:bg-neutral-700/60 border-orange-500 text-neutral-700 dark:text-neutral-200'
              }`}
            >
              <div className="font-semibold text-[11px] opacity-90 truncate">
                {message.reply_message?.sender_id === currentUserId ? 'You' : `@${otherUser.username}`}
              </div>
              <div className="truncate text-[11px] opacity-80">
                {message.reply_message?.content ||
                  (message.reply_message?.file_name ? `Attachment: ${message.reply_message.file_name}` : 'Original message')}
              </div>
            </div>
          )}

          {/* Body Content */}
          <div className="p-2.5 sm:p-3 min-w-0">
            {isDeleted ? (
              <div className="flex items-center gap-1.5 text-xs opacity-75">
                <span>🚫</span>
                <span>This message was deleted</span>
              </div>
            ) : (
              <>
                {/* 1. Image message */}
                {isImage && (fileUrl || message.content) && (
                  <div className="space-y-1.5 min-w-0">
                    <img
                      src={fileUrl || message.content.trim()}
                      alt={message.file_name || 'Attached photo'}
                      onClick={() => onOpenMedia(fileUrl || message.content.trim(), 'image')}
                      className="max-h-64 sm:max-h-80 w-auto max-w-full rounded-xl object-cover cursor-pointer hover:opacity-95 transition-opacity"
                      referrerPolicy="no-referrer"
                    />
                    {message.content && message.content !== fileUrl && (
                      <p className="text-xs pt-1 break-words [overflow-wrap:anywhere] whitespace-pre-wrap">
                        {renderFormattedText(message.content)}
                      </p>
                    )}
                  </div>
                )}

                {/* 2. Video message */}
                {isVideo && fileUrl && (
                  <div className="space-y-1.5 min-w-0">
                    <video
                      src={fileUrl}
                      controls
                      className="max-h-64 sm:max-h-72 w-full rounded-xl bg-black/90 object-contain"
                    />
                    {message.content && message.content !== fileUrl && (
                      <p className="text-xs pt-1 break-words [overflow-wrap:anywhere] whitespace-pre-wrap">
                        {renderFormattedText(message.content)}
                      </p>
                    )}
                  </div>
                )}

                {/* 3. Audio / Voice message */}
                {isAudioOrVoice && fileUrl && (
                  <div className="py-0.5 min-w-0">
                    <AudioPlayer
                      src={fileUrl}
                      duration={message.duration_seconds}
                      isVoice={rawType === 'voice'}
                      isMine={isMine}
                    />
                    {message.content && message.content !== fileUrl && (
                      <p className="text-xs pt-1 px-1 break-words [overflow-wrap:anywhere] whitespace-pre-wrap">
                        {renderFormattedText(message.content)}
                      </p>
                    )}
                  </div>
                )}

                {/* 4. Document / File message */}
                {isDocument && fileUrl && (
                  <div className="space-y-1.5 min-w-0 w-full max-w-sm">
                    <div
                      className={`flex items-center justify-between p-2.5 rounded-xl border ${
                        isMine
                          ? 'bg-orange-600/40 border-orange-400/50 text-white'
                          : 'bg-neutral-50 dark:bg-neutral-700/50 border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 mr-2">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                            isMine ? 'bg-white/20 text-white' : 'bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400'
                          }`}
                        >
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-xs truncate">
                            {message.file_name || 'Document'}
                          </p>
                          <p className={`text-[10px] ${isMine ? 'text-orange-200' : 'text-neutral-400'}`}>
                            {formatFileSize(message.file_size)}
                          </p>
                        </div>
                      </div>
                      <a
                        href={fileUrl}
                        download={message.file_name || 'download'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`p-2 rounded-lg transition-transform active:scale-95 shrink-0 ${
                          isMine
                            ? 'hover:bg-white/20 text-white'
                            : 'hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-600 dark:text-neutral-300'
                        }`}
                        title="Download attachment"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                    {message.content && message.content !== fileUrl && (
                      <p className="text-xs pt-0.5 break-words [overflow-wrap:anywhere] whitespace-pre-wrap">
                        {renderFormattedText(message.content)}
                      </p>
                    )}
                  </div>
                )}

                {/* 5. Sticker message */}
                {isSticker && (fileUrl || message.content) && (
                  <div className="py-1 flex flex-col items-center min-w-0">
                    <img
                      src={fileUrl || message.content.trim()}
                      alt={message.file_name || 'Sticker'}
                      className="w-32 h-32 sm:w-36 sm:h-36 object-contain rounded-xl hover:scale-105 transition-transform"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}

                {/* 6. GIF message */}
                {isGif && (fileUrl || message.content) && (
                  <div className="space-y-1 min-w-0">
                    <img
                      src={fileUrl || message.content.trim()}
                      alt={message.file_name || 'Animated GIF'}
                      onClick={() => onOpenMedia(fileUrl || message.content.trim(), 'image')}
                      className="max-h-56 sm:max-h-64 w-auto max-w-full rounded-xl object-cover cursor-pointer hover:opacity-95 transition-opacity"
                      referrerPolicy="no-referrer"
                    />
                    {message.file_name && (
                      <span className="text-[10px] opacity-75 block truncate">{message.file_name}</span>
                    )}
                  </div>
                )}

                {/* 7. Regular Text message */}
                {!isImage && !isVideo && !isAudioOrVoice && !isDocument && !isSticker && !isGif && (
                  <div className="break-words [overflow-wrap:anywhere] whitespace-pre-wrap min-w-0">
                    {renderFormattedText(message.content)}
                  </div>
                )}
              </>
            )}

            {/* Bubble Footer: Time, Edited status, Read Receipts */}
            <div
              className={`flex items-center justify-end gap-1.5 text-[10px] mt-1 select-none ${
                isMine ? 'text-orange-100' : 'text-neutral-400'
              }`}
            >
              {message.is_edited && !isDeleted && (
                <span className="italic opacity-80">(edited)</span>
              )}
              <span>{formatBubbleTime(message.created_at)}</span>

              {isMine && !isDeleted && (
                <span>
                  {isFailed ? (
                    <button
                      type="button"
                      onClick={() => onRetrySend?.(message)}
                      className="text-rose-200 hover:text-white flex items-center gap-0.5 cursor-pointer font-bold"
                      title="Failed to send. Click to retry"
                    >
                      <AlertCircle className="w-3 h-3 text-rose-300" />
                      <span>Retry</span>
                    </button>
                  ) : isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin text-orange-200" />
                  ) : message.is_read ? (
                    <CheckCheck className="w-3.5 h-3.5 text-white stroke-[2.2]" />
                  ) : (
                    <Check className="w-3.5 h-3.5 text-orange-200" />
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Hover / Context Actions Trigger */}
        {!isPending && !isFailed && (
          <div
            ref={menuRef}
            className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0"
          >
            {/* Quick React Button */}
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
              title="React to message"
              aria-label="React to message"
            >
              <Smile className="w-4 h-4" />
            </button>

            {/* More Options Button */}
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
              title="Message options"
              aria-label="Message options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {/* Quick Emoji Reaction Popup */}
            {showEmojiPicker && (
              <div
                className={`absolute z-30 bottom-full mb-1 flex items-center gap-1 p-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-full shadow-lg ${
                  isMine ? 'right-0' : 'left-0'
                } max-w-[calc(100vw-2rem)] overflow-x-auto animate-in fade-in zoom-in-95`}
              >
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onToggleReaction(message.id, emoji);
                      setShowEmojiPicker(false);
                    }}
                    className="w-7 h-7 flex items-center justify-center text-sm hover:scale-125 transition-transform cursor-pointer shrink-0"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {/* Context Action Menu */}
            {showMenu && (
              <div
                className={`absolute z-30 top-full mt-1 w-44 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl py-1 text-xs text-neutral-700 dark:text-neutral-200 ${
                  isMine ? 'right-0' : 'left-0'
                } max-w-[calc(100vw-2rem)] animate-in fade-in duration-100`}
              >
                {/* Reply */}
                <button
                  type="button"
                  onClick={() => {
                    onReply(message);
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700/60 flex items-center gap-2 cursor-pointer"
                >
                  <Reply className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
                  <span>Reply</span>
                </button>

                {/* Copy */}
                <button
                  type="button"
                  onClick={handleCopy}
                  className="w-full px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700/60 flex items-center gap-2 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>

                {/* Edit (only own non-deleted text message) */}
                {isMine && !isDeleted && rawType === 'text' && (
                  <button
                    type="button"
                    onClick={() => {
                      onEdit(message);
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700/60 flex items-center gap-2 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
                    <span>Edit Message</span>
                  </button>
                )}

                {/* Delete for me */}
                <button
                  type="button"
                  onClick={() => {
                    onDeleteForMe(message.id);
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete for me</span>
                </button>

                {/* Delete for everyone (only own message) */}
                {isMine && !isDeleted && (
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteForEveryone(message.id);
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center gap-2 cursor-pointer font-medium"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete for everyone</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reaction Chips below bubble */}
      {Object.keys(groupedReactions).length > 0 && !isDeleted && (
        <div className={`flex flex-wrap items-center gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
          {Object.entries(groupedReactions).map(([emoji, data]) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onToggleReaction(message.id, emoji)}
              title={data.users.join(', ')}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                data.reactedByMe
                  ? 'bg-orange-100/90 border-orange-300 text-orange-700'
                  : 'bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              <span>{emoji}</span>
              <span className="text-[11px] font-semibold">{data.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
