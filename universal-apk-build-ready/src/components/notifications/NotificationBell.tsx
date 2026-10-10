import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Phone,
  PhoneMissed,
  MessageSquare,
  Heart,
  UserPlus,
  Check,
  CheckCheck,
} from 'lucide-react';
import {
  fetchUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  supabase,
  isSupabaseConfigured,
} from '../../lib/supabase/client';
import { formatMessageTime } from '../../lib/utils';
import type { AppNotification } from '../../types/database';

interface NotificationBellProps {
  currentUserId: string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ currentUserId }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const loadNotifications = async () => {
    const list = await fetchUserNotifications(currentUserId);
    setNotifications(list);
  };

  useEffect(() => {
    loadNotifications();

    if (!isSupabaseConfigured || !currentUserId) return;

    // Realtime channel for new notifications
    const channel = supabase
      .channel(`user_notifs:${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${currentUserId}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as AppNotification, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    await markNotificationAsRead(id);
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await markAllNotificationsAsRead(currentUserId);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'missed_call':
        return <PhoneMissed className="w-3.5 h-3.5 text-rose-500" />;
      case 'call':
        return <Phone className="w-3.5 h-3.5 text-emerald-500" />;
      case 'post_like':
        return <Heart className="w-3.5 h-3.5 text-rose-500" />;
      case 'follow':
        return <UserPlus className="w-3.5 h-3.5 text-blue-500" />;
      default:
        return <MessageSquare className="w-3.5 h-3.5 text-orange-500" />;
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-colors relative cursor-pointer"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-orange-500 ring-2 ring-white" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-[calc(100vw-1.5rem)] sm:w-96 max-w-sm bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 text-neutral-900 dark:text-neutral-100">
          <div className="p-3.5 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-950/60">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-neutral-900 dark:text-white">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 font-bold text-[10px]">
                  {unreadCount}
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] text-orange-600 dark:text-orange-400 hover:underline font-semibold cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800">
            {notifications.length === 0 ? (
              <p className="text-xs text-neutral-400 dark:text-neutral-500 py-8 text-center">No notifications yet.</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleMarkAsRead(n.id)}
                  className={`p-3 flex items-start gap-2.5 transition-colors cursor-pointer ${
                    n.is_read ? 'hover:bg-neutral-50/70 dark:hover:bg-neutral-800/50' : 'bg-orange-50/40 dark:bg-orange-950/20 hover:bg-orange-50/70 dark:hover:bg-orange-950/40'
                  }`}
                >
                  <div className="p-1.5 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 shadow-2xs mt-0.5 shrink-0">
                    {getIcon(n.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-xs text-neutral-900 dark:text-white leading-tight">{n.title}</p>
                    <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-0.5 leading-tight">{n.body}</p>
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1 block">
                      {formatMessageTime(n.created_at)}
                    </span>
                  </div>
                  {!n.is_read && (
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
