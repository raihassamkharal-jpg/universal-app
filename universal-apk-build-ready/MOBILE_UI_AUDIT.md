# Universal — Mobile UI Technical Audit & Interface Model Report

**Audit Status:** Inspection-Only (Zero code modified)  
**Date:** October 9, 2026  
**Target Platform:** Universal Web & Mobile Application (React 19 + TypeScript + Vite + Tailwind CSS v4)  
**Primary Finding:** The reported missing and invisible icons on mobile are **confirmed architectural and CSS responsive defects**. Multiple key interactive icons are gated behind desktop-only CSS `:hover` states (`group-hover:opacity-100` on `opacity-0` elements) which never activate on mobile touchscreens, and header utility icons are horizontally crowded and clipped by duplicate navigation bars.

---

## 1. Executive Summary & Root Cause Analysis

### Why are icons missing or invisible on mobile?
A deep technical inspection of every source component in `/src` revealed **three primary root causes** with direct source code evidence:

1. **Hover-Gated Actions on Touchscreens (Critical)**
   * **Location:** `src/components/chat/MessageItem.tsx` (Lines 371–394) and `src/components/chat/ConversationList.tsx` (Lines 297–307).
   * **Source Evidence:**
     ```tsx
     // MessageItem.tsx
     <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-0.5">
       <button ... title="React to message"><Smile className="w-4 h-4" /></button>
       <button ... title="Message options"><MoreVertical className="w-4 h-4" /></button>
     </div>
     
     // ConversationList.tsx
     <button className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 ...">
       <MoreVertical className="w-3.5 h-3.5" />
     </button>
     ```
   * **Mechanism:** On desktop, moving a mouse cursor over a message bubble or chat row triggers `:hover`, transitioning opacity from `0` to `1`. On smartphones and tablets (iOS Safari, Android Chrome), **touch devices do not have persistent cursor hover**. As a consequence, the `Smile` (reactions), `MoreVertical` (Reply, Edit, Copy, Delete), and conversation options (Pin, Mute, Archive) buttons remain at `opacity: 0` (invisible) and cannot be reached by mobile users.

2. **Dual Simultaneous Navigation Bars Causing Header Crowding & Clipping (High)**
   * **Location:** `src/components/layout/Header.tsx` (Lines 70–91) and `src/App.tsx` (Lines 177–196).
   * **Source Evidence:**
     * `Header.tsx` renders the middle `navTabs` (`MessageSquare`, `Phone`, `Share2`, `HardDrive`, `Bookmark`) with width up to `280px`.
     * `App.tsx` renders the mobile bottom bar `<nav className="md:hidden h-16...">` with the **exact same 5 tabs**.
   * **Mechanism:** Because `Header.tsx` does **not** hide its center navigation tabs on mobile screens (`<md`), a 360px mobile screen must fit:
     * Brand wordmark + logo (~110px)
     * Nav bar (~250px)
     * Search, QR Code, Bell, Settings, Avatar, Logout (~180px)
     * Total required width: **~540px** on a 320px–375px screen!
   * **Result:** Header action icons (Search, QR ID card, Notification Bell, Settings, Logout) are compressed, pushed offscreen to the right, or hidden behind screen boundaries.

3. **Fixed-Width Popovers Overflowing Mobile Viewport (Medium)**
   * **Location:** `src/components/chat/StickerGifPicker.tsx` (Line 217) and `src/components/notifications/NotificationBell.tsx` (Line 117).
   * **Source Evidence:**
     * `StickerGifPicker.tsx`: `<div className="w-80 sm:w-96 ...">` placed at `left-2 sm:left-4`.
     * `NotificationBell.tsx`: `<div className="absolute right-0 mt-2 w-80 sm:w-96 ...">`.
   * **Mechanism:** `w-80` is exactly 320px wide. When positioned with margins or inside a container on viewports between 320px and 360px, the element exceeds 100vw, clipping interactive buttons such as the Close (`X`) button, right-side emojis, and notification dismiss buttons.

---

## 2. Screen-by-Screen Interface Inventory

