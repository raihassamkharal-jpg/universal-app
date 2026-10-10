# Universal — Master Backend Configuration Guide

This guide details how to configure and upgrade your Supabase database, storage, and communication infrastructure for **Universal**.

---

## 1. Single Master Database & Storage Upgrade

To provision and configure all backend requirements for the entire Universal system (1-to-1 chats, attachments, voice messages, reactions, 24-hour status stories, WebRTC calling & signaling, social feed & polls, Universal Drive, message capsule, notifications, and custom ringtone storage):

1. Open your **Supabase Dashboard** -> Select your Project.
2. In the left navigation, click on **SQL Editor**.
3. Click **+ New Query**.
4. Open the file **`supabase/universal_final_migration.sql`** in this project.
5. Copy the entire contents of **`supabase/universal_final_migration.sql`**, paste into the editor, and click **Run**.

### Key Master Migration Guarantees:
- **Consolidated & Single-Run**: You only need to run this ONE file. You do NOT need to run Phase 1, Phase 2, or earlier scripts separately.
- **Idempotent & Safe**: Preserves existing tables, users, messages, profiles, and media. Uses `IF NOT EXISTS`, catalog publication checks, and safe policy updates.
- **Storage Buckets Automatically Configured**:
  - `chat-attachments` (50MB limit)
  - `avatars` (10MB limit)
  - `audio-custom` (20MB limit for custom calling ringtones and notification sounds)
  - `feed-media` (50MB limit for social feed photos/videos)
  - `drive-files` (100MB limit for Universal Drive personal storage)
- **Supabase Realtime Activated**: Publications for `messages`, `message_reactions`, `statuses`, `calls`, `call_signaling`, `notifications`, `posts`, `post_comments`, and `post_likes`.

---

## 2. WebRTC Audio & Video Calling Infrastructure

Universal includes genuine peer-to-peer WebRTC audio and video calling:

### STUN Servers:
Universal comes pre-configured with Google's public STUN servers:
- `stun:stun.l.google.com:19302`
- `stun:stun1.l.google.com:19302`
- `stun:stun2.l.google.com:19302`

### TURN Server Requirements (Optional for Symmetric NATs):
While STUN enables direct peer connections for the majority of consumer network topologies, strict enterprise firewalls or symmetric NATs may require a TURN relay server (such as Coturn, Metered, or Twilio). 
If you operate in strict corporate firewalls, you can add your TURN credentials inside `src/lib/webrtc/callManager.ts` in the `ICE_SERVERS` configuration.

### Browser Permissions:
- **Microphone & Camera**: Audio and video calls request explicit browser permission (`navigator.mediaDevices.getUserMedia`). If denied by the user, Universal presents a clear error message.
- **Audio Autoplay**: Modern browsers enforce user-interaction policies before playing audio. Ringtone audio plays when an active tab session is interacted with, supported by synthesized Web Audio API fallbacks.

---

## 3. Environment Variables

Universal reads configuration from `.env` or system environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-publishable-key>
```

---

## 4. Google OAuth Setup (Optional)

Universal supports email/password authentication out of the box and optional Google OAuth:

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Create an **OAuth 2.0 Client ID** (Web application).
3. In **Authorized JavaScript origins**, add your app domain.
4. In **Authorized redirect URIs**, copy your Supabase callback URL:
   ```text
   https://<your-project-id>.supabase.co/auth/v1/callback
   ```
5. In your **Supabase Dashboard**:
   - Navigate to **Authentication** -> **Providers** -> **Google**.
   - Toggle **Enable Google provider** to ON.
   - Enter your Client ID and Client Secret, then Save.
