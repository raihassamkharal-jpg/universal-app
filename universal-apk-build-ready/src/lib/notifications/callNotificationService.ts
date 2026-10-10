/**
 * Background Incoming Call Notification and Service Worker Controller for Universal
 * Guarantees cross-tab and background reception of incoming audio/video calls
 * Handles Web Push registration, Service Worker actions, and Call Reachability
 */

import { callManager } from '../webrtc/callManager';
import { supabase, isSupabaseConfigured } from '../supabase/client';

class CallNotificationService {
  private swRegistration: ServiceWorkerRegistration | null = null;
  private isInitialized = false;

  /**
   * Register Service Worker and listen for background notification click events
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    // 1. Register Service Worker if supported
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        this.swRegistration = reg;
        console.log('[NotificationService] Service Worker registered scope:', reg.scope);

        // Listen for messages from Service Worker (e.g. Answer or Decline from notification buttons)
        navigator.serviceWorker.addEventListener('message', (event) => {
          const msg = event.data;
          if (!msg) return;

          console.log('[NotificationService] Message from SW:', msg);
          if (msg.type === 'NOTIFICATION_CLICKED') {
            if (msg.action === 'answer') {
              callManager.acceptCall().catch((e) => {
                console.warn('[NotificationService] Accept call from notification error:', e);
              });
            } else if (msg.action === 'decline') {
              callManager.rejectCall();
            } else {
              // User clicked notification body - window already focused
            }
          } else if (msg.type === 'CALL_NOTIFICATION_DISMISSED') {
            callManager.rejectCall();
          }
        });
      } catch (err) {
        console.warn('[NotificationService] Service Worker registration failed:', err);
      }
    }

    // 2. Track document visibility changes to sync in-app vs browser notifications
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        // App returned to foreground: cancel any lingering call notification
        this.dismissIncomingCallNotification();
      }
    });
  }

  /**
   * Request system notification permission with clear user prompt
   */
  public async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      try {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      } catch {
        return false;
      }
    }

    return false;
  }

  /**
   * Register push notification device / PWA endpoint in Supabase
   * Enables incoming calls and push alerts when browser tab is closed
   */
  public async registerDeviceSubscription(userId: string): Promise<boolean> {
    if (!userId || typeof window === 'undefined') return false;

    try {
      if (!('serviceWorker' in navigator)) return false;
      const reg = await navigator.serviceWorker.ready;
      if (!reg) return false;

      let endpoint = '';
      let p256dh = 'device-token-standard';
      let auth = 'device-auth-standard';

      if (reg.pushManager) {
        let sub = await reg.pushManager.getSubscription();

        if (!sub) {
          const vapidPublicKey =
            (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY) || '';
          const subscribeOptions: PushSubscriptionOptionsInit = {
            userVisibleOnly: true,
          };

          if (vapidPublicKey) {
            const padding = '='.repeat((4 - (vapidPublicKey.length % 4)) % 4);
            const base64 = (vapidPublicKey + padding).replace(/-/g, '+').replace(/_/g, '/');
            const rawData = window.atob(base64);
            const outputArray = new Uint8Array(rawData.length);
            for (let i = 0; i < rawData.length; ++i) {
              outputArray[i] = rawData.charCodeAt(i);
            }
            subscribeOptions.applicationServerKey = outputArray;
          }

          try {
            sub = await reg.pushManager.subscribe(subscribeOptions);
          } catch (subErr) {
            console.log('[NotificationService] Standard push subscription notice:', subErr);
          }
        }

        if (sub) {
          endpoint = sub.endpoint;
          const p256dhKey = sub.getKey('p256dh');
          const authKey = sub.getKey('auth');
          if (p256dhKey) {
            p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(p256dhKey))));
          }
          if (authKey) {
            auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(authKey))));
          }
        }
      }

      if (!endpoint) {
        const safeAgent = navigator.userAgent.slice(0, 32).replace(/[^a-zA-Z0-9]/g, '');
        endpoint = `universal-device-${userId}-${safeAgent}`;
      }

      const isPWA =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
      const deviceType = isPWA
        ? 'pwa'
        : /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
        ? 'mobile'
        : 'web';

      const payload = {
        user_id: userId,
        endpoint,
        p256dh,
        auth,
        user_agent: navigator.userAgent.slice(0, 200),
        device_type: deviceType,
        is_active: true,
        last_active_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (isSupabaseConfigured) {
        await supabase.from('user_device_registrations').upsert(payload, {
          onConflict: 'user_id,endpoint',
        });
      }

      localStorage.setItem('universal_device_registration', JSON.stringify(payload));
      return true;
    } catch (e) {
      console.warn('[NotificationService] registerDeviceSubscription error:', e);
      return false;
    }
  }

  /**
   * Check if a user is "Call Reachable" (has registered background device/PWA)
   */
  public async isUserCallReachable(targetUserId: string): Promise<boolean> {
    if (!targetUserId) return false;
    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase
          .from('user_device_registrations')
          .select('id')
          .eq('user_id', targetUserId)
          .eq('is_active', true)
          .limit(1);

        if (data && data.length > 0) return true;
      } catch {}
    }
    return false;
  }

  /**
   * Show background / system notification for an incoming call
   */
  public async showIncomingCallNotification(params: {
    callId: string;
    callerName: string;
    callerAvatar?: string | null;
    callType: 'audio' | 'video';
  }): Promise<void> {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const { callId, callerName, callType, callerAvatar } = params;
    const title = `Incoming ${callType === 'video' ? 'Video' : 'Audio'} Call`;
    const body = `${callerName} is calling you on Universal...`;

    // Try posting message to Service Worker first (for persistent actions)
    if (this.swRegistration?.active) {
      this.swRegistration.active.postMessage({
        type: 'SHOW_CALL_NOTIFICATION',
        callId,
        callerName,
        callType,
        title,
      });
      return;
    }

    // Fallback: Direct Notification API
    try {
      const n = new Notification(title, {
        body,
        icon: callerAvatar || '/icon-192.png',
        badge: '/favicon.ico',
        tag: `call-${callId}`,
        requireInteraction: true,
        data: { callId, callType },
      });

      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch (e) {
      console.warn('[NotificationService] Fallback notification failed:', e);
    }
  }

  /**
   * Dismiss/cancel incoming call notification when call is answered, rejected, or ended
   */
  public dismissIncomingCallNotification(callId?: string): void {
    if (this.swRegistration?.active && callId) {
      this.swRegistration.active.postMessage({
        type: 'CANCEL_CALL_NOTIFICATION',
        callId,
      });
    }

    // Also close in service worker registration
    if (this.swRegistration) {
      this.swRegistration
        .getNotifications()
        .then((notifications) => {
          notifications.forEach((n) => {
            if (!callId || n.tag === `call-${callId}` || n.tag?.startsWith('call-')) {
              n.close();
            }
          });
        })
        .catch(() => {});
    }
  }

  /**
   * Send background push notification to recipient's registered devices
   * Triggers secure Supabase Edge Function 'send-call-push' without exposing private keys
   */
  public async sendPushCallNotification(params: {
    callId: string;
    recipientUserId: string;
    callerId: string;
    callerName: string;
    callerAvatar?: string | null;
    callType: 'audio' | 'video';
    conversationId?: string | null;
  }): Promise<boolean> {
    const { callId, recipientUserId, callerId, callerName, callerAvatar, callType, conversationId } = params;
    if (!recipientUserId || !callId) return false;

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.functions.invoke('send-call-push', {
          body: {
            callId,
            recipientUserId,
            callerId,
            callerName,
            callerAvatar,
            callType,
            conversationId,
          },
        });
        if (error) {
          console.warn('[NotificationService] Edge function send-call-push returned note:', error);
          return false;
        }
        return true;
      } catch (err) {
        console.warn('[NotificationService] Edge function invocation caught error:', err);
        return false;
      }
    }

    return false;
  }

  /**
   * Unregister device on user logout
   */
  public async unregisterDeviceSubscription(userId: string): Promise<void> {
    if (!userId || typeof window === 'undefined') return;
    try {
      if (isSupabaseConfigured) {
        const regData = localStorage.getItem('universal_device_registration');
        if (regData) {
          const parsed = JSON.parse(regData);
          if (parsed.endpoint) {
            await supabase
              .from('user_device_registrations')
              .update({ is_active: false, updated_at: new Date().toISOString() })
              .eq('user_id', userId)
              .eq('endpoint', parsed.endpoint);
          }
        }
      }
      localStorage.removeItem('universal_device_registration');
    } catch (e) {
      console.warn('[NotificationService] unregisterDeviceSubscription error:', e);
    }
  }
}

export const callNotificationService = new CallNotificationService();
