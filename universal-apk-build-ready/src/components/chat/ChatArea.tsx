import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Send,
  Loader2,
  Smile,
  AlertCircle,
  MessageCircle,
  Paperclip,
  Mic,
  Image as ImageIcon,
  FileText,
  X,
  Search,
  Check,
  FolderOpen,
  Phone,
  Video,
  MoreVertical,
  Camera,
} from 'lucide-react';
import { callManager } from '../../lib/webrtc/callManager';
import {
  fetchConversationMessages,
  sendChatMessage,
  editChatMessage,
  deleteMessageForEveryone,
  deleteMessageForMe,
  toggleMessageReaction,
  markConversationAsRead,
  uploadFileToStorage,
  supabase,
  isSupabaseConfigured,
  type SendMessagePayload,
} from '../../lib/supabase/client';
import {
  getInitials,
  getAvatarColor,
  formatLastSeen,
  groupMessagesByDay,
  formatFileSize,
  playMessageChime,
  showBrowserNotification,
} from '../../lib/utils';
import { MessageItem } from './MessageItem';
import { VoiceRecorder } from './VoiceRecorder';
import { LightboxModal } from './LightboxModal';
import { MediaGalleryModal } from './MediaGalleryModal';
import { StickerGifPicker } from './StickerGifPicker';
import type { Message, Profile, MessageType } from '../../types/database';

interface ChatAreaProps {
  conversationId: string;
  otherUser: Profile;
  currentUserId: string;
  onBackMobile: () => void;
  onOpenProfile: (user: Profile) => void;
  onNewMessageSent?: (msg: Message) => void;
}

interface PendingAttachment {
  file: File;
  previewUrl: string;
  type: MessageType;
  name: string;
  size: number;
}

const EMOJI_PICKER_LIST = [
  '👍', '❤️', '😊', '😂', '🔥', '🎉', '👋', '🙏', '✨', '💯', '🚀', '☕',
  '👏', '😍', '🤔', '🥳', '😎', '🤝', '⚡', '💡', '📌', '🎈', '🍕', '⭐'
];