### Screen 1: Top Application Header (`src/components/layout/Header.tsx`)
* **Role:** Global persistent header across all application states.
* **Layout:** `h-16 border-b bg-white/95 dark:bg-neutral-900/95 sticky top-0 z-30 px-3 sm:px-6 flex items-center justify-between`.
* **Icons Present:**
  * Logo mark: "U" badge (custom avatar)
  * Middle Nav Tabs (when authenticated): `MessageSquare`, `Phone`, `Share2`, `HardDrive`, `Bookmark` (lucide-react, 14px)
  * Search button: `Search` (lucide-react, 16px)
  * QR ID Card button: `QrCode` (lucide-react, 16px)
  * Notifications: `Bell` (in `NotificationBell.tsx`, 16px)
  * Settings: `Sliders` (lucide-react, 16px)
  * Avatar: User image or initials
  * Logout: `LogOut` (lucide-react, 16px)
* **Mobile Status:** **CROWDED & CLIPPED ON <=390px VIEWPORTS**. The middle `navTabs` should be hidden on mobile because the Mobile Bottom Bar in `App.tsx` already handles tab switching.

### Screen 2: Mobile Bottom Navigation Bar (`src/App.tsx`)
* **Role:** Mobile primary tab switching bar (`md:hidden`).
* **Layout:** `h-16 border-t bg-white/95 dark:bg-neutral-900/95 fixed bottom-0 z-20 flex justify-around`.
* **Icons Present:**
  * `MessageSquare` (Chats)
  * `Phone` (Calls)
  * `Share2` (Social)
  * `HardDrive` (Drive)
  * `Bookmark` (Capsule)
* **Mobile Status:** **RENDERED BUT OBSTRUCTIVE IN CHAT**. It remains visible even when a conversation is open, stealing 64px of height from the chat message scroll area and input dock.

### Screen 3: Conversation List & Stories (`src/components/chat/ConversationList.tsx` & `StatusTray.tsx`)
* **Role:** List of direct message conversations and 24-hour status circles.
* **Layout:** Full width on mobile (`selectedConversationId ? 'hidden md:flex' : 'flex'`).
* **Icons Present:**
  * Search input: `Search` (16px)
  * New Chat button: `Plus` (16px)
  * Status Add badge: `Plus` (12px on story ring)
  * Last message indicators: `ImageIcon`, `Video`, `Mic`, `FileText`, `Check`, `CheckCheck`
  * Chat Options Menu: `MoreVertical` (14px), `Pin`, `VolumeX`, `Archive`
* **Mobile Status:** **CONFIRMED DEFECT ON MOREVERTICAL**. The options trigger has `opacity-0 group-hover:opacity-100`, making it impossible for touch users to pin, mute, or archive chats.

### Screen 4: Individual Chat Screen (`src/components/chat/ChatArea.tsx`)
* **Role:** Direct 1-on-1 messaging interface with real-time delivery.
* **Layout:** Full viewport height column (`flex-1 h-full flex flex-col`).
* **Icons Present:**
  * Back button: `ArrowLeft` (20px, mobile only: `md:hidden`)
  * Calling buttons: `Phone` (16px), `Video` (16px)
  * Search: `Search` (hidden on mobile header; present in MoreVertical overflow)
  * Shared media: `FolderOpen` (hidden on mobile header; present in MoreVertical overflow)
  * Mobile more: `MoreVertical` (16px, `sm:hidden`)
  * Attachment: `Paperclip` (16px–20px)
  * Emoji picker: `Smile` (16px–20px)
  * Composer submit: `Send` (16px) or `Mic` (16px–20px)
  * Edit submit: `Check` (16px–20px)
* **Mobile Status:** **CONFIRMED DEFECT ON EMOJI POPOVER**. Popover overflows viewport width on narrow mobile screens.

### Screen 5: Message Bubble Item (`src/components/chat/MessageItem.tsx`)
* **Role:** Individual chat bubbles, reactions, media display, and context menus.
* **Icons Present:**
  * Sent / Read status: `Check`, `CheckCheck` (14px)
  * Pending / Retry: `Loader2`, `AlertCircle`
  * Quick react: `Smile` (16px)
  * Message options: `MoreVertical` (16px)
  * Menu options: `Reply`, `Copy`, `Edit2`, `Trash2`
