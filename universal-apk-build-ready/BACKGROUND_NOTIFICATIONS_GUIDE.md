# Universal — Background Push Notifications & Incoming Call Architecture

This guide details the background incoming-call notification architecture implemented in Universal, explaining how standards-based Web Push, Service Workers, WebRTC, and Supabase coordinate across different client platforms.

---

## 1. Architecture Overview

### Why Supabase Realtime alone is insufficient when the tab is closed
- **WebSocket Lifecycles:** Web browsers terminate or throttle active WebSocket connections and JavaScript execution when a tab is closed, deeply backgrounded, or discarded due to OS memory pressure.
- **The Solution:** A two-tier signaling model:
  1. **Foreground / Active Tab:** Instant low-latency signaling over Supabase Realtime Channels (`user_calls:${userId}` and `call_${callId}`) and local `BroadcastChannel`.
  2. **Background / Tab Closed / Standalone PWA:** Standard RFC 8291/8292 Web Push notifications dispatched via the server-side Supabase Edge Function `send-call-push`. The Service Worker (`/public/sw.js`) intercepts the push payload, displays an OS-level notification with **Answer** and **Decline** action buttons, and focuses/opens the app when interacted with.

---

## 2. Platform-Specific Behavior & Support Matrix

| Platform / Environment | Web Push When Tab Closed | Incoming Call OS Notification | Deep-Link Answer & Focus | Notes & Requirements |
| :--- | :--- | :--- | :--- | :--- |
| **Android Chrome / Edge / Firefox** | ✅ Full Support | ✅ System Notification with Answer/Decline | ✅ Opens PWA / Focuses tab | Battery optimization exceptions recommended for instant wake. |
| **Android Installed PWA** | ✅ Full Support | ✅ Full Screen / Heads-Up System Alert | ✅ Direct window focus into CallModal | Best mobile web experience. |
| **macOS / Windows / Linux Desktop** | ✅ Full Support | ✅ Native OS Banner / Notification Center | ✅ Focuses browser window | Requires OS notification permissions enabled for the browser. |
| **iOS / iPadOS (Safari In-Browser)** | ⚠️ Limited | ❌ Browser does not deliver push when Safari is killed | ⚠️ Only while tab is active in memory | Apple restricts Web Push in Safari tabs unless installed to Home Screen. |
| **iOS / iPadOS (Installed Home Screen PWA)** | ✅ Supported (iOS 16.4+) | ✅ Native Notification Banner | ✅ Launches standalone Web App | **Must be added to Home Screen** ("Share -> Add to Home Screen") and notification permission granted in Settings. |

### iOS Native APNs / CallKit Distinction
> **Important Note:** In a browser or PWA environment, web applications cannot directly invoke Apple's native **CallKit** framework (which displays full-screen incoming call locks identical to cellular phone calls). Full CallKit integration requires packaging the client as a native wrapper (e.g., Capacitor / React Native / Swift) with APNs VoIP Push (`pushkit`). For the web/PWA platform, the standards-based Web Push notification with deep links is the official and highest supported fidelity.

---

## 3. Web Push Lifecycle & Signal Flow

```
[Caller Client]
   │
   ├─► 1. Acquires local camera/microphone media via getUserMedia
   ├─► 2. Creates PeerConnection & generates SDP Offer
   ├─► 3. Inserts authoritative call row in Supabase 'calls' table
   ├─► 4. Broadcasts to Realtime channel (for any open tabs)
   └─► 5. Invokes Edge Function: supabase.functions.invoke('send-call-push')
           │
           ▼
     [Supabase Edge Function: send-call-push]
           │
           ├─► Validates caller JWT (no spoofing)
           ├─► Verifies recipient has not blocked the caller
           ├─► Queries active endpoints from 'user_device_registrations'
           └─► Encrypts and sends RFC 8291 payload with server VAPID keys
                   │
                   ▼
     [Push Service (Google FCM / Mozilla / Apple APNs)]
                   │
                   ▼
     [Recipient Device: Service Worker (sw.js)]
           │
           ├─► Receives 'push' event
           ├─► Shows persistent notification: tag="call-${callId}", actions=['answer', 'decline']
           └─► Handles user click:
                   ├─ If 'Answer': Focuses/launches Universal with ?callId=...&callAction=answer
                   └─ If 'Decline': Sends decline signal & updates call status to 'rejected'
```

---

## 4. Revalidating Call State & Handling Edge Cases

When the recipient clicks **Answer** or **Decline** from a notification:

1. **Service Worker Navigation:**
   The service worker executes `clients.openWindow('/?callId=' + callId + '&callAction=' + action)`.
2. **Authoritative Revalidation in `callManager.handleDeepLinkCall`:**
   - **Recipient Identity Check:** Validates that `call.receiver_id === currentUserId`.
   - **Call Pending Validation:** Confirms `call.status` is `'calling'` or `'ringing'`. If already `'accepted'`, `'ended'`, or `'rejected'`, displays a non-blocking toast ("This call has already ended or was answered elsewhere.") without establishing WebRTC.
   - **Expiration Check:** Calls older than 60 seconds without connection are automatically transitioned to `'missed'`.
   - **Multi-Device Collision Prevention:** Only the first device to accept updates the database record; secondary devices validate against the updated status and abort negotiation.

---

## 5. Deployment & VAPID Configuration

To enable Web Push in production:

1. Generate standard VAPID key pairs:
   ```bash
   npx web-push generate-vapid-keys
   ```
2. Store the **Public Key** in your frontend client environment:
   ```env
   VITE_VAPID_PUBLIC_KEY=your_public_key_here
   ```
3. Store the **Private Key** in your Supabase Edge Function Secrets (never in client code!):
   ```bash
   supabase secrets set VAPID_PUBLIC_KEY="your_public_key_here"
   supabase secrets set VAPID_PRIVATE_KEY="your_private_key_here"
   supabase secrets set VAPID_SUBJECT="mailto:support@universal.app"
   ```
4. Deploy the Edge Function:
   ```bash
   supabase functions deploy send-call-push
   ```
5. Apply the database migration:
   - Run `/supabase/push_notifications_and_calls_migration.sql` in the Supabase Dashboard SQL Editor.