export const ChatArea: React.FC<ChatAreaProps> = ({
  conversationId,
  otherUser,
  currentUserId,
  onBackMobile,
  onOpenProfile,
  onNewMessageSent,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Attachment states
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Voice recording state
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);

  // Reply & Edit state
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);

  // Modals & Panels
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMediaGallery, setShowMediaGallery] = useState(false);
  const [lightboxState, setLightboxState] = useState<{
    isOpen: boolean;
    url: string | null;
    type: 'image' | 'video';
  }>({ isOpen: false, url: null, type: 'image' });

  // In-chat search
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);

  // Typing indicator
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const typingTimeoutRef = useRef<number | null>(null);
  const lastTypingBroadcastRef = useRef<number>(0);
  const activeChannelRef = useRef<any>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const overflowMenuRef = useRef<HTMLDivElement | null>(null);
  const dragCounterRef = useRef(0);
  const processedMessageIdsRef = useRef<Set<string>>(new Set());

  // Auto-scroll
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
  }, []);

  // Load messages and configure Realtime channel
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setSendError(null);
    setReplyingTo(null);
    setEditingMessage(null);
    setPendingAttachments([]);
    processedMessageIdsRef.current.clear();

    const handleReceivedNewMessage = (newMsg: Message) => {
      if (!isMounted || !newMsg || newMsg.conversation_id !== conversationId) return;

      if (processedMessageIdsRef.current.has(newMsg.id)) {
        return;
      }
      processedMessageIdsRef.current.add(newMsg.id);

      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        // Remove optimistic placeholder
        const filtered = prev.filter(
          (m) => !m.id.startsWith('temp-') || (m.content !== newMsg.content && m.file_url !== newMsg.file_url)
        );
        const combined = [...filtered, newMsg];
        return combined.sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      });

      setTimeout(() => scrollToBottom('smooth'), 50);

      if (newMsg.sender_id !== currentUserId) {
        playMessageChime();
        if (document.hidden) {
          showBrowserNotification(`New message from ${otherUser.display_name}`, {
            body: newMsg.content || newMsg.file_name || 'Sent an attachment',
          });
        }
        markConversationAsRead(conversationId, currentUserId);
      }
    };

    async function loadMessages() {
      const msgs = await fetchConversationMessages(conversationId, currentUserId);
      if (isMounted) {
        msgs.forEach((m) => processedMessageIdsRef.current.add(m.id));
        setMessages(msgs);
        setLoading(false);
        setTimeout(() => scrollToBottom('auto'), 80);
      }
      await markConversationAsRead(conversationId, currentUserId);
    }

    loadMessages();

    // 1. Cross-tab BroadcastChannel listener for multi-tab sync
    let localBc: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        localBc = new BroadcastChannel('universal_chat_events');
        localBc.onmessage = (event) => {
          if (!isMounted) return;
          const evData = event.data;
          if (!evData) return;

          if (evData.type === 'NEW_MESSAGE' && evData.message?.conversation_id === conversationId) {
            handleReceivedNewMessage(evData.message as Message);
          } else if (evData.type === 'MESSAGE_EDITED' && evData.messageId) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === evData.messageId
                  ? { ...m, content: evData.content, is_edited: true, edited_at: new Date().toISOString() }
                  : m
              )
            );
          } else if (evData.type === 'MESSAGE_DELETED' && evData.messageId) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === evData.messageId
                  ? { ...m, is_deleted_everyone: true, content: 'This message was deleted', file_url: null }
                  : m
              )
            );
          } else if (evData.type === 'REACTION_UPDATED' && evData.messageId) {
            fetchConversationMessages(conversationId, currentUserId).then((fresh) => {
              if (isMounted) setMessages(fresh);
            });
          }
        };
      }
    } catch {}

    if (!isSupabaseConfigured) {
      return () => {
        isMounted = false;
        if (localBc) localBc.close();
      };
    }

    // 2. Realtime channel for chat messages & typing presence
    const channelName = `chat:${conversationId}`;
    const channel = supabase.channel(channelName);
    activeChannelRef.current = channel;

    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          handleReceivedNewMessage(payload.new as Message);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (!isMounted) return;
          const updatedMsg = payload.new as Message;
          setMessages((prev) =>
            prev.map((m) => (m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m))
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (!isMounted) return;
          const deletedId = (payload.old as any)?.id;
          if (deletedId) {
            setMessages((prev) => prev.filter((m) => m.id !== deletedId));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
        },
        async () => {
          if (!isMounted) return;
          const refreshed = await fetchConversationMessages(conversationId, currentUserId);
          if (isMounted) setMessages(refreshed);
        }
      )
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (!isMounted) return;
        if (payload?.payload?.userId === otherUser.id) {
          setIsOtherUserTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = window.setTimeout(() => {
            setIsOtherUserTyping(false);
          }, 3000);
        }
      })
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[Realtime] Chat channel error:', status, err);
        }
      });

    // 3. Tab visibility recovery & Online event
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isMounted) {
        const fresh = await fetchConversationMessages(conversationId, currentUserId);
        if (isMounted) {
          setMessages(fresh);
        }
        await markConversationAsRead(conversationId, currentUserId);
      }
    };
    const handleOnline = async () => {
      if (isMounted) {
        const fresh = await fetchConversationMessages(conversationId, currentUserId);
        if (isMounted) setMessages(fresh);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      isMounted = false;
      activeChannelRef.current = null;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (localBc) localBc.close();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId, otherUser.id, otherUser.display_name, scrollToBottom]);

  // Click outside to close mobile overflow menu
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (overflowMenuRef.current && !overflowMenuRef.current.contains(e.target as Node)) {
        setShowOverflowMenu(false);
      }
    };
    if (showOverflowMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showOverflowMenu]);

  // Broadcast typing indicator
  const broadcastTyping = useCallback(() => {
    if (!isSupabaseConfigured || !activeChannelRef.current) return;
    const now = Date.now();
    if (now - lastTypingBroadcastRef.current > 1500) {
      lastTypingBroadcastRef.current = now;
      activeChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: currentUserId },
      });
    }
  }, [currentUserId]);

  // Handle files selected (via input or drag/paste)
  const processFiles = (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    const newAttachments: PendingAttachment[] = list.map((file) => {
      let type: MessageType = 'document';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/')) type = 'video';
      else if (file.type.startsWith('audio/')) type = 'audio';

      return {
        file,
        previewUrl: URL.createObjectURL(file),
        type,
        name: file.name,
        size: file.size,
      };
    });

    setPendingAttachments((prev) => [...prev, ...newAttachments]);
  };

  const removePendingAttachment = (index: number) => {
    setPendingAttachments((prev) => {
      const copy = [...prev];
      URL.revokeObjectURL(copy[index].previewUrl);
      copy.splice(index, 1);
      return copy;
    });
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      setIsDragOver(false);
      dragCounterRef.current = 0;
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    dragCounterRef.current = 0;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  // Clipboard paste support
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      processFiles(e.clipboardData.files);
    }
  };

  // Send or update message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();

    // If editing existing message
    if (editingMessage) {
      if (!trimmed) return;
      setSending(true);
      const success = await editChatMessage(editingMessage.id, currentUserId, trimmed);
      setSending(false);
      if (success) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === editingMessage.id
              ? { ...m, content: trimmed, is_edited: true, edited_at: new Date().toISOString() }
              : m
          )
        );
        if (activeChannelRef.current) {
          try {
            activeChannelRef.current.send({
              type: 'broadcast',
              event: 'message_updated',
              payload: { id: editingMessage.id, content: trimmed, is_edited: true },
            });
          } catch {}
        }
        setEditingMessage(null);
        setInputText('');
      } else {
        setSendError('Failed to update message.');
      }
      return;
    }

    if (!trimmed && pendingAttachments.length === 0) return;
    if (sending) return;

    setSending(true);
    setSendError(null);

    // If attachments present, upload each and send
    if (pendingAttachments.length > 0) {
      const attachmentsToSend = [...pendingAttachments];
      setPendingAttachments([]);

      for (let i = 0; i < attachmentsToSend.length; i++) {
        const item = attachmentsToSend[i];
        setUploadProgress(Math.round(((i + 1) / attachmentsToSend.length) * 100));

        const uploadRes = await uploadFileToStorage(item.file, 'chat-attachments');
        if (uploadRes.error || !uploadRes.publicUrl) {
          setSendError(`Failed to upload ${item.name}: ${uploadRes.error || 'Upload error'}`);
          continue;
        }

        const payload: SendMessagePayload = {
          conversationId,
          senderId: currentUserId,
          content: i === 0 ? trimmed : '',
          messageType: item.type,
          fileUrl: uploadRes.publicUrl,
          fileName: item.name,
          fileSize: item.size,
          fileType: item.file.type,
          replyToMessageId: replyingTo?.id || null,
        };

        const sent = await sendChatMessage(payload);
        if (sent) {
          setMessages((prev) => [...prev, sent]);
          onNewMessageSent?.(sent);
          if (activeChannelRef.current) {
            try {
              activeChannelRef.current.send({
                type: 'broadcast',
                event: 'new_message',
                payload: sent,
              });
            } catch {}
          }
        }
      }

      setUploadProgress(null);
      setInputText('');
      setReplyingTo(null);
      setSending(false);
      setTimeout(() => scrollToBottom('smooth'), 50);
      return;
    }

    // Regular text message
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: trimmed,
      message_type: 'text',
      is_read: false,
      created_at: new Date().toISOString(),
      reply_to_message_id: replyingTo?.id || null,
      reply_message: replyingTo,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setInputText('');
    const currentReply = replyingTo;
    setReplyingTo(null);

    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setTimeout(() => scrollToBottom('smooth'), 30);

    try {
      const sent = await sendChatMessage({
        conversationId,
        senderId: currentUserId,
        content: trimmed,
        messageType: 'text',
        replyToMessageId: currentReply?.id || null,
      });

      if (sent) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...sent, reply_message: currentReply } : m))
        );
        onNewMessageSent?.(sent);

        // Broadcast directly to active peer channel for sub-20ms delivery
        if (activeChannelRef.current) {
          try {
            activeChannelRef.current.send({
              type: 'broadcast',
              event: 'new_message',
              payload: sent,
            });
          } catch {}
        }

        // If chatting with a demo contact, simulate a realistic instant reply
        if (
          otherUser.id.startsWith('demo-contact-') ||
          conversationId.startsWith('welcome-') ||
          conversationId.startsWith('conv_')
        ) {
          setTimeout(async () => {
            const replies = [
              `Awesome! Everything is arriving instantly on Universal. ✨`,
              `Got your message! The real-time messaging pipeline is super smooth.`,
              `Nice! Feel free to test a voice note or call anytime! 🎧`,
              `Message delivered loud and clear! 🚀`,
              `Love how lightweight this is without exposing phone numbers.`,
            ];
            const replyContent = replies[Math.floor(Math.random() * replies.length)];
            const autoReply = await sendChatMessage({
              conversationId,
              senderId: otherUser.id,
              content: replyContent,
              messageType: 'text',
            });
            if (autoReply) {
              setMessages((prev) => [...prev, autoReply]);
              onNewMessageSent?.(autoReply);
              playMessageChime();
              setTimeout(() => scrollToBottom('smooth'), 50);
            }
          }, 1100);
        }
      } else {
        // Mark optimistic message as failed
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, id: `failed-${Date.now()}` } : m))
        );
        setSendError('Failed to send message. Click Retry on the message bubble.');
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, id: `failed-${Date.now()}` } : m))
      );
      setSendError('Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  // Voice message sent from recorder
  const handleSendVoice = async (fileUrl: string, durationSeconds: number) => {
    setIsVoiceRecording(false);
    setSending(true);

    const sent = await sendChatMessage({
      conversationId,
      senderId: currentUserId,
      content: '',
      messageType: 'voice',
      fileUrl,
      fileName: 'Voice note',
      durationSeconds,
      replyToMessageId: replyingTo?.id || null,
    });

    setSending(false);
    setReplyingTo(null);

    if (sent) {
      setMessages((prev) => [...prev, sent]);
      onNewMessageSent?.(sent);
      if (activeChannelRef.current) {
        try {
          activeChannelRef.current.send({
            type: 'broadcast',
            event: 'new_message',
            payload: sent,
          });
        } catch {}
      }
      setTimeout(() => scrollToBottom('smooth'), 50);
    } else {
      setSendError('Failed to send voice message.');
    }
  };

  // Sticker & GIF sending
  const handleSendSticker = async (stickerUrl: string, stickerName: string) => {
    setShowEmojiPicker(false);
    setSending(true);

    const sent = await sendChatMessage({
      conversationId,
      senderId: currentUserId,
      content: '',
      messageType: 'sticker',
      fileUrl: stickerUrl,
      fileName: stickerName,
      replyToMessageId: replyingTo?.id || null,
    });

    setSending(false);
    setReplyingTo(null);

    if (sent) {
      setMessages((prev) => [...prev, sent]);
      onNewMessageSent?.(sent);
      if (activeChannelRef.current) {
        try {
          activeChannelRef.current.send({
            type: 'broadcast',
            event: 'new_message',
            payload: sent,
          });
        } catch {}
      }
      setTimeout(() => scrollToBottom('smooth'), 50);
    } else {
      setSendError('Failed to send sticker.');
    }
  };

  const handleSendGif = async (gifUrl: string, title: string) => {
    setShowEmojiPicker(false);
    setSending(true);

    const sent = await sendChatMessage({
      conversationId,
      senderId: currentUserId,
      content: '',
      messageType: 'gif',
      fileUrl: gifUrl,
      fileName: title,
      replyToMessageId: replyingTo?.id || null,
    });

    setSending(false);
    setReplyingTo(null);

    if (sent) {
      setMessages((prev) => [...prev, sent]);
      onNewMessageSent?.(sent);
      if (activeChannelRef.current) {
        try {
          activeChannelRef.current.send({
            type: 'broadcast',
            event: 'new_message',
            payload: sent,
          });
        } catch {}
      }
      setTimeout(() => scrollToBottom('smooth'), 50);
    } else {
      setSendError('Failed to send GIF.');
    }
  };

  // Keyboard navigation: Enter sends, Shift+Enter new line
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInputTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    broadcastTyping();
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  };

  // Message Actions
  const handleReply = (message: Message) => {
    setReplyingTo(message);
    setEditingMessage(null);
    textareaRef.current?.focus();
  };

  const handleEdit = (message: Message) => {
    setEditingMessage(message);
    setReplyingTo(null);
    setInputText(message.content);
    textareaRef.current?.focus();
  };

  const handleDeleteForEveryone = async (messageId: string) => {
    const ok = await deleteMessageForEveryone(messageId, currentUserId);
    if (ok) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, is_deleted_everyone: true, content: 'This message was deleted', file_url: null }
            : m
        )
      );
      if (activeChannelRef.current) {
        try {
          activeChannelRef.current.send({
            type: 'broadcast',
            event: 'message_deleted',
            payload: { messageId },
          });
        } catch {}
      }
    }
  };

  const handleDeleteForMe = async (messageId: string) => {
    const ok = await deleteMessageForMe(messageId, currentUserId);
    if (ok) {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    }
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    // Optimistic toggle
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const currentReactions = m.reactions || [];
        const existingIdx = currentReactions.findIndex(
          (r) => r.user_id === currentUserId && r.emoji === emoji
        );
        let updated = [...currentReactions];
        if (existingIdx >= 0) {
          updated.splice(existingIdx, 1);
        } else {
          updated.push({
            id: `temp-${Date.now()}`,
            message_id: messageId,
            user_id: currentUserId,
            emoji,
            created_at: new Date().toISOString(),
          });
        }
        return { ...m, reactions: updated };
      })
    );

    if (activeChannelRef.current) {
      try {
        activeChannelRef.current.send({
          type: 'broadcast',
          event: 'message_reaction',
          payload: { messageId, emoji },
        });
      } catch {}
    }

    await toggleMessageReaction(messageId, currentUserId, emoji);
  };

  const handleRetrySend = async (msg: Message) => {
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    setInputText(msg.content);
    textareaRef.current?.focus();
  };

  // Filter messages by search query if in-chat search active
  const filteredMessages = searchQuery.trim()
    ? messages.filter((m) =>
        (m.content || '').toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (m.file_name || '').toLowerCase().includes(searchQuery.toLowerCase().trim())
      )
    : messages;

  const presence = formatLastSeen(otherUser.last_seen);
  const groupedDays = groupMessagesByDay(filteredMessages);

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="relative flex flex-col h-full w-full min-h-0 min-w-0 overflow-hidden bg-neutral-50/70 dark:bg-neutral-950/70"
    >
      {/* Drag & Drop Overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-40 bg-orange-500/10 backdrop-blur-xs border-2 border-dashed border-orange-500 flex flex-col items-center justify-center p-6 text-orange-600 animate-in fade-in">
          <Paperclip className="w-12 h-12 mb-2 animate-bounce" />
          <p className="font-bold text-base">Drop files here to send</p>
          <p className="text-xs text-orange-500/80 mt-1">Photos, videos, audio, or documents</p>
        </div>
      )}

      {/* Chat Area Header */}
      <div className="h-16 px-3 sm:px-6 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0 shadow-2xs w-full min-w-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 mr-2">
          <button
            onClick={onBackMobile}
            className="md:hidden p-1.5 -ml-1 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shrink-0"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <button
            onClick={() => onOpenProfile(otherUser)}
            className="flex items-center gap-2 sm:gap-3 text-left group cursor-pointer min-w-0 flex-1"
          >
            <div className="relative shrink-0">
              <div
                className={`w-9 sm:w-10 h-9 sm:h-10 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden ${
                  otherUser.avatar_url ? 'bg-neutral-200 dark:bg-neutral-800' : getAvatarColor(otherUser.username)
                }`}
              >
                {otherUser.avatar_url ? (
                  <img
                    src={otherUser.avatar_url}
                    alt={otherUser.display_name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  getInitials(otherUser.display_name || otherUser.username)
                )}
              </div>

              {presence.isOnline && (
                <span
                  className="absolute bottom-0 right-0 w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-900"
                  title="Online"
                />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="font-bold text-xs sm:text-sm text-neutral-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors truncate">
                {otherUser.display_name}
              </div>
              <div className="text-[10px] sm:text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5 truncate">
                <span className="font-mono text-neutral-400 truncate">@{otherUser.username}</span>
                <span aria-hidden="true" className="shrink-0">·</span>
                <span className={`shrink-0 ${presence.isOnline ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-neutral-400'}`}>
                  {presence.text}
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0 relative">
          {/* Start Audio Call */}
          <button
            type="button"
            onClick={() => callManager.startCall(otherUser, 'audio', conversationId)}
            className="p-1.5 sm:p-2 text-neutral-600 dark:text-neutral-300 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/30 rounded-xl transition-colors cursor-pointer"
            title={`Audio call ${otherUser.display_name}`}
            aria-label="Start Audio Call"
          >
            <Phone className="w-4 h-4" />
          </button>

          {/* Start Video Call */}
          <button
            type="button"
            onClick={() => callManager.startCall(otherUser, 'video', conversationId)}
            className="p-1.5 sm:p-2 text-neutral-600 dark:text-neutral-300 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/30 rounded-xl transition-colors cursor-pointer"
            title={`Video call ${otherUser.display_name}`}
            aria-label="Start Video Call"
          >
            <Video className="w-4 h-4" />
          </button>

          {/* In-chat search toggle (desktop/tablet) */}
          <button
            type="button"
            onClick={() => {
              setShowSearch(!showSearch);
              if (showSearch) setSearchQuery('');
            }}
            className={`hidden sm:flex p-2 rounded-xl transition-colors cursor-pointer ${
              showSearch
                ? 'bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400'
                : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
            title="Search in conversation"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Media gallery (desktop/tablet) */}
          <button
            type="button"
            onClick={() => setShowMediaGallery(true)}
            className="hidden sm:flex p-2 text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
            title="View shared media & documents"
          >
            <FolderOpen className="w-4 h-4" />
          </button>

          {/* Mobile More Options Button */}
          <button
            type="button"
            onClick={() => setShowOverflowMenu(!showOverflowMenu)}
            className="sm:hidden p-1.5 text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
            title="More chat options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {/* Mobile Overflow Dropdown */}
          {showOverflowMenu && (
            <div
              ref={overflowMenuRef}
              className="absolute right-0 top-12 z-30 w-48 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl py-1 text-xs text-neutral-700 dark:text-neutral-200 animate-in fade-in duration-100"
            >
              <button
                type="button"
                onClick={() => {
                  setShowSearch(!showSearch);
                  setShowOverflowMenu(false);
                }}
                className="w-full px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center gap-2.5 cursor-pointer"
              >
                <Search className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
                <span>Search in Chat</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMediaGallery(true);
                  setShowOverflowMenu(false);
                }}
                className="w-full px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center gap-2.5 cursor-pointer"
              >
                <FolderOpen className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
                <span>Media & Files</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onOpenProfile(otherUser);
                  setShowOverflowMenu(false);
                }}
                className="w-full px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center gap-2.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 rotate-180" />
                <span>View Contact Profile</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* In-chat Search Bar */}
      {showSearch && (
        <div className="px-4 py-2 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-2 animate-in slide-in-from-top-1">
          <Search className="w-4 h-4 text-neutral-400 dark:text-neutral-500 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages..."
            autoFocus
            className="flex-1 text-xs py-1 px-2 border-0 bg-transparent focus:outline-none text-neutral-900 dark:text-white placeholder-neutral-400"
          />
          {searchQuery && (
            <span className="text-[11px] text-neutral-400 dark:text-neutral-500 font-mono">
              {filteredMessages.length} found
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setShowSearch(false);
              setSearchQuery('');
            }}
            className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Messages Thread */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 sm:p-5 md:p-6 space-y-3 sm:space-y-4 w-full">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-400">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center mb-2.5">
              <MessageCircle className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-neutral-700">
              {searchQuery ? 'No matching messages found' : 'No messages yet'}
            </p>
            <p className="text-xs text-neutral-400 mt-0.5 max-w-xs">
              {searchQuery
                ? 'Try a different search word'
                : `Say hello to @${otherUser.username} to start the conversation!`}
            </p>
          </div>
        ) : (
          groupedDays.map((group) => (
            <div key={group.dateLabel} className="space-y-3">
              {/* Date divider */}
              <div className="flex justify-center my-3">
                <span className="px-3 py-1 bg-neutral-200/80 text-neutral-600 text-[11px] font-semibold rounded-full shadow-2xs">
                  {group.dateLabel}
                </span>
              </div>

              {/* Messages list */}
              {group.messages.map((msg) => (
                <MessageItem
                  key={msg.id}
                  message={msg}
                  currentUserId={currentUserId}
                  otherUser={otherUser}
                  onReply={handleReply}
                  onEdit={handleEdit}
                  onDeleteForEveryone={handleDeleteForEveryone}
                  onDeleteForMe={handleDeleteForMe}
                  onToggleReaction={handleToggleReaction}
                  onOpenMedia={(url, type) =>
                    setLightboxState({ isOpen: true, url, type })
                  }
                  onRetrySend={handleRetrySend}
                />
              ))}
            </div>
          ))
        )}

        {/* Real-time typing bubble */}
        {isOtherUserTyping && (
          <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 px-3.5 py-2 rounded-2xl rounded-tl-xs w-fit shadow-2xs animate-in fade-in">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-bounce" />
              <span
                className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-bounce"
                style={{ animationDelay: '0.15s' }}
              />
              <span
                className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-bounce"
                style={{ animationDelay: '0.3s' }}
              />
            </div>
            <span className="font-medium text-neutral-600 dark:text-neutral-300">
              {otherUser.display_name} is typing...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error banner */}
      {sendError && (
        <div className="px-4 py-2 bg-rose-50 dark:bg-rose-950/40 border-t border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <span className="flex-1">{sendError}</span>
          <button
            onClick={() => setSendError(null)}
            className="text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-200 font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Reply Banner */}
      {replyingTo && (
        <div className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800/80 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between text-xs text-neutral-700 dark:text-neutral-200">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-1 h-7 bg-orange-500 rounded-full shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-orange-600 dark:text-orange-400 text-[11px]">
                Replying to{' '}
                {replyingTo.sender_id === currentUserId ? 'yourself' : `@${otherUser.username}`}
              </p>
              <p className="truncate text-neutral-500 dark:text-neutral-400 text-[11px]">
                {replyingTo.content || replyingTo.file_name || 'Attachment'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Edit Banner */}
      {editingMessage && (
        <div className="px-4 py-2 bg-orange-50 dark:bg-orange-950/40 border-t border-orange-200 dark:border-orange-800 flex items-center justify-between text-xs text-orange-800 dark:text-orange-200">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold shrink-0">Editing message</span>
            <span className="text-orange-600 dark:text-orange-300 text-[11px] truncate max-w-xs">
              {editingMessage.content}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingMessage(null);
              setInputText('');
            }}
            className="text-orange-700 dark:text-orange-300 hover:text-orange-900 dark:hover:text-white font-semibold cursor-pointer text-xs shrink-0"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Pending Attachments preview tray */}
      {pendingAttachments.length > 0 && (
        <div className="p-3 bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 flex items-center gap-3 overflow-x-auto">
          {pendingAttachments.map((item, idx) => (
            <div
              key={idx}
              className="relative group shrink-0 w-24 h-24 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-hidden flex flex-col items-center justify-center p-1 shadow-2xs"
            >
              {item.type === 'image' ? (
                <img
                  src={item.previewUrl}
                  alt={item.name}
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : item.type === 'video' ? (
                <video src={item.previewUrl} className="w-full h-full object-cover rounded-lg" />
              ) : (
                <div className="flex flex-col items-center text-center p-1">
                  <FileText className="w-6 h-6 text-orange-500 mb-1" />
                  <p className="text-[10px] font-semibold text-neutral-700 dark:text-neutral-200 truncate w-20">
                    {item.name}
                  </p>
                  <p className="text-[9px] text-neutral-400 dark:text-neutral-500">{formatFileSize(item.size)}</p>
                </div>
              )}

              <button
                type="button"
                onClick={() => removePendingAttachment(idx)}
                className="absolute top-1 right-1 w-5 h-5 bg-neutral-900/70 text-white rounded-full flex items-center justify-center text-xs hover:bg-neutral-900 cursor-pointer"
                title="Remove"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}

          {uploadProgress !== null && (
            <div className="flex items-center gap-2 text-xs font-semibold text-orange-600 dark:text-orange-400 ml-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Uploading {uploadProgress}%</span>
            </div>
          )}
        </div>
      )}

      {/* Input composer container */}
      <div className="relative shrink-0 p-2 sm:p-3 md:p-4 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] w-full min-w-0">
        {/* Emoji, Sticker & GIF picker popover */}
        {showEmojiPicker && (
          <div className="absolute bottom-16 sm:bottom-20 left-2 sm:left-4 z-30 max-w-[calc(100vw-1rem)] animate-in fade-in slide-in-from-bottom-2">
            <StickerGifPicker
              onSelectEmoji={(em) => {
                setInputText((prev) => prev + em);
                setShowEmojiPicker(false);
                textareaRef.current?.focus();
              }}
              onSelectSticker={handleSendSticker}
              onSelectGif={handleSendGif}
              onClose={() => setShowEmojiPicker(false)}
            />
          </div>
        )}

        {/* Hidden multi-file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) processFiles(e.target.files);
            e.target.value = '';
          }}
        />

        {/* If Voice Recorder is active, render it */}
        {isVoiceRecording ? (
          <VoiceRecorder
            onSendVoice={handleSendVoice}
            onCancel={() => setIsVoiceRecording(false)}
          />
        ) : (
          <form
            onSubmit={handleSendMessage}
            className="flex items-end gap-1 sm:gap-1.5 md:gap-2 max-w-5xl mx-auto w-full min-w-0"
          >
            {/* Attachment Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-9 sm:w-10 h-9 sm:h-10 rounded-2xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title="Attach files (images, videos, audio, docs)"
              aria-label="Attach files"
            >
              <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Emoji Button */}
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`w-9 sm:w-10 h-9 sm:h-10 rounded-2xl flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                showEmojiPicker
                  ? 'bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400'
                  : 'bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white'
              }`}
              title="Add emoji"
              aria-label="Add emoji"
            >
              <Smile className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Voice Record Mic Button */}
            <button
              type="button"
              onClick={() => setIsVoiceRecording(true)}
              className="w-9 sm:w-10 h-9 sm:h-10 rounded-2xl bg-neutral-100 dark:bg-neutral-800 hover:bg-orange-100 dark:hover:bg-orange-950/40 text-neutral-600 dark:text-neutral-300 hover:text-orange-600 dark:hover:text-orange-400 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
              title="Record voice message"
              aria-label="Record voice message"
            >
              <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Textarea Input Wrapper */}
            <div className="flex-1 min-h-[36px] sm:min-h-[40px] min-w-0 bg-neutral-100 dark:bg-neutral-800 rounded-2xl border border-neutral-200/80 dark:border-neutral-700 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20 focus-within:bg-white dark:focus-within:bg-neutral-900 transition-all flex items-end px-2.5 sm:px-3 py-1 sm:py-1.5">
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputText}
                onChange={handleInputTextChange}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={
                  editingMessage
                    ? 'Edit message...'
                    : 'Message...'
                }
                className="w-full min-w-0 bg-transparent text-xs sm:text-sm text-neutral-900 dark:text-white placeholder-neutral-400 resize-none focus:outline-none max-h-28 py-0.5 sm:py-1 leading-snug"
              />
            </div>

            {/* Send Button — ALWAYS visible and tappable */}
            <button
              type="submit"
              disabled={sending || (!inputText.trim() && pendingAttachments.length === 0 && !editingMessage)}
              className={`w-9 sm:w-10 h-9 sm:h-10 rounded-2xl flex items-center justify-center shrink-0 transition-all shadow-xs ${
                inputText.trim() || pendingAttachments.length > 0 || editingMessage
                  ? 'bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white cursor-pointer shadow-xs'
                  : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 cursor-not-allowed opacity-60'
              } ${sending ? 'opacity-70' : ''}`}
              aria-label={editingMessage ? 'Save edit' : 'Send message'}
              title={editingMessage ? 'Save edit' : 'Send message'}
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : editingMessage ? (
                <Check className="w-4 sm:w-5 h-4 sm:h-5 text-white" />
              ) : (
                <Send className="w-4 h-4 -ml-0.5" />
              )}
            </button>
          </form>
        )}

        <p className="text-[10px] text-neutral-400 text-center mt-1.5 hidden sm:block">
          Press <span className="font-semibold text-neutral-500 dark:text-neutral-300">Enter</span> to send,{' '}
          <span className="font-semibold text-neutral-500 dark:text-neutral-300">Shift + Enter</span> for new line. Drag
          and drop files directly into chat.
        </p>
      </div>

      {/* Lightbox Modal */}
      <LightboxModal
        isOpen={lightboxState.isOpen}
        onClose={() => setLightboxState({ isOpen: false, url: null, type: 'image' })}
        mediaUrl={lightboxState.url}
        mediaType={lightboxState.type}
      />

      {/* Media & Files Drawer */}
      <MediaGalleryModal
        isOpen={showMediaGallery}
        onClose={() => setShowMediaGallery(false)}
        messages={messages}
        otherUser={otherUser}
        onOpenMedia={(url, type) => {
          setShowMediaGallery(false);
          setLightboxState({ isOpen: true, url, type });
        }}
      />
    </div>
  );
};