* **Mobile Status:** **CRITICAL CONFIRMED DEFECT**. `Smile` and `MoreVertical` are invisible (`opacity-0`) because they require mouse hover (`group-hover:opacity-100`).

### Screen 6: WebRTC Call Screen (`src/components/calling/CallModal.tsx`)
* **Role:** Incoming call alerts and active audio/video calls.
* **Layout:** Fullscreen fixed overlay (`fixed inset-0 z-50 bg-neutral-950`).
* **Icons Present:**
  * Incoming: `PhoneOff` (24px, decline), `Phone` / `Video` (24px, accept)
  * Active In-Call Dock: `Mic` / `MicOff` (20px), `Video` / `VideoOff` (20px), `PhoneOff` (28px)
  * Autoplay recovery banner: `VolumeX` (16px)
  * Header: `Maximize2` / `Minimize2` (16px)
* **Mobile Status:** **FUNCTIONAL & VISIBLE**. Covers mobile screen cleanly with high z-index.

### Screen 7: Call History View (`src/components/calling/CallHistoryView.tsx`)
* **Role:** Audio and video call logs.
* **Icons Present:**
  * Top bar: `Sliders` (14px), `Plus` (14px)
  * Search: `Search` (16px)
  * Direction indicators: `PhoneIncoming`, `PhoneOutgoing`, `PhoneMissed` (14px)
  * Direct callback: `Phone` (16px), `Video` (16px)
* **Mobile Status:** **RENDERED NORMAL**.

### Screen 8: Social Feed (`src/components/social/SocialFeedView.tsx`)
* **Role:** Posts, community feed, polls, and comments.
* **Icons Present:**
  * Composer: `ImageIcon`, `BarChart2`, `Send` (14px–16px)
  * Follow toggle: `UserPlus`, `UserCheck` (14px)
  * Post actions: `Heart` (like), `MessageCircle` (comments), `Share2` (share), `Trash2` (delete)
* **Mobile Status:** **RENDERED NORMAL**.

### Screen 9: Universal Drive (`src/components/drive/UniversalDriveView.tsx`)
* **Role:** Cloud file storage and documents.
* **Icons Present:**
  * Header: `Upload` (14px)
  * File cards: `ImageIcon`, `Video`, `FileArchive`, `FileText`, `Download`, `Trash2`
* **Mobile Status:** **RENDERED NORMAL**.

### Screen 10: Message Capsule (`src/components/capsule/MessageCapsuleView.tsx`)
* **Role:** Personal clippings, notes, reminders, and memory board.
* **Icons Present:**
  * Header: `Plus` (14px)
  * Cards: `FileText`, `Bell`, `Link`, `ImageIcon`, `Trash2`
* **Mobile Status:** **RENDERED NORMAL**.

### Screen 11: Settings & Calls Modal (`src/components/settings/SettingsModal.tsx`)
* **Role:** Account, audio, ringtones, device tests, privacy, data export, and preferences.
* **Icons Present:**
  * Tabs: `User`, `Phone`, `Shield`, `FileText`, `Bell`, `Palette`, `Globe`, `UserX` (16px)
  * Ringtones: `Play`, `Square`, `Upload`
  * Mic / Camera tests: `Mic`, `Video`
  * Data & Security: `Download` (export), `Trash2` (delete account)
* **Mobile Status:** **PARTIAL SCROLL CROWDING**. Tabs scroll horizontally on mobile; last 3 tabs can be missed without visible scroll cues.

### Screen 12: Search, QR, Profile & Privacy Modals
* `GlobalSearchModal.tsx`: `Search`, `X`, `Loader2` — **RENDERED NORMAL**.
* `UserSearchModal.tsx`: `Search`, `X`, `MessageSquare` — **RENDERED NORMAL**.
* `UniversalIdCardModal.tsx`: `QrCode`, `Copy`, `Check`, `Share2`, `X` — **RENDERED NORMAL**.
* `UserProfileModal.tsx`: `Camera`, `Upload`, `X`, `Check` — **RENDERED NORMAL**.
* `PrivacyPolicyModal.tsx`: `ShieldCheck`, `Lock`, `X` — **RENDERED NORMAL**.

