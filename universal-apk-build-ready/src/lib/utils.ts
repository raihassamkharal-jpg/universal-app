/**
 * Helper utilities for formatting and avatars
 */

// Generate initials from a name or username
export function getInitials(name?: string | null): string {
  if (!name || !name.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Generate consistent background color based on string
const AVATAR_COLORS = [
  'bg-orange-500 text-white',
  'bg-amber-600 text-white',
  'bg-rose-500 text-white',
  'bg-emerald-600 text-white',
  'bg-teal-600 text-white',
  'bg-blue-600 text-white',
  'bg-indigo-600 text-white',
  'bg-purple-600 text-white',
];

export function getAvatarColor(str?: string | null): string {
  if (!str) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

// Format message timestamp (e.g., "10:42 AM", "Yesterday", "Oct 12")
export function formatMessageTime(dateString?: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return 'Yesterday';
  }

  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// Format time for inside message bubbles
export function formatBubbleTime(dateString?: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Format presence last seen string
export function formatLastSeen(dateString?: string | null): { isOnline: boolean; text: string } {
  if (!dateString) return { isOnline: false, text: 'Offline' };
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return { isOnline: false, text: 'Offline' };

  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  // If activity recorded within last 2.5 minutes, consider Online
  if (diffSec < 150) {
    return { isOnline: true, text: 'Active now' };
  }

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return { isOnline: false, text: `Last seen ${diffMin}m ago` };
  }

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return { isOnline: false, text: `Last seen ${diffHours}h ago` };
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) {
    return { isOnline: false, text: 'Last seen yesterday' };
  }

  return {
    isOnline: false,
    text: `Last seen ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}`,
  };
}

// Group messages by date for date dividers
export function groupMessagesByDay<T extends { created_at: string }>(
  messages: T[]
): { dateLabel: string; messages: T[] }[] {
  const groups: { [key: string]: T[] } = {};

  messages.forEach((msg) => {
    const d = new Date(msg.created_at);
    const key = isNaN(d.getTime()) ? 'Unknown' : d.toDateString();
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(msg);
  });

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  return Object.keys(groups).map((key) => {
    let dateLabel = key;
    if (key !== 'Unknown') {
      const d = new Date(key);
      if (d.toDateString() === now.toDateString()) {
        dateLabel = 'Today';
      } else if (d.toDateString() === yesterday.toDateString()) {
        dateLabel = 'Yesterday';
      } else {
        dateLabel = d.toLocaleDateString([], {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
        });
      }
    }
    return {
      dateLabel,
      messages: groups[key],
    };
  });
}

// Format file size
export function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Format media duration
export function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// Synthesized subtle notification audio chime (No external assets required!)
export function playMessageChime(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Two-tone bell chime: 880Hz to 1320Hz
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.36);
  } catch {
    // Audio autoplay restrictions or not supported
  }
}

// Safe Web Notification requester and dispatcher
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
}

export function showBrowserNotification(title: string, options?: NotificationOptions): void {
  try {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options,
      });
    }
  } catch {
    // Ignore notification errors
  }
}