---

## 3. Viewport Analysis Summary

| Viewport | Device Class | Layout Status | Confirmed Mobile Visual Issues |
|---|---|---|---|
| **320 × 568** | Ultra-small (iPhone SE 1st gen) | **CRITICAL OVERFLOW** | Header navTabs collide with utility icons; `StickerGifPicker` overflows right edge by 8px; message hover buttons invisible |
| **360 × 800** | Standard Android (Samsung A-series) | **OVERCROWDED** | Header utility icons compressed; duplicate navigation bars; message hover buttons invisible |
| **375 × 812** | Standard iOS (iPhone X/11/12/13 mini) | **DEFECTIVE** | Dual nav bars; message hover buttons invisible; conversation 3-dots invisible |
| **390 × 844** | Modern iOS (iPhone 13/14/15/16) | **DEFECTIVE** | Message hover buttons invisible; conversation 3-dots invisible; dual nav bars |
| **430 × 932** | Large iOS (iPhone Pro Max) | **DEFECTIVE** | Message hover buttons invisible; conversation 3-dots invisible; dual nav bars |
| **768 × 1024** | Tablet (iPad Portrait) | **PARTIAL PASS** | Side-by-side chat layout active; hover triggers still problematic if touched |
| **1366 × 768** | Desktop / Laptop | **PASS** | Mouse hover triggers activate all buttons as intended |

*Note on Testing Environment:* The current container is a Linux execution environment without an installed headless Google Chrome or Playwright browser executable (`which chromium google-chrome playwright` returned `No browser cli`). Therefore, automated screenshot generation was unavailable. All findings above are grounded directly in the verified AST and source code files.

---

## 4. List of Files Requiring Modification to Fix Confirmed Issues

When authorized to apply the fixes, the following **7 files** must be updated:

1. **`src/components/chat/MessageItem.tsx`**
   * *Required change:* Replace `opacity-0 group-hover:opacity-100` with mobile touch-accessible styling (e.g. `opacity-100 sm:opacity-0 sm:group-hover:opacity-100` or tap-to-select action bar) so mobile users can react, reply, edit, copy, and delete messages.

2. **`src/components/chat/ConversationList.tsx`**
   * *Required change:* Replace `opacity-0 group-hover:opacity-100` on the `MoreVertical` button with `opacity-100 sm:opacity-0 sm:group-hover:opacity-100` so mobile users can pin, mute, and archive chats.

3. **`src/components/layout/Header.tsx`**
   * *Required change:* Add `hidden md:flex` to the center `navTabs` container. This removes duplicate tabs on mobile and instantly frees up ~280px in the header, eliminating all crowding and clipping of Search, QR, Bell, Settings, and Avatar icons.

4. **`src/App.tsx`**
   * *Required change:* Conditionally hide the mobile bottom navigation bar when an active chat conversation is open in `ChatLayout`, restoring 64px of height to the chat screen and avoiding overlap with the message input composer.

5. **`src/components/chat/StickerGifPicker.tsx`**
   * *Required change:* Replace fixed `w-80` with `w-[calc(100vw-1.5rem)] sm:w-96 max-w-sm` to guarantee the picker never overflows 320px–360px mobile viewports.

6. **`src/components/notifications/NotificationBell.tsx`**
   * *Required change:* Update dropdown width from fixed `w-80` to `w-[calc(100vw-2rem)] sm:w-96 max-w-sm` to prevent horizontal overflow on narrow screens.

7. **`src/components/settings/SettingsModal.tsx`**
   * *Required change:* Add visual fading gradient or scroll indicator to the mobile horizontal tab bar so users know tabs 6, 7, and 8 (Appearance, Language, Blocked Users) are scrollable.

---

## 5. Machine-Readable Model

The complete machine-readable audit model has been generated and saved to:  
`/MOBILE_UI_AUDIT.json`

This file contains the complete JSON structure including `project_overview`, `screens`, `components`, `navigation`, `icon_inventory`, `responsive_rules`, `confirmed_bugs`, `potential_bugs`, `testing_results`, `files_to_inspect`, and `recommended_fixes`.
